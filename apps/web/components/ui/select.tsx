import * as React from "react"
import { cn } from "@/lib/utils"

/** Native <select> styled like Input; keeps keyboard and mobile behaviour for free. */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-input/30 dark:[&>option]:bg-background",
        className
      )}
      {...props}
    />
  )
}

export { Select }
