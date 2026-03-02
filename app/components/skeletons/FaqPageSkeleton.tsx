import {Skeleton} from '~/components/ui/skeleton';
import {Card} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';
import {
  useWindowWidth,
  NavbarSkeleton,
} from '~/components/skeletons/shared';

/**
 * FAQ page structure:
 *  - FAQ header image (pt-5, faq-header-img class)
 *  - Card with 4 Accordion items (each has trigger text)
 */

function AccordionItemSkeleton({isLast}: {isLast?: boolean}) {
  return (
    <div className={`py-4 ${isLast ? '' : 'border-b border-border'}`}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-3/4 rounded-md" />
        <Skeleton className="h-4 w-4 rounded-full" />
      </div>
    </div>
  );
}

export default function FaqPageSkeleton() {
  const windowWidth = useWindowWidth();

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton windowWidth={windowWidth} />
      <section>
        {/* FAQ header image */}
        <div className="flex justify-center">
          <Skeleton className="pt-5 h-[80px] w-[180px] rounded-md mt-5" />
        </div>
        {/* FAQ card with accordion */}
        <div className="flex justify-center pt-5">
          <Card className="p-7 w-full max-w-[800px] mx-4">
            <AccordionItemSkeleton />
            <AccordionItemSkeleton />
            <AccordionItemSkeleton />
            <AccordionItemSkeleton isLast />
          </Card>
        </div>
      </section>
    </div>
  );
}
