import {json, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {Link, useFetcher, useLoaderData, useNavigate} from '@remix-run/react';
import {useEffect, useMemo, useRef, useState} from 'react';
import {Money} from '@shopify/hydrogen';
import * as AccordionPrimitive from '@radix-ui/react-accordion';
import {ChevronUp} from 'lucide-react';
import Sectiontitle from '~/components/global/Sectiontitle';
import {Button} from '~/components/ui/button';
import {AddToCartButton} from '~/components/AddToCartButton';
import ReviewForm from '~/components/form/ReviewForm';
import ProductReviewsDisplay, {
  type Review,
} from '~/components/global/ProductReviewsDisplay';
import {
  getNotificationRecommendedProducts,
  getNotificationOrderDetails,
  syncCustomerNotifications,
  type NotificationOrderDetails,
} from '~/lib/notifications.server';
import type {Notification} from '~/lib/notifications';
import {CUSTOMER_DETAILS_QUERY} from '~/graphql/customer-account/CustomerDetailsQuery';
import {GET_REVIEW_QUERY} from '~/lib/homeQueries';
import {toast} from 'sonner';

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

function formatNotificationDateTime(createdAt: string, timeZone: string | null) {
  if (!timeZone) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;

  try {
    const dateLabel = date.toLocaleDateString('en-US', {
      timeZone,
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
    const timeLabel = date.toLocaleTimeString('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return {
      dateLabel,
      timeLabel,
      dateTimeLabel: `${dateLabel} ${timeLabel}`,
    };
  } catch {
    const dateLabel = date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
    });
    const timeLabel = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return {
      dateLabel,
      timeLabel,
      dateTimeLabel: `${dateLabel} ${timeLabel}`,
    };
  }
}

export async function loader({context, request}: LoaderFunctionArgs) {
  await context.customerAccount.handleAuthStatus();

  const url = new URL(request.url);
  const requestedSelectedId = url.searchParams.get('selected');

  const {notifications, loggedIn} = await syncCustomerNotifications(context);
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

  let customerId: string | null = null;
  let customerName: string | null = null;
  if (loggedIn) {
    const customerResponse = await context.customerAccount
      .query(CUSTOMER_DETAILS_QUERY)
      .catch(() => null);
    const customer = customerResponse?.data?.customer;
    if (customer?.id) {
      customerId = customer.id as string;
      const name = [
        (customer.firstName as string | null | undefined) ?? '',
        (customer.lastName as string | null | undefined) ?? '',
      ]
        .join(' ')
        .trim();
      customerName = name.length ? name : null;
    }
  }

  let selectedLeaveReviewOrder: NotificationOrderDetails | null = null;
  if (selectedNotification?.type === 'leave_review') {
    const orderId = selectedNotification.payload?.orderId;
    if (typeof orderId === 'string' && orderId.length) {
      selectedLeaveReviewOrder = await getNotificationOrderDetails(
        context,
        orderId,
      );
    }
  }

  let selectedLeaveReviewUserReviews: Record<string, Review | null> | null =
    null;
  if (selectedLeaveReviewOrder?.lineItems?.length && customerId) {
    const printProductIds = Array.from(
      new Set(
        selectedLeaveReviewOrder.lineItems
          .filter((lineItem) => {
            const tags = lineItem.product?.tags ?? [];
            return tags.includes('Prints') && !tags.includes('Video');
          })
          .map((lineItem) => lineItem.product?.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    );

    const results = await Promise.all(
      printProductIds.map(async (productId) => {
        try {
          const response = await context.storefront.query(GET_REVIEW_QUERY, {
            variables: {productId},
          });
          const rawValue = response?.product?.metafield?.value;
          if (!rawValue) return {productId, review: null as Review | null};

          let parsed: Review[] = [];
          try {
            parsed = JSON.parse(rawValue) as Review[];
          } catch {
            parsed = [];
          }

          const matching = parsed
            .filter((review) => review?.customerId === customerId)
            .sort((a, b) =>
              String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')),
            )[0];

          return {productId, review: matching ?? null};
        } catch (error) {
          console.error('Unable to load product reviews', error);
          return {productId, review: null as Review | null};
        }
      }),
    );

    selectedLeaveReviewUserReviews = results.reduce<Record<string, Review | null>>(
      (acc, item) => {
        acc[item.productId] = item.review;
        return acc;
      },
      {},
    );
  }

  return json({
    notifications,
    selectedId,
    selectedNotification,
    recommendedProducts,
    customerId,
    customerName,
    selectedLeaveReviewOrder,
    selectedLeaveReviewUserReviews,
  });
}

function NotificationPreview({
  notification,
  isSelected,
  isUnread,
  dateLabel,
  timeLabel,
}: {
  notification: Notification;
  isSelected: boolean;
  isUnread: boolean;
  dateLabel?: string | null;
  timeLabel?: string | null;
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
        {dateLabel || timeLabel ? (
          <div className="flex shrink-0 flex-col items-end gap-1">
            {dateLabel ? (
              <p className="whitespace-nowrap text-[11px] text-muted-foreground">
                {dateLabel}
              </p>
            ) : null}
            {timeLabel ? (
              <p className="whitespace-nowrap text-[11px] text-muted-foreground">
                {timeLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileNotificationPreview({
  notification,
  isSelected,
  isUnread,
  dateLabel,
  timeLabel,
}: {
  notification: Notification;
  isSelected: boolean;
  isUnread: boolean;
  dateLabel?: string | null;
  timeLabel?: string | null;
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
          {dateLabel ? (
            <p className="whitespace-nowrap text-[11px] text-muted-foreground">
              {dateLabel}
            </p>
          ) : null}
          {timeLabel ? (
            <p className="whitespace-nowrap text-[11px] text-muted-foreground">
              {timeLabel}
            </p>
          ) : null}
          <ChevronUp
            aria-hidden="true"
            size={18}
            className={`mt-1 translate-y-0.5 rounded-md border border-input text-primary transition-transform duration-200 ${
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
  dateTimeLabel,
  orderDetails,
  customerId,
  customerName,
  userReviewsByProductId,
  isLoadingOrderDetails,
}: {
  notification: Notification;
  recommendedProducts?: RecommendedProduct[];
  dateTimeLabel?: string | null;
  orderDetails?: NotificationOrderDetails | null;
  customerId?: string | null;
  customerName?: string | null;
  userReviewsByProductId?: Record<string, Review | null> | null;
  isLoadingOrderDetails?: boolean;
}) {
  const category = notification.payload?.category;
  const navigate = useNavigate();
  const resolvedCustomerId = typeof customerId === 'string' ? customerId : null;
  const resolvedCustomerName = typeof customerName === 'string' ? customerName : '';

  const [localUserReviewsByProductId, setLocalUserReviewsByProductId] = useState<
    Record<string, Review | null>
  >(() => userReviewsByProductId ?? {});

  useEffect(() => {
    setLocalUserReviewsByProductId(userReviewsByProductId ?? {});
  }, [notification.id, userReviewsByProductId]);

  const handleRemoveReview = async (productId: string, reviewToRemove: Review) => {
    if (!resolvedCustomerId || !reviewToRemove?.createdAt) return;

    const form = new FormData();
    form.append('productId', productId);
    form.append('customerId', resolvedCustomerId);
    form.append('createdAt', reviewToRemove.createdAt);

    try {
      const response = await fetch('/api/remove_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });

      if (!response.ok) {
        console.error('Failed to remove review', await response.text());
        return;
      }

      const data = await response.json();
      const updatedReviews: Review[] = data?.reviews ?? [];
      const matching = updatedReviews
        .filter((review) => review?.customerId === resolvedCustomerId)
        .sort((a, b) =>
          String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')),
        )[0];

      setLocalUserReviewsByProductId((prev) => ({
        ...prev,
        [productId]: matching ?? null,
      }));
      toast.success('Review Deleted');
    } catch (error) {
      console.error('Error removing review', error);
    }
  };

  const handleEditReview = async (
    productId: string,
    reviewToEdit: Review,
    updates: {
      text: string;
      title: string;
      stars: number;
      image?: File | null;
      video?: File | null;
      isFeatured?: boolean;
    },
  ) => {
    if (!resolvedCustomerId || !reviewToEdit?.createdAt) return;

    const form = new FormData();
    form.append('productId', productId);
    form.append('customerId', resolvedCustomerId);
    form.append('createdAt', reviewToEdit.createdAt);
    form.append('review', updates.text);
    form.append('stars', updates.stars.toString());
    form.append('title', updates.title);
    form.append('customerName', resolvedCustomerName);
    if (updates.image) {
      form.append('image', updates.image);
    }
    if (updates.video) {
      form.append('video', updates.video);
    }

    try {
      const response = await fetch('/api/edit_review', {
        method: 'POST',
        body: form,
        headers: {Accept: 'application/json'},
      });

      if (!response.ok) {
        console.error('Failed to edit review', await response.text());
        return;
      }

      const data = await response.json();
      const updatedReviews: Review[] = data?.reviews ?? [];
      const matching = updatedReviews
        .filter((review) => review?.customerId === resolvedCustomerId)
        .sort((a, b) =>
          String(b?.createdAt ?? '').localeCompare(String(a?.createdAt ?? '')),
        )[0];

      setLocalUserReviewsByProductId((prev) => ({
        ...prev,
        [productId]: matching ?? prev[productId] ?? null,
      }));
      toast.success('Review Changes Saved');
    } catch (error) {
      console.error('Error editing review', error);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded border p-4">
        <p className="text-lg font-semibold">{notification.title}</p>
        {dateTimeLabel ? (
          <p className="text-sm text-muted-foreground">{dateTimeLabel}</p>
        ) : null}
        <p className="pt-3">{notification.message}</p>
      </div>

      {notification.type === 'leave_review' && (
        <>
          {isLoadingOrderDetails || orderDetails === undefined ? (
            <div className="rounded border p-4 text-sm text-muted-foreground">
              Loading order items…
            </div>
          ) : orderDetails ? (
            <>
              <Button asChild variant="default">
                <Link
                  to={`/account/orders/${encodeURIComponent(
                    btoa(orderDetails.orderId),
                  )}`}
                >
                  Order details →
                </Link>
              </Button>

              {orderDetails.lineItems.length ? (
                <div className="space-y-4">
                  {orderDetails.lineItems.map((lineItem) => {
                    const handle = lineItem.product?.handle;
                    const productHref = handle ? `/products/${handle}` : null;
                    const tags = lineItem.product?.tags ?? [];
                    const isPrint =
                      tags.includes('Prints') && !tags.includes('Video');
                    const productId = lineItem.product?.id ?? null;
                    const existingReview = productId
                      ? localUserReviewsByProductId[productId]
                      : null;

                    return (
                      <div key={lineItem.id} className="rounded border p-4">
                        {productHref ? (
                          <Link to={productHref} className="block">
                            <div className="flex gap-3">
                              {lineItem.image?.url ? (
                                <img
                                  src={lineItem.image.url}
                                  alt={
                                    lineItem.image.altText ??
                                    lineItem.title ??
                                    'Ordered item'
                                  }
                                  className="h-20 w-20 shrink-0 rounded object-cover"
                                  loading="lazy"
                                />
                              ) : null}
                              <div className="min-w-0">
                                <p className="font-semibold line-clamp-2">
                                  {lineItem.title}
                                </p>
                                {lineItem.variantTitle ? (
                                  <p className="text-sm text-muted-foreground">
                                    {lineItem.variantTitle}
                                  </p>
                                ) : null}
                                <p className="text-sm text-muted-foreground">
                                  Qty {lineItem.quantity}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ) : (
                          <div className="flex gap-3">
                            {lineItem.image?.url ? (
                              <img
                                src={lineItem.image.url}
                                alt={
                                  lineItem.image.altText ??
                                  lineItem.title ??
                                  'Ordered item'
                                }
                                className="h-20 w-20 shrink-0 rounded object-cover"
                                loading="lazy"
                              />
                            ) : null}
                            <div className="min-w-0">
                              <p className="font-semibold line-clamp-2">
                                {lineItem.title}
                              </p>
                              {lineItem.variantTitle ? (
                                <p className="text-sm text-muted-foreground">
                                  {lineItem.variantTitle}
                                </p>
                              ) : null}
                              <p className="text-sm text-muted-foreground">
                                Qty {lineItem.quantity}
                              </p>
                            </div>
                          </div>
                        )}

                        {isPrint && productId ? (
                          existingReview ? (
                            <div className='mt-3'>

                              <ProductReviewsDisplay
                                review={{
                                  ...existingReview,
                                  productId,
                                  productName: lineItem.title,
                                  productHandle: lineItem.product?.handle,
                                }}
                                isAdmin={false}
                                currentCustomerId={resolvedCustomerId ?? undefined}
                                onRemove={(review) => handleRemoveReview(productId, review)}
                                onEdit={(review, updates) =>
                                  handleEditReview(productId, review, updates)
                                }
                              />
                            </div>
                          ) : (
                            <ReviewForm
                              productId={productId}
                              productName={lineItem.title}
                              customerId={resolvedCustomerId ?? undefined}
                              customerName={resolvedCustomerName || undefined}
                              updateExistingReviews={(updatedReviews) => {
                                const matching = (updatedReviews ?? [])
                                  .filter(
                                    (review) =>
                                      review?.customerId === resolvedCustomerId,
                                  )
                                  .sort((a, b) =>
                                    String(b?.createdAt ?? '').localeCompare(
                                      String(a?.createdAt ?? ''),
                                    ),
                                  )[0];

                                setLocalUserReviewsByProductId((prev) => ({
                                  ...prev,
                                  [productId]: matching ?? null,
                                }));
                              }}
                              userReviewExists={false}
                              isBlocked={false}
                              successToast={{
                                message: 'Review Submitted',
                                action: productHref
                                  ? {
                                      label: 'View Review',
                                      onClick: () =>
                                        navigate(`${productHref}#reviews`),
                                    }
                                  : undefined,
                              }}
                              submittedMessage="Review Submitted"
                            />
                          )
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded border p-4 text-sm text-muted-foreground">
                  No items found for this order.
                </div>
              )}
            </>
          ) : (
            <div className="rounded border p-4 text-sm text-muted-foreground">
              Unable to load order items.
            </div>
          )}
        </>
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
    customerId,
    customerName,
    selectedLeaveReviewOrder,
    selectedLeaveReviewUserReviews,
  } = useLoaderData<typeof loader>();

  const [localNotifications, setLocalNotifications] =
    useState<Notification[]>(notifications);

  useEffect(() => {
    setLocalNotifications(notifications);
  }, [notifications]);

  const [clientTimeZone, setClientTimeZone] = useState<string | null>(null);
  useEffect(() => {
    setClientTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
  }, []);

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

  const [mobileOrderDetailsByOrderId, setMobileOrderDetailsByOrderId] = useState<
    Record<string, NotificationOrderDetails | null>
  >(() => {
    if (selectedLeaveReviewOrder?.orderId) {
      return {[selectedLeaveReviewOrder.orderId]: selectedLeaveReviewOrder};
    }
    return {};
  });

  const [mobileUserReviewsByOrderId, setMobileUserReviewsByOrderId] = useState<
    Record<string, Record<string, Review | null> | null>
  >(() => {
    if (selectedLeaveReviewOrder?.orderId) {
      return {
        [selectedLeaveReviewOrder.orderId]: selectedLeaveReviewUserReviews ?? null,
      };
    }
    return {};
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
    windowWidth != undefined && windowWidth <= 860 ? mobileSelectedId : selectedId;

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
  const orderDetailsFetcher = useFetcher<
    | {
        ok: true;
        order: NotificationOrderDetails;
        userReviewsByProductId: Record<string, Review | null> | null;
      }
    | {ok: false; error: string}
  >();
  const lastRequestedOrderIdRef = useRef<string | null>(null);

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
    if (windowWidth == undefined || windowWidth > 860) return;
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

  useEffect(() => {
    if (windowWidth == undefined || windowWidth > 860) return;
    if (!selected) return;
    if (selected.type !== 'leave_review') return;

    const orderId = selected.payload?.orderId;
    if (typeof orderId !== 'string' || !orderId.length) return;

    if (mobileOrderDetailsByOrderId[orderId] !== undefined) return;
    if (orderDetailsFetcher.state !== 'idle') return;
    if (lastRequestedOrderIdRef.current === orderId) return;

    lastRequestedOrderIdRef.current = orderId;
    orderDetailsFetcher.load(
      `/api/notification-order-details?orderId=${encodeURIComponent(orderId)}`,
    );
  }, [
    mobileOrderDetailsByOrderId,
    orderDetailsFetcher.state,
    selected,
    windowWidth,
  ]);

  useEffect(() => {
    const data = orderDetailsFetcher.data;
    if (!data) return;

    if (data.ok) {
      setMobileOrderDetailsByOrderId((prev) => ({
        ...prev,
        [data.order.orderId]: data.order,
      }));
      setMobileUserReviewsByOrderId((prev) => ({
        ...prev,
        [data.order.orderId]: data.userReviewsByProductId ?? null,
      }));
      lastRequestedOrderIdRef.current = null;
      return;
    }

    const lastOrderId = lastRequestedOrderIdRef.current;
    if (lastOrderId) {
      setMobileOrderDetailsByOrderId((prev) => ({
        ...prev,
        [lastOrderId]: null,
      }));
      setMobileUserReviewsByOrderId((prev) => ({
        ...prev,
        [lastOrderId]: null,
      }));
    }
    lastRequestedOrderIdRef.current = null;
  }, [orderDetailsFetcher.data]);

  return (
    <>
      <Sectiontitle text="Notifications" />

      {windowWidth != undefined && windowWidth > 860 && (
        <div className="notifs-layout mx-3 mt-3 grid gap-4">
          <div className="space-y-2">
            {localNotifications.length ? (
              localNotifications.map((notification) => {
                const isSelected = notification.id === selectedId;
                const isUnread = !notification.readAt && !isSelected;
                const dateTime = formatNotificationDateTime(
                  notification.createdAt,
                  clientTimeZone,
                );
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
                      dateLabel={dateTime?.dateLabel}
                      timeLabel={dateTime?.timeLabel}
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
                dateTimeLabel={
                  formatNotificationDateTime(selected.createdAt, clientTimeZone)
                    ?.dateTimeLabel
                }
                orderDetails={
                  selected.type === 'leave_review'
                    ? selectedLeaveReviewOrder
                    : undefined
                }
                userReviewsByProductId={
                  selected.type === 'leave_review'
                    ? selectedLeaveReviewUserReviews
                    : undefined
                }
                customerId={customerId}
                customerName={customerName}
              />
            ) : (
              <div className="rounded border p-4 text-sm text-muted-foreground">
                Select a notification to view it.
              </div>
            )}
          </div>
        </div>
      )}

      {windowWidth != undefined && windowWidth <= 860 && (
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
                  const dateTime = formatNotificationDateTime(
                    notification.createdAt,
                    clientTimeZone,
                  );
                  const category = notification.payload?.category;
                  const accordionRecommendedProducts =
                    notification.type === 'recommendations' &&
                    (category === 'Prints' || category === 'Video')
                      ? mobileRecommendedProductsByCategory[category]
                      : undefined;
                  const orderId = notification.payload?.orderId;
                  const accordionOrderDetails =
                    notification.type === 'leave_review' &&
                    typeof orderId === 'string'
                      ? mobileOrderDetailsByOrderId[orderId]
                      : undefined;
                  const accordionUserReviewsByProductId =
                    notification.type === 'leave_review' &&
                    typeof orderId === 'string'
                      ? mobileUserReviewsByOrderId[orderId]
                      : undefined;
                  const isLoadingOrderDetails =
                    notification.type === 'leave_review' &&
                    typeof orderId === 'string' &&
                    orderDetailsFetcher.state !== 'idle' &&
                    lastRequestedOrderIdRef.current === orderId;

                  return (
                    <AccordionPrimitive.Item
                      key={notification.id}
                      value={notification.id}
                      className="border-0"
                    >
                      <AccordionPrimitive.Header className="flex">
                        <AccordionPrimitive.Trigger className="w-full border-0 bg-transparent p-0 text-left outline-none cursor-pointer">
                          <MobileNotificationPreview
                            notification={notification}
                            isSelected={isSelected}
                            isUnread={isUnread}
                            dateLabel={dateTime?.dateLabel}
                            timeLabel={dateTime?.timeLabel}
                          />
                        </AccordionPrimitive.Trigger>
                      </AccordionPrimitive.Header>

                      <AccordionPrimitive.Content className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm">
                        <div className="pt-2">
                          <NotificationDetail
                            notification={notification}
                            recommendedProducts={accordionRecommendedProducts}
                            dateTimeLabel={dateTime?.dateTimeLabel}
                            orderDetails={accordionOrderDetails}
                            userReviewsByProductId={accordionUserReviewsByProductId}
                            customerId={customerId}
                            customerName={customerName}
                            isLoadingOrderDetails={isLoadingOrderDetails}
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
        </div>
      )}
    </>
  );
}
