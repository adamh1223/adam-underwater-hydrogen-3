import {useCallback, useEffect, useState} from 'react';
import type {
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from 'react';

const TOUCH_CARD_HIGHLIGHT_EVENT = 'touch-card-highlight:activate';

type TouchCardHighlightHandlers = {
  onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => void;
  onTouchStartCapture: (event: ReactTouchEvent<HTMLElement>) => void;
};

type TouchCardHighlightEventDetail = {
  cardId: string;
};

type TouchPoint = {
  clientX: number;
  clientY: number;
  timestamp: number;
};

let globalTouchListenerRefCount = 0;

let globalTouchStartListener: ((event: TouchEvent) => void) | null = null;
let globalTouchMoveListener: ((event: TouchEvent) => void) | null = null;
let globalTouchEndListener: ((event: TouchEvent) => void) | null = null;
let globalTouchCancelListener: ((event: TouchEvent) => void) | null = null;

let globalPointerDownListener: ((event: PointerEvent) => void) | null = null;
let globalPointerMoveListener: ((event: PointerEvent) => void) | null = null;
let globalPointerUpListener: ((event: PointerEvent) => void) | null = null;
let globalPointerCancelListener: ((event: PointerEvent) => void) | null = null;

let globalWindowScrollListener: (() => void) | null = null;
let globalDocumentScrollListener: ((event: Event) => void) | null = null;

let touchFollowUpRafId = 0;
let touchMoveRafId = 0;
let pendingTouchMovePoint: TouchPoint | null = null;

let touchFollowUpTimeoutIds: number[] = [];
let scrollStopTimeoutId: number | null = null;

let lastTouchPoint: TouchPoint | null = null;
let isScrollActive = false;
let activeTouchIdentifier: number | null = null;
let activePointerIdentifier: number | null = null;

function dispatchTouchCardHighlight(cardId: string) {
  if (typeof window === 'undefined') return;

  window.dispatchEvent(
    new CustomEvent<TouchCardHighlightEventDetail>(TOUCH_CARD_HIGHLIGHT_EVENT, {
      detail: {cardId},
    }),
  );
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

function clearTouchMoveRaf() {
  if (typeof window === 'undefined') return;

  if (touchMoveRafId) {
    cancelAnimationFrame(touchMoveRafId);
    touchMoveRafId = 0;
  }

  pendingTouchMovePoint = null;
}

function clearScrollStopTimeout() {
  if (typeof window === 'undefined') return;
  if (scrollStopTimeoutId === null) return;

  window.clearTimeout(scrollStopTimeoutId);
  scrollStopTimeoutId = null;
}

function setLastTouchPoint(clientX: number, clientY: number) {
  lastTouchPoint = {
    clientX,
    clientY,
    timestamp: Date.now(),
  };
}

function isAnyAsideOverlayExpanded(): boolean {
  if (typeof document === 'undefined') return false;
  return Boolean(document.querySelector('.overlay.expanded'));
}

function isInsideBundleCarousel(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-bundle-carousel]'));
}

function resolveCardIdAtPoint(
  clientX: number,
  clientY: number,
): string | undefined {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return undefined;
  }

  const clampedX = Math.max(0, Math.min(clientX, window.innerWidth - 1));
  const clampedY = Math.max(0, Math.min(clientY, window.innerHeight - 1));

  const elementsAtPoint = document.elementsFromPoint(clampedX, clampedY);
  for (const elementAtPoint of elementsAtPoint) {
    if (!(elementAtPoint instanceof Element)) continue;

    const highlightedCard = elementAtPoint.closest<HTMLElement>(
      '[data-touch-highlight-card-id]',
    );

    const cardId = highlightedCard?.dataset.touchHighlightCardId;
    if (cardId) return cardId;
  }

  const fallbackTarget = document.elementFromPoint(clampedX, clampedY);
  if (fallbackTarget instanceof Element) {
    const fallbackCard = fallbackTarget.closest<HTMLElement>(
      '[data-touch-highlight-card-id]',
    );

    const fallbackCardId = fallbackCard?.dataset.touchHighlightCardId;
    if (fallbackCardId) return fallbackCardId;
  }

  return undefined;
}

function dispatchTouchHighlightAtPoint(
  clientX: number,
  clientY: number,
): string | undefined {
  if (isAnyAsideOverlayExpanded()) return undefined;

  const cardId = resolveCardIdAtPoint(clientX, clientY);
  if (!cardId) return undefined;

  dispatchTouchCardHighlight(cardId);
  return cardId;
}

