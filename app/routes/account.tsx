import {
  data as remixData,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {Form, NavLink, Outlet, useLoaderData} from '@remix-run/react';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';

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
        <div className="flex justify-center pt-5">
          <img src={'/account.png'} style={{height: '95px'}} className=""></img>
        </div>
        <div className="flex justify-center">Welcome, {customer.firstName}</div>
      </>
    ) : (
      <div className="flex justify-center pt-5">
        <img src={'/account.png'} style={{height: '95px'}} className=""></img>
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
      fontWeight: isActive ? 'bold' : undefined,
      color: 'white',
      cursor: 'pointer',
    };
  }

  return (
    <nav role="navigation">
      <div className="flex justify-center ms-2 account-tabs-container">
        <div className="nav-link-first-4 flex justify-center">
          <div className="nav-link-container">
            <NavLink to="/account/orders" style={isActiveStyle}>
              Orders &nbsp;
            </NavLink>
            &nbsp;|&nbsp;
          </div>
          <div className="nav-link-container">
            <NavLink to="/account/favorites" style={isActiveStyle}>
              &nbsp; Favorites &nbsp;
            </NavLink>
            &nbsp;|&nbsp;
          </div>
          <div className="nav-link-container">
            <NavLink to="/account/reviews" style={isActiveStyle}>
              &nbsp; Reviews &nbsp;
            </NavLink>
            &nbsp;|&nbsp;
          </div>
        </div>
        <div className="nav-link-last-3 flex justify-center">
          <div className="nav-link-container">
            <NavLink to="/account/profile" style={isActiveStyle}>
              &nbsp; Profile &nbsp;
            </NavLink>
            &nbsp;|&nbsp;
          </div>
          <div className="nav-link-container">
            <NavLink to="/account/addresses" style={isActiveStyle}>
              &nbsp; Addresses &nbsp;
            </NavLink>
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
      &nbsp;<button type="submit">Sign out</button>
    </Form>
  );
}
