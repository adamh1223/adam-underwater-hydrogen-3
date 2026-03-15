import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  useLoaderData,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from '@remix-run/react';
import {Button} from '~/components/ui/button';
import {Card, CardContent, CardHeader} from '~/components/ui/card';
import {useCallback, useEffect, useRef, useState} from 'react';
import PoliciesIndexSkeleton from '~/components/skeletons/PoliciesIndexSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {cn} from '~/lib/utils';

export async function loader({context}: LoaderFunctionArgs) {
  const data = await context.storefront.query(POLICIES_QUERY, {
    variables: {
      country: context.storefront.i18n?.country,
      language: context.storefront.i18n?.language,
    },
  });

  const policies = [
    data.shop?.privacyPolicy,
    data.shop?.refundPolicy,
    data.shop?.termsOfService,
    data.shop?.shippingPolicy,
  ].filter((policy): policy is NonNullable<typeof policy> => Boolean(policy));

  if (!policies.length) {
    throw new Response('No policies found', {status: 404});
  }

  return {policies};
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  if (currentUrl.pathname === '/policies' && nextUrl.pathname === '/policies') {
    return false;
  }

  return defaultShouldRevalidate;
}

const policySelectorHoverEffects =
  'transition-[border-color,box-shadow] duration-300 hover:border-primary hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] active:border-primary active:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] focus-visible:border-primary focus-visible:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
const policySelectorActiveEffects =
  'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';

export default function Policies() {
  const {policies} = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPolicyFromUrl = searchParams.get('policy');
  const [selectedPolicyHandle, setSelectedPolicyHandle] = useState<string>('');
  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledLoad = useRef(false);
  const policiesImgRef = useRef<HTMLImageElement>(null);

  const handlePoliciesImgLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  useEffect(() => {
    const img = policiesImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handlePoliciesImgLoad();
    }
  }, [handlePoliciesImgLoad]);

  useEffect(() => {
    if (!policies.length) return;

    const selectedPolicyFromParam = selectedPolicyFromUrl
      ? policies.find((policy) => policy.handle === selectedPolicyFromUrl)
      : undefined;
    const fallbackPolicy = policies[0];

    if (!fallbackPolicy) return;

    const nextPolicyHandle =
      selectedPolicyFromParam?.handle ?? fallbackPolicy.handle;

    setSelectedPolicyHandle((current) =>
      current === nextPolicyHandle ? current : nextPolicyHandle,
    );

    if (
      !selectedPolicyFromParam &&
      selectedPolicyFromUrl !== nextPolicyHandle
    ) {
      setSearchParams(
        {policy: nextPolicyHandle},
        {replace: true, preventScrollReset: true},
      );
    }
  }, [policies, selectedPolicyFromUrl, setSearchParams]);

  const handlePolicySelect = useCallback(
    (policyHandle: string) => {
      setSelectedPolicyHandle(policyHandle);
      setSearchParams({policy: policyHandle}, {preventScrollReset: true});
    },
    [setSearchParams],
  );

  const selectedPolicy =
    policies.find((policy) => policy.handle === selectedPolicyHandle) ??
    policies[0];

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<PoliciesIndexSkeleton />}>
      <div className="policies">
        <div className="flex justify-center mt-5">
          <img
            ref={policiesImgRef}
            src={
              'https://downloads.adamunderwater.com/store-1-au/public/policies.png'
            }
            style={{height: '85px'}}
            onLoad={handlePoliciesImgLoad}
            alt="Policies"
          />
        </div>
        <div className="flex justify-center policy-container-small flex-wrap mt-4">
          {policies.map((policy) => {
            const isSelected = policy.handle === selectedPolicyHandle;
            return (
              <div key={policy.id} className="flex justify-center mx-3 my-3">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-44',
                    policySelectorHoverEffects,
                    isSelected && policySelectorActiveEffects,
                  )}
                  onClick={() => handlePolicySelect(policy.handle)}
                >
                  {policy.title}
                </Button>
              </div>
            );
          })}
        </div>

        {selectedPolicy && (
          <div className="policy-div-container flex justify-center pb-8">
            <div className="policy-div flex justify-center">
              <Card className="mt-5 w-full">
                <div className="flex justify-center py-2">
                  <div className="flex justify-center items-center">
                    {selectedPolicy.title}
                  </div>
                </div>
                <hr />

                <div className="py-3">
                  <div className="flex justify-center px-4">
                    <div
                      dangerouslySetInnerHTML={{__html: selectedPolicy.body}}
                    />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </SkeletonGate>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    handle
    body
    url
  }
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
      termsOfService {
        ...PolicyItem
      }
      shippingPolicy {
        ...PolicyItem
      }
    }
  }
` as const;
