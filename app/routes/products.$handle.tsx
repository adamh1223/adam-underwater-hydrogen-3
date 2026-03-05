import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  useLoaderData,
  type MetaFunction,
  Link,
  useRouteLoaderData,
  useLocation,
  useNavigate,
} from '@remix-run/react';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
} from '@shopify/hydrogen';
import {ProductPrice} from '~/components/ProductPrice';
import {ProductImage} from '~/components/ProductImage';
import {ProductForm} from '~/components/ProductForm';
import IndividualProduct from '~/components/products/individualProduct';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeftIcon,
  ChevronRightIcon,
  Share,
  Share2,
  StarIcon,
} from 'lucide-react';
import {Card, CardContent, CardHeader} from '~/components/ui/card';
import IndividualVideoProduct from '~/components/eproducts/IndividualVideoProduct';
import IndividualVideoBundle, {
  type BundleDetailClip,
} from '~/components/eproducts/IndividualVideoBundle';
import VideoResolutionSwipeSection from '~/components/eproducts/VideoResolutionSwipeSection';
import {markWarmedImageUrl} from '~/lib/imageWarmup';
import {ProductImages, SimpleProductImages} from '~/lib/types';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {RootLoader} from '~/root';
import {useIsLoggedIn, useIsVideoInCart} from '~/lib/hooks';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import {toast} from 'sonner';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel';
import {ThreeUpCarousel} from '~/components/global/ThreeUpCarousel';
import {ThreeUpEProductCarousel} from '~/components/global/ThreeUpEProductCarousel';
import {Button} from '~/components/ui/button';
import {GET_REVIEW_QUERY, RECOMMENDED_PRODUCTS_QUERY} from '~/lib/homeQueries';
import SimpleRecommendedProducts from '~/components/products/simpleRecommendedProducts';
import {FaHeart, FaRegHeart} from 'react-icons/fa';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import ThreeUpCarouselBox from '~/components/global/ThreeUpCarouselBox';
import ReviewForm from '~/components/form/ReviewForm';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import ProductReviewsCarousel from '~/components/global/ProductReviewsCarousel';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import {ReloadIcon} from '@radix-ui/react-icons';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import {getCustomerReviewLocation} from '~/lib/reviews';
import ProductPageSkeleton from '~/components/skeletons/ProductPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';

const DEFAULT_SHARE_IMAGE =
  'https://downloads.adamunderwater.com/store-1-au/public/imessage-icon.png';
const SHARE_CACHE_BUST_VERSION = '2';
const INTERNAL_SHARE_QUERY_PARAMS = new Set(['_au_meta', '_au_variant']);

function withShopifyCroppedShareImage(
  imageUrl: string,
  width: number,
  height: number,
): string {
  try {
    const url = new URL(imageUrl);
    if (url.hostname !== 'cdn.shopify.com') return imageUrl;

    url.searchParams.set('width', String(width));
    url.searchParams.set('height', String(height));
    url.searchParams.set('crop', 'center');
    return url.toString();
  } catch {
    return imageUrl;
  }
}

type ShareSelectedOption = {
  name?: string | null;
  value?: string | null;
};

function buildShareProductLabel(
  productTitle: string | null | undefined,
  selectedOptions: Array<ShareSelectedOption> | null | undefined,
): string {
  const baseTitle =
    typeof productTitle === 'string' && productTitle.trim().length > 0
      ? productTitle.trim()
      : 'Product';

  const variantValues = Array.isArray(selectedOptions)
    ? selectedOptions
        .map((option) =>
          typeof option?.value === 'string' ? option.value.trim() : '',
        )
        .filter((value) => value.length > 0)
        .filter((value) => value.toLowerCase() !== 'default title')
    : [];

  return [baseTitle, ...variantValues].join(' / ');
}

export const meta: MetaFunction<typeof loader> = ({data}) => {
  const siteUrl = (data?.siteUrl ?? 'https://adamunderwater.com').replace(
    /\/$/,
    '',
  );
  const product = data?.product;
  const productTags = Array.isArray(product?.tags) ? product.tags : [];
  const isEProduct = productTags.includes('Video');
  const selectedOptionsForMeta = (data?.selectedOptions ??
    product?.selectedOrFirstAvailableVariant?.selectedOptions) as
    | Array<ShareSelectedOption>
    | null
    | undefined;
  const shareProductLabel = buildShareProductLabel(
    product?.title,
    selectedOptionsForMeta,
  );
  const title = shareProductLabel;
  const description =
    product?.seo?.description ||
    product?.description ||
    'Premium underwater wall art and stock footage by Adam Hussain.';
  const canonicalUrl = product?.handle
    ? `${siteUrl}/products/${product.handle}`
    : `${siteUrl}/products`;
  const ogUrl = data?.currentShareUrl ?? canonicalUrl;
  const canonicalShareUrl = ogUrl;
  const productMainImage =
    product?.selectedOrFirstAvailableVariant?.image?.url ??
    product?.featuredImage?.url ??
    '';
  const shareImage = productMainImage
    ? isEProduct
      ? withShopifyCroppedShareImage(productMainImage, 1200, 630)
      : productMainImage
    : DEFAULT_SHARE_IMAGE;

  return [
    {title},
    {name: 'title', content: title},
    {name: 'description', content: description},
    {
      tagName: 'link',
      rel: 'canonical',
      href: canonicalShareUrl,
    },
    {property: 'og:title', content: shareProductLabel},
    {property: 'og:description', content: description},
    {property: 'og:type', content: 'product'},
    {property: 'og:url', content: ogUrl},
    {property: 'og:image', content: shareImage},
    {property: 'og:image:secure_url', content: shareImage},
    ...(isEProduct
      ? [
          {property: 'og:image:width', content: '1200'},
          {property: 'og:image:height', content: '630'},
        ]
      : []),
    {
      property: 'og:image:alt',
      content: `${product?.title ?? 'Adam Underwater'} product preview`,
    },
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: shareProductLabel},
    {name: 'twitter:description', content: description},
    {name: 'twitter:image', content: shareImage},
    {
      name: 'twitter:image:alt',
      content: `${product?.title ?? 'Adam Underwater'} product preview`,
    },
  ];
};

