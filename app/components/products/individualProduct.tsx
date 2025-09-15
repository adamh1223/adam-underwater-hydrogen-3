import {Breadcrumb} from '../ui/breadcrumb';
import {Link} from '@remix-run/react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';
import {useEffect, useRef, useState} from 'react';
import {count} from 'console';
import {ChevronRightIcon} from 'lucide-react';
import '../../styles/routeStyles/product.css';
import {Image} from '@shopify/hydrogen';

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
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  });

  const carouselRef = useRef(null);
  const resetCarousel = () => {
    if (carouselRef.current) {
      // @ts-expect-error testing
      carouselRef.current.scrollToIndex(0);
    }
  };

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
      // close zoom
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
    // close zoom when mouse leaves the image
    setZoomData({src: '', x: 0, y: 0, visible: false, mouseX: 0, mouseY: 0});
  };

  return (
    <>
      <div className="grid grid-cols-1">
        <div className="flex justify-center px-4 product-carousel-container">
          <Carousel
            className="print-carousel-individual mx-3 flex items-center justify-center "
            key={JSON.stringify(productImages)}
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
                      className="max-h-full object-contain"
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
              className="cursor-pointer border-2 h-[75px] w-[130px] object-contain"
            />
          ))}
        </div>
      </div>

      {/* Floating Zoom Window */}
      {zoomData.visible && (
        <div
          className="floating-zoom-window fixed border-2 border-gray-300 shadow-xl z-50 bg-no-repeat bg-white pointer-events-none"
          style={{
            width: '300px',
            height: '300px',
            backgroundImage: `url(${zoomData.src})`,
            backgroundPosition: `${zoomData.x}% ${zoomData.y}%`,
            backgroundSize: '500%',

            top: zoomData.mouseY - 270, // position ABOVE the cursor
            left: zoomData.mouseX + 10, // position to the RIGHT of the cursor
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
