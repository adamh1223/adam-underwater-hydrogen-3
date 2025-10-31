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
import {RootLoader} from './root';

// ✅ Import TooltipProvider from Shadcn UI
import {TooltipProvider} from '~/components/ui/tooltip';

export default function Layout() {
  const nonce = useNonce();
  const data = useRouteLoaderData<RootLoader>('root');
  console.log(data, '404040');

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="stylesheet" href={tailwindCss}></link>
        <link rel="stylesheet" href={appStyles}></link>
        {/* <link rel="preconnect" href="https://fonts.googleapis.com"></link>
        <link rel="preconnect" href="https://fonts.gstatic.com"></link>
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap"
          rel="stylesheet"
        ></link> */}
        <Meta />
        <Links />
      </head>
      <body className="dark">
        <TooltipProvider delayDuration={200}>
          {data ? (
            <Analytics.Provider
              cart={data.cart}
              shop={data.shop}
              consent={data.consent}
            >
              {/* @ts-expect-error default shopify setup */}
              <PageLayout {...data}>
                <Outlet />
              </PageLayout>
            </Analytics.Provider>
          ) : (
            <Outlet />
          )}
        </TooltipProvider>
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}
