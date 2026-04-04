"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "rounded-lg p-[3px] group-data-[orientation=horizontal]/tabs:h-9 data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        default: "bg-muted isolate",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        // Base styles for a unified bar Look
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 px-4 py-2 text-sm font-bold whitespace-nowrap",
        "transition-all duration-300 rounded-none border-0",
        
        // Vertical Separators (Lines between tabs)
        "after:absolute after:right-0 after:top-1/4 after:h-1/2 after:w-[1.5px] after:bg-slate-300/80 after:content-[''] last:after:hidden",
        
        // Border Radius for the ends
        "first:rounded-l-lg last:rounded-r-lg",
        
        // Default text
        "text-slate-600 dark:text-muted-foreground",
        
        // 🔴 Hover State: Solid Red + White Text + Shadow + Lift
        "hover:bg-red-600 hover:text-white hover:z-20 hover:shadow-xl hover:-translate-y-0.5 hover:scale-[1.02] hover:after:opacity-0",
        
        // 🔵 Active State: Solid Blue + White Text + Shadow
        "data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:z-10 data-[state=active]:after:opacity-0",
        
        // Focus styles
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
        
        // Disabled
        "disabled:pointer-events-none disabled:opacity-50",
        
        // Clean up when in'line' variant
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-[state=active]:bg-transparent group-data-[variant=line]/tabs-list:after:hidden",
        
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
