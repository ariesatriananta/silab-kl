import { Skeleton } from "@/components/ui/skeleton"

export default function UsersLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-40 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-16 w-80 rounded-xl" />
            <Skeleton className="h-10 w-36 rounded-xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-14" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex w-full gap-2 rounded-xl bg-muted/20 p-1 sm:w-auto sm:max-w-md">
          <Skeleton className="h-8 flex-1 rounded-lg" />
          <Skeleton className="h-8 flex-1 rounded-lg" />
        </div>
        <Skeleton className="h-28 rounded-xl border border-border/50 bg-card" />
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-8 w-24 rounded-full" />
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <Skeleton className="h-10 rounded-lg lg:col-span-2" />
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-10 rounded-lg" />
          </div>
        </div>
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <div className="mt-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
