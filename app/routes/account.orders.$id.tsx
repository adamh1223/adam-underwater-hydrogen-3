import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction} from '@remix-run/react';
import {Money, Image, flattenConnection} from '@shopify/hydrogen';
import type {OrderLineItemFullFragment} from 'customer-accountapi.generated';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {Card, CardAction, CardContent, CardHeader} from '~/components/ui/card';

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
  return (
    <div className="flex justify-center">
      <Card className="account-order w-[90%]">
        <CardHeader>
          <h2>Order {order.name}</h2>
          <p>Placed on {new Date(order.processedAt!).toDateString()}</p>
        </CardHeader>
        <CardContent className="ms-3">
          <div>
            <table>
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Price</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((lineItem, lineItemIndex) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
                ))}
              </tbody>
              <tfoot>
                {((discountValue && discountValue.amount) ||
                  discountPercentage) && (
                  <tr>
                    <th scope="row" colSpan={3}>
                      <p>Discounts</p>
                    </th>
                    <th scope="row">
                      <p>Discounts</p>
                    </th>
                    <td>
                      {discountPercentage ? (
                        <span>-{discountPercentage}% OFF</span>
                      ) : (
                        discountValue && <Money data={discountValue!} />
                      )}
                    </td>
                  </tr>
                )}
                <tr>
                  <th scope="row" colSpan={3}>
                    <p>Subtotal</p>
                  </th>
                  <th scope="row">
                    <p>Subtotal</p>
                  </th>
                  <td>
                    <Money data={order.subtotal!} />
                  </td>
                </tr>
                <tr>
                  <th scope="row" colSpan={3}>
                    Tax
                  </th>
                  <th scope="row">
                    <p>Tax</p>
                  </th>
                  <td>
                    <Money data={order.totalTax!} />
                  </td>
                </tr>
                <tr>
                  <th scope="row" colSpan={3}>
                    Total
                  </th>
                  <th scope="row">
                    <p>Total</p>
                  </th>
                  <td>
                    <Money data={order.totalPrice!} />
                  </td>
                </tr>
              </tfoot>
            </table>
            <div>
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
                <p>{fulfillmentStatus}</p>
              </div>
            </div>
          </div>
        </CardContent>
        <CardAction>
          <p>
            <a target="_blank" href={order.statusPageUrl} rel="noreferrer">
              View Order Status →
            </a>
          </p>
        </CardAction>
      </Card>
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
