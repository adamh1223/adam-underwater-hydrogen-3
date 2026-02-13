import {createHydrogenContext} from '@shopify/hydrogen';
import {AppSession} from '~/lib/session';
import {CART_QUERY_FRAGMENT} from '~/lib/fragments';

/**
 * The context implementation is separate from server.ts
 * so that type can be extracted for AppLoadContext
 * */
export async function createAppLoadContext(
  request: Request,
  env: Env,
  executionContext: ExecutionContext,
) {
  /**
   * Open a cache instance in the worker and a custom session instance.
   */
  if (!env?.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable is not set');
  }

  const waitUntil = executionContext.waitUntil.bind(executionContext);
  const [cache, session] = await Promise.all([
    caches.open('hydrogen'),
    AppSession.init(request, [env.SESSION_SECRET]),
  ]);

  const hostname = new URL(request.url).hostname;
  const isLocalHostname =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.ngrok-free.app') ||
    hostname.endsWith('.tryhydrogen.dev');

  // Hydrogen prefers the server-to-server delegate token when present. If that
  // token is missing required Storefront API scopes locally, key homepage
  // sections (recommended products / featured reviews) can silently fail.
  // Using the public token for local development keeps local behavior aligned
  // with production (where the delegate token is often unset).
  // NOTE: `env` can be a proxy/non-plain object in MiniOxygen. Spreading it can
  // drop non-enumerable bindings (like server-only secrets), causing `context.env`
  // to lose values such as `SHOPIFY_ADMIN_TOKEN` for local/ngrok requests.
  // Override only the delegate token while preserving the original env object.
  const envForHydrogen: Env = isLocalHostname
    ? (new Proxy(env, {
        get(target, prop, receiver) {
          if (prop === 'PRIVATE_STOREFRONT_API_TOKEN') return '';
          return Reflect.get(target, prop, receiver);
        },
      }) as Env)
    : env;

  const hydrogenContext = createHydrogenContext({
    env: envForHydrogen,
    request,
    cache,
    waitUntil,
    session,
    i18n: {language: 'EN', country: 'US'},
    cart: {
      queryFragment: CART_QUERY_FRAGMENT,
    },
  });

  return {
    ...hydrogenContext,
    // declare additional Remix loader context
  };
}
