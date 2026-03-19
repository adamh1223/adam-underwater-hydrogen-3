import type {CartApiQueryFragment} from 'storefrontapi.generated';
import type {CartLayout} from '~/components/CartMain';
import {CartForm, Money, type OptimisticCart} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import type {CartPendingLinePreview} from '~/lib/cartPendingLine';
import {
  FetcherWithComponents,
  Link,
  useRouteLoaderData,
} from '@remix-run/react';
import {Card, CardContent} from './ui/card';
import {Input} from './ui/input';
import {Button} from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import StockForm from './form/StockForm';
import type {RootLoader} from '~/root';
import {CartDiscountProgress} from './CartDiscountProgress';
import {REVIEW_MEDIA_DISCOUNT_CODE} from '~/lib/reviewMediaDiscountReward';

type CartSummaryProps = {
  cart: OptimisticCart<CartApiQueryFragment | null>;
  layout: CartLayout;
  pendingLinePreviews?: CartPendingLinePreview[];
};
type CartSummaryMoney = CartApiQueryFragment['cost']['subtotalAmount'];
type CartLineNode = OptimisticCart<CartApiQueryFragment | null>['lines']['nodes'][number];
type EffectiveSummaryLine = {
  merchandiseId: string;
  quantity: number;
  tags: string[];
  subtotalBeforeDiscount: number;
  subtotalAfterDiscount: number;
  compareAtPerQuantity: number;
  hasServerDiscount: boolean;
};
type ActiveDiscountEntry = {
  label: string;
  savingsAmount: number;
  isShipping: boolean;
};

type CartDiscountAllocation = {
  __typename?: string;
  targetType?: string;
  code?: string;
  title?: string;
  discountedAmount?: {
    amount?: string;
    currencyCode?: string;
  };
};

function parseMoneyAmount(amount?: string | null) {
  const numericAmount = Number(amount);
  return Number.isFinite(numericAmount) ? numericAmount : 0;
}

function createMoneyValue(
  amount: number,
  currencyCode: CartSummaryMoney['currencyCode'],
): CartSummaryMoney {
  return {
    amount: amount.toFixed(2),
    currencyCode,
  };
}

function getDiscountLabel(allocation: CartDiscountAllocation) {
  switch (allocation.__typename) {
    case 'CartAutomaticDiscountAllocation':
    case 'CartCustomDiscountAllocation':
      return allocation.title ?? '';
    case 'CartCodeDiscountAllocation':
      return allocation.code ?? '';
    default:
      return '';
  }
}

function isShippingDiscount(allocation: CartDiscountAllocation) {
  const label = getDiscountLabel(allocation).toLowerCase();
  return (
    allocation.targetType === 'SHIPPING_LINE' || label.includes('free shipping')
  );
}

function isLineOptimistic(line: CartLineNode) {
  return Boolean((line as {isOptimistic?: boolean}).isOptimistic);
}

function lineSubtotalBeforeDiscount(line: CartLineNode) {
  const subtotal = parseMoneyAmount(
    (
      line as unknown as {
        cost?: {subtotalAmount?: {amount?: string | null}};
      }
    )?.cost?.subtotalAmount?.amount,
  );
  if (subtotal > 0.0001) return subtotal;
  return parseMoneyAmount(line?.cost?.totalAmount?.amount);
}

function lineCompareAtPerQuantity(line: CartLineNode) {
  return parseMoneyAmount(
    (
      line as unknown as {
        cost?: {compareAtAmountPerQuantity?: {amount?: string | null}};
      }
    )?.cost?.compareAtAmountPerQuantity?.amount,
  );
}

function lineTags(line: CartLineNode) {
  return Array.isArray(line?.merchandise?.product?.tags)
    ? line.merchandise.product.tags
    : [];
}

function isPrintLine(tags: string[]) {
  return tags.some((tag) => {
    const loweredTag = tag?.toLowerCase?.() ?? '';
    return loweredTag === 'prints' || loweredTag.includes('print');
  });
}

function isStockClipLine(tags: string[]) {
  if (isPrintLine(tags)) return false;
  const loweredTags = tags.map((tag) => tag.toLowerCase());
  if (loweredTags.includes('bundle')) return false;
  return true;
}

