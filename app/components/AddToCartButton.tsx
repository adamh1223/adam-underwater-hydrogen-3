import {useFetcher, type FetcherWithComponents} from '@remix-run/react';
import {
  CartForm,
  type CartReturn,
  type OptimisticCartLineInput,
} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import {toast} from 'sonner';

type CartSnapshot = Awaited<CartReturn | null>;

export function AddToCartButton({
  analytics,
  cart,
  children,
  disabled,
  lines,
  onClick,
  replaceExistingLineProductId,
}: {
  analytics?: unknown;
  cart?: Promise<CartSnapshot>;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  replaceExistingLineProductId?: string;
}) {
  const fetcher = useFetcher();
  const [cartSnapshot, setCartSnapshot] = useState<CartSnapshot>(null);

  useEffect(() => {
    let isCancelled = false;

    cart
      ?.then((resolvedCart) => {
        if (!isCancelled) {
          setCartSnapshot(resolvedCart);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setCartSnapshot(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [cart]);

  return (
    <AddToCartContent
      analytics={analytics}
      cart={cart}
      cartSnapshot={cartSnapshot}
      disabled={disabled}
      fetcher={fetcher}
      lines={lines}
      onClick={onClick}
      replaceExistingLineProductId={replaceExistingLineProductId}
    >
      {children}
    </AddToCartContent>
  );
}

function AddToCartContent({
  analytics,
  cart,
  cartSnapshot,
  children,
  disabled,
  fetcher,
  lines,
  onClick,
  replaceExistingLineProductId,
}: {
  analytics?: unknown;
  cart?: Promise<CartSnapshot>;
  cartSnapshot: CartSnapshot;
  children: React.ReactNode;
  disabled?: boolean;
  fetcher: FetcherWithComponents<any>;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  replaceExistingLineProductId?: string;
}) {
  const hasSubmitted = useRef(false);

  useEffect(() => {
    if (fetcher.state === 'submitting') {
      hasSubmitted.current = true;
    }

    if (hasSubmitted.current && fetcher.state === 'idle') {
      const hasErrors = Boolean(fetcher.data?.errors?.length);
      if (!hasErrors) {
        toast.success('Added to Cart');
      }
      hasSubmitted.current = false;
    }
  }, [fetcher.data, fetcher.state]);

  const handleSubmit = async () => {
    onClick?.();

    const currentCart =
      cartSnapshot ?? (await cart?.catch(() => null)) ?? null;
    const nextLine = lines[0];
    const matchingExistingLine =
      replaceExistingLineProductId && currentCart
        ? currentCart.lines.nodes.find(
            (line) =>
              line.merchandise.product.id === replaceExistingLineProductId,
          )
        : null;

    const payload = matchingExistingLine
      ? {
          action: CartForm.ACTIONS.LinesUpdate,
          inputs: {
            lines: [
              {
                id: matchingExistingLine.id,
                merchandiseId: nextLine?.merchandiseId,
                quantity: 1,
                attributes: nextLine?.attributes,
              },
            ],
          },
        }
      : {
          action: CartForm.ACTIONS.LinesAdd,
          inputs: {
            lines,
          },
        };

    fetcher.submit(
      {
        [CartForm.INPUT_NAME]: JSON.stringify(payload),
        analytics: JSON.stringify(analytics ?? null),
      },
      {method: 'post', action: '/cart'},
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void handleSubmit();
        }}
        disabled={disabled ?? fetcher.state !== 'idle'}
        className="flex-1 cursor-pointer add-to-cart-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow hover:bg-primary/90"
      >
        {children}
      </button>
    </>
  );
}
