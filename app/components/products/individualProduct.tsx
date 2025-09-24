import {Breadcrumb} from '../ui/breadcrumb';
import {Link} from '@remix-run/react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {useEffect, useState} from 'react';
import '../../styles/routeStyles/product.css';

function IndividualProduct({
  productName,
  productImages,
}: {
  productName: string;
  productImages: {
    url: string;
    altText: string;
  }[];
}) {
  console.log(productImages, 'imgs');

  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [zoomData, setZoomData] = useState<{
    src: string;
    x: number;
    y: number;
    visible: boolean;
    mouseX: number;
    mouseY: number;
  }>({src: '', x: 0, y: 0, visible: false, mouseX: 0, mouseY: 0});

  const handleMouseMove = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>,
    src: string,
  ) => {
    if (!zoomData.visible) return;

    const {left, top, width, height} = e.currentTarget.getBoundingClientRect();
    const x = ((e.pageX - left) / width) * 100;
    const y = ((e.pageY - top) / height) * 100;

    setZoomData((prev) => ({
      ...prev,
      x,
      y,
      mouseX: e.pageX,
      mouseY: e.pageY,
    }));
  };

  const handleImageClick = (
    e: React.MouseEvent<HTMLImageElement, MouseEvent>,
    src: string,
  ) => {
    if (zoomData.visible && zoomData.src === src) {
      setZoomData({src: '', x: 0, y: 0, visible: false, mouseX: 0, mouseY: 0});
    } else {
      const {left, top, width, height} =
        e.currentTarget.getBoundingClientRect();
      const x = ((e.pageX - left) / width) * 100;
      const y = ((e.pageY - top) / height) * 100;

      setZoomData({
        src,
        x,
        y,
        visible: true,
        mouseX: e.pageX,
        mouseY: e.pageY,
      });
    }
  };

  const handleMouseLeave = () => {
    setZoomData({src: '', x: 0, y: 0, visible: false, mouseX: 0, mouseY: 0});
  };

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

  // Reset carousel when productImages change
  useEffect(() => {
    resetCarousel();
  }, [productImages]);

  return (
    <>
      <div className="grid grid-cols-1">
        <div className="flex justify-center px-4 product-carousel-container">
          <Carousel
            className="print-carousel-individual mx-3 flex items-center justify-center"
            key={JSON.stringify(productImages)}
            setApi={setCarouselApi} // get the Embla API
          >
            <CarouselContent className="flex">
              {productImages.map((url, idx) => (
                <CarouselItem
                  className="flex items-center justify-center"
                  key={idx}
                >
                  <div className="p-4 flex items-center justify-center">
                    <img
                      src={url.url}
                      alt=""
                      className="max-h-full object-contain carousel-item"
                      onClick={(e) => handleImageClick(e, url.url)}
                      onMouseMove={(e) => handleMouseMove(e, url.url)}
                      onMouseLeave={handleMouseLeave}
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>

        <div className="flex justify-center gap-2 mb-5 carousel-shortcuts-container">
          {productImages.map((url, idx) => (
            <img
              key={idx}
              src={url.url}
              className={`cursor-pointer border-2 h-[75px] w-[130px] object-contain ${
                idx === activeIndex ? 'border-[hsl(var(--primary))]' : ''
              }`}
              onClick={() => handleThumbnailClick(idx)}
            />
          ))}
        </div>
      </div>

      {/* Floating Zoom Window */}
      {zoomData.visible && (
        <div
          className="floating-zoom-window fixed border-2 border-gray-300 shadow-xl z-50 bg-no-repeat bg-white pointer-events-none"
          style={{
            width: '350px',
            height: '350px',
            backgroundImage: `url(${zoomData.src})`,
            backgroundPosition: `${zoomData.x}% ${zoomData.y}%`,
            backgroundSize: '500%',
            top: zoomData.mouseY - 330, // above cursor
            left: zoomData.mouseX + 10, // to right of cursor
          }}
          onClick={() =>
            setZoomData({
              src: '',
              x: 0,
              y: 0,
              visible: false,
              mouseX: 0,
              mouseY: 0,
            })
          }
        />
      )}
    </>
  );
}

export default IndividualProduct;
