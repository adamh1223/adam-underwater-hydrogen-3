/// <reference types="vite/client" />
/// <reference types="@shopify/remix-oxygen" />
/// <reference types="@shopify/oxygen-workers-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

import type {
  HydrogenContext,
  HydrogenSessionData,
  HydrogenEnv,
} from '@shopify/hydrogen';
import type {createAppLoadContext} from '~/lib/context';

declare global {
  /**
   * A global `process` object is only available during build to access NODE_ENV.
   */
  const process: {env: {NODE_ENV: 'production' | 'development'}};

  interface Env extends HydrogenEnv {
    // declare additional Env parameter use in the fetch handler and Remix loader context here
    SHOPIFY_ADMIN_TOKEN: string;
    SHOPIFY_ADMIN_DOMAIN: string;
    SHOPIFY_WEBHOOK_SECRET: string;
    SUPABASE_KEY: string;
    SUPABASE_URL: string;
    R2_ACCOUNT_ID: string;
    R2_BUCKET: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ENDPOINT: string;
    R2_REGION: string;
    R2_PUBLIC_BASE_URL?: string;
    R2_REVIEWS_PREFIX?: string;
    R2_CONTACT_SUBMISSIONS_PREFIX?: string;
    RESEND_API_KEY: string;
    DOWNLOAD_EMAIL_LINK_SECRET: string;
    PUBLIC_SITE_URL: string;
    PUBLIC_STOREFRONT_URL: string;
  }
}

declare module '@shopify/remix-oxygen' {
  interface AppLoadContext
    extends Awaited<ReturnType<typeof createAppLoadContext>> {
    // to change context type, change the return of createAppLoadContext() instead
  }

  interface SessionData extends HydrogenSessionData {
    // declare local additions to the Remix session data here
  }
}
