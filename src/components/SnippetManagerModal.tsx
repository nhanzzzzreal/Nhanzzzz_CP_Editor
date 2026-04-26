import React, { useState } from 'react';
import { Scissors, X, Plus, Trash2 } from 'lucide-react';
import { Snippet } from '../types';
import { cn } from '../lib/utils';

const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `snippet-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export const SnippetManagerModal = ({ isOpen, onClose, snippets, onUpdate }: {
  isOpen: boolean,
  onClose: () => void,
  snippets: Snippet[],
  onUpdate: (snippets: Snippet[]) => void
}) => {
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null);

  if (!isOpen) return null;

  const addSnippet = () => {
    const newSnippet: Snippet = { id: generateId(), name: 'New Snippet', content: '' };
    onUpdate([...snippets, newSnippet]);
    setEditingSnippet(newSnippet);
  };

  const deleteSnippet = (id: string) => {
    onUpdate(snippets.filter(s => s.id !== id));
    if (editingSnippet?.id === id) setEditingSnippet(null);
  };

  const updateSnippet = (id: string, field: keyof Snippet, value: string) => {
    const newSnippets = snippets.map(s => s.id === id ? { ...s, [field]: value } : s);
    onUpdate(newSnippets);
    if (editingSnippet?.id === id) setEditingSnippet({ ...editingSnippet, [field]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#252526] border border-[#333] rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333] bg-[#1e1e1e]">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <Scissors size={18} className="text-blue-400" />
            SNIPPET MANAGER
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar: Snippet List */}
          <div className="w-64 border-r border-[#333] flex flex-col bg-[#1e1e1e]">
            <div className="p-3">
              <button 
                onClick={addSnippet}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <Plus size={14} /> NEW SNIPPET
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {snippets.map(s => (
                <div 
                  key={s.id}
                  onClick={() => setEditingSnippet(s)}
                  className={cn(
                    "px-4 py-3 cursor-pointer border-b border-[#333] transition-colors group flex items-center justify-between",
                    editingSnippet?.id === s.id ? "bg-[#37373d] text-blue-400" : "text-gray-400 hover:bg-[#2a2d2e]"
                  )}
                >
                  <span className="truncate text-sm">{s.name || 'Untitled'}</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteSnippet(s.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#444] rounded text-red-400 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Main: Editor */}
          <div className="flex-1 flex flex-col bg-[#1e1e1e]">
            {editingSnippet ? (
              <div className="flex-1 flex flex-col p-6 space-y-4">
                <div>
                  <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">Snippet Name</label>
                  <input 
                    type="text"
                    value={editingSnippet.name}
                    onChange={(e) => updateSnippet(editingSnippet.id, 'name', e.target.value)}
                    className="w-full bg-[#252526] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                    placeholder="e.g., Boilerplate"
                  />
                </div>
                <div className="flex-1 flex flex-col">
                  <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">Content</label>
                  <textarea 
                    value={editingSnippet.content}
                    onChange={(e) => updateSnippet(editingSnippet.id, 'content', e.target.value)}
                    className="flex-1 bg-[#252526] border border-[#3c3c3c] rounded p-3 font-mono text-xs focus:border-blue-500 outline-none resize-none"
                    placeholder="Paste your code here..."
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-600 italic">
                Select or create a snippet to edit
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};