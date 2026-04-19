import React, { useState, useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expected: string;
  actual: string;
}

export const DiffViewerModal = ({ isOpen, onClose, expected, actual }: DiffViewerModalProps) => {
  const [opcodes, setOpcodes] = useState<any[]>([]);
  const [expectedLines, setExpectedLines] = useState<string[]>([]);
  const [actualLines, setActualLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      fetch('http://localhost:3691/api/diff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expected, actual })
      }).then(res => res.json())
        .then(data => {
          setOpcodes(data.opcodes || []);
          setExpectedLines(data.expected_lines || []);
          setActualLines(data.actual_lines || []);
        })
        .catch(err => console.error("Error fetching diff:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, expected, actual]);

  const handleScroll = (source: 'left' | 'right', e: React.UIEvent<HTMLDivElement>) => {
    const target = source === 'left' ? rightRef.current : leftRef.current;
    if (target) {
      target.scrollTop = e.currentTarget.scrollTop;
    }
  };

  if (!isOpen) return null;

  const renderLines = (side: 'left' | 'right') => {
    let elements: React.JSX.Element[] = [];
    
    opcodes.forEach(([tag, i1, i2, j1, j2], opcodeIndex) => {
      const startIdx = side === 'left' ? i1 : j1;

      // Sync lines length: if one side has fewer lines for this opcode, add empty filler lines
      const leftLen = i2 - i1;
      const rightLen = j2 - j1;
      const maxLen = Math.max(leftLen, rightLen);

      for (let k = 0; k < maxLen; k++) {
        let text = '';
        let lineClass = 'text-gray-300';
        let bgClass = 'bg-transparent';
        
        if (k < (side === 'left' ? leftLen : rightLen)) {
           text = side === 'left' ? expectedLines[startIdx + k] : actualLines[startIdx + k];
        } else {
           // filler
           text = '\n';
        }

        if (tag === 'replace') {
           bgClass = side === 'left' ? 'bg-green-900/30' : 'bg-red-900/30';
           lineClass = side === 'left' ? 'text-green-200' : 'text-red-200';
        } else if (tag === 'delete') {
           bgClass = side === 'left' ? 'bg-green-900/30' : 'bg-gray-800/30';
           lineClass = side === 'left' ? 'text-green-200' : 'text-gray-500';
        } else if (tag === 'insert') {
           bgClass = side === 'left' ? 'bg-gray-800/30' : 'bg-red-900/30';
           lineClass = side === 'left' ? 'text-gray-500' : 'text-red-200';
        }

        elements.push(
          <div key={`${opcodeIndex}-${k}`} className={`flex hover:bg-[#333] ${bgClass}`}>
            <div className="w-8 flex-shrink-0 text-right pr-2 select-none text-[10px] text-gray-600 border-r border-[#444] bg-[#1e1e1e] py-0.5">
               {k < (side === 'left' ? leftLen : rightLen) ? startIdx + k + 1 : ''}
            </div>
            <pre className={`m-0 px-2 py-0.5 text-xs font-mono whitespace-pre-wrap break-all flex-1 ${lineClass}`}>
              {text === '\n' || text === '' ? ' ' : text}
            </pre>
          </div>
        );
      }
    });

    return elements;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#1e1e1e] border border-[#333] rounded-xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#252526]">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <ExternalLink size={16} className="text-blue-400" />
            DIFF VIEWER
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Expected Pane */}
          <div className="flex-1 flex flex-col border-r border-[#333] w-1/2">
            <div className="px-4 py-2 bg-[#252526] border-b border-[#333] text-xs font-bold text-gray-400 uppercase tracking-wider">
              Expected Answer
            </div>
            <div 
              ref={leftRef}
              onScroll={(e) => handleScroll('left', e)}
              className="flex-1 overflow-y-auto overflow-x-hidden bg-[#1e1e1e] scrollbar-thin scrollbar-thumb-[#444]"
            >
              {loading ? <div className="p-4 text-gray-500 text-sm">Loading diff...</div> : renderLines('left')}
            </div>
          </div>

          {/* Actual Pane */}
          <div className="flex-1 flex flex-col w-1/2">
            <div className="px-4 py-2 bg-[#252526] border-b border-[#333] text-xs font-bold text-gray-400 uppercase tracking-wider">
              Actual Output
            </div>
            <div 
              ref={rightRef}
              onScroll={(e) => handleScroll('right', e)}
              className="flex-1 overflow-y-auto overflow-x-hidden bg-[#1e1e1e] scrollbar-thin scrollbar-thumb-[#444]"
            >
              {loading ? <div className="p-4 text-gray-500 text-sm">Loading diff...</div> : renderLines('right')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};