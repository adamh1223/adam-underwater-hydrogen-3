import {CartReturn} from '@shopify/hydrogen';
import {truncate} from 'fs/promises';
import React, {useState} from 'react';
import {useEffect} from 'react';

export const useIsVideoInCart = (
  itemID: string | undefined,
  cart?: Promise<CartReturn | null>,
) => {
  const [disableButton, setDisableButton] = useState(false);
  useEffect(() => {
    cart
      ?.then((cartData) => {
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

export const useIsLoggedIn = (isLoggedIn: Promise<boolean> | undefined) => {
  const [isLoggedIn2, setIsLoggedIn] = useState(false);

  useEffect(() => {
    isLoggedIn
      ?.then((loggedInValue) => {
        setIsLoggedIn(loggedInValue);
      })

      .catch(() => setIsLoggedIn(false));
  }, [isLoggedIn]);
  return isLoggedIn2;
};
