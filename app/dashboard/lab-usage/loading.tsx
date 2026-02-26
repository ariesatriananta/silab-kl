import { Skeleton } from "@/components/ui/skeleton"

export default function LabUsageLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="h-10 w-40 rounded-xl" />
        </div>
      </div>

      <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border/40 bg-background/60 p-3">
              <div className="flex items-center gap-3">
                <Skeleton className="size-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-12" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex w-full gap-2 rounded-xl bg-muted/20 p-1 sm:w-auto sm:max-w-md">
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 flex-1 rounded-lg" />
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-52" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border/40 bg-background/60 p-4">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-3 h-3 w-1/2" />
                <div className="mt-4 space-y-2">
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                  <Skeleton className="h-10 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card shadow-sm">
        <div className="p-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <div className="border-t border-border/50 p-4">
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