function scheduleTouchMoveHighlight(clientX: number, clientY: number) {
  if (typeof window === 'undefined') return;

  pendingTouchMovePoint = {
    clientX,
    clientY,
    timestamp: Date.now(),
  };

  if (touchMoveRafId) return;

  touchMoveRafId = requestAnimationFrame(() => {
    const point = pendingTouchMovePoint;
    touchMoveRafId = 0;
    pendingTouchMovePoint = null;

    if (!point) return;
    dispatchTouchHighlightAtPoint(point.clientX, point.clientY);
  });
}

function scheduleTouchFollowUps(clientX: number, clientY: number) {
  if (typeof window === 'undefined') return;

  clearTouchFollowUps();

  // Momentum stop/continuation touches can settle a little later.
  touchFollowUpRafId = requestAnimationFrame(() => {
    dispatchTouchHighlightAtPoint(clientX, clientY);
    touchFollowUpRafId = 0;
  });

  [40, 90, 160, 240].forEach((delayMs) => {
    const timeoutId = window.setTimeout(() => {
      dispatchTouchHighlightAtPoint(clientX, clientY);
    }, delayMs);

    touchFollowUpTimeoutIds.push(timeoutId);
  });
}

function scheduleScrollStopHighlight() {
  if (typeof window === 'undefined') return;

  isScrollActive = true;
  clearScrollStopTimeout();

  scrollStopTimeoutId = window.setTimeout(() => {
    scrollStopTimeoutId = null;
    isScrollActive = false;
  }, 90);
}

function getTouchByIdentifier(
  touchList: TouchList,
  identifier: number | null,
): Touch | null {
  if (touchList.length === 0) return null;

  if (identifier === null) {
    return touchList[0] ?? null;
  }

  for (let i = 0; i < touchList.length; i += 1) {
    const touch = touchList.item(i);
    if (touch && touch.identifier === identifier) {
      return touch;
    }
  }

  return null;
}

