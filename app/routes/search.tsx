import {
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from '@shopify/remix-oxygen';
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  type MetaFunction,
} from '@remix-run/react';
import {getPaginationVariables, Analytics} from '@shopify/hydrogen';
import {SearchResults} from '~/components/SearchResults';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import {
  type RegularSearchReturn,
  type PredictiveSearchReturn,
  getEmptyPredictiveSearchResult,
} from '~/lib/search';
import {Button} from '~/components/ui/button';
import {useCallback, useEffect, useId, useRef, useState} from 'react';
import {CUSTOMER_WISHLIST} from '~/lib/customerQueries';
import SearchPageSkeleton from '~/components/skeletons/SearchPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {applyHighestResolutionVariantToProducts} from '~/lib/resolution';
import {EnhancedPartialSearchResult} from '~/lib/types';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '~/components/ui/input-group';
import {LuSearch} from 'react-icons/lu';

export const meta: MetaFunction = () => {
  return [{title: `Adam Underwater | Search`}];
};

export async function loader({request, context}: LoaderFunctionArgs) {
  const {storefront, cart} = context;

  const url = new URL(request.url);
  const isPredictive = url.searchParams.has('predictive');
  const searchPromise: Promise<PredictiveSearchReturn | RegularSearchReturn> =
    isPredictive
      ? predictiveSearch({request, context})
      : regularSearch({request, context});

  searchPromise.catch((error: Error) => {
    console.error(error);
    return {term: '', result: null, error: error.message};
  });
  const promiseResult = await searchPromise;
  let customer = null;
  try {
    customer = await context.customerAccount.query(CUSTOMER_WISHLIST);
  } catch (error) {
    console.warn('Not logged in');
    customer = null;
  }
  if (!customer) {
    return {
      ...promiseResult,
      cart: cart.get(),
      wishlistProducts: undefined,
      isLoggedIn: undefined,
    };
  }
  const isLoggedIn = context.customerAccount.isLoggedIn();

  let wishlistProducts: string[];
  const customerMetafieldValue =
    customer.data.customer.metafield?.value ?? undefined;
  if (customerMetafieldValue) {
    wishlistProducts = JSON.parse(customerMetafieldValue) as string[];
  } else {
    wishlistProducts = [];
  }

  return {...promiseResult, cart: cart.get(), wishlistProducts, isLoggedIn};
}

/**
 * Renders the /search route
 */
