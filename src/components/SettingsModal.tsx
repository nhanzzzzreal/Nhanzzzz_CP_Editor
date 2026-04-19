import React, { Dispatch, SetStateAction, useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Info } from 'lucide-react';
import { AppSettings, CppSettings, PythonSettings } from '../types'; // Import all relevant types
import { cn } from '../lib/utils';

const CHECKER_DESCRIPTIONS: Record<string, string> = {
  'fcmp.cpp': 'Compare files strictly the same',
  'hcmp.cpp': 'Compare huge integers (>64bit)',
  'lcmp.cpp': 'Compare line by line',
  'ncmp.cpp': 'Compare two 64-bit integers',
  'nyesno.cpp': 'Compare multiple YES/NO, TRUE/FALSE, 0/1',
  'yesno.cpp': 'Compare YES/NO, TRUE/FALSE, 0/1',
  'wcmp.cpp': 'Compare sequence of tokens/words',
  'rcmp4.cpp': 'Compare real numbers up to 4 decimal places',
  'rcmp6.cpp': 'Compare real numbers up to 6 decimal places',
  'rcmp9.cpp': 'Compare real numbers up to 9 decimal places',
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  setSettings: Dispatch<SetStateAction<AppSettings>>; // Corrected type to accept functional updates
  isPythonFile: boolean; // New prop to differentiate
}

export const SettingsModal = ({ isOpen, onClose, settings, setSettings, isPythonFile }: SettingsModalProps) => {
  const [availableCheckers, setAvailableCheckers] = useState<string[]>(['Ignore Trailing Space (Default)']);
  const [showCheckerInfo, setShowCheckerInfo] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('http://localhost:3691/api/checkers')
        .then(res => res.json())
        .then(data => {
          if (data.checkers) setAvailableCheckers(data.checkers);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Cast settings to the specific type for easier access
  const currentSettings = isPythonFile ? (settings as PythonSettings) : (settings as CppSettings);

  // Handle changes for common settings
  const handleCommonChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) : value),
    }) as AppSettings); // Cast back to AppSettings
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#252526] border border-[#333] rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333] bg-[#1e1e1e]">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <SettingsIcon size={18} className="text-blue-400" />
            {isPythonFile ? 'PYTHON SETTINGS' : 'C++ SETTINGS'}
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
                value={currentSettings.compiler}
                onChange={handleCommonChange} // Use common handler
                name="compiler" // Add name attribute
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[10px] text-gray-500 uppercase font-bold tracking-wider">Checker / Grader</label>
                <button 
                  onClick={() => setShowCheckerInfo(!showCheckerInfo)}
                  className="text-gray-500 hover:text-blue-400 transition-colors"
                  title="Checker Info"
                >
                  <Info size={14} />
                </button>
              </div>
              {showCheckerInfo && (
                <div className="mb-2 p-2.5 bg-[#1e1e1e] border border-[#3c3c3c] rounded text-xs text-gray-300 leading-relaxed">
                  You can add more custom checkers written with <code>testlib.h</code> by placing them in the <code>checkers</code> folder, or download standard ones from{' '}
                  <a href="https://github.com/MikeMirzayanov/testlib/tree/master/checkers" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    MikeMirzayanov/testlib
                  </a>.
                </div>
              )}
              <select
                value={(currentSettings as any).checker || 'Ignore Trailing Space (Default)'}
                onChange={handleCommonChange}
                name="checker"
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors appearance-none"
              >
                {availableCheckers.map(c => {
                  const baseName = c.replace(' (Default)', '').trim();
                  const desc = CHECKER_DESCRIPTIONS[baseName];
                  const label = desc ? `${c} - ${desc}` : c;
                  return <option key={c} value={c}>{label}</option>;
                })}
              </select>
            </div>

            {/* C++ Specific Settings */}
            {!isPythonFile && (
              <div>
                <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">Optimization</label>
                <select
                  value={(currentSettings as CppSettings).optimization}
                  onChange={handleCommonChange}
                  name="optimization"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors appearance-none"
                >
                  <option value="O0">-O0 (None)</option>
                  <option value="O1">-O1 (Basic)</option>
                  <option value="O2">-O2 (Recommended)</option>
                  <option value="O3">-O3 (Max)</option>
                </select>
              </div>
            )}

            {!isPythonFile && (
              <div>
                <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">C++ Standard</label>
                <select
                  value={(currentSettings as CppSettings).std}
                  onChange={handleCommonChange}
                  name="std"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors appearance-none"
                >
                  <option value="c++11">C++11</option>
                  <option value="c++14">C++14</option>
                  <option value="c++17">C++17</option>
                  <option value="c++20">C++20</option>
                  <option value="c++23">C++23</option>
                </select>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2">
              {/* SANBOX OPTION */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={currentSettings.useSandbox ?? true}
                  onChange={handleCommonChange}
                  name="useSandbox"
                  className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] text-blue-600 focus:ring-0"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Use Sandbox (Run in Temp folder)</span>
              </label>

              {/* FILE I/O OPTION */}
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={currentSettings.useFileIO ?? true}
                  onChange={handleCommonChange}
                  name="useFileIO"
                  className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] text-blue-600 focus:ring-0"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">File I/O</span>
              </label>

              {/* C++ Specific Warnings */}
              {!isPythonFile && (
                <>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={(currentSettings as CppSettings).warnings}
                      onChange={handleCommonChange}
                      name="warnings"
                      className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] text-blue-600 focus:ring-0"
                    />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Enable Warnings (-Wall)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={(currentSettings as CppSettings).extraWarnings}
                      onChange={handleCommonChange}
                      name="extraWarnings"
                      className="w-4 h-4 rounded border-[#3c3c3c] bg-[#1e1e1e] text-blue-600 focus:ring-0"
                    />
                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">Extra Warnings (-Wextra)</span>
                  </label>
                </>
              )}
            </div>

            <div className={cn("transition-all duration-300", currentSettings.useFileIO ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden")}>
              <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">
                I/O Filename (Optional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Default: Same as code"
                  value={currentSettings.customFileName || ''}
                  onChange={handleCommonChange}
                  name="customFileName"
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
                  value={currentSettings.timeLimit}
                  onChange={handleCommonChange}
                  name="timeLimit"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1.5 uppercase font-bold tracking-wider">
                  Memory Limit (MB)
                </label>
                <input
                  type="number"
                  value={currentSettings.memoryLimit}
                  name="memoryLimit"
                  onChange={handleCommonChange}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm focus:border-blue-500 outline-none transition-colors"
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