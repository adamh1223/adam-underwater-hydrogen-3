import {useEffect, useMemo, useRef, useState} from 'react';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {getOptimizedImageUrl} from '~/lib/imageWarmup';
import '../../styles/routeStyles/product.css';

type BundleClipImage = {url: string; altText?: string | null};

export type BundleDetailClip = {
  index: number;
  wmlinkId?: string;
  vidKey?: string;
  image?: BundleClipImage;
  clipName: string;
  clipLocation?: string;
  descriptionHtml?: string;
};

function IndividualVideoBundle({
  productName,
  clips,
  activeClipIndex = 1,
  onActiveClipChange,
}: {
  productName: string;
  clips: BundleDetailClip[];
  activeClipIndex?: number;
  onActiveClipChange?: (clipIndex: number) => void;
}) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const activeClipArrayIndex = useMemo(() => {
    const matchIndex = clips.findIndex((clip) => clip.index === activeClipIndex);
    return matchIndex >= 0 ? matchIndex : 0;
  }, [clips, activeClipIndex]);

  useEffect(() => {
    if (!carouselApi) return;

    const updateFromCarousel = () => {
      const selectedSnap = carouselApi.selectedScrollSnap();
      setCurrentIndex(selectedSnap);
      onActiveClipChange?.(clips[selectedSnap]?.index ?? 1);
    };

    updateFromCarousel();
    carouselApi.on('select', updateFromCarousel);
    return () => {
      carouselApi.off('select', updateFromCarousel);
    };
  }, [carouselApi, clips, onActiveClipChange]);

  useEffect(() => {
    if (!carouselApi) return;
    if (activeClipArrayIndex === carouselApi.selectedScrollSnap()) return;
    carouselApi.scrollTo(activeClipArrayIndex);
  }, [activeClipArrayIndex, carouselApi]);

  useEffect(() => {
    setCurrentIndex(activeClipArrayIndex);
  }, [activeClipArrayIndex]);

  const handleThumbnailClick = (index: number) => {
    carouselApi?.scrollTo(index);
    setCurrentIndex(index);
    onActiveClipChange?.(clips[index]?.index ?? 1);
  };

  if (!clips.length) return null;

  return (
    <div className="grid grid-cols-1 w-full h-fit lg:self-center">
      <div className="grid grid-cols-1 w-full h-fit content-start self-start px-2 product-carousel-container bundle-detail-carousel-container relative">
        <Carousel
          className="bundle-detail-carousel individual-video-bundle-detail-media"
          key={JSON.stringify(clips.map((clip) => clip.index))}
          setApi={setCarouselApi}
          opts={{watchDrag: true}}
        >
          <div className="bundle-detail-media-frame">
            <CarouselContent className="flex">
              {clips.map((clip) => (
                <CarouselItem
                  className="flex items-center justify-center"
                  key={`bundle-individual-clip-${clip.index}`}
                >
                  <div className="bundle-detail-main-media flex items-center justify-center">
                    {clip.wmlinkId ? (
                      <iframe
                        className="bundle-detail-iframe"
                        src={`https://player.vimeo.com/video/${clip.wmlinkId}?badge=0&autopause=0&player_id=0&app_id=58479`}
                        allow="autoplay; fullscreen; picture-in-picture"
                        title={`${productName} - Clip ${clip.index}`}
                        loading="eager"
                      ></iframe>
                    ) : clip.image?.url ? (
                      <img
                        src={getOptimizedImageUrl(clip.image.url, 1600)}
                        srcSet={[480, 720, 960, 1280, 1600]
                          .map(
                            (width) =>
                              `${getOptimizedImageUrl(clip.image?.url ?? '', width)} ${width}w`,
                          )
                          .join(', ')}
                        sizes="(max-width: 700px) 92vw, 70vw"
                        alt={
                          clip.image.altText ??
                          `${productName} preview ${clip.index}`
                        }
                        className="bundle-detail-image"
                      />
                    ) : (
                      <div className="bundle-detail-empty">
                        Clip {clip.index}
                      </div>
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious
              className="bundle-detail-carousel-arrow bundle-detail-carousel-arrow-prev cursor-pointer z-[80] p-0 shadow-none text-white"
            />
            <CarouselNext
              className="bundle-detail-carousel-arrow bundle-detail-carousel-arrow-next cursor-pointer z-[80] p-0 shadow-none text-white"
            />
          </div>
        </Carousel>

        {clips.length > 1 && (
          <div className="bundle-detail-shortcuts-outer">
            <div className="bundle-detail-shortcuts-inner">
              {clips.map((clip, idx) => (
                <button
                  type="button"
                  key={`bundle-shortcut-${clip.index}`}
                  className={`cursor-pointer bundle-detail-shortcut ${
                    idx === currentIndex
                      ? 'bundle-detail-shortcut--active'
                      : 'bundle-detail-shortcut--inactive'
                  }`}
                  onClick={() => handleThumbnailClick(idx)}
                  aria-pressed={idx === currentIndex}
                  aria-label={`Go to clip ${clip.index}`}
                >
                  <div className="bundle-detail-shortcut-media">
                    {clip.image?.url ? (
                      <img
                        src={getOptimizedImageUrl(clip.image.url, 360)}
                        srcSet={[180, 240, 320, 420]
                          .map(
                            (width) =>
                              `${getOptimizedImageUrl(clip.image?.url ?? '', width)} ${width}w`,
                          )
                          .join(', ')}
                        sizes="(max-width: 700px) 22vw, 12vw"
                        alt={
                          clip.image.altText ?? `Clip ${clip.index} thumbnail`
                        }
                        className="bundle-detail-shortcut-image"
                      />
                    ) : (
                      <span className="bundle-detail-empty text-sm">
                        {clip.index}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default IndividualVideoBundle;
