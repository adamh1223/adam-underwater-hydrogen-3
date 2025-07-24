import {useState, useRef, useEffect} from 'react';
import '../../styles/components/EProductPreview.css';
import {ProductItemFragment} from 'storefrontapi.generated';
import {redirect} from '@remix-run/server-runtime';
import {Link} from '@remix-run/react';

type shopifyImage = {url: string; altText: string};
function EProductPreview({
  EProduct,
  extraClassName,
}: {
  EProduct: ProductItemFragment & {images: {nodes: shopifyImage[]}};
  extraClassName?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageSize, setImageSize] = useState({width: 0, height: 0});
  const imgRef = useRef<HTMLImageElement>(null);
  const handleVideoLoad = () => {
    if (isHovered) {
      setTimeout(() => {
        setIsVideoReady(true); // Switch to video only when loaded
      }, 800);
    }
  };
  console.log(isHovered, '1111');

  useEffect(() => {
    if (imgRef.current) {
      setImageSize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  }, [isHovered]);

  const {featuredImage, id} = EProduct;
  const [isVideoReady, setIsVideoReady] = useState(false);
  console.log(isVideoReady, '2222');

  useEffect(() => {
    const iframe = document.querySelector('iframe');
    if (iframe && isHovered) {
      iframe.addEventListener('load', handleVideoLoad);
    }
    return () => {
      if (iframe && isHovered) {
        iframe.removeEventListener('load', handleVideoLoad);
      }
    };
  }, [isHovered]);

  const divStyles = isVideoReady
    ? 'relative w-full h-0 pb-[56.25%]'
    : 'h-0 w-0';
  const iframeStyles = isVideoReady
    ? {
        width: '100%',
        height: '94%',
        position: 'absolute', // Absolute positioning to fill the container
        top: '0',
        left: '0',
        objectFit: 'cover',
        objectPosition: 'center', // Centers the video within the iframe
        pointerEvents: 'none',
        cursor: 'pointer',
      }
    : {
        height: '0px',
        width: '0px',
      };
  // console.log(iframeStyles);

  const [imageClass, setImageClass] = useState('');
  useEffect(() => {
    if (isVideoReady && isHovered) {
      setImageClass('hidden');
    } else {
      setImageClass('');
    }
  }, [isVideoReady, isHovered]);

  return (
    <div
      className=""
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsVideoReady(false);
        if (!isVideoReady) {
          setTimeout(() => setIsVideoReady(false), 100);
        }
      }}
    >
      <>
        {featuredImage && (
          <img
            ref={imgRef}
            src={featuredImage.url}
            alt="name"
            sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 33vw"
            className={`thumbnail-crop ${imageClass} cursor-pointer`}
            onPointerDown={() => redirect(`/stock/${id}`)}
          />
        )}
      </>
      {isHovered && (
        <div className={divStyles} onClick={() => redirect(`/stock/${id}`)}>
          {' '}
          {/* Aspect ratio for 16:9 */}
          <Link to={`/stock/${id}`} className="cursor-pointer">
            <iframe
              // Make number after video dynamic ${WMVideoLink}
              src={`https://player.vimeo.com/video/1045853480?autoplay=1&muted=1&background=1&badge=0&autopause=0`}
              allow="autoplay; loop;"
              // @ts-expect-error ignore for now
              style={iframeStyles}
              onLoad={() =>
                console.log('The video is loaded', isHovered, isVideoReady)
              }
              className={`EProductVideo ${
                isVideoReady ? 'visible' : 'tinyVideo'
              } cursor-pointer`}
              onPointerDown={() => redirect(`/stock/${id}`)}
            ></iframe>
          </Link>
        </div>
      )}
    </div>
  );
}

export default EProductPreview;
