import '../../styles/routeStyles/product.css';

function IndividualVideoProduct({
  productName,
  featuredImage,
  WMLink,
}: {
  productName: string;
  featuredImage: string | undefined;
  WMLink: string | undefined;
}) {
  void featuredImage;

  if (!WMLink) return null;

  return (
    <div className="grid grid-cols-1">
      <div className="grid grid-cols-1 px-2 product-carousel-container relative">
        <div className="bundle-detail-carousel individual-video-product-detail-media">
          <div className="bundle-detail-media-frame">
            <div className="bundle-detail-main-media flex items-center justify-center">
              <iframe
                className="bundle-detail-iframe"
                src={`https://player.vimeo.com/video/${WMLink}?badge=0&autopause=0&player_id=0&app_id=58479`}
                allow="autoplay; fullscreen; picture-in-picture"
                title={productName}
                loading="eager"
              ></iframe>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default IndividualVideoProduct;