export default function SearchPage() {
  // const {type, term, result, error, cart} = useLoaderData<typeof loader>();
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const {type, term, result, error, cart, isLoggedIn, wishlistProducts} = data;

  const queriesDatalistId = useId();
  const predictiveFetcher = useFetcher<PredictiveSearchReturn>({
    key: 'search-page',
  });

  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledLoad = useRef(false);
  const searchImgRef = useRef<HTMLImageElement>(null);
  const [searchText, setSearchText] = useState(term);
  const [isPredictiveMode, setIsPredictiveMode] = useState(false);
  const [committedPredictiveResult, setCommittedPredictiveResult] = useState(
    getEmptyPredictiveSearchResult(),
  );

  const handleSearchImgLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  useEffect(() => {
    const img = searchImgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleSearchImgLoad();
    }
  }, [handleSearchImgLoad]);

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // When URL q changes (including from aside submit), sync the page input.
    setSearchText(term);
    setIsPredictiveMode(false);
    setCommittedPredictiveResult(getEmptyPredictiveSearchResult());
  }, [term]);

  const gridColumnCount =
    windowWidth != undefined
      ? Math.max(1, Math.floor((windowWidth - 1) / 700) + 1)
      : 1;

  const runPredictiveSearch = useCallback(
    (value: string) => {
      predictiveFetcher.submit(
        {
          q: value,
          predictive: true,
        },
        {method: 'GET', action: '/search'},
      );
    },
    [predictiveFetcher],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.value;
    setSearchText(nextValue);
    setIsPredictiveMode(true);
    runPredictiveSearch(nextValue);
  };

  const handleInputFocus = () => {
    if (!searchText?.trim()) return;
    setIsPredictiveMode(true);
    runPredictiveSearch(searchText.trim());
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedValue = searchText?.trim() ?? '';
    setIsPredictiveMode(false);
    navigate(`/search${trimmedValue ? `?q=${encodeURIComponent(trimmedValue)}` : ''}`);
  };

  const activePredictiveTerm =
    predictiveFetcher.state === 'loading' || predictiveFetcher.state === 'submitting'
      ? String(predictiveFetcher.formData?.get('q') ?? '').trim()
      : searchText.trim();
  const hasPredictiveResponseForInput =
    predictiveFetcher.data?.type === 'predictive' &&
    predictiveFetcher.data.term === activePredictiveTerm;
  const latestPredictiveResult =
    hasPredictiveResponseForInput && predictiveFetcher.data?.result
      ? predictiveFetcher.data.result
      : getEmptyPredictiveSearchResult();
  const hasPredictiveTerm = searchText.trim().length > 0;

  useEffect(() => {
    if (!isPredictiveMode || !hasPredictiveTerm) {
      setCommittedPredictiveResult(getEmptyPredictiveSearchResult());
      return;
    }
    if (predictiveFetcher.state !== 'idle') return;
    if (predictiveFetcher.data?.type !== 'predictive') return;
    if (predictiveFetcher.data.term !== searchText.trim()) return;

    setCommittedPredictiveResult(predictiveFetcher.data.result);
  }, [
    isPredictiveMode,
    hasPredictiveTerm,
    predictiveFetcher.state,
    predictiveFetcher.data,
    searchText,
  ]);

  const predictiveResult =
    predictiveFetcher.state === 'idle' && hasPredictiveResponseForInput
      ? latestPredictiveResult
      : committedPredictiveResult;
  const predictiveProducts = (predictiveResult.items.products ??
    []) as unknown as EnhancedPartialSearchResult[];
  const predictiveQueries = predictiveResult.items.queries ?? [];
  const showPredictiveResults = isPredictiveMode;
  const showPredictiveEmpty =
    showPredictiveResults &&
    hasPredictiveTerm &&
    predictiveFetcher.state === 'idle' &&
    hasPredictiveResponseForInput &&
    predictiveResult.total === 0;
  const showPredictiveLoading =
    showPredictiveResults &&
    hasPredictiveTerm &&
    predictiveFetcher.state !== 'idle' &&
    predictiveProducts.length === 0;
  const predictiveProductCount = predictiveProducts.length;
  const regularProductCount = result?.items?.products?.nodes?.length ?? 0;
  const displayedProductCount = showPredictiveResults
    ? predictiveProductCount
    : regularProductCount;
  const hasPrintProducts = predictiveProducts.some((product) =>
    product.tags.includes('Prints'),
  );
  const hasVideoProducts = predictiveProducts.some((product) =>
    product.tags.includes('Video'),
  );
  const predictiveGridClassName = [
    'prods-grid',
    'gap-x-2',
    hasPrintProducts && hasVideoProducts ? 'mixed-product-grid' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const predictiveGridStyle =
    windowWidth != undefined
      ? {gridTemplateColumns: `repeat(${gridColumnCount}, minmax(0, 1fr))`}
      : undefined;

  if (type === 'predictive') {
    return null;
  }

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<SearchPageSkeleton />}>
    <div className="search">
      <div className="flex justify-center pt-5">
        <img
          ref={searchImgRef}
          src={'https://downloads.adamunderwater.com/store-1-au/public/searchstore.png'}
          style={{height: '95px'}}
          onLoad={handleSearchImgLoad}
          alt="Search Store"
        />
      </div>
      <form onSubmit={handleSearchSubmit}>
        <div className="mt-5 flex flex-col items-center">
          <div className="flex w-full max-w-[335px] flex-col gap-2 min-[601px]:w-auto min-[601px]:max-w-none min-[601px]:flex-row min-[601px]:items-start">
            <div className="flex w-full flex-col items-center min-[601px]:w-[284px]">
              <InputGroup className="w-full">
                <InputGroupAddon align="inline-start">
                  <LuSearch className="text-muted-foreground" />
                </InputGroupAddon>
                <InputGroupInput
                  name="q"
                  onChange={handleInputChange}
                  onFocus={handleInputFocus}
                  placeholder="Search..."
                  type="search"
                  value={searchText}
                  list={queriesDatalistId}
                />
              </InputGroup>
              <p className="text-muted-foreground mt-1.5 w-full pl-9 text-left text-[11px]">
                Try &ldquo;Sea Lion&rdquo; or &ldquo;Fish&rdquo;
              </p>
            </div>
            <Button
              variant="outline"
              type="submit"
              className="hidden min-[601px]:inline-flex min-[601px]:w-auto"
            >
              Search
            </Button>
          </div>
          <SearchResultsPredictive.Queries
            queries={predictiveQueries}
            queriesDatalistId={queriesDatalistId}
          />
        </div>
      </form>

      <div className="mx-2 mt-4">
        <div className="product-counter-container" style={{justifyContent: 'flex-start'}}>
          <div className="flex flex-col items-start">
            <h4 className="font-medium text-md">
              {displayedProductCount} product
              {displayedProductCount !== 1 && 's'}
            </h4>
          </div>
        </div>
      </div>

      {showPredictiveResults ? (
        showPredictiveEmpty ? (
          <SearchResultsPredictive.Empty term={{current: searchText.trim()}} />
        ) : showPredictiveLoading ? (
          <div className="flex justify-center px-4 py-6 text-center text-muted-foreground">
            Searching...
          </div>
        ) : (
          <div className={predictiveGridClassName} style={predictiveGridStyle}>
            <SearchResultsPredictive.Products
              products={predictiveProducts}
              layout="grid"
              term={{current: searchText.trim()}}
              cart={cart}
              wishlistProducts={wishlistProducts ?? []}
              isLoggedIn={isLoggedIn}
            />
          </div>
        )
      ) : (
        <>
          {error && <p style={{color: 'red'}}>{error}</p>}
          {!term || !result?.total ? (
            <SearchResults.Empty />
          ) : (
            <SearchResults result={result} term={term}>
              {({products, term}) => (
                <div>
                  <SearchResults.Products
                    products={products}
                    term={term}
                    cart={cart}
                    isLoggedIn={isLoggedIn}
                    wishlistProducts={wishlistProducts}
                  />
                </div>
              )}
            </SearchResults>
          )}
        </>
      )}
      <Analytics.SearchView data={{searchTerm: term, searchResults: result}} />
    </div>
    </SkeletonGate>
  );
}