function parseResolutionValue(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.match(/(\d+)\s*k/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function hasSelectedResolutionOption(
  selectedOptions: Array<{name: string; value: string}>,
) {
  return selectedOptions.some(
    (option) => option?.name?.trim().toLowerCase() === 'resolution',
  );
}

const FIVE_STAR_KEYS = ['one', 'two', 'three', 'four', 'five'] as const;

function getHighestResolutionVariant(
  product: any,
): Record<string, unknown> | null {
  const options = Array.isArray(product?.options) ? product.options : [];
  const resolutionOption = options.find(
    (option: any) =>
      typeof option?.name === 'string' &&
      option.name.trim().toLowerCase() === 'resolution',
  );
  if (!resolutionOption) return null;

  const optionValues = Array.isArray(resolutionOption.optionValues)
    ? resolutionOption.optionValues
    : [];

  let highestResolution = -1;
  let highestResolutionVariant: Record<string, unknown> | null = null;

  for (const optionValue of optionValues) {
    const resolution = parseResolutionValue(optionValue?.name);
    if (resolution === null) continue;

    const candidateVariant =
      optionValue?.firstSelectableVariant &&
      typeof optionValue.firstSelectableVariant === 'object'
        ? (optionValue.firstSelectableVariant as Record<string, unknown>)
        : null;
    if (!candidateVariant) continue;

    if (resolution > highestResolution) {
      highestResolution = resolution;
      highestResolutionVariant = candidateVariant;
    }
  }

  return highestResolutionVariant;
}

function getVideoSwipeComparisonConfig(product: any): {
  vidKey: string;
  higherResolutionLabel: string;
} | null {
  const tags = Array.isArray(product?.tags) ? product.tags : [];
  const vidIdentifierTag = tags.find(
    (tag: unknown) =>
      typeof tag === 'string' && /^(?:vid|bundle)[-_]\d+$/i.test(tag.trim()),
  );
  const vidKey =
    typeof vidIdentifierTag === 'string'
      ? toVidKey(vidIdentifierTag.match(/^(?:vid|bundle)[-_](\d+)$/i)?.[1])
      : undefined;
  if (!vidKey) return null;

  const options = Array.isArray(product?.options) ? product.options : [];
  const resolutionOption = options.find(
    (option: any) =>
      typeof option?.name === 'string' &&
      option.name.trim().toLowerCase() === 'resolution',
  );
  if (!resolutionOption) return null;

  const optionValues = Array.isArray(resolutionOption.optionValues)
    ? resolutionOption.optionValues
    : [];
  const resolutions: number[] = optionValues
    .map((optionValue: any) => parseResolutionValue(optionValue?.name))
    .filter(
      (resolution: number | null): resolution is number => resolution !== null,
    );

  if (!resolutions.includes(4)) return null;

  const higherResolution = Math.max(
    ...resolutions.filter((resolution) => resolution > 4),
  );
  if (!Number.isFinite(higherResolution) || higherResolution <= 4) return null;

  return {
    vidKey,
    higherResolutionLabel: `${higherResolution}K`,
  };
}

type BundleClipImage = {url: string; altText?: string | null};

const bundleWmlinkRegex = /^wmlink(\d+)_/i;
const bundleClipNameRegex = /^cn(\d+)_+(.+)$/i;
const bundleAltRegex = /bundle(\d+)(?:[-_](\d+))?/i;
const bundleVidTokenRegex =
  /(?:^|[^a-z0-9])(?:vid|bundle)[-_]?(\d+)(?=[^a-z0-9]|$)/i;
const indexedVidTagRegex = /^vid(\d+)[-_](\d+)$/i;
const indexedBundleVidTagRegex = /^bundle(\d+)[-_](\d+)$/i;
const standaloneBundleVidTagRegex = /^bundle[-_](\d+)$/i;
const standaloneVidTagRegex = /^vid[-_](\d+)$/i;
const bundleClipDivRegex =
  /<div[^>]*class=(["'])[^"']*\bclip-(\d+)\b[^"']*\1[^>]*>([\s\S]*?)<\/div>/gi;
const bundleDescriptionTitleBlacklist = new Set([
  'location',
  'location:',
  'duration',
  'duration:',
  'resolution',
  'resolution:',
  'frame',
  'frame:',
  'frame rate',
  'frame rate:',
]);

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripHtml(value: string): string {
  return decodeBasicEntities(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeClipName(value: string): string {
  return value.trim().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
}

function toVidKey(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return `vid${parsed}`;
}

function extractClipLocationFromDescription(html: string): string | undefined {
  const locationMatch = html.match(
    /<strong[^>]*>\s*Location\s*:?\s*<\/strong>\s*([\s\S]*?)(?:<\/p>|<br\s*\/?>|$)/i,
  );

  if (locationMatch?.[1]) {
    const parsed = stripHtml(locationMatch[1]);
    if (parsed) return parsed;
  }

  const plainText = stripHtml(html);
  const fallbackMatch = plainText.match(/location\s*:?\s*([^\n\r]+)/i);
  if (fallbackMatch?.[1]) {
    const parsed = fallbackMatch[1].trim();
    if (parsed) return parsed;
  }

  return undefined;
}

function extractClipTitleFromDescription(html: string): string | undefined {
  const strongRegex = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;
  let strongMatch: RegExpExecArray | null = strongRegex.exec(html);

  while (strongMatch) {
    const candidate = stripHtml(strongMatch[1] ?? '');
    const normalized = candidate.toLowerCase();
    if (candidate && !bundleDescriptionTitleBlacklist.has(normalized)) {
      return candidate;
    }
    strongMatch = strongRegex.exec(html);
  }

  const paragraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (paragraphMatch?.[1]) {
    const candidate = stripHtml(paragraphMatch[1]);
    const normalized = candidate.toLowerCase();
    if (candidate && !bundleDescriptionTitleBlacklist.has(normalized)) {
      return candidate;
    }
  }

  return undefined;
}

function parseBundleDescriptionsByClip(
  descriptionHtml?: string,
): Map<number, string> {
  const byClip = new Map<number, string>();
  if (!descriptionHtml) return byClip;

  bundleClipDivRegex.lastIndex = 0;
  let match = bundleClipDivRegex.exec(descriptionHtml);
  while (match) {
    const clipIndex = Number(match[2]);
    const clipHtml = (match[3] ?? '').trim();
    if (clipIndex > 0 && clipHtml) {
      byClip.set(clipIndex, clipHtml);
    }
    match = bundleClipDivRegex.exec(descriptionHtml);
  }

  return byClip;
}

function buildBundleDetailClips({
  images,
  tags,
  descriptionHtml,
}: {
  images: BundleClipImage[];
  tags: string[];
  descriptionHtml?: string;
}): BundleDetailClip[] {
  const wmlinkByClip = new Map<number, string>();
  const clipNameByClip = new Map<number, string>();
  const vidByClip = new Map<number, string>();
  const descriptionByClip = parseBundleDescriptionsByClip(descriptionHtml);
  const imageByClip = new Map<number, BundleClipImage>();
  const bundleVidKeysFromTagsInOrder: string[] = [];
  const vidKeysFromTagsInOrder: string[] = [];
  const seenBundleVidKeys = new Set<string>();
  const seenVidKeys = new Set<string>();

  tags.forEach((tag) => {
    const wmlinkMatch = tag.match(bundleWmlinkRegex);
    if (wmlinkMatch) {
      const clipIndex = Number(wmlinkMatch[1]);
      const wmlinkId = tag.split('_')[1];
      if (clipIndex > 0 && wmlinkId) {
        wmlinkByClip.set(clipIndex, wmlinkId);
      }
      return;
    }

    const clipNameMatch = tag.match(bundleClipNameRegex);
    if (clipNameMatch) {
      const clipIndex = Number(clipNameMatch[1]);
      const clipName = clipNameMatch[2]?.trim();
      if (clipIndex > 0 && clipName) {
        clipNameByClip.set(clipIndex, normalizeClipName(clipName));
      }
      return;
    }

    const indexedVidMatch =
      tag.match(indexedVidTagRegex) ?? tag.match(indexedBundleVidTagRegex);
    if (indexedVidMatch?.[1] && indexedVidMatch?.[2]) {
      const clipIndex = Number(indexedVidMatch[1]);
      const vidKey = toVidKey(indexedVidMatch[2]);
      if (clipIndex > 0 && vidKey) {
        vidByClip.set(clipIndex, vidKey);
      }
      return;
    }

    const standaloneBundleVidMatch = tag.match(standaloneBundleVidTagRegex);
    if (standaloneBundleVidMatch?.[1]) {
      const vidKey = toVidKey(standaloneBundleVidMatch[1]);
      if (vidKey && !seenBundleVidKeys.has(vidKey)) {
        seenBundleVidKeys.add(vidKey);
        bundleVidKeysFromTagsInOrder.push(vidKey);
      }
      return;
    }

    const standaloneVidMatch = tag.match(standaloneVidTagRegex);
    if (standaloneVidMatch?.[1]) {
      const vidKey = toVidKey(standaloneVidMatch[1]);
      if (vidKey && !seenVidKeys.has(vidKey)) {
        seenVidKeys.add(vidKey);
        vidKeysFromTagsInOrder.push(vidKey);
      }
    }
  });

  images.forEach((image, imageIndex) => {
    const altText = image.altText ?? '';
    const matchedIndex = altText.match(bundleAltRegex);
    if (matchedIndex?.[1]) {
      const clipIndex = Number(matchedIndex[1]);
      const vidFromAlt =
        toVidKey(matchedIndex[2]) ?? toVidKey(altText.match(bundleVidTokenRegex)?.[1]);

      if (clipIndex > 0) {
        imageByClip.set(clipIndex, image);
        if (vidFromAlt) {
          vidByClip.set(clipIndex, vidFromAlt);
        }
      }
      return;
    }

    const orderedClipIndex = imageIndex + 1;
    const fallbackVidFromAlt = toVidKey(altText.match(bundleVidTokenRegex)?.[1]);
    if (fallbackVidFromAlt && !vidByClip.has(orderedClipIndex)) {
      vidByClip.set(orderedClipIndex, fallbackVidFromAlt);
    }

    if (!imageByClip.has(imageIndex + 1)) {
      imageByClip.set(imageIndex + 1, image);
    }
  });

  const fallbackVidKeysInOrder =
    bundleVidKeysFromTagsInOrder.length > 0
      ? bundleVidKeysFromTagsInOrder
      : vidKeysFromTagsInOrder;

  const clipCount = Math.max(
    wmlinkByClip.size,
    clipNameByClip.size,
    descriptionByClip.size,
    imageByClip.size,
    vidByClip.size,
    fallbackVidKeysInOrder.length,
    images.length,
  );

  for (let clipIndex = 1; clipIndex <= clipCount; clipIndex += 1) {
    if (vidByClip.has(clipIndex)) continue;
    const fallbackVidKey = fallbackVidKeysInOrder[clipIndex - 1];
    if (fallbackVidKey) {
      vidByClip.set(clipIndex, fallbackVidKey);
    }
  }

  const clips: BundleDetailClip[] = [];

  for (let clipIndex = 1; clipIndex <= clipCount; clipIndex += 1) {
    const descriptionForClip = descriptionByClip.get(clipIndex);
    const clipName =
      clipNameByClip.get(clipIndex) ??
      (descriptionForClip
        ? extractClipTitleFromDescription(descriptionForClip)
        : undefined) ??
      `Clip ${clipIndex}`;
    const clipLocation = descriptionForClip
      ? extractClipLocationFromDescription(descriptionForClip)
      : undefined;
    const wmlinkId = wmlinkByClip.get(clipIndex);
    const image = imageByClip.get(clipIndex) ?? images[clipIndex - 1];

    if (
      !image &&
      !wmlinkId &&
      !descriptionForClip &&
      !clipNameByClip.has(clipIndex)
    ) {
      continue;
    }

    clips.push({
      index: clipIndex,
      wmlinkId,
      vidKey: vidByClip.get(clipIndex),
      image,
      clipName,
      clipLocation,
      descriptionHtml: descriptionForClip,
    });
  }

  return clips;
}

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({
  context,
  params,
  request,
}: LoaderFunctionArgs) {
  const handleParam = params.handle;
  const {storefront, cart} = context;

  if (!handleParam) {
    throw new Error('Expected product handle to be defined');
  }

  const handle = handleParam.toLowerCase();
  const requestUrl = new URL(request.url);
  const resolvedSiteUrl = requestUrl.origin.replace(/\/$/, '');
  const selectedOptions = getSelectedProductOptions(request).filter(
    (option) =>
      !INTERNAL_SHARE_QUERY_PARAMS.has(
        (typeof option?.name === 'string' ? option.name : '').trim(),
      ),
  );
  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions},
    }),
    storefront.query(RECOMMENDED_PRODUCTS_QUERY),
    // Add other queries here, so that they are loaded in parallel
  ]);
  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  if (!hasSelectedResolutionOption(selectedOptions)) {
    const highestResolutionVariant = getHighestResolutionVariant(product);
    if (highestResolutionVariant?.id) {
      product.selectedOrFirstAvailableVariant = highestResolutionVariant;
    }
  }

  const reviews = await context.storefront.query(GET_REVIEW_QUERY, {
    variables: {productId: product.id},
  });
  if (reviews?.product?.metafield?.value) {
    const {hydrateReviewLocationsInMetafieldValue} = await import(
      '~/lib/reviews.server'
    );
    reviews.product.metafield.value =
      await hydrateReviewLocationsInMetafieldValue(
        context.env,
        reviews.product.metafield.value,
      );
  }
  let customer = null;
  let wishlistProducts: string[] = [];
  let isLoggedIn = false;

  if (await context.customerAccount.isLoggedIn()) {
    const {data, errors} = await context.customerAccount.query(
      CUSTOMER_DETAILS_QUERY,
    );
    const customerWishlistData =
      await context.customerAccount.query(CUSTOMER_WISHLIST);
    customer = data;
    isLoggedIn = true;
    const customerMetafieldValue =
      customerWishlistData?.data?.customer?.metafield?.value ?? undefined;
    if (customerMetafieldValue) {
      wishlistProducts = JSON.parse(customerMetafieldValue) as string[];
    } else {
      wishlistProducts = [];
    }
  }
  return {
    product,
    customer,
    reviews,
    isLoggedIn,
    wishlistProducts,
    cart: cart.get(),
    siteUrl: resolvedSiteUrl,
    selectedOptions,
    currentShareUrl: `${resolvedSiteUrl}${requestUrl.pathname}${requestUrl.search}`,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context, params}: LoaderFunctionArgs) {
  // Put any API calls that is not critical to be available on first page render
  // For example: product reviews, product recommendations, social feeds.

  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error, '00000000000000000000000000000000000000000000000');
      return null;
    });

  return {
    recommendedProducts,
  };
}
// Use the same fix for about page recommended products
export default function Product() {
  const {
    product,
    recommendedProducts,
    cart,
    reviews,
    customer,
    isLoggedIn,
    wishlistProducts,
    siteUrl,
  } = useLoaderData<typeof loader>();

  const [isPageReady, setIsPageReady] = useState(false);
  const [initialLoadedGateImageUrl, setInitialLoadedGateImageUrl] =
    useState('');
  const hasCalledLoad = useRef(false);
  const productImgRef = useRef<HTMLImageElement>(null);

  const handleProductImgLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  useEffect(() => {
    const img = productImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleProductImgLoad();
    }
  }, [handleProductImgLoad]);

  const isInWishlist = wishlistProducts.includes(product?.id);
  const isAdmin =
    customer?.customer?.id === 'gid://shopify/Customer/7968375079049';

  const customerId = customer?.customer?.id ?? '';

  const customerFirstName = customer?.customer?.firstName ?? '';
  const customerLastName = customer?.customer?.lastName ?? '';
  const customerName = `${customerFirstName} ${customerLastName}`.trim();
  const {customerState, customerCountry} = getCustomerReviewLocation(
    customer?.customer,
  );

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const {
    title,
    descriptionHtml,
    collections,
    images,
    featuredImage,
    selectedOrFirstAvailableVariant,
    tags,
  } = product;
  const currentGateImageUrl =
    selectedVariant?.image?.url ?? featuredImage?.url ?? '';

  const WMLink = tags.filter((tag: string) => tag.includes('wmlink'))?.[0];
  const parsedWMLink = WMLink?.split('_')[1];

  const productSizeMetafields = collections?.edges?.[2]?.node?.metafield;

  const {references} = productSizeMetafields || {};
  // THREE COLUMN SIZES
  const threeColumnSizes = images?.nodes?.filter((item: any) => {
    if (item.altText?.includes('horizontal-3')) {
      return {
        url: item.url,
        altText: item.altText,
      };
    }
  });
  // TWO COLUMN SIZES
  const twoColumnSizes = images?.nodes?.filter((item: any) => {
    if (item.altText?.includes('horizontal-2')) {
      return {
        url: item.url,
        altText: item.altText,
      };
    }
  });
  // STANDARD HORIZONTAL SIZES
  const standardHorizontalSizes = images?.nodes?.filter((item: any) => {
    if (item.altText?.includes('horizontal-1')) {
      return {
        url: item.url,
        altText: item.altText,
      };
    }
  });
  // VERTICAL SIZES
  const verticalSizes = images?.nodes?.filter((item: any) => {
    if (item.altText?.includes('vertical-1')) {
      return {
        url: item.url,
        altText: item.altText,
      };
    }
  });

  const determineLayoutImages = (variant: any) => {
    const orientation = variant.title.split(' / ')[0];
    const layout = variant.title.split(' / ')[1];

    // We DO get orientation 'Vertical' or 'Landscape' this works.

    if (layout === 'Standard' && orientation === 'Landscape') {
      return standardHorizontalSizes;
    } else if (layout === 'Two Columns' && orientation === 'Landscape') {
      return twoColumnSizes;
    } else if (layout === 'Three Columns' && orientation === 'Landscape') {
      return threeColumnSizes;
    } else if (layout === 'Standard' && orientation === 'Vertical') {
      return verticalSizes;
    }
  };

  let layoutImagesToUse = determineLayoutImages(selectedVariant);

  // const imageURLs = images.nodes.map((item: {url: string}) => item.url);

  // const imagesToUse = images.nodes.map(
  //   (item: {url: string; altText: string}) => {
  //     if (selectedVariant.title.toLowerCase() === item.altText.split('_')[0]) {
  //       return item.url;
  //     }
  //   },
  // );

  const standardCarouselImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('hr-car')) {
        return image;
      }
    })
    .filter(Boolean);

  // horizontal sm
  const threeSixtyCarouselHorizontalSmallImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-hz-small-')) {
        return image;
      }
    })
    .filter(Boolean);

  // horizontal md
  const threeSixtyCarouselHorizontalMediumImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-hz-medium-')) {
        return image;
      }
    })
    .filter(Boolean);

  // horizontal lg
  const threeSixtyCarouselHorizontalLargeImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-hz-large-')) {
        return image;
      }
    })
    .filter(Boolean);

  // horizontal xl
  const threeSixtyCarouselHorizontalXLImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-hz-xl-')) {
        return image;
      }
    })
    .filter(Boolean);

  // vertical sm
  const threeSixtyCarouselVerticalSmallImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-vt-small-')) {
        return image;
      }
    })
    .filter(Boolean);

  // vertical md
  const threeSixtyCarouselVerticalMediumImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-vt-medium-')) {
        return image;
      }
    })
    .filter(Boolean);

  // vertical lg
  const threeSixtyCarouselVerticalLargeImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-vt-large-')) {
        return image;
      }
    })
    .filter(Boolean);

  // vertical xl
  const threeSixtyCarouselVerticalXLImages = images.nodes
    .map((image: any) => {
      if (image.url?.includes('360-vt-xl-')) {
        return image;
      }
    })
    .filter(Boolean);

  // const threeDImagesToUse =
  const determineThreeDImages = (variant: any) => {
    const orientation = variant.title.split(' / ')[0];
    const layout = variant.title.split(' / ')[1];
    const size = variant.title.split(' / ')[2];

    // Standard Only, Horizontal and vertical all sizes
    // no two columns, no three columns any size

    // Standard, Landscape, small
    if (
      layout === 'Standard' &&
      orientation === 'Landscape' &&
      size === 'Small'
    ) {
      return threeSixtyCarouselHorizontalSmallImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Landscape' &&
      size === 'Medium'
    ) {
      // Standard, Landscape, medium
      return threeSixtyCarouselHorizontalMediumImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Landscape' &&
      size === 'Large'
    ) {
      // Standard, Landscape, large
      return threeSixtyCarouselHorizontalLargeImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Landscape' &&
      size === 'XL (Pickup Only)'
    ) {
      // Standard, Landscape, xl
      return threeSixtyCarouselHorizontalXLImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Vertical' &&
      size === 'Small'
    ) {
      // Standard, Vertical, small
      return threeSixtyCarouselVerticalSmallImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Vertical' &&
      size === 'Medium'
    ) {
      // Standard, Vertical, medium
      return threeSixtyCarouselVerticalMediumImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Vertical' &&
      size === 'Large'
    ) {
      // Standard, Vertical, large
      return threeSixtyCarouselVerticalLargeImages;
    } else if (
      layout === 'Standard' &&
      orientation === 'Vertical' &&
      size === 'XL (Pickup Only)'
    ) {
      // Standard, Vertical, xl
      return threeSixtyCarouselVerticalXLImages;
    } else if (layout === 'Two Columns') {
      return {};
    } else if (layout === 'Three Columns') {
      return {};
    } else {
      return {};
    }
  };

  let threeDImagesToUse = determineThreeDImages(selectedVariant);

  const standardVerticalCarouselImages = images.nodes
    .map((image: any) => {
      if (image.url.includes('vt-car')) {
        return image;
      }
    })
    .filter(Boolean);
  // SECOND IMAGE
  const horizontalStandardSecondImg = images.nodes
    .map((image: any) => {
      if (image.url.includes('hz-1-second-img')) {
        return image;
      }
    })
    .filter(Boolean);
  const horizontalTwoColsSecondImg = images.nodes
    .map((image: any) => {
      if (image.url.includes('hz-2-second-img')) {
        return image;
      }
    })
    .filter(Boolean);
  const horizontalThreeColsSecondImg = images.nodes
    .map((image: any) => {
      if (image.url.includes('hz-3-second-img')) {
        return image;
      }
    })
    .filter(Boolean);
  const verticalSecondImg = images.nodes
    .map((image: any) => {
      if (image.url.includes('vt-second-img')) {
        return image;
      }
    })
    .filter(Boolean);

  // WE ARE NOT GETTING VT SECOND IMG EVEN THO IT MATCHES. BUT IT DOES WORK ON HORPRIMARY. NOT VERTPRIMARY

  const orientation = selectedVariant.title.split(' / ')[0];
  const layout = selectedVariant.title.split(' / ')[1];

  // this adds the second image based on the layout and orientation
  if (layout === 'Standard' && orientation === 'Landscape') {
    standardCarouselImages.unshift(horizontalStandardSecondImg.pop());
  } else if (layout === 'Two Columns' && orientation === 'Landscape') {
    standardCarouselImages.unshift(horizontalTwoColsSecondImg.pop());
  } else if (layout === 'Three Columns' && orientation === 'Landscape') {
    standardCarouselImages.unshift(horizontalThreeColsSecondImg.pop());
  } else if (layout === 'Standard' && orientation === 'Vertical') {
    standardVerticalCarouselImages.unshift(verticalSecondImg.pop());
  }
  // add the main image first to each orientation
  standardVerticalCarouselImages.unshift(selectedVariant?.image);
  //
  standardCarouselImages.unshift(selectedVariant?.image);
  const allPrintProductImages = useMemo(
    () =>
      Array.from(
        new Map(
          [selectedVariant?.image, featuredImage, ...(images?.nodes ?? [])]
            .filter(
              (
                image,
              ): image is {
                url: string;
                altText?: string | null;
              } => typeof image?.url === 'string' && image.url.length > 0,
            )
            .map((image) => [
              image.url,
              {
                url: image.url,
                altText: image.altText ?? '',
              },
            ]),
        ).values(),
      ),
    [featuredImage, images?.nodes, selectedVariant?.image],
  );

  const isVideo = product.tags.includes('Video');
  const isBundle = product.tags.includes('Bundle');
  const isPrint = !isVideo;
  const isVideoBundle = isVideo && isBundle;
  const standaloneVideoSwipeComparison = useMemo(
    () => (isVideo && !isBundle ? getVideoSwipeComparisonConfig(product) : null),
    [isBundle, isVideo, product],
  );

  useEffect(() => {
    if (!isPageReady || !currentGateImageUrl || initialLoadedGateImageUrl)
      return;
    setInitialLoadedGateImageUrl(currentGateImageUrl);
    markWarmedImageUrl(currentGateImageUrl);
  }, [currentGateImageUrl, initialLoadedGateImageUrl, isPageReady]);

  const bundleDetailClips = useMemo(
    () =>
      isBundle
        ? buildBundleDetailClips({
            images: (images?.nodes as BundleClipImage[]) ?? [],
            tags: tags ?? [],
            descriptionHtml,
          })
        : [],
    [descriptionHtml, images?.nodes, isBundle, tags],
  );
  const [activeBundleClipIndex, setActiveBundleClipIndex] = useState(1);

  useEffect(() => {
    setActiveBundleClipIndex(1);
  }, [product.id]);

  const activeBundleClip =
    bundleDetailClips.find((clip) => clip.index === activeBundleClipIndex) ??
    bundleDetailClips[0];
  const activeVideoSwipeComparison: {
    vidKey: string;
    higherResolutionLabel?: string;
  } | null = useMemo(
    () =>
      isBundle
        ? activeBundleClip?.vidKey
          ? {vidKey: activeBundleClip.vidKey}
          : null
        : standaloneVideoSwipeComparison,
    [activeBundleClip?.vidKey, isBundle, standaloneVideoSwipeComparison],
  );

  let isHorOnly = product.tags
    .map((tag: any) => {
      if (tag.includes('horOnly')) {
        return tag;
      }
    })
    .filter(Boolean);

  let isHorPrimary = product.tags
    .map((tag: any) => {
      if (tag.includes('horPrimary')) {
        return tag;
      }
    })
    .filter(Boolean);
  let isVertOnly = product.tags
    .map((tag: any) => {
      if (tag.includes('vertOnly')) {
        return tag;
      }
    })
    .filter(Boolean);
  let isVertPrimary = product.tags
    .map((tag: any) => {
      if (tag.includes('vertPrimary')) {
        return tag;
      }
    })
    .filter(Boolean);

  // const standardCarouselImages = images.nodes
  //   .map((image: any) => {
  //     if (image.altText?.includes('horizontalCarousel')) {
  //       return image;
  //     }
  //   })
  //   .filter(Boolean);

  const locationTag = product.tags.find((t: string) => t?.startsWith?.('loc_'));
  let locationName: string | undefined;
  let locationState: string | undefined;
  let locationCountry: string | undefined;

  const titleCase = (w: string) =>
    w.length === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

  if (locationTag) {
    const parts = locationTag.split('_');

    const extract = (base: 'locname' | 'locstate' | 'loccountry') => {
      const capsKey = `${base}caps`;
      const capsIdx = parts.indexOf(capsKey);
      const baseIdx = parts.indexOf(base);
      const idx = capsIdx !== -1 ? capsIdx : baseIdx;
      if (idx === -1) return undefined;

      // collect tokens after the key until next loc* signifier or end
      const valueParts: string[] = [];
      for (let i = idx + 1; i < parts.length; i++) {
        if (parts[i].startsWith('loc')) break;
        valueParts.push(parts[i]);
      }
      if (valueParts.length === 0) return undefined;

      const raw = valueParts.join(' ').trim();
      if (raw.toLowerCase() === 'null') return undefined;

      // caps key present -> force ALL CAPS
      if (capsIdx !== -1) return raw.toUpperCase();

      // locname -> always title-case each token (no short-token uppercasing)
      if (base === 'locname') {
        return valueParts.map(titleCase).join(' ');
      }

      // locstate / loccountry -> uppercase tokens <= 3 chars (CA, USA), otherwise title-case
      return valueParts
        .map((w) => (w.length <= 3 ? w.toUpperCase() : titleCase(w)))
        .join(' ');
    };

    locationName = extract('locname');
    locationState = extract('locstate');
    locationCountry = extract('loccountry');
  }

  const formattedLocation = [locationName, locationState, locationCountry]
    .filter(Boolean)
    .join(', ');

  // Example:
  // tag: loc_locname_san_miguel_island_locstatecaps_ca_loccountrycaps_usa
  // formattedLocation -> "San Miguel Island, CA, USA"

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  const productDetailGridStyle = useMemo(() => {
    if (windowWidth == null || windowWidth < 1024) return undefined;
    if (windowWidth >= 1600) {
      return {
        gridTemplateColumns: 'minmax(0, 50%) minmax(0, 50%)',
      };
    }

    const interpolationProgress = (windowWidth - 1024) / (1600 - 1024);
    const mediaColumnWidth = 60 - 10 * interpolationProgress;
    const detailsColumnWidth = 100 - mediaColumnWidth;

    return {
      gridTemplateColumns: `minmax(0, ${mediaColumnWidth}%) minmax(0, ${detailsColumnWidth}%)`,
    };
  }, [windowWidth]);

  const data = useRouteLoaderData<RootLoader>('root');

  const disableButton = useIsVideoInCart(
    selectedOrFirstAvailableVariant?.id,
    cart,
  );

  const [carouselApi, setCarouselApi] = useState<CarouselApi | undefined>(
    undefined,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
      setTotalItems(carouselApi.scrollSnapList().length);
    };

    updateCarouselState();

    carouselApi.on('select', updateCarouselState);

    // Cleanup function
    return () => void carouselApi.off('select', updateCarouselState);
  }, [carouselApi]);

  const scrollToIndex = (index: number) => carouselApi?.scrollTo(index);

  const increaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();

    scrollToIndex(currentIndex + 1);
  };

  const decreaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex - 1);
  };

  const cards = [
    {
      icon: 'https://downloads.adamunderwater.com/store-1-au/public/1x-icon-2.png',
      title: 'Canvas Print',
      description:
        'Each framed print comes with heavy duty hanging wire attached',
      image: 'https://downloads.adamunderwater.com/store-1-au/public/gear1.png',
    },
    {
      icon: 'https://downloads.adamunderwater.com/store-1-au/public/1x-icon-2.png',
      title: 'NFC Tags',
      description:
        'Try tapping your phone to the bottom right corner of the frame',
      image: 'https://downloads.adamunderwater.com/store-1-au/public/gear1.png',
    },
    {
      icon: 'https://downloads.adamunderwater.com/store-1-au/public/2x-icon.png',
      title: 'Hangers and nails',
      description: 'Each print comes with 2 sets of picture hangers and nails',
      image:
        'https://downloads.adamunderwater.com/store-1-au/public/hangers-image.png',
    },
    {
      icon: 'https://downloads.adamunderwater.com/store-1-au/public/4x-icon.png',
      title: 'Command Strips',
      description:
        'Each shipment comes with velcro 4 command strips to secure the print flush on the wall.',
      image: 'https://downloads.adamunderwater.com/store-1-au/public/gear1.png',
    },
  ];
  let parsedReviews: any[] = [];
  try {
    const rawReviews = reviews?.product?.metafield?.value;
    parsedReviews = rawReviews ? (JSON.parse(rawReviews) as any[]) : [];
  } catch (error) {
    console.error('Unable to parse product reviews metafield', error);
    parsedReviews = [];
  }

  const [reviewsList, setReviewsList] = useState(parsedReviews);
  const userReviewExists = reviewsList?.some((review) => {
    return review.customerId === customerId;
  });
  let isBlocked;
  if (customer?.tags?.includes('blocked')) {
    isBlocked = true;
  } else {
    isBlocked = false;
  }

  const reviewsCount = reviewsList.length;
  const averageRating =
    reviewsCount > 0
      ? reviewsList.reduce(
          (sum, review) => sum + Number(review?.stars ?? 0),
          0,
        ) / reviewsCount
      : 0;
  const formattedAverageRating =
    reviewsCount > 0 ? averageRating.toFixed(2) : '0.0';

  const handleRemoveReview = async (reviewToRemove: any) => {
    if (!customerId || !reviewToRemove?.createdAt) return;
    const idToRemove = isAdmin ? reviewToRemove.customerId : customerId;
    const form = new FormData();
    form.append('productId', product.id);
    form.append('customerId', idToRemove);
    form.append('createdAt', reviewToRemove.createdAt);

    try {
      const response = await fetch('/api/remove_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });

      if (!response.ok) {
        console.error('Failed to remove review', await response.text());
        return;
      }

      const data = await response.json();
      const updatedReviews = data?.reviews ?? [];
      setReviewsList(updatedReviews);
      toast.success('Review Deleted');
    } catch (error) {
      console.error('Error removing review', error);
    }
  };
  const updateExistingReviews = (newReviews: any[]) => {
    setReviewsList(newReviews);
  };

  const handleEditReview = async (
    reviewToEdit: any,
    updates: {
      text: string;
      title: string;
      stars: number;
      image?: File | null;
      video?: File | null;
      isFeatured?: boolean;
    },
  ) => {
    if (!customerId || !reviewToEdit?.createdAt) return;

    const form = new FormData();
    form.append('productId', product.id);
    form.append('customerId', customerId);
    form.append('createdAt', reviewToEdit.createdAt);
    form.append('review', updates.text);
    form.append('stars', updates.stars.toString());
    form.append('title', updates.title);
    form.append('customerName', customerName);
    form.append('customerState', customerState ?? '');
    form.append('customerCountry', customerCountry ?? '');
    if (updates.image) {
      form.append('image', updates.image);
    }
    if (updates.video) {
      form.append('video', updates.video);
    }
    if (isAdmin && typeof updates.isFeatured === 'boolean') {
      form.append('isFeatured', updates.isFeatured ? 'yes' : 'no');
    }

    try {
      const response = await fetch('/api/edit_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });

      if (!response.ok) {
        console.error('Failed to edit review', await response.text());
        return;
      }

      const data = await response.json();
      const updatedReviews = data?.reviews ?? [];
      setReviewsList(updatedReviews);
      toast.success('Review Changes Saved');
    } catch (error) {
      console.error('Error editing review', error);
    }
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [wishlistItem, setWishlistItem] = useState(isInWishlist);
  const [pendingWishlistChange, setPendingWishlistChange] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);

  const normalizedSiteUrl = (siteUrl ?? 'https://adamunderwater.com').replace(
    /\/$/,
    '',
  );
  const runtimeShareBaseUrl =
    typeof window !== 'undefined'
      ? window.location.origin.replace(/\/$/, '')
      : normalizedSiteUrl;
  const shareUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const selectedOptions = Array.isArray(selectedVariant?.selectedOptions)
      ? selectedVariant.selectedOptions
      : [];

    for (const option of selectedOptions) {
      const name = option?.name;
      const value = option?.value;
      if (typeof name !== 'string' || typeof value !== 'string') continue;
      params.set(name, value);
    }

    params.set('_au_meta', SHARE_CACHE_BUST_VERSION);
    if (typeof selectedVariant?.id === 'string' && selectedVariant.id.length > 0) {
      params.set('_au_variant', selectedVariant.id);
    } else {
      params.delete('_au_variant');
    }

    const query = params.toString();
    return `${runtimeShareBaseUrl}${location.pathname}${query ? `?${query}` : ''}`;
  }, [
    location.pathname,
    location.search,
    runtimeShareBaseUrl,
    selectedVariant?.id,
    selectedVariant?.selectedOptions,
  ]);
  const shareProductLabel = useMemo(
    () => buildShareProductLabel(title, selectedVariant?.selectedOptions),
    [title, selectedVariant?.selectedOptions],
  );
  const shareTitle = `Adam Underwater | ${shareProductLabel}`;
  const shareText = `Check out "${shareProductLabel}" on Adam Underwater.`;

  const addToFavorites = async () => {
    try {
      setPendingWishlistChange(true);
      const form = new FormData();
      form.append('productId', product.id);

      const response = await fetch('/api/add_favorites', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });
      const json = await response.json();
      setWishlistItem(true);
      toast.success('Added to Favorites', {
        action: {
          label: 'View All Favorites',
          onClick: () => navigate('/account/favorites'),
        },
      });
      setPendingWishlistChange(false);
    } catch (error) {
      setWishlistItem(false);
      setPendingWishlistChange(false);
    }
  };
  const removeFromFavorites = async () => {
    try {
      setPendingWishlistChange(true);
      const form = new FormData();
      form.append('productId', product.id);

      const response = await fetch('/api/remove_favorites', {
        method: 'PUT',
        body: form,
        headers: {Accept: 'application/json'},
      });
      const json = await response.json();
      setWishlistItem(false);
      toast.success('Removed from Favorites', {
        action: {
          label: 'View All Favorites',
          onClick: () => navigate('/account/favorites'),
        },
      });
      setPendingWishlistChange(false);
    } catch (error) {
      setWishlistItem(true);
      setPendingWishlistChange(false);
    }
  };

  const openShareTarget = useCallback((targetUrl: string) => {
    if (typeof window === 'undefined') return;

    const popup = window.open(
      targetUrl,
      '_blank',
      'noopener,noreferrer,width=640,height=720',
    );
    if (!popup) {
      window.location.href = targetUrl;
    }
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Link copied');
        setIsShareDialogOpen(false);
        return;
      }
    } catch {
      // Fall through to prompt fallback.
    }

    if (typeof window !== 'undefined') {
      window.prompt('Copy this link:', shareUrl);
    }
    setIsShareDialogOpen(false);
  }, [shareUrl]);

  const handleShareButtonClick = useCallback(async () => {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
      }
    }

    setIsShareDialogOpen(true);
  }, [shareText, shareTitle, shareUrl]);

  const shareOptions = useMemo(() => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(shareTitle);
    const encodedText = encodeURIComponent(`${shareText} ${shareUrl}`);

    return [
      {label: 'Copy link', onClick: handleCopyShareLink},
      {
        label: 'Email',
        onClick: () => {
          if (typeof window === 'undefined') return;
          window.location.href = `mailto:?subject=${encodedTitle}&body=${encodedText}`;
          setIsShareDialogOpen(false);
        },
      },
      {
        label: 'Messages (SMS)',
        onClick: () => {
          if (typeof window === 'undefined') return;
          window.location.href = `sms:?&body=${encodedText}`;
          setIsShareDialogOpen(false);
        },
      },
      {
        label: 'WhatsApp',
        onClick: () => {
          openShareTarget(`https://api.whatsapp.com/send?text=${encodedText}`);
          setIsShareDialogOpen(false);
        },
      },
      {
        label: 'Facebook',
        onClick: () => {
          openShareTarget(
            `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          );
          setIsShareDialogOpen(false);
        },
      },
      {
        label: 'X',
        onClick: () => {
          openShareTarget(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(
              shareText,
            )}&url=${encodedUrl}`,
          );
          setIsShareDialogOpen(false);
        },
      },
    ];
  }, [handleCopyShareLink, openShareTarget, shareText, shareTitle, shareUrl]);

  const productActionButtonClassName =
    'inline-flex items-center justify-center cursor-pointer p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground relative z-50';
  const productActionIconClassName = 'h-4 w-4';

  const renderProductHeaderActionButtons = () => (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={wishlistItem ? removeFromFavorites : addToFavorites}
              className={productActionButtonClassName}
            >
              {pendingWishlistChange ? (
                <ReloadIcon
                  className={`${productActionIconClassName} animate-spin`}
                />
              ) : (
                <>
                  {wishlistItem ? (
                    <FaHeart className={productActionIconClassName} />
                  ) : (
                    <>
                      {isLoggedIn ? (
                        <FaRegHeart className={productActionIconClassName} />
                      ) : (
                        <Link to="/account/login">
                          <FaRegHeart
                            className={productActionIconClassName}
                          />
                        </Link>
                      )}
                    </>
                  )}
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm z-1000">
            {wishlistItem ? 'Remove from Favorites' : 'Save to Favorites'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleShareButtonClick}
              className={productActionButtonClassName}
              aria-label="Share product"
            >
              <Share className={productActionIconClassName} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-sm z-1000">
            Share
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );

  const retryTimerRef = useRef<number | null>(null);

  // Track window width
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getYOffset = useCallback(() => {
    if (windowWidth == null) return -180;
    if (windowWidth < 1024) return -165;
    if (windowWidth >= 1024) return -130;
  }, [windowWidth]);

  const scrollToSection = useCallback(
    (sectionId: string) => {
      const section = document.getElementById(sectionId);
      if (!section) return false;
      const y =
        section.getBoundingClientRect().top + window.scrollY + getYOffset();
      window.scrollTo({top: y, behavior: 'smooth'});
      return true;
    },
    [getYOffset],
  );

  const handleScroll = (
    sectionId: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    event.preventDefault();
    scrollToSection(sectionId);
  };

  useEffect(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const saved = (() => {
      try {
        return sessionStorage.getItem('about-scroll-target');
      } catch {
        return null;
      }
    })();

    const hashTarget = location.hash ? location.hash.replace('#', '') : null;
    const target = hashTarget || saved;
    if (!target) return;

    let attempts = 0;
    const maxAttempts = 20;
    const delayMs = 100;

    const tryScroll = () => {
      attempts++;
      const ok = scrollToSection(target);
      if (ok) {
        try {
          sessionStorage.removeItem('about-scroll-target');
        } catch {
          // Ignore sessionStorage removal errors in restricted contexts.
        }
        return;
      }
      if (attempts >= maxAttempts) {
        try {
          sessionStorage.removeItem('about-scroll-target');
        } catch {
          // Ignore sessionStorage removal errors in restricted contexts.
        }
        return;
      }
      retryTimerRef.current = window.setTimeout(tryScroll, delayMs);
    };

    retryTimerRef.current = window.setTimeout(tryScroll, 50);

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [location, scrollToSection]);
  return (
    <SkeletonGate
      isReady={isPageReady}
      skeleton={
        <ProductPageSkeleton
          isVideo={isVideo}
          orientation={!isVideo ? orientation : 'Landscape'}
        />
      }
    >
      {/* Hidden preloader for featured image to trigger skeleton gate */}
      <img
        ref={productImgRef}
        src={currentGateImageUrl}
        alt=""
        style={{
          position: 'absolute',
          width: 0,
          height: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
        onLoad={handleProductImgLoad}
      />
      <>
        <section className="product pt-[20px]">
          {/* Link tree */}
          <ol className="px-[30px] mb-3 flex flex-wrap items-center gap-1.5 break-words text-lg text-muted-foreground sm:gap-2.5">
            <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
              <Link to="/">Home</Link>
            </li>
            <li
              role="presentation"
              aria-hidden="true"
              className="[&>svg]:size-3.5"
            >
              {<ChevronRightIcon />}
            </li>
            {!isVideo && (
              <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Link to="/collections/prints">Prints</Link>
              </li>
            )}
            {isVideo && (
              <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                <Link to="/collections/stock">Stock Footage</Link>
              </li>
            )}
            <li
              role="presentation"
              aria-hidden="true"
              className="[&>svg]:size-3.5"
            >
              {<ChevronRightIcon />}
            </li>
            <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
              {title}
            </li>
          </ol>
          {windowWidth && windowWidth < 1024 && (
            <>
              <br />
              <div className="individual-product-header-container px-[35px]">
                <div className="title-button-wrapper">
                  <span className="capitalize text-3xl font-bold">{title}</span>
                  {renderProductHeaderActionButtons()}
                </div>

                {!isVideo && (
                  <p className="text-muted-foreground">Framed Canvas Print</p>
                )}
                {isVideo && (
                  <p className="text-muted-foreground">
                    {isBundle
                      ? 'Stock Footage Video Bundle'
                      : 'Stock Footage Video'}
                  </p>
                )}
                <ProductPrice
                  price={selectedVariant?.price}
                  compareAtPrice={selectedVariant?.compareAtPrice}
                />
                {(!isVideo || isBundle) && reviewsCount >= 1 && (
                  <a
                    href="#reviews"
                    onClick={(evt) => handleScroll('reviews', evt)}
                    className="inline-block no-underline text-inherit w-fit"
                  >
                    <div className="average-product-rating inline-flex">
                      <div className="inline-flex items-center gap-2">
                        <div
                          className="relative inline-flex h-5 items-center pointer-events-none"
                          aria-hidden="true"
                        >
                          <Rating
                            readOnly
                            value={5}
                            className="text-muted-foreground"
                            aria-label={`Maximum rating of 5 stars`}
                          >
                            {FIVE_STAR_KEYS.map((starKey) => (
                              <RatingButton
                                key={`mobile-max-${starKey}`}
                                className="h-5 w-5 p-0 flex items-center justify-center leading-none"
                              />
                            ))}
                          </Rating>
                          <div
                            className="absolute inset-0 overflow-hidden text-[#d4af37]"
                            style={{width: `${(averageRating / 5) * 100 + 2}%`}}
                          >
                            <Rating readOnly value={5} className="stars">
                              {FIVE_STAR_KEYS.map((starKey) => (
                                <RatingButton
                                  key={`mobile-fill-${starKey}`}
                                  className="h-5 w-5 p-0 flex items-center justify-center leading-none"
                                  aria-label={`Average rating ${formattedAverageRating} out of 5`}
                                />
                              ))}
                            </Rating>
                          </div>
                        </div>
                        <span className="relative inline-flex h-5 items-center text-sm leading-5 text-muted-foreground">
                          {formattedAverageRating} (
                          {reviewsCount === 1
                            ? '1 review'
                            : `${reviewsCount} reviews`}
                          )
                        </span>
                      </div>
                    </div>
                  </a>
                )}
                {isBundle ? (
                  <>
                    <h4 className="text-xl individual-product-location">
                      {activeBundleClip?.clipName ??
                        `Clip ${activeBundleClipIndex}`}
                    </h4>
                    {activeBundleClip?.clipLocation && (
                      <p className="text-muted-foreground text-sm pb-2">
                        {activeBundleClip.clipLocation}
                      </p>
                    )}
                  </>
                ) : (
                  <h4 className="text-xl individual-product-location">
                    {formattedLocation}
                  </h4>
                )}
              </div>
            </>
          )}
          {/* We are not getting a carousel when product only has vertical product images. We might need to conditionally render the individual product with and without giving it standardcarouselimages so it can still render in the absence of these. this means we have to make these optional, not mandatory, to pass into Individualproduct. */}
          <div
            className="lg:grid lg:grid-cols-[60%_40%] min-[1600px]:grid-cols-2 lg:gap-x-1"
            style={productDetailGridStyle}
          >
            {standardCarouselImages && standardCarouselImages?.length > 1 && (
              <IndividualProduct
                productName={title}
                productImages={standardCarouselImages}
                verticalProductImages={standardVerticalCarouselImages}
                orientation={orientation}
                threeDViewImages={threeDImagesToUse}
                allProductImages={allPrintProductImages}
                enableBackgroundImageWarmup={isPageReady && isPrint}
                initialLoadedImages={
                  initialLoadedGateImageUrl
                    ? [{url: initialLoadedGateImageUrl, altText: title}]
                    : []
                }
              ></IndividualProduct>
            )}
            {isVideo && !isBundle && (
              <IndividualVideoProduct
                productName={title}
                featuredImage={featuredImage?.url}
                WMLink={parsedWMLink}
              ></IndividualVideoProduct>
            )}
            {isVideo && isBundle && (
              <IndividualVideoBundle
                productName={title}
                clips={bundleDetailClips}
                activeClipIndex={activeBundleClipIndex}
                onActiveClipChange={setActiveBundleClipIndex}
              />
            )}
            {/* <ProductImage image={selectedVariant?.image} /> */}
            {windowWidth != undefined && windowWidth < 1024 && (
              <div className="product-main px-[35px]">
                {windowWidth && windowWidth >= 1024 && (
                  <>
                    <div className="title-button-wrapper">
                      <span className="capitalize text-3xl font-bold title-text">
                        {title}
                      </span>
                      {renderProductHeaderActionButtons()}
                    </div>

                    {!isVideo && (
                      <p className="text-muted-foreground">
                        Framed Canvas Print
                      </p>
                    )}
                    {isVideo && (
                      <p className="text-muted-foreground">
                        {isBundle
                          ? 'Stock Footage Video Bundle'
                          : 'Stock Footage Video'}
                      </p>
                    )}
                    <ProductPrice
                      price={selectedVariant?.price}
                      compareAtPrice={selectedVariant?.compareAtPrice}
                    />
                    {(!isVideo || isBundle) && reviewsCount >= 1 && (
                      <a
                        href="#reviews"
                        onClick={(evt) => handleScroll('reviews', evt)}
                        className="inline-block no-underline text-inherit w-fit"
                      >
                        <div className="average-product-rating inline-flex">
                          <div className="inline-flex items-center gap-2">
                            <div
                              className="relative inline-flex h-5 items-center pointer-events-none"
                              aria-hidden="true"
                            >
                              <Rating
                                readOnly
                                value={5}
                                className="text-muted-foreground"
                                aria-label={`Maximum rating of 5 stars`}
                              >
                                {FIVE_STAR_KEYS.map((starKey) => (
                                  <RatingButton
                                    key={`desktop-max-${starKey}`}
                                    className="h-5 w-5 p-0 flex items-center justify-center leading-none"
                                  />
                                ))}
                              </Rating>
                              <div
                                className="absolute inset-0 overflow-hidden text-[#d4af37]"
                                style={{
                                  width: `${(averageRating / 5) * 100 + 2}%`,
                                }}
                              >
                                <Rating readOnly value={5} className="stars">
                                  {FIVE_STAR_KEYS.map((starKey) => (
                                    <RatingButton
                                      key={`desktop-fill-${starKey}`}
                                      className="h-5 w-5 p-0 flex items-center justify-center leading-none"
                                      aria-label={`Average rating ${formattedAverageRating} out of 5`}
                                    />
                                  ))}
                                </Rating>
                              </div>
                            </div>
                            <span className="relative inline-flex h-5 items-center text-sm leading-5 text-muted-foreground">
                              {formattedAverageRating} (
                              {reviewsCount === 1
                                ? '1 review'
                                : `${reviewsCount} reviews`}
                              )
                            </span>
                          </div>
                        </div>
                      </a>
                    )}
                    {isBundle ? (
                      <>
                        <h4 className="text-xl individual-product-location">
                          {activeBundleClip?.clipName ??
                            `Clip ${activeBundleClipIndex}`}
                        </h4>
                        {activeBundleClip?.clipLocation && (
                          <p className="text-muted-foreground text-sm pb-2">
                            {activeBundleClip.clipLocation}
                          </p>
                        )}
                      </>
                    ) : (
                      <h4 className="text-xl individual-product-location">
                        {formattedLocation}
                      </h4>
                    )}
                  </>
                )}

                {isBundle && activeBundleClip?.descriptionHtml && (
                  <Card className="mb-2">
                    <CardContent>
                      <div
                        dangerouslySetInnerHTML={{
                          __html: activeBundleClip.descriptionHtml,
                        }}
                      />
                    </CardContent>
                  </Card>
                )}
                {!isBundle && (
                  <Card className="mb-2">
                    <CardContent>
                      <div
                        dangerouslySetInnerHTML={{__html: descriptionHtml}}
                      />
                    </CardContent>
                  </Card>
                )}

                <ProductForm
                  VideoAlreadyInCart={disableButton}
                  cart={cart}
                  productId={product.id}
                  productOptions={productOptions}
                  selectedVariant={selectedVariant}
                  imagesToShow={layoutImagesToUse as SimpleProductImages[]}
                  isVideo={isVideo}
                  isPrint={isPrint}
                  isVideoBundle={isVideoBundle}
                />
              </div>
            )}
            {windowWidth != undefined && windowWidth >= 1024 && (
              <div className="product-main px-[12px]">
                {windowWidth && windowWidth >= 1024 && (
                  <>
                    <div className="title-button-wrapper">
                      <span className="capitalize text-3xl font-bold title-text">
                        {title}
                      </span>
                      {renderProductHeaderActionButtons()}
                    </div>

                    {!isVideo && (
                      <p className="text-muted-foreground">
                        Framed Canvas Print
                      </p>
                    )}
                    {isVideo && (
                      <p className="text-muted-foreground">
                        {isBundle
                          ? 'Stock Footage Video Bundle'
                          : 'Stock Footage Video'}
                      </p>
                    )}
                    <ProductPrice
                      price={selectedVariant?.price}
                      compareAtPrice={selectedVariant?.compareAtPrice}
                    />
                    {(!isVideo || isBundle) && reviewsCount >= 1 && (
                      <a
                        href="#reviews"
                        onClick={(evt) => handleScroll('reviews', evt)}
                        className="inline-block no-underline text-inherit w-fit"
                      >
                        <div className="average-product-rating inline-flex">
                          <div className="inline-flex items-center gap-2">
                            <div
                              className="relative inline-flex h-5 items-center pointer-events-none"
                              aria-hidden="true"
                            >
                              <Rating
                                readOnly
                                value={5}
                                className="text-muted-foreground"
                                aria-label={`Maximum rating of 5 stars`}
                              >
                                {FIVE_STAR_KEYS.map((starKey) => (
                                  <RatingButton
                                    key={`desktop-max-${starKey}`}
                                    className="h-5 w-5 p-0 flex items-center justify-center leading-none"
                                  />
                                ))}
                              </Rating>
                              <div
                                className="absolute inset-0 overflow-hidden text-[#d4af37]"
                                style={{
                                  width: `${(averageRating / 5) * 100 + 2}%`,
                                }}
                              >
                                <Rating readOnly value={5} className="stars">
                                  {FIVE_STAR_KEYS.map((starKey) => (
                                    <RatingButton
                                      key={`desktop-fill-${starKey}`}
                                      className="h-5 w-5 p-0 flex items-center justify-center leading-none"
                                      aria-label={`Average rating ${formattedAverageRating} out of 5`}
                                    />
                                  ))}
                                </Rating>
                              </div>
                            </div>
                            <span className="relative inline-flex h-5 items-center text-sm leading-5 text-muted-foreground">
                              {formattedAverageRating} (
                              {reviewsCount === 1
                                ? '1 review'
                                : `${reviewsCount} reviews`}
                              )
                            </span>
                          </div>
                        </div>
                      </a>
                    )}
                    {isBundle ? (
                      <>
                        <h4 className="text-xl individual-product-location">
                          {activeBundleClip?.clipName ??
                            `Clip ${activeBundleClipIndex}`}
                        </h4>
                        {activeBundleClip?.clipLocation && (
                          <p className="text-muted-foreground text-sm pb-2">
                            {activeBundleClip.clipLocation}
                          </p>
                        )}
                      </>
                    ) : (
                      <h4 className="text-xl individual-product-location">
                        {formattedLocation}
                      </h4>
                    )}
                  </>
                )}

                {isBundle && activeBundleClip?.descriptionHtml && (
                  <div
                    dangerouslySetInnerHTML={{
                      __html: activeBundleClip.descriptionHtml,
                    }}
                  />
                )}
                {!isBundle && (
                  <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
                )}
                <br />

                <ProductForm
                  VideoAlreadyInCart={disableButton}
                  cart={cart}
                  productId={product.id}
                  productOptions={productOptions}
                  selectedVariant={selectedVariant}
                  imagesToShow={layoutImagesToUse as SimpleProductImages[]}
                  isVideo={isVideo}
                  isPrint={isPrint}
                  isVideoBundle={isVideoBundle}
                />
              </div>
            )}
          </div>
          {windowWidth && windowWidth < 1024 && !isVideo && (
            <>
              <hr />
              <div className="manufacturing-info-container grid grid-cols-3 h-[100px] py-3">
                <div className="grid grid-cols-1">
                  <div className="flex justify-center items-center">
                    <img
                      src={
                        'https://downloads.adamunderwater.com/store-1-au/public/usaflag3.png'
                      }
                      alt=""
                      style={{height: '2.2rem'}}
                    />
                  </div>
                  <div className="flex justify-center mt-3">
                    <p>Made in USA</p>
                  </div>
                </div>
                <div className="grid grid-cols-1">
                  <div className="flex justify-center items-center">
                    <img
                      src={
                        'https://downloads.adamunderwater.com/store-1-au/public/diamond.png'
                      }
                      alt=""
                      style={{height: '2.4rem'}}
                    />
                  </div>
                  <div className="flex justify-center mt-2">
                    <p>Premium Quality</p>
                  </div>
                </div>
                <div className="grid grid-cols-1">
                  <div className="flex justify-center items-center">
                    <img
                      src={
                        'https://downloads.adamunderwater.com/store-1-au/public/returnarrow2.png'
                      }
                      alt=""
                      style={{height: '2.7rem'}}
                    />
                  </div>
                  <div className="flex justify-center">
                    <p>14-day returns</p>
                  </div>
                </div>
              </div>
            </>
          )}
          {windowWidth && windowWidth < 1024 && !isVideo && (
            <div className="items-top ">
              <div className="flex justify-end card-accordion-container">
                <Card className="py-2 px-4 mx-[20px] mb-2 w-full">
                  <Accordion type="single" collapsible className="w-full">
                    <AccordionItem value="item-1">
                      <AccordionTrigger className="cursor-pointer">
                        Print Specs
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="print-specs">
                          {/* section body */}
                          <div className="print-specs-container-1">
                            <div className="column-1">
                              <div className="flex justify-center">
                                <img
                                  src={
                                    'https://downloads.adamunderwater.com/store-1-au/public/printingprocess.png'
                                  }
                                  alt=""
                                  style={{height: '2.7rem'}}
                                />
                              </div>
                              <div className="flex justify-center">
                                Printing Process
                              </div>
                              <div className="flex justify-center">
                                <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                  <CardContent>
                                    <div>
                                      Images are printed on the Canon
                                      ImagePro-Graf 4600 Pro and stretched over
                                      thick wooden frames using stretcher
                                      plyers.
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                            <div className="column-2">
                              <div className="flex justify-center">
                                <img
                                  src={
                                    'https://downloads.adamunderwater.com/store-1-au/public/antiglare.png'
                                  }
                                  alt=""
                                  style={{height: '2.7rem'}}
                                />
                              </div>
                              <div className="flex justify-center">
                                Anti-glare
                              </div>
                              <div className="flex justify-center">
                                <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                  <CardContent>
                                    <div>
                                      The professional matte canvas that we use
                                      does not reflect light - the print will be
                                      viewable in any room and any wall.
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </div>
                          <div className="print-specs-container-2">
                            <div className="column-1">
                              <div className="flex justify-center">
                                <img
                                  src={
                                    'https://downloads.adamunderwater.com/store-1-au/public/paperquality2.png'
                                  }
                                  alt=""
                                  style={{height: '2.7rem'}}
                                />
                              </div>
                              <div className="flex justify-center">
                                Paper Quality
                              </div>
                              <div className="flex justify-center">
                                <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                  <CardContent>
                                    <div>
                                      Printed on 200 GSM, polyester inkjet matte
                                      canvas on the Canon ImagePro-graf 4600 on
                                      a 44 inch roll.
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                            <div className="column-2">
                              <div className="flex justify-center">
                                <img
                                  src={
                                    'https://downloads.adamunderwater.com/store-1-au/public/durable.png'
                                  }
                                  alt=""
                                  style={{height: '2.7rem'}}
                                />
                              </div>
                              <div className="flex justify-center">Durable</div>
                              <div className="flex justify-center">
                                <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                  <CardContent>
                                    <div>
                                      Prints are professionally stretched over
                                      heavy duty wooden frames. Staples are
                                      methodically placed to allow even tension
                                      of the canvas.
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="item-2">
                      <AccordionTrigger className="cursor-pointer">
                        Frame Specs
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="frame-specs">
                          {/* section body */}
                          <div className="frame-specs-container-1">
                            <div className="column-1">
                              <div className="flex justify-center">
                                <img
                                  src={
                                    'https://downloads.adamunderwater.com/store-1-au/public/handcrafted.png'
                                  }
                                  alt=""
                                  style={{height: '2.7rem'}}
                                />
                              </div>
                              <div className="flex justify-center">
                                Handcrafted
                              </div>
                              <div className="flex justify-center">
                                <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                  <CardContent>
                                    <div>
                                      Each frame is assembled by hand. Canvas is
                                      stretched over frames using stretcher
                                      plyers, and stapled onto the back frame.
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                            <div className="column-2">
                              <div className="flex justify-center">
                                <img
                                  src={
                                    'https://downloads.adamunderwater.com/store-1-au/public/lightweight.png'
                                  }
                                  alt=""
                                  style={{height: '2.7rem'}}
                                />
                              </div>
                              <div className="flex justify-center">
                                Light Weight
                              </div>
                              <div className="flex justify-center">
                                <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                  <CardContent>
                                    <div>
                                      Heavy duty and high quality canvas
                                      stretcher bars remove the need for extra
                                      wooden braces, reducing weight.
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </div>
                          <div className="frame-specs-container-2">
                            <div className="column-1">
                              <div className="flex justify-center">
                                <img
                                  src={
                                    'https://downloads.adamunderwater.com/store-1-au/public/phonetap.png'
                                  }
                                  alt=""
                                  style={{height: '2.7rem'}}
                                />
                              </div>
                              <div className="flex justify-center">
                                Interactive
                              </div>
                              <div className="flex justify-center">
                                <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                  <CardContent>
                                    <div>
                                      Tap your phone on the bottom right corner
                                      of the canvas to see the latest products
                                      at Adam Underwater.
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                            <div className="column-2">
                              <div className="flex justify-center">
                                <img
                                  src={
                                    'https://downloads.adamunderwater.com/store-1-au/public/readytohang.png'
                                  }
                                  alt=""
                                  style={{height: '2.7rem'}}
                                />
                              </div>
                              <div className="flex justify-center">
                                Ready to Hang
                              </div>
                              <div className="flex justify-center">
                                <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                  <CardContent>
                                    <div>
                                      Wire is installed on the back of each
                                      frame, and hanging materials are included.
                                      We recommend using 2 hangers for large
                                      prints.
                                    </div>
                                  </CardContent>
                                </Card>
                              </div>
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </Card>
              </div>
            </div>
          )}
          {!isVideo && (
            <>
              <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-4 lg:mt-6 extra-info">
                <div className="grid grid-cols-1">
                  <div className="how-its-made">
                    {/* section title */}
                    <div className="section-title-container">
                      <div className="flex items-center justify-center w-full">
                        <div className="flex-1 h-px bg-muted" />
                        <span className="px-4">
                          <div>How it&apos;s Made</div>
                        </span>
                        <div className="flex-1 h-px bg-muted" />
                      </div>
                    </div>
                    {/* section body */}
                    <div className="how-its-made-container">
                      <div className="how-its-made-clip-wrapper flex justify-center position-relative">
                        <div className="grid grid-cols-1 px-2 product-carousel-container relative w-[96%] max-w-full mx-auto">
                          <div className="bundle-detail-carousel">
                            <div className="bundle-detail-media-frame">
                              <div className="bundle-detail-main-media flex items-center justify-center">
                                <iframe
                                  className="bundle-detail-iframe"
                                  src="https://player.vimeo.com/video/814128392?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
                                  allow="autoplay; fullscreen; picture-in-picture;"
                                  title="Seaforestation Trailer"
                                  loading="lazy"
                                ></iframe>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-center ">
                        <div className="how-its-made-description-container justify-start xl:mt-2">
                          <Card className="mx-4">
                            <CardContent>
                              Quality matters - In this video, I break down how
                              I make each framed canvas print by hand, using
                              premium materials.
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 self-start content-start">
                  <div className="pt-[10px]">
                    {windowWidth && windowWidth >= 1024 && !isVideo && (
                      <>
                        <hr />
                        <div className="manufacturing-info-container grid grid-cols-3 h-[100px] py-3">
                          <div className="grid grid-cols-1">
                            <div className="flex justify-center items-center">
                              <img
                                src={
                                  'https://downloads.adamunderwater.com/store-1-au/public/usaflag3.png'
                                }
                                alt=""
                                style={{height: '2.2rem'}}
                              />
                            </div>
                            <div className="flex justify-center mt-3">
                              <p>Made in USA</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1">
                            <div className="flex justify-center items-center">
                              <img
                                src={
                                  'https://downloads.adamunderwater.com/store-1-au/public/diamond.png'
                                }
                                alt=""
                                style={{height: '2.4rem'}}
                              />
                            </div>
                            <div className="flex justify-center mt-2">
                              <p>Premium Quality</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1">
                            <div className="flex justify-center items-center">
                              <img
                                src={
                                  'https://downloads.adamunderwater.com/store-1-au/public/returnarrow2.png'
                                }
                                alt=""
                                style={{height: '2.7rem'}}
                              />
                            </div>
                            <div className="flex justify-center">
                              <p>14-day returns</p>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  {windowWidth && windowWidth >= 1024 && !isVideo && (
                    <div className="items-top ">
                      <div className="flex justify-end card-accordion-container me-3">
                        <Card className="py-2 px-4 w-full">
                          <Accordion
                            type="single"
                            collapsible
                            className="w-full"
                          >
                            <AccordionItem value="item-1">
                              <AccordionTrigger className="cursor-pointer">
                                Print Specs
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="print-specs">
                                  {/* section body */}
                                  <div className="print-specs-container-1">
                                    <div className="column-1">
                                      <div className="flex justify-center">
                                        <img
                                          src={
                                            'https://downloads.adamunderwater.com/store-1-au/public/printingprocess.png'
                                          }
                                          alt=""
                                          style={{height: '2.7rem'}}
                                        />
                                      </div>
                                      <div className="flex justify-center">
                                        Printing Process
                                      </div>
                                      <div className="flex justify-center">
                                        <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                          <CardContent>
                                            <div>
                                              Images are printed on the Canon
                                              ImagePro-Graf 4600 Pro and
                                              stretched over thick wooden frames
                                              using stretcher plyers.
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </div>
                                    <div className="column-2">
                                      <div className="flex justify-center">
                                        <img
                                          src={
                                            'https://downloads.adamunderwater.com/store-1-au/public/antiglare.png'
                                          }
                                          alt=""
                                          style={{height: '2.7rem'}}
                                        />
                                      </div>
                                      <div className="flex justify-center">
                                        Anti-glare
                                      </div>
                                      <div className="flex justify-center">
                                        <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                          <CardContent>
                                            <div>
                                              The professional matte canvas that
                                              we use does not reflect light -
                                              the print will be viewable in any
                                              room and any wall.
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="print-specs-container-2">
                                    <div className="column-1">
                                      <div className="flex justify-center">
                                        <img
                                          src={
                                            'https://downloads.adamunderwater.com/store-1-au/public/paperquality2.png'
                                          }
                                          alt=""
                                          style={{height: '2.7rem'}}
                                        />
                                      </div>
                                      <div className="flex justify-center">
                                        Paper Quality
                                      </div>
                                      <div className="flex justify-center">
                                        <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                          <CardContent>
                                            <div>
                                              Printed on 200 GSM, polyester
                                              inkjet matte canvas on the Canon
                                              ImagePro-graf 4600 on a 44 inch
                                              roll.
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </div>
                                    <div className="column-2">
                                      <div className="flex justify-center">
                                        <img
                                          src={
                                            'https://downloads.adamunderwater.com/store-1-au/public/durable.png'
                                          }
                                          alt=""
                                          style={{height: '2.7rem'}}
                                        />
                                      </div>
                                      <div className="flex justify-center">
                                        Durable
                                      </div>
                                      <div className="flex justify-center">
                                        <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                          <CardContent>
                                            <div>
                                              Prints are professionally
                                              stretched over heavy duty wooden
                                              frames. Staples are methodically
                                              placed to allow even tension of
                                              the canvas.
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2">
                              <AccordionTrigger className="cursor-pointer">
                                Frame Specs
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="frame-specs">
                                  {/* section body */}
                                  <div className="frame-specs-container-1">
                                    <div className="column-1">
                                      <div className="flex justify-center">
                                        <img
                                          src={
                                            'https://downloads.adamunderwater.com/store-1-au/public/handcrafted.png'
                                          }
                                          alt=""
                                          style={{height: '2.7rem'}}
                                        />
                                      </div>
                                      <div className="flex justify-center">
                                        Handcrafted
                                      </div>
                                      <div className="flex justify-center">
                                        <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                          <CardContent>
                                            <div>
                                              Each frame is assembled by hand.
                                              Canvas is stretched over frames
                                              using stretcher plyers, and
                                              stapled onto the back frame.
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </div>
                                    <div className="column-2">
                                      <div className="flex justify-center">
                                        <img
                                          src={
                                            'https://downloads.adamunderwater.com/store-1-au/public/lightweight.png'
                                          }
                                          alt=""
                                          style={{height: '2.7rem'}}
                                        />
                                      </div>
                                      <div className="flex justify-center">
                                        Light Weight
                                      </div>
                                      <div className="flex justify-center">
                                        <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] my-2">
                                          <CardContent>
                                            <div>
                                              Heavy duty and high quality canvas
                                              stretcher bars remove the need for
                                              extra wooden braces, reducing
                                              weight.
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="frame-specs-container-2">
                                    <div className="column-1">
                                      <div className="flex justify-center">
                                        <img
                                          src={
                                            'https://downloads.adamunderwater.com/store-1-au/public/phonetap.png'
                                          }
                                          alt=""
                                          style={{height: '2.7rem'}}
                                        />
                                      </div>
                                      <div className="flex justify-center">
                                        Interactive
                                      </div>
                                      <div className="flex justify-center">
                                        <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                          <CardContent>
                                            <div>
                                              Tap your phone on the bottom right
                                              corner of the canvas to see the
                                              latest products at Adam
                                              Underwater.
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </div>
                                    <div className="column-2">
                                      <div className="flex justify-center">
                                        <img
                                          src={
                                            'https://downloads.adamunderwater.com/store-1-au/public/readytohang.png'
                                          }
                                          alt=""
                                          style={{height: '2.7rem'}}
                                        />
                                      </div>
                                      <div className="flex justify-center">
                                        Ready to Hang
                                      </div>
                                      <div className="flex justify-center">
                                        <Card className="w-[180px] md:w-[300px] lg:w-[190px] xl:w-[250px] mt-2">
                                          <CardContent>
                                            <div>
                                              Wire is installed on the back of
                                              each frame, and hanging materials
                                              are included. We recommend using 2
                                              hangers for large prints.
                                            </div>
                                          </CardContent>
                                        </Card>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          </Accordion>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {!isVideo && (
            <section className="in-the-box-section mt-3">
              {/* section title */}
              <div className="section-title-container">
                <div className="flex items-center justify-center w-full">
                  <div className="flex-1 h-px bg-muted" />
                  <span className="px-4">
                    <p className="text-xl">In the Box</p>
                  </span>
                  <div className="flex-1 h-px bg-muted" />
                </div>
              </div>

              <div className="gap-x-5 py-5">
                <ThreeUpCarouselBox cards={cards} />
              </div>
            </section>
          )}
          {!isVideo && (
            <section className="reviews mt-3">
              {/* section title */}
              <div className="section-title-container">
                <div className="flex items-center justify-center w-full">
                  <div className="flex-1 h-px bg-muted" />
                  <span className="px-4">
                    <p className="text-xl">Reviews for this Product</p>
                  </span>
                  <div className="flex-1 h-px bg-muted" />
                </div>
              </div>
              <div className="flex justify-center pt-2">
                <div className="average-product-rating">
                  <div className="flex items-center gap-2">
                    <div
                      className="relative inline-flex h-5 items-center"
                      aria-hidden="true"
                    >
                      <Rating
                        readOnly
                        value={5}
                        className="text-muted-foreground"
                        aria-label={`Maximum rating of 5 stars`}
                      >
                        {FIVE_STAR_KEYS.map((starKey) => (
                          <RatingButton
                            key={`reviews-max-${starKey}`}
                            className="h-5 w-5 p-0 flex items-center justify-center leading-none"
                          />
                        ))}
                      </Rating>
                      <div
                        className="absolute inset-0 overflow-hidden text-[#d4af37]"
                        style={{width: `${(averageRating / 5) * 100 + 2}%`}}
                      >
                        <Rating readOnly value={5} className="stars">
                          {FIVE_STAR_KEYS.map((starKey) => (
                            <RatingButton
                              key={`reviews-fill-${starKey}`}
                              className="h-5 w-5 p-0 flex items-center justify-center leading-none"
                              aria-label={`Average rating ${formattedAverageRating} out of 5`}
                            />
                          ))}
                        </Rating>
                      </div>
                    </div>
                    <span className="relative inline-flex h-5 items-center text-sm leading-5 text-muted-foreground">
                      {formattedAverageRating} (
                      {reviewsCount === 1
                        ? '1 review'
                        : `${reviewsCount} reviews`}
                      )
                    </span>
                  </div>
                </div>
              </div>
              <div className="my-5" id="reviews">
                <ProductReviewsCarousel
                  reviews={reviewsList}
                  currentCustomerId={customerId}
                  currentCustomerState={customerState}
                  currentCustomerCountry={customerCountry}
                  onRemove={handleRemoveReview}
                  onEdit={handleEditReview}
                  isAdmin={isAdmin}
                />
                <ReviewForm
                  productId={product.id}
                  productName={product.title}
                  customerId={customerId}
                  customerName={customerName}
                  customerState={customerState}
                  customerCountry={customerCountry}
                  updateExistingReviews={updateExistingReviews}
                  userReviewExists={userReviewExists}
                  isBlocked={isBlocked}
                />
              </div>
            </section>
          )}
          {isVideo && activeVideoSwipeComparison && (
            <VideoResolutionSwipeSection
              vidKey={activeVideoSwipeComparison.vidKey}
              higherResolutionLabel={activeVideoSwipeComparison.higherResolutionLabel}
            />
          )}
          <section className="you-may-also-like mt-3">
            {/* section title */}
            <div className="section-title-container">
              <div className="flex items-center justify-center w-full">
                <div className="flex-1 h-px bg-muted" />
                <span className="px-4">
                  <p className="text-xl">You may also like</p>
                </span>
                <div className="flex-1 h-px bg-muted" />
              </div>
            </div>
            <div className="you-may-also-like-container flex justify-center mt-3">
              {/* {!isVideo && (
              <SimpleRecommendedProducts
                products={recommendedProducts}
                isVideo={!isVideo}
              />
            )} */}

              <SimpleRecommendedProducts
                products={recommendedProducts}
                isVideo={isVideo}
                currentProductID={product.id}
                cart={cart}
                isLoggedIn={isLoggedIn}
                wishlistProducts={wishlistProducts}
              />
            </div>
          </section>

          <Analytics.ProductView
            data={{
              products: [
                {
                  id: product.id,
                  title: product.title,
                  price: selectedVariant?.price.amount || '0',
                  vendor: product.vendor,
                  variantId: selectedVariant?.id || '',
                  variantTitle: selectedVariant?.title || '',
                  quantity: 1,
                },
              ],
            }}
          />
          <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Share this product</DialogTitle>
              </DialogHeader>
              <div className="grid gap-2 pt-1">
                {shareOptions.map((option) => (
                  <Button
                    key={option.label}
                    type="button"
                    variant="outline"
                    onClick={option.onClick}
                    className="justify-start"
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </section>
      </>
    </SkeletonGate>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;
// changing the first first: number changes how many images get snet back
const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    tags
    vendor
    handle
    descriptionHtml
    description
    featuredImage{
      url
    }
    encodedVariantExistence
    encodedVariantAvailability
    images(first: 250) {
      nodes {
        url
        altText
        width
        height
      }
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
              altText
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

export const PRODUCT_QUERY = `#graphql
  query ProductByHandleForProductRoute(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
      collections(first: 250) {
        edges {
          node {
            title
            metafield(namespace: "custom", key: "multiple_images") {
              namespace
              key
              value
              references(first: 250) {
                nodes {
                  ... on MediaImage {
                    id
                    image {
                      url
                      altText
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
