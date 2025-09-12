import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction, Link} from '@remix-run/react';
import {Money, Image, flattenConnection} from '@shopify/hydrogen';
import type {OrderLineItemFullFragment} from 'customer-accountapi.generated';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {Card, CardAction, CardContent, CardHeader} from '~/components/ui/card';
import {Button} from '~/components/ui/button';
import {useEffect, useState} from 'react';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Order ${data?.order?.name}`}];
};

export async function loader({params, context}: LoaderFunctionArgs) {
  if (!params.id) {
    return redirect('/account/orders');
  }

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

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  };
}

export default function OrderRoute() {
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
  } = useLoaderData<typeof loader>();

  const {metafield} = order;
  const linkValue = JSON.parse(metafield?.value || '[{}]') as {
    text: string;
    url: string;
  }[];

  console.log(linkValue, '5678');
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
                              downloadLinks={linkValue}
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
                            downloadLinks={linkValue}
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
  console.log(downloadLinks, 'azaz');

  return (
    <div key={lineItem.id} className="tr">
      {/* <tr key={lineItem.id}> */}
      <div className="td pb-5">
        {/* <td className="pb-5"> */}
        <div>
          <div className="flex justify-center pb-3">
            <div className="flex justify-center">
              <p>
                <strong>{lineItem.title}</strong>
              </p>
            </div>
            <small>{lineItem.variantTitle}</small>
          </div>

          {lineItem?.image && (
            <div className="flex justify-center">
              <Image data={lineItem.image} width={250} height={250} />
            </div>
          )}
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
