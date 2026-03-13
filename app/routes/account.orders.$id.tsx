import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction, Link} from '@remix-run/react';
import {Money, flattenConnection} from '@shopify/hydrogen';
import type {OrderLineItemFullFragment} from 'customer-accountapi.generated';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {Card, CardContent, CardHeader} from '~/components/ui/card';
import {Button} from '~/components/ui/button';
import {useEffect, useState} from 'react';
import Sectiontitle from '~/components/global/Sectiontitle';
import {getR2ObjectKeyFromTagsForVariant} from '~/lib/downloads';
import {ProductCarousel} from '~/components/products/productCarousel';
import EProductsContainer from '~/components/eproducts/EProductsContainer';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';

const ORDER_LINE_ITEM_VARIANT_DETAILS_QUERY = `#graphql
  query OrderLineItemVariantDetails($id: ID!) {
    node(id: $id) {
      ... on ProductVariant {
        id
        selectedOptions {
          name
          value
        }
        product {
          id
          title
          handle
          tags
          descriptionHtml
          featuredImage {
            url
            altText
            width
            height
          }
          images(first: 20) {
            nodes {
              url
              altText
              width
              height
            }
          }
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
          }
          selectedOrFirstAvailableVariant {
            id
            availableForSale
            compareAtPrice {
              amount
              currencyCode
            }
            price {
              amount
              currencyCode
            }
          }
          options {
            name
            optionValues {
              name
              firstSelectableVariant {
                id
                availableForSale
                image {
                  url
                  altText
                  width
                  height
                }
                price {
                  amount
                  currencyCode
                }
                compareAtPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
        }
      }
    }
  }
` as const;

const ACCOUNT_LOGGED_IN_PROMISE = Promise.resolve(true);
type LineItemSelectedOption = {name: string; value: string};

export const meta: MetaFunction<typeof loader> = ({data}) => {
  const orderName =
    typeof data?.order?.name === 'string' ? data.order.name.trim() : '';
  return buildIconLinkPreviewMeta(
    orderName
      ? `Adam Underwater | Order ${orderName}`
      : 'Adam Underwater | My Orders',
  );
};

