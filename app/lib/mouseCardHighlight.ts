import {useEffect, useState} from 'react';

const MOUSE_CARD_HIGHLIGHT_EVENT = 'mouse-card-highlight:activate';

type MouseCardHighlightEventDetail = {
  cardId: string;
};

export function activateMouseCardHighlight(cardId: string) {
  if (typeof window === 'undefined' || !cardId) return;

  window.dispatchEvent(
    new CustomEvent<MouseCardHighlightEventDetail>(MOUSE_CARD_HIGHLIGHT_EVENT, {
      detail: {cardId},
    }),
  );
}

export function useMouseCardHighlight(cardId: string, enabled = true) {
  const [isMouseHighlighted, setIsMouseHighlighted] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsMouseHighlighted(false);
      return;
    }

    if (typeof window === 'undefined') return;

    const handleMouseHighlight = (event: Event) => {
      const customEvent = event as CustomEvent<MouseCardHighlightEventDetail>;
      const highlightedCardId = customEvent.detail?.cardId;
      setIsMouseHighlighted(highlightedCardId === cardId);
    };

    window.addEventListener(
      MOUSE_CARD_HIGHLIGHT_EVENT,
      handleMouseHighlight as EventListener,
    );

    return () => {
      window.removeEventListener(
        MOUSE_CARD_HIGHLIGHT_EVENT,
        handleMouseHighlight as EventListener,
      );
    };
  }, [cardId, enabled]);

  return {isMouseHighlighted};
}
