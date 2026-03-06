import React, {useEffect, useState} from 'react';
import {Card, CardHeader, CardContent} from '../ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '../ui/carousel';

export interface CardData {
  icon: string;
  title: string;
  description: string;
  image: string;
}

interface ThreeUpCarouselBoxProps {
  cards: CardData[];
}

const BASE_COLUMNS = 2;
const FIRST_COLUMN_GROWTH_VIEWPORT = 1024;
// Preserve the same +1 column growth cadence as the 720px -> 1024px jump.
const COLUMN_GROWTH_INTERVAL = 304;

function getVisibleColumnCount(viewportWidth: number, totalCards: number) {
  if (totalCards <= 0) return 0;

  const minimumColumns = Math.min(BASE_COLUMNS, totalCards);
  if (viewportWidth < FIRST_COLUMN_GROWTH_VIEWPORT) {
    return minimumColumns;
  }

  const additionalColumns =
    1 +
    Math.floor(
      (viewportWidth - FIRST_COLUMN_GROWTH_VIEWPORT) /
        COLUMN_GROWTH_INTERVAL,
    );

  return Math.min(totalCards, minimumColumns + additionalColumns);
}

export default function ThreeUpCarouselBox({cards}: ThreeUpCarouselBoxProps) {
  const [windowWidth, setWindowWidth] = useState<number | undefined>(undefined);

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const carouselGapRem = 1;

  function slideStyleForCount(count: number) {
    const safeCount = Math.max(1, count);
    const gapTotalRem = (safeCount - 1) * carouselGapRem;
    const width = `calc((100% - ${gapTotalRem}rem) / ${safeCount})`;
    return {flex: `0 0 ${width}`, maxWidth: width};
  }

  const viewportWidth = windowWidth ?? 0;
  const visibleColumns = getVisibleColumnCount(viewportWidth, cards.length);
  const shouldShowArrows = cards.length > visibleColumns;
  const useDesktopCardLayout = viewportWidth >= 1024;
  const carouselAlign: 'start' | 'center' = 'start';

  return (
    <div className="w-full flex justify-center">
      <Carousel
        className="inthebox-carousel w-full max-w-6xl"
        opts={{
          loop: false,
          align: carouselAlign,
          slidesToScroll: 1,
        }}
      >
        <CarouselContent className="!flex !items-stretch !justify-start gap-4">
          {cards.map((card: CardData, idx: number) => (
            <CarouselItem
              key={idx}
              style={slideStyleForCount(visibleColumns)}
              className="flex justify-center items-stretch"
            >
              <Card
                className={
                  useDesktopCardLayout
                    ? 'w-full'
                    : 'group w-full p-1 overflow-visible'
                }
              >
                <CardHeader>
                  <div className="flex justify-start">
                    <img
                      src={card.icon}
                      alt={`${card.title} icon`}
                      style={{height: '2rem'}}
                    />
                  </div>
                  <div className="flex justify-center">
                    <strong>{card.title}</strong>
                  </div>
                  <hr />
                </CardHeader>
                <CardContent className={useDesktopCardLayout ? '' : 'px-1'}>
                  <div
                    className={`flex justify-center pt-2 ${
                      useDesktopCardLayout ? '' : 'px-1'
                    }`}
                  >
                    <img
                      src={card.image}
                      alt={card.title}
                      className="max-h-[200px] object-contain p"
                    />
                  </div>
                  <div className="flex justify-center pt-2">
                    <div
                      className={
                        useDesktopCardLayout
                          ? 'max-w-[85%] text-center'
                          : 'max-w-[95%] text-center'
                      }
                    >
                      {card.description}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>

        {shouldShowArrows && <CarouselPrevious />}
        {shouldShowArrows && <CarouselNext />}
      </Carousel>
    </div>
  );
}
