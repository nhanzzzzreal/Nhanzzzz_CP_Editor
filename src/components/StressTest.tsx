import React from 'react';
import { FlaskConical } from 'lucide-react';

export const StressTest: React.FC = () => {
  return (
    <div className="p-4 flex flex-col h-full items-center justify-center text-center">
      <FlaskConical size={48} className="text-gray-600 mb-4 opacity-50" />
      <h2 className="text-lg font-bold text-gray-400 mb-2">Stress Test</h2>
      <p className="text-sm text-gray-500 max-w-[200px]">
        Tính năng này đang được phát triển và hiện chưa khả dụng.
      </p>
    </div>
  );
};