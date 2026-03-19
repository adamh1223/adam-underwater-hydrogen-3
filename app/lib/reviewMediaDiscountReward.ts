export const REVIEW_MEDIA_DISCOUNT_NAMESPACE = 'custom';
export const REVIEW_MEDIA_DISCOUNT_KEY = 'review_media_discount_reward';

export type ReviewMediaDiscountReward = {
  productId: string;
  discountCode: string;
  reviewCreatedAt?: string;
  awardedAt?: string;
};

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function parseReviewMediaDiscountReward(
  value: unknown,
): ReviewMediaDiscountReward | null {
  const rawValue = toNonEmptyString(value);
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    const productId = toNonEmptyString(parsed?.productId);
    const discountCode = toNonEmptyString(parsed?.discountCode);

    if (!productId || !discountCode) return null;

    const reviewCreatedAt = toNonEmptyString(parsed?.reviewCreatedAt) ?? undefined;
    const awardedAt = toNonEmptyString(parsed?.awardedAt) ?? undefined;

    return {
      productId,
      discountCode,
      reviewCreatedAt,
      awardedAt,
    };
  } catch {
    return null;
  }
}

export function serializeReviewMediaDiscountReward(
  reward: ReviewMediaDiscountReward,
) {
  return JSON.stringify({
    productId: reward.productId,
    discountCode: reward.discountCode,
    reviewCreatedAt: reward.reviewCreatedAt,
    awardedAt: reward.awardedAt,
  });
}
