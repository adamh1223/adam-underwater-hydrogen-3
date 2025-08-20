import React from 'react';
import {redirect, type ActionFunctionArgs} from '@shopify/remix-oxygen';
// import {json, type ActionFunction} from '@remix-run/node';
// import {Response} from '@shopify/mini-oxygen';

export const action = async ({request}: ActionFunctionArgs) => {
  const body: any = await request.json();
  const res = await fetch('https://api.courier.com/send', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer dk_prod_YD7MPFEFARMTTYM3ASDX55T6ZD08',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        to: {
          // email: orderInfo?.email,
          email: body.email,
        },
        template: 'W3H7RT1SB7MD4DH8M4Z5T6ACQPM1',
        data: {
          // orderInfo: orderInfoString,
          // fullName: orderInfo?.fullName,
          // productDescriptions,
          // bodyText,
          // orderTotal: orderTotal.toFixed(2),
          // shipping,
          // tax: tax.toFixed(2),
          // subtotal: Math.ceil(subtotal),
          // shippingDetails: shippingDetails?.address,
          clips: body.clips,
          name: body.name,
          email: body.email,
          youtube: body.youtube,
          vimeo: body.vimeo,
          instagram: body.instagram,
          tiktok: body.tiktok,
          facebook: body.facebook,
          website: body.website,
          independent: body.independent,
          advertisement: body.advertisement,
          other: body.other,
        },
        routing: {
          method: 'single',
          channels: ['email'],
        },
      },
    }),
  });
  const data = await res.json();
  return data;
};
