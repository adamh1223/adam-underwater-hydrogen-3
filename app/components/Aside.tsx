import {useLocation} from '@remix-run/react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

type AsideType = 'search' | 'cart' | 'mobile' | 'closed';
type AsideContextValue = {
  type: AsideType;
  open: (mode: AsideType) => void;
  close: () => void;
};

/**
 * A side bar component with Overlay
 * @example
 * ```jsx
 * <Aside type="search" heading="SEARCH">
 *  <input type="search" />
 *  ...
 * </Aside>
 * ```
 */
export function Aside({
  children,
  heading,
  type,
}: {
  children?: React.ReactNode;
  type: AsideType;
  heading: React.ReactNode;
}) {
  const {type: activeType, close} = useAside();
  const expanded = type === activeType;
  const location = useLocation();
  const imageSource =
    type === 'cart'
      ? '/mycart.png'
      : type === 'search'
        ? '/searchstore.png'
        : undefined;
  const asideRef = useRef<HTMLElement | null>(null);
  const isStockFormOpen = () =>
    Boolean(document.querySelector('[data-stockform]'));

  useEffect(() => {
    const abortController = new AbortController();
    if (location.pathname === '/cart') {
      close();
    }
    if (expanded) {
      document.addEventListener(
        'pointerdown',
        (event) => {
          const target = event.target;
          if (!(target instanceof Node)) {
            return;
          }
          if (isStockFormOpen()) {
            return;
          }
          const element =
            target instanceof Element ? target : target.parentElement;
          if (element?.closest('[data-stockform]')) {
            return;
          }
          if (asideRef.current?.contains(target)) {
            return;
          }
          close();
        },
        {signal: abortController.signal},
      );
      document.addEventListener(
        'keydown',
        function handler(event: KeyboardEvent) {
          if (event.key === 'Escape') {
            close();
          }
        },
        {signal: abortController.signal},
      );
    }
    return () => abortController.abort();
  }, [close, expanded, location]);

  return (
    <div
      aria-modal
      className={`overlay ${expanded ? 'expanded' : ''}`}
      role="dialog"
    >
      <button
        className="close-outside"
        onClick={() => {
          if (!isStockFormOpen()) {
            close();
          }
        }}
      />

      <aside className="border-l" ref={asideRef}>
        <div className="pb-6">
          <div className="flex justify-end pe-4">
            <button
              className="close reset cursor-pointer text-xl"
              onClick={close}
              aria-label="Close"
            >
              &times;
            </button>
          </div>

          {(imageSource || heading) && (
            <header>
              <div className="flex justify-center border-b">
                {imageSource ? (
                  <img
                    src={imageSource}
                    alt={
                      type === 'cart'
                        ? 'Cart'
                        : type === 'search'
                          ? 'Search'
                          : ''
                    }
                    className="pt-3 h-[70px] lg:h-[90px]"
                  />
                ) : (
                  <h2 className="py-4 text-lg">{heading}</h2>
                )}
              </div>
            </header>
          )}

          <main>{children}</main>
        </div>
      </aside>
    </div>
  );
}

const AsideContext = createContext<AsideContextValue | null>(null);

function AsideTopOffsetSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    let headerEl: HTMLElement | null = null;
    let ro: ResizeObserver | null = null;
    let rafId: number | null = null;
    let attempts = 0;

    const update = () => {
      if (!headerEl) return;
      const headerBottom = Math.max(
        0,
        Math.round(headerEl.getBoundingClientRect().bottom),
      );
      root.style.setProperty('--aside-top', `${headerBottom}px`);
    };

    const init = () => {
      headerEl = document.querySelector('header.header') as HTMLElement | null;
      if (!headerEl) {
        attempts += 1;
        if (attempts < 60) {
          rafId = window.requestAnimationFrame(init);
        }
        return;
      }

      update();

      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(update);
        ro.observe(headerEl);
      }

      window.addEventListener('resize', update, {passive: true});
      window.addEventListener('scroll', update, {passive: true});
      window.visualViewport?.addEventListener('resize', update);
      window.visualViewport?.addEventListener('scroll', update);
    };

    init();

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      ro?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  return null;
}

Aside.Provider = function AsideProvider({children}: {children: ReactNode}) {
  const [type, setType] = useState<AsideType>('closed');

  return (
    <AsideContext.Provider
      value={{
        type,
        open: setType,
        close: () => setType('closed'),
      }}
    >
      <AsideTopOffsetSync />
      {children}
    </AsideContext.Provider>
  );
};

export function useAside() {
  const aside = useContext(AsideContext);
  if (!aside) {
    throw new Error('useAside must be used within an AsideProvider');
  }
  return aside;
}
