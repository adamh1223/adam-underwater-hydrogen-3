import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {useEffect, useState} from 'react';
import '../../styles/routeStyles/product.css';
import ThreeDViewModal from '../global/ThreeDViewModal';
import {ImageZoom} from 'components/ui/shadcn-io/image-zoom';
import {Image} from 'lucide-react';

function IndividualProduct({
  productName,
  productImages,
  orientation,
  verticalProductImages,
  threeDViewImages,
}: {
  productName: string;
  orientation: string;
  productImages: {
    url: string;
    altText: string;
  }[];
  verticalProductImages: {
    url: string;
    altText: string;
  }[];
  threeDViewImages: {
    url: string;
    altText: string;
  }[];
}) {
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const handleImageClick = (src: string) => {
    setZoomImage(src);
  };

  const closeZoom = () => setZoomImage(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<any>(null);

  // Sync active index when carousel changes (via chevrons or user scroll)
  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      setActiveIndex(carouselApi.selectedScrollSnap());
    };
    carouselApi.on('select', onSelect);
    return () => {
      carouselApi.off('select', onSelect);
    };
  }, [carouselApi]);

  const handleThumbnailClick = (index: number) => {
    if (carouselApi) {
      carouselApi.scrollTo(index); // smooth scroll
    }
    setActiveIndex(index);
  };

  // Reset carousel to first slide
  const resetCarousel = () => {
    if (carouselApi) {
      carouselApi.scrollTo(0); // scroll smoothly to first
    }
    setActiveIndex(0); // update blue border
  };

  const orientationImages =
    orientation === 'Landscape' ? productImages : verticalProductImages;
  // Reset carousel when productImages change
  useEffect(() => {
    resetCarousel();
  }, [orientationImages]);

  // const threeSixtyCarouselImages = productImages.nodes
  //   .map((image: any) => {
  //     if (image.url?.includes('360-carousel-')) {
  //       return image;
  //     }
  //   })
  //   .filter(Boolean);
  return (
    <>
      <div className="grid grid-cols-1">
        <div className="grid grid-cols-1 px-4 product-carousel-container relative">
          {orientation === 'Landscape' && (
            <Carousel
              className="print-carousel-individual-horizontal mx-3 flex items-center justify-center"
              key={JSON.stringify(orientationImages)}
              setApi={setCarouselApi} // get the Embla API
            >
              <CarouselContent className="flex">
                {orientationImages.map((url, idx) => (
                  <CarouselItem
                    className="flex items-center justify-center"
                    key={idx}
                  >
                    <div className="p-4 flex items-center justify-center">
                      {/* <img
                        src={url.url}
                        alt={url.altText || productName}
                        className="max-h-full object-contain carousel-item cursor-zoom-in"
                        onClick={() => handleImageClick(url.url)}
                      /> */}
                      <ImageZoom>
                        <img
                          className="max-h-full object-contain carousel-item cursor-zoom-in"
                          src={url.url}
                          alt={url.altText || productName}
                        />
                      </ImageZoom>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}
          {orientation === 'Vertical' && (
            <Carousel
              className="print-carousel-individual-vertical mx-3 flex items-center justify-center"
              key={JSON.stringify(orientationImages)}
              setApi={setCarouselApi} // get the Embla API
            >
              <CarouselContent className="flex">
                {orientationImages.map((url, idx) => (
                  <CarouselItem
                    className="flex items-center justify-center"
                    key={idx}
                  >
                    <div className="p-4 flex items-center justify-center">
                      <img
                        src={url.url}
                        alt={url.altText || productName}
                        className="max-h-full object-contain carousel-item cursor-zoom-in"
                        onClick={() => handleImageClick(url.url)}
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              <CarouselPrevious />
              <CarouselNext />
            </Carousel>
          )}

          {orientation === 'Landscape' && (
            <div className="flex carousel-shortcuts-container-horizontal">
              {orientationImages.map((url, idx) => (
                <>
                  <div className="flex justify-center items-center">
                    <img
                      key={idx}
                      src={url.url}
                      className={`cursor-pointer border-2 shortcut-image h-[75px] w-[130px] object-contain ${
                        idx === activeIndex
                          ? 'border-[hsl(var(--primary))]'
                          : ''
                      }`}
                      onClick={() => handleThumbnailClick(idx)}
                    />
                  </div>
                </>
              ))}
            </div>
          )}
          {orientation === 'Vertical' && (
            <div className="flex carousel-shortcuts-container-vertical">
              {orientationImages.map((url, idx) => (
                <>
                  <div className="flex justify-center items-center">
                    <img
                      key={idx}
                      src={url.url}
                      className={`cursor-pointer border-2 shortcut-image h-[120px] w-[90px] object-contain ${
                        idx === activeIndex
                          ? 'border-[hsl(var(--primary))]'
                          : ''
                      }`}
                      onClick={() => handleThumbnailClick(idx)}
                    />
                  </div>
                </>
              ))}
            </div>
          )}
          {threeDViewImages.length > 1 && (
            <div className="flex justify-center mt-3 mb-5">
              <div className="w-64 h-18 flex justify-center">
                <ThreeDViewModal images={threeDViewImages} />
              </div>
            </div>
          )}

          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>

      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={closeZoom}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={zoomImage}
              alt={productName}
              className="max-h-[90vh] max-w-[90vw] object-contain rounded shadow-2xl"
            />
            <button
              type="button"
              className="absolute -top-2 -right-2 rounded-full bg-white text-black px-2 py-1 text-sm shadow"
              onClick={closeZoom}
              aria-label="Close image zoom"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default IndividualProduct;
