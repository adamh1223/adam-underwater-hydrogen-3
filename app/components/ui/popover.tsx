import * as React from 'react';
import {createPortal} from 'react-dom';
import * as PopoverPrimitive from '@radix-ui/react-popover';

import {cn} from '~/lib/utils';

function Popover({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  collisionPadding = 12,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 max-w-[calc(100vw-1.5rem)] origin-(--radix-popover-content-transform-origin) rounded-md border p-2 shadow-md outline-hidden',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

/**
 * A simple dropdown that ALWAYS renders below its parent container.
 * Completely bypasses Radix Popover / Floating UI positioning to guarantee
 * the content appears below the trigger on ALL devices including mobile.
 *
 * Uses a React portal to render at the document body level, avoiding any
 * ancestor overflow:hidden clipping. Position is calculated with
 * getBoundingClientRect() and applied as position:fixed so it always
 * appears directly below the parent container.
 *
 * Usage: Place inside a container (the dropdown measures its parentElement).
 * Includes a transparent backdrop for outside-click dismissal, Escape key
 * handling, and auto-repositioning on scroll/resize.
 */
function FilterDropdown({
  open,
  onOpenChange,
  className,
  children,
  sideOffset = 8,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
  sideOffset?: number;
}) {
  const markerRef = React.useRef<HTMLSpanElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  // Escape key dismissal
  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  // While the dropdown is open, mark every other direct child of <body> as
  // `inert` so that touch/pointer events cannot reach elements behind the
  // popover (prevents cards from highlighting when tapping filter options on
  // mobile). The portal wrapper is tagged with data-filter-dropdown-portal
  // so it is excluded.
  React.useEffect(() => {
    if (!open) return;

    // Clear any existing focus/active/touch-highlight state so
    // already-highlighted cards lose their highlight immediately.
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.dispatchEvent(new CustomEvent('touch-card-highlight:clear'));

    const inerted: Element[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!child.hasAttribute('data-filter-dropdown-portal')) {
        child.setAttribute('inert', '');
        inerted.push(child);
      }
    }
    return () => {
      for (const el of inerted) {
        el.removeAttribute('inert');
      }
    };
  }, [open]);

  // Compute absolute (document-relative) position from the parent's rect.
  // Uses position:absolute instead of fixed so the dropdown is part of the
  // normal document layer and renders behind the iOS Safari transparent URL
  // bar just like regular page content.
  React.useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const anchor = markerRef.current?.parentElement;
    if (!anchor) return;

    const EDGE_PADDING = 12; // px gap from viewport edges

    const update = () => {
      const rect = anchor.getBoundingClientRect();
      const vw = window.innerWidth;

      // Clamp left in viewport-space, then convert to document-space
      let left = rect.left;
      const content = contentRef.current;
      if (content) {
        const contentWidth = content.offsetWidth;
        const maxLeft = vw - contentWidth - EDGE_PADDING;
        left = Math.max(EDGE_PADDING, Math.min(left, maxLeft));
      } else {
        left = Math.max(EDGE_PADDING, left);
      }

      // Convert from viewport-relative to document-relative for absolute positioning
      setPos({
        top: rect.bottom + sideOffset + window.scrollY,
        left: left + window.scrollX,
      });
    };

    update();
    requestAnimationFrame(update);

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, sideOffset]);

  // Invisible marker stays in the DOM so we can locate the parent element.
  // It renders even when closed so the ref is always attached.
  const marker = (
    <span
      ref={markerRef}
      style={{position: 'absolute', width: 0, height: 0, overflow: 'hidden'}}
      aria-hidden="true"
    />
  );

  if (!open || typeof document === 'undefined') return marker;

  return (
    <>
      {marker}
      {createPortal(
        <div data-filter-dropdown-portal>
          {/* Transparent full-screen backdrop for click-outside dismissal.
              z-index is below the sticky header (z-300) so it doesn't cover
              the navbar — page content is already inert while open. */}
          <div
            className="fixed inset-0 z-[299]"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          {/* Dropdown content — uses position:absolute so it's part of the
              document layer and renders behind the mobile URL bar like
              regular page content (position:fixed gets clipped).
              z-index below header (z-300) so it scrolls behind the navbar. */}
          <div
            ref={contentRef}
            className={cn(
              'absolute z-[299] bg-popover text-popover-foreground max-w-[calc(100vw-1.5rem)] rounded-md border shadow-md outline-hidden max-h-[calc(100dvh-8rem)] overflow-y-auto overflow-x-hidden',
              'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 origin-top',
              className,
            )}
            style={
              pos
                ? {top: pos.top, left: pos.left}
                : {visibility: 'hidden' as const}
            }
          >
            {children}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/* Keep PopoverContentForceBottom as a fallback export */
function PopoverContentForceBottom({
  className,
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  sideOffset?: number;
}) {
  return (
    <PopoverPrimitive.Content
      data-slot="popover-content-force-bottom"
      side="bottom"
      align="start"
      sideOffset={sideOffset}
      avoidCollisions={false}
      className={cn(
        'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 z-50 max-w-[calc(100vw-1.5rem)] origin-top rounded-md border p-2 shadow-md outline-hidden',
        className,
      )}
      {...props}
    />
  );
}

function PopoverAnchor({
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Anchor>) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverContentForceBottom,
  PopoverAnchor,
  FilterDropdown,
};