function installGlobalTouchStartListener() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (globalTouchStartListener) return;

  globalTouchStartListener = (event: TouchEvent) => {
    if (isAnyAsideOverlayExpanded()) return;
    if (isInsideBundleCarousel(event.target)) return;

    const touch =
      getTouchByIdentifier(event.changedTouches, activeTouchIdentifier) ??
      event.changedTouches[0] ??
      event.touches[0];

    if (!touch) return;
    if (isScrollActive) return;

    activeTouchIdentifier = touch.identifier;
    setLastTouchPoint(touch.clientX, touch.clientY);

    dispatchTouchHighlightAtPoint(touch.clientX, touch.clientY);
    scheduleTouchFollowUps(touch.clientX, touch.clientY);
  };

  globalTouchMoveListener = (event: TouchEvent) => {
    if (isAnyAsideOverlayExpanded()) return;
    if (isInsideBundleCarousel(event.target)) return;

    const touch =
      getTouchByIdentifier(event.touches, activeTouchIdentifier) ??
      event.touches[0] ??
      getTouchByIdentifier(event.changedTouches, activeTouchIdentifier) ??
      event.changedTouches[0];

    if (!touch) return;
    if (isScrollActive) return;

    setLastTouchPoint(touch.clientX, touch.clientY);
    scheduleTouchMoveHighlight(touch.clientX, touch.clientY);
  };

  globalTouchEndListener = (event: TouchEvent) => {
    if (isAnyAsideOverlayExpanded()) {
      activeTouchIdentifier = null;
      return;
    }
    if (isInsideBundleCarousel(event.target)) return;

    if (isScrollActive) {
      if (event.touches.length === 0) {
        activeTouchIdentifier = null;
      } else {
        const remainingTouch = event.touches[0];
        activeTouchIdentifier = remainingTouch?.identifier ?? null;
      }
      return;
    }

    const endedTouch =
      getTouchByIdentifier(event.changedTouches, activeTouchIdentifier) ??
      event.changedTouches[0] ??
      event.touches[0];

    if (endedTouch) {
      setLastTouchPoint(endedTouch.clientX, endedTouch.clientY);
      dispatchTouchHighlightAtPoint(endedTouch.clientX, endedTouch.clientY);
      scheduleTouchFollowUps(endedTouch.clientX, endedTouch.clientY);
    }

    if (event.touches.length === 0) {
      activeTouchIdentifier = null;
      return;
    }

    const remainingTouch = event.touches[0];
    activeTouchIdentifier = remainingTouch?.identifier ?? null;
  };

  globalTouchCancelListener = (event: TouchEvent) => {
    if (isAnyAsideOverlayExpanded()) {
      activeTouchIdentifier = null;
      return;
    }
    if (isInsideBundleCarousel(event.target)) return;

    if (isScrollActive) {
      if (event.touches.length === 0) {
        activeTouchIdentifier = null;
      }
      return;
    }

    const canceledTouch =
      getTouchByIdentifier(event.changedTouches, activeTouchIdentifier) ??
      event.changedTouches[0] ??
      event.touches[0];

    if (canceledTouch) {
      setLastTouchPoint(canceledTouch.clientX, canceledTouch.clientY);
      dispatchTouchHighlightAtPoint(
        canceledTouch.clientX,
        canceledTouch.clientY,
      );
      scheduleTouchFollowUps(canceledTouch.clientX, canceledTouch.clientY);
    }

    if (event.touches.length === 0) {
      activeTouchIdentifier = null;
    }
  };

  globalPointerDownListener = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    if (isAnyAsideOverlayExpanded()) return;
    if (isInsideBundleCarousel(event.target)) return;
    if (isScrollActive) return;

    activePointerIdentifier = event.pointerId;
    setLastTouchPoint(event.clientX, event.clientY);

    dispatchTouchHighlightAtPoint(event.clientX, event.clientY);
    scheduleTouchFollowUps(event.clientX, event.clientY);
  };

  globalPointerMoveListener = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    if (isAnyAsideOverlayExpanded()) return;
    if (isInsideBundleCarousel(event.target)) return;
    if (isScrollActive) return;
    if (
      activePointerIdentifier !== null &&
      event.pointerId !== activePointerIdentifier
    ) {
      return;
    }

    setLastTouchPoint(event.clientX, event.clientY);
    scheduleTouchMoveHighlight(event.clientX, event.clientY);
  };

  globalPointerUpListener = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    if (isAnyAsideOverlayExpanded()) {
      if (
        activePointerIdentifier !== null &&
        event.pointerId === activePointerIdentifier
      ) {
        activePointerIdentifier = null;
      }
      return;
    }
    if (isInsideBundleCarousel(event.target)) return;
    if (isScrollActive) {
      if (
        activePointerIdentifier !== null &&
        event.pointerId === activePointerIdentifier
      ) {
        activePointerIdentifier = null;
      }
      return;
    }

    setLastTouchPoint(event.clientX, event.clientY);
    dispatchTouchHighlightAtPoint(event.clientX, event.clientY);
    scheduleTouchFollowUps(event.clientX, event.clientY);

    if (
      activePointerIdentifier !== null &&
      event.pointerId === activePointerIdentifier
    ) {
      activePointerIdentifier = null;
    }
  };

  globalPointerCancelListener = (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return;
    if (isAnyAsideOverlayExpanded()) {
      if (
        activePointerIdentifier !== null &&
        event.pointerId === activePointerIdentifier
      ) {
        activePointerIdentifier = null;
      }
      return;
    }
    if (isInsideBundleCarousel(event.target)) return;
    if (isScrollActive) {
      if (
        activePointerIdentifier !== null &&
        event.pointerId === activePointerIdentifier
      ) {
        activePointerIdentifier = null;
      }
      return;
    }

    setLastTouchPoint(event.clientX, event.clientY);
    dispatchTouchHighlightAtPoint(event.clientX, event.clientY);
    scheduleTouchFollowUps(event.clientX, event.clientY);

    if (
      activePointerIdentifier !== null &&
      event.pointerId === activePointerIdentifier
    ) {
      activePointerIdentifier = null;
    }
  };

  globalWindowScrollListener = () => {
    scheduleScrollStopHighlight();
  };

  globalDocumentScrollListener = () => {
    scheduleScrollStopHighlight();
  };

  document.addEventListener('touchstart', globalTouchStartListener, {
    capture: true,
    passive: true,
  });
  document.addEventListener('touchmove', globalTouchMoveListener, {
    capture: true,
    passive: true,
  });
  document.addEventListener('touchend', globalTouchEndListener, {
    capture: true,
    passive: true,
  });
  document.addEventListener('touchcancel', globalTouchCancelListener, {
    capture: true,
    passive: true,
  });

  document.addEventListener('pointerdown', globalPointerDownListener, {
    capture: true,
    passive: true,
  });
  document.addEventListener('pointermove', globalPointerMoveListener, {
    capture: true,
    passive: true,
  });
  document.addEventListener('pointerup', globalPointerUpListener, {
    capture: true,
    passive: true,
  });
  document.addEventListener('pointercancel', globalPointerCancelListener, {
    capture: true,
    passive: true,
  });

  // Capture scroll from both the window and nested overflow scrollers.
  window.addEventListener('scroll', globalWindowScrollListener, {
    passive: true,
  });
  document.addEventListener('scroll', globalDocumentScrollListener, {
    capture: true,
    passive: true,
  });
}

