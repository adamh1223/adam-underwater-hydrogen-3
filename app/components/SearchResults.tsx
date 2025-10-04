import {Link} from '@remix-run/react';
import {Image, Money, Pagination} from '@shopify/hydrogen';
import {urlWithTrackingParams, type RegularSearchReturn} from '~/lib/search';
import ProductCarousel from './products/productCarousel';
import EProductsContainer from './eproducts/EProductsContainer';
import Sectiontitle from './global/Sectiontitle';

type SearchItems = RegularSearchReturn['result']['items'];
type PartialSearchResult<ItemType extends keyof SearchItems> = Pick<
  SearchItems,
  ItemType
> &
  Pick<RegularSearchReturn, 'term'>;

type SearchResultsProps = RegularSearchReturn & {
  children: (args: SearchItems & {term: string}) => React.ReactNode;
};

export function SearchResults({
  term,
  result,
  children,
}: Omit<SearchResultsProps, 'error' | 'type'>) {
  if (!result?.total) {
    return null;
  }

  return children({...result.items, term});
}

SearchResults.Articles = SearchResultsArticles;
SearchResults.Pages = SearchResultsPages;
SearchResults.Products = SearchResultsProducts;
SearchResults.Empty = SearchResultsEmpty;

function SearchResultsArticles({
  term,
  articles,
}: PartialSearchResult<'articles'>) {
  if (!articles?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result">
      <Sectiontitle text="Articles" />
      <div>
        {articles?.nodes?.map((article) => {
          const articleUrl = urlWithTrackingParams({
            baseUrl: `/blogs/${article.handle}`,
            trackingParams: article.trackingParameters,
            term,
          });

          return (
            <div className="search-results-item" key={article.id}>
              <Link prefetch="intent" to={articleUrl}>
                {article.title}
              </Link>
            </div>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function SearchResultsPages({term, pages}: PartialSearchResult<'pages'>) {
  if (!pages?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result">
      <Sectiontitle text="Pages" />
      <div>
        {pages?.nodes?.map((page) => {
          const pageUrl = urlWithTrackingParams({
            baseUrl: `/pages/${page.handle}`,
            trackingParams: page.trackingParameters,
            term,
          });

          return (
            <div className="search-results-item" key={page.id}>
              <Link prefetch="intent" to={pageUrl}>
                {page.title}
              </Link>
            </div>
          );
        })}
      </div>
      <br />
    </div>
  );
}

function SearchResultsProducts({
  term,
  products,
}: PartialSearchResult<'products'>) {
  if (!products?.nodes.length) {
    return null;
  }

  return (
    <div className="search-result">
      <Sectiontitle text="Products" />
      <br />
      <Pagination connection={products}>
        {({nodes, isLoading, NextLink, PreviousLink}) => {
          const ItemsMarkup = nodes.map((product) => {
            const productUrl = urlWithTrackingParams({
              baseUrl: `/products/${product.handle}`,
              trackingParams: product.trackingParameters,
              term,
            });

            const price = product?.selectedOrFirstAvailableVariant?.price;
            const image = product?.selectedOrFirstAvailableVariant?.image;
            console.log(product, 'prod');
            if (product.tags.includes('Prints')) {
              return (
                <>
                  <div className="m-5">
                    <div className="flex justify-center pb-2">
                      Framed Canvas Print:
                    </div>
                    <ProductCarousel product={product} layout="grid" />
                  </div>
                  {/* not getting product images */}
                </>
              );
            }
            if (product.tags.includes('Video')) {
              return (
                <>
                  {/* <div className="mx-5">
                    <div className="flex justify-center pb-2">
                      Stock Footage Clip:
                    </div>
                    <EProductsContainer
                      product={product}
                      layout="grid"
                      cart={cart}
                    />
                  </div> */}
                  {/* Not working for some reason^ */}
                  <div>This is a stock video</div>
                </>
              );
            }
            // original code below

            // return (
            //   <div className="search-results-item" key={product.id}>
            //     <Link prefetch="intent" to={productUrl}>
            //       {image && (
            //         <Image data={image} alt={product.title} width={50} />
            //       )}
            //       <div>
            //         <p>{product.title}</p>
            //         <small>{price && <Money data={price} />}</small>
            //       </div>
            //     </Link>
            //   </div>
            // );
          });

          return (
            <div>
              <div>
                <PreviousLink>
                  {isLoading ? 'Loading...' : <span>↑ Load previous</span>}
                </PreviousLink>
              </div>
              <div>
                {ItemsMarkup}
                <br />
              </div>
              <div>
                <NextLink>
                  {isLoading ? 'Loading...' : <span>Load more ↓</span>}
                </NextLink>
              </div>
            </div>
          );
        }}
      </Pagination>
      <br />
    </div>
  );
}

function SearchResultsEmpty() {
  return (
    <div className="flex justify-center pt-[30px]">
      No results, try a different search.
    </div>
  );
}
