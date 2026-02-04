import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Link, useFetcher, useLoaderData} from '@remix-run/react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Money} from '@shopify/hydrogen';
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

function RecommendationsGrid({
  products,
  category,
}: {
  products: RecommendedProduct[];
  category: 'Prints' | 'Video';
}) {
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
  recommendedProducts: RecommendedProduct[];
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
  const {notifications, selectedId, selectedNotification, recommendedProducts} =
    useLoaderData<typeof loader>();

  const [localNotifications, setLocalNotifications] =
    useState<Notification[]>(notifications);

  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      localNotifications.find((notification) => notification.id === selectedId) ??
      null
    );
  }, [localNotifications, selectedId]);

  const markReadFetcher = useFetcher();
  const lastMarkedRef = useRef<string | null>(null);

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

  return (
    <>
      <Sectiontitle text="Notifications" />
      <div className="mx-3 mt-3 grid grid-cols-1 lg:grid-cols-2 gap-4">
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
      </div>
    </>
  );
}

