import {useEffect, useMemo, useRef, useState} from 'react';
import {Link} from '@remix-run/react';
import {ProductItemFragment} from 'storefrontapi.generated';
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import '../../styles/components/EProductPreview.css';

type ShopifyImage = {url: string; altText?: string | null};

type BundleClip = {
  index: number;
  image?: ShopifyImage;
  wmlinkId?: string;
};

const wmlinkRegex = /^wmlink(\d+)_/i;
const bundleAltRegex = /bundle(\d+)-/i;

const parseBundleWmlinks = (tags: string[]) =>
  tags
    .map((tag) => {
      const match = tag.match(wmlinkRegex);
      if (!match) return null;
      return {index: Number(match[1]), id: tag.split('_')[1]};
    })
    .filter(
      (item): item is {index: number; id: string} =>
        Boolean(item?.index) && Boolean(item?.id),
    )
    .sort((a, b) => a.index - b.index);

const buildBundleClips = (
  images: ShopifyImage[],
  tags: string[],
): BundleClip[] => {
  const wmlinks = parseBundleWmlinks(tags);
  const imagesByIndex = new Map<number, ShopifyImage>();

  images.forEach((image, index) => {
    if (!image?.altText) return;
    const match = image.altText.match(bundleAltRegex);
    if (!match) return;
    imagesByIndex.set(Number(match[1]), image);
  });

  const clipCount = Math.max(
    wmlinks.length,
    imagesByIndex.size,
    images.length,
  );

  const clips: BundleClip[] = [];
  for (let i = 1; i <= clipCount; i += 1) {
    const wmlinkMatch = wmlinks.find((link) => link.index === i);
    const fallbackImage = images[i - 1];
    const image = imagesByIndex.get(i) ?? fallbackImage;
    if (!image && !wmlinkMatch?.id) continue;
    clips.push({
      index: i,
      image,
      wmlinkId: wmlinkMatch?.id,
    });
  }

  return clips;
};

function BundleClipPreview({clip}: {clip: BundleClip}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isHovered) setIsVideoReady(false);
  }, [isHovered]);

  const handleVideoLoad = () => {
    setIsVideoReady(true);
  };

  return (
    <div
      className="EProductPreviewContainer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {clip.image && (
        <img
          src={clip.image.url}
          alt={clip.image.altText || 'Bundle preview'}
          className="EProductImage"
        />
      )}
      {isHovered && clip.wmlinkId && (
        <div className="EProductVideoWrapper">
          <iframe
            ref={videoRef}
            src={`https://player.vimeo.com/video/${clip.wmlinkId}?autoplay=1&muted=1&background=1&badge=0&autopause=0`}
            allow="autoplay; loop;"
            className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
            title="Bundle clip preview"
            onLoad={handleVideoLoad}
          ></iframe>
        </div>
      )}
    </div>
  );
}

function EProductBundlePreview({
  product,
}: {
  product: ProductItemFragment & {images: {nodes: ShopifyImage[]}};
}) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalItems, setTotalItems] = useState(0);

  const clips = useMemo(
    () => buildBundleClips(product.images.nodes || [], product.tags || []),
    [product.images.nodes, product.tags],
  );

  useEffect(() => {
    if (!carouselApi) return;

    const updateCarouselState = () => {
      setCurrentIndex(carouselApi.selectedScrollSnap());
      setTotalItems(carouselApi.scrollSnapList().length);
    };

    updateCarouselState();

    carouselApi.on('select', updateCarouselState);

    return () => void carouselApi.off('select', updateCarouselState);
  }, [carouselApi]);

  const scrollToIndex = (index: number) => carouselApi?.scrollTo(index);

  return (
    <Carousel
      setApi={setCarouselApi}
      className="w-full max-w-7xl transform-none mb-3 z-50"
    >
      <CarouselContent>
        {clips.map((clip) => (
          <CarouselItem
            className="flex items-center justify-center"
            key={`bundle-clip-${clip.index}`}
          >
            <Link
              className="product-item w-full"
              key={product.id}
              prefetch="intent"
              to={`/products/${product.handle}`}
            >
              <BundleClipPreview clip={clip} />
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      {totalItems > 1 && (
        <>
          <CarouselPrevious
            inTheBox
            className="z-10 border-white/60 bg-black/40 text-white hover:bg-black/60"
          />
          <CarouselNext
            inTheBox
            className="z-10 border-white/60 bg-black/40 text-white hover:bg-black/60"
          />
        </>
      )}
      {totalItems > 1 && (
        <div className="carousel-preview-dots absolute bottom-0 left-0 right-0 flex items-end justify-center gap-3 h-24 pt-5">
          {Array.from({length: totalItems}).map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                scrollToIndex(idx);
              }}
              className={`cursor-pointer z-60 h-2 w-2 rounded-full border border-white/60 ${idx === currentIndex ? 'bg-white' : 'bg-white/30'}`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </Carousel>
  );
}

export default EProductBundlePreview;
