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
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLIFrameElement>(null);

  const {featuredImage, id} = EProduct;
  const WMLink = EProduct.tags.filter((tag) => tag.includes('wmlink'))?.[0];
  const parsedWMLink = WMLink?.split('_')[1];
  console.log(EProduct, 'epep');

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
      {featuredImage && (
        <img
          src={featuredImage.url}
          alt={featuredImage.altText || 'Product image'}
          className="EProductImage"
          onPointerDown={() => redirect(`/stock/${id}`)}
        />
      )}

      {/* Video overlay */}
      {isHovered && (
        <div
          className="EProductVideoWrapper"
          onClick={() => redirect(`/products/${EProduct.handle}`)}
        >
          <Link to={`/products/${EProduct.handle}`}>
            <iframe
              ref={videoRef}
              src={`https://player.vimeo.com/video/${parsedWMLink}?autoplay=1&muted=1&background=1&badge=0&autopause=0`}
              allow="autoplay; loop;"
              className={`EProductVideo ${isVideoReady ? 'visible' : ''}`}
              title="Product video"
              onLoad={handleVideoLoad}
              onPointerDown={() => redirect(`/products/${EProduct.handle}`)}
            ></iframe>
          </Link>
        </div>
      )}
    </div>
  );
}

export default EProductPreview;
