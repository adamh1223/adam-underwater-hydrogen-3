import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction, Link} from '@remix-run/react';
import {
  Money,
  Image,
  flattenConnection,
  getSelectedProductOptions,
} from '@shopify/hydrogen';
import type {OrderLineItemFullFragment} from 'customer-accountapi.generated';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {Card, CardAction, CardContent, CardHeader} from '~/components/ui/card';
import {Button} from '~/components/ui/button';
import {useEffect, useState} from 'react';
import {generateCartDescription, includesTagName} from '~/lib/utils';
import {PRODUCT_QUERY} from './products.$handle';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Order ${data?.order?.name}`}];
};

export async function loader({params, context, request}: LoaderFunctionArgs) {
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
  console.log(data, '13579');
  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  const lineItems = flattenConnection(order.lineItems);
  const lineItemTitles = lineItems.map((lineItem: any) => lineItem.title);
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
  console.log(lineItems, '0123');

  const variantQuery = `#graphql
    query Variant($id: ID!) {
      node(id: $id) {
        ... on ProductVariant {
          id
          selectedOptions {
            name
            value
          }
          product {
            handle
          }
        }
      }
    }
  `;

  const variantIds = lineItems.map((li: any) => li?.variantId).filter(Boolean);
  const variantResponses = await Promise.all(
    variantIds.map((id) =>
      storefront.query(variantQuery, {
        variables: {
          id,
        },
      }),
    ),
  );
  const productVariants = variantResponses.map((variant) => variant?.node);
  const productPromises = productVariants.map((pv) => {
    const handle = pv?.product?.handle;
    const selectedOptions = pv?.selectedOptions;
    return storefront.query(PRODUCT_QUERY, {
      variables: {
        handle,
        selectedOptions,
      },
    });
  });
  const productResponses = await Promise.all(productPromises);

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
    productResponses,
  };
}

export default function OrderRoute() {
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
    productResponses,
  } = useLoaderData<typeof loader>();

  const tagDownloadLinks = productResponses
    ?.map((p) => {
      const productWithDownloadTag = p?.product?.tags?.filter((tag: any) =>
        tag.includes('download'),
      );
      if (productWithDownloadTag?.length) {
        return {
          url: productWithDownloadTag[0],
          text: p.product.title,
        };
      }
    })
    .filter(Boolean);

  console.log(order, '5678');
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });
  console.log(lineItems, '012345');

  return (
    <div className="outer-container flex justify-center">
      <div className="card-container flex justify-center w-[90%]">
        <Card className="account-order p-[30px]">
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
                      <Card className="p-5">
                        <div>
                          {/* <tbody> */}
                          {lineItems.map((lineItem, lineItemIndex) => (
                            // eslint-disable-next-line react/no-array-index-key
                            <OrderLineRow
                              key={lineItemIndex}
                              lineItem={
                                lineItem as unknown as OrderLineItemFullFragment
                              }
                              downloadLinks={tagDownloadLinks}
                            />
                            // ATTENTION: conditionally render the download button only on eproduct line items
                          ))}
                        </div>
                      </Card>
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
                  <div className="upper-part-small grid grid-cols-1 flex justify-start px-[100px]">
                    <div className="table">
                      {/* <table> */}

                      <div className="tbody">
                        {/* <tbody> */}
                        {lineItems.map((lineItem, lineItemIndex) => (
                          // eslint-disable-next-line react/no-array-index-key
                          <OrderLineRow
                            key={lineItemIndex}
                            lineItem={
                              lineItem as unknown as OrderLineItemFullFragment
                            }
                            downloadLinks={tagDownloadLinks}
                          />
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
    </div>
  );
}

function OrderLineRow({
  lineItem,
  downloadLinks,
}: {
  lineItem: OrderLineItemFullFragment;
  downloadLinks: {text: string; url: string}[];
}) {
  console.log(lineItem, '7123');

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const downloadLink = downloadLinks.filter((downloadLink) => {
    return downloadLink.text === lineItem.title;
  });
  console.log(downloadLinks, 'azaz');
  const itemSubtotal =
    lineItem.quantity * Number(lineItem.price?.amount) -
    Number(lineItem.totalDiscount.amount);
  console.log(itemSubtotal, '775577');

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });
  const isHorizontalProduct =
    lineItem?.image?.url?.includes('horPrimary') ||
    lineItem?.image?.url.includes('horOnly');
  const isStockClip =
    !lineItem?.image?.url.includes('horOnly') &&
    !lineItem?.image?.url.includes('horPrimary') &&
    !lineItem?.image?.url.includes('vertPrimary') &&
    !lineItem?.image?.url.includes('vertOnly');
  const isVerticalProduct =
    lineItem?.image?.url?.includes('vertOnly') ||
    lineItem?.image?.url.includes('vertPrimary');

  const isPrint =
    lineItem?.image?.url.includes('horOnly') ||
    lineItem?.image?.url.includes('horPrimary') ||
    lineItem?.image?.url.includes('vertPrimary') ||
    lineItem?.image?.url.includes('vertOnly');

  console.log(lineItem, '484848');
  return (
    <div key={lineItem.id} className="tr">
      {/* <tr key={lineItem.id}> */}
      <div className="td pb-5">
        {/* <td className="pb-5"> */}
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
                <p className="text-muted-foreground">Stock Footage Video</p>
              )}
            </div>
            <div className="flex justify-center">
              <small>{lineItem.variantTitle}</small>
            </div>
          </div>

          {lineItem?.image && isHorizontalProduct && (
            <div className="flex justify-center">
              <Image data={lineItem.image} width={250} height={200} />
            </div>
          )}
          {/* horizontal print^ */}
          {lineItem?.image && isVerticalProduct && (
            <div className="flex justify-center">
              <Image data={lineItem.image} width={200} height={250} />
            </div>
          )}
          {/* vertical print^ */}
          {lineItem?.image && isStockClip && (
            <div className="flex justify-center">
              <Image data={lineItem.image} width={250} height={200} />
            </div>
          )}
          {/* Stock footage clip^ */}
        </div>
        <div className="price-quantity-total ps-1 pt-3">
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
        {windowWidth && windowWidth < 605 && (
          <>
            {lineItem.variantTitle === null && (
              <div className="td pt-3">
                {/* <td> */}
                <div className="flex justify-center align-center">
                  {/* <Button variant="outline">Download ↓</Button> */}
                  {/* <a href={downloadLink[0]?.url}>download</a> */}
                  <Button variant="outline" className="mb-5">
                    <Link to={downloadLink[0]?.url}>Download ↓</Link>
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {windowWidth && windowWidth >= 605 && (
        <>
          {lineItem.variantTitle === null && (
            <div className="td">
              {/* <td> */}
              <div className="flex justify-center align-center">
                {/* <Button variant="outline">Download ↓</Button> */}
                {/* <a href={downloadLink[0]?.url}>download</a> */}
                <Button variant="outline" className="mb-5">
                  <Link to={downloadLink[0]?.url}>Download ↓</Link>
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
