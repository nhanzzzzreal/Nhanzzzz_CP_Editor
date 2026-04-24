import React from 'react';
import { File, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { FileNode } from '../types';
import { useAppStore } from '../store';
import { useDataStore } from '../dataStore';

interface FileTabsProps {
  setIsDataDirty: (dirty: boolean) => void;
  saveFileData: (id: string) => void;
  isDataDirty: boolean;
}

const findFileById = (id: string, nodes: FileNode[]): FileNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findFileById(id, node.children);
      if (found) return found;
    }
  }
  return null;
}

const getFileIconColor = (filename: string) => {
  if (filename.endsWith('.cpp') || filename.endsWith('.c')) return 'text-blue-400';
  if (filename.endsWith('.py')) return 'text-yellow-400';
  if (filename.endsWith('.json')) return 'text-green-400';
  if (filename.endsWith('.txt') || filename.endsWith('.inp') || filename.endsWith('.out') || filename.endsWith('.ans')) return 'text-gray-400';
  return 'text-blue-300';
};

export const FileTabs: React.FC<FileTabsProps> = React.memo(({ setIsDataDirty, saveFileData, isDataDirty }) => {
  const setOpenFileIds = useAppStore(state => state.setOpenFileIds);
  const openFileIds = useAppStore(state => state.openFileIds);
  const activeFileId = useAppStore(state => state.activeFileId);
  const unsavedFileIds = useAppStore(state => state.unsavedFileIds);
  const setActiveFileId = useAppStore(state => state.setActiveFileId);
  const closeFile = useAppStore(state => state.closeFile);
  const removeMonacoModel = useAppStore(state => state.removeMonacoModel);
  const fileTree = useDataStore(state => state.fileTree);
  const setActiveSettings = useDataStore(state => state.setActiveSettings);
  const setActiveTestcases = useDataStore(state => state.setActiveTestcases);

  const [draggedTabId, setDraggedTabId] = React.useState<string | null>(null);

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeFile(id);
    removeMonacoModel(id);
  };

  const handleTabSwitch = (id: string) => {
    if (id === activeFileId) return;
    if (activeFileId) {
      if (isDataDirty) {
        saveFileData(activeFileId);
      }
    }
    const targetCache = useDataStore.getState().fileCache[id];
    setIsDataDirty(false);
    setActiveFileId(id);
    
    if (targetCache) {
      setActiveSettings(targetCache.settings);
      setActiveTestcases(targetCache.testcases);
    } else {
      setActiveTestcases([]);
    }
  };

  return (
    <div className="flex bg-[#252526] overflow-x-auto scrollbar-none border-b border-[#333] shrink-0">
      {openFileIds.map(id => {
        const file = findFileById(id, fileTree);
        const isUnsaved = unsavedFileIds.has(id);
        if (!file) return null;
        return (
          <div
            key={id}
            draggable
            onDragStart={() => setDraggedTabId(id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!draggedTabId || draggedTabId === id) return;
              const newIds = [...openFileIds];
              const dragIndex = newIds.indexOf(draggedTabId);
              const dropIndex = newIds.indexOf(id);
              newIds.splice(dragIndex, 1);
              newIds.splice(dropIndex, 0, draggedTabId);
              setOpenFileIds(newIds);
              setDraggedTabId(null);
            }}
            onClick={() => handleTabSwitch(id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-r border-[#333] min-w-[120px] max-w-[200px] transition-colors group",
              activeFileId === id ? "bg-[#1e1e1e]" : "text-gray-500 hover:bg-[#2a2d2e] hover:text-gray-300",
              draggedTabId === id ? "opacity-50" : ""
            )}
          >
            <File size={14} className={cn(activeFileId === id ? getFileIconColor(file.name) : cn(getFileIconColor(file.name), "opacity-60"))} />
            <span className={cn("truncate flex-1", activeFileId === id ? "text-white font-medium" : "text-gray-400 group-hover:text-gray-200")}>{file.name}</span>
            <button
              onClick={(e) => closeTab(e, id)}
              className="p-0.5 rounded hover:bg-[#333]/70 transition-all text-gray-500 hover:text-gray-200"
              aria-label={`Close ${file.name}`}
            >
              {isUnsaved ? (
                <div className="w-3 h-3 flex items-center justify-center group-hover:hidden"><div className="w-1.5 h-1.5 rounded-full bg-blue-400" /></div>
              ) : null}
              <X size={12} className={cn("transition-opacity", isUnsaved ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100")} />
            </button>
          </div>
        );
      })}
    </div>
  );
});