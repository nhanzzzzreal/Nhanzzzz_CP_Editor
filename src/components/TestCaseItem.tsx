import React, { useState, useEffect } from 'react';
import { Play, ChevronDown, ChevronUp, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle, GitCompare, Maximize2 } from 'lucide-react';
import { TestCase, TestStatus } from '../types';

function getStatusColor(status: TestStatus) {
  switch (status) {
    case 'AC': return '#22c55e';
    case 'WA': return '#ef4444';
    case 'TLE':
    case 'MLE': return '#9ca3af';
    case 'RE': return '#eab308';
    case 'running': return '#60a5fa';
    default: return '#333';
  }
}

function StatusBadge({ status }: { status: TestStatus }) {
  switch (status) {
    case 'AC': return <span className="flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20"><CheckCircle2 size={10} /> AC</span>;
    case 'WA': return <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20"><XCircle size={10} /> WA</span>;
    case 'TLE': return <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-400/10 px-1.5 py-0.5 rounded border border-gray-400/20"><Clock size={10} /> TLE</span>;
    case 'MLE': return <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400 bg-gray-400/10 px-1.5 py-0.5 rounded border border-gray-400/20"><Clock size={10} /> MLE</span>;
    case 'RE': return <span className="flex items-center gap-1 text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20"><AlertTriangle size={10} /> RE</span>;
    case 'running': return <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 animate-pulse bg-blue-400/10 px-1.5 py-0.5 rounded border border-blue-400/20">Running...</span>;
    default: return <span className="text-[10px] font-bold text-gray-600 bg-gray-600/10 px-1.5 py-0.5 rounded border border-gray-600/20">Pending</span>;
  }
}

const TestCaseItemComponent = ({
  tc,
  index,
  onUpdate,
  onRemove,
  onRun,
  runStatus,
  onOpenDiff,
  isDiffSupported,
  onOpenView,
  isExpanded: controlledIsExpanded,
  onToggleExpand
}: {
  tc: TestCase,
  index: number,
  onUpdate: (id: string, field: keyof TestCase, value: string) => void,
  onRemove: (id: string) => void,
  onRun: (id: string) => void,
  runStatus: 'idle' | 'compiling' | 'running',
  onOpenDiff: (expected: string, actual: string) => void,
  isDiffSupported: boolean,
  onOpenView: (tc: TestCase) => void,
  isExpanded?: boolean,
  onToggleExpand?: () => void
}) => {
  const [localIsExpanded, setLocalIsExpanded] = useState(false);
  const isExpanded = controlledIsExpanded !== undefined ? controlledIsExpanded : localIsExpanded;

  const handleToggle = () => {
    if (onToggleExpand) onToggleExpand();
    else setLocalIsExpanded(!localIsExpanded);
  };
  // CHỈ NẠP STATE NẾU ĐƯỢC EXPAND ĐỂ TRÁNH TRÀN RAM
  const [localInput, setLocalInput] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');

  useEffect(() => {
    if (isExpanded) setLocalInput(tc.input || '');
  }, [tc.input, isExpanded]);

  useEffect(() => {
    if (isExpanded) setLocalAnswer(tc.answer || '');
  }, [tc.answer, isExpanded]);

  const handleBlur = (field: 'input' | 'answer', value: string) => {
    // Chỉ cập nhật state cha nếu giá trị thực sự thay đổi
    if (value !== tc[field]) {
      onUpdate(tc.id, field, value);
    }
  };

  return (
    <div className="relative group border-l-2 pl-4 py-1 mb-1" style={{ borderColor: getStatusColor(tc.status) }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggle}
            className="p-1 hover:bg-[#333] rounded transition-colors text-gray-400"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        <span className="text-xs font-bold text-gray-500">{(tc as any).name || `#${index + 1}`}</span>
          <StatusBadge status={tc.status} />
          {tc.time !== undefined && tc.time >= 0 && tc.status !== 'pending' && tc.status !== 'running' && (
            <span className="text-xs font-mono text-gray-500">
              ({tc.status === 'TLE' ? `${tc.time}+` : tc.time}ms{tc.memory !== undefined && tc.memory >= 0 && `, ${tc.memory}MB`})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onOpenView(tc)}
          className="p-1.5 rounded hover:bg-[#333] text-gray-500 hover:text-purple-400 transition-colors"
          title="View Full Testcase"
        >
          <Maximize2 size={14} />
        </button>
          {isDiffSupported && tc.status !== 'pending' && tc.status !== 'running' && (
            <button
              onClick={() => onOpenDiff(tc.answer || '', tc.output || '')}
              className="p-1.5 rounded hover:bg-[#333] text-gray-500 hover:text-blue-400 transition-colors"
              title="View Diff"
            >
              <GitCompare size={14} />
            </button>
          )}
          <button
            onClick={() => onRun(tc.id)}
            disabled={runStatus !== 'idle'}
            className="p-1.5 rounded hover:bg-[#333] text-gray-500 hover:text-green-400 disabled:opacity-50 transition-colors"
            title="Run this testcase"
          >
            <Play size={14} fill="currentColor" />
          </button>
          <button
            onClick={() => onRemove(tc.id)}
            className="p-1.5 rounded hover:bg-[#333] text-gray-500 hover:text-red-400 transition-colors"
            title="Delete testcase"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 mt-2 border-t border-[#333] pt-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider">Input</label>
              <button
                onClick={() => onOpenView(tc)}
                className="flex items-center gap-1 text-[10px] font-bold text-purple-400 hover:text-purple-300 transition-colors bg-purple-400/10 hover:bg-purple-400/20 px-2 py-0.5 rounded border border-purple-400/20"
                title="View Full Testcase"
              >
                <Maximize2 size={10} /> View
              </button>
            </div>
            <textarea
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              onBlur={(e) => handleBlur('input', e.target.value)}
              spellCheck={false}
              wrap="off"
              className="w-full h-24 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 font-mono text-xs focus:border-blue-500 outline-none resize-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Expected Answer</label>
            <textarea
              value={localAnswer}
              onChange={(e) => setLocalAnswer(e.target.value)}
              onBlur={(e) => handleBlur('answer', e.target.value)}
              spellCheck={false}
              wrap="off"
              className="w-full h-24 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 font-mono text-xs focus:border-blue-500 outline-none resize-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[10px] text-gray-500 uppercase tracking-wider">Actual Output</label>
              {isDiffSupported && tc.status !== 'pending' && tc.status !== 'running' && (
                <button
                  onClick={() => onOpenDiff(tc.answer || '', tc.output || '')}
                  className="flex items-center gap-1 text-[10px] font-bold text-blue-400 hover:text-blue-300 transition-colors bg-blue-400/10 hover:bg-blue-400/20 px-2 py-0.5 rounded border border-blue-400/20"
                  title="View Diff"
                >
                  <GitCompare size={10} /> View Diff
                </button>
              )}
            </div>
            <textarea
              readOnly
              value={tc.output || ''}
              placeholder="No output"
              className="w-full h-24 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 font-mono text-xs text-gray-300 focus:outline-none resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// TUYỆT KỸ: Chặn React re-render nếu đối tượng Testcase không bị thay đổi dữ liệu gốc
export const TestCaseItem = React.memo(TestCaseItemComponent, (prevProps, nextProps) => {
  return prevProps.tc === nextProps.tc &&
         prevProps.index === nextProps.index &&
         prevProps.runStatus === nextProps.runStatus &&
         prevProps.isExpanded === nextProps.isExpanded;
});