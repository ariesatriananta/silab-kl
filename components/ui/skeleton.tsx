import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-md bg-[color-mix(in_oklab,hsl(var(--muted))_92%,hsl(var(--sidebar-accent))_8%)] dark:bg-[color-mix(in_oklab,hsl(var(--muted))_95%,hsl(var(--sidebar-accent))_5%)]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
