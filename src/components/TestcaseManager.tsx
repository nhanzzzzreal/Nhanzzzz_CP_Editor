import React, { useState, useCallback } from 'react';
import { TestCase } from '../types';
import { FolderOpen, Plus, FlaskConical } from 'lucide-react';
import { TestCaseItem } from './TestCaseItem';
import { VirtualList } from '../VirtualList';

const API_BASE_URL = 'http://localhost:3691/api';

interface Props {
  testcases: TestCase[];
  setTestcases: React.Dispatch<React.SetStateAction<TestCase[]>>;
  runStatus: 'idle' | 'compiling' | 'running';
  runSingleTestCase: (id: string) => void;
  onOpenDiff: (expected: string, actual: string) => void;
  onOpenView: (tc: TestCase) => void;
  addLog: (msg: string) => void;
  formatLogMessage: (msg: string) => string;
  isDiffSupported?: boolean;
}

export const TestcaseManager: React.FC<Props> = React.memo(({
  testcases,
  setTestcases,
  runStatus,
  runSingleTestCase,
  onOpenDiff,
  onOpenView,
  addLog,
  formatLogMessage,
  isDiffSupported = true
}) => {
  // Lift State Up: Quản lý trạng thái đóng/mở của các testcase tại đây để không bị mất khi cuộn
  const [expandedCases, setExpandedCases] = useState<Set<string>>(new Set());

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

  const updateTestCase = (id: string, field: keyof TestCase, value: string) => {
    setTestcases(prev => prev.map(tc => tc.id === id ? { ...tc, [field]: value } : tc));
  };

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
    <div className="p-4 h-full flex flex-col gap-6">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
          <FlaskConical size={14} />
          Manage Testcases
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleFolderSelect} className="p-1.5 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" title="Load from folder">
            <FolderOpen size={16} />
          </button>
          <button onClick={addTestCase} className="p-1.5 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" title="Add testcase">
            <Plus size={16} />
          </button>
        </div>
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
                onOpenView={onOpenView} 
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
    </div>
  );
});