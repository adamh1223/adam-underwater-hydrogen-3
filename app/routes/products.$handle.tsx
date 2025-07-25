import {type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {useLoaderData, type MetaFunction, Link} from '@remix-run/react';
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
import {ChevronRightIcon} from 'lucide-react';
import {Card} from '~/components/ui/card';
import IndividualVideoProduct from '~/components/eproducts/IndividualVideoProduct';

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
  const {storefront} = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{product}] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: {handle, selectedOptions: getSelectedProductOptions(request)},
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!product?.id) {
    throw new Response(null, {status: 404});
  }

  return {
    product,
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

  return {};
}

export default function Product() {
  const {product} = useLoaderData<typeof loader>();

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

  const {title, descriptionHtml, collections, images, featuredImage} = product;
  const productSizeMetafields = collections?.edges?.[2]?.node?.metafield;
  const {references} = productSizeMetafields || {};
  const threeColumnImages = references?.nodes?.filter((item: any) => {
    if (item.image.altText?.includes('3')) {
      return {
        image: {
          url: item.image.url,
          altText: item.image.altText,
        },
      };
    }
  });
  const twoColumnImages = references?.nodes?.filter((item: any) => {
    if (item.image.altText?.includes('2')) {
      return {
        image: {
          url: item.image.url,
          altText: item.image.altText,
        },
      };
    }
  });
  const standardImages = references?.nodes?.filter((item: any) => {
    if (item.image.altText?.includes('1')) {
      return {
        image: {
          url: item.image.url,
          altText: item.image.altText,
        },
      };
    }
  });

  const determineLayoutImages = (variant: any) => {
    const layout = variant.title.split(' / ')[0];
    if (layout === 'Standard') {
      return standardImages;
    } else if (layout === 'two columns') {
      return twoColumnImages;
    } else if (layout === 'three columns') {
      return threeColumnImages;
    }
  };

  let layoutImagesToUse = determineLayoutImages(selectedVariant);
  // const imageURLs = images.nodes.map((item: {url: string}) => item.url);
  // console.log(product, '12121212');
  // const imagesToUse = images.nodes.map(
  //   (item: {url: string; altText: string}) => {
  //     if (selectedVariant.title.toLowerCase() === item.altText.split('_')[0]) {
  //       return item.url;
  //     }
  //   },
  // );

  const standardCarouselImages = images.nodes
    .map((image: any) => {
      if (image.altText?.includes('carousel')) {
        return image;
      }
    })
    .filter(Boolean);

  standardCarouselImages.unshift(selectedVariant?.image);
  const isVideo = product.tags[0] === 'EProduct';
  // .includes((word: string) => {
  //   console.log(word, '3000');

  //   return word === 'Video';
  // });
  console.log(standardCarouselImages, '2000');

  const locationTag = product.tags
    .find((word: string) => word.includes('loc'))
    ?.split('_');
  const locationName = locationTag
    ?.slice(1, locationTag.length - 2)
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  const locationState = locationTag
    ?.slice(locationTag.length - 2, locationTag.length - 1)
    .map((word: string) => word.toUpperCase());
  const locationCountry = locationTag
    ?.slice(locationTag.length - 1, locationTag.length)
    .map((word: string) => word.toUpperCase());

  return (
    <section className="product px-[60px] pt-[40px]">
      {/* Link tree */}
      <ol className="flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5">
        <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
          <Link to="/">Home</Link>
        </li>
        <li role="presentation" aria-hidden="true" className="[&>svg]:size-3.5">
          {<ChevronRightIcon />}
        </li>
        <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
          <Link to="/collections/all">Products</Link>
        </li>
        <li role="presentation" aria-hidden="true" className="[&>svg]:size-3.5">
          {<ChevronRightIcon />}
        </li>
        <li className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
          <Link to="/">{title}</Link>
        </li>
      </ol>
      <div className="xl:grid xl:grid-cols-2 xl:gap-x-24">
        {standardCarouselImages && standardCarouselImages?.length > 1 && (
          <IndividualProduct
            productName={title}
            productImages={standardCarouselImages}
          ></IndividualProduct>
        )}
        {isVideo && (
          <IndividualVideoProduct
            productName={title}
            featuredImage={featuredImage?.url}
          ></IndividualVideoProduct>
        )}
        {/* <ProductImage image={selectedVariant?.image} /> */}
        <div className="product-main">
          <h1 className="capitalize text-3xl font-bold">{title}</h1>
          <ProductPrice
            price={selectedVariant?.price}
            compareAtPrice={selectedVariant?.compareAtPrice}
          />
          <br />
          <h4 className="text-xl mt-2">{`${locationName}, ${locationState}, ${locationCountry}`}</h4>
          <ProductForm
            productOptions={productOptions}
            selectedVariant={selectedVariant}
            imagesToShow={layoutImagesToUse}
          />
          <br />
          <br />
          <p>
            <strong>Description</strong>
          </p>
          <br />
          <div dangerouslySetInnerHTML={{__html: descriptionHtml}} />
          <br />
        </div>
      </div>
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
    images(first: 10) {
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

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
      collections(first: 10) {
        edges {
          node {
            title
            metafield(namespace: "custom", key: "multiple_images") {
              namespace
              key
              value
              references(first: 10) {
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
