import React, { useRef, forwardRef, useImperativeHandle, useEffect, memo } from 'react';
import { GlobalConfig } from '../types';
import { useDataStore } from '../dataStore';
import { useSessionStore } from '../sessionStore';
import * as monaco from 'monaco-editor';

interface CodeEditorProps {
  onContentChange: () => void;
  onSave: () => void;
}

export interface CodeEditorRef {
  insertSnippet: (content: string) => void;
  getValue: () => string | undefined;
}

export const MonacoEditor = memo(forwardRef<CodeEditorRef, CodeEditorProps>(({
  onContentChange,
  onSave,
}, ref) => {
  const activeSessionId = useSessionStore(state => state.activeSessionId);
  const activeModel = useSessionStore(state => state.sessions[state.activeSessionId]?.model);
  const globalConfig = useDataStore(state => state.globalConfig);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const prevFileIdRef = useRef(activeSessionId);
  
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => {
    onContentChangeRef.current = onContentChange;
  }, [onContentChange]);

  useImperativeHandle(ref, () => ({
    getValue: () => editorInstanceRef.current?.getModel()?.getValue(),
    insertSnippet: (content: string) => {
      if (editorInstanceRef.current) {
        const editor = editorInstanceRef.current;
        const selection = editor.getSelection();
        if (selection) {
          const op = { range: selection, text: content, forceMoveMarkers: true };
          editor.executeEdits("snippet-insert", [op]);
        }
        editor.focus();
      }
    }
  }));

  // 1. Tự khởi tạo lõi Monaco Editor Local 100% (Khỏi lo đụng độ CDN)
  useEffect(() => {
    if (!containerRef.current) return;
    
    const editor = monaco.editor.create(containerRef.current, {
      theme: 'vs-dark',
      minimap: { enabled: false },
      fontSize: globalConfig?.editorFontSize || 14,
      padding: { top: 16 },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontFamily: globalConfig?.editorFontFamily || 'Consolas, monospace',
      cursorSmoothCaretAnimation: 'on',
      cursorBlinking: 'smooth',
      smoothScrolling: true,
    });
    
    editorInstanceRef.current = editor;
    
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current();
    });
    
    editor.onDidChangeModelContent(() => {
      onContentChangeRef.current();
    });
    
    return () => editor.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const editor = editorInstanceRef.current;
    
    if (editor) {
      if (prevFileIdRef.current && prevFileIdRef.current !== activeSessionId) {
        const viewState = editor.saveViewState();
        useSessionStore.getState().updateSession(prevFileIdRef.current, { viewState });
      }
      
      if (activeModel && editor.getModel() !== activeModel) {
        editor.setModel(activeModel);
        const viewState = useSessionStore.getState().sessions[activeSessionId]?.viewState;
        if (viewState) {
          editor.restoreViewState(viewState);
        }
        editor.focus();
      }
    }
    
    prevFileIdRef.current = activeSessionId;
  }, [activeSessionId, activeModel]);

  // 2. Cập nhật tuỳ chọn Cỡ chữ theo thời gian thực (nếu settings bị đổi)
  useEffect(() => {
    if (editorInstanceRef.current && globalConfig) {
      editorInstanceRef.current.updateOptions({
        fontSize: globalConfig.editorFontSize,
        fontFamily: globalConfig.editorFontFamily,
      });
    }
  }, [globalConfig?.editorFontSize, globalConfig?.editorFontFamily]);

  return (
    <div ref={containerRef} className="w-full h-full outline-none" />
  );
}));