/*
|--------------------------------------------------------------------------
| Home Data Cache Manager
|--------------------------------------------------------------------------
| Manages cache invalidation for HomeScreen data.
| Call invalidateHomeCache() after scan or cleanup to force reload.
*/

let shouldInvalidate = false;

/**
 * Invalidate home screen cache
 * Call this after completing a scan or cleanup
 */
export const invalidateHomeCache = () => {
  shouldInvalidate = true;
};

/**
 * Check if cache should be invalidated
 */
export const shouldInvalidateHomeCache = (): boolean => {
  return shouldInvalidate;
};

/**
 * Reset invalidation flag
 */
export const resetInvalidationFlag = () => {
  shouldInvalidate = false;
};

export default {
  invalidateHomeCache,
  shouldInvalidateHomeCache,
  resetInvalidationFlag,
};
