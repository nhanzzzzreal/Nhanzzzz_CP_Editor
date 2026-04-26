import React, { useMemo, startTransition, useCallback } from 'react';
import { File, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { FileNode } from '../types';
import { useAppStore } from '../store';
import { useDataStore } from '../dataStore';
import { useSessionStore } from '../sessionStore';

const getFileIconColor = (filename: string) => {
  if (filename.endsWith('.cpp') || filename.endsWith('.c')) return 'text-blue-400';
  if (filename.endsWith('.py')) return 'text-yellow-400';
  if (filename.endsWith('.json')) return 'text-green-400';
  if (filename.endsWith('.txt') || filename.endsWith('.inp') || filename.endsWith('.out') || filename.endsWith('.ans')) return 'text-gray-400';
  return 'text-blue-300';
};

// TÁCH COMPONENT: Giúp mỗi Tab tự quản lý State re-render độc lập
const TabItem = React.memo(({ id, file, activeSessionId, setDraggedTabId, draggedTabId, handleDropTab, handleTabSwitch, closeTab }: any) => {
  // Chỉ lắng nghe đúng isDirty của bản thân nó
  const isUnsaved = useSessionStore(state => state.sessions[id]?.isDirty);
  const isActive = activeSessionId === id;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', id);
        setDraggedTabId(id);
      }}
      onDragEnd={() => setDraggedTabId(null)}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const sourceId = e.dataTransfer.getData('text/plain') || draggedTabId;
        if (sourceId) {
          handleDropTab(sourceId, id);
        }
        setDraggedTabId(null);
      }}
      onClick={() => handleTabSwitch(id)}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-[#2d2d2d] min-w-[100px] max-w-[200px] transition-all group relative",
        isActive ? "bg-[#1e1e1e] text-white" : "bg-[#2d2d2d] text-gray-400 hover:bg-[#252526]",
        draggedTabId === id ? "opacity-50" : ""
      )}
    >
      {/* VS Code Style: Viền trên cùng màu xanh cho tab active */}
      {isActive && <div className="absolute top-0 left-0 right-0 h-[2px] bg-blue-500" />}
      
      <File size={13} className={isActive ? getFileIconColor(file.name) : cn(getFileIconColor(file.name), "opacity-80")} />
      <span className="truncate flex-1 font-medium">{file.name}</span>
      
      <button onClick={(e) => closeTab(e, id)} className="p-0.5 rounded hover:bg-[#444] transition-all text-gray-500 hover:text-gray-200 ml-1">
        {isUnsaved ? <div className="w-3 h-3 flex items-center justify-center group-hover:hidden"><div className="w-2 h-2 rounded-full bg-blue-400" /></div> : null}
        <X size={13} className={cn("transition-opacity", isUnsaved ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100")} />
      </button>
    </div>
  );
});

export const FileTabs: React.FC = React.memo(() => {
  const openSessionIds = useSessionStore(state => state.openSessionIds);
  const activeSessionId = useSessionStore(state => state.activeSessionId);
  const setActiveSessionId = useSessionStore(state => state.setActiveSessionId);
  const closeSession = useSessionStore(state => state.closeSession);
  const fileTree = useDataStore(state => state.fileTree);
  const saveFileData = useDataStore(state => state.saveFileData);
  const removeFileCache = useDataStore(state => state.removeFileCache);

  const [draggedTabId, setDraggedTabId] = React.useState<string | null>(null);

  // Logic kéo thả được đóng gói an toàn và ổn định
  const handleDropTab = useCallback((draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const sessionStore = useSessionStore.getState();
    const newIds = [...sessionStore.openSessionIds];
    const dragIndex = newIds.indexOf(draggedId);
    const dropIndex = newIds.indexOf(targetId);
    if (dragIndex === -1 || dropIndex === -1) return;
    
    newIds.splice(dragIndex, 1);
    newIds.splice(dropIndex, 0, draggedId);
    sessionStore.setOpenSessionIds(newIds);
  }, []);

  // Tra cứu Map thay vì đệ quy O(N)
  const fileMap = useMemo(() => {
    const map = new Map<string, FileNode>();
    const traverse = (nodes: FileNode[]) => {
      for (const node of nodes) {
        map.set(node.id, node);
        if (node.children) traverse(node.children);
      }
    };
    traverse(fileTree);
    return map;
  }, [fileTree]);

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeSession(id);
    removeFileCache(id); // Dọn sạch nội dung File khỏi RAM
  };

  const handleTabSwitch = (id: string) => {
    if (id === activeSessionId) return;
    if (activeSessionId) {
       const prevSession = useSessionStore.getState().sessions[activeSessionId];
       if (prevSession?.isDirty) {
          saveFileData(activeSessionId); 
       }
    }
    startTransition(() => {
      setActiveSessionId(id);
    });
  };

  return (
    <div className="flex bg-[#252526] overflow-x-auto scrollbar-none border-b border-[#2d2d2d] shrink-0">
      {openSessionIds.map(id => {
        const file = fileMap.get(id) || { name: id.split('/').pop() || id, id, type: 'file' };
        if (!file) return null;
        return (
          <TabItem 
            key={id} id={id} file={file} 
            activeSessionId={activeSessionId} 
            setDraggedTabId={setDraggedTabId} draggedTabId={draggedTabId} 
            handleDropTab={handleDropTab}
            handleTabSwitch={handleTabSwitch} closeTab={closeTab} 
          />
        );
      })}
    </div>
  );
});