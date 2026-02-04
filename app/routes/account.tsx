import {
  data as remixData,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {Form, NavLink, Outlet, useLoaderData} from '@remix-run/react';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {Button} from '~/components/ui/button';

export function shouldRevalidate() {
  return true;
}

export async function loader({context}: LoaderFunctionArgs) {
  const {data, errors} = await context.customerAccount.query(
    CUSTOMER_DETAILS_QUERY,
  );

  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  return remixData(
    {customer: data.customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();

  const heading = customer ? (
    customer.firstName ? (
      // `Welcome, ${customer.firstName}`
      <>
        <div className="flex justify-center">
          <img src={'/account.png'} style={{height: '80px'}}></img>
        </div>
        <div className="flex justify-center">Welcome, {customer.firstName}</div>
      </>
    ) : (
      <div className="flex justify-center pt-3">
        <img src={'/account.png'} style={{height: '80px'}} className=""></img>
      </div>
    )
  ) : (
    'Account Details'
  );

  return (
    <div className="account">
      <h1>{heading}</h1>
      <br />
      <AccountMenu />
      <br />
      <Outlet context={{customer}} />
    </div>
  );
}

function AccountMenu() {
  function isActiveStyle({
    isActive,
    isPending,
  }: {
    isActive: boolean;
    isPending: boolean;
  }) {
    return {
      fontWeight: isActive ? '1000' : '350',
      color: 'white',
      cursor: 'pointer',
      // textDecoration: isActive ? 'underline' : undefined,
    };
  }

  return (
    <nav role="navigation">
      <div className="flex justify-center ms-2 account-tabs-container">
        <div className="nav-link-first-4 flex justify-center">
          <div className="nav-link-container">
            <Button
              variant="ghost2"
              className="relative group px-4 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
            >
              <NavLink
                to="/account/profile"
                style={isActiveStyle}
                className="relative z-10"
                end
                prefetch="intent"
              >
                Profile
              </NavLink>
              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
            </Button>
            &nbsp;|&nbsp;
          </div>
          <div className="nav-link-container">
            <Button
              variant="ghost2"
              className="relative group px-4 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
            >
              <NavLink
                to="/account/orders"
                style={isActiveStyle}
                className="relative z-10"
                end
                prefetch="intent"
              >
                Orders
              </NavLink>
              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
            </Button>
            &nbsp;|&nbsp;
          </div>
          <div className="nav-link-container">
            <Button
              variant="ghost2"
              className="relative group px-4 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
            >
              <NavLink
                to="/account/favorites"
                style={isActiveStyle}
                className="relative z-10"
                end
                prefetch="intent"
              >
                Favorites
              </NavLink>
              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
            </Button>
            &nbsp;|&nbsp;
          </div>
          
        </div>
        <div className="nav-link-last-3 flex justify-center">
          <div className="nav-link-container">
            <Button
              variant="ghost2"
              className="relative group px-4 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
            >
              <NavLink
                to="/account/reviews"
                style={isActiveStyle}
                className="relative z-10"
                end
                prefetch="intent"
              >
                Reviews
              </NavLink>
              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
            </Button>
            &nbsp;|&nbsp;
          </div>
          <div className="nav-link-container">
            <Button
              variant="ghost2"
              className="relative group px-4 py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer"
            >
              <NavLink
                to="/account/addresses"
                style={isActiveStyle}
                className="relative z-10"
                end
                prefetch="intent"
              >
                Addresses
              </NavLink>
              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
            </Button>
            &nbsp;|&nbsp;
          </div>
          <div className="nav-link-container">
            <Logout />
          </div>
        </div>
      </div>
    </nav>
  );
}

function Logout() {
  return (
    <Form className="account-logout" method="POST" action="/account/logout">
      <Button
        type="submit"
        variant="ghost"
        className="relative group px-4 py-2 rounded-md transition-colors hover:bg-accent cursor-pointer"
      >
        Sign out
        <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
      </Button>
    </Form>
  );
}
