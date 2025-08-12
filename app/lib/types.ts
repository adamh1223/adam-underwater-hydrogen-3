import {CurrencyCode} from '@shopify/hydrogen/customer-account-api-types';
import {PartialPredictiveSearchResult} from '~/components/SearchResultsPredictive';

export type shopifyImage = {url: string; altText: string};
interface AugmentedPartialSearchResult {
  images: {nodes: shopifyImage[]};
  title: string;
  handle: string;
  id: string;
  tags: string[];
  priceRange: {
    minVariantPrice: {amount: string; currencyCode: CurrencyCode};
    maxVariantPrice: {amount: string; currencyCode: CurrencyCode};
  };
}
export type EnhancedPartialSearchResult =
  PartialPredictiveSearchResult<'products'> & AugmentedPartialSearchResult;

export interface ProductImages {
  id: string;
  image?: {
    url: string;
    altText: string;
  };
}
