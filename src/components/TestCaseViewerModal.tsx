import React, { useState, useEffect, useRef } from 'react';
import { X, Maximize2, Columns, Rows } from 'lucide-react';
import { TestCase } from '../types';

const LineNumberedArea = ({ value, onChange, onBlur, readOnly, placeholder }: { value: string, onChange?: (val: string) => void, onBlur?: (val: string) => void, readOnly?: boolean, placeholder?: string }) => {
  const linesCount = Math.max(1, (value || '').split('\n').length);
  const lines = Array.from({ length: linesCount }, (_, i) => i + 1);
  const lineNumRef = useRef<HTMLDivElement>(null);

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    if (lineNumRef.current) {
      lineNumRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden bg-[#1e1e1e]">
      <div
        ref={lineNumRef}
        className="w-12 flex-shrink-0 text-right pr-3 py-4 select-none text-xs leading-5 text-gray-500 bg-[#252526] border-r border-[#333] font-mono overflow-hidden whitespace-pre"
      >
        {lines.join('\n')}
      </div>
      {readOnly ? (
         <div
           onScroll={handleScroll}
           className="flex-1 w-full min-h-0 p-4 font-mono text-xs leading-5 text-gray-300 whitespace-pre overflow-auto scrollbar-thin scrollbar-thumb-[#444]"
         >
           {value || <span className="text-gray-600 italic">No output</span>}
         </div>
      ) : (
        <textarea
          value={value}
          onChange={e => onChange?.(e.target.value)}
          onBlur={e => onBlur?.(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          wrap="off"
          placeholder={placeholder}
          className="flex-1 w-full min-h-0 bg-transparent p-4 font-mono text-xs leading-5 text-gray-300 whitespace-pre overflow-auto scrollbar-thin scrollbar-thumb-[#444] resize-none outline-none focus:ring-1 focus:ring-purple-500/50 transition-shadow"
        />
      )}
    </div>
  );
};

interface TestCaseViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tc: TestCase | null;
  onUpdate?: (id: string, field: keyof TestCase, value: string) => void;
}

export const TestCaseViewerModal = ({ isOpen, onClose, tc, onUpdate }: TestCaseViewerModalProps) => {
  const [localInput, setLocalInput] = useState('');
  const [localAnswer, setLocalAnswer] = useState('');
  const [layout, setLayout] = useState<'row' | 'col'>('row');

  useEffect(() => {
    if (isOpen && tc) {
      setLocalInput(tc.input || '');
      setLocalAnswer(tc.answer || '');
    }
  }, [isOpen, tc?.id]); // Chỉ lấy dữ liệu khi vừa mở hoặc chuyển sang testcase khác để tránh ghi đè khi đang gõ

  if (!isOpen || !tc) return null;

  const handleBlur = (field: 'input' | 'answer', value: string) => {
    if (tc && value !== tc[field] && onUpdate) {
      onUpdate(tc.id, field, value);
    }
  };

  const handleClose = () => {
    if (tc && onUpdate) {
      // Đảm bảo lưu dữ liệu cuối cùng vào state gốc trước khi đóng (Fix lỗi thao tác đóng quá nhanh)
      if (localInput !== (tc.input || '')) onUpdate(tc.id, 'input', localInput);
      if (localAnswer !== (tc.answer || '')) onUpdate(tc.id, 'answer', localAnswer);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#252526] shrink-0">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <Maximize2 size={16} className="text-purple-400" />
            TESTCASE VIEWER
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLayout(layout === 'row' ? 'col' : 'row')}
              className="flex items-center gap-1.5 text-xs font-medium bg-[#333] hover:bg-[#444] px-2.5 py-1.5 rounded text-gray-300 transition-colors"
              title="Toggle View Layout"
            >
              {layout === 'row' ? <Rows size={14} /> : <Columns size={14} />}
              {layout === 'row' ? 'View Row' : 'View Column'}
            </button>
            <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className={`flex flex-1 overflow-hidden ${layout === 'row' ? 'flex-row' : 'flex-col'}`}>
          {/* Input */}
          <div className={`flex-1 flex flex-col min-h-0 min-w-0 border-[#333] ${layout === 'row' ? 'border-r' : 'border-b'}`}>
            <div className="px-4 py-2 bg-[#252526] border-b border-[#333] text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">
              Input
            </div>
            <LineNumberedArea
              value={localInput}
              onChange={setLocalInput}
              onBlur={(val) => handleBlur('input', val)}
              placeholder="Enter input..."
            />
          </div>

          {/* Expected */}
          <div className={`flex-1 flex flex-col min-h-0 min-w-0 border-[#333] ${layout === 'row' ? 'border-r' : 'border-b'}`}>
            <div className="px-4 py-2 bg-[#252526] border-b border-[#333] text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">
              Expected Answer
            </div>
            <LineNumberedArea
              value={localAnswer}
              onChange={setLocalAnswer}
              onBlur={(val) => handleBlur('answer', val)}
              placeholder="Enter expected answer..."
            />
          </div>

          {/* Actual */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            <div className="px-4 py-2 bg-[#252526] border-b border-[#333] text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">
              Actual Output
            </div>
            <LineNumberedArea
              value={tc.output || ''}
              readOnly
            />
          </div>
        </div>
      </div>
    </div>
  );
};