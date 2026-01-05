import { useRef, memo, ReactNode, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

interface VirtualizedListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  estimatedItemSize?: number;
  overscan?: number;
  className?: string;
  containerClassName?: string;
  getItemKey?: (item: T, index: number) => string | number;
  emptyState?: ReactNode;
  isLoading?: boolean;
  loadingState?: ReactNode;
}

function VirtualizedListComponent<T>({
  items,
  renderItem,
  estimatedItemSize = 80,
  overscan = 5,
  className,
  containerClassName,
  getItemKey,
  emptyState,
  isLoading,
  loadingState,
}: VirtualizedListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  if (isLoading && loadingState) {
    return <>{loadingState}</>;
  }

  if (items.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
      style={{ contain: "strict" }}
    >
      <div
        className={cn("relative w-full", containerClassName)}
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          const key = getItemKey 
            ? getItemKey(item, virtualRow.index) 
            : virtualRow.index;

          return (
            <div
              key={key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualizedList = memo(VirtualizedListComponent) as typeof VirtualizedListComponent;

// Hook for using virtualization in custom implementations
export function useVirtualList<T>({
  items,
  estimatedItemSize = 80,
  overscan = 5,
}: {
  items: T[];
  estimatedItemSize?: number;
  overscan?: number;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemSize,
    overscan,
  });

  return {
    parentRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
  };
}
