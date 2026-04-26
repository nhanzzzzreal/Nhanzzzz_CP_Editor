import React from 'react';
import { Settings, X } from 'lucide-react';
import { GlobalConfig } from '../types';

const InputGroup = ({ label, description, children }: { label: string, description?: string, children: React.ReactNode }) => (
  <div>
    <label className="block text-sm font-medium text-gray-300 mb-1.5">{label}</label>
    {children}
    {description && <p className="text-xs text-gray-500 mt-1.5">{description}</p>}
  </div>
);

export const GlobalSettingsModal = ({ isOpen, onClose, globalSettings, onSave }: {
  isOpen: boolean,
  onClose: () => void,
  globalSettings: GlobalConfig,
  onSave: (config: GlobalConfig) => void
}) => {
  const [config, setConfig] = React.useState(globalSettings);

  React.useEffect(() => {
    setConfig(globalSettings);
  }, [globalSettings, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(config);
    onClose();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setConfig(prevConfig => ({
      ...prevConfig,
      // Xử lý trường hợp lồng nhau cho 'shortcuts'
      ...(name.startsWith('shortcuts.')
        ? {
            shortcuts: {
              ...prevConfig.shortcuts,
              [name.split('.')[1]]: value,
            },
          } : { [name]: type === 'number' ? Number(value) : value }),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#252526] border border-[#333] rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#333]">
          <div className="flex items-center gap-2 font-bold text-sm tracking-wide">
            <Settings size={18} className="text-blue-400" />
            GLOBAL SETTINGS
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputGroup label="G++ Path" description="Đường dẫn đến trình biên dịch g++.">
              <input
                type="text"
                name="gppPath"
                value={config.gppPath}
                onChange={handleChange}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </InputGroup>
            <InputGroup label="Python Path" description="Đường dẫn đến trình thông dịch Python.">
              <input
                type="text"
                name="pythonPath"
                value={config.pythonPath}
                onChange={handleChange}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </InputGroup>
          </div>

          <div className="h-px bg-[#333]" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InputGroup label="Editor Font Size" description="Cỡ chữ trong trình soạn thảo.">
              <input
                type="number"
                name="editorFontSize"
                value={config.editorFontSize}
                onChange={handleChange}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </InputGroup>
            <InputGroup label="Auto-Save Delay (ms)" description="Thời gian chờ (mili giây) trước khi tự động lưu file.">
              <input
                type="number"
                name="autoSaveDelay"
                value={config.autoSaveDelay}
                onChange={handleChange}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </InputGroup>
          </div>
          
          <InputGroup label="Editor Font Family" description="Chuỗi font-family cho trình soạn thảo (CSS format).">
            <input
              type="text"
              name="editorFontFamily"
              value={config.editorFontFamily}
              onChange={handleChange}
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </InputGroup>

          <InputGroup label="Snippet Menu Shortcut" description="Phím tắt để mở menu snippet (ví dụ: Ctrl+Shift+P).">
            <input
              type="text"
              name="shortcuts.snippetShortcut" // Sử dụng tên lồng nhau
              value={config.shortcuts.snippetShortcut}
              onChange={handleChange}
              className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </InputGroup>
        </div>

        <div className="p-6 bg-[#1e1e1e] border-t border-[#333] mt-auto">
          <button
            onClick={handleSave}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-sm transition-all shadow-lg shadow-blue-900/20"
          >
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};