export async function loader({params, context}: LoaderFunctionArgs) {
  if (!params.id) {
    return redirect('/account/orders');
  }
  const {storefront} = context;
  const orderId = atob(params.id);
  const {data, errors} = await context.customerAccount.query(
    CUSTOMER_ORDER_QUERY,
    {
      variables: {orderId},
    },
  );

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  const lineItems = flattenConnection(order.lineItems);
  const discountApplications = flattenConnection(order.discountApplications);

  const fulfillmentStatus =
    //@ts-expect-error order is any
    flattenConnection(order.fulfillments)[0]?.status ?? 'N/A';
  //@ts-expect-error order is any
  const firstDiscount = discountApplications[0]?.value;

  const discountValue =
    firstDiscount?.__typename === 'MoneyV2' && firstDiscount;

  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue' &&
    firstDiscount?.percentage;

  const variantIds = Array.from(
    new Set(
      lineItems
        .map((lineItem: any) => lineItem?.variantId)
        .filter(
          (variantId): variantId is string => typeof variantId === 'string',
        ),
    ),
  );
  const variantResponses = await Promise.all(
    variantIds.map((id) =>
      storefront
        .query(ORDER_LINE_ITEM_VARIANT_DETAILS_QUERY, {
          variables: {
            id,
          },
        })
        .catch(() => null),
    ),
  );
  const downloadMetadataByVariantId = new Map<
    string,
    {tags: string[]; selectedOptions: Array<{name?: string; value?: string}>}
  >();
  const productByVariantId = new Map<string, any>();
  for (const response of variantResponses) {
    const variant = response?.node as any;
    if (typeof variant?.id !== 'string') continue;
    const product = variant?.product as any;
    const tags = Array.isArray(variant?.product?.tags)
      ? variant.product.tags
      : [];
    const selectedOptions = Array.isArray(variant?.selectedOptions)
      ? variant.selectedOptions
      : [];
    downloadMetadataByVariantId.set(variant.id, {tags, selectedOptions});
    if (product?.id && product?.handle) {
      productByVariantId.set(variant.id, product);
    }
  }

  const lineItemTagsByLineItemId = lineItems.reduce<Record<string, string[]>>(
    (acc, lineItem: any) => {
      const lineItemId = typeof lineItem?.id === 'string' ? lineItem.id : '';
      const variantId =
        typeof lineItem?.variantId === 'string' ? lineItem.variantId : '';
      if (!lineItemId || !variantId) return acc;

      const variantMetadata = downloadMetadataByVariantId.get(variantId);
      if (!variantMetadata) return acc;

      acc[lineItemId] = variantMetadata.tags;
      return acc;
    },
    {},
  );

  const encodedOrderId = params.id;
  const downloadLinksByLineItemId = lineItems.reduce<Record<string, string>>(
    (acc, lineItem: any) => {
      const lineItemId = typeof lineItem?.id === 'string' ? lineItem.id : '';
      const variantId =
        typeof lineItem?.variantId === 'string' ? lineItem.variantId : '';
      if (!lineItemId || !variantId) return acc;

      const variantMetadata = downloadMetadataByVariantId.get(variantId);
      if (!variantMetadata) return acc;
      const objectKey = getR2ObjectKeyFromTagsForVariant({
        tags: variantMetadata.tags,
        selectedOptions: variantMetadata.selectedOptions,
        variantTitle: lineItem?.variantTitle,
      });
      if (!objectKey) return acc;

      acc[lineItemId] =
        `/account/orders/${encodedOrderId}/download?lineItemId=${encodeURIComponent(lineItemId)}`;
      return acc;
    },
    {},
  );

  const lineItemProductsByLineItemId = lineItems.reduce<Record<string, any>>(
    (acc, lineItem: any) => {
      const lineItemId = typeof lineItem?.id === 'string' ? lineItem.id : '';
      const variantId =
        typeof lineItem?.variantId === 'string' ? lineItem.variantId : '';
      if (!lineItemId || !variantId) return acc;

      const product = productByVariantId.get(variantId);
      if (!product) return acc;

      acc[lineItemId] = product;
      return acc;
    },
    {},
  );

  const lineItemSelectedOptionsByLineItemId = lineItems.reduce<
    Record<string, LineItemSelectedOption[]>
  >((acc, lineItem: any) => {
    const lineItemId = typeof lineItem?.id === 'string' ? lineItem.id : '';
    const variantId =
      typeof lineItem?.variantId === 'string' ? lineItem.variantId : '';
    if (!lineItemId || !variantId) return acc;

    const variantMetadata = downloadMetadataByVariantId.get(variantId);
    if (!variantMetadata) return acc;

    const selectedOptions = (variantMetadata.selectedOptions ?? [])
      .map((option) => {
        const name = typeof option?.name === 'string' ? option.name.trim() : '';
        const value =
          typeof option?.value === 'string' ? option.value.trim() : '';
        if (!name || !value) return null;
        if (value.toLowerCase() === 'default title') return null;
        return {name, value};
      })
      .filter((option): option is LineItemSelectedOption => option !== null);

    if (!selectedOptions.length) return acc;
    acc[lineItemId] = selectedOptions;
    return acc;
  }, {});

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
    downloadLinksByLineItemId,
    lineItemTagsByLineItemId,
    lineItemProductsByLineItemId,
    lineItemSelectedOptionsByLineItemId,
  };
}

