import React, { useCallback } from 'react';
import { useAppStore } from '../store';
import { TestCase, AppSettings, GlobalConfig, FileNode } from '../types';
import { CodeEditorRef } from '../components/MonacoEditor';

interface UseCodeExecutionProps {
  activeFileId: string;
  activeFile: FileNode | null;
  editorRef: React.RefObject<CodeEditorRef>;
  settings: AppSettings;
  globalConfig?: GlobalConfig;
  testcases: TestCase[];
  setTestcases: React.Dispatch<React.SetStateAction<TestCase[]>>;
  isFileLoading: boolean;
  setIsDataDirty: (dirty: boolean) => void;
  formatLogMessage: (msg: string) => string;
}

const API_BASE_URL = 'http://localhost:3691/api';

export const useCodeExecution = ({
  activeFileId,
  activeFile,
  editorRef,
  settings,
  globalConfig,
  testcases,
  setTestcases,
  isFileLoading,
  setIsDataDirty,
  formatLogMessage,
}: UseCodeExecutionProps) => {
  const addLog = useAppStore(state => state.addLog);
  const setRunStatus = useAppStore(state => state.setRunStatus);
  const setCurrentTestIndex = useAppStore(state => state.setCurrentTestIndex);

  const runSingleTestCase = useCallback(async (id: string) => {
    if (isFileLoading) {
      addLog('⏳ Vui lòng chờ testcases tải xong trước khi chạy...');
      return;
    }
    const tc = testcases.find(t => t.id === id);
    if (!tc) return;

    const codeToRun = editorRef.current?.getValue();
    if (!activeFile || codeToRun === undefined) {
      addLog('Lỗi: Không có file hoặc nội dung code để chạy.');
      return;
    }

    const isPython = (settings as any)?.compiler?.toLowerCase().includes('python') || false;
    setRunStatus(isPython ? 'running' : 'compiling');
    addLog(`Running single testcase #${testcases.findIndex(t => t.id === id) + 1}...`);
    setTestcases(prev => prev.map(t => t.id === id ? { ...t, status: 'running', output: '', time: undefined } : t));

    try {
      const response = await fetch(`${API_BASE_URL}/run/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activeFileId,
          code: codeToRun,
          testcases: testcases,
          targetTestcaseId: id,
          settings: settings,
          globalConfig: globalConfig,
        })
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; 
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; 
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'compile_finish') {
              setRunStatus('running');
              if (data.log) addLog(formatLogMessage(`Compiler Log:\n${data.log}`));
            } else if (data.type === 'test_result') {
              const res = data.result;
              setTestcases(prev => prev.map(t => {
                if (t.id !== res.id) return t;                    
                if (res.status !== 'AC') addLog(formatLogMessage(`> Single Testcase FAILED. Status: ${res.status}. Time: ${res.time}ms.`));
                return { ...t, 
                  output: res.output,
                  status: res.status,
                  time: res.time,
                  memory: res.memory};
              }));
              addLog(`Single testcase finished.`);
            } else if (data.type === 'results_saved') {
              // App.tsx handles re-fetching after runStatus changes to idle
            }
          } catch (e) {
            console.error("JSON parse error:", e, line);
          }
        }
      }
    } catch (error: any) {
      addLog(formatLogMessage(`Error running testcase: ${error.message}`));
      setTestcases(prev => prev.map(t => t.id === id ? { ...t, status: 'RE', output: `Client Error: ${error.message}` } : t));
    } finally {
      setRunStatus('idle');
    }
  }, [isFileLoading, testcases, editorRef, activeFile, settings, setRunStatus, addLog, setTestcases, activeFileId, globalConfig, formatLogMessage]);

  const handleRun = useCallback(async () => {
    if (isFileLoading) {
      addLog(formatLogMessage('⏳ Vui lòng chờ testcases tải xong trước khi chạy...'));
      return;
    }    
    const codeToRun = editorRef.current?.getValue();
    if (!activeFile || codeToRun === undefined) {
      addLog(formatLogMessage('Lỗi: Không có file hoặc nội dung code để chạy.'));
      return;
    }
    setTestcases(prev => prev.map(tc => ({ ...tc, status: 'pending', output: '', time: -1, memory: -1 })));
    setCurrentTestIndex(0);
    const isPython = (settings as any)?.compiler?.toLowerCase().includes('python') || false;
    setRunStatus(isPython ? 'running' : 'compiling');
    addLog(formatLogMessage(`Starting execution... (Syncing data with server)`));
    setIsDataDirty(false);

    try {
      const response = await fetch(`${API_BASE_URL}/run/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: activeFileId, code: codeToRun, testcases, settings, globalConfig,
        })
      });
      
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = ''; let completedTests = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'compile_finish') {
              setRunStatus('running');
              if (data.log && data.log.trim() !== '') setTestcases(prev => prev.map(tc => ({...tc, status: 'CE'})));
            } else if (data.type === 'test_result') {
              const res = data.result;
              setTestcases(prev => prev.map(tc => tc.id === res.id ? { ...tc, output: res.output, status: res.status, time: res.time, memory: res.memory } : tc));
              completedTests++; setCurrentTestIndex(completedTests);
            } else if (data.type === 'results_saved') {
              // App.tsx handles re-fetching after runStatus changes to idle
            } else if (data.type === 'log') {
              addLog(formatLogMessage(data.log));
            } else if (data.type === 'run_aborted') {
              setRunStatus('idle'); setTestcases(prev => prev.map(tc => ({...tc, status: 'RE'})));
            }
          } catch (e) {}
        }
      }
      addLog(formatLogMessage('Execution finished.'));
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    } finally {
      setRunStatus('idle');
    }
  }, [isFileLoading, editorRef, activeFile, setTestcases, setCurrentTestIndex, settings, setRunStatus, addLog, formatLogMessage, setIsDataDirty, activeFileId, globalConfig, testcases]);

  return { runSingleTestCase, handleRun };
};