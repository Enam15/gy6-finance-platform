/**
 * Instant navigation feedback. Because every page is server-rendered with
 * live DB data, this Suspense fallback shows immediately on navigation while
 * the page's data is fetched, instead of a blank wait.
 */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6 py-10">
      <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}
