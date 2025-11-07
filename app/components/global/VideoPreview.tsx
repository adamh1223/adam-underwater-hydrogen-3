import {useState, useRef, useEffect} from 'react';
import '../../styles/components/EProductPreview.css';
import {ProductItemFragment} from 'storefrontapi.generated';
import {redirect} from '@remix-run/server-runtime';
import {Link} from '@remix-run/react';

type shopifyImage = {url: string; altText: string};

function VideoPreview({
  //   EProduct,
  extraClassName,
}: {
  //   EProduct: ProductItemFragment & {images: {nodes: shopifyImage[]}};
  extraClassName?: string;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);

  //   const {featuredImage, id} = EProduct;
  let videoLink = '';
  // if (condition) {
  //     videoLink = '529029170';

  // } else {

  //     videoLink = '636620330';
  // }

  const handleVideoLoad = () => {
    setIsVideoReady(true);
  };

  useEffect(() => {
    if (!isHovered) setIsVideoReady(false);
  }, [isHovered]);

  return (
    <div
      className={`EProductPreviewContainer ${extraClassName || ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Base Image */}

      <img
        src={'/print3.jpg'}
        alt={'Product image'}
        className="EProductImage"
        onPointerDown={() => redirect(`/stock/${id}`)}
      />

      {/* Video overlay */}
      {isHovered && (
        <div className="EProductVideoWrapper" onClick={() => redirect(`/`)}>
          <Link to={`/`}>
            {/* link to modal where you can see the video with the control options */}
            {/* <iframe
              ref={videoRef}
              src={`https://player.vimeo.com/video/${videoLink}?autoplay=1&muted=1&background=1&badge=0&autopause=0`}
              allow="autoplay; loop;"
              className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
              onLoad={handleVideoLoad}
              onPointerDown={() => redirect(`/products/${EProduct.handle}`)}
            ></iframe> */}
            <iframe
              ref={videoRef}
              src={`https://player.vimeo.com/video/529029170?autoplay=1&muted=1&background=1&badge=0&autopause=0`}
              allow="autoplay; loop;"
              className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
              onLoad={handleVideoLoad}
              //   onPointerDown={() => redirect(`/products/${EProduct.handle}`)}
            ></iframe>
          </Link>
        </div>
      )}
    </div>
  );
}

export default VideoPreview;
