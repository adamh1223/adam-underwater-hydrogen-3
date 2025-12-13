'use client';

import * as React from 'react';
import Zoom, {
  type ControlledProps,
  type UncontrolledProps,
} from 'react-medium-image-zoom';
import {cn} from '~/lib/utils';

export type ImageZoomProps = UncontrolledProps & {
  isZoomed?: ControlledProps['isZoomed'];
  onZoomChange?: ControlledProps['onZoomChange'];
  className?: string;
  backdropClassName?: string;
};

function getZoomMarginPx() {
  // 5% margin on each side => image fits within 90vw/90vh.
  // Use the larger of the two margins to guarantee BOTH width and height constraints.
  if (typeof window === 'undefined') return 0;
  const mx = Math.round(window.innerWidth * 0.03);
  const my = Math.round(window.innerHeight * 0.03);
  return Math.max(mx, my);
}

export const ImageZoom = ({
  className,
  backdropClassName,
  isZoomed: isZoomedProp,
  onZoomChange,
  ...props
}: ImageZoomProps) => {
  const [zoomMargin, setZoomMargin] = React.useState(0);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [dragOffset, setDragOffset] = React.useState({x: 0, y: 0});
  const [baseTransform, setBaseTransform] = React.useState({
    translateX: 0,
    translateY: 0,
    scale: 1,
  });
  const [baseRect, setBaseRect] = React.useState<DOMRect | null>(null);
  const [containerRect, setContainerRect] = React.useState<DOMRect | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const dragStartRef = React.useRef({x: 0, y: 0});
  const dragOriginRef = React.useRef({x: 0, y: 0});
  const isControlled = typeof isZoomedProp === 'boolean';
  const [internalZoomed, setInternalZoomed] = React.useState(false);
  const isZoomed = isControlled ? Boolean(isZoomedProp) : internalZoomed;

  React.useEffect(() => {
    const update = () => setZoomMargin(getZoomMarginPx());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const clamp = React.useCallback(
    (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),
    [],
  );

  const parseTransform = (transform?: string | null) => {
    if (!transform) return null;
    const match = transform.match(
      /translate3d\(([-0-9.]+)px,\s*([-0-9.]+)px,\s*[-0-9.]+px\)\s*scale\(([-0-9.]+)\)/,
    );

    if (!match) return null;

    const [, translateX, translateY, scale] = match;

    return {
      translateX: Number.parseFloat(translateX),
      translateY: Number.parseFloat(translateY),
      scale: Number.parseFloat(scale),
    };
  };

  const getModalElements = () => {
    const modalImage = rootRef.current?.querySelector(
      '[data-rmiz-modal-img]',
    ) as HTMLElement | null;
    const modalContent = rootRef.current?.querySelector(
      '[data-rmiz-modal-content]',
    ) as HTMLElement | null;

    return {modalImage, modalContent};
  };

  const handleZoomChange = (next: boolean) => {
    if (!isControlled) {
      setInternalZoomed(next);
    }
    setZoomLevel(1);
    setDragOffset({x: 0, y: 0});
    setIsDragging(false);
    onZoomChange?.(next);
  };

  const handleClose = () => handleZoomChange(false);

  React.useEffect(() => {
    if (!isZoomed) return;

    const frame = requestAnimationFrame(() => {
      const {modalImage, modalContent} = getModalElements();
      if (!modalImage || !modalContent) return;

      const parsedTransform = parseTransform(modalImage.style.transform);
      setBaseTransform(
        parsedTransform ?? {translateX: 0, translateY: 0, scale: 1},
      );
      setBaseRect(modalImage.getBoundingClientRect());
      setContainerRect(modalContent.getBoundingClientRect());
      modalImage.style.cursor = 'grab';
    });

    return () => cancelAnimationFrame(frame);
  }, [isZoomed]);

  const applyTransform = React.useCallback(() => {
    if (!isZoomed) return;

    const {modalImage, modalContent} = getModalElements();
    if (!modalImage) return;

    const initialRect = baseRect ?? modalImage.getBoundingClientRect();
    const contentRect = containerRect ?? modalContent?.getBoundingClientRect();

    const scaledWidth = initialRect.width * zoomLevel;
    const scaledHeight = initialRect.height * zoomLevel;

    const maxOffsetX = contentRect
      ? Math.max(0, (scaledWidth - contentRect.width) / 2)
      : Number.POSITIVE_INFINITY;
    const maxOffsetY = contentRect
      ? Math.max(0, (scaledHeight - contentRect.height) / 2)
      : Number.POSITIVE_INFINITY;

    const clampedOffsets = {
      x: clamp(dragOffset.x, -maxOffsetX, maxOffsetX),
      y: clamp(dragOffset.y, -maxOffsetY, maxOffsetY),
    };

    const translateX = baseTransform.translateX + clampedOffsets.x;
    const translateY = baseTransform.translateY + clampedOffsets.y;
    const scale = baseTransform.scale * zoomLevel;

    modalImage.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    modalImage.style.cursor = zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-out';
  }, [
    baseRect,
    baseTransform.scale,
    baseTransform.translateX,
    baseTransform.translateY,
    clamp,
    containerRect,
    dragOffset.x,
    dragOffset.y,
    isDragging,
    isZoomed,
    zoomLevel,
  ]);

  React.useEffect(() => {
    applyTransform();
  }, [applyTransform]);

  React.useEffect(() => {
    if (!isZoomed) return;

    const {modalImage} = getModalElements();
    if (!modalImage) return;

    let isPointerDown = false;

    const handlePointerDown = (event: PointerEvent) => {
      if (zoomLevel <= 1) return;
      isPointerDown = true;
      setIsDragging(true);
      dragStartRef.current = {x: event.clientX, y: event.clientY};
      dragOriginRef.current = {x: dragOffset.x, y: dragOffset.y};
      modalImage.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown) return;
      const deltaX = event.clientX - dragStartRef.current.x;
      const deltaY = event.clientY - dragStartRef.current.y;
      setDragOffset({
        x: dragOriginRef.current.x + deltaX,
        y: dragOriginRef.current.y + deltaY,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      setIsDragging(false);
      modalImage.releasePointerCapture(event.pointerId);
    };

    modalImage.addEventListener('pointerdown', handlePointerDown);
    modalImage.addEventListener('pointermove', handlePointerMove);
    modalImage.addEventListener('pointerup', handlePointerUp);
    modalImage.addEventListener('pointerleave', handlePointerUp);

    return () => {
      modalImage.removeEventListener('pointerdown', handlePointerDown);
      modalImage.removeEventListener('pointermove', handlePointerMove);
      modalImage.removeEventListener('pointerup', handlePointerUp);
      modalImage.removeEventListener('pointerleave', handlePointerUp);
    };
  }, [dragOffset.x, dragOffset.y, isZoomed, zoomLevel]);

  const increaseZoom = () => setZoomLevel((level) => level + 0.1);

  const decreaseZoom = () =>
    setZoomLevel((level) => {
      const next = Math.max(1, Number((level - 0.1).toFixed(2)));
      return next;
    });

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative',
        '[&_[data-rmiz-ghost]]:pointer-events-none [&_[data-rmiz-ghost]]:absolute',

        // ✅ keep rounding on the inline image
        '[&_[data-rmiz-content="found"]_img]:rounded-xl',

        '[&_[data-rmiz-btn-zoom]]:m-0 [&_[data-rmiz-btn-zoom]]:size-10 [&_[data-rmiz-btn-zoom]]:touch-manipulation [&_[data-rmiz-btn-zoom]]:appearance-none [&_[data-rmiz-btn-zoom]]:rounded-[50%] [&_[data-rmiz-btn-zoom]]:border-none [&_[data-rmiz-btn-zoom]]:bg-foreground/70 [&_[data-rmiz-btn-zoom]]:p-2 [&_[data-rmiz-btn-zoom]]:text-background [&_[data-rmiz-btn-zoom]]:outline-offset-2',
        '[&_[data-rmiz-btn-unzoom]]:m-0 [&_[data-rmiz-btn-unzoom]]:size-10 [&_[data-rmiz-btn-unzoom]]:touch-manipulation [&_[data-rmiz-btn-unzoom]]:appearance-none [&_[data-rmiz-btn-unzoom]]:rounded-[50%] [&_[data-rmiz-btn-unzoom]]:border-none [&_[data-rmiz-btn-unzoom]]:bg-foreground/70 [&_[data-rmiz-btn-unzoom]]:p-2 [&_[data-rmiz-btn-unzoom]]:text-background [&_[data-rmiz-btn-unzoom]]:outline-offset-2',
        '[&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:pointer-events-none [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:absolute [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:size-px [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:overflow-hidden [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:whitespace-nowrap [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:[clip-path:inset(50%)] [&_[data-rmiz-btn-zoom]:not(:focus):not(:active)]:[clip:rect(0_0_0_0)]',
        '[&_[data-rmiz-btn-zoom]]:absolute [&_[data-rmiz-btn-zoom]]:top-2.5 [&_[data-rmiz-btn-zoom]]:right-2.5 [&_[data-rmiz-btn-zoom]]:bottom-auto [&_[data-rmiz-btn-zoom]]:left-auto [&_[data-rmiz-btn-zoom]]:cursor-zoom-in',
        '[&_[data-rmiz-btn-unzoom]]:absolute [&_[data-rmiz-btn-unzoom]]:top-5 [&_[data-rmiz-btn-unzoom]]:right-5 [&_[data-rmiz-btn-unzoom]]:bottom-auto [&_[data-rmiz-btn-unzoom]]:left-auto [&_[data-rmiz-btn-unzoom]]:z-[1] [&_[data-rmiz-btn-unzoom]]:cursor-zoom-out',
        '[&_[data-rmiz-content="found"]_img]:cursor-zoom-in',
        '[&_[data-rmiz-content="found"]_svg]:cursor-zoom-in',
        '[&_[data-rmiz-content="found"]_[role="img"]]:cursor-zoom-in',
        '[&_[data-rmiz-content="found"]_[data-zoom]]:cursor-zoom-in',
        className,
      )}
    >
      <Zoom
        // ✅ This is the key: keeps the zoomed image inset from the viewport edges,
        // which makes it effectively max out at ~90vw/90vh.
        zoomMargin={zoomMargin} // :contentReference[oaicite:1]{index=1}
        classDialog={cn(
          '[&::backdrop]:hidden',
          // ✅ full viewport dialog => positioning is consistent regardless of scroll
          '[&[open]]:fixed [&[open]]:inset-0 [&[open]]:m-0 [&[open]]:h-dvh [&[open]]:max-h-none [&[open]]:w-dvw [&[open]]:max-w-none [&[open]]:overflow-hidden [&[open]]:border-0 [&[open]]:bg-transparent [&[open]]:p-0',
          '[&_[data-rmiz-modal-overlay]]:absolute [&_[data-rmiz-modal-overlay]]:inset-0 [&_[data-rmiz-modal-overlay]]:transition-all',
          '[&_[data-rmiz-modal-overlay="hidden"]]:bg-transparent',
          '[&_[data-rmiz-modal-overlay="visible"]]:bg-background/80 [&_[data-rmiz-modal-overlay="visible"]]:backdrop-blur-md',
        '[&_[data-rmiz-modal-content]]:relative [&_[data-rmiz-modal-content]]:size-full [&_[data-rmiz-modal-content]]:overflow-hidden',

          // ✅ keep library’s transform math; just restore rounding on the zoomed image
          '[&_[data-rmiz-modal-img]]:absolute [&_[data-rmiz-modal-img]]:origin-top-left [&_[data-rmiz-modal-img]]:transition-transform [&_[data-rmiz-modal-img]]:rounded-xl',

          'motion-reduce:[&_[data-rmiz-modal-img]]:transition-none motion-reduce:[&_[data-rmiz-modal-overlay]]:transition-none',
          backdropClassName,
        )}
        isZoomed={isZoomed}
        onZoomChange={handleZoomChange}
        {...(props as any)}
      />

      {isZoomed ? (
        <>
          <button
            aria-label="Close zoomed image"
            type="button"
            className="fixed right-6 top-6 z-[999] flex size-10 items-center justify-center rounded-full bg-foreground/80 text-background shadow-lg transition hover:bg-foreground"
            onClick={handleClose}
          >
            ×
          </button>

          <div className="pointer-events-none fixed inset-0 z-[998] flex items-end justify-center p-6">
            <div className="flex gap-3 rounded-full bg-background/80 p-2 shadow-lg backdrop-blur pointer-events-auto">
              <button
                type="button"
                aria-label="Zoom out"
                onClick={decreaseZoom}
                disabled={zoomLevel <= 1}
                className={cn(
                  'flex size-11 items-center justify-center rounded-full bg-foreground/70 text-background transition',
                  'disabled:cursor-not-allowed disabled:bg-foreground/30',
                  'hover:bg-foreground',
                )}
              >
                −
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                onClick={increaseZoom}
                className="flex size-11 items-center justify-center rounded-full bg-foreground/70 text-background transition hover:bg-foreground"
              >
                +
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
