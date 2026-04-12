import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppSettings, FileNode, GlobalConfig, TestCase } from './types';

//const API_BASE_URL = 'http://localhost:3690/api';
const API_BASE_URL = 'http://localhost:3691/api';

// --- Query Keys ---
export const queryKeys = {
  globalConfig: ['globalConfig'],
  fileTree: ['fileTree'],
  fileData: (path: string) => ['fileData', path],
};

// --- API Fetcher Functions ---

const api = {
  getGlobalConfig: async (): Promise<GlobalConfig> => {
    const res = await fetch(`${API_BASE_URL}/app-config`);
    if (!res.ok) throw new Error('Failed to fetch global config');
    return res.json();
  },
  saveGlobalConfig: async (config: Partial<GlobalConfig>): Promise<any> => {
    const res = await fetch(`${API_BASE_URL}/app-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!res.ok) throw new Error('Failed to save global config');
    return res.json();
  },
  getFileTree: async (): Promise<FileNode[]> => {
    const res = await fetch(`${API_BASE_URL}/files/tree`);
    if (!res.ok) throw new Error('Failed to fetch file tree');
    return res.json();
  },
  getFileData: async (path: string): Promise<{ content: string; settings: AppSettings; testcases: TestCase[] }> => {
    const res = await fetch(`${API_BASE_URL}/files/data?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error(`File not found: ${path}`);
    return res.json();
  },
  saveFileContent: async ({ path, content }: { path: string; content: string }) => {
    const res = await fetch(`${API_BASE_URL}/files/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    });
    if (!res.ok) throw new Error('Failed to save file content');
    return res.json();
  },
  saveFileData: async ({ path, settings, testcases }: { path: string; settings: AppSettings; testcases: TestCase[] }) => {
    const res = await fetch(`${API_BASE_URL}/files/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, settings, testcases }),
    });
    if (!res.ok) throw new Error('Failed to save file data');
    return res.json();
  },
  createItem: async ({ parent_path, name, type }: { parent_path: string; name: string; type: 'file' | 'folder' }) => {
    const res = await fetch(`${API_BASE_URL}/files/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parent_path, name, type }),
    });
    if (!res.ok) throw new Error('Failed to create item');
    return res.json();
  },
  renameItem: async ({ old_path, new_name }: { old_path: string; new_name: string }) => {
    const res = await fetch(`${API_BASE_URL}/files/rename`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ old_path, new_name }),
    });
    if (!res.ok) throw new Error('Failed to rename item');
    return res.json();
  },
  deleteItem: async (path: string) => {
    const res = await fetch(`${API_BASE_URL}/files?path=${encodeURIComponent(path)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete item');
    return res.json();
  },
  openWorkspaceDialog: async () => {
    const res = await fetch(`${API_BASE_URL}/workspace/open-dialog`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to open workspace dialog');
    return res.json();
  },
  openFileDialog: async () => {
    const res = await fetch(`${API_BASE_URL}/files/open-dialog`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to open file dialog');
    return res.json();
  },
  runCode: (body: any) => fetch(`${API_BASE_URL}/run/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
};

// --- TanStack Query Hooks ---

export const useGlobalConfigQuery = () => useQuery({
  queryKey: queryKeys.globalConfig,
  queryFn: api.getGlobalConfig,
  staleTime: 1000 * 60 * 5, // 5 minutes
  refetchOnWindowFocus: false,
});

export const useSaveGlobalConfigMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveGlobalConfig,
    onSuccess: (data, variables) => {
      queryClient.setQueryData(queryKeys.globalConfig, (old: GlobalConfig | undefined) => ({ ...old, ...variables }));
    },
  });
};

export const useFileTreeQuery = () => useQuery({
  queryKey: queryKeys.fileTree,
  queryFn: api.getFileTree,
});

export const useFileDataQuery = (path: string) => useQuery({
  queryKey: queryKeys.fileData(path),
  queryFn: () => api.getFileData(path),
  enabled: !!path && !path.startsWith('temp'),
  staleTime: 1000 * 60, // 1 minute
});

export const useSaveFileContentMutation = () => useMutation({ mutationFn: api.saveFileContent });

export const useSaveFileDataMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.saveFileData,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fileData(variables.path) });
    },
  });
};

export const useCreateItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fileTree }),
  });
};

export const useRenameItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.renameItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fileTree }),
  });
};

export const useDeleteItemMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteItem,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.fileTree }),
  });
};

export const useOpenWorkspaceMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.openWorkspaceDialog,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.fileTree });
      queryClient.invalidateQueries({ queryKey: queryKeys.globalConfig });
    },
  });
};

export const useOpenFileDialogMutation = () => useMutation({ mutationFn: api.openFileDialog });

export const useRunCodeMutation = () => useMutation({ mutationFn: api.runCode });