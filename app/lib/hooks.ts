import {CartReturn} from '@shopify/hydrogen';
import React, {useState} from 'react';
import {useEffect} from 'react';

export const useIsVideoInCart = (
  cart: Promise<CartReturn | null>,
  itemID: string | undefined,
) => {
  const [disableButton, setDisableButton] = useState(false);
  useEffect(() => {
    cart
      .then((cartData) => {
        if (!cartData) {
          setDisableButton(false);
        }
        const IDs = cartData?.lines.nodes
          .map((node) => {
            if (node.merchandise.product.tags?.includes('Video')) {
              return node.merchandise.id;
            }
          })
          .filter(Boolean);
        const matches = IDs?.includes(itemID ?? '');
        setDisableButton(!!matches);
        console.log(matches, 'tttt');
      })

      .catch(() => setDisableButton(false));
  }, [cart]);
  return disableButton;
};
