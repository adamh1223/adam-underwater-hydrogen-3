import {CacheNone, getShopAnalytics} from '@shopify/hydrogen';
import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  type MetaFunction,
  type ShouldRevalidateFunction,
} from '@remix-run/react';

import {FOOTER_QUERY, HEADER_QUERY} from '~/lib/fragments';
import {CUSTOMER_WISHLIST} from './lib/customerQueries';
import {ADMIN_CUSTOMER_ID} from '~/lib/admin';

export type RootLoader = typeof loader;

const DEFAULT_LINK_PREVIEW_ICON =
  'https://downloads.adamunderwater.com/store-1-au/public/imessage-icon.png';

function humanizePathname(pathname: string): string {
  if (pathname === '/') return 'Home';
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) =>
      segment
        .replace(/[-_]+/g, ' ')
        .replace(/\$/g, '')
        .replace(/\b\w/g, (char) => char.toUpperCase()),
    );

  if ((segments[0] ?? '').toLowerCase() === 'pages') {
    segments.shift();
  }

  return segments.length ? segments.join(' / ') : 'Home';
}

function getLastMetaString(
  matches: Array<{meta?: Array<Record<string, unknown>>}>,
  extractor: (descriptor: Record<string, unknown>) => unknown,
): string | undefined {
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const descriptors = Array.isArray(matches[i]?.meta) ? matches[i].meta : [];
    for (let j = descriptors.length - 1; j >= 0; j -= 1) {
      const candidate = extractor(descriptors[j] ?? {});
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }
  return undefined;
}

export const meta: MetaFunction = ({matches, location}) => {
  const isProductDetailPath = /^\/products\/[^/]+\/?$/.test(location.pathname);
  if (isProductDetailPath) {
    return [];
  }

  const pageTitle =
    getLastMetaString(
      matches as Array<{meta?: Array<Record<string, unknown>>}>,
      (descriptor) => descriptor.title,
    ) ?? `Adam Underwater | ${humanizePathname(location.pathname)}`;

  const description =
    getLastMetaString(
      matches as Array<{meta?: Array<Record<string, unknown>>}>,
      (descriptor) =>
        descriptor.name === 'description' ? descriptor.content : undefined,
    ) ??
    getLastMetaString(
      matches as Array<{meta?: Array<Record<string, unknown>>}>,
      (descriptor) =>
        descriptor.property === 'og:description'
          ? descriptor.content
          : undefined,
    );

  return [
    {name: 'title', content: pageTitle},
    {property: 'og:type', content: 'website'},
    {property: 'og:title', content: pageTitle},
    ...(description ? [{property: 'og:description', content: description}] : []),
    {property: 'og:image', content: DEFAULT_LINK_PREVIEW_ICON},
    {property: 'og:image:secure_url', content: DEFAULT_LINK_PREVIEW_ICON},
    {property: 'og:image:alt', content: 'Adam Underwater icon preview'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: pageTitle},
    ...(description ? [{name: 'twitter:description', content: description}] : []),
    {name: 'twitter:image', content: DEFAULT_LINK_PREVIEW_ICON},
    {name: 'twitter:image:alt', content: 'Adam Underwater icon preview'},
  ];
};

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({
  formMethod,
  currentUrl,
  nextUrl,
}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    // Google Search favicon (48x48)
    {
      rel: 'icon',
      type: 'image/png',
      sizes: '48x48',
      href: 'https://downloads.adamunderwater.com/store-1-au/public/favicon-48.png',
    },

    // Browser tab icon (high quality)
    {
      rel: 'icon',
      type: 'image/png',
      href: 'https://downloads.adamunderwater.com/store-1-au/public/real-icon-2.png',
    },

    // Apple
    {
      rel: 'apple-touch-icon',
      href: 'https://downloads.adamunderwater.com/store-1-au/public/real-icon-2.png',
    },
  ];
}


export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;

  const checkoutDomain =
    env.PUBLIC_CHECKOUT_DOMAIN || env.PUBLIC_STORE_DOMAIN || '';

  const consent =
    checkoutDomain && env.PUBLIC_STOREFRONT_API_TOKEN
      ? {
          checkoutDomain,
          storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
          withPrivacyBanner: false,
          // localize the privacy banner
          country: args.context.storefront.i18n.country,
          language: args.context.storefront.i18n.language,
        }
      : null;

  return {
    ...deferredData,
    ...criticalData,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    consent,
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({context}: LoaderFunctionArgs) {
  const {storefront} = context;

  const [header] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: CacheNone(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);
  let customer = null;
  try {
    customer = await context.customerAccount.query(CUSTOMER_WISHLIST);
  } catch (error) {
    console.warn('Not logged in');
    customer = null;
  }
  const customerId = customer?.data.customer.id ?? null;
  const isAdmin = customerId === ADMIN_CUSTOMER_ID;
  const customerFirstName = customer?.data.customer.firstName ?? '';
  const wishlistProducts = (() => {
    if (!customer) return [];

    const wishlistValue = customer.data.customer.metafield?.value;

    if (!wishlistValue) return [];

    try {
      return JSON.parse(wishlistValue) as string[];
    } catch (error) {
      console.warn('Unable to parse wishlist metafield', error);
      return [];
    }
  })();

  return {
    wishlistProducts,
    customerFirstName,
    header,
    isAdmin,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: LoaderFunctionArgs) {
  const {storefront, customerAccount, cart} = context;

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });
  return {
    cart: cart.get(),
    isLoggedIn: customerAccount.isLoggedIn(),
    footer,
  };
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="route-error">
      <h1>Oops</h1>
      <h2>{errorStatus}</h2>
      {errorMessage && (
        <fieldset>
          <pre>{errorMessage}</pre>
        </fieldset>
      )}
    </div>
  );
}
