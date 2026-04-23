import { create } from 'zustand';
import { FileNode, GlobalConfig, AppSettings, TestCase } from './types';

const API_BASE_URL = 'http://localhost:3691/api';

interface FileCacheData {
  settings: AppSettings;
  testcases: TestCase[];
  content: string;
  isDirty: boolean;
}

interface DataStore {
  globalConfig: GlobalConfig | null;
  fileTree: FileNode[];
  fileCache: Record<string, FileCacheData>;
  isFileTreeLoading: boolean;
  
  fetchGlobalConfig: () => Promise<void>;
  saveGlobalConfig: (config: GlobalConfig) => Promise<void>;
  fetchFileTree: (background?: boolean) => Promise<void>;
  loadFileData: (path: string, isPython: boolean) => Promise<FileCacheData | null>;
  refreshFileData: (path: string, isPython: boolean) => Promise<FileCacheData | null>;
  updateFileCache: (path: string, data: Partial<FileCacheData>) => void;
  saveFileData: (path: string) => Promise<void>;
  saveFileContent: (path: string, content: string) => Promise<void>;
  openWorkspace: () => Promise<string | null>;
  openFileDialog: () => Promise<{path: string, name: string} | null>;
  createItem: (parent_path: string, name: string, type: 'file' | 'folder') => Promise<void>;
  renameItem: (old_path: string, new_name: string) => Promise<{ new_path: string } | null>;
  deleteItem: (path: string) => Promise<void>;
}

export const useDataStore = create<DataStore>((set, get) => ({
  globalConfig: null,
  fileTree: [],
  fileCache: {},
  isFileTreeLoading: false,

  fetchGlobalConfig: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/app-config`);
      const data = await res.json();
      set({ globalConfig: data });
    } catch (e) { console.error(e); }
  },

  saveGlobalConfig: async (config) => {
    try {
      await fetch(`${API_BASE_URL}/app-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      set({ globalConfig: config });
    } catch (e) { console.error(e); }
  },

  fetchFileTree: async (background = false) => {
    if (!background) set({ isFileTreeLoading: true });
    try {
      const res = await fetch(`${API_BASE_URL}/files/tree`);
      const data = await res.json();
      set({ fileTree: data, isFileTreeLoading: false });
    } catch (e) {
      console.error(e);
      if (!background) set({ isFileTreeLoading: false });
    }
  },

  loadFileData: async (path, isPython) => {
    const { fileCache } = get();
    // RAM-First: Nếu đã có trong bộ nhớ tạm thì lấy ra luôn không cần gọi API (Chuyển Tab mượt mà)
    if (fileCache[path]) return fileCache[path];

    try {
      const res = await fetch(`${API_BASE_URL}/files/data?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      
      let settings = data.settings;
      if (!settings) {
        settings = isPython 
          ? { compiler: 'python', timeLimit: 1000, memoryLimit: 256, useSandbox: true, useFileIO: true, customFileName: '' }
          : { compiler: 'g++', optimization: 'O2', warnings: true, extraWarnings: true, std: 'c++14', timeLimit: 1000, memoryLimit: 256, useSandbox: true, useFileIO: true, customFileName: '' };
      }
      
      let testcases = data.testcases;
      if (!testcases || testcases.length === 0) {
        testcases = [{ id: crypto.randomUUID(), name: 'Test 1', input: '', answer: null, output: '', status: 'pending', time: -1, memory: -1 }];
      }

      const cacheData = { settings, testcases, content: data.content || '', isDirty: false };
      set((state) => ({ fileCache: { ...state.fileCache, [path]: cacheData } }));
      return cacheData;
    } catch (e) {
      console.error(e);
      return null;
    }
  },

  refreshFileData: async (path, isPython) => {
    // Bỏ qua RAM cache, ép buộc lấy data từ server (Dùng sau khi chạy code xong để nạp output)
    try {
      const res = await fetch(`${API_BASE_URL}/files/data?path=${encodeURIComponent(path)}`);
      const data = await res.json();
      const testcases = (data.testcases && data.testcases.length > 0) ? data.testcases : [{ id: crypto.randomUUID(), name: 'Test 1', input: '', answer: null, output: '', status: 'pending', time: -1, memory: -1 }];
      
      set((state) => {
        const existing = state.fileCache[path];
        if (!existing) return state;
        return { fileCache: { ...state.fileCache, [path]: { ...existing, testcases } } };
      });
      return { testcases } as any;
    } catch (e) { return null; }
  },

  updateFileCache: (path, data) => {
    set((state) => {
      const existing = state.fileCache[path];
      if (!existing) return state;
      return { fileCache: { ...state.fileCache, [path]: { ...existing, ...data, isDirty: true } } };
    });
  },

  saveFileData: async (path) => {
    const { fileCache } = get();
    const cache = fileCache[path];
    if (!cache || !cache.isDirty) return;

    try {
      await fetch(`${API_BASE_URL}/files/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, settings: cache.settings, testcases: cache.testcases })
      });
      set((state) => ({ fileCache: { ...state.fileCache, [path]: { ...state.fileCache[path], isDirty: false } } }));
    } catch (e) { console.error(e); }
  },

  saveFileContent: async (path, content) => {
    try {
      await fetch(`${API_BASE_URL}/files/content`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, content }) });
    } catch (e) { console.error(e); }
  },

  openWorkspace: async () => {
    try { const res = await fetch(`${API_BASE_URL}/workspace/open-dialog`, { method: 'POST' }); const data = await res.json(); if (data.status === 'ok') return data.path; } catch (e) { console.error(e); } return null;
  },

  openFileDialog: async () => {
    try { const res = await fetch(`${API_BASE_URL}/files/open-dialog`, { method: 'POST' }); const data = await res.json(); if (data.status === 'ok') return data; } catch (e) { console.error(e); } return null;
  },

  createItem: async (parent_path, name, type) => {
    try {
      await fetch(`${API_BASE_URL}/files/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_path, name, type })
      });
      get().fetchFileTree(true); // Tự động làm mới cây thư mục sau khi tạo (Ngầm)
    } catch (e) {
      console.error('Failed to create item:', e);
      throw e;
    }
  },

  renameItem: async (old_path, new_name) => {
    try {
      const res = await fetch(`${API_BASE_URL}/files/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path, new_name })
      });
      if (!res.ok) throw new Error('Server error on rename');
      const data = await res.json();
      get().fetchFileTree(true); // Tự động làm mới cây thư mục (Ngầm)
      return data;
    } catch (e) {
      console.error('Failed to rename item:', e);
      throw e;
    }
  },

  deleteItem: async (path) => {
    try {
      await fetch(`${API_BASE_URL}/files/delete`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
      get().fetchFileTree(true); // Tự động làm mới cây thư mục (Ngầm)
    } catch (e) {
      console.error('Failed to delete item:', e);
      throw e;
    }
  }
}));