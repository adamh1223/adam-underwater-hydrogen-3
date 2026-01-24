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
    const gapTotalRem = (count - 1) * carouselGapRem;
    const width = `calc((100% - ${gapTotalRem}rem) / ${count})`;
    return {flex: `0 0 ${width}`, maxWidth: width};
  }

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
          {/* ≥ 1024px (3 slides) */}
          {windowWidth && windowWidth >= 1024 && (
            <>
              {cards.map((card: CardData, idx: number) => (
                <CarouselItem
                  key={idx}
                  style={slideStyleForCount(3)}
                  className="flex justify-center"
                >
                  <Card className="w-full">
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
                    <CardContent>
                      <div className="flex justify-center">
                        <img
                          src={card.image}
                          alt={card.title}
                          className="max-h-[200px] object-contain p"
                        />
                      </div>
                      <div className="flex justify-center pt-2">
                        <div className="max-w-[85%] text-center">
                          {card.description}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </>
          )}
          {/* 720–1023px (2 slides) */}
          {windowWidth && windowWidth < 1024 && (
            <>
              {cards.map((card: CardData, idx: number) => (
                <CarouselItem
                  key={idx}
                  style={slideStyleForCount(2)}
                  className="flex justify-center items-stretch"
                >
                  <Card className="group w-full p-1 overflow-visible">
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
                    <div>
                      <div className="flex justify-center px-1 pt-2">
                        <img
                          src={card.image}
                          alt={card.title}
                          className="max-h-[200px] object-contain p"
                        />
                      </div>
                      <div className="flex justify-center pt-2">
                        <div className="max-w-[95%] text-center">
                          {card.description}
                        </div>
                      </div>
                    </div>
                  </Card>
                </CarouselItem>
              ))}
            </>
          )}
          {/* < 720px (1 slide) */}
          {/* {windowWidth && windowWidth < 720 && (
            <>
              {cards.map((card: CardData, idx: number) => (
                <CarouselItem
                  key={idx}
                  style={slideStyleForCount(2)}
                  className="flex justify-center"
                >
                  <Card className="w-full">
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
                    <CardContent>
                      <div className="flex justify-center">
                        <img
                          src={card.image}
                          alt={card.title}
                          className="max-h-[200px] object-contain p"
                        />
                      </div>
                      <div className="flex justify-center pt-2">
                        <div className="max-w-[85%] text-center">
                          {card.description}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CarouselItem>
              ))}
            </>
          )} */}
        </CarouselContent>

        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}
