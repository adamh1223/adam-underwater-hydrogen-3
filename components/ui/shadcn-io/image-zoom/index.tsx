import * as React from 'react';
import Zoom, {
  type ControlledProps,
  type UncontrolledProps,
} from 'react-medium-image-zoom';
import {cn} from '~/lib/utils';
import {XIcon} from 'lucide-react';

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
  ...props
}: ImageZoomProps) => {
  const [zoomMargin, setZoomMargin] = React.useState(0);

  React.useEffect(() => {
    const update = () => setZoomMargin(getZoomMarginPx());
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div
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
        ZoomContent={({img, onUnzoom}) => (
          <>
            {img}
            <button
              type="button"
              onClick={onUnzoom}
              className="absolute right-6 top-6 z-10 inline-flex h-10 w-10 items-center justify-center text-white hover:bg-accent border rounded-md cursor-pointer"
              aria-label="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </>
        )}
        classDialog={cn(
          '[&::backdrop]:hidden',
          // ✅ full viewport dialog => positioning is consistent regardless of scroll
          '[&[open]]:fixed [&[open]]:inset-0 [&[open]]:m-0 [&[open]]:h-dvh [&[open]]:max-h-none [&[open]]:w-dvw [&[open]]:max-w-none [&[open]]:overflow-hidden [&[open]]:border-0 [&[open]]:bg-transparent [&[open]]:p-0',
          '[&_[data-rmiz-modal-overlay]]:absolute [&_[data-rmiz-modal-overlay]]:inset-0 [&_[data-rmiz-modal-overlay]]:transition-all',
          '[&_[data-rmiz-modal-overlay="hidden"]]:bg-transparent',
          '[&_[data-rmiz-modal-overlay="visible"]]:bg-background/80 [&_[data-rmiz-modal-overlay="visible"]]:backdrop-blur-md',
          '[&_[data-rmiz-modal-content]]:relative [&_[data-rmiz-modal-content]]:size-full',

          // ✅ keep library’s transform math; just restore rounding on the zoomed image
          '[&_[data-rmiz-modal-img]]:absolute [&_[data-rmiz-modal-img]]:origin-top-left [&_[data-rmiz-modal-img]]:cursor-zoom-out [&_[data-rmiz-modal-img]]:transition-transform [&_[data-rmiz-modal-img]]:rounded-xl',

          'motion-reduce:[&_[data-rmiz-modal-img]]:transition-none motion-reduce:[&_[data-rmiz-modal-overlay]]:transition-none',
          backdropClassName,
        )}
        {...(props as any)}
      />
    </div>
  );
};
