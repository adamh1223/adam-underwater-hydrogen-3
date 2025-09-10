import {Suspense} from 'react';
import {
  Await,
  Form,
  Link,
  NavLink,
  useAsyncValue,
  useLoaderData,
} from '@remix-run/react';
import {
  type CartViewPayload,
  useAnalytics,
  useOptimisticCart,
} from '@shopify/hydrogen';
import type {HeaderQuery, CartApiQueryFragment} from 'storefrontapi.generated';
import {useAside} from '~/components/Aside';

import AboutDropdown from './navbar/AboutDropdown';
import {Button} from './ui/button';
import ServicesDropdown from './navbar/ServicesDropdown';
import {loader} from '~/routes/_index';
import {LuAlignLeft, LuSearch, LuShoppingCart, LuUser} from 'react-icons/lu';
import '../components/navbar/styles/Navbar.css';
import {HoverCard, HoverCardContent, HoverCardTrigger} from './ui/hover-card';
import {useIsLoggedIn} from '~/lib/hooks';

interface HeaderProps {
  header: HeaderQuery & {
    collection?: {
      metafield?: {
        references?: {
          nodes?: Array<{
            image: {url: string};
          }>;
        };
      };
    };
  };
  cart: Promise<CartApiQueryFragment | null>;
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
}

type Viewport = 'desktop' | 'mobile';

export function Header({
  header,
  isLoggedIn,
  cart,
  publicStoreDomain,
}: HeaderProps) {
  const {shop, menu, collection} = header;
  const imageURL = collection?.metafield?.references?.nodes?.[0].image.url;
  console.log(collection, '707070');

  return (
    <header className="header border-b">
      {/* <NavLink prefetch="intent" to="/"  end>
        <strong>{shop.name}</strong>
      </NavLink> */}
      <HeaderMenu
        imageURL={imageURL}
        menu={menu}
        viewport="desktop"
        primaryDomainUrl={header.shop.primaryDomain.url}
        publicStoreDomain={publicStoreDomain}
        isLoggedIn={isLoggedIn}
        cart={cart}
      />
    </header>
  );
}

export function HeaderMenu({
  imageURL,
  menu,
  primaryDomainUrl,
  viewport,
  publicStoreDomain,
  isLoggedIn,
  cart,
}: {
  imageURL: string | undefined;
  menu: HeaderProps['header']['menu'];
  primaryDomainUrl: HeaderProps['header']['shop']['primaryDomain']['url'];
  viewport: Viewport;
  publicStoreDomain: HeaderProps['publicStoreDomain'];
  isLoggedIn?: HeaderProps['isLoggedIn'];
  cart?: HeaderProps['cart'];
}) {
  const className = `header-menu-${viewport} flex flex-col xl:flex-row sm:justify-between sm:items-center lg:justify-between flex-wrap py-4 gap-4 navbar`;
  const {close} = useAside();
  // IF the order ever changes in shopify admin, we may have to update these two variables as well
  // If we remove a menu item it might look off

  const middle = Math.ceil((menu || FALLBACK_HEADER_MENU).items.length / 2);
  const menuFirstHalf = (menu || FALLBACK_HEADER_MENU).items.slice(0, middle);
  const menuSecondHalf = (menu || FALLBACK_HEADER_MENU).items.slice(middle);

  return (
    <nav className={className} role="navigation">
      <div className="1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary underline-offset-4 hover:underline h-9 px-4 py-2">
        <NavLink
          end
          onClick={close}
          prefetch="intent"
          to="/"
          className="logo-container"
        >
          <img src={imageURL} className="logo" style={{height: '4rem'}}></img>
        </NavLink>
      </div>
      <div className="2 flex items-center nav-links">
        <div className="2.1 flex justify-center w-full">
          {menuFirstHalf.map((item) => {
            console.log(menu, '2222');

            if (!item.url) return null;

            // if the url is internal, we strip the domain
            const url =
              item.url.includes('myshopify.com') ||
              item.url.includes(publicStoreDomain) ||
              item.url.includes(primaryDomainUrl)
                ? new URL(item.url).pathname
                : item.url;

            let renderContent;
            switch (item.title) {
              case 'About':
                renderContent = (
                  <AboutDropdown
                    menuItems={item}
                    publicStoreDomain={publicStoreDomain}
                    primaryDomainUrl={primaryDomainUrl}
                  ></AboutDropdown>
                );
                break;
              case 'Services':
                renderContent = (
                  <ServicesDropdown
                    menuItems={item}
                    publicStoreDomain={publicStoreDomain}
                    primaryDomainUrl={primaryDomainUrl}
                  ></ServicesDropdown>
                );
                break;

              default:
                renderContent = (
                  <Button variant="link">
                    <NavLink
                      className=""
                      end
                      onClick={close}
                      prefetch="intent"
                      to={url}
                    >
                      {item.title}
                    </NavLink>
                  </Button>
                );
                break;
            }
            return <>{renderContent}</>;
          })}
        </div>
        <div className="2.2 flex justify-center w-full">
          {menuSecondHalf.map((item) => {
            console.log(menu, '2222');

            if (!item.url) return null;

            // if the url is internal, we strip the domain
            const url =
              item.url.includes('myshopify.com') ||
              item.url.includes(publicStoreDomain) ||
              item.url.includes(primaryDomainUrl)
                ? new URL(item.url).pathname
                : item.url;

            let renderContent;
            switch (item.title) {
              case 'About':
                renderContent = (
                  <AboutDropdown
                    menuItems={item}
                    publicStoreDomain={publicStoreDomain}
                    primaryDomainUrl={primaryDomainUrl}
                  ></AboutDropdown>
                );
                break;
              case 'Services':
                renderContent = (
                  <ServicesDropdown
                    menuItems={item}
                    publicStoreDomain={publicStoreDomain}
                    primaryDomainUrl={primaryDomainUrl}
                  ></ServicesDropdown>
                );
                break;

              default:
                renderContent = (
                  <Button variant="link">
                    <NavLink
                      className=""
                      end
                      onClick={close}
                      prefetch="intent"
                      to={url}
                    >
                      {item.title}
                    </NavLink>
                  </Button>
                );
                break;
            }
            return <>{renderContent}</>;
          })}
        </div>
      </div>
      <div className="3 flex gap-4 items-center">
        <HeaderCtas cart={cart} isLoggedIn={isLoggedIn} />
      </div>
    </nav>
  );
}