/**
 * Regular search query and fragments
 * (adjust as needed)
 */
const SEARCH_PRODUCT_FRAGMENT = `#graphql
fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment SearchProduct on Product {
    __typename
    id
    title
    handle
    tags
    descriptionHtml
    featuredImage {
      altText
      url
    }
    trackingParameters
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
  }
` as const;

const SEARCH_PAGE_FRAGMENT = `#graphql
  fragment SearchPage on Page {
     __typename
     handle
    id
    title
    trackingParameters
  }
` as const;

const SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment SearchArticle on Article {
    __typename
    handle
    id
    title
    trackingParameters
  }
` as const;

const PAGE_INFO_FRAGMENT = `#graphql
  fragment PageInfoFragment on PageInfo {
    hasNextPage
    hasPreviousPage
    startCursor
    endCursor
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/search
export const SEARCH_QUERY = `#graphql
  query RegularSearch(
    $country: CountryCode
    $endCursor: String
    $first: Int
    $language: LanguageCode
    $last: Int
    $term: String!
    $startCursor: String
    $filters: [ProductFilter!]
  ) @inContext(country: $country, language: $language) {
    articles: search(
      query: $term,
      types: [ARTICLE],
      first: $first,
    ) {
      nodes {
        ...on Article {
          ...SearchArticle
        }
      }
    }
    pages: search(
      query: $term,
      types: [PAGE],
      first: $first,
    ) {
      nodes {
        ...on Page {
          ...SearchPage
        }
      }
    }
    products: search(
      after: $endCursor,
      before: $startCursor,
      first: $first,
      last: $last,
      query: $term,
      productFilters: $filters,
      sortKey: RELEVANCE,
      types: [PRODUCT],
      unavailableProducts: HIDE,
    ) {
      nodes {
        ...on Product {
          ...SearchProduct
          tags
        }
      }
      pageInfo {
        ...PageInfoFragment
      }
    }
  }
  ${SEARCH_PRODUCT_FRAGMENT}
  ${SEARCH_PAGE_FRAGMENT}
  ${SEARCH_ARTICLE_FRAGMENT}
  ${PAGE_INFO_FRAGMENT}
` as const;

/**
 * Regular search fetcher
 */
async function regularSearch({
  request,
  context,
}: Pick<
  LoaderFunctionArgs,
  'request' | 'context'
>): Promise<RegularSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const variables = getPaginationVariables(request, {pageBy: 8});
  const term = String(url.searchParams.get('q') || '');

  // Search articles, pages, and products for the `q` term
  const {errors, ...items} = await storefront.query(SEARCH_QUERY, {
    variables: {...variables, term},
  });

  if (!items) {
    throw new Error('No search data returned from Shopify API');
  }

  if (Array.isArray(items?.products?.nodes)) {
    items.products.nodes = applyHighestResolutionVariantToProducts(
      items.products.nodes as any[],
    );
  }

  const total = Object.values(
    items as Record<string, {nodes?: unknown[]}>,
  ).reduce((acc, item) => {
    const nodesLength = Array.isArray(item?.nodes) ? item.nodes.length : 0;
    return acc + nodesLength;
  }, 0);

  const error = Array.isArray(errors)
    ? (errors as Array<{message?: string}>)
        .map((errorItem) => errorItem.message ?? '')
        .filter(Boolean)
        .join(', ') || undefined
    : undefined;

  return {type: 'regular', term, error, result: {total, items}};
}

