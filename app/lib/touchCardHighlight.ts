import {useEffect, useState} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';

const TOUCH_CARD_HIGHLIGHT_EVENT = 'touch-card-highlight:set';

type TouchCardHighlightHandlers = {
  onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => void;
  onTouchStartCapture: () => void;
};

type TouchCardHighlightEventDetail = {
  cardId: string | null;
};

let globalListenerRefCount = 0;
let globalTouchStartListener: ((event: TouchEvent) => void) | null = null;
let globalTouchMoveListener: ((event: TouchEvent) => void) | null = null;
let globalTouchEndListener: ((event: TouchEvent) => void) | null = null;
let globalTouchCancelListener: ((event: TouchEvent) => void) | null = null;

let activeTouchIdentifier: number | null = null;
let activeHighlightedCardId: string | null = null;

function dispatchTouchCardHighlight(cardId: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<TouchCardHighlightEventDetail>(TOUCH_CARD_HIGHLIGHT_EVENT, {
      detail: {cardId},
    }),
  );
}

function setHighlightedCard(cardId: string | null) {
  if (activeHighlightedCardId === cardId) return;
  activeHighlightedCardId = cardId;
  dispatchTouchCardHighlight(cardId);
}

function getCardIdFromPoint(clientX: number, clientY: number): string | null {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  const clampedX = Math.max(0, Math.min(clientX, window.innerWidth - 1));
  const clampedY = Math.max(0, Math.min(clientY, window.innerHeight - 1));

  const elementsAtPoint = document.elementsFromPoint(clampedX, clampedY);
  for (const elementAtPoint of elementsAtPoint) {
    if (!(elementAtPoint instanceof Element)) continue;
    const card = elementAtPoint.closest<HTMLElement>(
      '[data-touch-highlight-card-id]',
    );
    if (card?.dataset.touchHighlightCardId) {
      return card.dataset.touchHighlightCardId;
    }
  }

  return null;
}

function getTouchByIdentifier(
  touchList: TouchList,
  identifier: number,
): Touch | null {
  for (let index = 0; index < touchList.length; index += 1) {
    const touch = touchList.item(index);
    if (touch?.identifier === identifier) {
      return touch;
    }
  }
  return null;
}

function clearActiveTouch() {
  activeTouchIdentifier = null;
}

function installGlobalListeners() {
  if (typeof document === 'undefined' || globalTouchStartListener) return;

  globalTouchStartListener = (event: TouchEvent) => {
    const touch = event.changedTouches?.[0] ?? event.touches?.[0];
    if (!touch) return;

    // Always anchor to the most recent finger-down target.
    activeTouchIdentifier = touch.identifier;
    const touchedCardId = getCardIdFromPoint(touch.clientX, touch.clientY);
    setHighlightedCard(touchedCardId);
  };

  globalTouchMoveListener = (event: TouchEvent) => {
    if (activeTouchIdentifier === null) return;

    const touch =
      getTouchByIdentifier(event.touches, activeTouchIdentifier) ??
      getTouchByIdentifier(event.changedTouches, activeTouchIdentifier);
    if (!touch) return;

    const touchedCardId = getCardIdFromPoint(touch.clientX, touch.clientY);
    setHighlightedCard(touchedCardId);
  };

  globalTouchEndListener = (event: TouchEvent) => {
    if (activeTouchIdentifier === null) return;

    const endedTouch = getTouchByIdentifier(
      event.changedTouches,
      activeTouchIdentifier,
    );
    if (!endedTouch) return;

    clearActiveTouch();
    setHighlightedCard(null);
  };

  globalTouchCancelListener = (event: TouchEvent) => {
    if (activeTouchIdentifier === null) return;

    const cancelledTouch = getTouchByIdentifier(
      event.changedTouches,
      activeTouchIdentifier,
    );
    if (!cancelledTouch) return;

    clearActiveTouch();
    setHighlightedCard(null);
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
}

function uninstallGlobalListeners() {
  if (typeof document === 'undefined') return;

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
    document.removeEventListener('touchcancel', globalTouchCancelListener, true);
  }

  globalTouchStartListener = null;
  globalTouchMoveListener = null;
  globalTouchEndListener = null;
  globalTouchCancelListener = null;

  clearActiveTouch();
  setHighlightedCard(null);
}

export function useTouchCardHighlight(
  cardId: string,
  _durationMs = 420,
): {
  isTouchHighlighted: boolean;
  touchHighlightHandlers: TouchCardHighlightHandlers;
} {
  const [isTouchHighlighted, setIsTouchHighlighted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !cardId) return;

    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<TouchCardHighlightEventDetail>;
      setIsTouchHighlighted(customEvent.detail?.cardId === cardId);
    };

    window.addEventListener(
      TOUCH_CARD_HIGHLIGHT_EVENT,
      handler as EventListener,
    );
    return () => {
      window.removeEventListener(
        TOUCH_CARD_HIGHLIGHT_EVENT,
        handler as EventListener,
      );
    };
  }, [cardId]);

  useEffect(() => {
    globalListenerRefCount += 1;
    installGlobalListeners();

    return () => {
      globalListenerRefCount = Math.max(globalListenerRefCount - 1, 0);
      if (globalListenerRefCount === 0) {
        uninstallGlobalListeners();
      }
    };
  }, []);

  // Kept for compatibility with existing spread props.
  const touchHighlightHandlers: TouchCardHighlightHandlers = {
    onPointerDownCapture: (_event) => {},
    onTouchStartCapture: () => {},
  };

  return {isTouchHighlighted, touchHighlightHandlers};
}
