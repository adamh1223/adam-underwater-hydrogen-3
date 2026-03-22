import {useNonce, Analytics} from '@shopify/hydrogen';
import {
  Links,
  Meta,
  Scripts,
  useRouteLoaderData,
  ScrollRestoration,
  Outlet,
} from '@remix-run/react';
import appStyles from '~/styles/app.css?url';
import tailwindCss from './styles/tailwind.css?url';
import {PageLayout} from '~/components/PageLayout';
import sonnerStyles from 'sonner/dist/styles.css?url';
import {RootLoader} from './root';

// ✅ Import TooltipProvider from Shadcn UI
import {TooltipProvider} from '~/components/ui/tooltip';
import {Toaster} from '~/components/ui/sonner';

export default function Layout() {
  const nonce = useNonce();
  const data = useRouteLoaderData<RootLoader>('root');

  const page = data ? (
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore Shopify types don't include our additions yet
    <PageLayout {...data}>
      <Outlet />
    </PageLayout>
  ) : (
    <Outlet />
  );

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width,initial-scale=1, maximum-scale=1"
        />
        <link
          rel="icon"
          href="/favicon.ico"
          type="image/png"
        />
        <link
          rel="preconnect"
          href="https://downloads.adamunderwater.com"
          crossOrigin="anonymous"
        />
        <link
          rel="preconnect"
          href="https://cdn.shopify.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://downloads.adamunderwater.com"
        />
        <link
          rel="dns-prefetch"
          href="https://cdn.shopify.com"
        />
        <link rel="stylesheet" href={tailwindCss} />
        <link rel="stylesheet" href={appStyles} />
        <link rel="stylesheet" href={sonnerStyles} />
        <Meta />
        <Links />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'Adam Underwater',
              url: 'https://adamunderwater.com',
              logo: 'https://downloads.adamunderwater.com/store-1-au/public/icon.png',
              description:
                'Professional underwater video and photography. Shop underwater wall art prints and premium 4K stock footage.',
              sameAs: [
                'https://www.instagram.com/adamunderwater',
                'https://www.youtube.com/@adamunderwater',
                'https://www.linkedin.com/in/adamunderwater',
              ],
              contactPoint: {
                '@type': 'ContactPoint',
                contactType: 'customer service',
                url: 'https://adamunderwater.com/pages/contact',
              },
            }),
          }}
        />
      </head>
      <body className="dark">
        {/* 🔔 Sonner toaster (mount once at root) */}
        <Toaster richColors={false} className="au-toaster" />

        <TooltipProvider delayDuration={0}>
          {data?.consent ? (
            <Analytics.Provider
              cart={data.cart}
              shop={data.shop}
              consent={data.consent}
            >
              {page}
            </Analytics.Provider>
          ) : (
            page
          )}
        </TooltipProvider>

        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}
