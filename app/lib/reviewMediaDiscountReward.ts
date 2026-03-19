export const REVIEW_MEDIA_DISCOUNT_NAMESPACE = 'custom';
export const REVIEW_MEDIA_DISCOUNT_KEY = 'review_media_discount_reward';
export const REVIEW_MEDIA_DISCOUNT_CODE = 'REVIEW15';

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
    if (!productId) return null;

    const reviewCreatedAt = toNonEmptyString(parsed?.reviewCreatedAt) ?? undefined;
    const awardedAt = toNonEmptyString(parsed?.awardedAt) ?? undefined;

    return {
      productId,
      discountCode: REVIEW_MEDIA_DISCOUNT_CODE,
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
