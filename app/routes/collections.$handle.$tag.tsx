import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';

export async function loader({params}: LoaderFunctionArgs) {
  const {handle} = params;
  if (!handle) {
    return redirect('/collections');
  }

  return redirect(`/collections/${handle}`);
}

export default function CollectionTagRedirect() {
  return null;
}