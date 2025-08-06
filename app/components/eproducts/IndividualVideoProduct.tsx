import {Breadcrumb} from '../ui/breadcrumb';
import {Link} from '@remix-run/react';
import {useEffect, useRef, useState} from 'react';
import {count} from 'console';
import {ChevronRightIcon} from 'lucide-react';

function IndividualVideoProduct({
  productName,
  featuredImage,
}: {
  productName: string;
  featuredImage: string | undefined;
}) {
  return (
    <>
      {/* PLUG IN EPRODUCT PREVIEW WITH DIFFERENT TYPING BELOW */}
      <div className="p-4 flex items-center justify-center">
        <img src={featuredImage} alt="" className="max-h-full object-contain" />
      </div>
    </>
  );
}
export default IndividualVideoProduct;
