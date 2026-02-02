import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {
  useLoaderData,
  Link,
  type MetaFunction,
  useSearchParams,
  Form,
} from '@remix-run/react';
import {
  getPaginationVariables,
  Image,
  Money,
  Analytics,
  getProductOptions,
  useOptimisticVariant,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
  getSelectedProductOptions,
} from '@shopify/hydrogen';
import type {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {PaginatedResourceSection} from '~/components/PaginatedResourceSection';
import {Card} from '~/components/ui/card';
import ProductsHeader from '~/components/products/productsHeader';
import EProductsHeader from '~/components/eproducts/EProductsHeader';
import ProductCarousel from '~/components/products/productCarousel';
import {Separator} from '~/components/ui/separator';
import {useEffect, useId, useState} from 'react';
import {Button} from '~/components/ui/button';
import {LuLayoutGrid, LuList} from 'react-icons/lu';
import {Input} from '~/components/ui/input';
import {SearchFormPredictive} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import EProductsContainer from '~/components/eproducts/EProductsContainer';
import {capitalizeFirstLetter} from '~/utils/grammer';
import {EnhancedPartialSearchResult} from '~/lib/types';
import Product from './products.$handle';
import {Checkbox} from '~/components/ui/checkbox';
import ToggleSwitch from '~/components/global/ToggleSwitch';
import Collections from './collections._index';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import RecommendedProducts from '~/components/products/recommendedProducts';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [{title: `Adam Underwater | ${data?.collection?.title ?? ''} Collection`}];
};

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte

  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);
  let customer = null;
  try {
    customer = await args.context.customerAccount.query(CUSTOMER_WISHLIST);
    
  } catch (error) {
    console.warn('Not logged in');
    customer = null;
  }
  if (!customer) {
    return {
      ...deferredData,
      ...criticalData,
      wishlistProducts: undefined,
      isLoggedIn: undefined,
    };
  }
  

  const isLoggedIn = args.context.customerAccount.isLoggedIn();

  // if (!customer.data.customer.metafield?.value) {
  //   return [];
  // }
  let wishlistProducts: string[];
  const customerMetafieldValue =
    customer.data.customer.metafield?.value ?? undefined;
  if (customerMetafieldValue) {
    wishlistProducts = JSON.parse(customerMetafieldValue) as string[];
  } else {
    wishlistProducts = [];
  }
  console.log(wishlistProducts, '444wishlist');
  
  

  return {...deferredData, ...criticalData, wishlistProducts, isLoggedIn};
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
  

  const url = new URL(request.url);
  const searchTerm = url.searchParams.get('q')?.trim() || '';
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 250,
  });

  if (!handle) {
    throw redirect('/collections');
  }
  const filters: {tag?: string; query?: string}[] = [];
  if (searchTerm) {
    filters.push({tag: searchTerm});
  }

  const [{collection}] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: {
        handle,
        ...paginationVariables,
        filter: filters.length ? filters : undefined,
      },
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response(`Collection ${handle} not found`, {
      status: 404,
    });
  }

  return {
    collection,
    searchTerm,
    cart: cart.get(),
  };
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
  const {collection, searchTerm, cart, wishlistProducts, isLoggedIn} =
    useLoaderData<typeof loader>();
  

  const [searchParams] = useSearchParams();
  const currentSearchTerm = searchParams.get('q') || '';
  const [searchText, setSearchText] = useState<string | undefined>();

  // const isHorOnly = collection?.nodes?.map((p: any) =>
  //   p.tags.includes('horOnly'),
  // );
  // const isHorPrimary = collection?.nodes?.map((p: any) =>
  //   p.tags.includes('horPrimary'),
  // );

  // collection.products.nodes = isHorPrimary;
  // const isVertOnly = collection?.nodes?.map((p: any) =>
  //   p.tags.includes('vertOnly'),
  // );
  // const isVertPrimary = collection?.nodes?.map((p: any) =>
  //   p.tags.includes('vertPrimary'),
  // );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchText(e.target.value);
    if (searchText && searchText?.length > 4) {
      
    }
  };

  // Add other queries here, so that they are loaded in parallel

  useEffect(() => {
    setSearchText('');
  }, [collection?.handle]);
  useEffect(() => {
    if (searchText === '') {
      setTotalProductCount(collection?.products?.nodes?.length);
    }
  }, [searchText]);
  const [layout, setLayout] = useState('grid');
  const handleLayoutChange = () => {
    if (layout === 'grid') {
      setLayout('list');
    } else {
      setLayout('grid');
    }
  };

  const layoutClassName =
    layout === 'grid' ? 'prods-grid gap-x-5' : 'mt-[12px] grid';

  type shopifyImage = {url: string; altText: string};
  const queriesDatalistId = useId();
  const [filterState, setFilterState] = useState('All');
  const [stockFilterState, setStockFilterState] = useState('All Clips');
  const [productState, setProductState] = useState(collection?.products);
  const [totalProductCount, setTotalProductCount] = useState(
    productState?.nodes?.length,
  );
  useEffect(() => {
    let filteredCollection = collection?.products?.nodes;

    if (collection?.handle === 'prints') {
      filteredCollection = collection?.products?.nodes?.filter((p: any) => {
        if (filterState === 'All') {
          return (
            p.tags.includes('horOnly') ||
            p.tags.includes('horPrimary') ||
            p.tags.includes('vertOnly') ||
            p.tags.includes('vertPrimary')
          );
        }
        if (filterState === 'Horizontal') {
          return p.tags.includes('horOnly') || p.tags.includes('horPrimary');
        }
        if (filterState === 'Vertical') {
          return p.tags.includes('vertOnly') || p.tags.includes('vertPrimary');
        }
      });
    }

    if (collection?.handle === 'stock') {
      filteredCollection = collection?.products?.nodes?.filter((p: any) => {
        if (stockFilterState === 'All Clips') {
          return p.tags.includes('Video') && !p.tags.includes('Bundle');
        }
        if (stockFilterState === 'Discounted Bundles') {
          return p.tags.includes('Bundle');
        }
        return true;
      });
    }

    setProductState((state: any) => ({
      ...state,
      nodes: filteredCollection,
    }));
    setTotalProductCount(filteredCollection?.length);
  }, [collection?.handle, collection?.products?.nodes, filterState, stockFilterState]);

  useEffect(() => {
    

    setTotalProductCount(collection?.products?.nodes?.length);
    setStockFilterState('All Clips')
  }, [collection?.handle]);

  
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  useEffect(() => {
    setProductState(collection?.products);
  }, [collection?.handle]);

  return (
    <div>
      {collection?.handle === 'prints' && <ProductsHeader />}
      {collection?.handle === 'stock' && <EProductsHeader />}

      {collection?.handle === 'prints' && (
        <div>
          <p className="text-lg flex justify-center py-3">
            Filter By Orientation:
          </p>
          <div className="flex justify-center pb-3">
            <ToggleSwitch updateState={setFilterState} />
          </div>
          <div className="flex justify-center">
            <div className="flex justify-center w-100 md:w-132 lg:w-148">
              <p>
                Many horizontal prints <strong>are also available</strong> in
                vertical on the product page
              </p>
            </div>
          </div>
          {/* <div className="flex justify-start items-center">
              <Checkbox />

              <p className="ms-1">Horizontal</p>
            </div>
            <div className="flex justify-start items-center">
              <Checkbox />
              <p className="ms-1">Vertical</p>
            </div> */}
        </div>
      )}
      {collection?.handle === 'stock' && (
        <div className="flex justify-center py-2">
          <div className="toggle-container">
            <button
              className={`toggle-option ${stockFilterState === 'All Clips' ? 'selected' : ''}`}
              onClick={() => setStockFilterState('All Clips')}
            >
              All Clips
            </button>
            <button
              className={`toggle-option ${stockFilterState === 'Discounted Bundles' ? 'selected' : ''}`}
              onClick={() => setStockFilterState('Discounted Bundles')}
            >
              Discounted Bundles
            </button>
          </div>
        </div>
      )}
      {windowWidth != undefined && windowWidth > 600 && (
        <div className="counter-search-toggle-container ">
          <div className="product-counter-container">
            <div className="flex flex-col items-end">
              <h4 className="font-medium text-xl">
                {totalProductCount} product{totalProductCount > 1 && 's'}
              </h4>
            </div>
          </div>
          <div className="search-product-container">
            <div className="flex flex-col items-center mt-[25px]">
              <SearchFormPredictive>
                {({fetchResults, inputRef}) => {
                  const handleInput = (
                    e: React.ChangeEvent<HTMLInputElement>,
                  ) => {
                    setSearchText(e.target.value);
                    fetchResults(e);
                  };

                  return (
                    <>
                      <div className="flex justify-center items-center">
                        <Input
                          className="search-input w-[260px]"
                          name="q"
                          onChange={handleInput}
                          onFocus={handleInput}
                          placeholder="Search Product"
                          ref={inputRef}
                          type="search"
                          value={searchText ?? ''}
                          list={queriesDatalistId}
                        />
                      </div>
                      &nbsp;
                    </>
                  );
                }}
              </SearchFormPredictive>
            </div>
          </div>

          <div className="grid-list-toggle-container flex gap-x-4">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={
                      layout === 'grid'
                        ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md'
                        : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer'
                    }
                    onClick={() => {
                      if (layout !== 'grid') {
                        handleLayoutChange();
                      }
                    }}
                  >
                    <LuLayoutGrid />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-sm z-1000">
                  Grid View
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={
                      layout === 'list'
                        ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md ms-1'
                        : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer ms-1'
                    }
                    onClick={() => {
                      if (layout !== 'list') {
                        handleLayoutChange();
                      }
                    }}
                  >
                    <LuList />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-sm z-1000">
                  List View
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      )}
      {windowWidth != undefined && windowWidth <= 600 && (
        <>
          <div className="counter-search-toggle-container">
            <div className="top-row">
              <div className="search-center">
                <div className="search-product-container">
                  <div className="flex flex-col items-center mt-[25px]">
                    <SearchFormPredictive>
                      {({fetchResults, inputRef}) => {
                        const handleInput = (
                          e: React.ChangeEvent<HTMLInputElement>,
                        ) => {
                          setSearchText(e.target.value);
                          fetchResults(e);
                        };

                        return (
                          <>
                            <div className="flex justify-center items-center">
                              <Input
                                className="search-input w-[260px]"
                                name="q"
                                onChange={handleInput}
                                onFocus={handleInput}
                                placeholder="Search Product"
                                ref={inputRef}
                                type="search"
                                value={searchText ?? ''}
                                list={queriesDatalistId}
                              />
                            </div>
                            &nbsp;
                          </>
                        );
                      }}
                    </SearchFormPredictive>
                  </div>
                </div>
              </div>
            </div>

            <div className="bottom-row">
              <div className="product-count">
                <div className="product-counter-container">
                  <div className="flex flex-col items-end">
                    <h4 className="font-medium text-xl">
                      {totalProductCount} product{totalProductCount > 1 && 's'}
                    </h4>
                  </div>
                </div>
              </div>
              <div className="layout-toggle">
                <div className="grid-list-toggle-container flex gap-x-4">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={
                            layout === 'grid'
                              ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md'
                              : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer'
                          }
                          onClick={() => {
                            if (layout !== 'grid') {
                              handleLayoutChange();
                            }
                          }}
                        >
                          <LuLayoutGrid />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-sm z-1000">
                        Grid View
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className={
                            layout === 'list'
                              ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md ms-1'
                              : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer ms-1'
                          }
                          onClick={() => {
                            if (layout !== 'list') {
                              handleLayoutChange();
                            }
                          }}
                        >
                          <LuList />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-sm">
                        List View
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <Separator className="mt-4" />
      <div className={layoutClassName}>
        {searchText && (
          // <SearchResultsPredictive>
          //   {({items, total, term, state, closeSearch}) => {
          //     const {articles, collections, pages, products, queries} = items;
          

          //     if (state === 'loading' && term.current) {
          //       return <div>Loading...</div>;
          //     }

          //     if (!total) {
          //       return <SearchResultsPredictive.Empty term={term} />;
          //     }

          //     return (
          //       <>
          //         <SearchResultsPredictive.Products
          //           products={products}
          //           layout={layout}
          //           closeSearch={closeSearch}
          //           term={term}
          //         />
          //       </>
          //     );
          //   }}
          // </SearchResultsPredictive>

          <SearchResultsPredictive>
            {({items, total, term, state, closeSearch}) => {
              const {articles, collections, pages, products, queries} = items;
              

              const extraTags: string[] = [];
              const collectionName = capitalizeFirstLetter(collection?.title);
              if (collectionName === 'Stock') {
                extraTags.push('Video');
                // For other types of EProducts, push that tag here
              }
              const filteredProducts = products.filter((product) =>
                product?.tags?.includes(collectionName),
              );
              const extraFilteredProducts =
                extraTags?.length > 0
                  ? products.filter((product) =>
                      product?.tags?.some((tag) => extraTags.includes(tag)),
                    )
                  : [];
              const combinedProductSearches = [
                ...filteredProducts,
                ...extraFilteredProducts,
              ];
              const stockFilteredSearches =
                collection?.handle === 'stock'
                  ? combinedProductSearches.filter((product) => {
                      if (stockFilterState === 'All Clips') {
                        return (
                          product.tags.includes('Video') &&
                          !product.tags.includes('Bundle')
                        );
                      }
                      if (stockFilterState === 'Discounted Bundles') {
                        return product.tags.includes('Bundle');
                      }
                      return true;
                    })
                  : combinedProductSearches;

              setTotalProductCount(stockFilteredSearches?.length);

              if (state === 'loading' && term.current) {
                return <div>Loading...</div>;
              }

              if (!total) {
                return <SearchResultsPredictive.Empty term={term} />;
              }

              return (
                <>
                  <SearchResultsPredictive.Products
                    products={
                      stockFilteredSearches as unknown as EnhancedPartialSearchResult[]
                    }
                    layout={layout}
                    term={term}
                    collectionHandle={collection?.handle}
                    cart={cart}
                    wishlistProducts={wishlistProducts as string[]}
                    isLoggedIn={isLoggedIn}
                  />
                </>
              );
            }}
          </SearchResultsPredictive>
        )}
        {!searchText && (
          <PaginatedResourceSection
            connection={productState}
            resourcesClassName="products-grid"
          >
            {({
              node: product,
              index,
            }: {
              node: ProductItemFragment & {
                images: {nodes: shopifyImage[]};
                descriptionHtml?: string;
              };
              index: number;
            }) => {
              console.log(wishlistProducts, '777wp');
              console.log(product, '777p');
              
              const isInWishlist = wishlistProducts?.includes(
                product?.id,
                
                
              ) as boolean;
              console.log(isInWishlist, '77iw');
              return (
                <>
                  {collection?.handle === 'prints' && (
                    <ProductCarousel
                     key={product.id}
                      product={product}
                      layout={layout}
                      isInWishlist={isInWishlist}
                      isLoggedIn={isLoggedIn}
                    />
                  )}
                  {collection?.handle === 'stock' && (
                    <EProductsContainer
                    key={product.id}
                      product={product}
                      layout={layout}
                      cart={cart}
                      isInWishlist={isInWishlist}
                      isLoggedIn={isLoggedIn}
                    />
                  )}
                </>
              );
            }}
          </PaginatedResourceSection>
        )}
        <Analytics.CollectionView
          data={{
            collection: {
              id: collection?.id,
              handle: collection?.handle,
            },
          }}
        />
      </div>
      {/* {collection?.handle === 'stock' && <RecommendedProducts
        products={data?.recommendedProducts}
        isLoggedIn={data.isLoggedIn}
      />} */}
      {/* add recommendedproducts to bottom of stock footage page */}
    </div>
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
    tags
    descriptionHtml
    featuredImage {
      id
      altText
      url
      width
      height
    }
    selectedOrFirstAvailableVariant(
      selectedOptions: []
      ignoreUnknownOptions: false
      caseInsensitiveMatch: true
    ) {
      id
      image {
        url
        altText
        width
        height
      }
      price {
        amount
        currencyCode
      }
      compareAtPrice {
      amount
      currencyCode
    }
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

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $filter: [ProductFilter!]
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor,
        filters: $filter
      ) {
        nodes {
          ...ProductItem
          descriptionHtml
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }

  
` as const;
// tack on selectedvariants even if theres none
