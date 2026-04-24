import React from 'react';
import { Terminal as TerminalIcon, FlaskConical, FolderTree, Settings as SettingsIcon, Scissors } from 'lucide-react';
import { useAppStore } from '../../store';
import { cn } from '../../lib/utils';
import { ImperativePanelHandle } from 'react-resizable-panels';

interface AppHeaderProps {
  isRightPanelOpen: boolean;
  rightPanelRef: React.RefObject<ImperativePanelHandle>;
  terminalPanelRef: React.RefObject<ImperativePanelHandle>;
  treePanelRef: React.RefObject<ImperativePanelHandle>;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ isRightPanelOpen, rightPanelRef, terminalPanelRef, treePanelRef }) => {
  const { 
    setIsGlobalSettingsOpen, setIsSnippetManagerOpen,
    isTerminalOpen, isTreeOpen
  } = useAppStore();

  return (
    <header className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#252526] shrink-0 z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsGlobalSettingsOpen(true)}
          className="bg-blue-600 p-1.5 rounded hover:bg-blue-700 transition-colors"
          title="Global Application Settings"
        >
          <SettingsIcon size={20} className="rotate-90" />
        </button>
        <h1 className="font-bold text-sm tracking-tight hidden sm:block">Nhanzzzz CP Editor</h1>
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setIsSnippetManagerOpen(true)}
          className="p-2 rounded transition-colors hover:bg-[#333] text-gray-400"
          title="Snippet Manager"
        >
          <Scissors size={20} />
        </button>
        <div className="w-px h-6 bg-[#333] mx-1" />
        <button 
          onClick={() => rightPanelRef.current?.isCollapsed() ? rightPanelRef.current?.expand() : rightPanelRef.current?.collapse()}
          className={cn("p-2 rounded transition-colors hover:bg-[#333]", isRightPanelOpen ? "text-blue-400 bg-[#333]" : "text-gray-400")}
          title="Toggle Testcases Panel"
        >
          <FlaskConical size={20} />
        </button>
        <button 
          onClick={() => treePanelRef.current?.isCollapsed() ? treePanelRef.current?.expand() : treePanelRef.current?.collapse()}
          className={cn("p-2 rounded transition-colors hover:bg-[#333]", isTreeOpen ? "text-blue-400 bg-[#333]" : "text-gray-400")}
          title="Toggle Folder Tree"
        >
          <FolderTree size={20} />
        </button>
        <button 
          onClick={() => terminalPanelRef.current?.isCollapsed() ? terminalPanelRef.current?.expand() : terminalPanelRef.current?.collapse()}
          className={cn("p-2 rounded transition-colors hover:bg-[#333]", isTerminalOpen ? "text-blue-400 bg-[#333]" : "text-gray-400")}
          title="Toggle Terminal"
        >
          <TerminalIcon size={20} />
        </button>
      </div>
    </header>
  );
};