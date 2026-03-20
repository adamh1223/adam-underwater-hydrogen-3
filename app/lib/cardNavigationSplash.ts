const CARD_NAV_SPLASH_CLASS = 'product-card-nav-splash-running';
const CARD_NAV_SPLASH_DURATION_MS = 900;
const CARD_NAV_SPLASH_NAVIGATION_DELAY_MS = 90;

export function runCardNavigationSplash(
  card: HTMLElement | null | undefined,
) {
  if (typeof window === 'undefined' || !card) return;

  card.classList.remove(CARD_NAV_SPLASH_CLASS);
  // Force reflow so rapid re-clicks can restart the splash animation.
  void card.offsetWidth;
  card.classList.add(CARD_NAV_SPLASH_CLASS);

  window.setTimeout(() => {
    card.classList.remove(CARD_NAV_SPLASH_CLASS);
  }, CARD_NAV_SPLASH_DURATION_MS);
}

export function navigateWithCardSplash({
  card,
  navigate,
  delayMs = CARD_NAV_SPLASH_NAVIGATION_DELAY_MS,
}: {
  card: HTMLElement | null | undefined;
  navigate: () => void;
  delayMs?: number;
}) {
  if (typeof window === 'undefined') {
    navigate();
    return;
  }

  runCardNavigationSplash(card);
  window.setTimeout(navigate, delayMs);
}
