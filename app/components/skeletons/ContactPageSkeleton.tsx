import {Skeleton} from '~/components/ui/skeleton';
import {Card} from '~/components/ui/card';
import {
  useWindowWidth,
  NavbarSkeleton,
  PageHeaderSkeleton,
  FeaturedSectionSkeleton,
  ProductGridSkeleton,
} from '~/components/skeletons/shared';

/**
 * Contact page structure:
 *  - PageHeader (icon + "Contact" title) — uses contact-header-container CSS
 *  - ContactForm (centered)
 *  - Featured section + product grid
 */

function ContactFormSkeleton() {
  return (
    <div className="flex justify-center px-4">
      <Card className="w-full max-w-[500px] p-6">
        {/* Name field */}
        <div className="mb-4">
          <Skeleton className="h-4 w-[60px] rounded-md mb-2" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        {/* Email field */}
        <div className="mb-4">
          <Skeleton className="h-4 w-[50px] rounded-md mb-2" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        {/* Subject field */}
        <div className="mb-4">
          <Skeleton className="h-4 w-[65px] rounded-md mb-2" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        {/* Message textarea */}
        <div className="mb-4">
          <Skeleton className="h-4 w-[70px] rounded-md mb-2" />
          <Skeleton className="h-[120px] w-full rounded-md" />
        </div>
        {/* Submit button */}
        <div className="flex justify-center">
          <Skeleton className="h-10 w-[100px] rounded-md" />
        </div>
      </Card>
    </div>
  );
}

export default function ContactPageSkeleton() {
  const windowWidth = useWindowWidth();

  // "Contact" title
  const titleW =
    (windowWidth ?? 800) <= 669
      ? 'w-[120px]'
      : (windowWidth ?? 800) <= 1024
        ? 'w-[135px]'
        : 'w-[155px]';

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton />
      <PageHeaderSkeleton titleWidth={titleW} />
      <ContactFormSkeleton />
      <FeaturedSectionSkeleton />
      <ProductGridSkeleton />
    </div>
  );
}