export default function OrderRoute() {
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
    downloadLinksByLineItemId,
    lineItemTagsByLineItemId,
    lineItemProductsByLineItemId,
    lineItemSelectedOptionsByLineItemId,
  } = useLoaderData<typeof loader>();

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  return (
    <>
      <Sectiontitle text="My Orders" />
      <div className="mx-5 mt-3">
        <Card className="account-order p-[10px]">
          <CardHeader>
            <p className="ms-2">
              <strong>Order {order.name}</strong>
            </p>
            <p className="ms-2">
              Placed on {new Date(order.processedAt!).toDateString()}
            </p>
          </CardHeader>
          <CardContent>
            <div>
              {windowWidth && windowWidth >= 605 && (
                <>
                  <div className="upper-part-large grid grid-cols-2">
                    <div>
                      {/* <table> */}
                      {lineItems.length <= 1 ? (
                        <Card className="p-5">
                          <div>
                            {lineItems.map((lineItem, lineItemIndex) => (
                              <OrderLineRow
                                key={`${lineItem.id ?? lineItemIndex}`}
                                lineItem={
                                  lineItem as unknown as OrderLineItemFullFragment
                                }
                                downloadLinksByLineItemId={
                                  downloadLinksByLineItemId
                                }
                                lineItemTagsByLineItemId={
                                  lineItemTagsByLineItemId
                                }
                                lineItemProductsByLineItemId={
                                  lineItemProductsByLineItemId
                                }
                                lineItemSelectedOptionsByLineItemId={
                                  lineItemSelectedOptionsByLineItemId
                                }
                              />
                            ))}
                          </div>
                        </Card>
                      ) : (
                        <div className="space-y-5">
                          {lineItems.map((lineItem, lineItemIndex) => (
                            <Card
                              key={`${lineItem.id ?? lineItemIndex}`}
                              className="p-3"
                            >
                              <OrderLineRow
                                lineItem={
                                  lineItem as unknown as OrderLineItemFullFragment
                                }
                                downloadLinksByLineItemId={
                                  downloadLinksByLineItemId
                                }
                                lineItemTagsByLineItemId={
                                  lineItemTagsByLineItemId
                                }
                                lineItemProductsByLineItemId={
                                  lineItemProductsByLineItemId
                                }
                                lineItemSelectedOptionsByLineItemId={
                                  lineItemSelectedOptionsByLineItemId
                                }
                              />
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                    {windowWidth && windowWidth >= 604 && (
                      <>
                        <div className="lower-part">
                          <Card className="ms-5 p-5">
                            <h3 className="pb-3">
                              <strong>Shipping Address:</strong>
                            </h3>
                            {order?.shippingAddress ? (
                              <address>
                                <p>{order.shippingAddress.name}</p>
                                {order.shippingAddress.formatted ? (
                                  <>
                                    <p>{order.shippingAddress.formatted[1]}</p>
                                    <p>{order.shippingAddress.formatted[2]}</p>
                                    <p>{order.shippingAddress.formatted[3]}</p>
                                  </>
                                ) : (
                                  ''
                                )}
                              </address>
                            ) : (
                              <p>N/A</p>
                            )}
                            <h3 className="pt-3">
                              <strong>Status:</strong>
                            </h3>
                            <div>
                              <p>
                                {fulfillmentStatus === 'SUCCESS'
                                  ? 'Shipped'
                                  : 'Preparing Shipment'}
                              </p>
                            </div>
                          </Card>
                          <div className="pt-3 ps-5 totals flex justify-end items-end">
                            <Card className="grid grid-cols-1 w-full h-[60%] pe-6">
                              {((discountValue && discountValue.amount) ||
                                discountPercentage) && (
                                <div className="tr flex justify-between">
                                  {/* <tr className="flex justify-between"> */}
                                  <div className="flex justify-center items-center">
                                    <div className="th">
                                      {/* <th scope="row" colSpan={2}> */}
                                      <p>Discounts</p>
                                    </div>
                                  </div>
                                  <div className="flex justify-center items-center">
                                    <div className="td">
                                      {/* <td> */}
                                      {discountPercentage ? (
                                        <span>-{discountPercentage}% OFF</span>
                                      ) : (
                                        discountValue && (
                                          <Money data={discountValue!} />
                                        )
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              <div className="tr flex justify-between">
                                {/* <tr className="flex justify-between"> */}
                                <div className="flex justify-center items-center">
                                  <div className="th">
                                    {/* <th scope="row" colSpan={2}> */}
                                    <p>Subtotal</p>
                                  </div>
                                </div>
                                <div className="flex justify-center items-center">
                                  <div className="td">
                                    {/* <td> */}
                                    <Money data={order.subtotal!} />
                                  </div>
                                </div>
                              </div>
                              <div className="tr flex justify-between">
                                {/*  <tr className="flex justify-between"> */}
                                <div className="flex justify-center items-center">
                                  <div className="th">Tax</div>
                                  {/* <th scope="row" colSpan={2}>
                                    Tax
                                  </th> */}
                                </div>
                                <div className="flex justify-center items-center">
                                  <div className="td">
                                    <Money data={order.totalTax!} />
                                  </div>
                                  {/* <td>
                                    <Money data={order.totalTax!} />
                                  </td> */}
                                </div>
                              </div>
                              <div className="tr flex justify-between">
                                {/* <tr className="flex justify-between"> */}
                                <div className="flex justify-center items-center">
                                  <div className="th">Total</div>
                                  {/* <th scope="row" colSpan={2}>
                                    Total
                                  </th> */}
                                </div>
                                <div className="flex justify-center items-center">
                                  <div className="td">
                                    <Money data={order.totalPrice!} />
                                  </div>
                                  {/* <td>
                                    <Money data={order.totalPrice!} />
                                  </td> */}
                                </div>
                              </div>
                            </Card>
                          </div>
                          <div className="flex justify-end items-end">
                            <Button variant="default" className="m-5">
                              <Link to={order.statusPageUrl} rel="noreferrer">
                                View Order Status →
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
              {windowWidth && windowWidth < 604 && (
                <>
                  <div className="upper-part-small grid grid-cols-1 flex justify-start">
                    <div className="table">
                      {/* <table> */}

                      <div className="tbody">
                        {/* <tbody> */}
                        {lineItems.map((lineItem, lineItemIndex) => (
                          <Card
                            key={`${lineItem.id ?? lineItemIndex}`}
                            className="p-3 mb-5"
                          >
                            <OrderLineRow
                              lineItem={
                                lineItem as unknown as OrderLineItemFullFragment
                              }
                              downloadLinksByLineItemId={
                                downloadLinksByLineItemId
                              }
                              lineItemTagsByLineItemId={
                                lineItemTagsByLineItemId
                              }
                              lineItemProductsByLineItemId={
                                lineItemProductsByLineItemId
                              }
                              lineItemSelectedOptionsByLineItemId={
                                lineItemSelectedOptionsByLineItemId
                              }
                            />
                          </Card>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="lower-part">
                    <Card className="mt-3 p-5">
                      <h3 className="pb-3">Shipping Address:</h3>
                      {order?.shippingAddress ? (
                        <address>
                          <p>{order.shippingAddress.name}</p>
                          {order.shippingAddress.formatted ? (
                            <>
                              <p>{order.shippingAddress.formatted[1]}</p>
                              <p>{order.shippingAddress.formatted[2]}</p>
                              <p>{order.shippingAddress.formatted[3]}</p>
                            </>
                          ) : (
                            ''
                          )}
                        </address>
                      ) : (
                        <p>N/A</p>
                      )}
                      <h3 className="pt-3">Status:</h3>
                      <div>
                        <p>
                          {fulfillmentStatus === 'SUCCESS'
                            ? 'Shipped'
                            : 'Preparing Shipment'}
                        </p>
                      </div>
                    </Card>
                  </div>
                  <div className="pt-3 totals flex justify-end items-end">
                    <Card className="grid grid-cols-1 w-full h-[60%] pe-6">
                      {((discountValue && discountValue.amount) ||
                        discountPercentage) && (
                        <div className="tr flex justify-between">
                          {/* <tr className="flex justify-between"> */}
                          <div className="flex justify-center items-center">
                            <div className="th">
                              {/* <th scope="row" colSpan={2}> */}
                              <p>Discounts</p>
                            </div>
                          </div>
                          <div className="flex justify-center items-center">
                            <div className="td">
                              {/* <td> */}
                              {discountPercentage ? (
                                <span>-{discountPercentage}% OFF</span>
                              ) : (
                                discountValue && <Money data={discountValue!} />
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="tr flex justify-between">
                        {/* <tr className="flex justify-between"> */}
                        <div className="flex justify-center items-center">
                          <div className="th">
                            {/* <th scope="row" colSpan={2}> */}
                            <p>Subtotal</p>
                          </div>
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">
                            {/* <td> */}
                            <Money data={order.subtotal!} />
                          </div>
                        </div>
                      </div>
                      <div className="tr flex justify-between">
                        {/*  <tr className="flex justify-between"> */}
                        <div className="flex justify-center items-center">
                          <div className="th">Tax</div>
                          {/* <th scope="row" colSpan={2}>
                                    Tax
                                  </th> */}
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">
                            <Money data={order.totalTax!} />
                          </div>
                          {/* <td>
                                    <Money data={order.totalTax!} />
                                  </td> */}
                        </div>
                      </div>
                      <div className="tr flex justify-between">
                        {/* <tr className="flex justify-between"> */}
                        <div className="flex justify-center items-center">
                          <div className="th">Total</div>
                          {/* <th scope="row" colSpan={2}>
                                    Total
                                  </th> */}
                        </div>
                        <div className="flex justify-center items-center">
                          <div className="td">
                            <Money data={order.totalPrice!} />
                          </div>
                          {/* <td>
                                    <Money data={order.totalPrice!} />
                                  </td> */}
                        </div>
                      </div>
                    </Card>
                  </div>
                  <div className="flex justify-end items-end">
                    <Button variant="default" className="m-5">
                      <Link to={order.statusPageUrl} rel="noreferrer">
                        View Order Status →
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function OrderLineRow({
  lineItem,
  downloadLinksByLineItemId = {},
  lineItemTagsByLineItemId = {},
  lineItemProductsByLineItemId = {},
  lineItemSelectedOptionsByLineItemId = {},
}: {
  lineItem: OrderLineItemFullFragment;
  downloadLinksByLineItemId?: Record<string, string>;
  lineItemTagsByLineItemId?: Record<string, string[]>;
  lineItemProductsByLineItemId?: Record<string, any>;
  lineItemSelectedOptionsByLineItemId?: Record<
    string,
    LineItemSelectedOption[]
  >;
}) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const downloadUrl = downloadLinksByLineItemId[lineItem.id];
  const itemSubtotal =
    lineItem.quantity * Number(lineItem.price?.amount) -
    Number(lineItem.totalDiscount.amount);
  const selectedOptions =
    lineItemSelectedOptionsByLineItemId[lineItem.id] ?? [];

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const lineItemProduct = lineItemProductsByLineItemId[lineItem.id] ?? null;
  const tagsFromLineItemMap = lineItemTagsByLineItemId[lineItem.id] ?? [];
  const tagsFromProduct = Array.isArray(lineItemProduct?.tags)
    ? (lineItemProduct.tags as string[])
    : [];
  const lineItemTags = tagsFromLineItemMap.length
    ? tagsFromLineItemMap
    : tagsFromProduct;
  const isStockClipFromTags = lineItemTags.includes('Video');
  const isBundleFromTags = lineItemTags.includes('Bundle');
  const isPrintFromTags =
    lineItemTags.includes('Prints') && !isStockClipFromTags;

  const imageUrl = lineItem?.image?.url ?? '';
  const isHorizontalProductFromImage =
    imageUrl.includes('horPrimary') || imageUrl.includes('horOnly');
  const isVerticalProductFromImage =
    imageUrl.includes('vertOnly') || imageUrl.includes('vertPrimary');
  const isPrintFromImage =
    isHorizontalProductFromImage || isVerticalProductFromImage;

  const hasTypeFromTags = isStockClipFromTags || isPrintFromTags;
  const isStockClip = hasTypeFromTags ? isStockClipFromTags : !isPrintFromImage;
  const isPrint = hasTypeFromTags ? isPrintFromTags : isPrintFromImage;

  const fallbackPreview = (
    <div>
      <div className="grid grid-cols-1 pb-3">
        <div className="flex justify-center">
          <p>
            <strong>{lineItem.title}</strong>
          </p>
        </div>
        <div className="flex justify-center">
          {isPrint && (
            <p className="text-muted-foreground">Framed Canvas Print</p>
          )}
          {isStockClip && (
            <p className="text-muted-foreground">
              {isBundleFromTags
                ? 'Stock Footage Bundle'
                : 'Stock Footage Video'}
            </p>
          )}
        </div>
        <div className="flex justify-center">
          <small>{lineItem.variantTitle}</small>
        </div>
      </div>
      {lineItem?.image?.url ? (
        <div className="flex justify-center">
          <img
            src={lineItem.image.url}
            alt={lineItem.image.altText ?? lineItem.title ?? 'Ordered item'}
            className="max-h-[250px] rounded object-cover"
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div key={lineItem.id} className="tr account-order-line-row">
      <div className="td pb-5">
        <div className="pb-3">
          {lineItemProduct && isPrint ? (
            <div className="mx-auto max-w-[900px]">
              <ProductCarousel
                product={lineItemProduct}
                layout="list"
                isInWishlist={false}
                isLoggedIn={ACCOUNT_LOGGED_IN_PROMISE}
              />
            </div>
          ) : null}

          {lineItemProduct && isStockClip ? (
            <div className="mx-auto max-w-[900px]">
              <EProductsContainer
                product={lineItemProduct}
                layout="list"
                isInWishlist={false}
                isLoggedIn={ACCOUNT_LOGGED_IN_PROMISE}
              />
            </div>
          ) : null}

          {(!lineItemProduct || (!isPrint && !isStockClip)) && fallbackPreview}
        </div>
        {isPrint ? (
          <div className="grid grid-cols-2">
            <div className="flex justify-center">
              <div className="min-w-0">
                {selectedOptions.map((option, optionIndex) => (
                  <div
                    key={`${lineItem.id}-${option.name}-${option.value}-${optionIndex}`}
                    className="flex justify-start pb-1"
                  >
                    {option.name}: &nbsp;{option.value}
                  </div>
                ))}
                {!selectedOptions.length && lineItem.variantTitle ? (
                  <div className="flex justify-start pb-1">
                    Variant: &nbsp;{lineItem.variantTitle}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex justify-center">
              <div className="price-quantity-total">
                <div className="flex justify-start">
                  Price: &nbsp;
                  <Money data={lineItem.price!} />
                </div>
                <div className="flex justify-start">
                  Quantity: &nbsp;{lineItem.quantity}
                </div>
                {lineItem.totalDiscount.amount != '0.0' && (
                  <div className="flex justify-start">
                    Discount: &nbsp; -
                    <Money data={lineItem.totalDiscount!} />
                  </div>
                )}
                <div className="flex justify-start">
                  Total: &nbsp;
                  <Money
                    data={{
                      amount: itemSubtotal.toString(),
                      currencyCode: 'USD',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="price-quantity-total ps-3 pt-3">
            {selectedOptions.map((option, optionIndex) => (
              <div
                key={`${lineItem.id}-${option.name}-${option.value}-${optionIndex}`}
                className="flex justify-start pb-1"
              >
                {option.name}: &nbsp;{option.value}
              </div>
            ))}
            {!selectedOptions.length && lineItem.variantTitle ? (
              <div className="flex justify-start pb-1">
                Variant: &nbsp;{lineItem.variantTitle}
              </div>
            ) : null}
            <div className="flex justify-start">
              Price: &nbsp;
              <Money data={lineItem.price!} />
            </div>
            <div className="flex justify-start">
              Quantity: &nbsp;{lineItem.quantity}
            </div>
            {lineItem.totalDiscount.amount != '0.0' && (
              <div className="flex justify-start">
                Discount: &nbsp; -
                <Money data={lineItem.totalDiscount!} />
              </div>
            )}
            <div className="flex justify-start">
              Total: &nbsp;
              <Money
                data={{amount: itemSubtotal.toString(), currencyCode: 'USD'}}
              />
            </div>
          </div>
        )}
        {windowWidth && windowWidth < 605 && (
          <>
            {downloadUrl && (
              <div className="td pt-3">
                {/* <td> */}
                <div className="flex justify-center align-center">
                  {/* <Button variant="outline">Download ↓</Button> */}
                  {/* <a href={downloadLink[0]?.url}>download</a> */}
                  <Button variant="outline" className="mb-5" asChild>
                    <a href={downloadUrl}>Download ↓</a>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {windowWidth && windowWidth >= 605 && (
        <>
          {downloadUrl && (
            <div className="td">
              {/* <td> */}
              <div className="flex justify-center align-center">
                {/* <Button variant="outline">Download ↓</Button> */}
                {/* <a href={downloadLink[0]?.url}>download</a> */}
                <Button variant="outline" className="mb-5" asChild>
                  <a href={downloadUrl}>Download ↓</a>
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
