import {useEffect, useRef, useState} from 'react';

type Options = {
  scrollCooldownMs?: number;
  activationWindowMs?: number;
};

const MOBILE_TOUCH_QUERY = '(hover: none) and (pointer: coarse)';
const MOBILE_COARSE_POINTER_QUERY = '(pointer: coarse)';

export function useMobileActivationGuard(options: Options = {}) {
  const {scrollCooldownMs = 700, activationWindowMs = 1200} = options;
  const [isMobileTouchUi, setIsMobileTouchUi] = useState(false);
  const lastScrollLikeAtRef = useRef(0);
  const lastDirectActivationByTargetRef = useRef<Record<string, number>>({});
  const lastTouchLikeAtRef = useRef(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(MOBILE_TOUCH_QUERY);
    const coarsePointerQuery = window.matchMedia(MOBILE_COARSE_POINTER_QUERY);
    const updateMatch = () => {
      // iOS + some hybrid devices can report touch capability inconsistently.
      // Use coarse pointer OR maxTouchPoints as a stronger mobile-touch signal.
      const hasTouchPoints =
        typeof navigator !== 'undefined' &&
        typeof navigator.maxTouchPoints === 'number' &&
        navigator.maxTouchPoints > 0;
      setIsMobileTouchUi(
        mediaQuery.matches || coarsePointerQuery.matches || hasTouchPoints,
      );
    };
    const markScrollLike = () => {
      lastScrollLikeAtRef.current = Date.now();
    };
    const markTouchLike = () => {
      lastTouchLikeAtRef.current = Date.now();
    };
    const markTouchLikePointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        markTouchLike();
      }
    };

    updateMatch();

    window.addEventListener('scroll', markScrollLike, {passive: true});
    window.addEventListener('touchmove', markScrollLike, {passive: true});
    window.addEventListener('wheel', markScrollLike, {passive: true});
    window.addEventListener('touchstart', markTouchLike, {passive: true});
    window.addEventListener('pointerdown', markTouchLikePointerDown, {
      passive: true,
    });

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', updateMatch);
      coarsePointerQuery.addEventListener('change', updateMatch);
    } else {
      mediaQuery.addListener(updateMatch);
      coarsePointerQuery.addListener(updateMatch);
    }

    return () => {
      window.removeEventListener('scroll', markScrollLike);
      window.removeEventListener('touchmove', markScrollLike);
      window.removeEventListener('wheel', markScrollLike);
      window.removeEventListener('touchstart', markTouchLike);
      window.removeEventListener('pointerdown', markTouchLikePointerDown);

      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', updateMatch);
        coarsePointerQuery.removeEventListener('change', updateMatch);
      } else {
        mediaQuery.removeListener(updateMatch);
        coarsePointerQuery.removeListener(updateMatch);
      }
    };
  }, []);

  const markDirectActivation = (targetKey: string) => {
    lastDirectActivationByTargetRef.current[targetKey] = Date.now();
  };

  const getActivationDecision = (targetKey?: string) => {
    if (!isMobileTouchUi) {
      return {
        suppress: false,
        reason: 'non-touch-ui',
        ageSinceScrollLikeMs: null as number | null,
        ageSinceTouchLikeMs: null as number | null,
        ageSinceDirectActivationMs: null as number | null,
      };
    }

    const now = Date.now();
    const ageSinceScrollLikeMs = now - lastScrollLikeAtRef.current;
    const ageSinceTouchLikeMs = now - lastTouchLikeAtRef.current;
    const directActivationAt = targetKey
      ? lastDirectActivationByTargetRef.current[targetKey] ?? 0
      : 0;
    const ageSinceDirectActivationMs = directActivationAt
      ? now - directActivationAt
      : null;

    if (ageSinceScrollLikeMs < scrollCooldownMs) {
      return {
        suppress: true,
        reason: 'recent-scroll-like-gesture',
        ageSinceScrollLikeMs,
        ageSinceTouchLikeMs,
        ageSinceDirectActivationMs,
      };
    }

    if (targetKey) {
      if (
        ageSinceDirectActivationMs == null ||
        ageSinceDirectActivationMs > activationWindowMs
      ) {
        return {
          suppress: true,
          reason: 'missing-or-stale-direct-target-press',
          ageSinceScrollLikeMs,
          ageSinceTouchLikeMs,
          ageSinceDirectActivationMs,
        };
      }
    } else if (ageSinceTouchLikeMs > activationWindowMs) {
      return {
        suppress: true,
        reason: 'stale-touch-context',
        ageSinceScrollLikeMs,
        ageSinceTouchLikeMs,
        ageSinceDirectActivationMs,
      };
    }

    return {
      suppress: false,
      reason: 'allowed',
      ageSinceScrollLikeMs,
      ageSinceTouchLikeMs,
      ageSinceDirectActivationMs,
    };
  };

  const shouldSuppressActivation = (targetKey?: string) => {
    return getActivationDecision(targetKey).suppress;
  };

  const getActivationTargetProps = (targetKey: string) => ({
    onTouchStartCapture: () => markDirectActivation(targetKey),
    onPointerDownCapture: (event: {pointerType?: string}) => {
      if (event.pointerType !== 'mouse') {
        markDirectActivation(targetKey);
      }
    },
  });

  return {
    isMobileTouchUi,
    shouldSuppressActivation,
    getActivationDecision,
    getActivationTargetProps,
  };
}
