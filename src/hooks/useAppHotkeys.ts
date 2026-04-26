import { useMemo, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAppStore } from '../store';
import { useDataStore } from '../dataStore';
import { useSessionStore } from '../sessionStore';

export const useAppHotkeys = (
  saveActiveFile: () => void,
  formatLogMessage: (msg: string) => string
) => {
  const setIsSnippetMenuOpen = useAppStore(state => state.setIsSnippetMenuOpen);
  const addLog = useAppStore(state => state.addLog);
  const openSession = useSessionStore(state => state.openSession); // Hook ổn định, ko gây re-render
  const globalConfig = useDataStore(state => state.globalConfig);
  const openFileDialog = useDataStore(state => state.openFileDialog);
  const fetchFileTree = useDataStore(state => state.fetchFileTree);
  const openWorkspace = useDataStore(state => state.openWorkspace);

  const handleFileOpenClick = useCallback(async () => {
    const data = await openFileDialog();
    if (data) {
      openSession(data.path);
      addLog(formatLogMessage(`Opened file: ${data.name}`));
      fetchFileTree();
    }
  }, [openFileDialog, openSession, addLog, fetchFileTree, formatLogMessage]);

  const handleOpenWorkspace = useCallback(async () => {
    const path = await openWorkspace();
    if (path) {
      addLog(formatLogMessage(`Workspace changed to: ${path}`));
      useSessionStore.getState().setOpenSessionIds([]);
      useSessionStore.getState().setActiveSessionId('');
      useDataStore.getState().fetchFileTree();
      useDataStore.getState().fetchGlobalConfig();
    }
  }, [addLog, formatLogMessage, openWorkspace]);

  const hotkeyOptions = { preventDefault: true, enableOnFormElements: true };

  useHotkeys('mod+s', () => { 
    const activeId = useSessionStore.getState().activeSessionId;
    if (activeId) saveActiveFile(); 
  }, hotkeyOptions, [saveActiveFile]);
  useHotkeys('mod+o', handleFileOpenClick, hotkeyOptions, [handleFileOpenClick]);
  useHotkeys('mod+shift+o', handleOpenWorkspace, hotkeyOptions, [handleOpenWorkspace]);

  const snippetShortcut = useMemo(() => {
    if (!globalConfig?.shortcuts?.snippetShortcut) return 'mod+shift+p';
    return globalConfig.shortcuts.snippetShortcut.toLowerCase().split('+')
      .map(part => part === 'ctrl' || part === 'cmd' || part === 'meta' ? 'mod' : part).join('+');
  }, [globalConfig?.shortcuts?.snippetShortcut]);

  useHotkeys(snippetShortcut, () => setIsSnippetMenuOpen(true), hotkeyOptions, [setIsSnippetMenuOpen]);

  return { handleFileOpenClick, handleOpenWorkspace };
};