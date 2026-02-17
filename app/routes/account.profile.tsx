import type {CustomerFragment} from 'customer-accountapi.generated';
import type {CustomerUpdateInput} from '@shopify/hydrogen/customer-account-api-types';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {toast} from 'sonner';
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

const CUSTOMER_SMS_MARKETING_UPDATE = `
  mutation CustomerSmsMarketingConsentUpdate(
   $input: CustomerSmsMarketingConsentUpdateInput!
  ) {
   customerSmsMarketingConsentUpdate(input: $input) {
      customer {
        id
        phone
      }
      userErrors {
        field
        message
        code
      }
    }
  }
` as const;

const CUSTOMER_PHONE_UPDATE = `
  mutation CustomerPhoneUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        phone
      }
      userErrors {
        field
        message
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
  const formCustomerId = form.get('customerId');
  const currentPhone = form.get('currentPhone');
  const phone = form.get('phone');

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
    const phoneValue = typeof phone === 'string' ? phone.trim() : '';
    const currentPhoneValue =
      typeof currentPhone === 'string' ? currentPhone.trim() : '';
    const shouldUpdatePhone = phoneValue !== currentPhoneValue;
    const effectivePhoneValue = shouldUpdatePhone
      ? phoneValue
      : currentPhoneValue;

    if (marketingSms && !effectivePhoneValue.length) {
      return data(
        {
          error:
            'Please add a phone number and then try subscribing to SMS again.',
          customer: null,
        },
        {status: 400},
      );
    }

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

    const customerId =
      mutationData.customerUpdate.customer.id ||
      (typeof formCustomerId === 'string' ? formCustomerId : '');
    if (!customerId) {
      throw new Error('Missing customer ID for profile updates.');
    }

    let updatedCustomer = mutationData?.customerUpdate?.customer ?? null;
    let actionError: string | null = null;

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
        actionError = marketingErrors[0]?.message ?? actionError;
      }
    }

    if (marketingSms !== currentMarketingSms || shouldUpdatePhone) {
      const adminToken = context.env.SHOPIFY_ADMIN_TOKEN;
      const storeDomain = context.env.PUBLIC_STORE_DOMAIN;
      const adminDomainEnv = context.env.SHOPIFY_ADMIN_DOMAIN;

      if (!adminToken) {
        actionError =
          'SHOPIFY_ADMIN_TOKEN is not set. Phone and SMS updates require an Admin API access token with write_customers scope.';
      } else if (!storeDomain) {
        actionError =
          'PUBLIC_STORE_DOMAIN is not set. Phone and SMS updates require an Admin API access token with write_customers scope.';
      } else {
        const sanitizedStoreDomain = storeDomain.replace(/^https?:\/\//, '');
        const adminDomain =
          adminDomainEnv?.replace(/^https?:\/\//, '') ??
          (sanitizedStoreDomain.includes('myshopify.com')
            ? sanitizedStoreDomain
            : null);
        if (!adminDomain) {
          actionError =
            'Phone and SMS updates require SHOPIFY_ADMIN_DOMAIN for Admin API requests.';
        } else {
          const adminEndpoint = `https://${adminDomain}/admin/api/2025-01/graphql.json`;

          if (shouldUpdatePhone) {
            const phoneResponse = await fetch(adminEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': adminToken,
              },
              body: JSON.stringify({
                query: CUSTOMER_PHONE_UPDATE,
                variables: {
                  input: {
                    id: customerId,
                    phone: phoneValue.length ? phoneValue : null,
                  },
                },
              }),
            });

            const phoneText = await phoneResponse.text();
            if (!phoneResponse.ok) {
              actionError = `Admin API error (${phoneResponse.status}): ${phoneText}`;
            } else {
              let phoneJson: any = {};
              try {
                phoneJson = JSON.parse(phoneText);
              } catch (parseError) {
                actionError = 'Invalid Admin API response.';
              }

              const phoneErrors =
                phoneJson?.data?.customerUpdate?.userErrors ??
                phoneJson?.errors ??
                [];
              if (phoneErrors.length) {
                const rawMessage =
                  phoneErrors[0]?.message ??
                  'Unable to update customer phone number.';
                actionError = rawMessage.includes('write_customers')
                  ? 'Phone updates require an Admin API access token with write_customers scope.'
                  : rawMessage;
              }
            }
          }

          const shouldUpdateSmsConsent =
            (marketingSms && (shouldUpdatePhone || marketingSms !== currentMarketingSms)) ||
            (!marketingSms &&
              !shouldUpdatePhone &&
              marketingSms !== currentMarketingSms);

          if (!actionError && shouldUpdateSmsConsent) {
            const smsResponse = await fetch(adminEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': adminToken,
              },
              body: JSON.stringify({
                query: CUSTOMER_SMS_MARKETING_UPDATE,
                variables: {
                  input: {
                    customerId,
                    smsMarketingConsent: {
                      marketingState: marketingSms
                        ? 'SUBSCRIBED'
                        : 'UNSUBSCRIBED',
                      marketingOptInLevel: 'SINGLE_OPT_IN',
                    },
                  },
                },
              }),
            });

            const smsText = await smsResponse.text();
            if (!smsResponse.ok) {
              actionError = `Admin API error (${smsResponse.status}): ${smsText}`;
            } else {
              let smsJson: any = {};
              try {
                smsJson = JSON.parse(smsText);
              } catch (parseError) {
                actionError = 'Invalid Admin API response.';
              }

              const smsErrors =
                smsJson?.data?.customerSmsMarketingConsentUpdate?.userErrors ??
                smsJson?.errors ??
                [];
              if (smsErrors.length) {
                actionError =
                  smsErrors[0]?.message ??
                  'Unable to update SMS marketing consent.';
              }
            }
          }
        }
      }
    }

    if (shouldUpdatePhone && updatedCustomer) {
      updatedCustomer = {
        ...updatedCustomer,
        phoneNumber: phoneValue.length
          ? {
              phoneNumber: phoneValue,
              marketingState: updatedCustomer.phoneNumber?.marketingState,
            }
          : null,
      };
    }

    return data(
      {
        error: actionError,
        customer: updatedCustomer,
        marketingEmail,
        marketingSms,
      },
      {
        status: actionError ? 400 : 200,
      },
    );
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
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const navigation = useNavigation();
  const {state} = navigation;
  const action = useActionData<ActionResponse>();
  const email = customer?.emailAddress?.emailAddress ?? '';
  const phoneOnFile = customer?.phoneNumber?.phoneNumber ?? '';
  const marketingEmailState = customer?.emailAddress?.marketingState;
  const marketingEmail =
    marketingEmailState === 'SUBSCRIBED' || marketingEmailState === 'PENDING';
  const marketingSmsState = customer?.phoneNumber?.marketingState;
  const marketingSmsOnFile =
    marketingSmsState === 'SUBSCRIBED' || marketingSmsState === 'PENDING';
  const [marketingSms, setMarketingSms] = useState(marketingSmsOnFile);
  const [phone, setPhone] = useState(phoneOnFile);
  const [clientError, setClientError] = useState<string | null>(null);
  const shouldToastOnSuccessRef = useRef(false);

  useEffect(() => {
    setMarketingSms(marketingSmsOnFile);
  }, [marketingSmsOnFile]);

  useEffect(() => {
    if (action?.error) {
      setMarketingSms(marketingSmsOnFile);
    }
  }, [action?.error, marketingSmsOnFile]);

  useEffect(() => {
    setPhone(phoneOnFile);
  }, [phoneOnFile]);

  const phoneOnFileValue = phoneOnFile.trim();

  const handlePhoneChange = ({target}: ChangeEvent<HTMLInputElement>) => {
    const nextPhone = target.value;
    setPhone(nextPhone);
    setClientError(null);

    if (!phoneOnFileValue.length) return;

    if (nextPhone.trim() !== phoneOnFileValue) {
      setMarketingSms(false);
      return;
    }

    setMarketingSms(marketingSmsOnFile);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setClientError(null);

    if (marketingSms && !phone.trim().length) {
      event.preventDefault();
      setClientError(
        'Please add a phone number and then try subscribing to SMS again.',
      );
      shouldToastOnSuccessRef.current = false;
      return;
    }

    const form = event.currentTarget;
    const firstNameValue =
      (form.elements.namedItem('firstName') as HTMLInputElement | null)?.value ??
      '';
    const lastNameValue =
      (form.elements.namedItem('lastName') as HTMLInputElement | null)?.value ??
      '';
    const marketingEmailChecked =
      (
        form.elements.namedItem('marketingEmail') as HTMLInputElement | null
      )?.checked ?? marketingEmail;

    shouldToastOnSuccessRef.current =
      firstNameValue.trim() !== (customer.firstName ?? '').trim() ||
      lastNameValue.trim() !== (customer.lastName ?? '').trim() ||
      phone.trim() !== phoneOnFileValue ||
      marketingEmailChecked !== marketingEmail ||
      marketingSms !== marketingSmsOnFile;
  };

  const errorMessage = clientError ?? action?.error ?? null;

  useEffect(() => {
    if (navigation.state !== 'idle') return;
    if (!action) return;

    if (action.error) {
      shouldToastOnSuccessRef.current = false;
      return;
    }

    if (shouldToastOnSuccessRef.current) {
      toast.success('Account updated');
      shouldToastOnSuccessRef.current = false;
    }
  }, [action, navigation.state]);

  return (
    <>
      <Sectiontitle text="My Profile" />
      <div className="account-profile flex justify-center">
        <Card className="mx-2 mt-3 w-[95%]">
          <div className="p-4">
            <h2>My profile</h2>
          </div>

          <Form method="PUT" onSubmit={handleSubmit}>
            <div className="ps-4">
              <legend>Account information</legend>
            </div>
            <CardContent className="ps-4">
              <fieldset>
                <input type="hidden" name="customerId" value={customer.id} />
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
                  <input
                    type="hidden"
                    name="currentPhone"
                    value={phoneOnFile}
                  />
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="Phone number"
                    aria-label="Phone number"
                    value={phone}
                    onChange={handlePhoneChange}
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
                      value={marketingSmsOnFile ? 'true' : 'false'}
                    />
                    <label
                      htmlFor="marketingSms"
                      className="flex items-center gap-2"
                    >
                      <input
                        id="marketingSms"
                        name="marketingSms"
                        type="checkbox"
                        checked={marketingSms}
                        onChange={(event) => {
                          setClientError(null);
                          setMarketingSms(event.target.checked);
                        }}
                      />
                      Subscribed to SMS news and discounts
                    </label>
                  </div>
                </div>
              </fieldset>
              {errorMessage ? (
                <p>
                  <mark>
                    <small>{errorMessage}</small>
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
