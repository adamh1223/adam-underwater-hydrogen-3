export type ReviewLocationFields = {
  customerState?: string;
  customerCountry?: string;
};

const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  DC: 'District of Columbia',
  AS: 'American Samoa',
  GU: 'Guam',
  MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico',
  UM: 'United States Minor Outlying Islands',
  VI: 'U.S. Virgin Islands',
};

type ReviewAddressLike = {
  zoneCode?: string | null;
  territoryCode?: string | null;
} | null;

type ReviewCustomerLike = {
  defaultAddress?: ReviewAddressLike;
  addresses?: {
    nodes?: ReviewAddressLike[] | null;
  } | null;
} | null;

function normalizeReviewLocationPart(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function formatReviewCountry(value?: string | null) {
  const normalized = normalizeReviewLocationPart(value);
  if (!normalized) return undefined;

  const upper = normalized.toUpperCase();
  if (upper === 'US' || upper === 'USA') return 'USA';

  if (/^[A-Z]{2}$/.test(upper) && typeof Intl?.DisplayNames === 'function') {
    try {
      const displayNames = new Intl.DisplayNames(['en'], {type: 'region'});
      return displayNames.of(upper) ?? normalized;
    } catch {
      return normalized;
    }
  }

  return normalized;
}

function formatReviewState(state?: string | null, country?: string | null) {
  const normalizedState = normalizeReviewLocationPart(state);
  if (!normalizedState) return undefined;

  const normalizedCountry = normalizeReviewLocationPart(country)?.toUpperCase();
  const upperState = normalizedState.toUpperCase();

  if (
    (normalizedCountry === 'US' || normalizedCountry === 'USA') &&
    US_STATE_NAMES[upperState]
  ) {
    return US_STATE_NAMES[upperState];
  }

  return normalizedState;
}

export function getCustomerReviewLocation(
  customer?: ReviewCustomerLike,
): ReviewLocationFields {
  const fallbackAddress =
    customer?.addresses?.nodes?.find(
      (address) => address?.zoneCode || address?.territoryCode,
    ) ?? null;
  const address = customer?.defaultAddress ?? fallbackAddress;

  return {
    customerState: normalizeReviewLocationPart(address?.zoneCode),
    customerCountry: normalizeReviewLocationPart(address?.territoryCode),
  };
}

export function formatReviewLocation({
  customerState,
  customerCountry,
}: ReviewLocationFields): string | undefined {
  const parts = [
    formatReviewState(customerState, customerCountry),
    formatReviewCountry(customerCountry),
  ].filter(Boolean);

  return parts.length ? parts.join(', ') : undefined;
}
