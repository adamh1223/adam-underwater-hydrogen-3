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
import {LuZoomIn, LuZoomOut} from 'react-icons/lu';
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
import {applyHighestResolutionVariantToProducts} from '~/lib/resolution';

export const meta: MetaFunction<typeof loader> = ({data}) => {
  return [
    {title: `Adam Underwater | ${data?.collection?.title ?? ''} Collection`},
  ];
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

  if (Array.isArray(collection?.products?.nodes)) {
    collection.products.nodes = applyHighestResolutionVariantToProducts(
      collection.products.nodes as any[],
    );
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
      setTotalProductCount(productState?.nodes?.length);
    }
  }, [searchText]);
  type PrintsFilterState = 'All' | 'Horizontal' | 'Vertical';
  type StockFilterState = 'All Clips' | 'Discounted Bundles';

  const LAYOUT_STORAGE_KEY = 'collection-layout-mode';
  const PRINTS_FILTER_STORAGE_KEY = 'collection-prints-filter-mode';
  const STOCK_FILTER_STORAGE_KEY = 'collection-stock-filter-mode';
  const [layout, setLayout] = useState('grid');
  const [hasInitializedLayout, setHasInitializedLayout] = useState(false);
  const [hasInitializedPrintsFilter, setHasInitializedPrintsFilter] =
    useState(false);
  const [hasInitializedStockFilter, setHasInitializedStockFilter] =
    useState(false);
  const setGridLayout = () => setLayout('grid');
  const setListLayout = () => setLayout('list');
  const gridViewTooltip = 'Keyboard shortcut: =';
  const listViewTooltip = 'Keyboard shortcut: -';

  useEffect(() => {
    try {
      const savedLayout = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (savedLayout === 'grid' || savedLayout === 'list') {
        setLayout(savedLayout);
      }
    } catch {
      // Ignore storage access errors (private mode, etc.)
    } finally {
      setHasInitializedLayout(true);
    }
  }, []);

  useEffect(() => {
    if (!hasInitializedLayout) return;
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, layout);
    } catch {
      // Ignore storage access errors (private mode, etc.)
    }
  }, [hasInitializedLayout, layout]);

  const isPrintsListLayout =
    collection?.handle === 'prints' && layout === 'list';
  const isStockListLayout =
    collection?.handle === 'stock' && layout === 'list';
  const isPrintsGridLayout =
    collection?.handle === 'prints' && layout === 'grid';
  const isStockGridLayout =
    collection?.handle === 'stock' && layout === 'grid';
  const layoutClassName =
    layout === 'grid'
      ? 'prods-grid gap-x-2'
      : isPrintsListLayout
        ? 'mt-[10px] mx-[10px] grid print-list-grid gap-2'
        : isStockListLayout
          ? 'mt-[10px] mx-[10px] grid eproduct-list-grid gap-2'
          : 'mt-[12px] grid';

  type shopifyImage = {url: string; altText: string};
  const queriesDatalistId = useId();
  const [filterState, setFilterState] = useState<PrintsFilterState>('All');
  const [stockFilterState, setStockFilterState] =
    useState<StockFilterState>('All Clips');
  const [productState, setProductState] = useState(collection?.products);
  const [totalProductCount, setTotalProductCount] = useState(
    productState?.nodes?.length,
  );

  useEffect(() => {
    if (collection?.handle !== 'prints') {
      setHasInitializedPrintsFilter(false);
      return;
    }

    try {
      const savedPrintsFilter = window.localStorage.getItem(
        PRINTS_FILTER_STORAGE_KEY,
      );
      if (
        savedPrintsFilter === 'All' ||
        savedPrintsFilter === 'Horizontal' ||
        savedPrintsFilter === 'Vertical'
      ) {
        setFilterState(savedPrintsFilter);
      } else {
        setFilterState('All');
      }
    } catch {
      setFilterState('All');
    } finally {
      setHasInitializedPrintsFilter(true);
    }
  }, [collection?.handle]);

  useEffect(() => {
    if (collection?.handle !== 'prints' || !hasInitializedPrintsFilter) return;
    try {
      window.localStorage.setItem(PRINTS_FILTER_STORAGE_KEY, filterState);
    } catch {
      // Ignore storage access errors (private mode, etc.)
    }
  }, [collection?.handle, filterState, hasInitializedPrintsFilter]);

  useEffect(() => {
    if (collection?.handle !== 'stock') {
      setHasInitializedStockFilter(false);
      return;
    }

    try {
      const savedStockFilter = window.localStorage.getItem(
        STOCK_FILTER_STORAGE_KEY,
      );
      if (
        savedStockFilter === 'All Clips' ||
        savedStockFilter === 'Discounted Bundles'
      ) {
        setStockFilterState(savedStockFilter);
      } else {
        setStockFilterState('All Clips');
      }
    } catch {
      setStockFilterState('All Clips');
    } finally {
      setHasInitializedStockFilter(true);
    }
  }, [collection?.handle]);

  useEffect(() => {
    if (collection?.handle !== 'stock' || !hasInitializedStockFilter) return;
    try {
      window.localStorage.setItem(STOCK_FILTER_STORAGE_KEY, stockFilterState);
    } catch {
      // Ignore storage access errors (private mode, etc.)
    }
  }, [collection?.handle, stockFilterState, hasInitializedStockFilter]);

  useEffect(() => {
    const baseConnection = collection?.products;
    if (!baseConnection) return;

    let filteredCollection = baseConnection.nodes;

    if (collection?.handle === 'prints') {
      filteredCollection = baseConnection.nodes?.filter((p: any) => {
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
      filteredCollection = baseConnection.nodes?.filter((p: any) => {
        if (stockFilterState === 'All Clips') {
          return p.tags.includes('Video') && !p.tags.includes('Bundle');
        }
        if (stockFilterState === 'Discounted Bundles') {
          return p.tags.includes('Bundle');
        }
        return true;
      });
    }

    setProductState({
      ...baseConnection,
      nodes: filteredCollection,
    });
    setTotalProductCount(filteredCollection?.length);
  }, [collection?.handle, collection?.products, filterState, stockFilterState]);

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  const gridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;
  const productsContainerStyle =
    (isPrintsGridLayout || isStockGridLayout) && layout === 'grid'
      ? {gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`}
      : undefined;
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  useEffect(() => {
    const isSupportedCollection =
      collection?.handle === 'prints' || collection?.handle === 'stock';
    if (!isSupportedCollection) return;

    const handleViewShortcut = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT'
      ) {
        return;
      }

      if (
        event.key === '-' ||
        event.key === '_' ||
        event.code === 'NumpadSubtract'
      ) {
        event.preventDefault();
        setListLayout();
        return;
      }

      if (
        event.key === '=' ||
        event.key === '+' ||
        event.code === 'NumpadAdd'
      ) {
        event.preventDefault();
        setGridLayout();
        return;
      }

      const key = event.key.toLowerCase();

      if (collection?.handle === 'stock') {
        if (key === 'a') {
          event.preventDefault();
          setStockFilterState('All Clips');
          return;
        }

        if (key === 'd') {
          event.preventDefault();
          setStockFilterState('Discounted Bundles');
          return;
        }
      }

      if (collection?.handle === 'prints') {
        if (key === 'a') {
          event.preventDefault();
          setFilterState('All');
          return;
        }

        if (key === 'h') {
          event.preventDefault();
          setFilterState('Horizontal');
          return;
        }

        if (key === 'v') {
          event.preventDefault();
          setFilterState('Vertical');
        }
      }
    };

    window.addEventListener('keydown', handleViewShortcut);
    return () => window.removeEventListener('keydown', handleViewShortcut);
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
            <ToggleSwitch selected={filterState} onChange={setFilterState} />
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
          <TooltipProvider>
            <div className="toggle-container">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`toggle-option ${stockFilterState === 'All Clips' ? 'selected' : ''}`}
                    onClick={() => setStockFilterState('All Clips')}
                  >
                    All Clips
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-sm z-1000">
                  Keyboard shortcut: a
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`toggle-option ${stockFilterState === 'Discounted Bundles' ? 'selected' : ''}`}
                    onClick={() => setStockFilterState('Discounted Bundles')}
                  >
                    Discounted Bundles
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-sm z-1000">
                  Keyboard shortcut: d
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
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
                      layout === 'list'
                        ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md'
                        : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer'
                    }
                    onClick={() => {
                      if (layout !== 'list') {
                        setListLayout();
                      }
                    }}
                  >
                    <LuZoomOut />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-sm z-1000">
                  {listViewTooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

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
                        setGridLayout();
                      }
                    }}
                  >
                    <LuZoomIn />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-sm z-1000">
                  {gridViewTooltip}
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
                            layout === 'list'
                              ? 'bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 rounded-md'
                              : 'hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 rounded-md cursor-pointer'
                          }
                          onClick={() => {
                            if (layout !== 'list') {
                              setListLayout();
                            }
                          }}
                        >
                          <LuZoomOut />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-sm z-1000">
                        {listViewTooltip}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>

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
                              setGridLayout();
                            }
                          }}
                        >
                          <LuZoomIn />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-sm">
                        {gridViewTooltip}
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
      <div className={layoutClassName} style={productsContainerStyle}>
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
              const isInWishlist = wishlistProducts?.includes(
                product?.id,
              ) as boolean;

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
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          id
          availableForSale
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
