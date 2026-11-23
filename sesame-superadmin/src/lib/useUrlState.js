import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filters and pagination live in the URL (`/tickets?status=open&page=2`):
 * refresh-safe, shareable, and the browser Back button works.
 */
export function useUrlState(defaults) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => {
    const result = { ...defaults };
    Object.keys(defaults).forEach((key) => {
      const value = params.get(key);
      if (value === null) return;
      result[key] = typeof defaults[key] === 'number' ? Number(value) || 0 : value;
    });
    return result;
    // defaults is a literal at the call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback((changes, { resetPage = true } = {}) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      Object.entries({ ...(resetPage && !('page' in changes) ? { page: 0 } : {}), ...changes }).forEach(([key, value]) => {
        if (value === '' || value === null || value === undefined || value === defaults[key]) next.delete(key);
        else next.set(key, String(value));
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setParams]);

  return [state, update];
}

/** Drops empty values before sending query params to the API. */
export const cleanParams = (values) => Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined));
