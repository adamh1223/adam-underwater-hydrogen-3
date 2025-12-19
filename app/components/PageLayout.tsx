import {Await, Link, useNavigate} from '@remix-run/react';
import {Suspense, useId, useState} from 'react';
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from 'storefrontapi.generated';
import {Aside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {
  SEARCH_ENDPOINT,
  SearchFormPredictive,
} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import {Button} from './ui/button';
import {EnhancedPartialSearchResult} from '~/lib/types';
import {Input} from './ui/input';

interface PageLayoutProps {
  cart: Promise<CartApiQueryFragment | null>;
  footer: Promise<FooterQuery | null>;
  header: HeaderQuery & {
    collection?: {
      metafield?: {
        references?: {
          nodes?: Array<{
            image: {url: string};
          }>;
        };
      };
    };
  };
  isLoggedIn: Promise<boolean>;
  publicStoreDomain: string;
  children?: React.ReactNode;
  wishlistProducts: string[];
}

export function PageLayout({
  cart,
  children = null,
  footer,
  header,
  isLoggedIn,
  publicStoreDomain,
  wishlistProducts,
}: PageLayoutProps) {
  return (
    <Aside.Provider>
      <CartAside cart={cart} />
      <SearchAside
        isLoggedIn={isLoggedIn}
        wishlistProducts={wishlistProducts}
      />
      <MobileMenuAside header={header} publicStoreDomain={publicStoreDomain} />
      {header && (
        <Header
          header={header}
          cart={cart}
          isLoggedIn={isLoggedIn}
          publicStoreDomain={publicStoreDomain}
        />
      )}
      <main>{children}</main>
      <Footer
        footer={footer}
        header={header}
        publicStoreDomain={publicStoreDomain}
      />
    </Aside.Provider>
  );
}

function CartAside({cart}: {cart: PageLayoutProps['cart']}) {
  return (
    <Aside type="cart" heading="CART">
      <Suspense fallback={<p>Loading cart ...</p>}>
        <Await resolve={cart}>
          {(cart) => {
            return <CartMain cart={cart} layout="aside" />;
          }}
        </Await>
      </Suspense>
    </Aside>
  );
}
interface SearchAsideProps {
  isLoggedIn: Promise<boolean>;
  wishlistProducts: string[];
}
function SearchAside({isLoggedIn, wishlistProducts}: SearchAsideProps) {
  const queriesDatalistId = useId();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const handleClick = () => {
    navigate(`/search?q=${searchTerm}`);
  };

  return (
    <Aside type="search" heading="SEARCH">
      <div className="predictive-search mt-[8px]">
        <br />
        <SearchFormPredictive>
          {({fetchResults, inputRef}) => {
            const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchTerm(e.target.value);
              fetchResults(e);
            };
            return (
              <>
                <div className="flex justify-center mb-5 mx-3 bg-background">
                  <Input
                    className="overflow-clip search-input w-[220px]"
                    name="q"
                    onChange={handleChange}
                    onFocus={fetchResults}
                    placeholder="Search"
                    ref={inputRef}
                    type="search"
                    list={queriesDatalistId}
                  />
                  &nbsp;
                  <Button
                    variant="outline"
                    onClick={handleClick}
                    className="cursor-pointer"
                  >
                    Search
                  </Button>
                </div>
              </>
            );
          }}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, total, term, state, closeSearch}) => {
            const {articles, collections, pages, products, queries} = items;

            if (state === 'loading' && term.current) {
              return (
                <div className="flex justify-center text-lg fw-bold">
                  Loading...
                </div>
              );
            }

            if (!total) {
              return <SearchResultsPredictive.Empty term={term} />;
            }

            return (
              <>
                <SearchResultsPredictive.Queries
                  queries={queries}
                  queriesDatalistId={queriesDatalistId}
                />
                <SearchResultsPredictive.Products
                  products={
                    products as unknown as EnhancedPartialSearchResult[]
                  }
                  showProductHeader
                  term={term}
                  isLoggedIn={isLoggedIn}
                  wishlistProducts={wishlistProducts}
                  // aside search results predictive
                />

                {term.current && total ? (
                  <>
                    <div className="flex justify-center pb-[30px]">
                      <Link
                        onClick={closeSearch}
                        to={`${SEARCH_ENDPOINT}?q=${term.current}`}
                      >
                        <Button variant="outline">
                          View all results for <q>{term.current}</q>
                          &nbsp; →
                        </Button>
                      </Link>
                    </div>
                  </>
                ) : null}
              </>
            );
          }}
        </SearchResultsPredictive>
      </div>
    </Aside>
  );
}

function MobileMenuAside({
  header,
  publicStoreDomain,
}: {
  header: PageLayoutProps['header'];
  publicStoreDomain: PageLayoutProps['publicStoreDomain'];
}) {
  return (
    header.menu &&
    header.shop.primaryDomain?.url && (
      <Aside type="mobile" heading="MENU">
        <HeaderMenu
          imageURL=""
          menu={header.menu}
          viewport="mobile"
          primaryDomainUrl={header.shop.primaryDomain.url}
          publicStoreDomain={publicStoreDomain}
        />
      </Aside>
    )
  );
}
