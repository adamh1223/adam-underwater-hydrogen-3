import type {CustomerAddressInput} from '@shopify/hydrogen/customer-account-api-types';
import type {
  AddressFragment,
  CustomerFragment,
} from 'customer-accountapi.generated';
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
  type Fetcher,
  useLoaderData,
} from '@remix-run/react';
import {
  UPDATE_ADDRESS_MUTATION,
  DELETE_ADDRESS_MUTATION,
  CREATE_ADDRESS_MUTATION,
} from '~/graphql/customer-account/CustomerAddressMutations';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '~/components/ui/card';
import '../styles/routeStyles/addresses.css';
import {Button} from '~/components/ui/button';
import {CUSTOMER_WISHLIST, test} from '~/lib/customerQueries';

export type ActionResponse = {
  addressId?: string | null;
  createdAddress?: AddressFragment;
  defaultAddress?: string | null;
  deletedAddress?: string | null;
  error: Record<AddressFragment['id'], string> | null;
  updatedAddress?: AddressFragment;
};

export const meta: MetaFunction = () => {
  return [{title: 'Favorites'}];
};

export async function loader(args: LoaderFunctionArgs) {
  const {context} = args;
  await context.customerAccount.handleAuthStatus();
  const token = await loadCriticalData(args);
  const customerId = await context.customerAccount.query(test, {});
  console.log(customerId, '19082374091827309581720394871209348id');

  const wishlist = await context.storefront.query(test, {
    variables: {
      token,
    },
  });
  console.log(wishlist, '1111111111111111111');
  return {...wishlist};
}
async function loadCriticalData({context}: LoaderFunctionArgs) {
  const token = await context.customerAccount.getAccessToken();

  return token;
}
// async function loadDeferredData({context}: LoaderFunctionArgs) {
//   const token = await context.customerAccount.getAccessToken();
//   const recommendedProducts = context.storefront
//     .query(CUSTOMER_WISHLIST, {
//       variables: {
//         token,
//       },
//     })
//     .catch((error) => {
//       // Log query errors, but don't throw them so the page can still render
//       console.error(error, '00000000000000000000000000000000000000000000000');
//       return null;
//     });

//   return {
//     recommendedProducts,
//   };
// }
export async function action({request, context}: ActionFunctionArgs) {
  const {customerAccount} = context;
}

export default function Addresses() {
  const {customer} = useOutletContext<{customer: CustomerFragment}>();
  const data = useLoaderData<typeof loader>();
  const {defaultAddress, addresses} = customer;

  console.log(customer.id, '2000');
  console.log(data, '20001');
  return (
    <>
      <div>stuff</div>
    </>
  );
}

function NewAddressForm() {
  const newAddress = {
    address1: '',
    address2: '',
    city: '',
    company: '',
    territoryCode: '',
    firstName: '',
    id: 'new',
    lastName: '',
    phoneNumber: '',
    zoneCode: '',
    zip: '',
  } as CustomerAddressInput;

  return (
    <AddressForm
      addressId={'NEW_ADDRESS_ID'}
      address={newAddress}
      defaultAddress={null}
    >
      {({stateForMethod}) => (
        <div>
          <Button
            variant="default"
            disabled={stateForMethod('POST') !== 'idle'}
            formMethod="POST"
            type="submit"
          >
            {stateForMethod('POST') !== 'idle' ? 'Creating' : 'Create'}
          </Button>
        </div>
      )}
    </AddressForm>
  );
}

function ExistingAddresses({
  addresses,
  defaultAddress,
}: Pick<CustomerFragment, 'addresses' | 'defaultAddress'>) {
  return (
    <div>
      <legend>Existing addresses</legend>
      {addresses.nodes.map((address) => (
        <AddressForm
          key={address.id}
          addressId={address.id}
          address={address}
          defaultAddress={defaultAddress}
        >
          {({stateForMethod}) => (
            <div className="flex justify-start">
              <Button
                variant="ghost"
                disabled={stateForMethod('PUT') !== 'idle'}
                formMethod="PUT"
                type="submit"
              >
                {stateForMethod('PUT') !== 'idle' ? 'Saving' : 'Save'}
              </Button>
              <Button
                variant="ghost"
                disabled={stateForMethod('DELETE') !== 'idle'}
                formMethod="DELETE"
                type="submit"
              >
                {stateForMethod('DELETE') !== 'idle' ? 'Deleting' : 'Delete'}
              </Button>
            </div>
          )}
        </AddressForm>
      ))}
    </div>
  );
}

