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
import {CorePageWarmup} from '~/components/CorePageWarmup';
import {Button} from './ui/button';
import {EnhancedPartialSearchResult} from '~/lib/types';
import {LuSearch} from 'react-icons/lu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from './ui/input-group';
import {Skeleton} from './ui/skeleton';
import {Card, CardContent} from './ui/card';

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

  const [searchTerm, setSearchTerm] = useState('');
  const handleClick = () => {
    navigate(`/search?q=${searchTerm}`);
  };

  return (
    <Aside type="search" heading="SEARCH">
      <div className="mt-[8px] cart-main ">
        <br />
        <SearchFormPredictive>
          {({fetchResults, inputRef}) => {
            const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchTerm(e.target.value);
              fetchResults(e);
            };
            return (
              <div className="flex flex-col items-center mb-5 mx-3 bg-background">
                <div className="flex items-center gap-2">
                  <InputGroup className="w-[220px]">
                    <InputGroupAddon align="inline-start">
                      <LuSearch className="text-muted-foreground" />
                    </InputGroupAddon>
                    <InputGroupInput
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
                    onClick={handleClick}
                    className="cursor-pointer"
                  >
                    Search
                  </Button>
                </div>
                <p className="text-muted-foreground text-[11px] mt-1.5 w-[220px] text-left pl-8">
                  Try &ldquo;Sea Lion&rdquo; or &ldquo;Night&rdquo;
                </p>
              </div>
            );
          }}
        </SearchFormPredictive>

        <SearchResultsPredictive>
          {({items, total, term, state, closeSearch}) => {
            const {articles, collections, pages, products, queries} = items;

            if (state === 'loading' && term.current) {
              return (
                <div className="flex flex-col gap-3 px-3">
                  {Array.from({length: 2}).map((_, i) => (
                    <Card key={`aside-skel-${i}`} className="h-full mb-1 pb-1">
                      <CardContent className="flex flex-col h-full p-0">
                        <Skeleton className="w-full rounded-b-none rounded-t-xl aspect-[16/10]" />
                        <div className="flex flex-col items-center gap-2 px-3 py-3">
                          <Skeleton className="h-4 w-3/5" />
                          <Skeleton className="h-3.5 w-2/5" />
                          <Skeleton className="h-3.5 w-1/4" />
                          <Skeleton className="h-8 w-full rounded-md mt-0.5" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
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
