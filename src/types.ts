export interface FileState {
  name: string;
  content: string;
  language: string;
}

export type TestStatus = 'pending' | 'running' | 'AC' | 'WA' | 'TLE' | 'MLE' | 'RE';

export interface TestCase {
  id: string;
  input: string;
  answer: string;
  output: string;
  status: TestStatus;
  isExpanded?: boolean;
}

export interface AppSettings {
  compiler: string;
  optimization: 'O0' | 'O1' | 'O2' | 'O3';
  warnings: boolean;
  extraWarnings: boolean;
  fastCompile: boolean;
  outputFile: string;
  timeLimit: number;
  memoryLimit: number;
  useSandbox: boolean;
  useFileIO: boolean;
  customFileName: string;
}

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
  treeState?: { [id: string]: boolean };
  snippets: Snippet[];
  snippetShortcut: string;
}