import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {ChevronLeftIcon, ChevronRightIcon, XIcon} from 'lucide-react';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
} from '~/components/ui/carousel';
import {Button} from '~/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogOverlay,
  DialogPortal,
} from '~/components/ui/dialog';
import {Progress} from '~/components/ui/progress';
import {cn} from '~/lib/utils';

type CarouselZoomItem = {
  url: string;
  type: string;
};

export type CarouselZoomProps = {
  items: CarouselZoomItem[];
  children: (
    openAtIndex: (index: number, options?: {autoplay?: boolean}) => void,
  ) => React.ReactNode;
};

export const CarouselZoom = ({items, children}: CarouselZoomProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [zoomIndex, setZoomIndex] = React.useState(0);
  const [autoPlayIndex, setAutoPlayIndex] = React.useState<number | null>(null);
  const [zoomCarouselApi, setZoomCarouselApi] =
    React.useState<CarouselApi | null>(null);
  const [zoomCurrentIndex, setZoomCurrentIndex] = React.useState(0);
  const [zoomTotalItems, setZoomTotalItems] = React.useState(0);
  const [loadedImageUrls, setLoadedImageUrls] = React.useState<Set<string>>(
    () => new Set(),
  );
  const preloadingImageUrlsRef = React.useRef<Set<string>>(new Set());
  const scrollZoomToIndex = React.useCallback(
    (index: number) => zoomCarouselApi?.scrollTo(index),
    [zoomCarouselApi],
  );

  const imageUrls = React.useMemo(
    () =>
      Array.from(
        new Set(
          items
            .filter((item) => item.type === 'image')
            .map((item) => item.url)
            .filter((url): url is string => Boolean(url)),
        ),
      ),
    [items],
  );

  const markImageLoaded = React.useCallback((url: string) => {
    setLoadedImageUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  const dialogLoadProgress = React.useMemo(() => {
    if (!imageUrls.length) return 100;
    const loadedCount = imageUrls.filter((url) => loadedImageUrls.has(url))
      .length;
    return Math.round((loadedCount / imageUrls.length) * 100);
  }, [imageUrls, loadedImageUrls]);

  React.useEffect(() => {
    if (!isOpen || !imageUrls.length) return;

    imageUrls.forEach((url) => {
      if (loadedImageUrls.has(url) || preloadingImageUrlsRef.current.has(url)) {
        return;
      }

      preloadingImageUrlsRef.current.add(url);
      const image = new window.Image();

      const finalize = () => {
        preloadingImageUrlsRef.current.delete(url);
        markImageLoaded(url);
      };

      image.onload = finalize;
      image.onerror = finalize;
      image.src = url;

      if (image.complete) {
        finalize();
      }
    });
  }, [isOpen, imageUrls, loadedImageUrls, markImageLoaded]);

  const activeItem =
    items[zoomCurrentIndex] ?? items[Math.min(zoomIndex, Math.max(items.length - 1, 0))];
  const isActiveImageLoading =
    isOpen &&
    activeItem?.type === 'image' &&
    !loadedImageUrls.has(activeItem.url);

  React.useEffect(() => {
    if (!zoomCarouselApi) return;

    const updateZoomState = () => {
      setZoomCurrentIndex(zoomCarouselApi.selectedScrollSnap());
      setZoomTotalItems(zoomCarouselApi.scrollSnapList().length);
    };

    updateZoomState();
    zoomCarouselApi.on('select', updateZoomState);

    return () => void zoomCarouselApi.off('select', updateZoomState);
  }, [zoomCarouselApi]);

  React.useEffect(() => {
    if (!zoomCarouselApi || !isOpen) return;
    zoomCarouselApi.scrollTo(zoomIndex, true);
  }, [zoomCarouselApi, isOpen, zoomIndex]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (!zoomCarouselApi || zoomTotalItems <= 1) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        scrollZoomToIndex(zoomCurrentIndex - 1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        scrollZoomToIndex(zoomCurrentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    scrollZoomToIndex,
    zoomCarouselApi,
    zoomCurrentIndex,
    zoomTotalItems,
  ]);

  const openAtIndex = (index: number, options?: {autoplay?: boolean}) => {
    setZoomIndex(index);
    setZoomCurrentIndex(index);
    setAutoPlayIndex(options?.autoplay ? index : null);
    setIsOpen(true);
  };

  const suppressPostCloseInteraction = React.useCallback(() => {
    if (typeof window === 'undefined') return;

    const eventTypes: Array<keyof WindowEventMap> = [
      'click',
      'mouseup',
      'pointerup',
      'touchend',
    ];

    const swallow = (event: Event) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
      if ('stopImmediatePropagation' in event) {
        (event as Event & {stopImmediatePropagation?: () => void})
          .stopImmediatePropagation?.();
      }
    };

    eventTypes.forEach((type) => {
      window.addEventListener(type, swallow, true);
    });

    window.setTimeout(() => {
      eventTypes.forEach((type) => {
        window.removeEventListener(type, swallow, true);
      });
    }, 500);
  }, []);

  const closeZoomDialog = React.useCallback(() => {
    setIsOpen(false);
    setAutoPlayIndex(null);
  }, []);

  const handleCloseButtonPointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    suppressPostCloseInteraction();
    window.setTimeout(() => {
      closeZoomDialog();
    }, 0);
  };

  const handleCloseButtonClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    // Keyboard activation fallback (Enter/Space). Pointer path is handled onPointerDown.
    event.preventDefault();
    event.stopPropagation();
    suppressPostCloseInteraction();
    window.setTimeout(() => {
      closeZoomDialog();
    }, 0);
  };

  return (
    <>
      {children(openAtIndex)}
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            setAutoPlayIndex(null);
          }
        }}
      >
        <DialogPortal>
          <DialogOverlay className="transition-all data-[state=closed]:bg-transparent data-[state=closed]:backdrop-blur-0 data-[state=open]:bg-background/80 data-[state=open]:backdrop-blur-md motion-reduce:transition-none" />
          <DialogPrimitive.Content
            className={cn(
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-0 z-[1001] flex h-dvh w-dvw flex-col bg-transparent p-0 shadow-none duration-200',
            )}
          >
            <div className="flex h-full w-full flex-col gap-3 p-4">
              <div className="flex w-full items-start justify-start">
                <DialogClose
                  onPointerDown={handleCloseButtonPointerDown}
                  onClick={handleCloseButtonClick}
                  className="inline-flex h-10 w-10 items-center justify-center text-white hover:bg-accent border rounded-md cursor-pointer"
                >
                  <XIcon className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <div className="flex w-full max-w-7xl flex-col items-center gap-6">
                  <div className="relative w-full">
                    {isActiveImageLoading && (
                      <div className="absolute inset-0 z-30 flex items-center justify-center px-6">
                        <div className="w-full max-w-md rounded-md border border-border bg-background/80 p-4 backdrop-blur-sm">
                          <p className="mb-2 text-sm text-muted-foreground">
                            Loading image...
                          </p>
                          <Progress value={dialogLoadProgress} />
                        </div>
                      </div>
                    )}
                    <Carousel
                      setApi={setZoomCarouselApi}
                      opts={{startIndex: zoomIndex}}
                      className={cn(
                        'w-full transform-none',
                        isActiveImageLoading && 'opacity-0',
                      )}
                    >
                      <CarouselContent className="ml-0">
                        {items?.map((media, idx) => (
                          <CarouselItem
                            className="flex items-center justify-center pl-0"
                            key={`${media.type}-${media.url}`}
                          >
                            <div className="flex h-full w-full items-center justify-center px-4">
                              {media.type === 'image' && (
                                <img
                                  src={media.url}
                                  alt="Review media"
                                  onLoad={() => markImageLoaded(media.url)}
                                  onError={() => markImageLoaded(media.url)}
                                  className="max-h-[calc(100vh-12rem)] w-auto max-w-[90vw] rounded-lg object-contain"
                                />
                              )}
                              {media.type === 'video' && (
                                <video
                                  className="max-h-[calc(100vh-12rem)] w-auto max-w-[90vw] rounded-lg"
                                  controls
                                  autoPlay={isOpen && autoPlayIndex === idx}
                                  playsInline
                                  preload="metadata"
                                >
                                  <source src={`${media.url}#t=0.001`} />
                                  <track
                                    kind="captions"
                                    srcLang="en"
                                    label="English captions"
                                    src="data:text/vtt,WEBVTT"
                                  />
                                </video>
                              )}
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                    </Carousel>
                  </div>
                </div>
              </div>
              {zoomTotalItems > 1 && (
                <div className="flex flex-col items-center gap-3 pb-6">
                  <div className="flex w-full items-center justify-center gap-4 ">
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        scrollZoomToIndex(zoomCurrentIndex - 1);
                      }}
                      className="rounded-full w-10 h-10 p-0 shadow-none bg-black/60 hover:bg-accent rounded-md cursor-pointer border"
                      variant="secondary"
                    >
                      <ChevronLeftIcon className="h-6 w-6 text-white" />
                    </Button>
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        scrollZoomToIndex(zoomCurrentIndex + 1);
                      }}
                      className="rounded-full w-10 h-10 p-0 shadow-none bg-black/60 hover:bg-accent rounded-md cursor-pointer border"
                      variant="secondary"
                    >
                      <ChevronRightIcon className="h-6 w-6 text-white" />
                    </Button>
                  </div>
                  <div className="z-20 flex w-full items-center justify-center gap-3">
                    {items.map((item, idx) => (
                      <button
                        key={`zoom-dot-${item.type}-${item.url}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          scrollZoomToIndex(idx);
                        }}
                        className={`h-2 w-2 rounded-full border border-white/60 ${idx === zoomCurrentIndex ? 'bg-white' : 'bg-white/30'}`}
                        aria-label={`Go to slide ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </>
  );
};
