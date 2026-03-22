import {redirect, type LoaderFunctionArgs} from '@shopify/remix-oxygen';

export async function loader({request}: LoaderFunctionArgs) {
  return redirect('/prints', 301);
}

export default function Collections() {
  return null;
}
