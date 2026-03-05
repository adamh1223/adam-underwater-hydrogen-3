import {useFetcher, type FormProps, type Fetcher} from '@remix-run/react';
import React, {useRef, useEffect} from 'react';
import type {PredictiveSearchReturn} from '~/lib/search';

type SearchFormPredictiveChildren = (args: {
  fetchResults: (event: React.ChangeEvent<HTMLInputElement>) => void;
  // goToSearch: () => void;
  inputRef: React.MutableRefObject<HTMLInputElement | null>;
  fetcher: Fetcher<PredictiveSearchReturn>;
}) => React.ReactNode;

type SearchFormPredictiveProps = Omit<FormProps, 'children'> & {
  children: SearchFormPredictiveChildren | null;
  onSubmitSearch?: (term: string) => void;
};

export const SEARCH_ENDPOINT = '/search';

/**
 *  Search form component that sends search requests to the `/search` route
 **/
export function SearchFormPredictive({
  children,
  className = 'predictive-search-form',
  onSubmitSearch,
  ...props
}: SearchFormPredictiveProps) {
  const fetcher = useFetcher<PredictiveSearchReturn>({key: 'search'});
  const inputRef = useRef<HTMLInputElement | null>(null);

  /** Handle submit (Enter key or submit button) */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    const term = inputRef.current?.value?.trim() ?? '';

    if (onSubmitSearch) {
      onSubmitSearch(term);
      if (inputRef.current) {
        inputRef.current.value = '';
        inputRef.current.blur();
      }
      return;
    }

    if (inputRef.current?.value) {
      inputRef.current.blur();
    }
  }

  /** Navigate to the search page with the current input value */
  // function goToSearch() {
  //   const term = inputRef?.current?.value;
  //   navigate(SEARCH_ENDPOINT + (term ? `?q=${term}` : ''));
  //   aside.close();
  // }

  /** Fetch search results based on the input value */
  function fetchResults(event: React.ChangeEvent<HTMLInputElement>) {
    fetcher.submit(
      {
        q: event.target.value || '',
        predictive: true,
        filters: [
          {
            tag: 'Print',
          },
        ],
      },
      {method: 'GET', action: SEARCH_ENDPOINT},
    );
  }

  // ensure the passed input has a type of search, because SearchResults
  // will select the element based on the input
  useEffect(() => {
    inputRef?.current?.setAttribute('type', 'search');
  }, []);

  if (typeof children !== 'function') {
    return null;
  }

  return (
    <fetcher.Form {...props} className={className} onSubmit={handleSubmit}>
      {children({inputRef, fetcher, fetchResults})}
    </fetcher.Form>
  );
}
