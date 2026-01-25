'use client';

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
import {cn} from '~/lib/utils';

type CarouselZoomItem = {
  url: string;
  type: string;
};

export type CarouselZoomProps = {
  items: CarouselZoomItem[];
  children: (openAtIndex: (index: number) => void) => React.ReactNode;
};

export const CarouselZoom = ({items, children}: CarouselZoomProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [zoomIndex, setZoomIndex] = React.useState(0);
  const [zoomCarouselApi, setZoomCarouselApi] = React.useState<CarouselApi | null>(
    null,
  );
  const [zoomCurrentIndex, setZoomCurrentIndex] = React.useState(0);
  const [zoomTotalItems, setZoomTotalItems] = React.useState(0);
  const scrollZoomToIndex = (index: number) => zoomCarouselApi?.scrollTo(index);

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
  }, [isOpen, scrollZoomToIndex, zoomCarouselApi, zoomCurrentIndex, zoomTotalItems]);

  const openAtIndex = (index: number) => {
    setZoomIndex(index);
    setIsOpen(true);
  };

  return (
    <>
      {children(openAtIndex)}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogPortal>
          <DialogOverlay className="transition-all data-[state=closed]:bg-transparent data-[state=closed]:backdrop-blur-0 data-[state=open]:bg-background/80 data-[state=open]:backdrop-blur-md motion-reduce:transition-none" />
          <DialogPrimitive.Content
            className={cn(
              'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed inset-0 z-[1001] flex h-dvh w-dvw flex-col bg-transparent p-0 shadow-none duration-200',
            )}
          >
            <div className="flex h-full w-full flex-col gap-3 p-4">
              <div className="flex w-full items-start justify-end">
                <DialogClose className="inline-flex h-10 w-10 items-center justify-center text-white hover:bg-accent border rounded-md cursor-pointer">
                  <XIcon className="h-5 w-5" />
                  <span className="sr-only">Close</span>
                </DialogClose>
              </div>
              <div className="flex flex-1 items-center justify-center">
                <div className="flex w-full max-w-7xl flex-col items-center gap-6">
                  <div className="w-full">
                    <Carousel
                      setApi={setZoomCarouselApi}
                      className="w-full transform-none"
                    >
                      <CarouselContent className="ml-0">
                        {items?.map((media, idx) => (
                          <CarouselItem
                            className="flex items-center justify-center pl-0"
                            key={`${media.url}-${idx}`}
                          >
                            <div className="flex h-full w-full items-center justify-center px-4">
                              {media.type === 'image' && (
                                <img
                                  src={media.url}
                                  className="max-h-[calc(100vh-12rem)] w-auto max-w-[90vw] rounded-lg object-contain"
                                />
                              )}
                              {media.type === 'video' && (
                                <video
                                  className="max-h-[calc(100vh-12rem)] w-auto max-w-[90vw] rounded-lg"
                                  controls
                                  playsInline
                                  preload="metadata"
                                  crossOrigin="anonymous"
                                >
                                  <source src={`${media.url}#t=0.001`} type="video/mp4" />
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
                    {Array.from({length: zoomTotalItems}).map((_, idx) => (
                      <button
                        key={`zoom-dot-${idx}`}
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
