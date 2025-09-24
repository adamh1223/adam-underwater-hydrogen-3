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

  const WMLink = EProduct.tags.filter((tag) => tag.includes('wmlink'))?.[0];
  const parsedWMLink = WMLink?.split('_')[1];

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

  const divStyles = isVideoReady ? 'relative w-full pb-[52.7%]' : 'h-0 w-0';
  // This pb is messing things up, we have to find another way to do this
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
      // comment out above and uncomment out below to test eproductpreview bug
      // onMouseLeave={() => setIsHovered(true)}
    >
      <>
        {featuredImage && (
          <img
            ref={imgRef}
            src={featuredImage.url}
            alt="name"
            sizes="(max-width:768px) 100vw, (max-width:1200px) 50vw, 33vw"
            className={`${imageClass} cursor-pointer`}
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
              src={`https://player.vimeo.com/video/${parsedWMLink}?autoplay=1&muted=1&background=1&badge=0&autopause=0`}
              // <div style="padding:52.73% 0 0 0;position:relative;"><iframe src="https://player.vimeo.com/video/1045853480?title=0&amp;byline=0&amp;portrait=0&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479" frameborder="0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share" referrerpolicy="strict-origin-when-cross-origin" style="position:absolute;top:0;left:0;width:100%;height:100%;" title="3M"></iframe></div><script src="https://player.vimeo.com/api/player.js"></script>
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
