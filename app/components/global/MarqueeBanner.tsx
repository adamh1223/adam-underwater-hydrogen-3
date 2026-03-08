import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
} from 'react';
import {cn} from '~/lib/utils';

type MarqueeBannerProps = {
  items: string[];
  className?: string;
};

const START_DELAY_MS = 1000;
const AUTO_SCROLL_SPEED_PX_PER_SECOND = 36;

function normalizeOffset(offset: number, copyWidth: number) {
  if (!copyWidth) return offset;

  let nextOffset = offset;
  while (nextOffset <= -copyWidth) nextOffset += copyWidth;
  while (nextOffset >= copyWidth) nextOffset -= copyWidth;
  return nextOffset;
}

export default function MarqueeBanner({items, className}: MarqueeBannerProps) {
  const viewportRef = useRef<HTMLElement | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const firstCopyRef = useRef<HTMLDivElement | null>(null);

  const copyWidthRef = useRef(0);
  const offsetRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number | null>(null);
  const hasInitializedPositionRef = useRef(false);
  const hasStartedMotionRef = useRef(false);
  const motionStartAtRef = useRef(0);

  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartOffsetRef = useRef(0);

  const [isDragging, setIsDragging] = useState(false);

  const applyOffsetToTrack = useCallback(() => {
    if (trackRef.current) {
      trackRef.current.style.transform = `translate3d(${offsetRef.current}px, 0, 0)`;
    }
  }, []);

  const measureLayout = useCallback(() => {
    const viewportWidth =
      viewportRef.current?.getBoundingClientRect().width ?? 0;
    const copyWidth = firstCopyRef.current?.getBoundingClientRect().width ?? 0;

    if (!viewportWidth || !copyWidth) return;

    copyWidthRef.current = copyWidth;

    if (!hasInitializedPositionRef.current) {
      offsetRef.current = viewportWidth;
      hasInitializedPositionRef.current = true;
    } else if (hasStartedMotionRef.current) {
      offsetRef.current = normalizeOffset(
        offsetRef.current,
        copyWidthRef.current,
      );
    }

    applyOffsetToTrack();
  }, [applyOffsetToTrack]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    motionStartAtRef.current = window.performance.now() + START_DELAY_MS;
    measureLayout();

    const tick = (now: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = now;
      }
      const deltaSeconds = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;

      if (!isDraggingRef.current) {
        if (!hasStartedMotionRef.current && now >= motionStartAtRef.current) {
          hasStartedMotionRef.current = true;
        }

        if (hasStartedMotionRef.current) {
          offsetRef.current -= AUTO_SCROLL_SPEED_PX_PER_SECOND * deltaSeconds;
          offsetRef.current = normalizeOffset(
            offsetRef.current,
            copyWidthRef.current,
          );
          applyOffsetToTrack();
        }
      }

      rafRef.current = window.requestAnimationFrame(tick);
    };

    rafRef.current = window.requestAnimationFrame(tick);
    window.addEventListener('resize', measureLayout);

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
      }
      window.removeEventListener('resize', measureLayout);
    };
  }, [applyOffsetToTrack, measureLayout]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    isDraggingRef.current = true;
    setIsDragging(true);
    hasStartedMotionRef.current = true;

    dragStartXRef.current = event.clientX;
    dragStartOffsetRef.current = offsetRef.current;

    event.preventDefault();
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!isDraggingRef.current) return;

    const deltaX = event.clientX - dragStartXRef.current;
    offsetRef.current = normalizeOffset(
      dragStartOffsetRef.current + deltaX,
      copyWidthRef.current,
    );
    applyOffsetToTrack();
  };

  const handlePointerUpOrCancel = (event: PointerEvent<HTMLElement>) => {
    if (!isDraggingRef.current) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    isDraggingRef.current = false;
    setIsDragging(false);
    lastFrameTimeRef.current = null;
  };

  return (
    <section
      ref={viewportRef}
      className={cn(
        'relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-b border-border bg-background/95 py-2 select-none',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
        className,
      )}
      style={{touchAction: 'pan-y'}}
      aria-label="Promotional offers"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUpOrCancel}
      onPointerCancel={handlePointerUpOrCancel}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        handlePointerUpOrCancel(event);
      }}
    >
      <div
        ref={trackRef}
        className="flex w-max items-center whitespace-nowrap will-change-transform"
      >
        {[0, 1].map((copyIndex) => (
          <div
            key={`promo-marquee-copy-${copyIndex}`}
            ref={copyIndex === 0 ? firstCopyRef : null}
            className="flex shrink-0 items-center gap-16 pr-16 md:gap-32 md:pr-32"
          >
            {items.map((item) => (
              <p
                key={`promo-marquee-item-${copyIndex}-${item}`}
                className="inline-flex shrink-0 items-center text-sm font-medium text-white"
              >
                <span aria-hidden="true">•</span>
                <span className="ml-[4px]">{item}</span>
              </p>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
