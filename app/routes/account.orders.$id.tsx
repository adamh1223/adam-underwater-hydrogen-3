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

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  const lineItems = flattenConnection(order.lineItems);
  const discountApplications = flattenConnection(order.discountApplications);

  const fulfillmentStatus =
    flattenConnection(order.fulfillments)[0]?.status ?? 'N/A';

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
  console.log(fulfillmentStatus, '5678');

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
      <div className="card-container flex justify-center w-[80%]">
        <Card className="account-order">
          <CardHeader>
            <p className="ms-2">
              <strong>Order {order.name}</strong>
            </p>
            <p className="ms-2">
              Placed on {new Date(order.processedAt!).toDateString()}
            </p>
          </CardHeader>
          <CardContent className="ms-3">
            <div>
              <div className="upper-part grid grid-cols-2">
                <table>
                  <Card className="p-5">
                    <thead>
                      <tr>
                        <th scope="col">Product</th>
                        <th scope="col">Price</th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Total</th>
                        <th scope="col">Download Links</th>
                        <th scope="col">Licensing Forms</th>
                      </tr>
                    </thead>

                    <tbody>
                      {lineItems.map((lineItem, lineItemIndex) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
                      ))}
                    </tbody>
                  </Card>
                </table>
                {windowWidth && windowWidth >= 1425 && (
                  <div className="pt-3 totals flex justify-end items-end">
                    <Card className="grid grid-cols-1 w-[60%] h-[60%] pe-5">
                      {((discountValue && discountValue.amount) ||
                        discountPercentage) && (
                        <tr className="flex justify-between">
                          <div className="flex justify-center items-center">
                            <th scope="row" colSpan={2}>
                              <p>Discounts</p>
                            </th>
                          </div>
                          <div className="flex justify-center items-center">
                            <td>
                              {discountPercentage ? (
                                <span>-{discountPercentage}% OFF</span>
                              ) : (
                                discountValue && <Money data={discountValue!} />
                              )}
                            </td>
                          </div>
                        </tr>
                      )}
                      <tr className="flex justify-between">
                        <div className="flex justify-center items-center">
                          <th scope="row" colSpan={2}>
                            <p>Subtotal</p>
                          </th>
                        </div>
                        <div className="flex justify-center items-center">
                          <td>
                            <Money data={order.subtotal!} />
                          </td>
                        </div>
                      </tr>
                      <tr className="flex justify-between">
                        <div className="flex justify-center items-center">
                          <th scope="row" colSpan={2}>
                            Tax
                          </th>
                        </div>
                        <div className="flex justify-center items-center">
                          <td>
                            <Money data={order.totalTax!} />
                          </td>
                        </div>
                      </tr>
                      <tr className="flex justify-between">
                        <div className="flex justify-center items-center">
                          <th scope="row" colSpan={2}>
                            Total
                          </th>
                        </div>
                        <div className="flex justify-center items-center">
                          <td>
                            <Money data={order.totalPrice!} />
                          </td>
                        </div>
                      </tr>
                    </Card>
                  </div>
                )}
              </div>
              <div className="lower-part">
                <Card className="mt-3 p-5">
                  <h3>Shipping Address</h3>
                  {order?.shippingAddress ? (
                    <address>
                      <p>{order.shippingAddress.name}</p>
                      {order.shippingAddress.formatted ? (
                        <p>{order.shippingAddress.formatted}</p>
                      ) : (
                        ''
                      )}
                      {order.shippingAddress.formattedArea ? (
                        <p>{order.shippingAddress.formattedArea}</p>
                      ) : (
                        ''
                      )}
                    </address>
                  ) : (
                    <p>N/A</p>
                  )}
                  <h3>Status</h3>
                  <div>
                    <p>
                      {fulfillmentStatus === 'SUCCESS'
                        ? 'Shipped'
                        : 'Preparing Shipment'}
                    </p>
                  </div>
                </Card>
              </div>
              {windowWidth && windowWidth < 1425 && (
                <div className="pt-3 totals flex justify-end items-end">
                  <Card className="grid grid-cols-1 w-[60%] h-[60%] pe-5 totals-card">
                    {((discountValue && discountValue.amount) ||
                      discountPercentage) && (
                      <tr className="flex justify-between">
                        <div className="flex justify-center items-center">
                          <th scope="row" colSpan={2}>
                            <p>Discounts</p>
                          </th>
                        </div>
                        <div className="flex justify-center items-center">
                          <td>
                            {discountPercentage ? (
                              <span>-{discountPercentage}% OFF</span>
                            ) : (
                              discountValue && <Money data={discountValue!} />
                            )}
                          </td>
                        </div>
                      </tr>
                    )}
                    <tr className="flex justify-between">
                      <div className="flex justify-center items-center">
                        <th scope="row" colSpan={2}>
                          <p>Subtotal</p>
                        </th>
                      </div>
                      <div className="flex justify-center items-center">
                        <td>
                          <Money data={order.subtotal!} />
                        </td>
                      </div>
                    </tr>
                    <tr className="flex justify-between">
                      <div className="flex justify-center items-center">
                        <th scope="row" colSpan={2}>
                          Tax
                        </th>
                      </div>
                      <div className="flex justify-center items-center">
                        <td>
                          <Money data={order.totalTax!} />
                        </td>
                      </div>
                    </tr>
                    <tr className="flex justify-between">
                      <div className="flex justify-center items-center">
                        <th scope="row" colSpan={2}>
                          Total
                        </th>
                      </div>
                      <div className="flex justify-center items-center">
                        <td>
                          <Money data={order.totalPrice!} />
                        </td>
                      </div>
                    </tr>
                  </Card>
                </div>
              )}
            </div>
          </CardContent>
          <CardAction>
            <Button variant="default" className="m-5">
              <Link to={order.statusPageUrl} rel="noreferrer">
                View Order Status →
              </Link>
            </Button>
          </CardAction>
        </Card>
      </div>
    </div>
  );
}

function OrderLineRow({lineItem}: {lineItem: OrderLineItemFullFragment}) {
  return (
    <tr key={lineItem.id}>
      <td>
        <div>
          <div className="flex flex-col py-3">
            <div className="flex justify-start">
              <p>
                <strong>{lineItem.title}</strong>
              </p>
            </div>
            <small>{lineItem.variantTitle}</small>
          </div>
          {lineItem?.image && (
            <div className="flex justify-center">
              <Image data={lineItem.image} width={140} height={140} />
            </div>
          )}
        </div>
      </td>
      <td>
        <div className="flex justify-center">
          <Money data={lineItem.price!} />
        </div>
      </td>
      <td>
        <div className="flex justify-center">{lineItem.quantity}</div>
      </td>
      <td>
        <div className="flex justify-center">
          <Money data={lineItem.totalDiscount!} />
        </div>
      </td>
    </tr>
  );
}
