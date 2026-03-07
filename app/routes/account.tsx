import {
  data as remixData,
  redirect,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {
  Form,
  NavLink,
  Outlet,
  useLoaderData,
  type MetaFunction,
} from '@remix-run/react';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {Button} from '~/components/ui/button';
import {useCallback, useEffect, useRef, useState} from 'react';
import AccountLayoutSkeleton from '~/components/skeletons/AccountLayoutSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';

export function shouldRevalidate() {
  return true;
}

export const meta: MetaFunction = () => {
  return buildIconLinkPreviewMeta('Adam Underwater | My Account');
};

export async function loader({context, request}: LoaderFunctionArgs) {
  const isLoggedIn = await context.customerAccount.isLoggedIn();
  if (!isLoggedIn) {
    const loginUrl = new URL('/account/login', request.url);
    return redirect(loginUrl.toString(), {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }

  let customer = null;
  try {
    const {data, errors} = await context.customerAccount.query(
      CUSTOMER_DETAILS_QUERY,
    );
    if (!errors?.length && data?.customer) {
      customer = data.customer;
    }
  } catch {
    customer = null;
  }

  return remixData(
    {customer},
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    },
  );
}

export default function AccountLayout() {
  const {customer} = useLoaderData<typeof loader>();

  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledLoad = useRef(false);
  const accountImgRef = useRef<HTMLImageElement>(null);

  const handleAccountImgLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  useEffect(() => {
    const img = accountImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleAccountImgLoad();
    }
  }, [handleAccountImgLoad]);

  const heading = customer ? (
    customer.firstName ? (
      // `Welcome, ${customer.firstName}`
      <>
        <div className="flex justify-center">
          <img
            ref={accountImgRef}
            src={'https://downloads.adamunderwater.com/store-1-au/public/account.png'}
            alt=""
            style={{height: '80px'}}
            onLoad={handleAccountImgLoad}
          ></img>
        </div>
        <div className="flex justify-center">Welcome, {customer.firstName}</div>
      </>
    ) : (
      <div className="flex justify-center pt-3">
        <img
          ref={accountImgRef}
          src={'https://downloads.adamunderwater.com/store-1-au/public/account.png'}
          alt=""
          style={{height: '80px'}}
          className=""
          onLoad={handleAccountImgLoad}
        ></img>
      </div>
    )
  ) : (
    'Account Details'
  );

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<AccountLayoutSkeleton />}>
    <div className="account">
      <h1>{heading}</h1>
      <br />
      <AccountMenu />
      <br />
      <Outlet context={{customer}} />
    </div>
    </SkeletonGate>
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
