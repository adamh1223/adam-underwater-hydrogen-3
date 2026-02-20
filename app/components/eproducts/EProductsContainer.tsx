import React, {useEffect, useState} from 'react';
import {Card, CardContent} from '../ui/card';
import {AddToCartButton} from '../AddToCartButton';
import {ProductItemFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import EProductPreview from './EProductPreview';
import EProductBundlePreview from './EProductBundlePreview';
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
import {getHighestResolutionLabelFromTags} from '~/lib/downloads';
import {getHighestResolutionVariantFromProduct} from '~/lib/resolution';
import {useTouchCardHighlight} from '~/lib/touchCardHighlight';

type shopifyImage = {url: string; altText: string};

function getResolutionBadgeStyle(resolutionLabel: string): React.CSSProperties {
  const normalized = resolutionLabel.trim().toUpperCase();
  const baseStyle: React.CSSProperties = {borderColor: 'currentColor'};

  if (normalized === '5K') {
    return {color: '#cd7f32', ...baseStyle};
  }
  if (normalized === '6K') {
    return {color: '#c0c0c0', ...baseStyle};
  }
  if (normalized === '8K') {
    return {color: '#d4af37', ...baseStyle};
  }
  return baseStyle;
}

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
  layout: string;
  cart?: Promise<CartReturn | null>;
  isLoggedIn: Promise<boolean> | undefined;
  isInWishlist: boolean;
}) {
  const hoverCardEffects =
    'transition-[border-color,box-shadow] duration-300 group-hover:border-primary group-hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] active:border-primary active:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)] focus-within:border-primary focus-within:shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
  const touchCardEffects =
    'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.5),0_0_20px_hsl(var(--primary)/0.35)]';
  const touchCardId = `eproduct-card:${String(product.id ?? product.handle)}`;
  const {isTouchHighlighted, touchHighlightHandlers} =
    useTouchCardHighlight(touchCardId);

  const cardClassName =
    layout === 'grid'
      ? `h-full p-3 ${hoverCardEffects} ${isTouchHighlighted ? touchCardEffects : ''}`
      : `transform h-full gap-y-3 ${hoverCardEffects} ${isTouchHighlighted ? touchCardEffects : ''}`;

  const cardContentClassName =
    layout === 'grid'
      ? 'h-full eproduct-grid-card-content'
      : 'list-view-large-row';
  const variantUrl = useVariantUrl(product.handle);
  const {open} = useAside();
  const isBundle = product.tags.includes('Bundle');
  const highestResolutionVariant =
    getHighestResolutionVariantFromProduct(product);
  const selectedVariantForCard = (highestResolutionVariant ??
    (product as any)?.selectedOrFirstAvailableVariant ??
    null) as {id: string; price?: any; compareAtPrice?: any} | null;
  const selectedVariantId =
    selectedVariantForCard?.id ?? product?.selectedOrFirstAvailableVariant?.id;
  const displayCardPrice =
    selectedVariantForCard?.price ?? product?.priceRange?.minVariantPrice;
  const displayCardCompareAtPrice =
    selectedVariantForCard?.compareAtPrice ?? null;
  const disableButton = useIsVideoInCart(selectedVariantId, cart);

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

  const durationTag = product.tags
    .find((t: string) => t?.startsWith?.('duration-'))
    ?.split('-')[1];
  const isSlowmo = product.tags.includes('slowmo');
  const isArtistPick = product.tags.includes('artist-pick');
  const hasDurationTag = Boolean(durationTag);
  const resolutionBadgeLabel =
    getHighestResolutionLabelFromTags(product.tags) ?? '4K';
  const resolutionBadgeStyle = getResolutionBadgeStyle(resolutionBadgeLabel);

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
  // Disabled by request; keep original condition documented.
  // const shouldRenderListDescription = layout === 'list' && Boolean((product as any).descriptionHtml);
  const shouldRenderListDescription = false;
  const shouldRenderListBottomCard =
    layout !== 'grid' &&
    windowWidth != undefined &&
    (windowWidth <= 600 || windowWidth >= 913);
  const shouldRenderListCompactRange =
    layout === 'list' &&
    windowWidth != undefined &&
    (windowWidth <= 600 || windowWidth >= 913);
  const shouldRenderListExpandedRange =
    layout === 'list' &&
    windowWidth != undefined &&
    windowWidth > 600 &&
    windowWidth <= 912;
  const isGridCompact = windowWidth != undefined && windowWidth <= 600;
  const listRangeCardClassName =
    layout === 'list'
      ? shouldRenderListCompactRange
        ? 'eproduct-list-range-compact'
        : shouldRenderListExpandedRange
          ? 'eproduct-list-range-expanded'
          : ''
      : '';

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
      <article className={`group relative h-full`}>
        <Card
          className={`${cardClassName} ${listRangeCardClassName}`.trim()}
          style={{touchAction: 'pan-y'}}
          data-touch-highlight-card-id={touchCardId}
          {...touchHighlightHandlers}
        >
          {/* BEGIN GRID ---------------------------------------*/}

          {/* GRID VIEW WHOLE THING */}
          {/* STILL MISSING TAGS */}
          {layout === 'grid' && (
            <div className={cardContentClassName}>
              {layout === 'grid' && (
                <>
                  <div className="absolute left-2 top-2 flex flex-col gap-1">
                    {isArtistPick && (
                      <button
                        disabled
                        className="artist-pick rounded-md flex items-center justify-center border border-border bg-background text-yellow-400 text-md hover:bg-background disabled:cursor-default disabled:opacity-100"
                      >
                        Artist's Pick
                        <div className="flex justify-center items-end">
                          <img src={'/badge1.png'} className="badge-img" />
                        </div>
                      </button>
                    )}
                    {hasDurationTag && (
                      <button
                        disabled
                        className="clip-icon duration-tag flex items-center justify-center rounded-md border border-border bg-background text-white hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
                      >
                        {durationTag}
                      </button>
                    )}
                    {/* {isSlowmo && (
              <button
                disabled
                className="clip-icon slow-mo rounded-md flex items-center justify-center border border-border bg-background  text-white text-sm hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
              >
                Slow-mo
              </button>
            )}
            {!isSlowmo && (
              <button
                disabled
                className="clip-icon fps rounded-md flex items-center justify-center border border-border bg-background  text-white text-md hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
              >
                24fps
              </button>
            )}
            <button
              disabled
              className="clip-icon four-k rounded-md border flex items-center justify-center border-border bg-background  text-primary hover:bg-background  disabled:cursor-default disabled:opacity-100"
            >
              4K
            </button> */}
                  </div>

                  <div className="cursor-pointer absolute fav-btn-container-grid z-60 p-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={
                              wishlistItem
                                ? removeFromFavorites
                                : addToFavorites
                            }
                            disabled={!loginValue}
                            className="fav-btn-grid cursor-pointer  rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer relative z-50"
                          >
                            {pendingWishlistChange ? (
                              <>
                                <div className="flex justify-center items-center">
                                  <ReloadIcon className="animate-spin" />
                                </div>
                              </>
                            ) : (
                              <>
                                {wishlistItem ? (
                                  <>
                                    <div className="flex justify-center items-center">
                                      <FaHeart />
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    {loginValue ? (
                                      <>
                                        <div className="flex justify-center items-center">
                                          <FaRegHeart />
                                        </div>
                                      </>
                                    ) : (
                                      <Link to="/account/login">
                                        <div className="flex justify-center items-center">
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
              <div className={`relative evideo`}>
                {/* {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="hi"
                        className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      />
                    )} */}
                {isBundle ? (
                  <EProductBundlePreview product={product} />
                ) : (
                  <Link
                    className="product-item"
                    key={product.id}
                    prefetch="intent"
                    to={variantUrl}
                  >
                    <EProductPreview EProduct={product} layout={layout} />
                  </Link>
                )}
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
              {/* LIST VIEW / SMALL VW / BOTTOM-PART-CARD */}
              {shouldRenderListBottomCard && (
                <div className={`eproduct-bottom-part-card-grid`}>
                  <div
                    className={`eproduct-bottom-part-card-inside-listw-full`}
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
                          className={`${!isBundle ? 'product-title-font-grid' : 'product-title-font-grid-bundle'}`}
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

                    {displayCardPrice && (
                      <>
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
                                price={displayCardPrice}
                                compareAtPrice={displayCardCompareAtPrice}
                              />

                              {/* We need to get the compareat price in here */}
                            </span>
                          </Link>
                        </div>
                      </>
                    )}
                    {layout === 'list' &&
                      shouldRenderListDescription &&
                      (product as any).descriptionHtml &&
                      windowWidth != undefined &&
                      windowWidth > 800 && (
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
                    {selectedVariantId && (
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
                              merchandiseId: selectedVariantId,
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
              )}
              {/* GRID VIEW / SMALL VW / BOTTOM-PART-CARD */}
              {layout === 'grid' && windowWidth != undefined && (
                <div className="eproduct-bottom-part-card-grid">
                  <div className="eproduct-bottom-part-card-inside relative w-full">
                    <div
                      className={`product-title-container ${layout === 'grid' ? 'text-center' : 'text-start'}`}
                    >
                      <div className="pointer-events-none absolute left-0 top-0 z-10">
                        <button
                          disabled
                          className="clip-icon four-k rounded-md border flex items-center justify-center border-border bg-background  text-primary hover:bg-background  disabled:cursor-default disabled:opacity-100 mt-[-20px] ms-[-5px]"
                          style={resolutionBadgeStyle}
                        >
                          {resolutionBadgeLabel}
                        </button>
                      </div>

                      <div className="pointer-events-none absolute right-0 top-0 z-10 flex flex-col items-end">
                        {isSlowmo && (
                          <button
                            disabled
                            className="clip-icon slow-mo rounded-md flex items-center justify-center border border-border bg-background  text-white text-sm hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100 mt-[-20px] me-[-5px]"
                          >
                            Slow-mo
                          </button>
                        )}
                        {!isSlowmo && (
                          <button
                            disabled
                            className="clip-icon fps rounded-md flex items-center justify-center border border-border bg-background  text-white text-md hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100 mt-[-20px] me-[-5px]"
                          >
                            24fps
                          </button>
                        )}
                      </div>
                      <Link
                        className="product-item"
                        key={product.id}
                        prefetch="intent"
                        to={variantUrl}
                      >
                        <h2
                          className={`${!isBundle ? 'product-title-font-grid' : 'product-title-font-grid-bundle'}`}
                        >
                          {product.title}
                        </h2>
                        <p
                          className={`text-muted-foreground ${layout === 'grid' ? 'product-location-font-grid' : 'product-location-font-list'}`}
                        >
                          {formattedLocation}
                        </p>
                      </Link>
                      {displayCardPrice && (
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
                                price={displayCardPrice}
                                compareAtPrice={displayCardCompareAtPrice}
                              />

                              {/* We need to get the compareat price in here */}
                            </span>
                          </Link>
                        </div>
                      )}
                      {layout !== 'grid' &&
                        shouldRenderListDescription &&
                        (product as any).descriptionHtml &&
                        windowWidth > 800 && (
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
                      {selectedVariantId && (
                        <div
                          className={`flex product-add-to-cart-container w-full mx-auto ${
                            layout === 'grid'
                              ? `p-a-t-c-container-grid justify-center gap-x-3${isGridCompact ? '' : ' mt-[6px]'}`
                              : 'p-a-t-c-container-list justify-start'
                          }`}
                        >
                          <AddToCartButton
                            lines={[
                              {
                                merchandiseId: selectedVariantId,
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
                </div>
              )}
            </div>
          )}

          {/* END GRID -----------------------------------------*/}

          {/* BEGIN <= 600px LIST ------------------------------*/}

          {/* Title/Location + Artist Pick + Duration tag + Favorite button for LIST <=600px > */}
          {shouldRenderListCompactRange && (
            <>
              {isArtistPick && (
                <div className="absolute left-2 top-2 flex flex-col">
                  <button
                    disabled
                    className="artist-pick-list rounded-md flex items-center justify-center border border-border bg-background text-yellow-400 text-sm  disabled:cursor-default disabled:opacity-100"
                  >
                    Artist's Pick
                    <div className="flex justify-center items-end">
                      <img src={'/badge1.png'} className="badge-img" />
                    </div>
                  </button>
                </div>
              )}
              <div className="product-title-container border-b py-1 text-center flex items-center justify-center">
                <Link
                  className="product-item flex w-full flex-col items-center justify-center text-center"
                  key={product.id}
                  prefetch="intent"
                  to={variantUrl}
                >
                  <h2 className={` product-title-font-list`}>
                    {product.title}
                  </h2>
                  <p className="text-muted-foreground product-location-font-list">
                    {formattedLocation}
                  </p>
                </Link>
              </div>

              <div className="cursor-pointer absolute right-2 top-2 z-50">
                {/* <h1 className='z-9000'>Duration {durationTag}</h1> */}

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
                          <div className="flex justify-center items-center">
                            <ReloadIcon className="animate-spin" />
                          </div>
                        ) : (
                          <>
                            {wishlistItem ? (
                              <div className="flex justify-center items-center">
                                <FaHeart />
                              </div>
                            ) : (
                              <>
                                {loginValue ? (
                                  <div className="flex justify-center items-center">
                                    <FaRegHeart />
                                  </div>
                                ) : (
                                  <Link to="/account/login">
                                    <div className="flex justify-center items-center">
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
          {/* 4K + slowmo + eproductpreview + price + description + add to cart + view product for LIST <= 600px */}
          {shouldRenderListCompactRange && (
            <div className={cardContentClassName}>
              <div className={`relative evideo eproduct-top-part-card-list`}>
                {hasDurationTag && (
                  <div className="absolute left-2 top-2 z-50 flex flex-col gap-1">
                    <button
                      disabled
                      className="duration-icon-list flex items-center justify-center rounded-md border border-border bg-background text-white hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100 text-sm"
                    >
                      {durationTag}
                    </button>
                  </div>
                )}
                {/* {thumbnail && (
		                      <img
		                        src={thumbnail}
	                        alt="hi"
	                        className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
	                      />
	                    )} */}
                {isBundle ? (
                  <EProductBundlePreview product={product} />
                ) : (
                  <Link
                    className="product-item"
                    key={product.id}
                    prefetch="intent"
                    to={variantUrl}
                  >
                    <EProductPreview EProduct={product} layout={layout} />
                  </Link>
                )}
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
              <div className={`eproduct-bottom-part-card-list relative`}>
                <div className="absolute inset-x-0 top-[7px] z-50 flex justify-start ps-1 gap-x-1">
                  <button
                    disabled
                    className="clip-icon-list four-k rounded-md border flex items-center justify-center border-border bg-background  text-primary hover:bg-background  disabled:cursor-default disabled:opacity-100"
                    style={resolutionBadgeStyle}
                  >
                    {resolutionBadgeLabel}
                  </button>
                  {isSlowmo && (
                    <button
                      disabled
                      className="clip-icon-list slow-mo rounded-md flex items-center justify-center border border-border bg-background  text-white text-sm hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
                    >
                      Slow-mo
                    </button>
                  )}
                  {!isSlowmo && (
                    <button
                      disabled
                      className="clip-icon-list fps rounded-md flex items-center justify-center border border-border bg-background  text-white text-md hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
                    >
                      24fps
                    </button>
                  )}
                </div>
                <div className={`eproduct-bottom-part-card-inside-list w-full`}>
                  {displayCardPrice && (
                    <div className={`flex justify-center`}>
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
                            price={displayCardPrice}
                            compareAtPrice={displayCardCompareAtPrice}
                          />

                          {/* We need to get the compareat price in here */}
                        </span>
                      </Link>
                    </div>
                  )}
                  {shouldRenderListDescription &&
                    (product as any).descriptionHtml &&
                    windowWidth != undefined &&
                    windowWidth > 800 && (
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
                  {selectedVariantId && (
                    <div
                      className={`flex product-add-to-cart-container w-full mx-auto
                      p-a-t-c-container-list justify-start
                    `}
                    >
                      <AddToCartButton
                        lines={[
                          {
                            merchandiseId: selectedVariantId,
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
            </div>
          )}

          {/* END <= 600px LIST ---------------------------------*/}

          {/* BEGIN 600px-800px LIST --------------------------------*/}

          {/* Whole thing LIST 600px - 800px */}
          {shouldRenderListExpandedRange && (
            <div className={cardContentClassName}>
              <div className="cursor-pointer absolute right-2 top-2 z-50">
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
                          <div className="flex justify-center items-center">
                            <ReloadIcon className="animate-spin" />
                          </div>
                        ) : (
                          <>
                            {wishlistItem ? (
                              <div className="flex justify-center items-center">
                                <FaHeart />
                              </div>
                            ) : (
                              <>
                                {loginValue ? (
                                  <div className="flex justify-center items-center">
                                    <FaRegHeart />
                                  </div>
                                ) : (
                                  <Link to="/account/login">
                                    <div className="flex justify-center items-center">
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
              {isArtistPick && (
                <div className="absolute left-2 top-2 flex flex-col">
                  <button
                    disabled
                    className="artist-pick-list rounded-md flex items-center justify-center border border-border bg-background text-yellow-400 text-sm  disabled:cursor-default disabled:opacity-100"
                  >
                    Artist's Pick
                    <div className="flex justify-center items-end">
                      <img src={'/badge1.png'} className="badge-img" />
                    </div>
                  </button>
                </div>
              )}

              <div
                className={`relative evideo ${layout === 'grid' ? 'eproduct-top-part-card-grid' : 'eproduct-top-part-card-list'}`}
              >
                {hasDurationTag && (
                  <div className="absolute left-2 top-2 z-50 flex flex-col gap-1">
                    <button
                      disabled
                      className="duration-icon-list flex items-center justify-center rounded-md border border-border bg-background text-white hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100 text-sm"
                    >
                      {durationTag}
                    </button>
                  </div>
                )}
                {/* {thumbnail && (
                      <img
                        src={thumbnail}
                        alt="hi"
                        className="flex items-center justify-center rounded w-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                      />
                    )} */}

                {isBundle ? (
                  <EProductBundlePreview product={product} />
                ) : (
                  <Link
                    className="product-item"
                    key={product.id}
                    prefetch="intent"
                    to={variantUrl}
                  >
                    <EProductPreview EProduct={product} layout={layout} />
                  </Link>
                )}
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
              <div className={`eproduct-bottom-part-card-list relative`}>
                <div className="absolute inset-x-0 top-[7px] z-50 flex justify-start ps-[4px] gap-x-1">
                  <button
                    disabled
                    className="four-k rounded-md border flex items-center justify-center border-border bg-background  text-primary hover:bg-background  disabled:cursor-default disabled:opacity-100"
                    style={resolutionBadgeStyle}
                  >
                    {resolutionBadgeLabel}
                  </button>
                  {isSlowmo && (
                    <button
                      disabled
                      className="clip-icon-list slow-mo rounded-md flex items-center justify-center border border-border bg-background  text-white text-sm hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
                    >
                      Slow-mo
                    </button>
                  )}
                  {!isSlowmo && (
                    <button
                      disabled
                      className="clip-icon-list fps rounded-md flex items-center justify-center border border-border bg-background  text-white text-md hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
                    >
                      24fps
                    </button>
                  )}
                </div>
                <div
                  className={`eproduct-bottom-part-card-inside-list flex items-end w-full`}
                >
                  <div className="w-full">
                    <div className="flex justify-center">
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
                    </div>
                    {displayCardPrice && (
                      <div
                        className={`flex ${layout === 'grid' ? 'justify-center' : 'justify-center'}`}
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
                              price={displayCardPrice}
                              compareAtPrice={displayCardCompareAtPrice}
                            />

                            {/* We need to get the compareat price in here */}
                          </span>
                        </Link>
                      </div>
                    )}
                    {layout !== 'grid' &&
                      shouldRenderListDescription &&
                      (product as any).descriptionHtml &&
                      windowWidth != undefined &&
                      windowWidth > 800 && (
                        <>
                          <div className="w-[50%]">
                            <Link
                              className="product-item"
                              key={product.id}
                              prefetch="intent"
                              to={variantUrl}
                            >
                              <Card className="description-html-card-list ">
                                <div
                                  className="px-3 py-1"
                                  dangerouslySetInnerHTML={{
                                    __html: (product as any).descriptionHtml,
                                  }}
                                />
                              </Card>
                            </Link>
                          </div>
                        </>
                      )}
                    {selectedVariantId && (
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
                              merchandiseId: selectedVariantId,
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
              </div>
            </div>
          )}
          {/* END 600px-800px LIST ----------------------------------*/}
        </Card>
        {/* <div className="absolute top-5 right-2 z-5">
                <FavoriteToggleButton EProductId={productId} productId={null} />
              </div> */}
      </article>
      {/* ); */}
      {/* })} */}
      {/* {isSlowmo && (
              <button
                disabled
                className="clip-icon-list slow-mo rounded-md flex items-center justify-center border border-border bg-background  text-white text-sm hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
              >
                Slow-mo
              </button>
            )}
            {!isSlowmo && (
              <button
                disabled
                className="clip-icon-list fps rounded-md flex items-center justify-center border border-border bg-background  text-white text-md hover:bg-background hover:text-white disabled:cursor-default disabled:opacity-100"
              >
                24fps
              </button>
            )}
            <button
              disabled
              className="clip-icon-list four-k rounded-md border flex items-center justify-center border-border bg-background  text-primary hover:bg-background  disabled:cursor-default disabled:opacity-100"
            >
              4K
            </button> */}
    </>
  );
}

export default EProductsContainer;
