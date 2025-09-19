import {useState, useRef, useEffect} from 'react';
import './styles/VideoPreview.css';
import {Link, useNavigate} from '@remix-run/react';
import {Image} from '@shopify/hydrogen/storefront-api-types';

function VideoPreview({
  handle,
  thumbnail,
  extraClassName,
}: {
  handle: string;
  thumbnail: Pick<Image, 'url' | 'id' | 'height' | 'width' | 'altText'>;
  extraClassName?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [thumbnailSize, setThumbnailSize] = useState({width: 0, height: 0});
  const imgRef = useRef<HTMLImageElement>(null);
  const handleVideoLoad = () => {
    if (isHovered) {
      setTimeout(() => {
        setIsVideoReady(true); // Switch to video only when loaded
      }, 800);
    }
  };

  useEffect(() => {
    if (imgRef.current) {
      setThumbnailSize({
        width: imgRef.current.clientWidth,
        height: imgRef.current.clientHeight,
      });
    }
  }, [isHovered]);
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

  const router = useNavigate();
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
        {thumbnail.url && thumbnail.url.length > 0 && (
          <img
            ref={imgRef}
            src={thumbnail.url}
            alt="name"
            sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 33vw"
            className={`thumbnail-crop ${imageClass} cursor-pointer`}
            onPointerDown={() => router(`/products/${handle}`)}
          />
        )}
      </>
      {isHovered && (
        <div
          className={divStyles}
          onClick={() => router(`/products/${handle}`)}
        >
          {' '}
          <h1>this is an h1</h1>
          {/* Aspect ratio for 16:9 */}
          <Link to={`/products/${handle}`} className="cursor-pointer">
            {/* <iframe
              src={`https://player.vimeo.com/video/${WMVideoLink}?autoplay=1&muted=1&background=1&badge=0&autopause=0`}
              allow="autoplay; loop;"
              // @ts-expect-error ignore for now
              style={iframeStyles}
              onLoad={() => console.log("The video is loaded", isHovered, isVideoReady)}
              className={`ProductVideo ${
                isVideoReady ? "visible" : "tinyVideo"
              } cursor-pointer`}
              onPointerDown={() => router.push(`/products/${handle}`)}
            ></iframe> */}
          </Link>
        </div>
      )}
    </div>
  );
}

export default VideoPreview;
