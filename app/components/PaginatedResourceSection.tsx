import * as React from 'react';
import {Pagination} from '@shopify/hydrogen';

/**
 * <PaginatedResourceSection > is a component that encapsulate how the previous and next behaviors throughout your application.
 */
export function PaginatedResourceSection<NodesType>({
  connection,
  children,
  resourcesClassName,
}: {
  connection: React.ComponentProps<typeof Pagination<NodesType>>['connection'];
  children: (props: {node: NodesType; index: number}) => React.ReactNode;
  resourcesClassName?: string;
}) {
  return (
    <Pagination connection={connection}>
      {({nodes, isLoading, PreviousLink, NextLink}) => {
        const resourcesMarkup = nodes?.map((node, index) => {
          const resourceNode = node as {id?: string | number} | null;
          const resourceKey = resourceNode?.id ?? index;

          return (
            <React.Fragment key={resourceKey}>
              {children({node, index})}
            </React.Fragment>
          );
        });

        return (
          <>
            <PreviousLink>
              {isLoading ? 'Loading...' : <span>↑ Load previous</span>}
            </PreviousLink>
            {resourcesClassName ? <>{resourcesMarkup}</> : resourcesMarkup}
            <NextLink>
              {isLoading ? 'Loading...' : <span>Load more ↓</span>}
            </NextLink>
          </>
        );
      }}
    </Pagination>
  );
}
