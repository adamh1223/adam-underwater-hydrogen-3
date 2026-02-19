import {useCallback, useEffect, useRef, useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';

const TOUCH_CARD_HIGHLIGHT_EVENT = 'touch-card-highlight:activate';

type TouchCardHighlightHandlers = {
  onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => void;
  onTouchStartCapture: () => void;
};

type TouchCardHighlightEventDetail = {
  cardId: string;
};

let globalTouchListenerRefCount = 0;
let globalTouchStartListener: ((event: TouchEvent) => void) | null = null;
let globalTouchEndListener: ((event: TouchEvent) => void) | null = null;
let globalScrollListener: (() => void) | null = null;
let touchFollowUpRafId = 0;
let touchFollowUpTimeoutIds: number[] = [];
let scrollStopTimeoutId: number | null = null;
let lastTouchPoint:
  | {clientX: number; clientY: number; timestamp: number}
  | null = null;

function dispatchTouchCardHighlight(cardId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<TouchCardHighlightEventDetail>(TOUCH_CARD_HIGHLIGHT_EVENT, {
      detail: {cardId},
    }),
  );
}

function dispatchTouchHighlightAtPoint(
  clientX: number,
  clientY: number,
): string | undefined {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return undefined;
  }

  const clampedX = Math.max(0, Math.min(clientX, window.innerWidth - 1));
  const clampedY = Math.max(0, Math.min(clientY, window.innerHeight - 1));

  let cardId: string | undefined;

  const elementsAtPoint = document.elementsFromPoint(clampedX, clampedY);
  for (const elementAtPoint of elementsAtPoint) {
    if (!(elementAtPoint instanceof Element)) continue;
    const highlightedCard = elementAtPoint.closest<HTMLElement>(
      '[data-touch-highlight-card-id]',
    );
    cardId = highlightedCard?.dataset.touchHighlightCardId;
    if (cardId) break;
  }

  if (!cardId) {
    const fallbackTarget = document.elementFromPoint(clampedX, clampedY);
    if (fallbackTarget instanceof Element) {
      const fallbackCard = fallbackTarget.closest<HTMLElement>(
        '[data-touch-highlight-card-id]',
      );
      cardId = fallbackCard?.dataset.touchHighlightCardId;
    }
  }

  if (!cardId) return undefined;

  dispatchTouchCardHighlight(cardId);
  return cardId;
}

function clearTouchFollowUps() {
  if (typeof window === 'undefined') return;
  if (touchFollowUpRafId) {
    cancelAnimationFrame(touchFollowUpRafId);
    touchFollowUpRafId = 0;
  }
  touchFollowUpTimeoutIds.forEach((timeoutId) => {
    window.clearTimeout(timeoutId);
  });
  touchFollowUpTimeoutIds = [];
}

function clearScrollStopTimeout() {
  if (typeof window === 'undefined' || scrollStopTimeoutId === null) return;
  window.clearTimeout(scrollStopTimeoutId);
  scrollStopTimeoutId = null;
}

function highlightAfterScrollSettles() {
  if (typeof window === 'undefined') return;

  const now = Date.now();
  const recentTouchPoint =
    lastTouchPoint && now - lastTouchPoint.timestamp <= 1200
      ? lastTouchPoint
      : null;

  const focusX = recentTouchPoint?.clientX ?? window.innerWidth / 2;
  const focusY = recentTouchPoint?.clientY ?? window.innerHeight / 2;
  const highlightSucceeded = Boolean(dispatchTouchHighlightAtPoint(focusX, focusY));

  if (!highlightSucceeded && recentTouchPoint) {
    dispatchTouchHighlightAtPoint(window.innerWidth / 2, window.innerHeight / 2);
  }
}

function scheduleScrollStopHighlight() {
  if (typeof window === 'undefined') return;
  clearScrollStopTimeout();
  scrollStopTimeoutId = window.setTimeout(() => {
    scrollStopTimeoutId = null;
    highlightAfterScrollSettles();
  }, 90);
}

function scheduleTouchFollowUps(clientX: number, clientY: number) {
  if (typeof window === 'undefined') return;
  clearTouchFollowUps();

  // Touches that stop momentum can settle one or two frames later.
  touchFollowUpRafId = requestAnimationFrame(() => {
    dispatchTouchHighlightAtPoint(clientX, clientY);
    touchFollowUpRafId = 0;
  });

  [50, 120, 220].forEach((delayMs) => {
    const timeoutId = window.setTimeout(() => {
      dispatchTouchHighlightAtPoint(clientX, clientY);
    }, delayMs);
    touchFollowUpTimeoutIds.push(timeoutId);
  });
}