function HeaderCtas({
  cart,
  isLoggedIn,
}: {
  cart: Partial<Pick<HeaderProps, 'cart'>>;
  isLoggedIn: Promise<boolean>;
}) {
  type NavLink = {
    href: string;
    label: string;
  };
  const loginValue = useIsLoggedIn(isLoggedIn);

  const links: NavLink[] = [
    {href: '/', label: 'Home'},
    {href: 'account/orders', label: 'My orders'},
    {href: 'account/favorites', label: 'Your favorites'},
    {href: 'account/reviews', label: 'My reviews'},
    {href: 'account/profile', label: 'My Profile'},
    {href: 'account/addresses', label: 'My Addresses'},
  ];
  console.log(isLoggedIn, 'xyz');

  return (
    <nav className="header-ctas" role="navigation">
      {/* <HeaderMenuMobileToggle /> */}
      <CartToggle cart={cart} />
      <HoverCard openDelay={100} closeDelay={100}>
        <HoverCardTrigger>
          <NavLink prefetch="intent" to="/account">
            <div className="account-menu-dropdown">
              <Button
                variant="outline"
                className="flex gap-4 max-w-[100px] cursor-pointer"
              >
                <LuAlignLeft className="w-6 h-6" />
                <LuUser className="w-6 h-6 bg-primary rounded-full text-white" />
                {/* <Suspense fallback="Sign in">
            <Await resolve={isLoggedIn} errorElement="Sign in">
              {(isLoggedIn) => (isLoggedIn ? 'Account' : 'Sign in')}
            </Await>
          </Suspense> */}
              </Button>
            </div>
          </NavLink>
        </HoverCardTrigger>
        <HoverCardContent className="w-48">
          {loginValue ? (
            links.map((link) => {
              return (
                <Button variant="ghost">
                  <Link to={link.href}>{link.label}</Link>
                </Button>
              );
            })
          ) : (
            <Button variant="ghost">
              <Link to={'/account'}>Sign In/Create Account</Link>
            </Button>
          )}
          <hr />
          <Logout />
        </HoverCardContent>
      </HoverCard>

      <SearchToggle />
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

function HeaderMenuMobileToggle() {
  const {open} = useAside();
  return (
    <button
      className="header-menu-mobile-toggle reset"
      onClick={() => open('mobile')}
    >
      <h3>☰</h3>
    </button>
  );
}

function SearchToggle() {
  const {open} = useAside();
  return (
    <Button
      variant="outline"
      className="reset cursor-pointer"
      onClick={() => open('search')}
    >
      <LuSearch></LuSearch>
    </Button>
  );
}

function CartBadge({count}: {count: number | null}) {
  const {open} = useAside();
  const {publish, shop, cart, prevCart} = useAnalytics();

  return (
    <Button
      // href="/cart"
      size="icon"
      variant="outline"
      onClick={(e) => {
        e.preventDefault();

        publish('cart_viewed', {
          cart,
          prevCart,
          shop,
          url: window.location.href || '',
        } as CartViewPayload);
      }}
    >
      <NavLink to="/cart">
        <LuShoppingCart className="relative -bottom-3 -right-1" />
        <span className="relative -top-6 -right-5 bg-primary text-white rounded-full h-6 w-6 flex items-center justify-center text-xs">
          {count}
        </span>
      </NavLink>
    </Button>
  );
}

function CartToggle({cart}: Partial<Pick<HeaderProps, 'cart'>>) {
  return (
    <Suspense fallback={<CartBadge count={null} />}>
      <Await resolve={cart}>
        <CartBanner />
      </Await>
    </Suspense>
  );
}

function CartBanner() {
  const originalCart = useAsyncValue() as CartApiQueryFragment | null;
  const cart = useOptimisticCart(originalCart);
  return <CartBadge count={cart?.totalQuantity ?? 0} />;
}

const FALLBACK_HEADER_MENU = {
  id: 'gid://shopify/Menu/199655587896',
  items: [
    {
      id: 'gid://shopify/MenuItem/461609500728',
      resourceId: null,
      tags: [],
      title: 'Collections',
      type: 'HTTP',
      url: '/collections',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609533496',
      resourceId: null,
      tags: [],
      title: 'Blog',
      type: 'HTTP',
      url: '/blogs/journal',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609566264',
      resourceId: null,
      tags: [],
      title: 'Policies',
      type: 'HTTP',
      url: '/policies',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461609599032',
      resourceId: 'gid://shopify/Page/92591030328',
      tags: [],
      title: 'About',
      type: 'PAGE',
      url: '/pages/about',
      items: [],
    },
  ],
};

// function activeLinkStyle({
//   isActive,
//   isPending,
// }: {
//   isActive: boolean;
//   isPending: boolean;
// }) {
//   return {
//     fontWeight: isActive ? 'bold' : undefined,
//     color: isPending ? 'grey' : 'black',
//   };
// }
