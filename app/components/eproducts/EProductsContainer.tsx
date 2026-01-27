import React, {useEffect, useState} from 'react';
import {Card, CardContent} from '../ui/card';
import {AddToCartButton} from '../AddToCartButton';
import {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import EProductPreview from './EProductPreview';
import {Money} from '@shopify/hydrogen';
import {Link, useNavigate} from '@remix-run/react';
import {useAside} from '../Aside';
import {useIsLoggedIn, useIsVideoInCart} from '~/lib/hooks';
import {CartReturn} from '@shopify/hydrogen';
import '../../styles/routeStyles/product.css';
import {ProductPrice} from '../ProductPrice';
import {Button} from '../ui/button';
import {ReloadIcon} from '@radix-ui/react-icons';
import {FaHeart, FaRegHeart} from 'react-icons/fa';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {toast} from 'sonner';

type shopifyImage = {url: string; altText: string};
function EProductsContainer({
  product,
  loading,
  layout,
  cart,
  isLoggedIn = undefined,
  isInWishlist = false,
}: {
  product: ProductItemFragment & {images: {nodes: shopifyImage[]}} & {
    selectedOrFirstAvailableVariant?: {id: string};
  };
  loading?: 'eager' | 'lazy';
  layout: string | undefined;
  cart?: Promise<CartReturn | null>;
  isLoggedIn: Promise<boolean> | undefined;
  isInWishlist: boolean;
}) {
  const cardClassName =
    layout === 'grid'
      ? 'group-hover:shadow-xl transition-shadow duration-500 h-full p-5'
      : 'transform group-hover:shadow-xl transition-shadow duration-500 mx-[12px] h-full gap-y-3';

  const cardContentClassName =
    layout === 'grid'
      ? 'group-hover:shadow-xl transition-shadow duration-500 h-full'
      : 'list-view-large-row';
  const variantUrl = useVariantUrl(product.handle);
  const {open} = useAside();
  const disableButton = useIsVideoInCart(
    product?.selectedOrFirstAvailableVariant?.id,
    cart,
  );

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
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

  const navigate = useNavigate();
  const loginValue = useIsLoggedIn(isLoggedIn);
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

  return (
    <>
      {/* {EProducts?.map((product) => { */}
      {/* const {name, price, WMVideoLink, downloadLink, thumbnail} = product;

          const productId = product.id;
          const dollarsAmount = formatCurrency(price);
          return ( */}
      <article
        className={`group relative h-full ${layout === 'list' && 'pb-[12px]'}`}
      >
        <Card className={cardClassName}>
          {layout === 'list' && windowWidth != undefined && windowWidth <= 600 && (
            <>
            <div
                  className={`product-title-container  text-start border-b py-1`}
                >
                  <Link
                    className="product-item"
                    key={product.id}
                    prefetch="intent"
                    to={variantUrl}
                  >
                    <h2
                      className={` product-title-font-list`}
                    >
                      {product.title}
                    </h2>
                    <p
                      className={`text-muted-foreground $ product-location-font-list`}
                    >
                      {formattedLocation}
                    </p>
                  </Link>
                </div>
            <div className="fav-btn-container-list cursor-pointer absolute  z-50">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={
                        wishlistItem ? removeFromFavorites : addToFavorites
                      }
                      disabled={!loginValue}
                      className="cursor-pointer rounded-md border fav-btn-list border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer relative z-50"
                    >
                      {pendingWishlistChange ? (
                        <div className='flex justify-center items-center'>

                          <ReloadIcon className="animate-spin" />
                        </div>
                      ) : (
                        <>
                          {wishlistItem ? (
                            <div className='flex justify-center items-center'>

                              <FaHeart />
                            </div>
                          ) : (
                            <>
                              {loginValue ? (
                                <div className='flex justify-center items-center'>

                                  <FaRegHeart />
                                </div>
                              ) : (
                                
                                <Link to="/account/login">
                                  <div className='flex justify-center items-center'>
                                  <FaRegHeart />
                                </div>
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
            </>
          )}
          {layout === 'grid' && <div className={cardContentClassName}>
            {layout === 'grid' && (
              <div className="cursor-pointer absolute fav-btn-container-grid z-50 p-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={
                          wishlistItem ? removeFromFavorites : addToFavorites
                        }
                        disabled={!loginValue}
                        className="fav-btn-grid cursor-pointer  rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer relative z-50"
                      >
                        {pendingWishlistChange ? (
                          <>
                          <div className='flex justify-center items-center'>

                          <ReloadIcon className="animate-spin" />
                          </div>
                          </>
                        ) : (
                          <>
                            {wishlistItem ? (
                              <>
                              <div className='flex justify-center items-center'>

                              <FaHeart />
                              </div>
                              </>
                            ) : (
                              <>
                                {loginValue ? (
                                  <>
                                  <div className='flex justify-center items-center'>

                                  <FaRegHeart />
                                  </div>
                                  </>
                                ) : (
                                  <Link to="/account/login">
                                    <div className='flex justify-center items-center'>

                                    <FaRegHeart />
                                    </div>
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
            )}
            <div
              className={`relative evideo top-part-card-list`}
            >
              {/* {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="hi"
                        className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      />
                    )} */}
              <Link
                className="product-item"
                key={product.id}
                prefetch="intent"
                to={variantUrl}
              >
                <EProductPreview EProduct={product} />
              </Link>
              
            </div>
            {/* <div className="mt-4 text-center">
                <h2 className="text-lg capitalize">{name}</h2>
                <p className="text-muted-foreground mt-2">{dollarsAmount}</p>
                <AddToCartButton
                  productId={productId}
                  isEProduct
                  RedirectTo={`/stock`}
                />
              </div> */}
            <div
              className={
                layout === 'grid'
                  ? `bottom-part-card-grid`
                  : `bottom-part-card-list`
              }
            >
              <div
                className={`bottom-part-card-inside`}
              >
                <div
                  className={`product-title-container ${layout === 'grid' ? 'text-center' : 'text-start'}`}
                >
                  <Link
                    className="product-item"
                    key={product.id}
                    prefetch="intent"
                    to={variantUrl}
                  >
                    <h2
                      className={`${layout === 'grid' ? 'product-title-font-grid' : 'product-title-font-list'}`}
                    >
                      {product.title}
                    </h2>
                    <p
                      className={`text-muted-foreground ${layout === 'grid' ? 'product-location-font-grid' : 'product-location-font-list'}`}
                    >
                      {formattedLocation}
                    </p>
                  </Link>
                </div>
                {product?.priceRange?.minVariantPrice && (
                  <div
                    className={`flex ${layout === 'grid' ? 'justify-center' : 'justify-start'}`}
                  >
                    <Link
                      className="product-item"
                      key={product.id}
                      prefetch="intent"
                      to={variantUrl}
                    >
                      <span
                        className={`${layout === 'grid' ? 'product-price-font-grid' : 'product-price-font-list'} flex flex-row gap-2`}
                      >
                        <ProductPrice
                          price={product?.priceRange?.minVariantPrice}
                          compareAtPrice={
                            product?.selectedOrFirstAvailableVariant
                              ?.compareAtPrice
                          }
                        />

                        {/* We need to get the compareat price in here */}
                      </span>
                    </Link>
                  </div>
                )}
                {layout !== 'grid' &&
                  (product as any).descriptionHtml &&
                  windowWidth != undefined &&
                  windowWidth > 786 && (
                    <>
                      <div>
                        <Link
                          className="product-item"
                          key={product.id}
                          prefetch="intent"
                          to={variantUrl}
                        >
                          <Card className="description-html-card-list ">
                            <div
                              className="p-3"
                              dangerouslySetInnerHTML={{
                                __html: (product as any).descriptionHtml,
                              }}
                            />
                          </Card>
                        </Link>
                      </div>
                    </>
                  )}
                {product?.selectedOrFirstAvailableVariant?.id && (
                  <div
                    className={`flex product-add-to-cart-container w-full mx-auto ${
                      layout === 'grid'
                        ? 'p-a-t-c-container-grid justify-center gap-x-3'
                        : 'p-a-t-c-container-list justify-start'
                    }`}
                  >
                    <AddToCartButton
                      lines={[
                        {
                          merchandiseId:
                            product?.selectedOrFirstAvailableVariant?.id,
                          quantity: 1,
                        },
                      ]}
                      disabled={disableButton}
                      onClick={() => {
                        open('cart');
                      }}
                    >
                      <div className="eproducts-add-to-cart-btn-text w-full text-center">
                        Add To Cart
                      </div>
                    </AddToCartButton>
                    <Link to={`/products/${product.handle}`}>
                      <button className="cursor-pointer view-product-btn rounded-md bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80">
                        <div
                          className={`${layout === 'grid' && 'eproducts-add-to-cart-btn-text-grid'} ${layout === 'list' && 'eproducts-add-to-cart-btn-text-list'} w-full text-center`}
                        >
                          View Product
                        </div>
                      </button>
                    </Link>
                  </div>
                )}
                
              </div>
            </div>
          </div>}
          {layout === 'list' && windowWidth != undefined && windowWidth > 600 && <div className={cardContentClassName}>
            
              <div className="cursor-pointer absolute fav-btn-container-list z-50">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={
                          wishlistItem ? removeFromFavorites : addToFavorites
                        }
                        disabled={!loginValue}
                        className="cursor-pointer fav-btn-list rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer relative z-50"
                      >
                        {pendingWishlistChange ? (
                          <div className='flex justify-center items-center'>

                            <ReloadIcon className="animate-spin" />
                          </div>
                        ) : (
                          <>
                            {wishlistItem ? (
                              <div className='flex justify-center items-center'>

                                <FaHeart />
                              </div>
                            ) : (
                              <>
                                {loginValue ? (
                                  <div className='flex justify-center items-center'>

                                    <FaRegHeart />
                                  </div>
                                ) : (
                                  
                                  <Link to="/account/login">
                                    <div className='flex justify-center items-center'>
                                    <FaRegHeart />
                                  </div>
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
            
            <div
              className={`relative evideo ${layout === 'grid' ? 'top-part-card-grid' : 'top-part-card-list'}`}
            >
              {/* {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="hi"
                        className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      />
                    )} */}

              <Link
                className="product-item"
                key={product.id}
                prefetch="intent"
                to={variantUrl}
              >
                <EProductPreview EProduct={product} />
              </Link>
              
            </div>
            {/* <div className="mt-4 text-center">
                <h2 className="text-lg capitalize">{name}</h2>
                <p className="text-muted-foreground mt-2">{dollarsAmount}</p>
                <AddToCartButton
                  productId={productId}
                  isEProduct
                  RedirectTo={`/stock`}
                />
              </div> */}
            <div
              className={
                layout === 'grid'
                  ? `bottom-part-card-grid`
                  : `bottom-part-card-list`
              }
            >
              <div
                className={`bottom-part-card-inside`}
              >
                <div
                  className={`product-title-container ${layout === 'grid' ? 'text-center' : 'text-start'}`}
                >
                  <Link
                    className="product-item"
                    key={product.id}
                    prefetch="intent"
                    to={variantUrl}
                  >
                    <div
                      className={`${layout === 'grid' ? 'product-title-font-grid' : 'product-title-font-list flex justify-start'}`}
                    >
                      {product.title}
                    </div>
                    <p
                      className={`text-muted-foreground ${layout === 'grid' ? 'product-location-font-grid' : 'product-location-font-list'}`}
                    >
                      {formattedLocation}
                    </p>
                  </Link>
                </div>
                {product?.priceRange?.minVariantPrice && (
                  <div
                    className={`flex ${layout === 'grid' ? 'justify-center' : 'justify-start'}`}
                  >
                    <Link
                      className="product-item"
                      key={product.id}
                      prefetch="intent"
                      to={variantUrl}
                    >
                      <span
                        className={`${layout === 'grid' ? 'product-price-font-grid' : 'product-price-font-list'} flex flex-row gap-2`}
                      >
                        <ProductPrice
                          price={product?.priceRange?.minVariantPrice}
                          compareAtPrice={
                            product?.selectedOrFirstAvailableVariant
                              ?.compareAtPrice
                          }
                        />

                        {/* We need to get the compareat price in here */}
                      </span>
                    </Link>
                  </div>
                )}
                {layout !== 'grid' &&
                  (product as any).descriptionHtml &&
                  windowWidth != undefined &&
                  windowWidth > 786 && (
                    <>
                      <div>
                        <Link
                          className="product-item"
                          key={product.id}
                          prefetch="intent"
                          to={variantUrl}
                        >
                          <Card className="description-html-card-list ">
                            <div
                              className="p-3"
                              dangerouslySetInnerHTML={{
                                __html: (product as any).descriptionHtml,
                              }}
                            />
                          </Card>
                        </Link>
                      </div>
                    </>
                  )}
                {product?.selectedOrFirstAvailableVariant?.id && (
                  <div
                    className={`flex product-add-to-cart-container w-full mx-auto ${
                      layout === 'grid'
                        ? 'p-a-t-c-container-grid justify-center gap-x-3'
                        : 'p-a-t-c-container-list justify-start'
                    }`}
                  >
                    <AddToCartButton
                      lines={[
                        {
                          merchandiseId:
                            product?.selectedOrFirstAvailableVariant?.id,
                          quantity: 1,
                        },
                      ]}
                      disabled={disableButton}
                      onClick={() => {
                        open('cart');
                      }}
                    >
                      <div className="eproducts-add-to-cart-btn-text w-full text-center">
                        Add To Cart
                      </div>
                    </AddToCartButton>
                    <Link to={`/products/${product.handle}`}>
                      <button className="cursor-pointer view-product-btn rounded-md bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80">
                        <div
                          className={`${layout === 'grid' && 'eproducts-add-to-cart-btn-text-grid'} ${layout === 'list' && 'eproducts-add-to-cart-btn-text-list'} w-full text-center`}
                        >
                          View Product
                        </div>
                      </button>
                    </Link>
                  </div>
                )}
                
              </div>
            </div>
          </div>}
          {layout === 'list' && windowWidth != undefined && windowWidth <= 600 && <div className={cardContentClassName}>
            
            <div
              className={`relative evideo top-part-card-list`}
            >
              {/* {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="hi"
                        className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      />
                    )} */}
                    
              <Link
                className="product-item"
                key={product.id}
                prefetch="intent"
                to={variantUrl}
              >
                <EProductPreview EProduct={product} />
              </Link>
              
            </div>
            {/* <div className="mt-4 text-center">
                <h2 className="text-lg capitalize">{name}</h2>
                <p className="text-muted-foreground mt-2">{dollarsAmount}</p>
                <AddToCartButton
                  productId={productId}
                  isEProduct
                  RedirectTo={`/stock`}
                />
              </div> */}
            <div
              className={
                `bottom-part-card-list`
              }
            >
              <div
                className={`bottom-part-card-inside`}
              >
                
                {product?.priceRange?.minVariantPrice && (
                  <div
                    className={`flex justify-center`}
                  >
                    <Link
                      className="product-item"
                      key={product.id}
                      prefetch="intent"
                      to={variantUrl}
                    >
                      <span
                        className={` product-price-font-list flex flex-row gap-2`}
                      >
                        <ProductPrice
                          price={product?.priceRange?.minVariantPrice}
                          compareAtPrice={
                            product?.selectedOrFirstAvailableVariant
                              ?.compareAtPrice
                          }
                        />

                        {/* We need to get the compareat price in here */}
                      </span>
                    </Link>
                  </div>
                )}
                {
                  (product as any).descriptionHtml &&
                  windowWidth != undefined &&
                  windowWidth > 786 && (
                    <>
                      <div>
                        <Link
                          className="product-item"
                          key={product.id}
                          prefetch="intent"
                          to={variantUrl}
                        >
                          <Card className="description-html-card-list ">
                            <div
                              className="p-3"
                              dangerouslySetInnerHTML={{
                                __html: (product as any).descriptionHtml,
                              }}
                            />
                          </Card>
                        </Link>
                      </div>
                    </>
                  )}
                {product?.selectedOrFirstAvailableVariant?.id && (
                  <div
                    className={`flex product-add-to-cart-container w-full mx-auto
                      p-a-t-c-container-list justify-start
                    `}
                  >
                    <AddToCartButton
                      lines={[
                        {
                          merchandiseId:
                            product?.selectedOrFirstAvailableVariant?.id,
                          quantity: 1,
                        },
                      ]}
                      disabled={disableButton}
                      onClick={() => {
                        open('cart');
                      }}
                    >
                      <div className="eproducts-add-to-cart-btn-text w-full text-center">
                        Add To Cart
                      </div>
                    </AddToCartButton>
                    <Link to={`/products/${product.handle}`}>
                      <button className="cursor-pointer view-product-btn rounded-md bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80">
                        <div
                          className={`eproducts-add-to-cart-btn-text-list w-full text-center`}
                        >
                          View Product
                        </div>
                      </button>
                    </Link>
                  </div>
                )}
                
              </div>
            </div>
          </div>}
        </Card>
        {/* <div className="absolute top-5 right-2 z-5">
                <FavoriteToggleButton EProductId={productId} productId={null} />
              </div> */}
      </article>
      {/* ); */}
      {/* })} */}
    </>
  );
}

export default EProductsContainer;
