import React, { memo } from 'react';
import { cn } from '../../lib/utils';
import { TestcaseManager } from '../TestcaseManager';
import { StressTest } from '../StressTest';
import { useAppStore } from '../../store';
import { CodeEditorRef } from '../MonacoEditor';
import { useSessionStore } from '../../sessionStore';

interface RightPanelProps {
  editorRef: React.RefObject<CodeEditorRef>;
  handleOpenDiff: (expected: string, actual: string) => void;
  formatLogMessage: (msg: string) => string;
  isDiffSupported: boolean;
}

export const RightPanel: React.FC<RightPanelProps> = memo(({ editorRef, handleOpenDiff, formatLogMessage, isDiffSupported }) => {
  const activeTab = useAppStore(state => state.activeTab);
  const setActiveTab = useAppStore(state => state.setActiveTab);
  const activeSessionId = useSessionStore(state => state.activeSessionId);
  const openSessionIds = useSessionStore(state => state.openSessionIds);

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

      <div className="flex-1 overflow-hidden relative">
        <div className={cn("absolute inset-0", activeTab === 'testcases' ? 'block' : 'hidden')}>
          {openSessionIds.map(id => (
            <div
              key={id}
              className="absolute inset-0 bg-[#252526]"
              style={{
                visibility: activeSessionId === id ? 'visible' : 'hidden',
                zIndex: activeSessionId === id ? 10 : 0,
                pointerEvents: activeSessionId === id ? 'auto' : 'none'
              }}
            >
              <TestcaseManager editorRef={editorRef} sessionId={id} onOpenDiff={handleOpenDiff} formatLogMessage={formatLogMessage} isDiffSupported={isDiffSupported} />
            </div>
          ))}
          {openSessionIds.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">Select a file to view testcases</div>
          )}
        </div>
        <div className={cn("absolute inset-0 overflow-y-auto", activeTab === 'stress' ? 'block' : 'hidden')}>
          <StressTest />
        </div>
      </div>
    </div>
  );
});