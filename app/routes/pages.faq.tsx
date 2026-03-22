import {useCallback, useEffect, useRef, useState} from 'react';
import {type MetaFunction} from '@remix-run/react';
import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {redirect} from '@shopify/remix-oxygen';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '~/components/ui/accordion';
import {Card} from '~/components/ui/card';
import FaqPageSkeleton from '~/components/skeletons/FaqPageSkeleton';
import {SkeletonGate} from '~/components/skeletons/shared';
import {getRedirectPathFromLegacyPagePath} from '~/lib/pagePaths';

export const meta: MetaFunction = () => {
  const title = 'FAQ | Adam Underwater — Prints, Stock Footage & Underwater Photo Questions';
  const description =
    'Frequently asked questions about Adam Underwater prints, stock footage licensing, underwater photography services, shipping, and returns. Find answers about wall art, 4K video clips, and more.';

  return [
    {title},
    {name: 'title', content: title},
    {name: 'description', content: description},
    {
      tagName: 'link',
      rel: 'canonical',
      href: 'https://adamunderwater.com/faq',
    },
    {property: 'og:type', content: 'website'},
    {property: 'og:title', content: title},
    {property: 'og:description', content: description},
    {property: 'og:url', content: 'https://adamunderwater.com/faq'},
    {name: 'twitter:card', content: 'summary_large_image'},
    {name: 'twitter:title', content: title},
    {name: 'twitter:description', content: description},
  ];
};

export async function loader({request}: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const redirectPath = getRedirectPathFromLegacyPagePath(url.pathname);
  if (redirectPath) {
    throw redirect(`${redirectPath}${url.search}`, 301);
  }

  return null;
}

const faq = () => {
  const [isPageReady, setIsPageReady] = useState(false);
  const hasCalledLoad = useRef(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleFaqImgLoad = useCallback(() => {
    if (hasCalledLoad.current) return;
    hasCalledLoad.current = true;
    setIsPageReady(true);
  }, []);

  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth > 0) {
      handleFaqImgLoad();
    }
  }, [handleFaqImgLoad]);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'My desired print size is not available?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Fill out a contact form and let me know your size and I can create your custom size if it is possible.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do products ship internationally?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'My electronic products - Stock Footage, LUTS, and Sound FX are available from anywhere in the world, but at this time prints can only be shipped within the United States.',
        },
      },
      {
        '@type': 'Question',
        name: 'I purchased an Electronic product. How do I download it?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Navigate to "My Orders" and hover over "Download Links" next to your order. Each download link will appear here.',
        },
      },
      {
        '@type': 'Question',
        name: 'May I share stock footage I purchased for anyone to use publicly?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No, you may only publish clips purchased here on the specific channels you listed in the form you submit before purchasing stock footage clips. Submit a contact form if you wish to change one of more of these channels.',
        },
      },
    ],
  };

  return (
    <SkeletonGate isReady={isPageReady} skeleton={<FaqPageSkeleton />}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: JSON.stringify(faqJsonLd)}}
      />
      <section>
        <div className="flex justify-center">
          <img
            ref={imgRef}
            src={'https://downloads.adamunderwater.com/store-1-au/public/faq2.png'}
            alt="Frequently Asked Questions — Adam Underwater"
            className="pt-5 faq-header-img"
            onLoad={handleFaqImgLoad}
          />
        </div>
        <div className="flex justify-center card-container pt-5">
          <Card className="p-7 faq-card">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger>
                  My desired print size is not available?
                </AccordionTrigger>
                <AccordionContent>
                  Fill out a contact form and let me know your size and I can
                  create your custom size if it is possible.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>
                  Do products ship internationally?
                </AccordionTrigger>
                <AccordionContent>
                  My electronic products - Stock Footage, LUTS, and Sound FX are
                  available from anywhere in the world, but at this time prints
                  can only be shipped within the United States.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger>
                  I purchased an Electronic product. How do I download it?
                </AccordionTrigger>
                <AccordionContent>
                  Navigate to "My Orders" and hover over "Download Links" next
                  to your order. Each download link will appear here.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger>
                  May I share stock footage I purchased for anyone to use
                  publicly?
                </AccordionTrigger>
                <AccordionContent>
                  No, you may only publish clips purchased here on the specific
                  channels you listed in the form you submit before purchasing
                  stock footage clips. Submit a contact form if you wish to
                  change one of more of these channels. Publishing stock footage
                  purchased on Adam Underwater on an unauthorized channel will
                  be subject to copyright violation.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Card>
        </div>
      </section>
    </SkeletonGate>
  );
};

export default faq;
