import type {CustomerFragment} from 'customer-accountapi.generated';
import type {CustomerUpdateInput} from '@shopify/hydrogen/customer-account-api-types';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
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
  useLoaderData,
  useNavigate,
  useNavigation,
  useOutletContext,
  type MetaFunction,
} from '@remix-run/react';
import {ChevronDown} from 'lucide-react';
import {LuCopy} from 'react-icons/lu';
import {
  type CountryCode,
  getCountries,
  getCountryCallingCode,
  getExampleNumber,
  parsePhoneNumberFromString,
} from 'libphonenumber-js';
import phoneExamples from 'libphonenumber-js/examples.mobile.json';
import {REGEXP_ONLY_DIGITS} from 'input-otp';
import {Card, CardAction, CardContent, CardHeader} from '~/components/ui/card';
import {Button, buttonVariants} from '~/components/ui/button';
import {Input} from '~/components/ui/input';
import {Checkbox} from '~/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '~/components/ui/input-otp';
import Sectiontitle from '~/components/global/Sectiontitle';
import {buildIconLinkPreviewMeta} from '~/lib/linkPreview';
import {
  getAdminCustomerEmailDiscountUsage,
  getCustomerDiscountUsage,
  setCustomerWelcome15UsesRemainingMetafield,
  WELCOME15_DISCOUNT_CODE,
} from '~/lib/customerDiscountUsage.server';
import {cn} from '~/lib/utils';

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

const DEFAULT_PHONE_COUNTRY: CountryCode = 'US';

type CountryPhoneOption = {
  country: CountryCode;
  label: string;
  dialCodeDisplay: string;
  dialDigits: string;
  localLength: number;
  localGroups: number[];
};

function fallbackOtpGroups(totalDigits: number): number[] {
  if (totalDigits <= 0) return [];
  if (totalDigits <= 4) return [totalDigits];
  if (totalDigits === 5) return [2, 3];
  if (totalDigits === 6) return [3, 3];
  if (totalDigits === 7) return [3, 4];
  if (totalDigits === 8) return [4, 4];
  if (totalDigits === 9) return [3, 3, 3];
  if (totalDigits === 10) return [3, 3, 4];
  if (totalDigits === 11) return [3, 4, 4];
  if (totalDigits === 12) return [3, 3, 3, 3];
  if (totalDigits === 13) return [3, 3, 3, 4];
  if (totalDigits === 14) return [3, 3, 4, 4];
  const leading = [3, 3, 3, 4];
  const consumed = leading.reduce((sum, value) => sum + value, 0);
  return [...leading, totalDigits - consumed].filter((value) => value > 0);
}

function deriveOtpGroups(exampleNational: string, totalDigits: number): number[] {
  const groupedDigits = (exampleNational.match(/\d+/g) ?? []).map(
    (group) => group.length,
  );
  if (!groupedDigits.length) {
    return fallbackOtpGroups(totalDigits);
  }
  const groupedTotal = groupedDigits.reduce((sum, value) => sum + value, 0);
  if (groupedTotal !== totalDigits) {
    return fallbackOtpGroups(totalDigits);
  }
  return groupedDigits;
}

function formatLocalDigitsByGroups(localDigits: string, groups: number[]): string {
  if (!localDigits.length) return '';
  const chunks: string[] = [];
  let cursor = 0;
  for (const groupLength of groups) {
    if (cursor >= localDigits.length) break;
    const nextChunk = localDigits.slice(cursor, cursor + groupLength);
    if (!nextChunk.length) break;
    chunks.push(nextChunk);
    cursor += groupLength;
  }
  if (cursor < localDigits.length) {
    chunks.push(localDigits.slice(cursor));
  }
  return chunks.join('-');
}

function buildCombinedPhoneValue(
  option: CountryPhoneOption,
  localDigits: string,
): string {
  if (!localDigits.length) return '';
  const formattedLocal = formatLocalDigitsByGroups(localDigits, option.localGroups);
  return `${option.dialCodeDisplay}-${formattedLocal}`;
}

