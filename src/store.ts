import { create } from 'zustand';
import { FileNode, GlobalConfig } from './types';
import * as monaco from 'monaco-editor';

type AppState = {
  // UI State
  isTerminalOpen: boolean;
  isTreeOpen: boolean;
  isSettingsOpen: boolean;
  isGlobalSettingsOpen: boolean;
  isSnippetManagerOpen: boolean;
  isSnippetMenuOpen: boolean;
  activeTab: 'testcases' | 'stress';
  contextMenu: { visible: boolean; x: number; y: number; node: FileNode | null };

  // Execution State
  logs: string[];
  runStatus: 'idle' | 'compiling' | 'running';
  currentTestIndex: number;

  // File Management State
  openFileIds: string[];
  activeFileId: string;
  unsavedFileIds: Set<string>;
  
  // Monaco Editor Models State
  monacoModels: Record<string, {
    model: monaco.editor.ITextModel;
    cursorState: monaco.editor.ICodeEditorViewState | null;
  }>;

  // Actions
  // UI Actions
  setTerminalOpen: (isOpen: boolean) => void;
  toggleTerminal: () => void;
  setTreeOpen: (isOpen: boolean) => void;
  toggleTree: () => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setIsGlobalSettingsOpen: (isOpen: boolean) => void;
  setIsSnippetManagerOpen: (isOpen: boolean) => void;
  setIsSnippetMenuOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: 'testcases' | 'stress') => void;
  showContextMenu: (x: number, y: number, node: FileNode) => void;
  hideContextMenu: () => void;

  // Execution Actions
  addLog: (log: string) => void;
  clearLogs: () => void;
  setRunStatus: (status: AppState['runStatus']) => void;
  setCurrentTestIndex: (index: number) => void;

  // File Management Actions
  setOpenFileIds: (ids: string[]) => void;
  setActiveFileId: (id: string) => void;
  openFile: (id: string) => void;
  closeFile: (id: string) => void;
  addUnsaved: (id: string) => void;
  removeUnsaved: (id: string) => void;
  
  // Global Config Hydration
  hydrate: (config: GlobalConfig) => void;

  addMonacoModel: (fileId: string, model: monaco.editor.ITextModel) => void;
  updateMonacoModelCursor: (fileId: string, cursorState: monaco.editor.ICodeEditorViewState | null) => void;
  removeMonacoModel: (fileId: string) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial State
  isTerminalOpen: true,
  isTreeOpen: true,
  isSettingsOpen: false,
  isGlobalSettingsOpen: false,
  isSnippetManagerOpen: false,
  isSnippetMenuOpen: false,
  activeTab: 'testcases',
  contextMenu: { visible: false, x: 0, y: 0, node: null },
  logs: [],
  runStatus: 'idle',
  currentTestIndex: 0,
  openFileIds: [],
  activeFileId: '',
  unsavedFileIds: new Set(),
  monacoModels: {},

  // Actions
  setTerminalOpen: (isOpen) => set({ isTerminalOpen: isOpen }),
  toggleTerminal: () => set((state) => ({ isTerminalOpen: !state.isTerminalOpen })),
  setTreeOpen: (isOpen) => set({ isTreeOpen: isOpen }),
  toggleTree: () => set((state) => ({ isTreeOpen: !state.isTreeOpen })),
  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  setIsGlobalSettingsOpen: (isOpen) => set({ isGlobalSettingsOpen: isOpen }),
  setIsSnippetManagerOpen: (isOpen) => set({ isSnippetManagerOpen: isOpen }),
  setIsSnippetMenuOpen: (isOpen) => set({ isSnippetMenuOpen: isOpen }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  showContextMenu: (x, y, node) => set({ contextMenu: { visible: true, x, y, node } }),
  hideContextMenu: () => set((state) => ({ contextMenu: { ...state.contextMenu, visible: false } })),
  
  addLog: (log) => set((state) => ({ logs: [...state.logs, log] })),
  clearLogs: () => set({ logs: [] }),
  setRunStatus: (status) => set({ runStatus: status }),
  setCurrentTestIndex: (index) => set({ currentTestIndex: index }),

  setOpenFileIds: (ids) => set({ openFileIds: ids }),
  setActiveFileId: (id) => set({ activeFileId: id }),
  openFile: (id) => {
    const { openFileIds } = get();
    if (!openFileIds.includes(id)) {
      set({ openFileIds: [...openFileIds, id], activeFileId: id });
    } else {
      set({ activeFileId: id });
    }
  },
  closeFile: (id) => {
    const { openFileIds, activeFileId } = get();
    const newOpenFileIds = openFileIds.filter((oid) => oid !== id);
    let newActiveFileId = activeFileId;

    if (activeFileId === id) {
      newActiveFileId = newOpenFileIds[newOpenFileIds.length - 1] || '';
    }

    set({ openFileIds: newOpenFileIds, activeFileId: newActiveFileId });
  },
  addUnsaved: (id) => set((state) => ({ unsavedFileIds: new Set(state.unsavedFileIds).add(id) })),
  removeUnsaved: (id) => set((state) => {
    const newSet = new Set(state.unsavedFileIds);
    newSet.delete(id);
    return { unsavedFileIds: newSet };
  }),
    
  hydrate: (config) => {
    if (config) {
      set({
        openFileIds: config.openFileIds || [],
        activeFileId: config.activeFileId || '',
      });
    }
  },

  addMonacoModel: (fileId, model) => set((state) => ({
    monacoModels: {
      ...state.monacoModels,
      [fileId]: { model, cursorState: null },
    },
  })),
  updateMonacoModelCursor: (fileId, cursorState) => set((state) => {
    const modelState = state.monacoModels[fileId];
    if (modelState) {
      return {
        monacoModels: {
          ...state.monacoModels,
          [fileId]: { ...modelState, cursorState },
        },
      };
    }
    return state;
  }),
  removeMonacoModel: (fileId) => set((state) => {
    const newModels = { ...state.monacoModels };
    if (newModels[fileId]) {
      newModels[fileId].model.dispose(); // Hủy model để giải phóng RAM khi đóng file
      delete newModels[fileId];
    }
    return { monacoModels: newModels };
  }),
}));