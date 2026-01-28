import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[hsl(222,30%,16%)] bg-[hsl(222,30%,12%,0.5)] px-3 py-2 text-sm text-[hsl(210,40%,96%)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-[hsl(215,20%,55%)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(187,92%,50%,0.3)] focus-visible:border-[hsl(187,92%,50%)] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
