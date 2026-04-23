export interface FileState {
  name: string;
  content: string;
  language: string;
}

export type TestStatus = 'pending' | 'running' | 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE';

export interface TestCase {
  id: string;
  input: string | null;
  answer: string | null;
  output: string;
  status: TestStatus;
  isExpanded?: boolean;
  time?: number;
  memory?: number;
}

// Common settings for both C++ and Python
export interface CompileAndRunSettings {
  timeLimit: number;
  memoryLimit: number;
  useSandbox: boolean;
  useFileIO: boolean;
  customFileName: string;
  checker?: string;
}

export interface CppSettings extends CompileAndRunSettings {
  compiler: string; // e.g., 'g++'
  optimization: 'O0' | 'O1' | 'O2' | 'O3';
  warnings: boolean;
  extraWarnings: boolean;
  std: 'c++11' | 'c++14' | 'c++17' | 'c++20' | 'c++23';
}

export interface PythonSettings extends CompileAndRunSettings {
  compiler: string; // e.g., 'python'
  // No specific Python-only settings for now, but can be added here later
}

// Union type for settings
export type AppSettings = CppSettings | PythonSettings;

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  isOpen?: boolean;
  children?: FileNode[];
  content?: string; // Content is optional and lazy-loaded for files
}

export interface FileSpecificData {
  settings: AppSettings;
  testcases: TestCase[];
}

export interface AppState {
  openFileIds: string[];
  activeFileId: string;
  treeState?: { [id: string]: boolean }; // Make optional for robustness
}

export interface Snippet {
  id: string;
  name: string;
  content: string;
}

export interface GlobalConfig {
  lastWorkspace: string;
  gppPath: string;
  pythonPath: string;
  autoSaveDelay: number; // in ms
  editorFontSize: number;
  editorFontFamily: string;
  appVersion: string; // For app info
  openFileIds: string[];
  activeFileId: string;
  treeState?: { [id: string]: boolean }; // Make optional for robustness
  snippets: Snippet[];
  shortcuts: Shortcuts;
}

export interface Shortcuts {
  snippetShortcut: string;
  // Thêm các phím tắt khác vào đây trong tương lai
}