function resolveInitialPhoneState(phoneValue: string): {
  country: CountryCode;
  localDigits: string;
} {
  const fallbackOption = COUNTRY_PHONE_OPTION_BY_COUNTRY.get(
    DEFAULT_PHONE_COUNTRY,
  ) as CountryPhoneOption;
  const trimmedPhoneValue = phoneValue.trim();
  if (!trimmedPhoneValue.length) {
    return {country: fallbackOption.country, localDigits: ''};
  }

  const parsedPhoneNumber = parsePhoneNumberFromString(trimmedPhoneValue);
  if (parsedPhoneNumber?.country) {
    const parsedCountry = parsedPhoneNumber.country as CountryCode;
    const parsedCountryOption = COUNTRY_PHONE_OPTION_BY_COUNTRY.get(parsedCountry);
    if (parsedCountryOption) {
      return {
        country: parsedCountry,
        localDigits: parsedPhoneNumber.nationalNumber
          .replace(/\D/g, '')
          .slice(0, parsedCountryOption.localLength),
      };
    }
  }

  const normalizedDigits = trimmedPhoneValue.replace(/\D/g, '');
  if (!normalizedDigits.length) {
    return {country: fallbackOption.country, localDigits: ''};
  }

  if (trimmedPhoneValue.startsWith('+')) {
    const prefixMatch = COUNTRY_PHONE_OPTIONS_BY_DIAL_PREFIX.find((option) =>
      normalizedDigits.startsWith(option.dialDigits),
    );
    if (prefixMatch) {
      return {
        country: prefixMatch.country,
        localDigits: normalizedDigits
          .slice(prefixMatch.dialDigits.length)
          .slice(0, prefixMatch.localLength),
      };
    }
  }

  return {
    country: fallbackOption.country,
    localDigits: normalizedDigits.slice(0, fallbackOption.localLength),
  };
}

const regionDisplayNames =
  typeof Intl !== 'undefined' && 'DisplayNames' in Intl
    ? new Intl.DisplayNames(['en'], {type: 'region'})
    : null;

const COUNTRY_PHONE_OPTIONS: CountryPhoneOption[] = getCountries()
  .map((country) => {
    const dialDigits = getCountryCallingCode(country);
    const dialCodeDisplay = `+${dialDigits}`;
    const countryName = regionDisplayNames?.of(country) ?? country;
    const examplePhone = getExampleNumber(country, phoneExamples as any);
    const nationalDigits =
      examplePhone?.nationalNumber?.replace(/\D/g, '') ?? '';
    const localLength = nationalDigits.length || 10;
    const exampleNationalFormat =
      typeof examplePhone?.formatNational === 'function'
        ? examplePhone.formatNational()
        : '';
    const localGroups = deriveOtpGroups(exampleNationalFormat, localLength);

    return {
      country,
      label: countryName,
      dialCodeDisplay,
      dialDigits,
      localLength,
      localGroups,
    };
  })
  .sort((left, right) => {
    if (left.country === DEFAULT_PHONE_COUNTRY) return -1;
    if (right.country === DEFAULT_PHONE_COUNTRY) return 1;
    return left.label.localeCompare(right.label);
  });

const COUNTRY_PHONE_OPTION_BY_COUNTRY = new Map<CountryCode, CountryPhoneOption>(
  COUNTRY_PHONE_OPTIONS.map((option) => [option.country, option]),
);

const COUNTRY_PHONE_OPTIONS_BY_DIAL_PREFIX = [...COUNTRY_PHONE_OPTIONS].sort(
  (left, right) => right.dialDigits.length - left.dialDigits.length,
);

export const meta: MetaFunction = () => {
  return [
    ...buildIconLinkPreviewMeta('Adam Underwater | My Profile'),
    {name: 'robots', content: 'noindex, nofollow'},
  ];
};

const CUSTOMER_ID_QUERY = `#graphql
  query CustomerIdQuery {
    customer {
      id
      emailAddress {
        emailAddress
      }
    }
  }
` as const;

