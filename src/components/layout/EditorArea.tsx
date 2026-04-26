import React, { useCallback, useEffect, memo } from 'react';
import * as monaco from 'monaco-editor';
import { Loader2 } from 'lucide-react';
import { FileTabs } from '../FileTabs';
import { MonacoEditor, CodeEditorRef } from '../MonacoEditor';
import { useAppStore } from '../../store';
import { useDataStore } from '../../dataStore';
import { useSessionStore } from '../../sessionStore';

interface EditorAreaProps {
  editorRef: React.RefObject<CodeEditorRef>;
  saveActiveFile: () => void;
  formatLogMessage: (msg: string) => string;
}

const getLanguage = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.cpp') || lower.endsWith('.c') || lower.endsWith('.h') || lower.endsWith('.hpp')) return 'cpp';
  return 'plaintext';
};

export const EditorArea: React.FC<EditorAreaProps> = memo(({
  editorRef,
  saveActiveFile,
  formatLogMessage
}) => {
  const addLog = useAppStore(state => state.addLog);
  const openSessionIds = useSessionStore(state => state.openSessionIds);
  const activeSessionId = useSessionStore(state => state.activeSessionId);
  const openSession = useSessionStore(state => state.openSession);
  const updateSession = useSessionStore(state => state.updateSession);
  const initSession = useSessionStore(state => state.initSession);
  const isActiveLoading = useSessionStore(state => state.activeSessionId ? state.sessions[state.activeSessionId]?.isLoading : false);
  const loadFileData = useDataStore(state => state.loadFileData);

  const handleEditorChange = useCallback(() => {
    if (activeSessionId) {
      const session = useSessionStore.getState().sessions[activeSessionId];
      if (session && !session.isDirty) {
        updateSession(activeSessionId, { isDirty: true });
      }
    }
  }, [activeSessionId, updateSession]);

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const content = await file.text();
      const fileId = `temp-drop-${Date.now()}-${file.name}`;
      
      const uri = monaco.Uri.file(fileId);
      let model = monaco.editor.getModel(uri);
      if (!model) model = monaco.editor.createModel(content, getLanguage(file.name), uri);
      else model.setValue(content);
      
      openSession(fileId);
      initSession(fileId, model, null as any, null as any);
      addLog(formatLogMessage(`Opened ${file.name} from drag-and-drop.`));
      e.dataTransfer.clearData();
    }
  }, [openSession, initSession, addLog, formatLogMessage]);

  // Tự động load dữ liệu cho các Tab mới mở (Concurrent Loading)
  useEffect(() => {
    openSessionIds.forEach(id => {
      const session = useSessionStore.getState().sessions[id];
      if (session && session.isLoading && !session.model && !id.startsWith('temp-drop')) {
        loadFileData(id, id.toLowerCase().endsWith('.py')).then(cache => {
          const uri = monaco.Uri.file(id);
          let model = monaco.editor.getModel(uri);
          
          if (cache) {
            if (!model) model = monaco.editor.createModel(cache.content, getLanguage(id), uri);
            else model.setValue(cache.content);
            useSessionStore.getState().initSession(id, model, cache.settings, cache.testcases);
          }
          else {
            if (!model) model = monaco.editor.createModel("/* Failed to load file */", getLanguage(id), uri);
            else model.setValue("/* Failed to load file */");
            useSessionStore.getState().initSession(id, model, null as any, null as any);
          }
        });
      }
    });
  }, [openSessionIds, loadFileData, initSession]);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] overflow-hidden">
      <FileTabs />
      <div className="flex-1 relative min-h-0" onDrop={handleFileDrop} onDragOver={(e) => e.preventDefault()} onDragEnter={(e) => e.preventDefault()} onKeyDown={(e) => e.stopPropagation()}>
        {activeSessionId ? (
          <>
            {isActiveLoading && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#1e1e1e] text-gray-500 text-sm gap-3">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                Đang tải nội dung file...
              </div>
            )}
            <div className="w-full h-full">
              <MonacoEditor ref={editorRef} onContentChange={handleEditorChange} onSave={saveActiveFile} />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600 italic text-sm">
            Select a file, or drop one here.
          </div>
        )}
      </div>
    </div>
  );
});