/**
 * Loading skeleton for document cards
 */
import React from 'react';

interface DocumentSkeletonProps {
  viewMode: 'grid' | 'list' | 'compact';
}

export const DocumentSkeleton: React.FC<DocumentSkeletonProps> = ({ viewMode }) => {
  if (viewMode === 'list') {
    return (
      <div className="card p-6 flex items-center animate-pulse">
        <div className="flex-1">
          <div className="h-5 skeleton rounded w-3/4 mb-3" />
          <div className="flex items-center gap-4">
            <div className="h-4 skeleton rounded w-24" />
            <div className="h-4 skeleton rounded w-20" />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <div className="h-8 w-8 skeleton rounded" />
          <div className="h-8 w-8 skeleton rounded" />
        </div>
      </div>
    );
  }

  if (viewMode === 'compact') {
    return (
      <div className="card p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 skeleton rounded w-2/3" />
          <div className="h-4 w-4 skeleton rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-6 skeleton rounded w-3/4" />
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 skeleton rounded" />
          <div className="h-4 w-4 skeleton rounded" />
        </div>
      </div>
      
      <div className="flex gap-2 mb-3">
        <div className="h-5 skeleton rounded-full w-16" />
        <div className="h-5 skeleton rounded-full w-20" />
      </div>
      
      <div className="flex items-center gap-4">
        <div className="h-4 skeleton rounded w-24" />
        <div className="h-4 skeleton rounded w-20" />
      </div>
    </div>
  );
};