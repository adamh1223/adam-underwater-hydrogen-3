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
  StarIcon,
} from 'lucide-react';
import {Card, CardContent, CardHeader} from '~/components/ui/card';
import IndividualVideoProduct from '~/components/eproducts/IndividualVideoProduct';
import {ProductImages, SimpleProductImages} from '~/lib/types';
import {useEffect, useRef, useState} from 'react';
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
import ThreeUpCarouselBox from '~/components/global/ThreeUpCarouselBox';
import ReviewForm from '~/components/form/ReviewForm';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import ProductReviewsCarousel from '~/components/global/ProductReviewsCarousel';
import {Rating, RatingButton} from 'components/ui/shadcn-io/rating';
import {ReloadIcon} from '@radix-ui/react-icons';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [
    {title: `Hydrogen | ${data?.product.title ?? ''}`},
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

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
  const {handle} = params;
  const {storefront, cart} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    storefront.query(RECOMMENDED_PRODUCTS_QUERY),
    // Add other queries here, so that they are loaded in parallel
  ]);
  const reviews = await context.storefront.query(GET_REVIEW_QUERY, {
    variables: {productId: product.id},
  });

  if (!product?.id) {
    throw new Response(null, {status: 404});
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
  } = useLoaderData<typeof loader>();
  const isInWishlist = wishlistProducts.includes(product?.id);
  const isAdmin =
    customer?.customer?.id === 'gid://shopify/Customer/7968375079049';

  const customerId = customer?.customer?.id ?? '';
  console.log(customer, 'customer');

  const customerFirstName = customer?.customer?.firstName ?? '';
  const customerLastName = customer?.customer?.lastName ?? '';
  const customerName = `${customerFirstName} ${customerLastName}`.trim();

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

  const isVideo = product.tags.includes('Video');

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
      icon: '/1x-icon-2.png',
      title: 'Canvas Print',
      description:
        'Each framed print comes with heavy duty hanging wire attached',
      image: '/gear1.png',
    },
    {
      icon: '/1x-icon-2.png',
      title: 'NFC Tags',
      description:
        'Try tapping your phone to the bottom right corner of the frame',
      image: '/gear1.png',
    },
    {
      icon: '/2x-icon.png',
      title: 'Hangers and nails',
      description: 'Each print comes with 2 sets of picture hangers and nails',
      image: '/hangers-image.png',
    },
    {
      icon: '/4x-icon.png',
      title: 'Command Strips',
      description:
        'Each shipment comes with velcro 4 command strips to secure the print flush on the wall.',
      image: '/gear1.png',
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
  console.log(customer, 'customer');

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
  const [wishlistItem, setWishlistItem] = useState(isInWishlist);
  const [pendingWishlistChange, setPendingWishlistChange] = useState(false);

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

  const location = useLocation();

  const retryTimerRef = useRef<number | null>(null);

  // Track window width
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getYOffset = () => {
    if (windowWidth == null) return -180;
    if (windowWidth < 1024) return -165;
    if (windowWidth >= 1024) return -130;
  };

  const scrollToSection = (sectionId: string) => {
    const section = document.getElementById(sectionId);
    if (!section) return false;
    const y =
      section.getBoundingClientRect().top + window.scrollY + getYOffset();
    window.scrollTo({top: y, behavior: 'smooth'});
    return true;
  };

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
        } catch {}
        return;
      }
      if (attempts >= maxAttempts) {
        try {
          sessionStorage.removeItem('about-scroll-target');
        } catch {}
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
  }, [location, windowWidth]);
  return (
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
            <div className='individual-product-header-container px-[35px]'>

            <div className="title-button-wrapper">
              <span className="capitalize text-3xl font-bold">{title}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={
                        wishlistItem ? removeFromFavorites : addToFavorites
                      }
                      className="cursor-pointer p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer relative z-50"
                    >
                      {pendingWishlistChange ? (
                        <ReloadIcon className="animate-spin" />
                      ) : (
                        <>
                          {wishlistItem ? (
                            <FaHeart />
                          ) : (
                            <>
                              {isLoggedIn ? (
                                <FaRegHeart />
                              ) : (
                                <Link to="/account/login">
                                  <FaRegHeart />
                                </Link>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-sm z-1000">
                    {wishlistItem
                      ? 'Remove from Favorites'
                      : 'Save to Favorites'}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {!isVideo && (
              <p className="text-muted-foreground">Framed Canvas Print</p>
            )}
            {isVideo && (
              <p className="text-muted-foreground">Stock Footage Video</p>
            )}
            <ProductPrice
              price={selectedVariant?.price}
              compareAtPrice={selectedVariant?.compareAtPrice}
            />
            {!isVideo && reviewsCount >= 1 && (
              <a
                href="#reviews"
                onClick={(evt) => handleScroll('reviews', evt)}
                className="no-underline text-inherit"
              >
                <div className="average-product-rating">
                  <div className="flex items-center gap-2">
                    <div
                      className="relative flex items-center"
                      aria-hidden="true"
                    >
                      <Rating
                        readOnly
                        value={5}
                        className="text-muted-foreground"
                        aria-label={`Maximum rating of 5 stars`}
                      >
                        {Array.from({length: 5}).map((_, index) => (
                          <RatingButton key={index} className="h-5 w-5 p-0.5" />
                        ))}
                      </Rating>
                      <div
                        className="absolute inset-0 overflow-hidden text-yellow-400"
                        style={{width: `${(averageRating / 5) * 100 + 2}%`}}
                      >
                        <Rating readOnly value={5} className="stars">
                          {Array.from({length: 5}).map((_, index) => (
                            <RatingButton
                              key={index}
                              className="h-5 w-5 p-0.5"
                              aria-label={`Average rating ${formattedAverageRating} out of 5`}
                            />
                          ))}
                        </Rating>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
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
            <h4 className="text-xl mt-1 pb-4">{`${formattedLocation}`}</h4>
            </div>
          </>
        )}
        {/* We are not getting a carousel when product only has vertical product images. We might need to conditionally render the individual product with and without giving it standardcarouselimages so it can still render in the absence of these. this means we have to make these optional, not mandatory, to pass into Individualproduct. */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 px-[35px]">
          {standardCarouselImages && standardCarouselImages?.length > 1 && (
            <IndividualProduct
              productName={title}
              productImages={standardCarouselImages}
              verticalProductImages={standardVerticalCarouselImages}
              orientation={orientation}
              threeDViewImages={threeDImagesToUse}
            ></IndividualProduct>
          )}
          {isVideo && (
            <IndividualVideoProduct
              productName={title}
              featuredImage={featuredImage?.url}
              WMLink={parsedWMLink}
            ></IndividualVideoProduct>
          )}
          {/* <ProductImage image={selectedVariant?.image} /> */}
          <div className="product-main">
            {windowWidth && windowWidth >= 1024 && (
              <>
                <div className="title-button-wrapper">
                  <span className="capitalize text-3xl font-bold title-text">
                    {title}
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={
                            wishlistItem ? removeFromFavorites : addToFavorites
                          }
                          className="cursor-pointer p-2 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer relative z-50"
                        >
                          {pendingWishlistChange ? (
                            <ReloadIcon className="animate-spin" />
                          ) : (
                            <>
                              {wishlistItem ? (
                                <FaHeart />
                              ) : (
                                <>
                                  {isLoggedIn ? (
                                    <FaRegHeart />
                                  ) : (
                                    <Link to="/account/login">
                                      <FaRegHeart />
                                    </Link>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-sm z-1000">
                        {wishlistItem
                          ? 'Remove from Favorites'
                          : 'Save to Favorites'}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {!isVideo && (
                  <p className="text-muted-foreground">Framed Canvas Print</p>
                )}
                {isVideo && (
                  <p className="text-muted-foreground">Stock Footage Video</p>
                )}
                <ProductPrice
                  price={selectedVariant?.price}
                  compareAtPrice={selectedVariant?.compareAtPrice}
                />
                {!isVideo && reviewsCount >= 1 && (
                  <a
                    href="#reviews"
                    onClick={(evt) => handleScroll('reviews', evt)}
                    className="no-underline text-inherit"
                  >
                    <div className="average-product-rating">
                      <div className="flex items-center gap-2">
                        <div
                          className="relative flex items-center"
                          aria-hidden="true"
                        >
                          <Rating
                            readOnly
                            value={5}
                            className="text-muted-foreground"
                            aria-label={`Maximum rating of 5 stars`}
                          >
                            {Array.from({length: 5}).map((_, index) => (
                              <RatingButton
                                key={index}
                                className="h-5 w-5 p-0.5"
                              />
                            ))}
                          </Rating>
                          <div
                            className="absolute inset-0 overflow-hidden text-yellow-400"
                            style={{width: `${(averageRating / 5) * 100 + 2}%`}}
                          >
                            <Rating readOnly value={5} className="stars">
                              {Array.from({length: 5}).map((_, index) => (
                                <RatingButton
                                  key={index}
                                  className="h-5 w-5 p-0.5"
                                  aria-label={`Average rating ${formattedAverageRating} out of 5`}
                                />
                              ))}
                            </Rating>
                          </div>
                        </div>
                        <span className="text-sm text-muted-foreground">
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
                <h4 className="text-xl mt-1 pb-4">{`${formattedLocation}`}</h4>
              </>
            )}

            <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
            <br />

            <ProductForm
              VideoAlreadyInCart={disableButton}
              productOptions={productOptions}
              selectedVariant={selectedVariant}
              imagesToShow={layoutImagesToUse as SimpleProductImages[]}
            />
          </div>
        </div>
        {windowWidth && windowWidth < 1024 && !isVideo && (
          <>
            <hr />
            <div className="manufacturing-info-container grid grid-cols-3 h-[100px] py-3">
              <div className="grid grid-cols-1">
                <div className="flex justify-center items-center">
                  <img src={'/usaflag3.png'} style={{height: '2.2rem'}} />
                </div>
                <div className="flex justify-center mt-3">
                  <p>Made in USA</p>
                </div>
              </div>
              <div className="grid grid-cols-1">
                <div className="flex justify-center items-center">
                  <img src={'/diamond.png'} style={{height: '2.4rem'}} />
                </div>
                <div className="flex justify-center mt-2">
                  <p>Premium Quality</p>
                </div>
              </div>
              <div className="grid grid-cols-1">
                <div className="flex justify-center items-center">
                  <img src={'/returnarrow2.png'} style={{height: '2.7rem'}} />
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
                    <AccordionTrigger>Print Specs</AccordionTrigger>
                    <AccordionContent>
                      <div className="print-specs">
                        {/* section body */}
                        <div className="print-specs-container-1">
                          <div className="column-1">
                            <div className="flex justify-center">
                              <img
                                src={'/printingprocess.png'}
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
                                    thick wooden frames using stretcher plyers.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          <div className="column-2">
                            <div className="flex justify-center">
                              <img
                                src={'/antiglare.png'}
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
                                src={'/paperquality2.png'}
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
                                    canvas on the Canon ImagePro-graf 4600 on a
                                    44 inch roll.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          <div className="column-2">
                            <div className="flex justify-center">
                              <img
                                src={'/durable.png'}
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
                                    methodically placed to allow even tension of
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
                    <AccordionTrigger>Frame Specs</AccordionTrigger>
                    <AccordionContent>
                      <div className="frame-specs">
                        {/* section body */}
                        <div className="frame-specs-container-1">
                          <div className="column-1">
                            <div className="flex justify-center">
                              <img
                                src={'/handcrafted.png'}
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
                                src={'/lightweight.png'}
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
                                    Heavy duty and high quality canvas stretcher
                                    bars remove the need for extra wooden
                                    braces, reducing weight.
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
                                src={'/phonetap.png'}
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
                                    Tap your phone on the bottom right corner of
                                    the canvas to see the latest products at
                                    Adam Underwater.
                                  </div>
                                </CardContent>
                              </Card>
                            </div>
                          </div>
                          <div className="column-2">
                            <div className="flex justify-center">
                              <img
                                src={'/readytohang.png'}
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
                                    Wire is installed on the back of each frame,
                                    and hanging materials are included. We
                                    recommend using 2 hangers for large prints.
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
            <div className="lg:grid lg:grid-cols-2 lg:gap-x-12 extra-info">
              <div className="grid grid-cols-1">
                <div className="how-its-made">
                  {/* section title */}
                  <div className="section-title-container">
                    <div className="flex items-center justify-center w-full">
                      <div className="flex-1 h-px bg-muted" />
                      <span className="px-4">
                        <div>How it's Made</div>
                      </span>
                      <div className="flex-1 h-px bg-muted" />
                    </div>
                  </div>
                  {/* section body */}
                  <div className="how-its-made-container">
                    <div className="how-its-made-clip-wrapper flex justify-center position-relative">
                      <iframe
                        className="how-its-made-clip"
                        src="https://player.vimeo.com/video/814128392?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479"
                        allow="autoplay; fullscreen; picture-in-picture;"
                        title="Seaforestation Trailer"
                      ></iframe>
                    </div>
                    <div className="flex justify-center ">
                      <div className="how-its-made-description-container justify-start xl:mt-2">
                        <Card className='mx-4'>
                          <CardContent>
                            Quality matters - In this video, I break down how I
                            make each framed canvas print by hand, using premium
                            materials.
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1">
                <div className="pt-[10px]">
                  {windowWidth && windowWidth >= 1024 && !isVideo && (
                    <>
                      <hr />
                      <div className="manufacturing-info-container grid grid-cols-3 h-[100px] py-3">
                        <div className="grid grid-cols-1">
                          <div className="flex justify-center items-center">
                            <img
                              src={'/usaflag3.png'}
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
                              src={'/diamond.png'}
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
                              src={'/returnarrow2.png'}
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
                    <div className="flex justify-end card-accordion-container">
                      <Card className="py-2 px-4 w-full">
                        <Accordion type="single" collapsible className="w-full">
                          <AccordionItem value="item-1">
                            <AccordionTrigger>Print Specs</AccordionTrigger>
                            <AccordionContent>
                              <div className="print-specs">
                                {/* section body */}
                                <div className="print-specs-container-1">
                                  <div className="column-1">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/printingprocess.png'}
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
                                            ImagePro-Graf 4600 Pro and stretched
                                            over thick wooden frames using
                                            stretcher plyers.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                  <div className="column-2">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/antiglare.png'}
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
                                            we use does not reflect light - the
                                            print will be viewable in any room
                                            and any wall.
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
                                        src={'/paperquality2.png'}
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
                                            Printed on 200 GSM, polyester inkjet
                                            matte canvas on the Canon
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
                                        src={'/durable.png'}
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
                                            Prints are professionally stretched
                                            over heavy duty wooden frames.
                                            Staples are methodically placed to
                                            allow even tension of the canvas.
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
                            <AccordionTrigger>Frame Specs</AccordionTrigger>
                            <AccordionContent>
                              <div className="frame-specs">
                                {/* section body */}
                                <div className="frame-specs-container-1">
                                  <div className="column-1">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/handcrafted.png'}
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
                                            using stretcher plyers, and stapled
                                            onto the back frame.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                  <div className="column-2">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/lightweight.png'}
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
                                        src={'/phonetap.png'}
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
                                            latest products at Adam Underwater.
                                          </div>
                                        </CardContent>
                                      </Card>
                                    </div>
                                  </div>
                                  <div className="column-2">
                                    <div className="flex justify-center">
                                      <img
                                        src={'/readytohang.png'}
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
            <div className='flex justify-center pt-2'>

            <div className="average-product-rating">
                  <div className="flex items-center gap-2">
                    <div
                      className="relative flex items-center"
                      aria-hidden="true"
                    >
                      <Rating
                        readOnly
                        value={5}
                        className="text-muted-foreground"
                        aria-label={`Maximum rating of 5 stars`}
                      >
                        {Array.from({length: 5}).map((_, index) => (
                          <RatingButton key={index} className="h-5 w-5 p-0.5" />
                        ))}
                      </Rating>
                      <div
                        className="absolute inset-0 overflow-hidden text-yellow-400"
                        style={{width: `${(averageRating / 5) * 100 + 2}%`}}
                      >
                        <Rating readOnly value={5} className="stars">
                          {Array.from({length: 5}).map((_, index) => (
                            <RatingButton
                              key={index}
                              className="h-5 w-5 p-0.5"
                              aria-label={`Average rating ${formattedAverageRating} out of 5`}
                            />
                          ))}
                        </Rating>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
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
                onRemove={handleRemoveReview}
                onEdit={handleEditReview}
                isAdmin={isAdmin}
              />
              <ReviewForm
                productId={product.id}
                productName={product.title}
                customerId={customerId}
                customerName={customerName}
                updateExistingReviews={updateExistingReviews}
                userReviewExists={userReviewExists}
                isBlocked={isBlocked}
              />
            </div>
          </section>
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
      </section>
    </>
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
  query Product(
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
