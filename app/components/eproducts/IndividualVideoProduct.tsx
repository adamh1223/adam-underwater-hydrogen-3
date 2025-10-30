import {Breadcrumb} from '../ui/breadcrumb';
import {Link, useRouteLoaderData} from '@remix-run/react';
import {useEffect, useRef, useState} from 'react';
import {count} from 'console';
import {ChevronRightIcon} from 'lucide-react';
import {RootLoader} from '~/root';
import '../../styles/routeStyles/work.css';

import {FaRegHeart} from 'react-icons/fa';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';

function IndividualVideoProduct({
  productName,
  featuredImage,
  WMLink,
}: {
  productName: string;
  featuredImage: string | undefined;
  WMLink: string | undefined;
}) {
  return (
    <>
      {/* PLUG IN EPRODUCT PREVIEW WITH DIFFERENT TYPING BELOW */}
      {/* <div className="px-5 flex items-center justify-center">
        <img src={featuredImage} alt="" className="max-h-full object-contain" />
      </div> */}

      <div className="clip-wrapper flex justify-center relative">
        <iframe
          className="clip"
          src={`https://player.vimeo.com/video/${WMLink}?badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479`}
          allow="autoplay; fullscreen; picture-in-picture;"
          title="Seaforestation Trailer"
        ></iframe>
        {/* Instead of this source, get the watermarked clip */}
      </div>
    </>
  );
}
export default IndividualVideoProduct;
