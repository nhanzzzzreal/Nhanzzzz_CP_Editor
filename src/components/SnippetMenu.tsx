import React, { useState, useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';
import { Snippet } from '../types';
import { cn } from '../lib/utils';

export const SnippetMenu = ({ isOpen, onClose, snippets, onSelect }: {
  isOpen: boolean,
  onClose: () => void,
  snippets: Snippet[],
  onSelect: (content: string) => void
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = snippets.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedIndex >= filtered.length) setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        onSelect(filtered[selectedIndex].content);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/20 backdrop-blur-[1px]">
      <div className="bg-[#252526] border border-[#333] rounded-lg shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in duration-150">
        <div className="p-2 border-b border-[#333] bg-[#1e1e1e]">
          <input 
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search snippets..."
            className="w-full bg-[#252526] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
          />
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {filtered.length > 0 ? (
            filtered.map((s, i) => (
              <div 
                key={s.id}
                onClick={() => { onSelect(s.content); onClose(); }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={cn(
                  "px-3 py-2 cursor-pointer rounded text-sm flex items-center gap-3 transition-colors",
                  selectedIndex === i ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-[#2a2d2e]"
                )}
              >
                <Zap size={14} className={cn(selectedIndex === i ? "text-white" : "text-blue-400")} />
                <span className="flex-1 truncate">{s.name}</span>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-gray-500 text-xs italic">No snippets found</div>
          )}
        </div>
        <div className="px-3 py-1.5 bg-[#1e1e1e] border-t border-[#333] flex items-center justify-between text-[10px] text-gray-500 uppercase font-bold tracking-wider">
          <span>↑↓ to navigate</span>
          <span>Enter to insert</span>
        </div>
      </div>
    </div>
  );
};