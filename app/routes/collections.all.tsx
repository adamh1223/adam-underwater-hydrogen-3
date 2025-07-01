import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, Link, type MetaFunction} from '@remix-run/react';
import {getPaginationVariables, Image, Money} from '@shopify/hydrogen';
import type {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel';
import {Card, CardContent} from '~/components/ui/card';
import {Button} from '~/components/ui/button';
import {ChevronLeftIcon, ChevronRightIcon} from 'lucide-react';
import {useEffect, useState} from 'react';

export const meta: MetaFunction<typeof loader> = () => {
  return [{title: `Hydrogen | Products`}];
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
async function loadCriticalData({context, request}: LoaderFunctionArgs) {
  const {storefront} = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  const [{products}] = await Promise.all([
    storefront.query(CATALOG_QUERY, {
      variables: {...paginationVariables},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);
  return {products};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({context}: LoaderFunctionArgs) {
  return {};
}

export default function Collection() {
  const {products} = useLoaderData<typeof loader>();
  console.log(products, '292929');

  return (
    <div className="pt-12 mx-8 grid gap-4 md:grid-cols-2 px-5 pb-5">
      <PaginatedResourceSection
        connection={products}
        resourcesClassName="products-grid"
      >
        {({node: product, index}) => (
          <ProductItem
            key={product.id}
            product={product}
            loading={index < 8 ? 'eager' : undefined}
          />
        )}
      </PaginatedResourceSection>
    </div>
  );
}
type shopifyImage = {url: string; altText: string};
function ProductItem({
  product,
  loading,
}: {
  product: ProductItemFragment & {images: {nodes: shopifyImage[]}};
  loading?: 'eager' | 'lazy';
}) {
  const variantUrl = useVariantUrl(product.handle);
  const standardImages = product.images.nodes.filter((item) =>
    item.altText?.includes('standard'),
  );
  console.log(standardImages, '202020');
  const [carouselApi, setcarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setcurrentIndex] = useState(0);
  const [totalItems, settotalItems] = useState(0);
  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setcurrentIndex(carouselApi.selectedScrollSnap());
      settotalItems(carouselApi.scrollSnapList().length);
    };

    updateCarouselState();

    carouselApi.on('select', updateCarouselState);

    return () => {
      carouselApi.off('select', updateCarouselState); // Clean up on unmount
    };
  }, [carouselApi]);
  const scrollToIndex = (index: number) => {
    carouselApi?.scrollTo(index);
  };
  const increaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex + 1);
  };
  const decreaseIndex = (evt: React.MouseEvent<HTMLButtonElement>) => {
    evt.stopPropagation();
    scrollToIndex(currentIndex - 1);
  };

  return (
    <article className="group relative">
      <Card className="group-hover:shadow-xl transition-shadow duration-500">
        <CardContent className="p-4">
          <div className="relative h-full w-full rounded">
            <Carousel
              // ref={carouselRef}
              // opts={{
              //   align: 'start',
              //   startIndex: count,
              // }}
              setApi={setcarouselApi}
              className="w-full max-w-7xl transform-none me-4"
            >
              <Link
                className="product-item"
                key={product.id}
                prefetch="intent"
                to={variantUrl}
              >
                <CarouselContent>
                  {standardImages.map((url, idx) => (
                    <CarouselItem
                      className="flex items-center justify-center"
                      key={idx}
                    >
                      <div className="w-[90%] p-4 flex items-center justify-center">
                        <img
                          src={url.url}
                          alt=""
                          className="max-h-full object-contain"
                        />
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Link>
            </Carousel>
            <div className="absolute inset-0 z-40 flex items-center justify-between pointer-events-none">
              <Button
                onClick={decreaseIndex}
                className="pointer-events-auto rounded-full w-8 h-8 p-0 mx-[-8px] shadow-none"
                variant="secondary"
              >
                <ChevronLeftIcon className="h-6 w-6 text-white"></ChevronLeftIcon>
              </Button>
              <Button
                onClick={increaseIndex}
                className="pointer-events-auto rounded-full w-8 h-8 p-0 mx-[-8px] shadow-none"
                variant="secondary"
              >
                <ChevronRightIcon className="h-6 w-6 text-white"></ChevronRightIcon>
              </Button>
            </div>
            <h4>{product.title}</h4>
            <small>
              <Money data={product.priceRange.minVariantPrice} />
            </small>
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

const PRODUCT_ITEM_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment ProductItem on Product {
    id
    handle
    title
    featuredImage {
      id
      altText
      url
      width
      height
    }
    images(first: 20) {
      nodes {
        url
        altText
      }
    }
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2024-01/objects/product
const CATALOG_QUERY = `#graphql
  query Catalog(
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    products(first: $first, last: $last, before: $startCursor, after: $endCursor) {
      nodes {
        ...ProductItem
      }
      pageInfo {
        hasPreviousPage
        hasNextPage
        startCursor
        endCursor
      }
    }
  }
  ${PRODUCT_ITEM_FRAGMENT}
` as const;
