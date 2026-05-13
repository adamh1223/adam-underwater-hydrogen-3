import type {MoneyV2} from '@shopify/hydrogen/storefront-api-types';

function formatPrice(data: MoneyV2, noDecimals: boolean): string {
  const amount = parseFloat(data.amount ?? '0');
  const currency = data.currencyCode ?? 'USD';
  const digits = noDecimals && amount >= 100 ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function ProductPrice({
  price,
  compareAtPrice,
  suppressDecimals = false,
}: {
  price?: MoneyV2;
  compareAtPrice?: MoneyV2 | null;
  suppressDecimals?: boolean;
}) {
  return (
    <div className="product-price-individual">
      {compareAtPrice ? (
        <div className="product-price-on-sale">
          {price ? <span>{formatPrice(price, suppressDecimals)}</span> : null}
          <s>{formatPrice(compareAtPrice, suppressDecimals)}</s>
        </div>
      ) : price ? (
        <span>{formatPrice(price, suppressDecimals)}</span>
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}
