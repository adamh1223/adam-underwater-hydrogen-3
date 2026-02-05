import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Link, useFetcher, useLoaderData} from '@remix-run/react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Money} from '@shopify/hydrogen';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {ChevronUp} from 'lucide-react';
import Sectiontitle from '~/components/global/Sectiontitle';
import {Button} from '~/components/ui/button';
import {AddToCartButton} from '~/components/AddToCartButton';
import {
  getNotificationRecommendedProducts,
  syncCustomerNotifications,
} from '~/lib/notifications.server';
import type {Notification} from '~/lib/notifications';

type RecommendedProduct = {
  id: string;
  title: string;
  handle: string;
  featuredImage?: {
    url: string;
    altText?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
  priceRange: {
    minVariantPrice: {amount: string; currencyCode: string};
  };
  selectedOrFirstAvailableVariant?: {
    id: string;
    availableForSale: boolean;
    price: {amount: string; currencyCode: string};
  } | null;
};

export async function loader({context, request}: LoaderFunctionArgs) {
  await context.customerAccount.handleAuthStatus();

  const url = new URL(request.url);
  const requestedSelectedId = url.searchParams.get('selected');

  const {notifications} = await syncCustomerNotifications(context);
  const selectedId =
    requestedSelectedId &&
    notifications.some((notification) => notification.id === requestedSelectedId)
      ? requestedSelectedId
      : notifications[0]?.id ?? null;

  const selectedNotification = selectedId
    ? notifications.find((notification) => notification.id === selectedId) ?? null
    : null;

  let recommendedProducts: RecommendedProduct[] = [];
  if (
    selectedNotification?.type === 'recommendations' &&
    (selectedNotification.payload?.category === 'Prints' ||
      selectedNotification.payload?.category === 'Video')
  ) {
    recommendedProducts = await getNotificationRecommendedProducts(
      context,
      selectedNotification.payload.category,
    );
  }

  return json({
    notifications,
    selectedId,
    selectedNotification,
    recommendedProducts,
  });
}

function NotificationPreview({
  notification,
  isSelected,
  isUnread,
}: {
  notification: Notification;
  isSelected: boolean;
  isUnread: boolean;
}) {
  return (
    <div
      className={`rounded border px-3 py-2 transition-colors ${
        isSelected ? 'bg-accent' : 'bg-background hover:bg-accent/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{notification.title}</p>
            {isUnread && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {notification.message}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
          {new Date(notification.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

function MobileNotificationPreview({
  notification,
  isSelected,
  isUnread,
}: {
  notification: Notification;
  isSelected: boolean;
  isUnread: boolean;
}) {
  return (
    <div
      className={`rounded border px-3 py-2 transition-colors ${
        isSelected ? 'bg-accent' : 'bg-background hover:bg-accent/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{notification.title}</p>
            {isUnread && (
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            )}
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {notification.message}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <p className="whitespace-nowrap text-[11px] text-muted-foreground">
            {new Date(notification.createdAt).toLocaleDateString()}
          </p>
          <ChevronUp
            aria-hidden="true"
            size={18}
            className={`rounded-md border border-input text-primary transition-transform duration-200 ${
              isSelected ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </div>
      </div>
    </div>
  );
}

function RecommendationsGrid({
  products,
  category,
}: {
  products?: RecommendedProduct[];
  category: 'Prints' | 'Video';
}) {
  if (!products) {
    return (
      <p className="text-sm text-muted-foreground">Loading recommendations…</p>
    );
  }

  if (!products.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No recommendations available right now.
      </p>
    );
  }

  const isVideo = category === 'Video';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {products.map((product) => {
        const variantId = product.selectedOrFirstAvailableVariant?.id;
        const canAddToCart =
          isVideo &&
          Boolean(variantId) &&
          product.selectedOrFirstAvailableVariant?.availableForSale;

        return (
          <div key={product.id} className="rounded border p-3">
            <Link to={`/products/${product.handle}`} className="block">
              {product.featuredImage?.url ? (
                <img
                  src={product.featuredImage.url}
                  alt={product.featuredImage.altText ?? product.title}
                  className="w-full h-auto rounded"
                  loading="lazy"
                />
              ) : null}
              <p className="pt-2 font-medium">{product.title}</p>
              <div className="text-sm text-muted-foreground">
                From <Money data={product.priceRange.minVariantPrice} />
              </div>
            </Link>

            <div className="pt-3 flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <Link to={`/products/${product.handle}`}>View Product</Link>
              </Button>
              {isVideo && (
                <AddToCartButton
                  disabled={!canAddToCart}
                  lines={[
                    {
                      merchandiseId: variantId ?? '',
                      quantity: 1,
                    },
                  ]}
                >
                  Add to cart
                </AddToCartButton>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NotificationDetail({
  notification,
  recommendedProducts,
}: {
  notification: Notification;
  recommendedProducts?: RecommendedProduct[];
}) {
  const category = notification.payload?.category;

  return (
    <div className="space-y-3">
      <div className="rounded border p-4">
        <p className="text-lg font-semibold">{notification.title}</p>
        <p className="text-sm text-muted-foreground">
          {new Date(notification.createdAt).toLocaleString()}
        </p>
        <p className="pt-3">{notification.message}</p>
      </div>

      {notification.type === 'leave_review' && (
        <Button asChild variant="default">
          <Link to="/account/reviews">Leave a review →</Link>
        </Button>
      )}

      {notification.type === 'review_featured' && (
        <Button asChild variant="default">
          <Link to="/#featured-reviews">View featured reviews →</Link>
        </Button>
      )}

      {notification.type === 'discount' && (
        <Button asChild variant="default">
          <Link to="/account/profile">Go to profile →</Link>
        </Button>
      )}

      {notification.type === 'order_status' && notification.href && (
        <Button asChild variant="default">
          <Link to={notification.href}>View order →</Link>
        </Button>
      )}

      {notification.type === 'recommendations' &&
        (category === 'Prints' || category === 'Video') && (
          <div className="rounded border p-4">
            <p className="pb-3 font-semibold">
              {category === 'Video'
                ? 'You may also like these stock footage clips'
                : 'You may also like these prints'}
            </p>
            <RecommendationsGrid
              products={recommendedProducts}
              category={category}
            />
          </div>
        )}
    </div>
  );
}

export default function AccountNotifications() {
  const {
    notifications,
    selectedId,
    selectedNotification,
    recommendedProducts,
  } = useLoaderData<typeof loader>();

  const [localNotifications, setLocalNotifications] =
    useState<Notification[]>(notifications);

  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [mobileSelectedId, setMobileSelectedId] = useState<string | null>(
    selectedId ?? null,
  );

  useEffect(() => {
    setMobileSelectedId(selectedId ?? null);
  }, [selectedId]);

  const [mobileRecommendedProductsByCategory, setMobileRecommendedProductsByCategory] =
    useState<Partial<Record<'Prints' | 'Video', RecommendedProduct[]>>>(() => {
      const initial: Partial<Record<'Prints' | 'Video', RecommendedProduct[]>> =
        {};
      const category = selectedNotification?.payload?.category;
      if (
        selectedNotification?.type === 'recommendations' &&
        (category === 'Prints' || category === 'Video')
      ) {
        initial[category] = recommendedProducts;
      }
      return initial;
    });

  useEffect(() => {
    const category = selectedNotification?.payload?.category;
    if (
      selectedNotification?.type === 'recommendations' &&
      (category === 'Prints' || category === 'Video')
    ) {
      setMobileRecommendedProductsByCategory((prev) => ({
        ...prev,
        [category]: recommendedProducts,
      }));
    }
  }, [recommendedProducts, selectedNotification]);

  const activeSelectedId =
    windowWidth != undefined && windowWidth <= 830 ? mobileSelectedId : selectedId;

  const selected = useMemo(() => {
    if (!activeSelectedId) return null;
    return (
      localNotifications.find(
        (notification) => notification.id === activeSelectedId,
      ) ?? null
    );
  }, [activeSelectedId, localNotifications]);

  const markReadFetcher = useFetcher();
  const lastMarkedRef = useRef<string | null>(null);
  const recommendedProductsFetcher = useFetcher<
    | {ok: true; category: 'Prints' | 'Video'; products: RecommendedProduct[]}
    | {ok: false; error: string}
  >();
  const lastRequestedCategoryRef = useRef<'Prints' | 'Video' | null>(null);

  useEffect(() => {
    if (!selected) return;
    if (selected.readAt) return;
    if (lastMarkedRef.current === selected.id) return;

    lastMarkedRef.current = selected.id;
    const form = new FormData();
    form.append('notificationId', selected.id);
    markReadFetcher.submit(form, {method: 'post', action: '/api/notifications'});

    setLocalNotifications((prev) =>
      prev.map((notification) =>
        notification.id === selected.id
          ? {...notification, readAt: new Date().toISOString()}
          : notification,
      ),
    );
  }, [markReadFetcher, selected]);

  useEffect(() => {
    if (windowWidth == undefined || windowWidth > 830) return;
    if (!selected) return;

    if (selected.type !== 'recommendations') return;
    const category = selected.payload?.category;
    if (category !== 'Prints' && category !== 'Video') return;

    if (mobileRecommendedProductsByCategory[category] !== undefined) return;
    if (recommendedProductsFetcher.state !== 'idle') return;
    if (lastRequestedCategoryRef.current === category) return;

    lastRequestedCategoryRef.current = category;
    recommendedProductsFetcher.load(
      `/api/notification-recommended-products?category=${encodeURIComponent(
        category,
      )}`,
    );
  }, [
    mobileRecommendedProductsByCategory,
    recommendedProductsFetcher.state,
    selected,
    windowWidth,
  ]);

  useEffect(() => {
    const data = recommendedProductsFetcher.data;
    if (!data) return;

    if (data.ok) {
      setMobileRecommendedProductsByCategory((prev) => ({
        ...prev,
        [data.category]: data.products,
      }));
      lastRequestedCategoryRef.current = null;
      return;
    }

    const lastCategory = lastRequestedCategoryRef.current;
    if (lastCategory) {
      setMobileRecommendedProductsByCategory((prev) => ({
        ...prev,
        [lastCategory]: [],
      }));
    }
    lastRequestedCategoryRef.current = null;
  }, [recommendedProductsFetcher.data]);

  return (
    <>
    <Sectiontitle text="Notifications" />
      {windowWidth != undefined && windowWidth > 830 && 
      <div className="notifs-layout mx-3 mt-3 grid gap-4">
        <div className="space-y-2">
          {localNotifications.length ? (
            localNotifications.map((notification) => {
              const isSelected = notification.id === selectedId;
              const isUnread = !notification.readAt && !isSelected;
              return (
                <Link
                  key={notification.id}
                  to={`/account/notifications?selected=${encodeURIComponent(
                    notification.id,
                  )}`}
                  className="block"
                >
                  <NotificationPreview
                    notification={notification}
                    isSelected={isSelected}
                    isUnread={isUnread}
                  />
                </Link>
              );
            })
          ) : (
            <div className="rounded border p-4 text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <NotificationDetail
              notification={selected}
              recommendedProducts={recommendedProducts}
            />
          ) : (
            <div className="rounded border p-4 text-sm text-muted-foreground">
              Select a notification to view it.
            </div>
          )}
        </div>
      </div>}
      {windowWidth != undefined && windowWidth <= 830 && 
      <div className="notifs-layout mx-3 mt-3 grid gap-4">
        <div className="space-y-2">
          {localNotifications.length ? (
            <AccordionPrimitive.Root
              type="single"
              collapsible
              value={mobileSelectedId ?? ''}
              onValueChange={(value) => setMobileSelectedId(value || null)}
              className="space-y-2"
            >
              {localNotifications.map((notification) => {
                const isSelected = notification.id === mobileSelectedId;
                const isUnread = !notification.readAt && !isSelected;
                const category = notification.payload?.category;
                const accordionRecommendedProducts =
                  notification.type === 'recommendations' &&
                  (category === 'Prints' || category === 'Video')
                    ? mobileRecommendedProductsByCategory[category]
                    : undefined;

                return (
                  <AccordionPrimitive.Item
                    key={notification.id}
                    value={notification.id}
                    className="border-0"
                  >
                    <AccordionPrimitive.Header className="flex">
                      <AccordionPrimitive.Trigger className="w-full border-0 bg-transparent p-0 text-left outline-none">
                        <MobileNotificationPreview
                          notification={notification}
                          isSelected={isSelected}
                          isUnread={isUnread}
                        />
                      </AccordionPrimitive.Trigger>
                    </AccordionPrimitive.Header>

                    <AccordionPrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm">
                      <div className="pt-2">
                        <NotificationDetail
                          notification={notification}
                          recommendedProducts={accordionRecommendedProducts}
                        />
                      </div>
                    </AccordionPrimitive.Content>
                  </AccordionPrimitive.Item>
                );
              })}
            </AccordionPrimitive.Root>
          ) : (
            <div className="rounded border p-4 text-sm text-muted-foreground">
              No notifications yet.
            </div>
          )}
        </div>
      </div>}
    </>
  );
}
