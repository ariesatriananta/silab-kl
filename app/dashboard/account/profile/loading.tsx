import { Skeleton } from "@/components/ui/skeleton"

export default function AccountProfileLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-36 rounded-lg" />
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-full max-w-xl" />
          </div>
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-4 w-56" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border/50 bg-card p-4 shadow-sm">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="mt-2 h-4 w-80" />

          <div className="mt-5 space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-3 w-80" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-3 w-96" />
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

