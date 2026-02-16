import {flattenConnection} from '@shopify/hydrogen';
import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {variantQuery} from '~/lib/customerQueries';
import {
  getDownloadFilenameFromObjectKey,
  getR2ObjectKeyFromTagsForVariant,
} from '~/lib/downloads';
import {
  createR2SignedDownloadUrl,
  R2ObjectNotFoundError,
} from '~/lib/r2.server';

const SIGNED_URL_TTL_SECONDS = 60 * 60;

function badRequest(message: string) {
  return new Response(message, {status: 400});
}

function notFound(message: string) {
  return new Response(message, {status: 404});
}

function forbidden(message: string) {
  return new Response(message, {status: 403});
}

export async function loader({context, params, request}: LoaderFunctionArgs) {
  await context.customerAccount.handleAuthStatus();

  if (!(await context.customerAccount.isLoggedIn())) {
    return redirect('/account/login');
  }

  if (!params.id) {
    return badRequest('Missing order id.');
  }

  const requestUrl = new URL(request.url);
  const lineItemId = requestUrl.searchParams.get('lineItemId');
  if (!lineItemId) {
    return badRequest('Missing line item id.');
  }

  let orderId = '';
  try {
    orderId = atob(params.id);
  } catch {
    return badRequest('Invalid order id.');
  }

  const {data, errors} = await context.customerAccount.query(
    CUSTOMER_ORDER_QUERY,
    {
      variables: {orderId},
    },
  );

  if (errors?.length || !data?.order) {
    return notFound('Order not found.');
  }

  const lineItems = flattenConnection(data.order.lineItems) as Array<any>;
  const matchingLineItem = lineItems.find(
    (lineItem) => lineItem?.id === lineItemId,
  );

  if (!matchingLineItem) {
    return notFound('Line item not found.');
  }

  const variantId = matchingLineItem?.variantId;
  if (typeof variantId !== 'string' || !variantId.length) {
    return forbidden('This line item is not downloadable.');
  }

  const variantResponse = await context.storefront.query(variantQuery, {
    variables: {id: variantId},
  });
  const tags = Array.isArray(variantResponse?.node?.product?.tags)
    ? variantResponse.node.product.tags
    : [];
  const selectedOptions = Array.isArray(variantResponse?.node?.selectedOptions)
    ? variantResponse.node.selectedOptions
    : [];
  const objectKey = getR2ObjectKeyFromTagsForVariant({
    tags,
    selectedOptions,
    variantTitle: matchingLineItem?.variantTitle,
  });

  if (!objectKey) {
    return notFound('No downloadable file is configured for this item.');
  }

  let signedUrl = '';
  try {
    signedUrl = await createR2SignedDownloadUrl(context.env, {
      objectKey,
      downloadFilename: getDownloadFilenameFromObjectKey(objectKey),
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
    });
  } catch (error) {
    if (error instanceof R2ObjectNotFoundError) {
      return notFound(
        'The downloadable file is configured but not found in R2. Check product tag filename/casing.',
      );
    }
    throw error;
  }

  return redirect(signedUrl, {
    headers: {'Cache-Control': 'no-store, private'},
  });
}

export async function action() {
  return new Response(null, {status: 405});
}
