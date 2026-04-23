import React, { useRef, useState, useEffect } from 'react';
import { Loader2, File, Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import { FileNode } from '../types';
import { Tree } from 'react-arborist';
import { cn } from '../lib/utils';

interface FileExplorerProps {
  fileTree: FileNode[];
  activeFileId: string;
  isLoading: boolean;
  onFileClick: (node: FileNode) => void;
  onContextMenu: (x: number, y: number, node: FileNode) => void;
  onRenameNode: (oldPath: string, oldName: string, newName?: string) => Promise<void>;
}

export const FileExplorer: React.FC<FileExplorerProps> = React.memo(({
  fileTree,
  activeFileId,
  isLoading,
  onFileClick,
  onContextMenu,
  onRenameNode,
}) => {
  const getFileIconColor = (filename: string) => {
    if (filename.endsWith('.cpp') || filename.endsWith('.c')) return 'text-blue-400';
    if (filename.endsWith('.py')) return 'text-yellow-400';
    if (filename.endsWith('.json')) return 'text-green-400';
    if (filename.endsWith('.txt') || filename.endsWith('.inp') || filename.endsWith('.out') || filename.endsWith('.ans')) return 'text-gray-400';
    return 'text-blue-300';
  };
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-xs text-gray-500 gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden outline-none">
      {dimensions.width > 0 && dimensions.height > 0 && (
        <Tree
          data={fileTree}
          width={dimensions.width}
          height={dimensions.height}
          rowHeight={24}
          indent={12}
          openByDefault={false}
          disableDrag={true}
          disableDrop={true}
        >
          {({ node, style, dragHandle }) => {
            const isFile = node.data.type === 'file';
            return (
              <div
                style={style}
                ref={dragHandle}
                className={cn(
                  "flex items-center px-2 text-[13px] cursor-pointer transition-colors group select-none outline-none",
                  activeFileId === node.data.id ? "bg-[#1e1e1e] text-blue-400" : (node.isSelected ? "bg-[#333] text-gray-200" : "hover:bg-[#2a2d2e] text-gray-400")
                )}
                onClick={() => {
                  node.select();
                  if (isFile) onFileClick(node.data);
                  else node.toggle();
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  node.select();
                  onContextMenu(e.clientX, e.clientY, node.data);
                }}
              >
                <div className="w-4 flex items-center justify-center shrink-0">
                  {!isFile && (
                    <span className="hover:bg-[#444] rounded p-0.5" onClick={(e) => { e.stopPropagation(); node.toggle(); }}>
                      {node.isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center w-4 mx-1">
                    {isFile ? <File size={14} className={activeFileId === node.data.id ? "text-blue-400" : getFileIconColor(node.data.name)} /> : (node.isOpen ? <FolderOpen size={14} className="text-gray-400" /> : <Folder size={14} className="text-gray-400" />)}
                </div>
                <span className="truncate flex-1">{node.data.name}</span>
              </div>
            );
          }}
        </Tree>
      )}
    </div>
  );
});