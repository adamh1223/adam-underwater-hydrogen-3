import {PartialPredictiveSearchResult} from '~/components/SearchResultsPredictive';

export type shopifyImage = {url: string; altText: string};
interface AugmentedPartialSearchResult {
  images?: {nodes: shopifyImage[]};
}
export type EnhancedPartialSearchResult =
  PartialPredictiveSearchResult<'products'> & AugmentedPartialSearchResult;
