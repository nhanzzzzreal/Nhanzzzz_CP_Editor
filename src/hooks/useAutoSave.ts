import React, { useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { useDataStore } from '../dataStore';
import { useSessionStore } from '../sessionStore';
import { CodeEditorRef } from '../components/MonacoEditor';

export const useAutoSave = (
  editorRef: React.RefObject<CodeEditorRef>,
  formatLogMessage: (msg: string) => string
) => {
  const addLog = useAppStore(state => state.addLog);
  const globalConfig = useDataStore(state => state.globalConfig);
  const saveFileContent = useDataStore(state => state.saveFileContent);
  const saveFileData = useDataStore(state => state.saveFileData);

  const saveActiveFile = useCallback(() => {
    const activeSessionId = useSessionStore.getState().activeSessionId;
    if (!activeSessionId || activeSessionId.startsWith('temp')) return;

    const session = useSessionStore.getState().sessions[activeSessionId];
    if (!session?.isDirty) {
      addLog(formatLogMessage(`No changes to save.`));
      return;
    }

    const currentContent = editorRef.current?.getValue() || '';
    saveFileContent(activeSessionId, currentContent);
    saveFileData(activeSessionId);
    
    useSessionStore.getState().updateSession(activeSessionId, { isDirty: false });
    addLog(formatLogMessage(`File saved successfully.`));
  }, [saveFileContent, saveFileData, addLog, formatLogMessage, editorRef]);

  useEffect(() => {
    const delay = globalConfig?.autoSaveDelay || 10000;
    if (delay <= 0) return;

    const timer = setInterval(() => {
      saveActiveFile();
    }, delay);
    return () => clearInterval(timer);
  }, [globalConfig?.autoSaveDelay, saveActiveFile]);

  return { saveActiveFile };
};