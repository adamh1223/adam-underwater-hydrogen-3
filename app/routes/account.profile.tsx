import type {CustomerFragment} from 'customer-accountapi.generated';
import type {CustomerUpdateInput} from '@shopify/hydrogen/customer-account-api-types';
import {
  CUSTOMER_UPDATE_MUTATION,
  CUSTOMER_EMAIL_MARKETING_SUBSCRIBE,
  CUSTOMER_EMAIL_MARKETING_UNSUBSCRIBE,
} from '~/graphql/customer-account/CustomerUpdateMutation';
import {
  data,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from '@shopify/remix-oxygen';
import {
  Form,
  useActionData,
  useNavigation,
  useOutletContext,
  type MetaFunction,
} from '@remix-run/react';
import {Card, CardAction, CardContent, CardHeader} from '~/components/ui/card';
import {Button} from '~/components/ui/button';
import {Input} from '~/components/ui/input';
import Sectiontitle from '~/components/global/Sectiontitle';

export type ActionResponse = {
  error: string | null;
  customer: CustomerFragment | null;
  marketingEmail?: boolean;
  marketingSms?: boolean;
};

const CUSTOMER_SMS_MARKETING_UPDATE = `#graphql
  mutation CustomerSmsMarketingConsentUpdate(
    $customerId: ID!
    $smsMarketingConsent: SmsMarketingConsentInput!
  ) {
    customerSmsMarketingConsentUpdate(
      customerId: $customerId
      smsMarketingConsent: $smsMarketingConsent
    ) {
      customer {
        id
        phoneNumber {
          phoneNumber
          marketingState
        }
      }
      userErrors {
        field
        message
        code
      }
    }
  }
` as const;

export const meta: MetaFunction = () => {
  return [{title: 'Profile'}];
};

export async function loader({context}: LoaderFunctionArgs) {
  await context.customerAccount.handleAuthStatus();

  return {};
}

export async function action({request, context}: ActionFunctionArgs) {
  const {customerAccount} = context;

  if (request.method !== 'PUT') {
    return data({error: 'Method not allowed'}, {status: 405});
  }

  const form = await request.formData();

  try {
    const customer: CustomerUpdateInput = {};
    const validInputKeys = ['firstName', 'lastName'] as const;
    for (const [key, value] of form.entries()) {
      if (!validInputKeys.includes(key as any)) {
        continue;
      }
      if (typeof value === 'string' && value.length) {
        customer[key as (typeof validInputKeys)[number]] = value;
      }
    }

    const marketingEmail = form.get('marketingEmail') === 'on';
    const marketingSms = form.get('marketingSms') === 'on';
    const currentMarketingEmail = form.get('currentMarketingEmail') === 'true';
    const currentMarketingSms = form.get('currentMarketingSms') === 'true';

    // update customer and possibly password
    const {data: mutationData, errors} = await customerAccount.mutate(
      CUSTOMER_UPDATE_MUTATION,
      {
        variables: {
          customer,
        },
      },
    );

    if (errors?.length) {
      throw new Error(errors[0].message);
    }

    if (!mutationData?.customerUpdate?.customer) {
      throw new Error('Customer profile update failed.');
    }

    const customerId = mutationData.customerUpdate.customer.id;

    if (marketingEmail !== currentMarketingEmail) {
      const marketingMutation = marketingEmail
        ? CUSTOMER_EMAIL_MARKETING_SUBSCRIBE
        : CUSTOMER_EMAIL_MARKETING_UNSUBSCRIBE;
      const marketingResponse = await customerAccount.mutate(marketingMutation);
      const marketingErrors = marketingEmail
        ? marketingResponse?.data?.customerEmailMarketingSubscribe?.userErrors ??
          []
        : marketingResponse?.data?.customerEmailMarketingUnsubscribe
            ?.userErrors ?? [];

      if (marketingErrors.length) {
        throw new Error(marketingErrors[0].message);
      }
    }

    if (marketingSms !== currentMarketingSms) {
      const adminToken = context.env.SHOPIFY_ADMIN_TOKEN;
      const storeDomain = context.env.PUBLIC_STORE_DOMAIN;
      const adminDomainEnv = context.env.SHOPIFY_ADMIN_DOMAIN;

      if (!adminToken || !storeDomain) {
        throw new Error('Missing admin credentials to update SMS consent.');
      }

      const sanitizedStoreDomain = storeDomain.replace(/^https?:\/\//, '');
      const adminDomain =
        adminDomainEnv?.replace(/^https?:\/\//, '') ??
        (sanitizedStoreDomain.includes('myshopify.com')
          ? sanitizedStoreDomain
          : null);
      if (!adminDomain) {
        throw new Error(
          'Missing SHOPIFY_ADMIN_DOMAIN for Admin API requests.',
        );
      }
      const smsResponse = await fetch(
        `https://${adminDomain}/admin/api/2025-01/graphql.json`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': adminToken,
          },
          body: JSON.stringify({
            query: CUSTOMER_SMS_MARKETING_UPDATE,
            variables: {
              customerId,
              smsMarketingConsent: {
                marketingState: marketingSms ? 'SUBSCRIBED' : 'UNSUBSCRIBED',
                marketingOptInLevel: 'SINGLE_OPT_IN',
              },
            },
          }),
        },
      );

      const smsText = await smsResponse.text();
      if (!smsResponse.ok) {
        throw new Error(`Admin API error (${smsResponse.status}): ${smsText}`);
      }

      let smsJson: any = {};
      try {
        smsJson = JSON.parse(smsText);
      } catch (parseError) {
        throw new Error('Invalid Admin API response.');
      }

      const smsErrors =
        smsJson?.data?.customerSmsMarketingConsentUpdate?.userErrors ??
        smsJson?.errors ??
        [];
      if (smsErrors.length) {
        const message =
          smsErrors[0]?.message ?? 'Unable to update SMS marketing consent.';
        throw new Error(message);
      }
    }

    return data({
      error: null,
      customer: mutationData?.customerUpdate?.customer ?? null,
      marketingEmail,
      marketingSms,
    });
  } catch (error: any) {
    return data(
      {error: error.message, customer: null},
      {
        status: 400,
      },
    );
  }
}

export default function AccountProfile() {
  const account = useOutletContext<{customer: CustomerFragment}>();
  const {state} = useNavigation();
  const action = useActionData<ActionResponse>();
  const customer = action?.customer
    ? {...account?.customer, ...action?.customer}
    : account?.customer;
  const email = customer?.emailAddress?.emailAddress ?? '';
  const phone = customer?.phoneNumber?.phoneNumber ?? '';
  const marketingEmailState = customer?.emailAddress?.marketingState;
  const marketingEmail =
    action?.marketingEmail ??
    (marketingEmailState === 'SUBSCRIBED' ||
      marketingEmailState === 'PENDING');
  const marketingSmsState = customer?.phoneNumber?.marketingState;
  const marketingSms =
    action?.marketingSms ??
    (marketingSmsState === 'SUBSCRIBED' || marketingSmsState === 'PENDING');

  return (
    <>
      <Sectiontitle text="My Profile" />
      <div className="account-profile flex justify-center">
        <Card className="mx-2 mt-3 w-[95%]">
          <div className="p-4">
            <h2>My profile</h2>
          </div>

          <Form method="PUT">
            <div className="ps-4">
              <legend>Account information</legend>
            </div>
            <CardContent className="ps-4">
              <fieldset>
                <label htmlFor="firstName" className="me-2">
                  First name:
                </label>
                <div className="py-2">
                  <Input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    placeholder="First name"
                    aria-label="First name"
                    defaultValue={customer.firstName ?? ''}
                    minLength={2}
                    className="w-[250px]"
                  />
                </div>
                <label htmlFor="lastName" className="me-2">
                  Last name:
                </label>
                <div className="py-2">
                  <Input
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    placeholder="Last name"
                    aria-label="Last name"
                    defaultValue={customer.lastName ?? ''}
                    minLength={2}
                    className="w-[250px]"
                  />
                </div>
                <label htmlFor="email" className="me-2">
                  Email:
                </label>
                <div className="py-2">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="Email"
                    aria-label="Email"
                    defaultValue={email}
                    readOnly
                    className="w-[250px]"
                  />
                </div>
                <label htmlFor="phone" className="me-2">
                  Phone number:
                </label>
                <div className="py-2">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Phone number"
                    aria-label="Phone number"
                    defaultValue={phone}
                    readOnly
                    className="w-[250px]"
                  />
                </div>
                <div className="pt-4">
                  <h3>Marketing</h3>
                  <div className="py-2">
                    <input
                      type="hidden"
                      name="currentMarketingEmail"
                      value={marketingEmail ? 'true' : 'false'}
                    />
                    <label
                      htmlFor="marketingEmail"
                      className="flex items-center gap-2"
                    >
                      <input
                        id="marketingEmail"
                        name="marketingEmail"
                        type="checkbox"
                        defaultChecked={marketingEmail}
                      />
                      Subscribed to marketing emails for news and discounts
                    </label>
                  </div>
                  <div className="py-2">
                    <input
                      type="hidden"
                      name="currentMarketingSms"
                      value={marketingSms ? 'true' : 'false'}
                    />
                    <label
                      htmlFor="marketingSms"
                      className="flex items-center gap-2"
                    >
                      <input
                        id="marketingSms"
                        name="marketingSms"
                        type="checkbox"
                        defaultChecked={marketingSms}
                      />
                      Subscribed to SMS news and discounts
                    </label>
                  </div>
                </div>
              </fieldset>
              {action?.error ? (
                <p>
                  <mark>
                    <small>{action.error}</small>
                  </mark>
                </p>
              ) : (
                <br />
              )}
            </CardContent>
            <CardAction>
              <Button
                type="submit"
                disabled={state !== 'idle'}
                variant="outline"
                className="m-5"
              >
                {state !== 'idle' ? 'Updating' : 'Update'}
              </Button>
            </CardAction>
          </Form>
        </Card>
      </div>
    </>
  );
}
