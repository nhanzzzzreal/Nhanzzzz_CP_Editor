import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store';
import { useDataStore } from '../dataStore';
import { CodeEditorRef } from '../components/MonacoEditor';

export const useAutoSave = (
  editorRef: React.RefObject<CodeEditorRef>,
  isDataDirty: boolean,
  setIsDataDirty: (v: boolean) => void,
  formatLogMessage: (msg: string) => string
) => {
  const { activeFileId, unsavedFileIds, removeUnsaved, addLog } = useAppStore();
  const { globalConfig, saveFileContent, saveFileData } = useDataStore();

  const latestStateRef = useRef({ activeFileId, unsavedFileIds, isDataDirty });
  useEffect(() => { latestStateRef.current = { activeFileId, unsavedFileIds, isDataDirty }; }, [activeFileId, unsavedFileIds, isDataDirty]);

  const saveActiveFile = useCallback(() => {
    const state = latestStateRef.current;
    if (!state.activeFileId || state.activeFileId.startsWith('temp')) return;
    let saved = false;

    if (state.unsavedFileIds.has(state.activeFileId)) {
      const currentContent = editorRef.current?.getValue() || '';
      saveFileContent(state.activeFileId, currentContent);
      removeUnsaved(state.activeFileId);
      saved = true;
    }

    if (state.isDataDirty) {
      saveFileData(state.activeFileId);
      setIsDataDirty(false);
      saved = true;
    }

    if (saved) addLog(formatLogMessage(`File saved successfully.`));
    else addLog(formatLogMessage(`No changes to save.`));
  }, [removeUnsaved, saveFileContent, saveFileData, setIsDataDirty, addLog, formatLogMessage, editorRef]);

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