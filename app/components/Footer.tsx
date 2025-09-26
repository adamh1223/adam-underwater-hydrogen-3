import {Suspense} from 'react';
import {Await, Link, NavLink} from '@remix-run/react';
import type {FooterQuery, HeaderQuery} from 'storefrontapi.generated';
import {FaFacebook, FaInstagram, FaLinkedin, FaYoutube} from 'react-icons/fa';
import {Button} from './ui/button';

interface FooterProps {
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery;
  publicStoreDomain: string;
}

export function Footer({
  footer: footerPromise,
  header,
  publicStoreDomain,
}: FooterProps) {
  return (
    <Suspense>
      <Await resolve={footerPromise}>
        {(footer) => (
          <footer className="footer">
            {footer?.menu && header.shop.primaryDomain?.url && (
              <FooterMenu
                menu={footer.menu}
                primaryDomainUrl={header.shop.primaryDomain.url}
                publicStoreDomain={publicStoreDomain}
              />
            )}
          </footer>
        )}
      </Await>
    </Suspense>
  );
}

function FooterMenu({
  menu,
  primaryDomainUrl,
  publicStoreDomain,
}: {
  menu: FooterQuery['menu'];
  primaryDomainUrl: FooterProps['header']['shop']['primaryDomain']['url'];
  publicStoreDomain: string;
}) {
  return (
    // <nav className="" role="navigation">

    <>
      <div className="footer-container px-5">
        <div className="flex items-center justify-center w-full my-8">
          <div className="flex-1 h-px bg-muted" />
          <span className="px-4 text-muted-foreground">
            <div className="social-icons">
              <Link
                to="https://www.instagram.com/adamunderwater/"
                target="_blank"
              >
                <FaInstagram className="social-icon" />
              </Link>
              <Link
                to="https://www.youtube.com/@Seaforestation"
                target="_blank"
              >
                <FaYoutube className="social-icon" />
              </Link>
              <Link
                to="https://www.linkedin.com/in/adam-hussain-2baa31178/"
                target="_blank"
              >
                <FaLinkedin className="social-icon" />
              </Link>
            </div>
          </span>
          <div className="flex-1 h-px bg-muted" />
        </div>
      </div>

      <div className="flex justify-evenly w-full pb-[100px] text-muted-foreground pt-5 mx-5">
        <div className="help">
          <div className="footer-title flex justify-center text-3xl mb-2">
            Help
          </div>
          <div className="my-[-10px]">
            <Button variant="link">
              <Link to="/pages/faq">FAQ</Link>
            </Button>
          </div>
        </div>
        <div className="policies">
          <div className="footer-title flex justify-center mb-2 text-3xl">
            <Link to="/policies">Policies</Link>
          </div>
          <div className="my-[-10px]">
            <Button variant="link">
              <Link to="/policies/privacy-policy">Privacy Policy</Link>
            </Button>
          </div>
          <div className="my-[-10px]">
            <Button variant="link">
              <Link to="/policies/refund-policy">Refund Policy</Link>
            </Button>
          </div>
          <div className="my-[-10px]">
            <Button variant="link">
              <Link to="/policies/terms-of-service">Terms of Service</Link>
            </Button>
          </div>
          <div className="my-[-10px]">
            <Button variant="link">
              <Link to="/policies/shipping-policy">Shipping Policy</Link>
            </Button>
          </div>
        </div>
        {/* <NewsLetter /> */}
      </div>

      {/* Very Bottom */}
      <div className="flex justify-center ms-[-5px] mb-3">
        <Button variant="link" asChild>
          <Link to="/">
            <img src={'/colorlogo.svg'} style={{height: '4rem'}}></img>
          </Link>
        </Button>
      </div>
      <div className="flex justify-center my-5 text-muted-foreground">
        <p>Copyright 2024 Adam Underwater, All rights reserved.</p>
      </div>

      {/* {(menu || FALLBACK_FOOTER_MENU).items.map((item) => {
        if (!item.url) return null;
        // if the url is internal, we strip the domain
        const url =
          item.url.includes('myshopify.com') ||
          item.url.includes(publicStoreDomain) ||
          item.url.includes(primaryDomainUrl)
            ? new URL(item.url).pathname
            : item.url;
        const isExternal = !url.startsWith('/');
        return isExternal ? (
          <a href={url} key={item.id} rel="noopener noreferrer" target="_blank">
            {item.title}
          </a>
        ) : (
          <NavLink
            end
            key={item.id}
            prefetch="intent"
            style={activeLinkStyle}
            to={url}
          >
            {item.title} 
          </NavLink>
        );
      })} */}
      {/* // </nav> */}
    </>
  );
}

const FALLBACK_FOOTER_MENU = {
  id: 'gid://shopify/Menu/199655620664',
  items: [
    {
      id: 'gid://shopify/MenuItem/461633060920',
      resourceId: 'gid://shopify/ShopPolicy/23358046264',
      tags: [],
      title: 'Privacy Policy',
      type: 'SHOP_POLICY',
      url: '/policies/privacy-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633093688',
      resourceId: 'gid://shopify/ShopPolicy/23358013496',
      tags: [],
      title: 'Refund Policy',
      type: 'SHOP_POLICY',
      url: '/policies/refund-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633126456',
      resourceId: 'gid://shopify/ShopPolicy/23358111800',
      tags: [],
      title: 'Shipping Policy',
      type: 'SHOP_POLICY',
      url: '/policies/shipping-policy',
      items: [],
    },
    {
      id: 'gid://shopify/MenuItem/461633159224',
      resourceId: 'gid://shopify/ShopPolicy/23358079032',
      tags: [],
      title: 'Terms of Service',
      type: 'SHOP_POLICY',
      url: '/policies/terms-of-service',
      items: [],
    },
  ],
};

function activeLinkStyle({
  isActive,
  isPending,
}: {
  isActive: boolean;
  isPending: boolean;
}) {
  return {
    fontWeight: isActive ? 'bold' : undefined,
    color: isPending ? 'grey' : 'white',
  };
}
