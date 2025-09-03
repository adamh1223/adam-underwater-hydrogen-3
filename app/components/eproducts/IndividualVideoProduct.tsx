import {Breadcrumb} from '../ui/breadcrumb';
import {Link, useRouteLoaderData} from '@remix-run/react';
import {useEffect, useRef, useState} from 'react';
import {count} from 'console';
import {ChevronRightIcon} from 'lucide-react';
import {RootLoader} from '~/root';

function IndividualVideoProduct({
  productName,
  featuredImage,
  VideoAlreadyInCart,
}: {
  productName: string;
  featuredImage: string | undefined;
  VideoAlreadyInCart: Promise<boolean | undefined> | undefined;
}) {
  return (
    <>
      {/* PLUG IN EPRODUCT PREVIEW WITH DIFFERENT TYPING BELOW */}
      <div className="px-5 flex items-center justify-center">
        <img src={featuredImage} alt="" className="max-h-full object-contain" />
      </div>
    </>
  );
}
export default IndividualVideoProduct;