/**
 * Predictive search query and fragments
 * (adjust as needed)
 */
const PREDICTIVE_SEARCH_ARTICLE_FRAGMENT = `#graphql
  fragment PredictiveArticle on Article {
    __typename
    id
    title
    handle
    blog {
      handle
    }
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_COLLECTION_FRAGMENT = `#graphql
  fragment PredictiveCollection on Collection {
    __typename
    id
    title
    handle
    image {
      url
      altText
      width
      height
    }
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PAGE_FRAGMENT = `#graphql
  fragment PredictivePage on Page {
    __typename
    id
    title
    handle
    trackingParameters
  }
` as const;

const PREDICTIVE_SEARCH_PRODUCT_FRAGMENT = `#graphql
fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment PredictiveProduct on Product {
    __typename
    id
    title
    handle
    tags
    descriptionHtml
    featuredImage {
      altText
      url
    }
    trackingParameters
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
  }
` as const;

const PREDICTIVE_SEARCH_QUERY_FRAGMENT = `#graphql
  fragment PredictiveQuery on SearchQuerySuggestion {
    __typename
    text
    styledText
    trackingParameters
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/predictiveSearch
const PREDICTIVE_SEARCH_QUERY = `#graphql
  query PredictiveSearch(
    $country: CountryCode
    $language: LanguageCode
    $limit: Int!
    $limitScope: PredictiveSearchLimitScope!
    $term: String!
    $types: [PredictiveSearchType!]
  ) @inContext(country: $country, language: $language) {
    predictiveSearch(
      limit: $limit,
      limitScope: $limitScope,
      query: $term,
      types: $types,
    ) {
      articles {
        ...PredictiveArticle
      }
      collections {
        ...PredictiveCollection
      }
      pages {
        ...PredictivePage
      }
      products {
        ...PredictiveProduct
      }
      queries {
        ...PredictiveQuery
      }
    }
  }
  ${PREDICTIVE_SEARCH_ARTICLE_FRAGMENT}
  ${PREDICTIVE_SEARCH_COLLECTION_FRAGMENT}
  ${PREDICTIVE_SEARCH_PAGE_FRAGMENT}
  ${PREDICTIVE_SEARCH_PRODUCT_FRAGMENT}
  ${PREDICTIVE_SEARCH_QUERY_FRAGMENT}
` as const;

/**
 * Predictive search fetcher
 */
async function predictiveSearch({
  request,
  context,
}: Pick<
  ActionFunctionArgs,
  'request' | 'context'
>): Promise<PredictiveSearchReturn> {
  const {storefront} = context;
  const url = new URL(request.url);
  const term = String(url.searchParams.get('q') || '').trim();
  const limit = Number(url.searchParams.get('limit') || 10);
  const type = 'predictive';

  if (!term) return {type, term, result: getEmptyPredictiveSearchResult()};

  // Predictively search articles, collections, pages, products, and queries (suggestions)
  const {predictiveSearch: items, errors} = await storefront.query(
    PREDICTIVE_SEARCH_QUERY,
    {
      variables: {
        // customize search options as needed
        limit,
        limitScope: 'EACH',
        term,
      },
    },
  );

  if (errors) {
    throw new Error(
      `Shopify API errors: ${errors.map(({message}: any) => message).join(', ')}`,
    );
  }

  if (!items) {
    throw new Error('No predictive search data returned from Shopify API');
  }

  if (Array.isArray(items?.products)) {
    items.products = applyHighestResolutionVariantToProducts(
      items.products as any[],
    );
  }

  const total = Object.values(items).reduce(
    (acc: any, item: any) => acc + item.length,
    0,
  ) as unknown as number;

  return {type, term, result: {items, total}};
}
