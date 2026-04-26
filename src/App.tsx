import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { GripVertical, GripHorizontal } from 'lucide-react';
import { PanelGroup, Panel, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { useDebouncedCallback } from 'use-debounce';

import { useAppStore } from './store';
import { useDataStore } from './dataStore';
import { CodeEditorRef } from './components/MonacoEditor';
import { Terminal } from './components/Terminal';

import { AppHeader } from './components/layout/AppHeader';
import { LeftSidebar } from './components/layout/LeftSidebar';
import { EditorArea } from './components/layout/EditorArea';
import { RightPanel } from './components/layout/RightPanel';
import { GlobalModals } from './components/layout/GlobalModals';

import { useFileWatcher } from './hooks/useFileWatcher';
import { useAutoSave } from './hooks/useAutoSave';
import { useAppHotkeys } from './hooks/useAppHotkeys';
import { GlobalConfig } from './types';
import { useSessionStore } from './sessionStore';

const getLanguage = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.cpp') || lower.endsWith('.c') || lower.endsWith('.h') || lower.endsWith('.hpp')) return 'cpp';
  return 'plaintext';
};

export default function App() {
  const formatLogMessage = useCallback((message: string): string => {
    return `[${new Date().toLocaleTimeString([], { hour12: false })}] ${message}`;
  }, []);

  // Dùng selector để App không bị re-render khi Terminal có logs mới
  const hideContextMenu = useAppStore(state => state.hideContextMenu);
  const setTerminalOpen = useAppStore(state => state.setTerminalOpen);
  const setTreeOpen = useAppStore(state => state.setTreeOpen);

  const globalConfig = useDataStore(state => state.globalConfig);
  const fetchGlobalConfig = useDataStore(state => state.fetchGlobalConfig);
  const fetchFileTree = useDataStore(state => state.fetchFileTree);
  const saveGlobalConfig = useDataStore(state => state.saveGlobalConfig);

  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffExpected, setDiffExpected] = useState('');
  const [diffActual, setDiffActual] = useState('');
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  
  const editorRef = useRef<CodeEditorRef>(null);
  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const treePanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  
  // Use custom hooks
  useFileWatcher();
  const { saveActiveFile } = useAutoSave(editorRef, formatLogMessage);
  const { handleOpenWorkspace } = useAppHotkeys(saveActiveFile, formatLogMessage);

  useEffect(() => {
    fetchGlobalConfig();
    fetchFileTree();
  }, [fetchGlobalConfig, fetchFileTree]);

  useEffect(() => {
    const handleClick = () => hideContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [hideContextMenu]);

  const isHydrated = useRef(false);
  useEffect(() => {
    if (globalConfig && !isHydrated.current) {
      useSessionStore.getState().setOpenSessionIds(globalConfig.openFileIds || []);
      useSessionStore.getState().setActiveSessionId(globalConfig.activeFileId || '');
      isHydrated.current = true;
    }
  }, [globalConfig]);

  const debouncedSaveGlobalConfig = useDebouncedCallback((config: GlobalConfig) => {
    saveGlobalConfig(config);
  }, 1500);

  const latestConfigRef = useRef(globalConfig);
  useEffect(() => { latestConfigRef.current = globalConfig; }, [globalConfig]);

  useEffect(() => {
    let prevOpenIds = useSessionStore.getState().openSessionIds;
    let prevActiveId = useSessionStore.getState().activeSessionId;

    const unsub = useSessionStore.subscribe((state) => {
      if (state.openSessionIds !== prevOpenIds || state.activeSessionId !== prevActiveId) {
        prevOpenIds = state.openSessionIds;
        prevActiveId = state.activeSessionId;
        if (latestConfigRef.current && isHydrated.current) { 
          debouncedSaveGlobalConfig({ ...latestConfigRef.current, openFileIds: state.openSessionIds, activeFileId: state.activeSessionId });
        }
      }
    });
    return unsub;
  }, [debouncedSaveGlobalConfig]);

  const handleOpenDiff = useCallback((expected: string, actual: string) => { 
    setDiffExpected(expected); setDiffActual(actual); setIsDiffOpen(true); 
  }, []);


  const insertSnippet = (content: string) => {
    if (editorRef.current) {
      editorRef.current.insertSnippet(content);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden font-sans" onContextMenu={(e) => e.preventDefault()}>
      <AppHeader
        isRightPanelOpen={isRightPanelOpen}
        rightPanelRef={rightPanelRef}
        terminalPanelRef={terminalPanelRef}
        treePanelRef={treePanelRef}
      />

      <div className="flex-1 w-full overflow-hidden relative">
        <PanelGroup direction="vertical" className="w-full h-full">
          <Panel minSize={30} className="min-h-0">
            <PanelGroup direction="horizontal" className="w-full h-full">
              <Panel 
                ref={treePanelRef}
                defaultSize={15} 
                minSize={5} 
                collapsible={true}
                onCollapse={() => setTreeOpen(false)}
                onExpand={() => setTreeOpen(true)}
              >
                <LeftSidebar formatLogMessage={formatLogMessage} handleOpenWorkspace={handleOpenWorkspace} />
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-[#1e1e1e] hover:bg-blue-600/30 transition-colors flex items-center justify-center group relative z-10">
                <div className="w-px h-full bg-[#333] group-hover:bg-blue-400" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#252526] border border-[#333] rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={10} className="text-gray-400" />
                </div>
              </PanelResizeHandle>

              <Panel defaultSize={55} minSize={20}>
                <EditorArea
                  editorRef={editorRef}
                  saveActiveFile={saveActiveFile}
                  formatLogMessage={formatLogMessage}
                />
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-[#1e1e1e] hover:bg-blue-600/30 transition-colors flex items-center justify-center group relative z-10">
                <div className="w-px h-full bg-[#333] group-hover:bg-blue-400" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#252526] border border-[#333] rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={10} className="text-gray-400" />
                </div>
              </PanelResizeHandle>

              <Panel 
                ref={rightPanelRef}
                defaultSize={30} 
                minSize={20}
                collapsible={true}
                onCollapse={() => setIsRightPanelOpen(false)}
                onExpand={() => setIsRightPanelOpen(true)}
              >
                <RightPanel
                  editorRef={editorRef}
                  handleOpenDiff={handleOpenDiff}
                  formatLogMessage={formatLogMessage}
                  isDiffSupported={true}
                />
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-full h-1.5 bg-[#1e1e1e] hover:bg-blue-600/30 transition-colors flex items-center justify-center group relative z-10 cursor-row-resize">
            <div className="h-px w-full bg-[#333] group-hover:bg-blue-400" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#252526] border border-[#333] rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripHorizontal size={10} className="text-gray-400" />
            </div>
          </PanelResizeHandle>

          <Panel 
            ref={terminalPanelRef}
            defaultSize={20} 
            minSize={5} 
            collapsible={true}
            onCollapse={() => setTerminalOpen(false)}
            onExpand={() => setTerminalOpen(true)}
            className="w-full" 
          >
            <Terminal />
          </Panel>
        </PanelGroup>
      </div>

      <GlobalModals
        isDiffOpen={isDiffOpen}
        setIsDiffOpen={setIsDiffOpen}
        diffExpected={diffExpected}
        diffActual={diffActual}
        insertSnippet={insertSnippet}
        formatLogMessage={formatLogMessage}
      />
    </div>
  );
}