import type {CustomerFragment} from 'customer-accountapi.generated';
import type {CustomerUpdateInput} from '@shopify/hydrogen/customer-account-api-types';
import {
  CUSTOMER_UPDATE_MUTATION,
  CUSTOMER_UPDATE_WISHLIST,
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
};

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

    const birthday = form.get('birthday');
    const marketingEmail = form.get('marketingEmail') === 'on';
    const marketingSms = form.get('marketingSms') === 'on';

    // update customer and possibly password
    const {data, errors} = await customerAccount.mutate(
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

    if (!data?.customerUpdate?.customer) {
      throw new Error('Customer profile update failed.');
    }

    const customerId = data.customerUpdate.customer.id;
    const metafields = [
      ...(birthday && typeof birthday === 'string' && birthday.length
        ? [
            {
              key: 'birthday',
              namespace: 'custom',
              ownerId: customerId,
              type: 'date',
              value: birthday,
            },
          ]
        : []),
      {
        key: 'marketing_email',
        namespace: 'custom',
        ownerId: customerId,
        type: 'boolean',
        value: String(marketingEmail),
      },
      {
        key: 'marketing_sms',
        namespace: 'custom',
        ownerId: customerId,
        type: 'boolean',
        value: String(marketingSms),
      },
    ];

    if (metafields.length) {
      const metafieldResponse = await customerAccount.mutate(
        CUSTOMER_UPDATE_WISHLIST,
        {
          variables: {
            metafields,
          },
        },
      );

      const metafieldErrors =
        metafieldResponse?.data?.metafieldsSet?.userErrors ?? [];
      if (metafieldErrors.length) {
        throw new Error(metafieldErrors[0].message);
      }
    }

    return {
      error: null,
      customer: data?.customerUpdate?.customer,
    };
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
  const birthday = customer?.birthday?.value ?? '';
  const marketingEmail = customer?.marketingEmail?.value === 'true';
  const marketingSms = customer?.marketingSms?.value === 'true';

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
                <label htmlFor="birthday" className="me-2">
                  Birthday:
                </label>
                <div className="py-2">
                  <Input
                    id="birthday"
                    name="birthday"
                    type="date"
                    aria-label="Birthday"
                    defaultValue={birthday}
                    className="w-[250px]"
                  />
                </div>
                <div className="pt-4">
                  <h3>Marketing</h3>
                  <div className="py-2">
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
