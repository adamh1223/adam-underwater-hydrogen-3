import {
  Link,
  useLoaderData,
  useNavigate,
  type MetaFunction,
} from '@remix-run/react';
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
import Sectiontitle from '~/components/global/Sectiontitle';
import {useTouchCardHighlight} from '~/lib/touchCardHighlight';

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
    <>
    <Sectiontitle text="My Orders" />
    <section className="orders flex justify-center pt-3">
      {orders.nodes.length ? <OrdersTable orders={orders} /> : <EmptyOrders />}
    </section>
    </>
  );
}

function OrdersTable({orders}: Pick<CustomerOrdersFragment, 'orders'>) {
  return (
    <div className="acccount-orders w-full">
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
      {/* THIS IS CODE FOR APOSTROPHE */}
      <p>You haven&apos;t placed any orders yet.</p>
      <div className="flex justify-center mt-4">
        <Button variant="default">
          <Link to="/collections/prints">Start Shopping →</Link>
        </Button>
      </div>
    </div>
  );
}

function OrderItem({order}: {order: OrderItemFragment}) {
  const navigate = useNavigate();
  const touchCardId = `order-card:${String(order.id)}`;
  const {isTouchHighlighted, touchHighlightHandlers} = useTouchCardHighlight(
    touchCardId,
  );
  const touchCardEffects =
    'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
  const fulfillmentStatus = flattenConnection(order.fulfillments)[0]?.status;
  const orderPath = `/account/orders/${btoa(order.id)}`;

  return (
    <>
      <fieldset>
        <Card
          className={`mx-5 cursor-pointer transition-[border-color,box-shadow] duration-300 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] active:border-primary active:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] focus-within:border-primary focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] ${isTouchHighlighted ? touchCardEffects : ''}`}
          style={{touchAction: 'pan-y'}}
          data-touch-highlight-card-id={touchCardId}
          {...touchHighlightHandlers}
          role="link"
          tabIndex={0}
          onClick={() => navigate(orderPath)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              navigate(orderPath);
            }
          }}
        >
          <CardHeader>
            <Link
              to={orderPath}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
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
            <Button
              variant="default"
              onClick={(event) => {
                event.stopPropagation();
                navigate(orderPath);
              }}
            >
              View Order →
            </Button>
          </CardAction>
        </Card>
      </fieldset>
      <br />
    </>
  );
}