function installGlobalTouchStartListener() {
  if (typeof document === 'undefined' || globalTouchStartListener) return;

  globalTouchStartListener = (event: TouchEvent) => {
    const touch = event.changedTouches?.[0] ?? event.touches?.[0];
    if (!touch) return;
    lastTouchPoint = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      timestamp: Date.now(),
    };
    dispatchTouchHighlightAtPoint(touch.clientX, touch.clientY);
    scheduleTouchFollowUps(touch.clientX, touch.clientY);
  };

  globalTouchEndListener = (event: TouchEvent) => {
    const touch = event.changedTouches?.[0] ?? event.touches?.[0];
    if (!touch) return;
    lastTouchPoint = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      timestamp: Date.now(),
    };
    dispatchTouchHighlightAtPoint(touch.clientX, touch.clientY);
    scheduleTouchFollowUps(touch.clientX, touch.clientY);
  };

  globalScrollListener = () => {
    scheduleScrollStopHighlight();
  };

  document.addEventListener('touchstart', globalTouchStartListener, {
    capture: true,
    passive: true,
  });
  document.addEventListener('touchend', globalTouchEndListener, {
    capture: true,
    passive: true,
  });
  window.addEventListener('scroll', globalScrollListener, {passive: true});
}

function uninstallGlobalTouchStartListener() {
  if (typeof document === 'undefined') return;

  if (globalTouchStartListener) {
    document.removeEventListener('touchstart', globalTouchStartListener, true);
  }
  if (globalTouchEndListener) {
    document.removeEventListener('touchend', globalTouchEndListener, true);
  }
  if (typeof window !== 'undefined' && globalScrollListener) {
    window.removeEventListener('scroll', globalScrollListener);
  }

  globalTouchStartListener = null;
  globalTouchEndListener = null;
  globalScrollListener = null;
  clearScrollStopTimeout();
  clearTouchFollowUps();
}

export function useTouchCardHighlight(
  cardId: string,
  durationMs = 420,
): {
  isTouchHighlighted: boolean;
  touchHighlightHandlers: TouchCardHighlightHandlers;
} {
  const [isTouchHighlighted, setIsTouchHighlighted] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerTouchHighlight = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Immediate visual feedback for touch, even on very quick swipe gestures.
    setIsTouchHighlighted(true);

    timeoutRef.current = setTimeout(() => {
      setIsTouchHighlighted(false);
      timeoutRef.current = null;
    }, durationMs);
  }, [durationMs]);

  useEffect(() => {
    if (typeof window === 'undefined' || !cardId) return;

    const handleGlobalTouchHighlightEvent = (event: Event) => {
      const customEvent =
        event as CustomEvent<TouchCardHighlightEventDetail>;
      if (customEvent.detail?.cardId !== cardId) return;
      triggerTouchHighlight();
    };

    window.addEventListener(
      TOUCH_CARD_HIGHLIGHT_EVENT,
      handleGlobalTouchHighlightEvent as EventListener,
    );
    return () => {
      window.removeEventListener(
        TOUCH_CARD_HIGHLIGHT_EVENT,
        handleGlobalTouchHighlightEvent as EventListener,
      );
    };
  }, [cardId, triggerTouchHighlight]);

  useEffect(() => {
    globalTouchListenerRefCount += 1;
    installGlobalTouchStartListener();

    return () => {
      globalTouchListenerRefCount = Math.max(globalTouchListenerRefCount - 1, 0);
      if (globalTouchListenerRefCount === 0) {
        uninstallGlobalTouchStartListener();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const touchHighlightHandlers: TouchCardHighlightHandlers = {
    onPointerDownCapture: (event) => {
      if (event.pointerType === 'mouse') return;
      if (!cardId) return;
      dispatchTouchCardHighlight(cardId);
      triggerTouchHighlight();
    },
    onTouchStartCapture: () => {
      if (!cardId) return;
      dispatchTouchCardHighlight(cardId);
      triggerTouchHighlight();
    },
  };

  return {isTouchHighlighted, touchHighlightHandlers};
}
