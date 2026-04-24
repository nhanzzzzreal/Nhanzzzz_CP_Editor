import React, { useCallback } from 'react';
import * as monaco from 'monaco-editor';
import { Loader2 } from 'lucide-react';
import { FileTabs } from '../FileTabs';
import { MonacoEditor, CodeEditorRef } from '../MonacoEditor';
import { useAppStore } from '../../store';
import { useDataStore } from '../../dataStore';
import { FileNode } from '../../types';

interface EditorAreaProps {
  editorRef: React.RefObject<CodeEditorRef>;
  isFileLoading: boolean;
  isDataDirty: boolean;
  setIsDataDirty: (dirty: boolean) => void;
  saveActiveFile: () => void;
  formatLogMessage: (msg: string) => string;
}

const getLanguage = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.cpp') || lower.endsWith('.c') || lower.endsWith('.h') || lower.endsWith('.hpp')) return 'cpp';
  return 'plaintext';
};

export const EditorArea: React.FC<EditorAreaProps> = ({
  editorRef,
  isFileLoading,
  isDataDirty,
  setIsDataDirty,
  saveActiveFile,
  formatLogMessage
}) => {
  const { activeFileId, monacoModels, addMonacoModel, openFile, addLog, unsavedFileIds, addUnsaved } = useAppStore();
  const { saveFileData } = useDataStore();

  const handleEditorChange = useCallback(() => {
    if (activeFileId && !unsavedFileIds.has(activeFileId)) addUnsaved(activeFileId);
  }, [activeFileId, unsavedFileIds, addUnsaved]);

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const content = await file.text();
      const fileId = `temp-drop-${Date.now()}-${file.name}`;
      addMonacoModel(fileId, monaco.editor.createModel(content, getLanguage(file.name), monaco.Uri.file(fileId)));
      openFile(fileId);
      addLog(formatLogMessage(`Opened ${file.name} from drag-and-drop.`));
      e.dataTransfer.clearData();
    }
  }, [addMonacoModel, openFile, addLog, formatLogMessage]);

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] overflow-hidden">
      <FileTabs setIsDataDirty={setIsDataDirty} saveFileData={saveFileData} isDataDirty={isDataDirty} />
      <div className="flex-1 relative min-h-0" onDrop={handleFileDrop} onDragOver={(e) => e.preventDefault()} onDragEnter={(e) => e.preventDefault()} onKeyDown={(e) => e.stopPropagation()}>
        {activeFileId ? (
          <>
            {isFileLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1e1e1e] text-gray-500 text-sm gap-3">
                <Loader2 size={24} className="animate-spin text-blue-500" />
                Đang tải nội dung file...
              </div>
            )}
            {monacoModels[activeFileId] && (
              <MonacoEditor ref={editorRef} onContentChange={handleEditorChange} onSave={saveActiveFile} />
            )}
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-600 italic text-sm">
            Select a file, or drop one here.
          </div>
        )}
      </div>
    </div>
  );
};