import {Breadcrumb} from '../ui/breadcrumb';
import {Link} from '@remix-run/react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';

function IndividualProduct({
  productName,
  productImages,
}: {
  productName: string;
  productImages: string[];
}) {
  return (
    <>
      <section className="px-[60px] pt-[40px]">
        <div className="breadcrumbs">
          <Link to="/">Home</Link>
          <Link to="/products">Products</Link>
          <Link to="/">{productName}</Link>
        </div>
        {/* <Breadcrumb name="INdividual product name" /> */}
        <div className="mt-6 grid gap-y-8 xl:grid-cols-2 xl:gap-x-16 me-7">
          <Carousel
            className="w-full max-w-m mx-3 flex items-center justify-center sm: mx-[31px]
          md: mx-[20px]"
          >
            <CarouselContent className="flex">
              {/* First item */}
              <CarouselItem className="flex items-center justify-center">
                <div className="p-4 flex items-center justify-center">
                  <img
                    src={productImages[0]}
                    alt=""
                    className="max-h-full object-contain"
                  />
                </div>
              </CarouselItem>

              {/* Second item */}
              <CarouselItem className="flex items-center justify-center">
                <div className="p-4 flex items-center justify-center">
                  <img
                    src={productImages[1]}
                    alt=""
                    className="max-h-full object-contain"
                  />
                </div>
              </CarouselItem>

              {/* Third item */}
              <CarouselItem className="flex items-center justify-center">
                <div className="p-4 flex items-center justify-center">
                  <img
                    src={productImages[2]}
                    alt=""
                    className="max-h-full object-contain"
                  />
                </div>
              </CarouselItem>
            </CarouselContent>

            <CarouselPrevious />
            <CarouselNext />
          </Carousel>

          {/* PRODUCT INFO SECOND COL */}
          {/* <div className="lg:ps-3 md:ps-3 sm:ps-3 xl:ps-8">
            <div className="flex gap-x-8 items-center">
              <h1 className="capitalize text-3xl font-bold">{name}</h1>
              <FavoriteToggleButton productId={params.id} EProductId={null} />
            </div>
            <ProductRating productId={params.id} />
            <h4 className="text-xl mt-2">{company}</h4>
            <p className="mt-3 text-md bg-muted inline-block p-2 rounded-md">
              {dollarsAmount}
            </p>
            <p className="mt-6 leading-8 text-muted-foreground">
              {description}
            </p>
            <div className="flex items-center">
              <AddToCart
                productId={params.id}
                RedirectTo={`/products/${params.id}`}
                isEProduct={false}
              />
            </div>
          </div>
        </div>
        <ProductReviews productId={params.id} />

        {reviewDoesNotExist && <SubmitReview productId={params.id} />} */}
        </div>
      </section>
    </>
  );
}
export default IndividualProduct;
