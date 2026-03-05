import {Await, Link, useNavigate} from '@remix-run/react';
import {Suspense, useId} from 'react';
import type {
  CartApiQueryFragment,
  FooterQuery,
  HeaderQuery,
} from 'storefrontapi.generated';
import {Aside, useAside} from '~/components/Aside';
import {Footer} from '~/components/Footer';
import {Header, HeaderMenu} from '~/components/Header';
import {CartMain} from '~/components/CartMain';
import {
  SEARCH_ENDPOINT,
  SearchFormPredictive,
} from '~/components/SearchFormPredictive';
import {SearchResultsPredictive} from '~/components/SearchResultsPredictive';
import {CorePageWarmup} from '~/components/CorePageWarmup';
import {Button} from './ui/button';
import {EnhancedPartialSearchResult} from '~/lib/types';
import {LuSearch} from 'react-icons/lu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from './ui/input-group';

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
      <CorePageWarmup />
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
  const aside = useAside();

  const handleSearchSubmit = (term: string) => {
    const trimmedTerm = term.trim();
    navigate(
      `${SEARCH_ENDPOINT}${trimmedTerm ? `?q=${encodeURIComponent(trimmedTerm)}` : ''}`,
    );
    aside.close();
  };

  return (
    <Aside type="search" heading="SEARCH">
      <div className="mt-[8px] cart-main ">
        <br />
        <SearchFormPredictive onSubmitSearch={handleSearchSubmit}>
          {({fetchResults, inputRef}) => {
            const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              fetchResults(e);
            };
            return (
              <div className="mb-5 flex w-full min-w-0 flex-col items-center bg-background px-3 box-border">
                <p className="order-1 min-[601px]:order-2 text-muted-foreground text-[11px] w-full min-[601px]:w-[220px] text-left pl-9 mb-1 min-[601px]:mb-0 min-[601px]:mt-1.5">
                  Try &ldquo;Sea Lion&rdquo; or &ldquo;Fish&rdquo;
                </p>
                <div className="order-2 min-[601px]:order-1 flex w-full min-w-0 max-w-full flex-col gap-2 min-[601px]:w-auto min-[601px]:max-w-none min-[601px]:flex-row min-[601px]:items-center">
                  <InputGroup className="w-full min-w-0 max-w-full min-[601px]:w-[220px]">
                    <InputGroupAddon align="inline-start">
                      <LuSearch className="text-muted-foreground" />
                    </InputGroupAddon>
                    <InputGroupInput
                      className="w-full min-w-0"
                      name="q"
                      onChange={handleChange}
                      onFocus={fetchResults}
                      placeholder="Search"
                      ref={inputRef}
                      type="search"
                      list={queriesDatalistId}
                    />
                  </InputGroup>
                  <Button
                    variant="outline"
                    type="submit"
                    className="cursor-pointer w-full min-[601px]:w-auto"
                  >
                    Search
                  </Button>
                </div>
              </div>
            );
          }}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, total, term, state, closeSearch}) => {
            const {articles, collections, pages, products, queries} = items;
            const hasSearchTerm = term.current.trim().length > 0;

            if (!hasSearchTerm) {
              return null;
            }

            if (!total && state === 'idle') {
              return <SearchResultsPredictive.Empty term={term} />;
            }

            if (!total) {
              return null;
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
                  surface="aside-search"
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
