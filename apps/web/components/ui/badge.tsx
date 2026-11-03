import { cn } from "@/lib/utils"

function Badge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border border-transparent bg-muted px-2 text-xs font-medium whitespace-nowrap text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
