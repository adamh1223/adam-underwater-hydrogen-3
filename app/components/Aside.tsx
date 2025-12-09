import {useLocation} from '@remix-run/react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
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
  const determineActiveTypeImage = () => {
    if (activeType === 'cart') {
      return '/mycart.png';
    }
    if (activeType === 'search') {
      return '/searchstore.png';
    }
  };
  const location = useLocation();
  const imageSource = determineActiveTypeImage();
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    const abortController = new AbortController();
    if (location.pathname === '/cart') {
      close();
    }
    if (expanded) {
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
      <button className="close-outside" onClick={close} />

      <aside className="border-l">
        {windowWidth != null && windowWidth > 1023 && (
          <div className="mt-[70px]">
            <div className="flex justify-end pe-4">
              <button
                className="close reset cursor-pointer text-xl"
                onClick={close}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <header>
              <div className="flex justify-center border-b">
                <img
                  src={imageSource}
                  style={{height: '90px'}}
                  className="pt-3"
                ></img>
              </div>
            </header>
            <main>{children}</main>
          </div>
        )}
        {windowWidth != null && windowWidth <= 1023 && (
          <div className="mt-[110px]">
            <div className="flex justify-end pe-4">
              <button
                className="close reset cursor-pointer text-xl"
                onClick={close}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <header>
              <div className="flex justify-center border-b">
                <img
                  src={imageSource}
                  style={{height: '80px'}}
                  className="pt-3"
                ></img>
              </div>
            </header>
            <main>{children}</main>
          </div>
        )}
      </aside>
    </div>
  );
}

const AsideContext = createContext<AsideContextValue | null>(null);

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
