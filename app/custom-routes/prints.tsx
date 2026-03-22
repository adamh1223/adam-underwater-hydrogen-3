import type {LoaderFunctionArgs} from '@shopify/remix-oxygen';
import CollectionRoute, {
  loader as collectionLoader,
  meta as collectionMeta,
} from '../routes/collections.$handle';

export const meta = collectionMeta;

export async function loader(args: LoaderFunctionArgs) {
  return collectionLoader({
    ...args,
    params: {
      ...args.params,
      handle: 'prints',
    },
  });
}

export default CollectionRoute;
