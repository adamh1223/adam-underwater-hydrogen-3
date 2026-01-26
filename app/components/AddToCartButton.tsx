import {type FetcherWithComponents} from '@remix-run/react';
import {CartForm, type OptimisticCartLineInput} from '@shopify/hydrogen';
import {useEffect, useRef, useState} from 'react';
import {toast} from 'sonner';

export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  lines: Array<OptimisticCartLineInput>;
  onClick?: () => void;
}) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });
  return (
    <CartForm route="/cart" inputs={{lines}} action={CartForm.ACTIONS.LinesAdd}>
      {(fetcher: FetcherWithComponents<any>) => (
        <>
          <AddToCartContent
            analytics={analytics}
            disabled={disabled}
            fetcher={fetcher}
            onClick={onClick}
          >
            {children}
          </AddToCartContent>
        </>
      )}
    </CartForm>
  );
}

function AddToCartContent({
  analytics,
  children,
  disabled,
  fetcher,
  onClick,
}: {
  analytics?: unknown;
  children: React.ReactNode;
  disabled?: boolean;
  fetcher: FetcherWithComponents<any>;
  onClick?: () => void;
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

  return (
    <>
      <input name="analytics" type="hidden" value={JSON.stringify(analytics)} />
      <button
        type="submit"
        onClick={onClick}
        disabled={disabled ?? fetcher.state !== 'idle'}
        className="flex-1 cursor-pointer add-to-cart-btn inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow hover:bg-primary/90"
      >
        {children}
      </button>
    </>
  );
}
