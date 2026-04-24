import { useMemo, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useAppStore } from '../store';
import { useDataStore } from '../dataStore';

export const useAppHotkeys = (
  saveActiveFile: () => void,
  formatLogMessage: (msg: string) => string
) => {
  const { activeFileId, openFile, setIsSnippetMenuOpen, addLog } = useAppStore();
  const { globalConfig, openFileDialog, fetchFileTree, openWorkspace } = useDataStore();

  const handleFileOpenClick = useCallback(async () => {
    const data = await openFileDialog();
    if (data) {
      openFile(data.path);
      addLog(formatLogMessage(`Opened file: ${data.name}`));
      fetchFileTree();
    }
  }, [openFileDialog, openFile, addLog, fetchFileTree, formatLogMessage]);

  const handleOpenWorkspace = useCallback(async () => {
    const path = await openWorkspace();
    if (path) {
      addLog(formatLogMessage(`Workspace changed to: ${path}`));
      useAppStore.getState().setOpenFileIds([]);
      useAppStore.getState().setActiveFileId('');
      useDataStore.getState().fetchFileTree();
      useDataStore.getState().fetchGlobalConfig();
    }
  }, [addLog, formatLogMessage, openWorkspace]);

  const hotkeyOptions = { preventDefault: true, enableOnFormElements: true };

  useHotkeys('mod+s', () => { if (activeFileId) saveActiveFile(); }, hotkeyOptions, [activeFileId, saveActiveFile]);
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