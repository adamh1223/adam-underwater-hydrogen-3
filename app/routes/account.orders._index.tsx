import {Link, useLoaderData, type MetaFunction} from '@remix-run/react';
import {
  Money,
  getPaginationVariables,
  flattenConnection,
} from '@shopify/hydrogen';
import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {CUSTOMER_ORDERS_QUERY} from '~/graphql/customer-account/CustomerOrdersQuery';
import type {
  CustomerOrdersFragment,
  OrderItemFragment,
} from 'customer-accountapi.generated';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {Button} from '~/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from '~/components/ui/card';

export const meta: MetaFunction = () => {
  return [{title: 'Orders'}];
};

export async function loader({request, context}: LoaderFunctionArgs) {
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 20,
  });

  const {data, errors} = await context.customerAccount.query(
    CUSTOMER_ORDERS_QUERY,
    {
      variables: {
        ...paginationVariables,
      },
    },
  );

  if (errors?.length || !data?.customer) {
    throw Error('Customer orders not found');
  }

  return {customer: data.customer};
}

export default function Orders() {
  const {customer} = useLoaderData<{customer: CustomerOrdersFragment}>();
  const {orders} = customer;
  return (
    <section className="orders">
      {orders.nodes.length ? <OrdersTable orders={orders} /> : <EmptyOrders />}
    </section>
  );
}

function OrdersTable({orders}: Pick<CustomerOrdersFragment, 'orders'>) {
  return (
    <div className="acccount-orders grid gap-4 md:grid-cols-2">
      {orders?.nodes.length ? (
        <PaginatedResourceSection connection={orders}>
          {({node: order}) => <OrderItem key={order.id} order={order} />}
        </PaginatedResourceSection>
      ) : (
        <EmptyOrders />
      )}
    </div>
  );
}

function EmptyOrders() {
  return (
    <div>
      <p className="ms-5">You haven&apos;t placed any orders yet.</p>
      <br />
      <Button variant="link" className="ms-1">
        <Link to="/collections">Start Shopping →</Link>
      </Button>
    </div>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  return (
    <>
      <fieldset>
        <Card className="mx-5">
          <CardHeader>
            <Link to={`/account/orders/${btoa(order.id)}`}>
              <strong>Order#: {order.number}</strong>
            </Link>
            <p>{new Date(order.processedAt).toDateString()}</p>
          </CardHeader>

          <CardContent className="ms-3">
            <p>{order.financialStatus}</p>
            {fulfillmentStatus && <p>{fulfillmentStatus}</p>}
            <Money data={order.totalPrice} />
          </CardContent>
          <CardAction className="m-5">
            <Button variant="default">
              <Link to={`/account/orders/${btoa(order.id)}`}>View Order →</Link>
            </Button>
          </CardAction>
        </Card>
      </fieldset>
      <br />
    </>
  );
}
