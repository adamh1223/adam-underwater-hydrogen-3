import {useEffect, useRef, useState} from 'react';

type Options = {
  scrollCooldownMs?: number;
};

const MOBILE_TOUCH_QUERY = '(hover: none) and (pointer: coarse)';

export function useMobileActivationGuard(options: Options = {}) {
  const {scrollCooldownMs = 350} = options;
  const [isMobileTouchUi, setIsMobileTouchUi] = useState(false);
  const lastScrollLikeAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(MOBILE_TOUCH_QUERY);
    const updateMatch = () => setIsMobileTouchUi(mediaQuery.matches);
    const markScrollLike = () => {
      lastScrollLikeAtRef.current = Date.now();
    };

    updateMatch();

    window.addEventListener('scroll', markScrollLike, {passive: true});
    window.addEventListener('touchmove', markScrollLike, {passive: true});

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatch);
    } else {
      mediaQuery.addListener(updateMatch);
    }

    return () => {
      window.removeEventListener('scroll', markScrollLike);
      window.removeEventListener('touchmove', markScrollLike);

      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updateMatch);
      } else {
        mediaQuery.removeListener(updateMatch);
      }
    };
  }, []);

  const shouldSuppressActivation = () => {
    if (!isMobileTouchUi) return false;
    return Date.now() - lastScrollLikeAtRef.current < scrollCooldownMs;
  };

  return {
    isMobileTouchUi,
    shouldSuppressActivation,
  };
}
