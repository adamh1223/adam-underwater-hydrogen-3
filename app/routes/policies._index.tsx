import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {Button} from '~/components/ui/button';

export async function loader({context}: LoaderFunctionArgs) {
  const data = await context.storefront.query(POLICIES_QUERY);
  const policies = Object.values(data.shop || {});

  if (!policies.length) {
    throw new Response('No policies found', {status: 404});
  }

  return {policies};
}

export default function Policies() {
  const {policies} = useLoaderData<typeof loader>();

  return (
    <div className="policies">
      <div className="flex justify-center mt-5">
        <img src={'/policies.png'} style={{height: '85px'}}></img>
      </div>
      <div className="flex justify-center gap-x-4">
        {policies.map((policy) => {
          if (!policy) return null;
          return (
            <>
              <Button variant="outline">
                <fieldset key={policy.id}>
                  <Link to={`/policies/${policy.handle}`}>{policy.title}</Link>
                </fieldset>
              </Button>
            </>
          );
        })}
      </div>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    handle
  }
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...PolicyItem
      }
      shippingPolicy {
        ...PolicyItem
      }
      termsOfService {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
      subscriptionPolicy {
        id
        title
        handle
      }
    }
  }
` as const;
