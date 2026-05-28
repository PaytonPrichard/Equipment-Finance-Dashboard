import React from 'react';

export interface SkeletonPulseProps {
  className?: string;
}

export function SkeletonPulse({ className = '' }: SkeletonPulseProps): React.ReactElement {
  return <div className={`animate-pulse bg-white/[0.04] rounded ${className}`} />;
}

export function SkeletonPipelineCard(): React.ReactElement {
  return (
    <div className="glass-card rounded-xl p-3 space-y-2">
      <SkeletonPulse className="h-4 w-3/4 rounded-md" />
      <div className="flex gap-2">
        <SkeletonPulse className="h-5 w-8 rounded-md" />
        <SkeletonPulse className="h-5 w-16 rounded-md" />
      </div>
      <SkeletonPulse className="h-3 w-20 rounded-md" />
      <SkeletonPulse className="h-3 w-24 rounded-md" />
      <div className="flex justify-between pt-2 border-t border-white/[0.04]">
        <SkeletonPulse className="h-5 w-20 rounded-md" />
        <SkeletonPulse className="h-5 w-20 rounded-md" />
      </div>
    </div>
  );
}

export function SkeletonPipelineColumn(): React.ReactElement {
  return (
    <div className="flex-1 min-w-[160px] flex flex-col">
      <SkeletonPulse className="h-10 rounded-xl mb-2" />
      <div className="space-y-2">
        <SkeletonPipelineCard />
        <SkeletonPipelineCard />
      </div>
    </div>
  );
}

export function SkeletonPipeline(): React.ReactElement {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <SkeletonPulse className="h-4 w-28 rounded-md mb-1" />
          <SkeletonPulse className="h-3 w-40 rounded-md" />
        </div>
        <SkeletonPulse className="h-8 w-36 rounded-lg" />
      </div>
      <div className="flex gap-3" style={{ minHeight: 320 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonPipelineColumn key={i} />
        ))}
      </div>
    </div>
  );
}

export interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps): React.ReactElement {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="px-5 py-3 border-b border-white/[0.04] flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonPulse key={i} className="h-3 w-24 rounded-md" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3 border-b border-white/[0.03] flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonPulse key={j} className="h-4 w-20 rounded-md" />
          ))}
        </div>
      ))}
    </div>
  );
}