function isStockBundleLine(tags: string[]) {
  if (isPrintLine(tags)) return false;
  const loweredTags = tags.map((tag) => tag.toLowerCase());
  return loweredTags.includes('bundle');
}

export function CartSummary({
  cart,
  layout,
  pendingLinePreviews = [],
}: CartSummaryProps) {
  const rootData = useRouteLoaderData<RootLoader>('root');
  const isAdmin = Boolean(rootData?.isAdmin);
  const pendingPreviewByMerchandiseId = new Map(
    pendingLinePreviews.map((preview) => [preview.merchandiseId, preview] as const),
  );
  const cartMerchandiseIds = new Set(
    cart.lines.nodes.map((line) => line.merchandise.id),
  );

  const effectiveSummaryLines: EffectiveSummaryLine[] = cart.lines.nodes.map((line) => {
    const pendingPreview = pendingPreviewByMerchandiseId.get(line.merchandise.id);
    const usePendingPreviewForAmounts = Boolean(
      pendingPreview && isLineOptimistic(line),
    );

    const subtotalAfterDiscount = usePendingPreviewForAmounts
      ? parseMoneyAmount(pendingPreview?.priceAmount)
      : parseMoneyAmount(line?.cost?.totalAmount?.amount);
    const subtotalBeforeDiscount = usePendingPreviewForAmounts
      ? subtotalAfterDiscount
      : lineSubtotalBeforeDiscount(line);
    const compareAtPerQuantity = usePendingPreviewForAmounts
      ? parseMoneyAmount(pendingPreview?.compareAtAmount)
      : lineCompareAtPerQuantity(line);
    const tags = usePendingPreviewForAmounts
      ? (pendingPreview?.productTags ?? lineTags(line))
      : lineTags(line);

    return {
      merchandiseId: line.merchandise.id,
      quantity: line?.quantity ?? 1,
      tags,
      subtotalBeforeDiscount,
      subtotalAfterDiscount,
      compareAtPerQuantity,
      hasServerDiscount:
        !usePendingPreviewForAmounts &&
        subtotalBeforeDiscount > subtotalAfterDiscount + 0.0001,
    };
  });

  for (const pendingPreview of pendingLinePreviews) {
    if (cartMerchandiseIds.has(pendingPreview.merchandiseId)) continue;

    const pendingSubtotal = parseMoneyAmount(pendingPreview.priceAmount);
    effectiveSummaryLines.push({
      merchandiseId: pendingPreview.merchandiseId,
      quantity: 1,
      tags: pendingPreview.productTags ?? [],
      subtotalBeforeDiscount: pendingSubtotal,
      subtotalAfterDiscount: pendingSubtotal,
      compareAtPerQuantity: parseMoneyAmount(pendingPreview.compareAtAmount),
      hasServerDiscount: false,
    });
  }

  const clipProducts = cart.lines.nodes.filter((item) => {
    return item.merchandise.product.tags?.includes('Video');
  });
  const clipNames = clipProducts.map(
    (product) => product.merchandise.product.title,
  );
  const subtotalCurrencyCode = (cart.cost?.subtotalAmount?.currencyCode ||
    'USD') as CartSummaryMoney['currencyCode'];
  const subtotalAfterServerDiscount = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) =>
      runningTotal + lineItem.subtotalAfterDiscount * lineItem.quantity,
    0,
  );
  const subtotalBeforeDiscount = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) =>
      runningTotal + lineItem.subtotalBeforeDiscount * lineItem.quantity,
    0,
  );
  const printQuantity = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) =>
      runningTotal + (isPrintLine(lineItem.tags) ? lineItem.quantity : 0),
    0,
  );
  const stockClipQuantity = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) =>
      runningTotal + (isStockClipLine(lineItem.tags) ? lineItem.quantity : 0),
    0,
  );
  const stockBundleQuantity = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) =>
      runningTotal + (isStockBundleLine(lineItem.tags) ? lineItem.quantity : 0),
    0,
  );
  const qualifiesForPrintBulkDiscount = printQuantity >= 3;
  const qualifiesForStockBulkDiscount = stockClipQuantity >= 4;
  const qualifiesForStockBundleBulkDiscount = stockBundleQuantity >= 3;

  const provisionalPrintPendingSavings = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) => {
      if (lineItem.hasServerDiscount) return runningTotal;

      const qualifiesForPrint =
        qualifiesForPrintBulkDiscount && isPrintLine(lineItem.tags);
      if (!qualifiesForPrint) return runningTotal;

      return (
        runningTotal + lineItem.subtotalBeforeDiscount * lineItem.quantity * 0.15
      );
    },
    0,
  );
  const provisionalStockPendingSavings = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) => {
      if (lineItem.hasServerDiscount) return runningTotal;

      const qualifiesForStockClip =
        qualifiesForStockBulkDiscount && isStockClipLine(lineItem.tags);
      if (!qualifiesForStockClip) return runningTotal;

      return (
        runningTotal + lineItem.subtotalBeforeDiscount * lineItem.quantity * 0.15
      );
    },
    0,
  );
  const provisionalStockBundlePendingSavings = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) => {
      if (lineItem.hasServerDiscount) return runningTotal;

      const qualifiesForStockBundle =
        qualifiesForStockBundleBulkDiscount && isStockBundleLine(lineItem.tags);
      if (!qualifiesForStockBundle) return runningTotal;

      return (
        runningTotal + lineItem.subtotalBeforeDiscount * lineItem.quantity * 0.18
      );
    },
    0,
  );
  const provisionalPendingSavings =
    provisionalPrintPendingSavings +
    provisionalStockPendingSavings +
    provisionalStockBundlePendingSavings;

  // Calculate order-level code discount savings (e.g. WELCOME15) from CART-level
  // discountAllocations. Order-level discount codes don't populate per-line
  // discountAllocations or reduce line-level cost.totalAmount — they only appear
  // at the cart level.
  const allCartAllocations = ((
    cart as unknown as {discountAllocations?: CartDiscountAllocation[]}
  ).discountAllocations ?? []) as CartDiscountAllocation[];
  const codeDiscountSavings = allCartAllocations.reduce(
    (total, allocation) => {
      if (allocation?.__typename !== 'CartCodeDiscountAllocation') return total;
      if (isShippingDiscount(allocation)) return total;
      return total + parseMoneyAmount(allocation?.discountedAmount?.amount);
    },
    0,
  );

  const subtotalAfterDiscount = Math.max(
    0,
    subtotalAfterServerDiscount - provisionalPendingSavings - codeDiscountSavings,
  );
  const subtotalSavings = Math.max(0, subtotalBeforeDiscount - subtotalAfterDiscount);
  const subtotalCompareAt = effectiveSummaryLines.reduce(
    (runningTotal, lineItem) =>
      runningTotal + lineItem.compareAtPerQuantity * lineItem.quantity,
    0,
  );
  const hasProductDiscountSavings = subtotalSavings > 0.0001;
  const hasCompareAtSubtotal = subtotalCompareAt > 0.0001;
  const subtotalAfterDiscountMoney = createMoneyValue(
    subtotalAfterDiscount,
    subtotalCurrencyCode,
  );
  const subtotalBeforeDiscountMoney = createMoneyValue(
    subtotalBeforeDiscount,
    subtotalCurrencyCode,
  );
  const subtotalSavingsMoney = createMoneyValue(
    subtotalSavings,
    subtotalCurrencyCode,
  );
  const subtotalCompareAtMoney = createMoneyValue(
    subtotalCompareAt,
    subtotalCurrencyCode,
  );

  const allDiscountAllocations = allCartAllocations;
  const printDiscountLabel = 'Buy 3 prints get 15% off';
  const stockDiscountLabel = 'Buy 4 stock footage clips get 15% off';
  const stockBundleDiscountLabel = 'Buy 3 Stock Footage Bundles, get 18% off';
  const productDiscountLabelsFromCart = Array.from(
    new Set(
      allDiscountAllocations
        .filter((allocation) => !isShippingDiscount(allocation))
        .map((allocation) => getDiscountLabel(allocation))
        .filter(Boolean),
    ),
  );
  const hasFreeShippingUnlocked = allDiscountAllocations.some((allocation) =>
    isShippingDiscount(allocation),
  );
  const hasAnyNonShippingDiscountFromCart = productDiscountLabelsFromCart.length > 0;
  const hasAnyNonShippingDiscount = hasAnyNonShippingDiscountFromCart || hasProductDiscountSavings;
  const hasProvisionalFreeShippingUnlocked = subtotalAfterDiscount >= 300;
  const hasEffectiveFreeShippingUnlocked =
    !hasAnyNonShippingDiscount &&
    (hasFreeShippingUnlocked || hasProvisionalFreeShippingUnlocked);

  const activeDiscountSavingsByLabel = new Map<string, ActiveDiscountEntry>();
  function addActiveDiscountEntry({
    label,
    savingsAmount,
    isShipping,
  }: ActiveDiscountEntry) {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return;
    const existingEntry = activeDiscountSavingsByLabel.get(normalizedLabel);
    if (existingEntry) {
      activeDiscountSavingsByLabel.set(normalizedLabel, {
        ...existingEntry,
        savingsAmount: existingEntry.savingsAmount + savingsAmount,
        isShipping: existingEntry.isShipping || isShipping,
      });
      return;
    }
    activeDiscountSavingsByLabel.set(normalizedLabel, {
      label: normalizedLabel,
      savingsAmount,
      isShipping,
    });
  }

  const serverDiscountSavingsBuckets = effectiveSummaryLines.reduce(
    (runningBuckets, lineItem) => {
      const lineSavingsPerQuantity = Math.max(
        0,
        lineItem.subtotalBeforeDiscount - lineItem.subtotalAfterDiscount,
      );
      if (lineSavingsPerQuantity <= 0.0001) return runningBuckets;

      const lineSavingsTotal = lineSavingsPerQuantity * lineItem.quantity;
      const lineDiscountPercent =
        lineItem.subtotalBeforeDiscount > 0.0001
          ? Math.round(
              (lineSavingsPerQuantity / lineItem.subtotalBeforeDiscount) * 100,
            )
          : 0;

      if (isPrintLine(lineItem.tags)) {
        runningBuckets.print += lineSavingsTotal;
        return runningBuckets;
      }

      // Bundles discounted at 18% are tracked as the bundle discount row.
      if (lineDiscountPercent >= 18) {
        runningBuckets.stockBundle += lineSavingsTotal;
        return runningBuckets;
      }

      // Any other non-print discounted stock line belongs to the stock discount row.
      runningBuckets.stock += lineSavingsTotal;
      return runningBuckets;
    },
    {
      print: 0,
      stock: 0,
      stockBundle: 0,
    },
  );
  const effectivePrintDiscountSavings =
    serverDiscountSavingsBuckets.print + provisionalPrintPendingSavings;
  const effectiveStockDiscountSavings =
    serverDiscountSavingsBuckets.stock + provisionalStockPendingSavings;
  const effectiveStockBundleDiscountSavings =
    serverDiscountSavingsBuckets.stockBundle +
    provisionalStockBundlePendingSavings;

  if (effectivePrintDiscountSavings > 0.0001) {
    addActiveDiscountEntry({
      label: printDiscountLabel,
      savingsAmount: effectivePrintDiscountSavings,
      isShipping: false,
    });
  }
  if (effectiveStockDiscountSavings > 0.0001) {
    addActiveDiscountEntry({
      label: stockDiscountLabel,
      savingsAmount: effectiveStockDiscountSavings,
      isShipping: false,
    });
  }
  if (effectiveStockBundleDiscountSavings > 0.0001) {
    addActiveDiscountEntry({
      label: stockBundleDiscountLabel,
      savingsAmount: effectiveStockBundleDiscountSavings,
      isShipping: false,
    });
  }

  const knownProductDiscountLabels = new Set([
    printDiscountLabel,
    stockDiscountLabel,
    stockBundleDiscountLabel,
  ]);

  for (const allocation of allDiscountAllocations) {
    const label = getDiscountLabel(allocation);
    if (!label) continue;
    if (
      knownProductDiscountLabels.has(label) &&
      activeDiscountSavingsByLabel.has(label)
    ) {
      continue;
    }
    addActiveDiscountEntry({
      label,
      savingsAmount: parseMoneyAmount(allocation.discountedAmount?.amount),
      isShipping: isShippingDiscount(allocation),
    });
  }

  let activeDiscountEntries = Array.from(
    activeDiscountSavingsByLabel.values(),
  ).filter((entry) =>
    hasEffectiveFreeShippingUnlocked ? true : !entry.isShipping,
  );

  if (hasProductDiscountSavings) {
    const hasNonShippingEntry = activeDiscountEntries.some(
      (entry) => !entry.isShipping,
    );
    if (!hasNonShippingEntry) {
      activeDiscountEntries = [
        {
          label: 'Discount applied',
          savingsAmount: subtotalSavings,
          isShipping: false,
        },
        ...activeDiscountEntries,
      ];
    }
  }

  if (
    hasEffectiveFreeShippingUnlocked &&
    !activeDiscountEntries.some((entry) => entry.isShipping)
  ) {
    activeDiscountEntries.push({
      label: 'Free shipping unlocked!',
      savingsAmount: 0,
      isShipping: true,
    });
  }

  activeDiscountEntries.sort((entryA, entryB) => {
    if (entryA.isShipping === entryB.isShipping) return 0;
    return entryA.isShipping ? 1 : -1;
  });

  const activeDiscountCount = activeDiscountEntries.length;
  const hasActiveDiscountEntries = activeDiscountCount > 0;
  const showFreeShippingOnlyMessage = hasEffectiveFreeShippingUnlocked;
  const showActiveDiscountTable =
    hasActiveDiscountEntries && !showFreeShippingOnlyMessage;

  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';
  // const [isOrderReady, setIsOrderReady] = useState(defaultOrderValue);
  // const defaultOrderValue = includesEProducts ? false : true;
  const [hideExtraInfo, setHideExtraInfo] = useState(!!clipNames?.length);
  useEffect(() => {
    // might need to bring over
    setHideExtraInfo(!!clipNames?.length);
  }, [clipNames]);
  const [isOrderReady, setIsOrderReady] = useState(!clipNames?.length);

  useEffect(() => {
    if (isOrderReady) {
      const timer = setTimeout(() => {
        setHideExtraInfo(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [isOrderReady]);

  return (
    <>
      <div aria-labelledby="cart-summary" className={className}>
        <Card>
          <div className="p-3">
            <p className="cart-header">Totals</p>
            <hr />
          </div>
          <div className='p-2'>
            <div className="cart-subtotal">
              <p className="cart-header">Subtotal:</p>
              <div className="ms-1">
                {effectiveSummaryLines.length ? (
                  hasProductDiscountSavings ? (
                    <div className="product-price-on-sale cart-subtotal-price-on-sale">
                      <Money
                        data={subtotalAfterDiscountMoney}
                        className="cart-header"
                      />
                      <s className="cart-line-regular-discount-price">
                        <Money data={subtotalBeforeDiscountMoney} />
                      </s>
                      {hasCompareAtSubtotal ? (
                        <s>
                          <Money data={subtotalCompareAtMoney} />
                        </s>
                      ) : null}
                    </div>
                  ) : (
                    <div className="product-price-on-sale cart-subtotal-price-on-sale">
                      <Money
                        data={subtotalAfterDiscountMoney}
                        className="cart-header"
                      />
                      {hasCompareAtSubtotal ? (
                        <s>
                          <Money data={subtotalCompareAtMoney} />
                        </s>
                      ) : null}
                    </div>
                  )
                ) : (
                  '-'
                )}
              </div>
            </div>
            <CartDiscountProgress
              printQuantity={printQuantity}
              stockClipQuantity={stockClipQuantity}
              stockBundleQuantity={stockBundleQuantity}
              qualifiesForPrintDiscount={qualifiesForPrintBulkDiscount}
              qualifiesForStockClipDiscount={qualifiesForStockBulkDiscount}
            />
            {showFreeShippingOnlyMessage ? (
              <div className="mt-2">
                <p className="text-sm font-medium text-primary">
                  Free shipping unlocked!
                </p>
              </div>
            ) : null}
            {showActiveDiscountTable && (
              <div className="mt-2 space-y-2">
                <Table
                  className="cart-active-discounts-table text-sm text-primary"
                  containerClassName="!overflow-visible"
                >
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-8 px-2 text-primary">
                        <span className="inline-flex items-center gap-2">
                          <span>Active Discounts</span>
                          <span className="cart-active-discount-count">
                            {activeDiscountCount}x
                          </span>
                        </span>
                      </TableHead>
                      <TableHead className="h-8 px-2 text-right text-primary">
                        Savings
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeDiscountEntries.map((entry) => (
                      <TableRow
                        key={`active-discount-${entry.label}`}
                        className="hover:bg-transparent"
                      >
                        <TableCell className="p-2 whitespace-normal break-words">
                          {entry.label}
                        </TableCell>
                        <TableCell className="p-2 text-right">
                          {entry.isShipping ? (
                            'Shipping'
                          ) : (
                            <Money
                              data={createMoneyValue(
                                Math.max(0, entry.savingsAmount),
                                subtotalCurrencyCode,
                              )}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {hasProductDiscountSavings && (
                  <p className="inline-flex items-center gap-1 whitespace-nowrap text-sm font-medium text-primary">
                    <span>Total Discount Savings:</span>
                    <strong>
                      <Money
                        data={subtotalSavingsMoney}
                        className="cart-combined-savings-glow"
                      />
                    </strong>
                  </p>
                )}
              </div>
            )}
            <br />
            <CartDiscounts discountCodes={cart.discountCodes} />
            <CartGiftCard giftCardCodes={cart.appliedGiftCards} />
          </div>
        </Card>
      </div>

      {hideExtraInfo && (
        <div className="stock-form-container">
          <p className="flex justify-center pt-7 px-8">
            Please fill out the stock footage licensing form below.
          </p>

          <div className="flex items-center justify-center pt-7 gap-2">
            <StockForm
              updateCheck={setIsOrderReady}
              clipNames={clipNames}
              isSubmitted={isOrderReady}
            />
          </div>
          <p className="flex justify-center pt-7 px-8">
            Download links will be sent via email and available on the orders
            page.
          </p>
        </div>
      )}
      <div className="flex justify-center">
        <div className="p-5">
          <CartCheckoutActions
            checkoutUrl={cart.checkoutUrl}
            disabled={!isAdmin && !isOrderReady}
          />
        </div>
      </div>
    </>
  );
}
function CartCheckoutActions({
  checkoutUrl,
  disabled,
}: {
  checkoutUrl?: string;
  disabled: boolean;
}) {
  if (!checkoutUrl) return null;

  return (
    // <div>
    //   <a href={checkoutUrl} target="_self">
    //     <p>Continue to Checkout &rarr;</p>
    //   </a>
    //   <br />
    // </div>
    <Button variant="default" className="mb-4" disabled={disabled}>
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
          <dt>Applied Discount Codes:</dt>
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
            className="w-[180px] focus-visible:border-primary focus-visible:ring-primary/50"
          />
          &nbsp;
          <Button
            type="submit"
            className="cursor-pointer ms-2"
            variant="outline"
          >
            <p className="apply-text">Apply</p>
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
      {(fetcher: FetcherWithComponents<any>) => (
        <DiscountCodeErrorMessage fetcher={fetcher}>
          {children}
        </DiscountCodeErrorMessage>
      )}
    </CartForm>
  );
}

const WELCOME15_LOGIN_ERROR =
  'You must be logged in to use the WELCOME15 discount code.';
const REVIEW15_LOGIN_ERROR = `You must be logged in to use the ${REVIEW_MEDIA_DISCOUNT_CODE} discount code.`;
const AUTO_DISMISS_LOGIN_ERRORS = new Set([
  WELCOME15_LOGIN_ERROR,
  REVIEW15_LOGIN_ERROR,
]);

function DiscountCodeErrorMessage({
  fetcher,
  children,
}: {
  fetcher: FetcherWithComponents<any>;
  children: React.ReactNode;
}) {
  const currentError =
    typeof fetcher.data?.error === 'string' ? fetcher.data.error : null;
  const [visibleError, setVisibleError] = useState<string | null>(null);

  useEffect(() => {
    if (fetcher.state !== 'idle') return;

    if (!currentError) {
      setVisibleError(null);
      return;
    }

    setVisibleError(currentError);

    if (!AUTO_DISMISS_LOGIN_ERRORS.has(currentError)) return;

    const timeoutId = window.setTimeout(() => {
      setVisibleError((previousError) =>
        previousError === currentError ? null : previousError,
      );
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [currentError, fetcher.state]);

  return (
    <>
      {children}
      {visibleError ? (
        <p className="text-xs text-red-500 mt-1">{visibleError}</p>
      ) : null}
    </>
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
            className="w-[180px] focus-visible:border-primary focus-visible:ring-primary/50"
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
