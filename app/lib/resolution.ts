type ProductOptionValue = {
  name?: unknown;
  firstSelectableVariant?: unknown;
};

type ProductOption = {
  name?: unknown;
  optionValues?: unknown;
};

function parseResolutionValue(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+)\s*k/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function isResolutionOption(option: ProductOption): boolean {
  return (
    typeof option?.name === 'string' &&
    option.name.trim().toLowerCase() === 'resolution'
  );
}

function toOptionValues(option: ProductOption): ProductOptionValue[] {
  return Array.isArray(option?.optionValues)
    ? (option.optionValues as ProductOptionValue[])
    : [];
}

function isVariantWithId(value: unknown): value is Record<string, unknown> & {id: string} {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as {id?: unknown}).id === 'string' &&
    ((value as {id: string}).id ?? '').length > 0
  );
}

export function getHighestResolutionVariantFromProduct(
  product: unknown,
): (Record<string, unknown> & {id: string}) | null {
  if (typeof product !== 'object' || product === null) return null;

  const options = Array.isArray((product as {options?: unknown}).options)
    ? ((product as {options: ProductOption[]}).options ?? [])
    : [];

  const resolutionOption = options.find((option) => isResolutionOption(option));
  if (!resolutionOption) return null;

  const optionValues = toOptionValues(resolutionOption);
  let highestResolution = -1;
  let highestResolutionVariant: (Record<string, unknown> & {id: string}) | null =
    null;

  for (const optionValue of optionValues) {
    const resolution = parseResolutionValue(optionValue?.name);
    if (resolution === null) continue;

    const candidateVariant = optionValue?.firstSelectableVariant;
    if (!isVariantWithId(candidateVariant)) continue;

    if (resolution > highestResolution) {
      highestResolution = resolution;
      highestResolutionVariant = candidateVariant;
    }
  }

  return highestResolutionVariant;
}

export function applyHighestResolutionVariantToProduct<T>(product: T): T {
  if (typeof product !== 'object' || product === null) return product;

  const highestResolutionVariant = getHighestResolutionVariantFromProduct(product);
  if (!highestResolutionVariant) return product;

  return {
    ...(product as Record<string, unknown>),
    selectedOrFirstAvailableVariant: highestResolutionVariant,
  } as T;
}

export function applyHighestResolutionVariantToProducts<T>(products: T[]): T[] {
  return products.map((product) => applyHighestResolutionVariantToProduct(product));
}