export function AddressForm({
  addressId,
  address,
  defaultAddress,
  children,
}: {
  addressId: AddressFragment['id'];
  address: CustomerAddressInput;
  defaultAddress: CustomerFragment['defaultAddress'];
  children: (props: {
    stateForMethod: (method: 'PUT' | 'POST' | 'DELETE') => Fetcher['state'];
  }) => React.ReactNode;
}) {
  const data = useLoaderData<typeof loader>();
  const {state, formMethod} = useNavigation();
  const action = useActionData<ActionResponse>();
  const error = action?.error?.[addressId];
  const isDefaultAddress = defaultAddress?.id === addressId;
  return (
    <Card className="p-5 my-5 me-5">
      <Form id={addressId}>
        <fieldset className="new-address">
          <input type="hidden" name="addressId" defaultValue={addressId} />
          <label htmlFor="firstName">First name*</label>
          <input
            aria-label="First name"
            autoComplete="given-name"
            defaultValue={address?.firstName ?? ''}
            id="firstName"
            name="firstName"
            placeholder="First name"
            required
            type="text"
          />
          <label htmlFor="lastName">Last name*</label>
          <input
            aria-label="Last name"
            autoComplete="family-name"
            defaultValue={address?.lastName ?? ''}
            id="lastName"
            name="lastName"
            placeholder="Last name"
            required
            type="text"
          />
          <label htmlFor="company">Company</label>
          <input
            aria-label="Company"
            autoComplete="organization"
            defaultValue={address?.company ?? ''}
            id="company"
            name="company"
            placeholder="Company"
            type="text"
          />
          <label htmlFor="address1">Address line*</label>
          <input
            aria-label="Address line 1"
            autoComplete="address-line1"
            defaultValue={address?.address1 ?? ''}
            id="address1"
            name="address1"
            placeholder="Address line 1*"
            required
            type="text"
          />
          <label htmlFor="address2">Address line 2</label>
          <input
            aria-label="Address line 2"
            autoComplete="address-line2"
            defaultValue={address?.address2 ?? ''}
            id="address2"
            name="address2"
            placeholder="Address line 2"
            type="text"
          />
          <label htmlFor="city">City*</label>
          <input
            aria-label="City"
            autoComplete="address-level2"
            defaultValue={address?.city ?? ''}
            id="city"
            name="city"
            placeholder="City"
            required
            type="text"
          />
          <label htmlFor="zoneCode">State / Province*</label>
          <input
            aria-label="State/Province"
            autoComplete="address-level1"
            defaultValue={address?.zoneCode ?? ''}
            id="zoneCode"
            name="zoneCode"
            placeholder="State / Province"
            required
            type="text"
          />
          <label htmlFor="zip">Zip / Postal Code*</label>
          <input
            aria-label="Zip"
            autoComplete="postal-code"
            defaultValue={address?.zip ?? ''}
            id="zip"
            name="zip"
            placeholder="Zip / Postal Code"
            required
            type="text"
          />
          <label htmlFor="territoryCode">Country Code*</label>
          <input
            aria-label="territoryCode"
            autoComplete="country"
            defaultValue={address?.territoryCode ?? ''}
            id="territoryCode"
            name="territoryCode"
            placeholder="Country"
            required
            type="text"
            maxLength={2}
          />
          <label htmlFor="phoneNumber">Phone</label>
          <input
            aria-label="Phone Number"
            autoComplete="tel"
            defaultValue={address?.phoneNumber ?? ''}
            id="phoneNumber"
            name="phoneNumber"
            placeholder="+16135551111"
            pattern="^\+?[1-9]\d{3,14}$"
            type="tel"
          />
          <div className="my-5">
            <input
              defaultChecked={isDefaultAddress}
              id="defaultAddress"
              name="defaultAddress"
              type="checkbox"
            />
            <label htmlFor="defaultAddress" className="ps-1">
              Set as default address
            </label>
          </div>
          {error ? (
            <p>
              <mark>
                <small>{error}</small>
              </mark>
            </p>
          ) : (
            <br />
          )}
          {children({
            stateForMethod: (method) =>
              formMethod === method ? state : 'idle',
          })}
        </fieldset>
      </Form>
    </Card>
  );
}
