import * as React from "react"

import { cn } from "@/lib/utils"

function Badge({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"span"> & {
  variant?: "default" | "secondary" | "destructive" | "outline"
}) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none transition-colors",
        variant === "default" &&
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        variant === "secondary" &&
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/80",
        variant === "destructive" &&
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20",
        variant === "outline" &&
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Badge }
