import React, { useMemo } from 'react';
import { cn } from '../../lib/utils';
import { TestcaseManager } from '../TestcaseManager';
import { StressTest } from '../StressTest';
import { useAppStore } from '../../store';
import { useDataStore } from '../../dataStore';
import { CodeEditorRef } from '../MonacoEditor';
import { FileNode } from '../../types';

interface RightPanelProps {
  editorRef: React.RefObject<CodeEditorRef>;
  isFileLoading: boolean;
  setIsDataDirty: React.Dispatch<React.SetStateAction<boolean>>;
  handleOpenDiff: (expected: string, actual: string) => void;
  formatLogMessage: (msg: string) => string;
  isDiffSupported: boolean;
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
};

export const RightPanel: React.FC<RightPanelProps> = ({ editorRef, isFileLoading, setIsDataDirty, handleOpenDiff, formatLogMessage, isDiffSupported }) => {
  const { activeTab, setActiveTab, activeFileId } = useAppStore();
  const { fileTree } = useDataStore();

  const activeFile = useMemo(() => findFileById(activeFileId, fileTree), [activeFileId, fileTree]);

  return (
    <div className="h-full flex flex-col bg-[#252526] overflow-hidden border-l border-[#333]">
      <div className="flex border-b border-[#333] bg-[#1e1e1e]">
        <button 
          onClick={() => setActiveTab('testcases')}
          className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2", activeTab === 'testcases' ? "border-blue-500 text-blue-400 bg-[#252526]" : "border-transparent text-gray-500 hover:text-gray-300")}
        >
          Testcases
        </button>
        <button 
          onClick={() => setActiveTab('stress')}
          className={cn("px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2", activeTab === 'stress' ? "border-blue-500 text-blue-400 bg-[#252526]" : "border-transparent text-gray-500 hover:text-gray-300")}
        >
          Stress Test
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className={cn("h-full", activeTab === 'testcases' ? 'block' : 'hidden')}>
          <TestcaseManager editorRef={editorRef} activeFileId={activeFileId} activeFile={activeFile} isFileLoading={isFileLoading} setIsDataDirty={setIsDataDirty} onOpenDiff={handleOpenDiff} formatLogMessage={formatLogMessage} isDiffSupported={isDiffSupported} />
        </div>
        <div className={cn("h-full overflow-y-auto", activeTab === 'stress' ? 'block' : 'hidden')}>
          <StressTest />
        </div>
      </div>
    </div>
  );
};