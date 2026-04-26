import { create } from 'zustand';
import { AppSettings, TestCase } from './types';
import * as monaco from 'monaco-editor';

export interface WorkingSession {
  id: string;
  model: monaco.editor.ITextModel | null;
  settings: AppSettings | null;
  testcases: TestCase[] | null;
  isDirty: boolean;
  isLoading: boolean;
  expandedCases: string[];
  viewState: monaco.editor.ICodeEditorViewState | null;
}

interface SessionStore {
  sessions: Record<string, WorkingSession>;
  activeSessionId: string;
  openSessionIds: string[];
  
  setActiveSessionId: (id: string) => void;
  openSession: (id: string) => void;
  closeSession: (id: string) => void;
  setOpenSessionIds: (ids: string[]) => void;
  updateSession: (id: string, data: Partial<WorkingSession>) => void;
  initSession: (id: string, model: monaco.editor.ITextModel, settings: AppSettings, testcases: TestCase[]) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: {},
  activeSessionId: '',
  openSessionIds: [],

  setActiveSessionId: (id) => set({ activeSessionId: id }),
  
  openSession: (id) => {
    const { openSessionIds, sessions } = get();
    if (!openSessionIds.includes(id)) {
      set({ 
        openSessionIds: [...openSessionIds, id], 
        activeSessionId: id,
        sessions: {
          ...sessions,
          [id]: {
            id, model: null, settings: null, testcases: null, 
            isDirty: false, isLoading: true,
            expandedCases: [], viewState: null
          }
        }
      });
    } else {
      set({ activeSessionId: id });
    }
  },

  closeSession: (id) => {
    const { openSessionIds, activeSessionId, sessions } = get();
    const newOpenSessionIds = openSessionIds.filter(sid => sid !== id);
    let newActiveSessionId = activeSessionId;
    if (activeSessionId === id) {
      newActiveSessionId = newOpenSessionIds[newOpenSessionIds.length - 1] || '';
    }
    
    // Giải phóng bộ nhớ của Monaco Model
    if (sessions[id]?.model) {
      sessions[id].model?.dispose();
    }
    
    const newSessions = { ...sessions };
    delete newSessions[id];

    set({ openSessionIds: newOpenSessionIds, activeSessionId: newActiveSessionId, sessions: newSessions });
  },

  setOpenSessionIds: (ids) => set(state => {
    const newSessions = { ...state.sessions };
    
    // 1. Quét và dọn sạch RAM (Dispose Monaco Model) cho những Tab đã bị loại bỏ
    Object.keys(newSessions).forEach(existingId => {
      if (!ids.includes(existingId)) {
        if (newSessions[existingId]?.model) {
          newSessions[existingId].model?.dispose();
        }
        delete newSessions[existingId];
      }
    });

    // 2. Tạo khung rỗng (Loading) cho các Tab mới phục hồi từ quá trình Refresh
    ids.forEach(id => {
      if (!newSessions[id]) {
        newSessions[id] = {
          id, model: null, settings: null, testcases: null, 
          isDirty: false, isLoading: true,
          expandedCases: [], viewState: null
        };
      }
    });
    return { openSessionIds: ids, sessions: newSessions };
  }),
  
  updateSession: (id, data) => set(state => {
    if (!state.sessions[id]) return state;
    return {
      sessions: { ...state.sessions, [id]: { ...state.sessions[id], ...data } }
    };
  }),

  initSession: (id, model, settings, testcases) => set(state => {
    if (!state.sessions[id]) return state;
    return {
      sessions: {
        ...state.sessions,
        [id]: { ...state.sessions[id], model, settings, testcases, isLoading: false }
      }
    };
  })
}));