function uninstallGlobalTouchStartListener() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  if (globalTouchStartListener) {
    document.removeEventListener('touchstart', globalTouchStartListener, true);
  }
  if (globalTouchMoveListener) {
    document.removeEventListener('touchmove', globalTouchMoveListener, true);
  }
  if (globalTouchEndListener) {
    document.removeEventListener('touchend', globalTouchEndListener, true);
  }
  if (globalTouchCancelListener) {
    document.removeEventListener(
      'touchcancel',
      globalTouchCancelListener,
      true,
    );
  }

  if (globalPointerDownListener) {
    document.removeEventListener(
      'pointerdown',
      globalPointerDownListener,
      true,
    );
  }
  if (globalPointerMoveListener) {
    document.removeEventListener(
      'pointermove',
      globalPointerMoveListener,
      true,
    );
  }
  if (globalPointerUpListener) {
    document.removeEventListener('pointerup', globalPointerUpListener, true);
  }
  if (globalPointerCancelListener) {
    document.removeEventListener(
      'pointercancel',
      globalPointerCancelListener,
      true,
    );
  }

  if (globalWindowScrollListener) {
    window.removeEventListener('scroll', globalWindowScrollListener);
  }
  if (globalDocumentScrollListener) {
    document.removeEventListener('scroll', globalDocumentScrollListener, true);
  }

  globalTouchStartListener = null;
  globalTouchMoveListener = null;
  globalTouchEndListener = null;
  globalTouchCancelListener = null;

  globalPointerDownListener = null;
  globalPointerMoveListener = null;
  globalPointerUpListener = null;
  globalPointerCancelListener = null;

  globalWindowScrollListener = null;
  globalDocumentScrollListener = null;

  clearScrollStopTimeout();
  clearTouchFollowUps();
  clearTouchMoveRaf();

  lastTouchPoint = null;
  isScrollActive = false;
  activeTouchIdentifier = null;
  activePointerIdentifier = null;
}

export function useTouchCardHighlight(
  cardId: string,
  _durationMs = 420,
): {
  isTouchHighlighted: boolean;
  touchHighlightHandlers: TouchCardHighlightHandlers;
} {
  const [isTouchHighlighted, setIsTouchHighlighted] = useState(false);

  const triggerTouchHighlight = useCallback(() => {
    setIsTouchHighlighted(true);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !cardId) return;

    const handleGlobalTouchHighlightEvent = (event: Event) => {
      const customEvent = event as CustomEvent<TouchCardHighlightEventDetail>;
      const activeCardId = customEvent.detail?.cardId;
      if (!activeCardId) return;

      if (activeCardId === cardId) {
        triggerTouchHighlight();
        return;
      }

      setIsTouchHighlighted(false);
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
      globalTouchListenerRefCount = Math.max(
        globalTouchListenerRefCount - 1,
        0,
      );
      if (globalTouchListenerRefCount === 0) {
        uninstallGlobalTouchStartListener();
      }
    };
  }, []);

  const touchHighlightHandlers: TouchCardHighlightHandlers = {
    onPointerDownCapture: (event) => {
      if (event.pointerType === 'mouse') return;
      if (!cardId) return;
      if (isAnyAsideOverlayExpanded()) return;
      if (isScrollActive) return;
      dispatchTouchCardHighlight(cardId);
      triggerTouchHighlight();
    },
    onTouchStartCapture: (event) => {
      if (!cardId) return;
      if (isAnyAsideOverlayExpanded()) return;
      if (isScrollActive) return;

      const touch = event.touches?.[0] ?? event.changedTouches?.[0];
      if (touch) {
        setLastTouchPoint(touch.clientX, touch.clientY);
      }

      dispatchTouchCardHighlight(cardId);
      triggerTouchHighlight();
    },
  };

  return {isTouchHighlighted, touchHighlightHandlers};
}
