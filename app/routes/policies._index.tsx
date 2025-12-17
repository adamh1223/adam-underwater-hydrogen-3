import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link} from '@remix-run/react';
import {Button} from '~/components/ui/button';
import {useEffect, useState} from 'react';

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
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  return (
    <div className="policies">
      <div className="flex justify-center mt-5">
        <img src={'/policies.png'} style={{height: '85px'}}></img>
      </div>
      {windowWidth != undefined && windowWidth <= 768 && (
        <div className="flex justify-center policy-container-small flex-wrap px-5">
          {policies.map((policy) => {
            if (!policy) return null;
            return (
              <>
                <div className="flex justify-center mx-3 my-3">
                  <Button variant="outline" className="w-36">
                    <fieldset key={policy.id}>
                      <Link to={`/policies/${policy.handle}`}>
                        {policy.title}
                      </Link>
                    </fieldset>
                  </Button>
                </div>
              </>
            );
          })}
        </div>
      )}
      {windowWidth != undefined && windowWidth > 768 && (
        <div className="flex justify-center policy-container-large">
          {policies.map((policy) => {
            if (!policy) return null;
            return (
              <>
                <div className="flex justify-center mx-3 my-3">
                  <Button variant="outline" className="w-36">
                    <fieldset key={policy.id}>
                      <Link to={`/policies/${policy.handle}`}>
                        {policy.title}
                      </Link>
                    </fieldset>
                  </Button>
                </div>
              </>
            );
          })}
        </div>
      )}
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
