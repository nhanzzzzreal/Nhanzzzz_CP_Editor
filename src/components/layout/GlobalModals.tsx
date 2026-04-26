import React from 'react';
import { GlobalSettingsModal } from '../GlobalSettingsModal';
import { DiffViewerModal } from '../DiffViewerModal';
import { SnippetManagerModal } from '../SnippetManagerModal';
import { SnippetMenu } from '../SnippetMenu';
import { FilePlus, Folder } from 'lucide-react';
import { useAppStore } from '../../store';
import { useDataStore } from '../../dataStore';
import { GlobalConfig } from '../../types';
import { useTreeOperations } from '../../hooks/useTreeOperations';

interface GlobalModalsProps {
  isDiffOpen: boolean;
  setIsDiffOpen: (isOpen: boolean) => void;
  diffExpected: string;
  diffActual: string;
  insertSnippet: (content: string) => void;
  formatLogMessage: (msg: string) => string;
}

export const GlobalModals: React.FC<GlobalModalsProps> = ({
  isDiffOpen, setIsDiffOpen, diffExpected, diffActual, insertSnippet, formatLogMessage
}) => {
  const isGlobalSettingsOpen = useAppStore(state => state.isGlobalSettingsOpen);
  const setIsGlobalSettingsOpen = useAppStore(state => state.setIsGlobalSettingsOpen);
  const isSnippetManagerOpen = useAppStore(state => state.isSnippetManagerOpen);
  const setIsSnippetManagerOpen = useAppStore(state => state.setIsSnippetManagerOpen);
  const isSnippetMenuOpen = useAppStore(state => state.isSnippetMenuOpen);
  const setIsSnippetMenuOpen = useAppStore(state => state.setIsSnippetMenuOpen);
  const contextMenu = useAppStore(state => state.contextMenu);
  
  const globalConfig = useDataStore(state => state.globalConfig);
  const saveGlobalConfig = useDataStore(state => state.saveGlobalConfig);
  const { handleCreateItem, handleRenameNode, handleDeleteNode } = useTreeOperations(formatLogMessage);

  return (
    <>
      {globalConfig && <GlobalSettingsModal isOpen={isGlobalSettingsOpen} onClose={() => setIsGlobalSettingsOpen(false)} globalSettings={globalConfig} onSave={(newConfig) => saveGlobalConfig(newConfig)} />}
      <DiffViewerModal isOpen={isDiffOpen} onClose={() => setIsDiffOpen(false)} expected={diffExpected} actual={diffActual} />
      <SnippetManagerModal isOpen={isSnippetManagerOpen} onClose={() => setIsSnippetManagerOpen(false)} snippets={globalConfig?.snippets || []} onUpdate={(newSnippets) => saveGlobalConfig({ ...globalConfig, snippets: newSnippets } as GlobalConfig)} />
      <SnippetMenu isOpen={isSnippetMenuOpen} onClose={() => setIsSnippetMenuOpen(false)} snippets={globalConfig?.snippets || []} onSelect={insertSnippet} />

      {contextMenu.visible && contextMenu.node && (
        <div
          className="fixed z-50 bg-[#252526] border border-[#3c3c3c] shadow-2xl rounded py-1.5 w-48 text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.node.type === 'folder' && (
            <>
              <button
                onClick={() => handleCreateItem('file', contextMenu.node?.id)}
                className="w-full text-left px-4 py-2 hover:bg-blue-600 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <FilePlus size={14} /> File mới
              </button>
              <button
                onClick={() => handleCreateItem('folder', contextMenu.node?.id)}
                className="w-full text-left px-4 py-2 hover:bg-blue-600 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <Folder size={14} /> Thư mục mới
              </button>
              <div className="h-px bg-[#3c3c3c] my-1" />
            </>
          )}
          <button
            onClick={() => handleRenameNode(contextMenu.node!.id, contextMenu.node!.name)}
            className="w-full text-left px-4 py-2 hover:bg-[#333] text-gray-300 hover:text-white transition-colors"
          >
            Đổi tên (Rename)
          </button>
          <div className="h-px bg-[#3c3c3c] my-1" />
          <button onClick={handleDeleteNode} className="w-full text-left px-4 py-2 hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors">
            Xóa (Delete)
          </button>
        </div>
      )}
    </>
  );
};