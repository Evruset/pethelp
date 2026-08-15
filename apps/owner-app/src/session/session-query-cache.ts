import type { QueryClient, QueryKey } from '@tanstack/react-query';

const OWNER_QUERY_NAMESPACE = 'owner';

export function ownerQueryKey(cacheScope: string, ...parts: readonly unknown[]): QueryKey {
  return [OWNER_QUERY_NAMESPACE, cacheScope, ...parts];
}

export function removeOwnerSessionQueries(queryClient: QueryClient, cacheScope: string): void {
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] === OWNER_QUERY_NAMESPACE
      && query.queryKey[1] === cacheScope,
  });
}
