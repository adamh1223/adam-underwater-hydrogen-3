import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';
import {getCollectionPathByHandle} from '~/lib/collectionPaths';

export async function loader({params, request}: LoaderFunctionArgs) {
  const {handle} = params;
  if (!handle) {
    return redirect('/prints', 301);
  }

  const url = new URL(request.url);
  return redirect(`${getCollectionPathByHandle(handle)}${url.search}`, 301);
}

export default function CollectionTagRedirect() {
  return null;
}