export async function loader({context}: LoaderFunctionArgs) {
  let welcome15Used = false;

  try {
    const {data: customerData} = await context.customerAccount.query(
      CUSTOMER_ID_QUERY,
    );
    const customerId = customerData?.customer?.id;
    const customerEmail = customerData?.customer?.emailAddress?.emailAddress;
    if (!customerId) return {welcome15Used};

    const usageByCustomerOrderHistory = await getCustomerDiscountUsage({
      customerAccount: context.customerAccount,
      code: WELCOME15_DISCOUNT_CODE,
    });
    const usageByCustomerEmail = customerEmail
      ? await getAdminCustomerEmailDiscountUsage({
          env: context.env,
          customerEmail,
          code: WELCOME15_DISCOUNT_CODE,
        })
      : null;

    welcome15Used = Boolean(
      usageByCustomerOrderHistory?.used || usageByCustomerEmail?.used,
    );

    await setCustomerWelcome15UsesRemainingMetafield({
      env: context.env,
      customerId,
      usesRemaining: welcome15Used ? 0 : 1,
    }).catch(() => null);
  } catch {
    // Silently fail — default to not used
  }

  return {welcome15Used};
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
  const {welcome15Used} = useLoaderData<typeof loader>();
  const {customer} = useOutletContext<{customer: CustomerFragment | null}>();
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
  const [marketingEmailSubscribed, setMarketingEmailSubscribed] =
    useState(marketingEmail);
  const [marketingSms, setMarketingSms] = useState(marketingSmsOnFile);
  const initialPhoneState = resolveInitialPhoneState(phoneOnFile);
  const [selectedPhoneCountry, setSelectedPhoneCountry] = useState<CountryCode>(
    initialPhoneState.country,
  );
  const [phoneLocalDigits, setPhoneLocalDigits] = useState(
    initialPhoneState.localDigits,
  );
  const [clientError, setClientError] = useState<string | null>(null);
  const shouldToastOnSuccessRef = useRef(false);
  const navigate = useNavigate();
  const [codeCopied, setCodeCopied] = useState(false);
  const [copySplashActive, setCopySplashActive] = useState(false);
  const copyLabelTimerRef = useRef<number | null>(null);
  const copySplashStartTimerRef = useRef<number | null>(null);
  const copySplashStopTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setMarketingEmailSubscribed(marketingEmail);
  }, [marketingEmail]);

  useEffect(() => {
    setMarketingSms(marketingSmsOnFile);
  }, [marketingSmsOnFile]);

  useEffect(() => {
    if (action?.error) {
      setMarketingEmailSubscribed(marketingEmail);
      setMarketingSms(marketingSmsOnFile);
    }
  }, [action?.error, marketingEmail, marketingSmsOnFile]);

  useEffect(() => {
    const nextPhoneState = resolveInitialPhoneState(phoneOnFile);
    setSelectedPhoneCountry(nextPhoneState.country);
    setPhoneLocalDigits(nextPhoneState.localDigits);
  }, [phoneOnFile]);

  const phoneOnFileValue = phoneOnFile.trim();
  const selectedPhoneOption =
    COUNTRY_PHONE_OPTION_BY_COUNTRY.get(selectedPhoneCountry) ??
    (COUNTRY_PHONE_OPTION_BY_COUNTRY.get(DEFAULT_PHONE_COUNTRY) as CountryPhoneOption);
  const clampedPhoneLocalDigits = phoneLocalDigits.slice(
    0,
    selectedPhoneOption.localLength,
  );
  const phoneValue = buildCombinedPhoneValue(
    selectedPhoneOption,
    clampedPhoneLocalDigits,
  );

  useEffect(() => {
    if (phoneLocalDigits.length <= selectedPhoneOption.localLength) return;
    setPhoneLocalDigits((currentDigits) =>
      currentDigits.slice(0, selectedPhoneOption.localLength),
    );
  }, [phoneLocalDigits.length, selectedPhoneOption.localLength]);

  const syncMarketingSmsForPhoneValue = (nextCombinedPhoneValue: string) => {
    if (!phoneOnFileValue.length) return;
    if (nextCombinedPhoneValue.trim() !== phoneOnFileValue) {
      setMarketingSms(false);
      return;
    }
    setMarketingSms(marketingSmsOnFile);
  };

  const handlePhoneCountrySelect = (nextCountry: CountryCode) => {
    const nextCountryOption = COUNTRY_PHONE_OPTION_BY_COUNTRY.get(nextCountry);
    if (!nextCountryOption) return;

    const nextLocalDigits = clampedPhoneLocalDigits.slice(
      0,
      nextCountryOption.localLength,
    );
    setSelectedPhoneCountry(nextCountry);
    setPhoneLocalDigits(nextLocalDigits);
    setClientError(null);
    syncMarketingSmsForPhoneValue(
      buildCombinedPhoneValue(nextCountryOption, nextLocalDigits),
    );
  };

  const handlePhoneLocalDigitsChange = (nextOtpValue: string) => {
    const nextDigits = nextOtpValue
      .replace(/\D/g, '')
      .slice(0, selectedPhoneOption.localLength);
    setPhoneLocalDigits(nextDigits);
    setClientError(null);
    syncMarketingSmsForPhoneValue(
      buildCombinedPhoneValue(selectedPhoneOption, nextDigits),
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    setClientError(null);

    if (marketingSms && !phoneValue.trim().length) {
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
    shouldToastOnSuccessRef.current =
      firstNameValue.trim() !== (customer.firstName ?? '').trim() ||
      lastNameValue.trim() !== (customer.lastName ?? '').trim() ||
      phoneValue.trim() !== phoneOnFileValue ||
      marketingEmailSubscribed !== marketingEmail ||
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

  if (!customer) {
    return (
      <>
        <Sectiontitle text="My Profile" />
        <p className="text-center mt-3">Sign in to view your profile details.</p>
      </>
    );
  }

  return (
    <>
      <Sectiontitle text="My Profile" />
      <div className="account-profile flex justify-center">
        <Card className="mx-2 mt-3 w-[95%]">

          <Form method="PUT" onSubmit={handleSubmit}>
            <div className="ps-4 pt-4">
              <h3 className="text-lg font-semibold mb-3">Account Information</h3>
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
                    className="w-[250px] focus-visible:border-primary focus-visible:ring-primary/50"
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
                    className="w-[250px] focus-visible:border-primary focus-visible:ring-primary/50"
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
                    className="w-[250px] focus-visible:border-primary focus-visible:ring-primary/50"
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
                  <input type="hidden" name="phone" value={phoneValue} />
                  <div className="flex flex-wrap items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className={cn(
                            buttonVariants({variant: 'outline', size: 'sm'}),
                            'h-7 justify-center gap-[2px] px-1 text-xs focus-visible:border-primary focus-visible:ring-primary/50',
                          )}
                        >
                          <span>{selectedPhoneOption.dialCodeDisplay}</span>
                          <ChevronDown className="size-3.5 opacity-70" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="max-h-72 w-[280px]"
                      >
                        <DropdownMenuRadioGroup
                          value={selectedPhoneCountry}
                          onValueChange={(nextValue) =>
                            handlePhoneCountrySelect(nextValue as CountryCode)
                          }
                        >
                          {COUNTRY_PHONE_OPTIONS.map((option) => (
                            <DropdownMenuRadioItem
                              key={option.country}
                              value={option.country}
                            >
                              {option.label} {option.dialCodeDisplay}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <InputOTPSeparator className="[&_svg]:h-4 [&_svg]:w-2" />

                    <InputOTP
                      id="phone"
                      value={clampedPhoneLocalDigits}
                      onChange={handlePhoneLocalDigitsChange}
                      maxLength={selectedPhoneOption.localLength}
                      containerClassName="gap-0.5"
                      autoComplete="tel-national"
                      pattern={REGEXP_ONLY_DIGITS}
                      inputMode="numeric"
                      aria-label="Phone number"
                    >
                      {(() => {
                        let runningSlotIndex = 0;
                        return selectedPhoneOption.localGroups.map(
                          (groupLength, groupPosition) => {
                            const groupStartIndex = runningSlotIndex;
                            runningSlotIndex += groupLength;
                            const slotIndexes = Array.from(
                              {length: groupLength},
                              (_, slotOffset) => groupStartIndex + slotOffset,
                            );
                            return (
                            <Fragment
                              key={`${selectedPhoneCountry}-group-${groupStartIndex}-${groupLength}`}
                            >
                              <InputOTPGroup>
                                {slotIndexes.map((slotIndex) => (
                                  <InputOTPSlot
                                    key={`${selectedPhoneCountry}-slot-${slotIndex}`}
                                    index={slotIndex}
                                    className="h-7 w-7 text-xs"
                                  />
                                ))}
                              </InputOTPGroup>
                              {groupPosition <
                                selectedPhoneOption.localGroups.length - 1 && (
                                <InputOTPSeparator className="[&_svg]:h-4 [&_svg]:w-2" />
                              )}
                            </Fragment>
                          );
                          },
                        );
                      })()}
                    </InputOTP>
                  </div>
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
                        type="hidden"
                        name="marketingEmail"
                        value={marketingEmailSubscribed ? 'on' : ''}
                      />
                      <Checkbox
                        id="marketingEmail"
                        checked={marketingEmailSubscribed}
                        onCheckedChange={(checked) => {
                          setClientError(null);
                          setMarketingEmailSubscribed(checked === true);
                        }}
                        className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
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
                        type="hidden"
                        name="marketingSms"
                        value={marketingSms ? 'on' : ''}
                      />
                      <Checkbox
                        id="marketingSms"
                        checked={marketingSms}
                        onCheckedChange={(checked) => {
                          setClientError(null);
                          setMarketingSms(checked === true);
                        }}
                        className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
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

          <div className="account-profile-discount-divider" />

          <div className="account-profile-discount-section">
            <h3 className="text-lg font-semibold mb-3">Discount Code</h3>
            {marketingEmail && marketingSmsOnFile ? (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Thanks for subscribing! Here&rsquo;s your exclusive one-time discount
                  code:
                </p>
                <div className="review-discount-revealed-row">
                  <div className="invisible-ink-wrapper">
                    <span className="invisible-ink-text invisible-ink-text--revealed invisible-ink-text--large">
                      WELCOME15
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText('WELCOME15');
                      setCodeCopied(true);
                      setCopySplashActive(false);

                      if (copyLabelTimerRef.current) {
                        window.clearTimeout(copyLabelTimerRef.current);
                      }
                      if (copySplashStartTimerRef.current) {
                        window.clearTimeout(copySplashStartTimerRef.current);
                      }
                      if (copySplashStopTimerRef.current) {
                        window.clearTimeout(copySplashStopTimerRef.current);
                      }

                      copySplashStartTimerRef.current = window.setTimeout(
                        () => setCopySplashActive(true),
                        0,
                      );
                      copySplashStopTimerRef.current = window.setTimeout(
                        () => setCopySplashActive(false),
                        900,
                      );
                      copyLabelTimerRef.current = window.setTimeout(
                        () => setCodeCopied(false),
                        3000,
                      );

                      toast.success('Copied to Clipboard!', {
                        action: {
                          label: 'Browse Products',
                          onClick: () => navigate('/prints'),
                        },
                      });
                    }}
                    className={`review-discount-copy-btn${
                      copySplashActive
                        ? ' review-discount-copy-btn--splash'
                        : ''
                    }`}
                    aria-label="Copy discount code"
                  >
                    <LuCopy
                      className="review-discount-copy-icon"
                      aria-hidden="true"
                    />
                    <span>{codeCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <li className="text-xs text-muted-foreground mt-2">
                  Uses remaining: {welcome15Used ? '0' : '1'}
                </li>
                <li className="text-xs text-muted-foreground mt-2">
                  15% off your entire order. Enter this code at checkout. One
                  use per customer.
                </li>
                <li className="text-xs text-muted-foreground mt-2">
                  Cannot be combined with other discounts
                </li>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-3">
                  Subscribe to marketing emails and SMS to reveal!
                </p>
                <div className="invisible-ink-wrapper">
                  <span className="invisible-ink-text invisible-ink-text--large">WELCOME15</span>
                  <div className="invisible-ink-overlay" />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Uses remaining: {welcome15Used ? '0' : '1'}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Check both marketing boxes above and hit Update to unlock your
                  discount code.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
