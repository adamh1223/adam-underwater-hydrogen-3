import {Skeleton} from '~/components/ui/skeleton';
import {Card, CardContent} from '~/components/ui/card';
import {Separator} from '~/components/ui/separator';

function NavbarSkeleton() {
  return (
    <div className="flex items-center justify-between h-[64px] px-6 border-b border-border/40">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-4 w-[140px]" />
      </div>

      {/* Menu items - hidden on mobile */}
      <div className="hidden md:flex items-center gap-6">
        <Skeleton className="h-4 w-[50px]" />
        <Skeleton className="h-4 w-[50px]" />
        <Skeleton className="h-4 w-[70px]" />
        <Skeleton className="h-4 w-[50px]" />
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 w-[60px]" />
      </div>

      {/* CTA icons */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="relative h-[400px] flex flex-col items-center justify-center overflow-hidden">
      {/* Background shimmer */}
      <Skeleton className="absolute inset-0 rounded-none" />

      {/* Hero image placeholder */}
      <div className="relative z-10 flex flex-col items-center">
        <Skeleton className="h-[65px] sm:h-[80px] w-[240px] sm:w-[280px] rounded-[25px]" />

        {/* Buttons */}
        <div className="flex flex-col items-center gap-5 pt-5">
          <Skeleton className="h-10 w-48 rounded-md" />
          <Skeleton className="h-10 w-48 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function FeaturedSectionSkeleton() {
  return (
    <div className="flex flex-col items-center pt-5 pb-2">
      <Skeleton className="h-[65px] sm:h-[80px] w-[240px] sm:w-[280px] rounded-[25px]" />
      <Skeleton className="h-6 w-[250px] mt-3" />
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="flex flex-col h-full p-0">
        {/* Image area */}
        <Skeleton className="w-full aspect-[4/5] rounded-b-none rounded-t-xl" />

        {/* Info area */}
        <div className="flex flex-col items-center gap-2.5 px-4 py-4">
          <Skeleton className="h-5 w-3/5" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-1/4" />
          <Skeleton className="h-9 w-[120px] rounded-md mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProductGridSkeleton() {
  return (
    <div className="px-[10px]">
      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-[10px]">
        {Array.from({length: 4}).map((_, i) => (
          <ProductCardSkeleton key={`prod-skel-${i}`} />
        ))}
      </div>
    </div>
  );
}

export default function HomePageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavbarSkeleton />
      <HeroSkeleton />
      <FeaturedSectionSkeleton />
      <ProductGridSkeleton />
    </div>
  );
}
