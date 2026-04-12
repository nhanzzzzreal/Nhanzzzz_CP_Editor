import React, { useState, useEffect } from 'react';
import { Play, ChevronDown, ChevronUp, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle } from 'lucide-react';
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

export const TestCaseItem = React.memo(({
  tc,
  index,
  onUpdate,
  onRemove,
  onToggle,
  onRun,
  runStatus
}: {
  tc: TestCase,
  index: number,
  onUpdate: (id: string, field: keyof TestCase, value: string) => void,
  onRemove: (id: string) => void,
  onToggle: (id: string) => void,
  onRun: (id: string) => void,
  runStatus: 'idle' | 'compiling' | 'running'
}) => {
  // State cục bộ cho các input để tránh re-render toàn bộ danh sách mỗi khi gõ
  const [localInput, setLocalInput] = useState(tc.input);
  const [localAnswer, setLocalAnswer] = useState(tc.answer);

  // Đồng bộ state cục bộ nếu prop thay đổi từ bên ngoài (ví dụ: tải từ thư mục)
  useEffect(() => {
    setLocalInput(tc.input);
  }, [tc.input]);

  useEffect(() => {
    setLocalAnswer(tc.answer);
  }, [tc.answer]);

  const handleBlur = (field: 'input' | 'answer', value: string) => {
    // Chỉ cập nhật state cha nếu giá trị thực sự thay đổi
    if (value !== tc[field]) {
      onUpdate(tc.id, field, value);
    }
  };

  return (
    <div className="relative group border-l-2 pl-4 py-1 mb-4" style={{ borderColor: getStatusColor(tc.status) }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(tc.id)}
            className="p-1 hover:bg-[#333] rounded transition-colors text-gray-400"
          >
            {tc.isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <span className="text-xs font-bold text-gray-500">#{index + 1}</span>
          <StatusBadge status={tc.status} />
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {tc.isExpanded && (
        <div className="space-y-3 animate-in fade-in duration-200 mt-2 border-t border-[#333] pt-3">
          <div>
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Input</label>
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
            <label className="block text-[10px] text-gray-500 mb-1 uppercase tracking-wider">Actual Output</label>
            <div className="w-full h-24 bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 font-mono text-xs overflow-y-auto whitespace-pre-wrap text-gray-300">
              {tc.output || <span className="text-gray-700 italic">No output</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});