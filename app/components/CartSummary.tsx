import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Money, type OptimisticCart} from '@shopify/hydrogen';
import {useRef, useState} from 'react';
import {FetcherWithComponents, Link, redirect} from '@remix-run/react';
import {Card, CardAction, CardContent, CardHeader} from './ui/card';
import {Input} from './ui/input';
import {Button} from './ui/button';
import StockForm from './form/StockForm';

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
};

export function CartSummary({cart, layout}: CartSummaryProps) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';
  // const [isOrderReady, setIsOrderReady] = useState(defaultOrderValue);
  // const defaultOrderValue = includesEProducts ? false : true;

  return (
    <>
      <div aria-labelledby="cart-summary" className={className}>
        <Card>
          <CardHeader>
            <h4>Totals</h4>
          </CardHeader>
          <CardContent>
            <dl className="cart-subtotal">
              <dt>Subtotal:</dt>
              <dd>
                {cart.cost?.subtotalAmount?.amount ? (
                  <Money
                    data={cart.cost?.subtotalAmount}
                    className="text-lg font-bold ms-1"
                  />
                ) : (
                  '-'
                )}
              </dd>
            </dl>
            <br />
            <CartDiscounts discountCodes={cart.discountCodes} />
            <CartGiftCard giftCardCodes={cart.appliedGiftCards} />
          </CardContent>
        </Card>
      </div>

      <p className="flex justify-center pt-7 px-8">
        Please fill out the stock footage licensing form below.
      </p>

      <div className="flex items-center justify-center pt-7 gap-2">
        <StockForm updateCheck={true} />
        <div>hi</div>
      </div>
      <p className="flex justify-center pt-7 px-8">
        products will be downloaded immediately and a download code will be sent
        via email.
      </p>
      <div className="flex justify-center">
        <div className="p-5">
          <CartCheckoutActions checkoutUrl={cart.checkoutUrl} />
        </div>
      </div>
    </>
  );
}
function CartCheckoutActions({checkoutUrl}: {checkoutUrl?: string}) {
  if (!checkoutUrl) return null;

  return (
    // <div>
    //   <a href={checkoutUrl} target="_self">
    //     <p>Continue to Checkout &rarr;</p>
    //   </a>
    //   <br />
    // </div>
    <Button variant="default" className="mb-4">
      <Link to={checkoutUrl}>Continue to Checkout &rarr;</Link>
    </Button>
  );
}

function CartDiscounts({
  discountCodes,
}: {
  discountCodes?: CartApiQueryFragment['discountCodes'];
}) {
  const codes: string[] =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({code}) => code) || [];

  return (
    <div>
      {/* Have existing discount, display it with a remove option */}
      <dl hidden={!codes.length}>
        <div>
          <dt>Applied Discounts:</dt>
          <UpdateDiscountForm>
            <div className="cart-discount py-3">
              <code>{codes?.join(', ')}</code>
              &nbsp;&nbsp;
              <Button variant="outline">Remove</Button>
            </div>
          </UpdateDiscountForm>
        </div>
      </dl>

      {/* Show an input to apply a discount */}
      <UpdateDiscountForm discountCodes={codes}>
        <div className="flex justify-start">
          <Input
            type="text"
            name="discountCode"
            placeholder="Discount code"
            className="w-[180px]"
          />
          &nbsp;
          <Button
            type="submit"
            className="cursor-pointer ms-2"
            variant="outline"
          >
            Apply
          </Button>
        </div>
      </UpdateDiscountForm>
    </div>
  );
}

function UpdateDiscountForm({
  discountCodes,
  children,
}: {
  discountCodes?: string[];
  children: React.ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
    >
      {children}
    </CartForm>
  );
}

function CartGiftCard({
  giftCardCodes,
}: {
  giftCardCodes: CartApiQueryFragment['appliedGiftCards'] | undefined;
}) {
  const appliedGiftCardCodes = useRef<string[]>([]);
  const giftCardCodeInput = useRef<HTMLInputElement>(null);
  const codes: string[] =
    giftCardCodes?.map(({lastCharacters}) => `***${lastCharacters}`) || [];

  function saveAppliedCode(code: string) {
    const formattedCode = code.replace(/\s/g, ''); // Remove spaces
    if (!appliedGiftCardCodes.current.includes(formattedCode)) {
      appliedGiftCardCodes.current.push(formattedCode);
    }
    giftCardCodeInput.current!.value = '';
  }

  function removeAppliedCode() {
    appliedGiftCardCodes.current = [];
  }

  return (
    <div>
      {/* Have existing gift card applied, display it with a remove option */}
      <dl hidden={!codes.length}>
        <div>
          <dt>Applied Gift Card(s)</dt>
          <UpdateGiftCardForm>
            <div className="cart-discount">
              <code>{codes?.join(', ')}</code>
              &nbsp;
              <Button onSubmit={() => removeAppliedCode} variant="secondary">
                Remove
              </Button>
            </div>
          </UpdateGiftCardForm>
        </div>
      </dl>

      {/* Show an input to apply a discount */}
      <UpdateGiftCardForm
        giftCardCodes={appliedGiftCardCodes.current}
        saveAppliedCode={saveAppliedCode}
      >
        <div className="flex justify-start pt-3">
          <Input
            type="text"
            name="giftCardCode"
            placeholder="Gift card code"
            ref={giftCardCodeInput}
            className="w-[180px]"
          />
          &nbsp;
          <Button
            type="submit"
            className="cursor-pointer ms-2"
            variant="outline"
          >
            Apply
          </Button>
        </div>
      </UpdateGiftCardForm>
    </div>
  );
}

function UpdateGiftCardForm({
  giftCardCodes,
  saveAppliedCode,
  children,
}: {
  giftCardCodes?: string[];
  saveAppliedCode?: (code: string) => void;
  removeAppliedCode?: () => void;
  children: React.ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.GiftCardCodesUpdate}
      inputs={{
        giftCardCodes: giftCardCodes || [],
      }}
    >
      {(fetcher: FetcherWithComponents<any>) => {
        const code = fetcher.formData?.get('giftCardCode');
        if (code && saveAppliedCode) {
          saveAppliedCode(code as string);
        }
        return children;
      }}
    </CartForm>
  );
}
