import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';

const MANIFEST = {
  name: 'Adam Underwater',
  short_name: 'Adam Underwater',
  icons: [
    {
      src: '/apple-touch-icon.png',
      sizes: '180x180',
      type: 'image/png',
    },
    {
      src: '/apple-touch-icon.png',
      sizes: '512x512',
      type: 'image/png',
    },
  ],
  theme_color: '#000f2f',
  background_color: '#000f2f',
  display: 'standalone',
};

export async function loader(_args: LoaderFunctionArgs) {
  return new Response(JSON.stringify(MANIFEST), {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=14400',
    },
  });
}
