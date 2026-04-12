import React from 'react';
import { Settings as SettingsIcon, X } from 'lucide-react';
import { AppSettings } from '../types';
import { cn } from '../lib/utils';

export const SettingsModal = ({ isOpen, onClose, settings, setSettings, activeFileId }: {
  isOpen: boolean,
  onClose: () => void,
  settings: AppSettings,
  setSettings: (s: AppSettings) => void,
  activeFileId: string
}) => {
  if (!isOpen) return null;

  const isPython = activeFileId.endsWith('.py');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#252526] border border-[#333] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333] bg-[#1e1e1e]">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <SettingsIcon size={18} className="text-blue-400" />
            COMPILER SETTINGS
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-[#333]">
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">Compiler Command</label>
              <input
                type="text"
                value={settings.compiler}
                onChange={(e) => setSettings({ ...settings, compiler: e.target.value })}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
              />
            </div>

            {/* ẨN OPTION NÀY NẾU LÀ PYTHON */}
            {!isPython && (
              <div>
                <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">Optimization</label>
                <select
                  value={settings.optimization}
                  onChange={(e) => setSettings({ ...settings, optimization: e.target.value as any })}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors appearance-none"
                >
                  <option value="O0">-O0 (None)</option>
                  <option value="O1">-O1 (Basic)</option>
                  <option value="O2">-O2 (Recommended)</option>
                  <option value="O3">-O3 (Max)</option>
                </select>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {/* SANBOX OPTION */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.useSandbox ?? true}
                  onChange={(e) => setSettings({ ...settings, useSandbox: e.target.checked })}
                  className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] text-blue-600 focus:ring-0"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Use Sandbox (Dọn dẹp file tự động)</span>
              </label>

              {/* FILE I/O OPTION */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={settings.useFileIO ?? true}
                  onChange={(e) => setSettings({ ...settings, useFileIO: e.target.checked })}
                  className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] text-blue-600 focus:ring-0"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">File I/O</span>
              </label>

              {/* ẨN WARNINGS NẾU LÀ PYTHON */}
              {!isPython && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.warnings}
                      onChange={(e) => setSettings({ ...settings, warnings: e.target.checked })}
                      className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] text-blue-600 focus:ring-0"
                    />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Enable Warnings (-Wall)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={settings.extraWarnings}
                      onChange={(e) => setSettings({ ...settings, extraWarnings: e.target.checked })}
                      className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] text-blue-600 focus:ring-0"
                    />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Extra Warnings (-Wextra)</span>
                  </label>
                </>
              )}
            </div>

            <div className={cn("transition-all duration-300", settings.useFileIO ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden")}>
              <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">
                I/O Filename (Optional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Default: Same as code"
                  value={settings.customFileName || ''}
                  onChange={(e) => setSettings({ ...settings, customFileName: e.target.value })}
                  className="flex-1 bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
                <div className="text-xs text-gray-500 font-mono">.inp / .out</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">Time Limit (ms)</label>
                <input
                  type="number"
                  value={settings.timeLimit}
                  onChange={(e) => setSettings({ ...settings, timeLimit: parseInt(e.target.value) })}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider flex items-center justify-between">
                  Memory Limit (MB)
                  <span className="text-red-400 text-[8px]">(Disabled)</span>
                </label>
                <input
                  type="number"
                  disabled
                  value={settings.memoryLimit}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm outline-none opacity-50 cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-[#1e1e1e] border-t border-[#333]">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};