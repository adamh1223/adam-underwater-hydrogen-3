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
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="stylesheet" href={tailwindCss} />
        <link rel="stylesheet" href={appStyles} />
        <link rel="stylesheet" href={sonnerStyles} />
        <Meta />
        <Links />
      </head>
      <body className="dark">
        {/* 🔔 Sonner toaster (mount once at root) */}
        <Toaster richColors={false} className='au-toaster' />

        <TooltipProvider delayDuration={200}>
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
