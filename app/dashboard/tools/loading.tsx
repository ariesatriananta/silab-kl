import { Skeleton } from "@/components/ui/skeleton"

export default function ToolsLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-xl" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap gap-2">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-36 rounded-xl" />
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card shadow-sm">
        <div className="p-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
        </div>
        <div className="border-t border-border/50 p-4 space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
