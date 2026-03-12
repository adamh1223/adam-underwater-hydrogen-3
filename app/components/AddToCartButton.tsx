import {useFetcher, type FetcherWithComponents} from '@remix-run/react';
import {
  CartForm,
  type OptimisticCartLineInput,
} from '@shopify/hydrogen';
import {useEffect, useRef} from 'react';
import {toast} from 'sonner';
import {
  emitCartPendingLinePreview,
  type CartPendingLinePreviewPayload,
} from '~/lib/cartPendingLine';

type LineWithPreloadHint = OptimisticCartLineInput & {
  __productId?: string;
  __isVideo?: boolean;
  __preview?: CartPendingLinePreviewPayload;
};

export function AddToCartButton({
  analytics,
  cart: _cart,
  children,
  disabled,
  lines,
  onClick,
  replaceExistingLineProductId,
}: {
  analytics?: unknown;
  cart?: Promise<unknown>;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  replaceExistingLineProductId?: string;
}) {
  const fetcher = useFetcher();

  return (
    <AddToCartContent
      analytics={analytics}
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
  children,
  disabled,
  fetcher,
  lines,
  onClick,
  replaceExistingLineProductId,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  fetcher: FetcherWithComponents<any>;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
  replaceExistingLineProductId?: string;
}) {
  const hasSubmitted = useRef(false);
  const hasShownImmediateToastForSubmit = useRef(false);

  useEffect(() => {
    if (fetcher.state === 'submitting') {
      hasSubmitted.current = true;
    }

    if (hasSubmitted.current && fetcher.state === 'idle') {
      const hasErrors = Boolean(fetcher.data?.errors?.length);
      if (!hasErrors && !hasShownImmediateToastForSubmit.current) {
        toast.success('Added to Cart');
      }
      hasShownImmediateToastForSubmit.current = false;
      hasSubmitted.current = false;
    }
  }, [fetcher.data, fetcher.state]);

  const handleSubmit = () => {
    onClick?.();

    const linesWithPreloadHints = lines.map((line) => {
      const candidate = line as LineWithPreloadHint;
      const hintedProductId =
        candidate.__productId ?? replaceExistingLineProductId;
      const hintedIsVideo =
        typeof candidate.__isVideo === 'boolean'
          ? candidate.__isVideo
          : Boolean(replaceExistingLineProductId);

      if (!hintedProductId && typeof candidate.__isVideo !== 'boolean') {
        return line;
      }

      return {
        ...candidate,
        ...(hintedProductId ? {__productId: hintedProductId} : {}),
        __isVideo: hintedIsVideo,
      };
    });
    const immediatePreview = linesWithPreloadHints
      .map((line) => (line as LineWithPreloadHint).__preview)
      .find((preview): preview is CartPendingLinePreviewPayload =>
        Boolean(preview?.merchandiseId),
      );
    if (immediatePreview) {
      emitCartPendingLinePreview(immediatePreview);
      toast.success('Added to Cart');
      hasShownImmediateToastForSubmit.current = true;
    }

    fetcher.submit(
      {
        [CartForm.INPUT_NAME]: JSON.stringify({
          action: CartForm.ACTIONS.LinesAdd,
          inputs: {
            lines: linesWithPreloadHints,
          },
        }),
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
          handleSubmit();
        }}
        disabled={disabled ?? fetcher.state !== 'idle'}
        className="flex-1 cursor-pointer add-to-cart-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow hover:bg-primary/90"
      >
        {children}
      </button>
    </>
  );
}
