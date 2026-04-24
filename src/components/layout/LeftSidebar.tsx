import React, { useCallback } from 'react';
import { FolderOpen, FilePlus, Folder, FolderTree, Loader2 } from 'lucide-react';
import { useAppStore } from '../../store';
import { useDataStore } from '../../dataStore';
import { FileExplorer } from '../FileExplorer';
import { useTreeOperations } from '../../hooks/useTreeOperations';
import { FileNode } from '../../types';

interface LeftSidebarProps {
  formatLogMessage: (msg: string) => string;
  handleOpenWorkspace: () => void;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({ formatLogMessage, handleOpenWorkspace }) => {
  const { activeFileId, openFile, showContextMenu } = useAppStore();
  const { fileTree, isFileTreeLoading, fetchFileTree } = useDataStore();
  const { handleCreateItem, handleRenameNode, handleDeleteNode } = useTreeOperations(formatLogMessage);

  const handleFileClick = useCallback(async (node: FileNode) => {
    if (node.type === 'file') openFile(node.id);
  }, [openFile]);

  return (
    <div className="h-full flex flex-col bg-[#252526] border-r border-[#333] overflow-hidden">
      <div className="flex items-center justify-between pl-3 pr-2 py-2 border-b border-[#333] bg-[#1e1e1e] shrink-0">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Explorer</div>
        <div className="flex items-center gap-1">
          <button onClick={handleOpenWorkspace} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" title="Open Workspace Folder">
            <FolderOpen size={14} />
          </button>
          <button onClick={() => handleCreateItem('file')} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" title="New File">
            <FilePlus size={14} />
          </button>
          <button onClick={() => handleCreateItem('folder')} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" title="New Folder">
            <Folder size={14} />
          </button>
          <button onClick={() => fetchFileTree()} className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" title="Refresh Tree">
            <FolderTree size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2 rct-dark">
        {isFileTreeLoading ? (
          <div className="flex items-center justify-center h-full text-xs text-gray-500 gap-2">
            <Loader2 size={14} className="animate-spin" /> Loading...
          </div>
        ) : fileTree.length > 0 ? (
          <FileExplorer
            fileTree={fileTree}
            activeFileId={activeFileId}
            isLoading={isFileTreeLoading}
            onFileClick={handleFileClick}
            onContextMenu={showContextMenu}
            onRenameNode={handleRenameNode}
          />
        ) : <div className="text-center text-xs text-gray-600 p-4">Workspace is empty.</div>}
      </div>
    </div>
  );
};