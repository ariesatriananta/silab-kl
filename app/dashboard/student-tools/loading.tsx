import { Skeleton } from "@/components/ui/skeleton"

export default function StudentToolsLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-8 w-20 rounded-full" />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_220px_220px]">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <div className="rounded-xl border border-border/40 bg-background/60 p-3">
              <Skeleton className="h-32 rounded-xl" />
            </div>
            <Skeleton className="mt-4 h-4 w-3/4" />
            <Skeleton className="mt-2 h-3 w-1/2" />
            <div className="mt-3 flex items-center gap-2">
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
