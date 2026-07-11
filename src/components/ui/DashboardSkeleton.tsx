import React from 'react';
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/50", className)}
      {...props}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Area Skeleton */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6 border-border/50">
        <div className="space-y-3 w-full md:w-1/2">
          <Skeleton className="h-10 w-[250px] md:w-[350px] rounded-xl" />
          <Skeleton className="h-4 w-[200px] md:w-[300px] rounded-lg" />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Skeleton className="h-10 w-[120px] rounded-xl" />
          <Skeleton className="h-10 w-[120px] rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-6 rounded-2xl border border-border/50 bg-card/40 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-[100px] rounded-lg" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
            <Skeleton className="h-8 w-[120px] rounded-xl" />
            <Skeleton className="h-3 w-[150px] rounded-lg" />
          </div>
        ))}
      </div>

      {/* Main Content Area Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="col-span-1 lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border border-border/50 bg-card/40 shadow-sm min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <Skeleton className="h-6 w-[180px] rounded-xl" />
              <Skeleton className="h-8 w-[100px] rounded-xl" />
            </div>
            <div className="space-y-4 flex-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-muted/20">
                  <Skeleton className="h-12 w-12 rounded-xl" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[40%] rounded-lg" />
                    <Skeleton className="h-3 w-[60%] rounded-lg" />
                  </div>
                  <Skeleton className="h-8 w-[80px] rounded-lg hidden sm:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Sidebar/Secondary Area Skeleton */}
        <div className="col-span-1 space-y-6">
          <div className="p-6 rounded-2xl border border-border/50 bg-card/40 shadow-sm min-h-[400px]">
             <div className="mb-6">
              <Skeleton className="h-6 w-[140px] rounded-xl" />
            </div>
            <div className="space-y-6">
               {[...Array(4)].map((_, i) => (
                 <div key={i} className="flex flex-col space-y-3">
                   <div className="flex items-center gap-3">
                     <Skeleton className="h-10 w-10 rounded-full" />
                     <div className="space-y-2">
                       <Skeleton className="h-4 w-[120px] rounded-lg" />
                       <Skeleton className="h-3 w-[80px] rounded-lg" />
                     </div>
                   </div>
                   <Skeleton className="h-16 w-full rounded-xl" />
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
