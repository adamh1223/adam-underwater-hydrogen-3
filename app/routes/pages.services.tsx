import Sectiontitle from '~/components/global/Sectiontitle';
import '../styles/routeStyles/services.css';
import {Button} from '~/components/ui/button';
import {useEffect, useState} from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '~/components/ui/card';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '~/components/ui/carousel';
import {servicesImages1, servicesImages2} from '~/utils/constants';

function ServicesPage() {
  const handleClick = (
    sectionId: string,
    event: React.MouseEvent<HTMLAnchorElement>,
  ) => {
    let section = document.getElementById(sectionId);
    event.preventDefault();
    section && section.scrollIntoView({behavior: 'smooth'});
  };

  const [isVideoReady, setIsVideoReady] = useState(false);

  const handleVideoLoad = () => {
    setTimeout(() => {
      setIsVideoReady(true); // Switch to video only when loaded
    }, 5000);
  };

  useEffect(() => {
    const iframe = document.querySelector('iframe');
    if (iframe) {
      iframe.addEventListener('load', handleVideoLoad);
    }
    return () => {
      if (iframe) {
        iframe.removeEventListener('load', handleVideoLoad);
      }
    };
  }, []);

  return (
    <>
      <div className="flex justify-center pb-5">
        <img
          src={'/services2.png'}
          style={{height: '110px'}}
          className="pt-3"
        />
      </div>

      <div
        className="anchors"
        style={{
          gridTemplateColumns: '1fr 1fr 1fr',
        }}
      >
        <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('video', evt)}>Underwater Video</a>
        </Button>
        <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('photo', evt)}>Underwater Photo</a>
        </Button>
        <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('drone', evt)}>
            Drone Video & Photo
          </a>
        </Button>
        {/* <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('dives', evt)}>Guided Dives</a>
        </Button> */}
        {/* <Button variant="outline" className="anchor">
          <a onClick={(evt) => handleClick('coaching', evt)}>1 on 1 Coaching</a>
        </Button> */}
      </div>
      <Sectiontitle text="Underwater 8K Video" />
      <section
        id="video"
        className="flex flex-col items-center justify-center text-center main"
      >
        <div className="media-container">
          <img
            src="/print3.jpg"
            className={`placeholder ${isVideoReady ? 'hidden' : ''}`}
          />
          <iframe
            src="https://player.vimeo.com/video/1018553050?autoplay=1&loop=1&muted=1&background=1"
            frameBorder="0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            className={`video ${isVideoReady ? 'visible' : ''}`}
            title="Background Video"
          ></iframe>
        </div>
      </section>
      <section id="photo" className="pt-3">
        <Sectiontitle text="Underwater 45mp Photo" />
        <div className="flex justify-center">
          <Carousel className="w-[85%]">
            <CarouselContent>
              {/* First item */}
              <CarouselItem>
                <div className="flex items-center justify-center h-full">
                  <div className="grid lg:grid-cols-3 grid-cols-2 gap-4 p-4">
                    {servicesImages1.map((imageURL, index) => (
                      <Card key={index} className="group overflow-hidden">
                        <CardContent className="p-0 cursor-pointer">
                          <img
                            src={imageURL}
                            className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CarouselItem>

              {/* Second item */}
              <CarouselItem>
                <div className="flex items-center justify-center h-full">
                  <div className="grid lg:grid-cols-3 grid-cols-2 gap-4 p-4">
                    {servicesImages2.map((imageURL, index) => (
                      <Card key={index} className="group overflow-hidden">
                        <CardContent className="p-0 cursor-pointer">
                          <img
                            src={imageURL}
                            className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </CarouselItem>

              {/* Third item */}
              <CarouselItem>
                <div className="p-4 flex items-center justify-center">
                  <img src={'/images/gear3.png'} alt="" />
                </div>
              </CarouselItem>
            </CarouselContent>

            <CarouselPrevious className="" />
            <CarouselNext />
          </Carousel>
        </div>
      </section>
      {/* <section id="dives">
        <Sectiontitle text="Guided Dives" />
        <ul className="subheader">
          <h1>San Diego, CA</h1>
        </ul>
        <div className="cards-container">
          <div className="card">
            <Card>
              <CardHeader>
                <CardTitle>Guided Scuba Dive</CardTitle>
                <CardDescription>Scuba Certification required</CardDescription>
              </CardHeader>
              <CardContent>
                <p>hi</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="anchor">
                  Book Now
                </Button>
              </CardFooter>
            </Card>
          </div>
          <div className="card">
            <Card>
              <CardHeader>
                <CardTitle>Guided Snorkel Tour</CardTitle>
                <CardDescription>Card Description</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Card Content</p>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="anchor">
                  Book Now
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section> */}
      <section id="drone">
        <Sectiontitle text="Drone Video & Photo" />
        <br />
        <div className="subheader flex justify-center">
          Commercial FAA drone operator with 5 years of experience in aerial
          cinematography.
        </div>
        <br />
        <div
          style={{
            gridTemplateColumns: '1fr 1fr',
          }}
          className="drone-titles"
        >
          <Card className=" group overflow-hidden px-8 pb-8 mx-5">
            <CardHeader className="text-center drone-title">
              <CardTitle>DJI Inspire 3</CardTitle>
            </CardHeader>
            <p className="flex justify-center pb-7 mt-[-15px] font-3xl">
              8.1K Full Frame, Pro Res Raw up to 60fps
            </p>
            <CardContent className="p-0">
              <img
                src={'/inspire3.jpg'}
                alt="DJI Inspire 3"
                className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
            </CardContent>
          </Card>
          {/* /627592883 */}

          <Card className=" group overflow-hidden px-8 pb-8 mx-5">
            <CardHeader className="text-center drone-title">
              <CardTitle>FPV RED Komodo X</CardTitle>
            </CardHeader>
            <p className="flex justify-center pb-7 mt-[-15px]">
              6K Global Shutter, R3D Raw up to 75fps
            </p>
            <CardContent className="p-0">
              <img
                src={'/inspire3.jpg'}
                alt="DJI Inspire 3"
                className="h-auto object-cover transform group-hover:scale-105 transition-transform duration-500"
              />
            </CardContent>
          </Card>
          {/* /522510112 */}
        </div>
        <br />
        <div className="subheader flex justify-center">
          Check out my drone website at{' '}
        </div>
        <div className="subheader flex justify-center">
          <a
            href="https://gifts.worldwildlife.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 underline"
          >
            flywithadam.com
          </a>
        </div>
      </section>
      {/* <section id="coaching">
        <Sectiontitle text="1 on 1 Coaching" />
        <ul className="subheader">
          <h1>Zoom coaching sessions</h1>
        </ul>
        <ul>
          <li>
            I am happy to provide coaching sessions for anyone interested in
            Underwater videography or photography.
          </li>
          <li>
            Topics include: underwater camera gear questions and
            recommendations, composing cinematic shots underwater, landing
            paying clients as an underwater cinematographer, building a brand,
            feature film advice, and creative direction
          </li>
          <li>The first coaching session is 50% off.</li>
        </ul>
      </section> */}
    </>
  );
}

export default ServicesPage;
