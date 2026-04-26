import React, { memo } from 'react';
import { Virtuoso } from 'react-virtuoso';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight?: number; // Giữ lại prop này để không bị lỗi Type ở các file cũ, Virtuoso tự đo nên không cần dùng tới.
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  emptyMessage?: React.ReactNode;
  overscanCount?: number;
  footer?: React.ReactNode;
}

const VirtualListInner = <T,>({
  items,
  renderItem,
  className = '',
  emptyMessage = 'No items found.',
  overscanCount = 200,
  footer,
}: VirtualListProps<T>) => {
  if (!items || items.length === 0) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-4 text-sm text-gray-500">
        <div className="mb-4">{emptyMessage}</div>
        {footer && <div className="w-full pb-2">{footer}</div>}
      </div>
    );
  }

  return (
    <Virtuoso
      className={`h-full w-full outline-none ${className}`}
      data={items}
      computeItemKey={(index, item: any) => item?.id || index}
      itemContent={(index, item) => (
        <div className="w-full [&>*]:!m-0">{renderItem(item, index)}</div>
      )}
      components={{
        Footer: footer ? () => <div className="w-full pb-2">{footer}</div> : undefined
      }}
      overscan={overscanCount}
    />
  );
};

export const VirtualList = memo(VirtualListInner) as typeof VirtualListInner;