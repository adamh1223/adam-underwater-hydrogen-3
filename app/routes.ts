import {flatRoutes} from '@remix-run/fs-routes';
import {layout, route, type RouteConfig} from '@remix-run/route-config';
import {hydrogenRoutes} from '@shopify/hydrogen';

export default hydrogenRoutes([
  // ✅ Explicit resource routes (files with [.] are NOT picked up by flatRoutes)
  route('apple-touch-icon.png', './routes/apple-touch-icon[.]png.ts'),
  route(
    'apple-touch-icon-precomposed.png',
    './routes/apple-touch-icon-precomposed[.]png.ts',
  ),
  route('favicon.ico', './routes/favicon[.]ico.ts'),
  route('favicon-32x32.png', './routes/favicon-32x32[.]png.ts'),
  route('favicon-16x16.png', './routes/favicon-16x16[.]png.ts'),
  route('site.webmanifest', './routes/site[.]webmanifest.ts'),

  // ✅ Everything else (normal pages)
  layout('./layout.tsx', [
    route('prints', './custom-routes/prints.tsx'),
    route('stock', './custom-routes/stock.tsx'),
    ...(await flatRoutes()),
  ]),
]) satisfies RouteConfig;
