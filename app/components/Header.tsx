import {Fragment, Suspense, useEffect, useState} from 'react';
import * as RadixHoverCard from '@radix-ui/react-hover-card';
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

import {LuAlignLeft, LuSearch, LuShoppingCart, LuUser} from 'react-icons/lu';
import '../components/navbar/styles/Navbar.css';
import {HoverCard, HoverCardContent, HoverCardTrigger} from './ui/hover-card';
import {useIsLoggedIn} from '~/lib/hooks';
import {ChevronUp, Divide} from 'lucide-react';
import {log} from 'util';

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
  const className = `header-menu-${viewport} main-navbar flex xl:flex-row sm:justify-between sm:items-center lg:justify-between navbar`;
  const {close} = useAside();
  // IF the order ever changes in shopify admin, we may have to update these two variables as well
  // If we remove a menu item it might look off

  const middle = Math.ceil((menu || FALLBACK_HEADER_MENU).items.length / 2);
  const menuFirstHalf = (menu || FALLBACK_HEADER_MENU).items.slice(0, middle);
  const menuSecondHalf = (menu || FALLBACK_HEADER_MENU).items.slice(middle);
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const enableMobileToggle = true;
  const getMenuItemUrl = (itemUrl: string) => {
    const normalizedUrl =
      itemUrl.includes('myshopify.com') ||
      itemUrl.includes(publicStoreDomain) ||
      itemUrl.includes(primaryDomainUrl)
        ? new URL(itemUrl).pathname
        : itemUrl;

    if (normalizedUrl.startsWith('/collections/stock/')) {
      return '/collections/stock';
    }

    return normalizedUrl;
  };

  return (
    <>
      {windowWidth != undefined && windowWidth < 500 && (
        <>
          <nav role="navigation">
            <div className="main-navbar-small-top-row ">
              <div className="nav-logo-container 1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary underline-offset-4 hover:underline h-9 ps-1 py-2 mt-4">
                <NavLink
                  end
                  onClick={close}
                  prefetch="intent"
                  to="/"
                  className="logo-container"
                >
                  <img
                    src={imageURL}
                    className="logo"
                    style={{height: '35px'}}
                  ></img>
                </NavLink>
              </div>

              {cart && (
                <div className="3 flex gap-4 items-center ctas-cart-search-container mt-4">
                  <HeaderCtas cart={cart} isLoggedIn={isLoggedIn} />
                </div>
              )}
            </div>
            <div className="main-navbar-small-bottom-row mb-3 mt-2">
              <div className="2 flex items-center justify-center nav-links-container">
                <div className="2.1 flex justify-center gap-[2px] w-full">
                  {menuFirstHalf.map((item) => {
                    if (!item.url) return null;

                    // if the url is internal, we strip the domain
                    const url = getMenuItemUrl(item.url);

                    let renderContent;
                    switch (item.title) {
                      case 'About':
                        renderContent = (
                          <AboutDropdown
                            menuItems={item}
                            publicStoreDomain={publicStoreDomain}
                            primaryDomainUrl={primaryDomainUrl}
                            enableMobileToggle={enableMobileToggle}
                          ></AboutDropdown>
                        );
                        break;
                      case 'Services':
                        renderContent = (
                          <ServicesDropdown
                            menuItems={item}
                            publicStoreDomain={publicStoreDomain}
                            primaryDomainUrl={primaryDomainUrl}
                            enableMobileToggle={enableMobileToggle}
                          ></ServicesDropdown>
                        );
                        break;

                      default:
                        renderContent = (
                          <NavLink
                            className="relative z-10"
                            end
                            onClick={close}
                            prefetch="intent"
                            to={url}
                          >
                            <button className="text-sm font-md relative group py-2 px-[4px] rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:bg-accent hover:text-accent-foreground">
                              {item.title}
                              {/* animated underline */}
                              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                            </button>
                          </NavLink>
                        );
                        break;
                    }
                    return (
                      <Fragment key={item.id ?? item.title}>
                        {renderContent}
                      </Fragment>
                    );
                  })}
                </div>
                <div className="2.2 flex justify-center w-full gap-[2px] ps-[2px]">
                  {menuSecondHalf.map((item) => {
                    if (!item.url) return null;

                    // if the url is internal, we strip the domain
                    const url = getMenuItemUrl(item.url);

                    let renderContent;
                    switch (item.title) {
                      case 'About':
                        renderContent = (
                          <AboutDropdown
                            menuItems={item}
                            publicStoreDomain={publicStoreDomain}
                            primaryDomainUrl={primaryDomainUrl}
                            enableMobileToggle={enableMobileToggle}
                          ></AboutDropdown>
                        );
                        break;
                      case 'Services':
                        renderContent = (
                          <ServicesDropdown
                            menuItems={item}
                            publicStoreDomain={publicStoreDomain}
                            primaryDomainUrl={primaryDomainUrl}
                            enableMobileToggle={enableMobileToggle}
                          ></ServicesDropdown>
                        );
                        break;

                      default:
                        renderContent = (
                          <NavLink
                            className="relative z-10"
                            end
                            onClick={close}
                            prefetch="intent"
                            to={url}
                          >
                            <button className="text-sm font-medium text-primary hover:bg-accent hover:text-accent-foreground relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer whitespace-nowrap flex-shrink-0">
                              {item.title}
                              {/* animated underline */}
                              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                            </button>
                          </NavLink>
                        );
                        break;
                    }
                    return (
                      <Fragment key={item.id ?? item.title}>
                        {renderContent}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>
        </>
      )}
      {windowWidth != undefined && windowWidth < 730 && windowWidth >= 500 && (
        <>
          <nav role="navigation">
            <div className="main-navbar-small-top-row ">
              <div className="nav-logo-container 1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary underline-offset-4 hover:underline h-9 ps-2 pe-1 py-2 mt-4">
                <NavLink
                  end
                  onClick={close}
                  prefetch="intent"
                  to="/"
                  className="logo-container"
                >
                  <img
                    src={imageURL}
                    className="logo"
                    style={{height: '2.5rem'}}
                  ></img>
                </NavLink>
              </div>

              {cart && (
                <div className="3 flex gap-4 items-center ctas-cart-search-container mt-4">
                  <HeaderCtas cart={cart} isLoggedIn={isLoggedIn} />
                </div>
              )}
            </div>
            <div className="main-navbar-small-bottom-row mb-3 mt-2">
              <div className="2 flex items-center nav-links-container">
                <div className="2.1 flex justify-center w-full gap-[2px]">
                  {menuFirstHalf.map((item) => {
                    if (!item.url) return null;

                    // if the url is internal, we strip the domain
                    const url = getMenuItemUrl(item.url);

                    let renderContent;
                    switch (item.title) {
                      case 'About':
                        renderContent = (
                          <AboutDropdown
                            menuItems={item}
                            publicStoreDomain={publicStoreDomain}
                            primaryDomainUrl={primaryDomainUrl}
                            enableMobileToggle={enableMobileToggle}
                          ></AboutDropdown>
                        );
                        break;
                      case 'Services':
                        renderContent = (
                          <ServicesDropdown
                            menuItems={item}
                            publicStoreDomain={publicStoreDomain}
                            primaryDomainUrl={primaryDomainUrl}
                            enableMobileToggle={enableMobileToggle}
                          ></ServicesDropdown>
                        );
                        break;

                      default:
                        renderContent = (
                          <NavLink
                            className="relative z-10"
                            end
                            onClick={close}
                            prefetch="intent"
                            to={url}
                          >
                            <button className=" text-sm font-medium relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:text-accent-foreground whitespace-nowrap flex-shrink-0">
                              {item.title}
                              {/* animated underline */}
                              <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                            </button>
                          </NavLink>
                        );
                        break;
                    }
                    return (
                      <Fragment key={item.id ?? item.title}>
                        {renderContent}
                      </Fragment>
                    );
                  })}
                </div>
                <div className="2.2 flex justify-center w-full gap-[2px] ps-[2px]">
                  {menuSecondHalf.map((item) => {
                    if (!item.url) return null;

                    // if the url is internal, we strip the domain
                    const url = getMenuItemUrl(item.url);

                    let renderContent;
                    switch (item.title) {
                      case 'About':
                        renderContent = (
                          <AboutDropdown
                            menuItems={item}
                            publicStoreDomain={publicStoreDomain}
                            primaryDomainUrl={primaryDomainUrl}
                            enableMobileToggle={enableMobileToggle}
                          ></AboutDropdown>
                        );
                        break;
                      case 'Services':
                        renderContent = (
                          <ServicesDropdown
                            menuItems={item}
                            publicStoreDomain={publicStoreDomain}
                            primaryDomainUrl={primaryDomainUrl}
                            enableMobileToggle={enableMobileToggle}
                          ></ServicesDropdown>
                        );
                        break;

                      default:
                        renderContent = (
                          <>
                            <div className="flex justify-center items-center">
                              <NavLink
                                className="relative z-10"
                                end
                                onClick={close}
                                prefetch="intent"
                                to={url}
                              >
                                <button className="text-sm font-medium relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:bg-accent hover:text-accent-foreground whitespace-nowrap flex-shrink-0">
                                  {item.title}
                                  {/* animated underline */}
                                  <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                                </button>
                              </NavLink>
                            </div>
                          </>
                        );
                        break;
                    }
                    return (
                      <Fragment key={item.id ?? item.title}>
                        {renderContent}
                      </Fragment>
                    );
                  })}
                </div>
              </div>
            </div>
          </nav>
        </>
      )}
      {windowWidth != undefined && windowWidth >= 730 && windowWidth < 930 && (
        <>
          <nav
            className={`${className} flex w-full flex-col gap-2`}
            role="navigation"
          >
            <div className="flex w-full items-center justify-between gap-4">
              <div className="nav-logo-container 1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary underline-offset-4 hover:underline h-9 ps-2 py-2 mt-[15.5px] shrink-0">
                <NavLink
                  end
                  onClick={close}
                  prefetch="intent"
                  to="/"
                  className="logo-container"
                >
                  <img
                    src={imageURL}
                    className="logo"
                    style={{height: '2.5rem'}}
                  />
                </NavLink>
              </div>

              {/* ⭐ SHIFTED LEFT 30px */}
              <div className="flex-1 flex justify-center menu-first-half-container -translate-x-[9px] mt-[16px] gap-[2px] ">
                {menuFirstHalf.map((item) => {
                  if (!item.url) return null;

                  const url = getMenuItemUrl(item.url);

                  let renderContent;
                  switch (item.title) {
                    case 'About':
                      renderContent = (
                        <AboutDropdown
                          menuItems={item}
                          publicStoreDomain={publicStoreDomain}
                          primaryDomainUrl={primaryDomainUrl}
                          enableMobileToggle={enableMobileToggle}
                        />
                      );
                      break;

                    case 'Services':
                      renderContent = (
                        <ServicesDropdown
                          menuItems={item}
                          publicStoreDomain={publicStoreDomain}
                          primaryDomainUrl={primaryDomainUrl}
                          enableMobileToggle={enableMobileToggle}
                        />
                      );
                      break;

                    default:
                      renderContent = (
                        <NavLink
                          className="relative z-10"
                          end
                          onClick={close}
                          prefetch="intent"
                          to={url}
                        >
                          <button className="text-sm font-md relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:bg-accent hover:text-accent-foreground">
                            {item.title}
                            {/* animated underline */}
                            <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                          </button>
                        </NavLink>
                      );
                  }

                  return (
                    <Fragment key={item.id ?? item.title}>
                      {renderContent}
                    </Fragment>
                  );
                })}
              </div>

              {cart && (
                <div className="flex gap-4 items-center ctas-cart-search-container mt-[16px]">
                  <HeaderCtas cart={cart} isLoggedIn={isLoggedIn} />
                </div>
              )}
            </div>

            <div className="flex justify-center mb-3 gap-[2px] ps-[6px]">
              {menuSecondHalf.map((item) => {
                if (!item.url) return null;

                const url = getMenuItemUrl(item.url);

                let renderContent;
                switch (item.title) {
                  case 'About':
                    renderContent = (
                      <AboutDropdown
                        menuItems={item}
                        publicStoreDomain={publicStoreDomain}
                        primaryDomainUrl={primaryDomainUrl}
                        enableMobileToggle={enableMobileToggle}
                      />
                    );
                    break;

                  case 'Services':
                    renderContent = (
                      <ServicesDropdown
                        menuItems={item}
                        publicStoreDomain={publicStoreDomain}
                        primaryDomainUrl={primaryDomainUrl}
                        enableMobileToggle={enableMobileToggle}
                      />
                    );
                    break;

                  default:
                    renderContent = (
                      <NavLink
                        className="relative z-10"
                        end
                        onClick={close}
                        prefetch="intent"
                        to={url}
                      >
                        <button className="text-sm font-md relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:bg-accent hover:text-accent-foreground">
                          {item.title}
                          {/* animated underline */}
                          <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                        </button>
                      </NavLink>
                    );
                }

                return (
                  <Fragment key={item.id ?? item.title}>
                    {renderContent}
                  </Fragment>
                );
              })}
            </div>
          </nav>
        </>
      )}
      {windowWidth != undefined &&
        windowWidth >= 930 &&
        windowWidth <= 1024 && (
          <nav className={`${className}`} role="navigation">
            <div className="nav-logo-container 1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary underline-offset-4 hover:underline h-9 ps-2 pt-[15px] pb-4">
              <NavLink
                end
                onClick={close}
                prefetch="intent"
                to="/"
                className="logo-container"
              >
                <img
                  src={imageURL}
                  className="logo"
                  style={{height: '2.5rem'}}
                ></img>
              </NavLink>
            </div>
            <div className="2 flex items-center nav-links-container py-4">
              <div className="2.1 flex justify-center w-full gap-[2px]">
                {menuFirstHalf.map((item) => {
                  if (!item.url) return null;

                  // if the url is internal, we strip the domain
                  const url = getMenuItemUrl(item.url);

                  let renderContent;
                  switch (item.title) {
                    case 'About':
                      renderContent = (
                        <AboutDropdown
                          menuItems={item}
                          publicStoreDomain={publicStoreDomain}
                          primaryDomainUrl={primaryDomainUrl}
                          enableMobileToggle={enableMobileToggle}
                        ></AboutDropdown>
                      );
                      break;
                    case 'Services':
                      renderContent = (
                        <ServicesDropdown
                          menuItems={item}
                          publicStoreDomain={publicStoreDomain}
                          primaryDomainUrl={primaryDomainUrl}
                          enableMobileToggle={enableMobileToggle}
                        ></ServicesDropdown>
                      );
                      break;

                    default:
                      renderContent = (
                        <NavLink
                          className="relative z-10"
                          end
                          onClick={close}
                          prefetch="intent"
                          to={url}
                        >
                          <button className="text-sm font-md relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:bg-accent hover:text-accent-foreground">
                            {item.title}
                            {/* animated underline */}
                            <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                          </button>
                        </NavLink>
                      );
                      break;
                  }
                  return (
                    <Fragment key={item.id ?? item.title}>
                      {renderContent}
                    </Fragment>
                  );
                })}
              </div>
              <div className="2.2 flex justify-center w-full gap-[2px] ps-[2px]">
                {menuSecondHalf.map((item) => {
                  if (!item.url) return null;

                  // if the url is internal, we strip the domain
                  const url = getMenuItemUrl(item.url);

                  let renderContent;
                  switch (item.title) {
                    case 'About':
                      renderContent = (
                        <AboutDropdown
                          menuItems={item}
                          publicStoreDomain={publicStoreDomain}
                          primaryDomainUrl={primaryDomainUrl}
                          enableMobileToggle={enableMobileToggle}
                        ></AboutDropdown>
                      );
                      break;
                    case 'Services':
                      renderContent = (
                        <ServicesDropdown
                          menuItems={item}
                          publicStoreDomain={publicStoreDomain}
                          primaryDomainUrl={primaryDomainUrl}
                          enableMobileToggle={enableMobileToggle}
                        ></ServicesDropdown>
                      );
                      break;

                    default:
                      renderContent = (
                        <NavLink
                          className="relative z-10"
                          end
                          onClick={close}
                          prefetch="intent"
                          to={url}
                        >
                          <button className="text-sm font-medium relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:text-accent-foreground whitespace-nowrap flex-shrink-0">
                            {item.title}

                            {/* animated underline */}
                            <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                          </button>
                        </NavLink>
                      );
                      break;
                  }
                  return (
                    <Fragment key={item.id ?? item.title}>
                      {renderContent}
                    </Fragment>
                  );
                })}
              </div>
            </div>
            {cart && (
              <div className="3 flex gap-3 items-center ctas-cart-search-container py-4">
                <HeaderCtas cart={cart} isLoggedIn={isLoggedIn} />
              </div>
            )}
          </nav>
        )}
      {windowWidth != undefined && windowWidth > 1024 && (
        <nav className={`${className}`} role="navigation">
          <div className="nav-logo-container 1 inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 text-primary underline-offset-4 hover:underline h-9 ps-2 pt-[15px] pb-4">
            <NavLink
              end
              onClick={close}
              prefetch="intent"
              to="/"
              className="logo-container"
            >
              <img
                src={imageURL}
                className="logo"
                style={{height: '2.5rem'}}
              ></img>
            </NavLink>
          </div>
          <div className="2 flex items-center nav-links-container py-4">
            <div className="2.1 flex justify-center w-full gap-[10px]">
              {menuFirstHalf.map((item) => {
                if (!item.url) return null;

                // if the url is internal, we strip the domain
                const url = getMenuItemUrl(item.url);

                let renderContent;
                switch (item.title) {
                  case 'About':
                    renderContent = (
                      <AboutDropdown
                        menuItems={item}
                        publicStoreDomain={publicStoreDomain}
                        primaryDomainUrl={primaryDomainUrl}
                        enableMobileToggle={enableMobileToggle}
                      ></AboutDropdown>
                    );
                    break;
                  case 'Services':
                    renderContent = (
                      <ServicesDropdown
                        menuItems={item}
                        publicStoreDomain={publicStoreDomain}
                        primaryDomainUrl={primaryDomainUrl}
                        enableMobileToggle={enableMobileToggle}
                      ></ServicesDropdown>
                    );
                    break;

                  default:
                    renderContent = (
                      <NavLink
                        className="relative z-10"
                        end
                        onClick={close}
                        prefetch="intent"
                        to={url}
                      >
                        <button className="text-sm font-md relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:bg-accent hover:text-accent-foreground">
                          {item.title}
                          {/* animated underline */}
                          <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                        </button>
                      </NavLink>
                    );
                    break;
                }
                return (
                  <Fragment key={item.id ?? item.title}>
                    {renderContent}
                  </Fragment>
                );
              })}
            </div>
            <div className="2.2 flex justify-center w-full gap-[10px] ps-[10px]">
              {menuSecondHalf.map((item) => {
                if (!item.url) return null;

                // if the url is internal, we strip the domain
                const url = getMenuItemUrl(item.url);

                let renderContent;
                switch (item.title) {
                  case 'About':
                    renderContent = (
                      <AboutDropdown
                        menuItems={item}
                        publicStoreDomain={publicStoreDomain}
                        primaryDomainUrl={primaryDomainUrl}
                        enableMobileToggle={enableMobileToggle}
                      ></AboutDropdown>
                    );
                    break;
                  case 'Services':
                    renderContent = (
                      <ServicesDropdown
                        menuItems={item}
                        publicStoreDomain={publicStoreDomain}
                        primaryDomainUrl={primaryDomainUrl}
                        enableMobileToggle={enableMobileToggle}
                      ></ServicesDropdown>
                    );
                    break;

                  default:
                    renderContent = (
                      <NavLink
                        className="relative z-10"
                        end
                        onClick={close}
                        prefetch="intent"
                        to={url}
                      >
                        <button className="text-sm font-medium relative group px-[4px] py-2 rounded-md transition-colors hover:bg-accent hover:text-primary cursor-pointer text-primary hover:text-accent-foreground whitespace-nowrap flex-shrink-0">
                          {item.title}

                          {/* animated underline */}
                          <span className="absolute bottom-0 left-[2px] right-[2px] h-[2px] bg-primary scale-x-0 transition-transform duration-300 group-hover:scale-x-100 origin-center" />
                        </button>
                      </NavLink>
                    );
                    break;
                }
                return (
                  <Fragment key={item.id ?? item.title}>
                    {renderContent}
                  </Fragment>
                );
              })}
            </div>
          </div>
          {cart && (
            <div className="3 flex gap-3 items-center ctas-cart-search-container py-4">
              <HeaderCtas cart={cart} isLoggedIn={isLoggedIn} />
            </div>
          )}
        </nav>
      )}
    </>
  );
}

function HeaderCtas({
  cart,
  isLoggedIn,
}: {
  cart: HeaderProps['cart'];
  isLoggedIn: Promise<boolean> | undefined;
}) {
  type NavLink = {
    href: string;
    label: string;
    icon: string;
  };
  const loginValue = useIsLoggedIn(isLoggedIn);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const links: NavLink[] = [
    {href: '/', label: 'Home', icon: 'home-icon'},
    {href: 'account/orders', label: 'My Orders', icon: 'orders-icon'},
    {href: 'account/favorites', label: 'My Favorites', icon: 'favorite-icon'},
    {href: 'account/reviews', label: 'My Reviews', icon: 'reviews-icon'},
    {href: 'account/profile', label: 'My Profile', icon: 'profile-icon'},
    {href: 'account/addresses', label: 'My Addresses', icon: 'addresses-icon'},
  ];

  return (
    <nav className="header-ctas" role="navigation">
      {/* <HeaderMenuMobileToggle /> */}

      <RadixHoverCard.Root
        open={accountMenuOpen}
        onOpenChange={setAccountMenuOpen}
        openDelay={100}
        closeDelay={100}
      >
        <RadixHoverCard.Trigger asChild>
          <NavLink prefetch="intent" to="/account">
            <div className="account-menu-dropdown">
              <Button
                variant="outline"
                className="flex items-center gap-2 max-w-[100px] cursor-pointer"
              >
                {/* <LuAlignLeft className="w-6 h-6" /> */}
                {/* Place dropdown arrow here */}
                <LuUser className="lu-user-icon bg-primary rounded-full text-white"/>
                <button
                  type="button"
                  aria-label="Toggle account menu"
                  aria-expanded={accountMenuOpen}
                  className="account-dropdown-arrow-button ps-[1px] text-primary cursor-default"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setAccountMenuOpen((currentOpen) => !currentOpen);
                  }}
                >
                  <ChevronUp
                    className={` account-dropdown-arrow-icon rounded-md border border-input transition-transform duration-200 ${
                      accountMenuOpen ? 'rotate-180' : 'rotate-0'
                    }`}
                    size={18}
                  />
                </button>
                {/* <Suspense fallback="Sign in">
                <Await resolve={isLoggedIn} errorElement="Sign in">
                  {(isLoggedIn) => (isLoggedIn ? 'Account' : 'Sign in')}
                </Await>
              </Suspense> */}
              </Button>
            </div>
          </NavLink>
        </RadixHoverCard.Trigger>

        {/* Portal ensures this content floats above the header */}
        <RadixHoverCard.Portal>
          <RadixHoverCard.Content
            sideOffset={3}
            align="center"
            className={`
            hovercard-content 
            rounded border-l border-r border-t border-b
            ${loginValue ? 'w-46' : 'w-48'}
          `}
          >
            {loginValue ? (
              <>
                <div className="p-3">
                  <div>Hello, </div>
                  {links.map((link) => (
                    <Link to={link.href}>
                      <Button
                        key={link.href}
                        variant="ghost"
                        className="cursor-pointer"
                      >
                        <div className={`flex justify-start items-center`}>
                          <img
                            src={`/${link.icon}.png`}
                            alt="icon"
                            style={{height: '1rem'}}
                          ></img>
                          &nbsp;
                          <div className={`ms-1 flex items-center`}>
                            {link.label}
                          </div>
                          &nbsp;
                        </div>
                      </Button>
                    </Link>
                  ))}
                </div>
                <hr />
                <div className="pt-3 pe-3 pb-3 ps-2 cursor-pointer">
                  <Logout />
                </div>
              </>
            ) : (
              <>
                <div className="p-3">
                  <Link to="/account/login">
                    <Button variant="ghost" className="mb-3 cursor-pointer">
                      <div className="flex justify-start items-center me-3">
                        <img
                          src={`/signup-icon.png`}
                          alt="icon"
                          style={{height: '1rem'}}
                        ></img>
                        &nbsp;
                        <div className={`ms-1 flex items-center`}>
                          Sign In/Sign Up
                        </div>
                        &nbsp;
                      </div>
                    </Button>
                  </Link>
                </div>
              </>
            )}
          </RadixHoverCard.Content>
        </RadixHoverCard.Portal>
      </RadixHoverCard.Root>

      <CartToggle cart={cart} />
      <SearchToggle />
    </nav>
  );
}
function Logout() {
  return (
    <Form
      className="account-logout cursor-pointer"
      method="POST"
      action="/account/logout"
    >
      &nbsp;
      <Button type="submit" variant="ghost" className="custor-pointer">
        <div className="flex justify-start items-center cursor-pointer">
          <img
            src={`/signout-icon.png`}
            alt="icon"
            style={{height: '1rem'}}
          ></img>
          &nbsp;
          <div className={`ms-1 flex items-center`}>Sign out</div>
          &nbsp;
        </div>
      </Button>
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
  const onCartHover = () => {
    open('cart');
  };
  return (
    <div onMouseEnter={onCartHover}>
      <Button
        // href="/cart"
        className="w-1"
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
          <div>
            <LuShoppingCart className="relative -bottom-3 -right-1" />
            <span className="relative -top-6 -right-5 bg-primary text-white rounded-full h-6 w-6 flex items-center justify-center text-xs">
              {count}
            </span>
          </div>
        </NavLink>
      </Button>
    </div>
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
