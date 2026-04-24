import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TestCase } from '../types';
import { FolderOpen, Plus, FlaskConical, Play, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { TestCaseItem } from './TestCaseItem';
import { VirtualList } from '../VirtualList';
import { useDataStore } from '../dataStore';
import { useAppStore } from '../store';
import { useCodeExecution } from '../hooks/useCodeExecution';
import { SettingsModal } from './SettingsModal';
import { TestCaseViewerModal } from './TestCaseViewerModal';
import { cn } from '../lib/utils';

const API_BASE_URL = 'http://localhost:3691/api';

interface Props {
  activeFileId: string;
  activeFile: any;
  editorRef: React.RefObject<any>;
  isFileLoading: boolean;
  setIsDataDirty: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenDiff: (expected: string, actual: string) => void;
  formatLogMessage: (msg: string) => string;
  isDiffSupported?: boolean;
}

export const TestcaseManager: React.FC<Props> = React.memo(({
  activeFileId,
  activeFile,
  editorRef,
  isFileLoading,
  setIsDataDirty,
  onOpenDiff,
  formatLogMessage,
  isDiffSupported = true
}) => {
  const {
    activeTestcases: testcases,
    setActiveTestcases: setTestcases,
    activeSettings: settings,
    setActiveSettings: setSettings,
    globalConfig,
    refreshFileData,
    updateFileCache
  } = useDataStore();

  const {
    runStatus,
    currentTestIndex,
    isSettingsOpen,
    setIsSettingsOpen,
    addLog
  } = useAppStore();

  const isPythonFile = useMemo(() => activeFileId.toLowerCase().endsWith('.py'), [activeFileId]);

  const { handleRun, runSingleTestCase } = useCodeExecution({
    activeFileId,
    activeFile,
    editorRef,
    settings,
    globalConfig,
    testcases,
    setTestcases,
    isFileLoading,
    setIsDataDirty,
    formatLogMessage
  });

  // Lift State Up: Quản lý trạng thái đóng/mở của các testcase tại đây để không bị mất khi cuộn
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());
  const [isViewTcOpen, setIsViewTcOpen] = useState(false);
  const [viewTcData, setViewTcData] = useState<TestCase | null>(null);

  const isSettingFromLoad = useRef(false);

  // Đồng bộ lại testcases từ Database sau khi chạy xong
  const prevRunStatus = useRef(runStatus);
  useEffect(() => {
    if (prevRunStatus.current !== 'idle' && runStatus === 'idle') {
      if (activeFileId && !activeFileId.startsWith('temp')) {
        refreshFileData(activeFileId, isPythonFile).then(cache => {
          if (cache && cache.testcases && cache.testcases.length > 0) {
            isSettingFromLoad.current = true;
            setTestcases(cache.testcases);
            setTimeout(() => { isSettingFromLoad.current = false; }, 50);
          }
        });
      }
    }
    prevRunStatus.current = runStatus;
  }, [runStatus, activeFileId, isPythonFile, refreshFileData, setTestcases]);

  // Khóa cờ dirty trong lúc File đang được load dữ liệu từ Server/Cache
  useEffect(() => {
    if (isFileLoading) {
      isSettingFromLoad.current = true;
    } else {
      const timer = setTimeout(() => { isSettingFromLoad.current = false; }, 100);
      return () => clearTimeout(timer);
    }
  }, [isFileLoading]);

  // Cập nhật cờ dirty khi có thay đổi từ người dùng
  useEffect(() => {
    if (isSettingFromLoad.current || isFileLoading || !activeFileId || runStatus !== 'idle') return;
    setIsDataDirty(true);
    updateFileCache(activeFileId, { settings, testcases });
  }, [settings, testcases, activeFileId, updateFileCache, runStatus, setIsDataDirty, isFileLoading]);

  // Đồng bộ data từ cache khi file thay đổi
  useEffect(() => {
    if (!activeFileId) return;
    const currentCache = useDataStore.getState().fileCache[activeFileId];
    if (currentCache) {
      isSettingFromLoad.current = true;
      setSettings(currentCache.settings);
      setTestcases(currentCache.testcases);
      setTimeout(() => { isSettingFromLoad.current = false; }, 50);
    }
  }, [activeFileId, setSettings, setTestcases]);

  const handleOpenView = useCallback((tcData: TestCase) => { 
    setViewTcData(tcData); setIsViewTcOpen(true); 
  }, []);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedCases(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addTestCase = () => {
    setTestcases(prev => [...prev, { id: crypto.randomUUID(), name: `Test ${prev.length + 1}`, input: '', answer: '', output: '', status: 'pending', time: -1, memory: -1 } as any]);
  };

  const removeTestCase = (id: string) => {
    if (testcases.length > 1) {
      setTestcases(prev => prev.filter(tc => tc.id !== id));
    } else {
      setTestcases([{ id: crypto.randomUUID(), name: 'Test 1', input: '', answer: '', output: '', status: 'pending', time: -1, memory: -1 } as any]);
    }
  };

  const updateTestCase = useCallback((id: string, field: keyof TestCase, value: string) => {
    setTestcases(prev => prev.map(tc => tc.id === id ? { ...tc, [field]: value } : tc));
    setIsDataDirty(true);
  }, [setTestcases, setIsDataDirty]);

  const handleFolderSelect = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/testcases/import-dialog`, { method: 'POST' });
      const data = await res.json();
      if (data.status === 'ok' && data.testcases && data.testcases.length > 0) {
        const loadedTestcases: TestCase[] = data.testcases.map((tc: any) => ({
          id: crypto.randomUUID(),
          name: tc.name,
          input: tc.input,
          answer: tc.answer,
          output: '',
          status: 'pending',
          time: -1,
          memory: -1
        } as TestCase));
        setTestcases(loadedTestcases);
        addLog(formatLogMessage(`Loaded ${loadedTestcases.length} testcases from folder.`));
      }
    } catch (err: any) {
      addLog(formatLogMessage(`Error importing testcases: ${err.message}`));
    }
  };

  return (
    <div className="p-4 h-full flex flex-col gap-4">
      <div className="flex items-center gap-2 w-full shrink-0">
          <button 
            onClick={handleRun}
            disabled={runStatus !== 'idle'}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-all active:scale-95 flex-1 justify-center",
              runStatus === 'idle' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-600/50 cursor-not-allowed text-gray-300"
            )}
          >
            {runStatus === 'idle' ? (
              <>
                <Play size={16} fill="currentColor" />
                Run Code
              </>
            ) : runStatus === 'compiling' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Compiling...
              </>
            ) : (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running {currentTestIndex}/{testcases.length}
              </>
            )}
          </button>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded bg-[#333] transition-colors hover:bg-[#444] text-gray-300"
            title="Compiler Settings"
          >
            <SettingsIcon size={18} />
          </button>

          <button 
            onClick={handleFolderSelect} 
            className="p-2 rounded bg-[#333] transition-colors hover:bg-[#444] text-gray-300 hover:text-blue-400" 
            title="Load from folder"
          >
            <FolderOpen size={18} />
          </button>
      </div>

      <div className="flex-1 min-h-0">
        <VirtualList
          items={testcases}
          itemHeight={50} // Lúc này đóng vai trò là chiều cao ước tính (để scrollbar đỡ giật)
          emptyMessage="Chưa có testcase nào."
          renderItem={(tc: TestCase, index: number) => (
            <div className="pr-2 pb-2">
              <TestCaseItem 
                tc={tc} 
                index={index} 
                onUpdate={updateTestCase} 
                onRemove={removeTestCase} 
                onRun={runSingleTestCase} 
                runStatus={runStatus} 
                onOpenDiff={onOpenDiff} 
                isDiffSupported={isDiffSupported} 
                onOpenView={handleOpenView} 
                isExpanded={expandedCases.has(tc.id)}
                onToggleExpand={() => handleToggleExpand(tc.id)}
              />
            </div>
          )}
          footer={
            <div className="pr-2 pt-2 pb-6">
              <button onClick={addTestCase} className="w-full py-3 border-2 border-dashed border-[#3c3c3c] rounded-lg text-gray-500 hover:text-gray-300 hover:border-[#555] transition-all flex items-center justify-center gap-2 text-sm font-medium">
                <Plus size={16} /> Add New Testcase
              </button>
            </div>
          }
        />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        isPythonFile={isPythonFile}
      />

      <TestCaseViewerModal
        isOpen={isViewTcOpen}
        onClose={() => setIsViewTcOpen(false)}
        tc={viewTcData ? (testcases.find(t => t.id === viewTcData.id) || null) : null}
        onUpdate={updateTestCase}
      />
    </div>
  );
});