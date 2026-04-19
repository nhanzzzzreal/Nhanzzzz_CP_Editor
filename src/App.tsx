import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Terminal as TerminalIcon, FlaskConical, X, Upload, GripVertical, GripHorizontal, Plus, FolderOpen, Trash2, Settings as SettingsIcon, File, Folder, Loader2, FilePlus, FolderTree, Scissors, Zap, GitCompare } from 'lucide-react';
import {
  Tree,
  UncontrolledTreeEnvironment,
  StaticTreeDataProvider,
  TreeItem, TreeItemRenderContext,
  TreeItemIndex,
} from 'react-complex-tree';
import { useQueryClient } from '@tanstack/react-query';
import 'react-complex-tree/lib/style.css';
import { PanelGroup, Panel, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { useDebouncedCallback } from 'use-debounce';

import { cn } from './lib/utils';
import { AppSettings, FileNode, FileState, GlobalConfig, TestCase, CppSettings, PythonSettings } from './types';
import { useAppStore } from './store';
import { useCreateItemMutation, useDeleteItemMutation, useFileDataQuery, useFileTreeQuery, useGlobalConfigQuery, useOpenFileDialogMutation, useOpenWorkspaceMutation, useRenameItemMutation, useRunCodeMutation, useSaveFileContentMutation, useSaveFileDataMutation, useSaveGlobalConfigMutation } from './api';

// --- Component Imports ---
import { SettingsModal } from './components/SettingsModal';
import { TestCaseItem } from './components/TestCaseItem';
import { Terminal } from './components/Terminal';
import { SnippetManagerModal } from './components/SnippetManagerModal';
import { SnippetMenu } from './components/SnippetMenu';
import { GlobalSettingsModal } from './components/GlobalSettingsModal';
import { useHotkeys } from 'react-hotkeys-hook';
import { DiffViewerModal } from './components/DiffViewerModal';
import { TestCaseViewerModal } from './components/TestCaseViewerModal';

// --- Constants ---
const API_BASE_URL = 'http://localhost:3691/api'; // Default FastAPI port

export default function App() {
  const formatLogMessage = useCallback((message: string): string => {
    return `[${new Date().toLocaleTimeString([], { hour12: false })}] ${message}`;
  }, []);

  // Zustand Store
  const {
    logs, addLog, clearLogs,
    isTerminalOpen, setTerminalOpen,
    isTreeOpen, setTreeOpen,
    isSettingsOpen, setIsSettingsOpen,
    isGlobalSettingsOpen, setIsGlobalSettingsOpen,
    isSnippetManagerOpen, setIsSnippetManagerOpen,
    isSnippetMenuOpen, setIsSnippetMenuOpen,
    activeTab, setActiveTab,
    runStatus, setRunStatus,
    currentTestIndex, setCurrentTestIndex,
    openFileIds, setOpenFileIds,
    activeFileId, setActiveFileId,
    unsavedFileIds, addUnsaved, removeUnsaved,
    contextMenu, showContextMenu, hideContextMenu,
    openFile, closeFile,
    hydrate: hydrateStore,
  } = useAppStore();

  // Local State
  const [isStressing, setIsStressing] = useState(false);
  const [editorContent, setEditorContent] = useState<string>('');
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffExpected, setDiffExpected] = useState('');
  const [diffActual, setDiffActual] = useState('');
  
  const [isViewTcOpen, setIsViewTcOpen] = useState(false);
  const [viewTcData, setViewTcData] = useState<TestCase | null>(null);
  const [isDataDirty, setIsDataDirty] = useState(false);
  
  // Refs
  const editorRef = useRef<any>(null); 
  const [settings, setSettings] = useState<AppSettings>(
    { // Default to CppSettings
    compiler: 'g++',
    optimization: 'O2',
    warnings: true,
    extraWarnings: true,
    std: 'c++14', // New C++ specific setting
    timeLimit: 1000,
    memoryLimit: 256,
    useSandbox: true,
    useFileIO: true,
    customFileName: '',
  } as CppSettings); // Cast for initial state

  useEffect(() => {
    const handleClick = () => hideContextMenu();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const [testcases, setTestcases] = useState<TestCase[]>([
    { id: crypto.randomUUID(), input: '', answer: '', output: '', status: 'pending', isExpanded: true, time: -1 }
  ]);

  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const treePanelRef = useRef<ImperativePanelHandle>(null);
  
  const [bruteFile, setBruteFile] = useState<FileState | null>(null);
  const [acFile, setAcFile] = useState<FileState | null>(null);
  const [genFile, setGenFile] = useState<FileState | null>(null);

  // Helper to determine if the active file is Python
  const isPythonFile = useMemo(() => activeFileId.endsWith('.py'), [activeFileId]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentSelecting, setCurrentSelecting] = useState<'brute' | 'ac' | 'gen' | null>(null);

  // TanStack Query Hooks
  const queryClient = useQueryClient();
  const { data: globalConfig, isLoading: isGlobalConfigLoading } = useGlobalConfigQuery();
  const { data: fileTree = [], isLoading: isFileTreeLoading, refetch: refreshTree } = useFileTreeQuery();
  const { data: fileData, isLoading: isFileLoading } = useFileDataQuery(activeFileId);

  // Mutations
  const saveGlobalConfigMutation = useSaveGlobalConfigMutation();
  const saveFileContentMutation = useSaveFileContentMutation();
  const saveFileDataMutation = useSaveFileDataMutation();
  const createItemMutation = useCreateItemMutation();
  const renameItemMutation = useRenameItemMutation();
  const deleteItemMutation = useDeleteItemMutation();
  const openWorkspaceMutation = useOpenWorkspaceMutation();
  const openFileDialogMutation = useOpenFileDialogMutation();
  const runCodeMutation = useRunCodeMutation();

  const handleFileOpenClick = useCallback(async () => {
    openFileDialogMutation.mutate(undefined, {
      onSuccess: (data) => {
      if (data.status === 'ok') {
        const { path: fileId, name: fileName } = data;
        openFile(fileId); // This will trigger fileDataQuery and subsequent loading
        addLog(formatLogMessage(`Opened file: ${fileName}`));
        // Refresh tree to ensure new file is visible if it was created/opened outside the tree
        refreshTree();
      }
      },
      onError: (error: any) => {
        addLog(`Error opening file: ${error.message}`);
      }
    });
  }, [openFileDialogMutation, openFile, addLog, refreshTree]);

  const saveActiveFile = useCallback(() => {
    if (!activeFileId || activeFileId.startsWith('temp')) return;
    let saved = false;
    
    if (unsavedFileIds.has(activeFileId)) {
      saveFileContentMutation.mutate({ path: activeFileId, content: editorRef.current?.getValue() || '' });
      removeUnsaved(activeFileId);
      saved = true;
    }
    
    if (isDataDirty) {
      saveFileDataMutation.mutate({ path: activeFileId, settings, testcases });
      setIsDataDirty(false);
      saved = true;
    }
    
    if (saved) {
      addLog(formatLogMessage(`File saved successfully.`));
    } else {
      addLog(formatLogMessage(`No changes to save.`));
    }
  }, [activeFileId, unsavedFileIds, isDataDirty, settings, testcases, addLog, removeUnsaved, saveFileContentMutation, saveFileDataMutation]);

  const handleOpenWorkspace = useCallback(async () => {
    openWorkspaceMutation.mutate(undefined, {
      onSuccess: (data) => {
      if (data.status === 'ok' && data.path) {
        addLog(`Workspace changed to: ${data.path}`);
        setOpenFileIds([]);
        setActiveFileId('');
      }
      },
      onError: (err: any) => addLog(`Error opening workspace: ${err.message}`),
    });
  }, [openWorkspaceMutation, addLog, setOpenFileIds, setActiveFileId]);

  const treeViewState = useMemo(() => ({
    ['tree-1']: {
      // expandedItems: [], // Tạm thời không quản lý state expand/collapse ở đây
      focusedItem: activeFileId || undefined,
      selectedItems: activeFileId ? [activeFileId] : [],
    }
  }), [activeFileId]);

  // --- Hotkeys ---
  // Cấu hình để phím tắt hoạt động ngay cả khi đang focus vào editor hoặc input
  const hotkeyOptions = {
    preventDefault: true,
    enableOnFormElements: true,
  };
  
  const isDiffSupported = true; // Luôn cho phép xem diff viewer bất kể dùng checker nào

  // Lưu file (Ctrl+S)
  useHotkeys('mod+s', () => {
    if (activeFileId) {
      saveActiveFile();
    }
  }, hotkeyOptions, [activeFileId, saveActiveFile]);

  // Mở file (Ctrl+O)
  useHotkeys('mod+o', handleFileOpenClick, hotkeyOptions, [handleFileOpenClick]);

  // Mở workspace (Ctrl+Shift+O)
  useHotkeys('mod+shift+o', handleOpenWorkspace, hotkeyOptions, [handleOpenWorkspace]);

  // Mở menu snippet (phím tắt động từ config)
  const snippetShortcut = useMemo(() => {
    if (!globalConfig?.shortcuts?.snippetShortcut) return 'mod+shift+p';
    // Chuyển đổi "Ctrl+Shift+P" thành "mod+shift+p" để hỗ trợ đa nền tảng
    return globalConfig.shortcuts.snippetShortcut
      .toLowerCase()
      .split('+')
      .map(part => part === 'ctrl' || part === 'cmd' || part === 'meta' ? 'mod' : part)
      .join('+');
  }, [globalConfig?.shortcuts?.snippetShortcut]);

  useHotkeys(snippetShortcut, () => {
    setIsSnippetMenuOpen(true);
  }, hotkeyOptions, [setIsSnippetMenuOpen]);
  // --- End Hotkeys ---

  const findFileById = (id: string, nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findFileById(id, node.children);
        if (found) return found;
      }
    }
    return null;
  };
  const activeFile = findFileById(activeFileId, fileTree);

  // --- NEW ARCHITECTURE: PERIODIC SYNC TO USB (RAM-first approach) ---
  // Sử dụng ref để đảm bảo setInterval luôn đọc được state mới nhất mà không bị reset timer khi gõ phím
  const latestStateRef = useRef({ activeFileId, unsavedFileIds, isDataDirty, settings, testcases });
  useEffect(() => {
    latestStateRef.current = { activeFileId, unsavedFileIds, isDataDirty, settings, testcases };
  }, [activeFileId, unsavedFileIds, isDataDirty, settings, testcases]);

  useEffect(() => {
    const delay = globalConfig?.autoSaveDelay || 10000; // Default: 10s
    if (delay <= 0) return;

    const timer = setInterval(() => {
      const state = latestStateRef.current;
      if (state.activeFileId && !state.activeFileId.startsWith('temp')) {
        if (state.unsavedFileIds.has(state.activeFileId)) {
          saveFileContentMutation.mutate({ path: state.activeFileId, content: editorRef.current?.getValue() || '' });
          removeUnsaved(state.activeFileId);
        }
        if (state.isDataDirty) {
          saveFileDataMutation.mutate({ path: state.activeFileId, settings: state.settings, testcases: state.testcases });
          setIsDataDirty(false);
        }
      }
    }, delay);
    return () => clearInterval(timer);
  }, [globalConfig?.autoSaveDelay, saveFileContentMutation, saveFileDataMutation, removeUnsaved]);

  // Hydrate store with initial file state from global config
  const isHydrated = useRef(false);
  useEffect(() => {
    if (globalConfig && !isHydrated.current) {
      hydrateStore(globalConfig);
      isHydrated.current = true;
    }
  }, [globalConfig, hydrateStore]);

  const debouncedSaveGlobalConfig = useDebouncedCallback((config: GlobalConfig) => {
    saveGlobalConfigMutation.mutate(config);
  }, 1500);

  // Dùng useRef để giữ config mới nhất mà không kích hoạt lại useEffect
  const latestConfigRef = useRef(globalConfig);
  useEffect(() => { latestConfigRef.current = globalConfig; }, [globalConfig]);

  useEffect(() => {
    if (latestConfigRef.current && isHydrated.current) { 
      debouncedSaveGlobalConfig({ ...latestConfigRef.current, openFileIds, activeFileId });
    }
  }, [openFileIds, activeFileId, debouncedSaveGlobalConfig]);

  const addTestCase = () => {
    setTestcases(prev => [...prev, { id: crypto.randomUUID(), input: '', answer: '', output: '', status: 'pending', time: -1 }]);
  };

  const removeTestCase = (id: string) => {
    if (testcases.length > 1) {
      setTestcases(prev => prev.filter(tc => tc.id !== id));
    } else {
      setTestcases([{ id: crypto.randomUUID(), input: '', answer: '', output: '', status: 'pending', time: -1 }]);
    }
  };

  const updateTestCase = (id: string, field: keyof TestCase, value: string) => {
    setTestcases(prev => prev.map(tc => tc.id === id ? { ...tc, [field]: value } : tc));
  };

  const runSingleTestCase = async (id: string) => {
    if (isFileLoading) {
      addLog('⏳ Vui lòng chờ testcases tải xong trước khi chạy...');
      return;
    }
    const tc = testcases.find(t => t.id === id);
    if (!tc) return;

    const codeToRun = editorRef.current?.getValue();
    
    if (!activeFile || codeToRun === undefined) {
      addLog('Lỗi: Không có file hoặc nội dung code để chạy.');
      return;
    }

    const isPython = (settings as any).compiler.toLowerCase().includes('python'); // Check compiler from current settings
    setRunStatus(isPython ? 'running' : 'compiling');
    addLog(`Running single testcase #${testcases.findIndex(t => t.id === id) + 1}...`);
    setTestcases(prev => prev.map(t => t.id === id ? { ...t, status: 'running', output: '', time: undefined } : t));

    runCodeMutation.mutate({
          path: activeFileId,
          code: codeToRun,
          testcases: [tc],
          settings: settings,
          globalConfig: globalConfig,
    }, {
      onSuccess: async (response) => {
        try {
          if (!response.body) throw new Error("No response body");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          
          let buffer = ''; 

          while (true) {
            // ... (Phần logic while và for parse JSON giữ nguyên y hệt) ...
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; 

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);
                
                if (data.type === 'compile_finish') {
                  setRunStatus('running');
                  if (data.log) addLog(formatLogMessage(`Compiler Log:\n${data.log}`));
                } else if (data.type === 'test_result') {
                  const res = data.result;
                  setTestcases(prev => prev.map(t => {
                    if (t.id !== res.id) return t;                    
                    const finalStatus = res.status; // Trust backend status

                    if (finalStatus !== 'AC') {
                      addLog(formatLogMessage(`> Single Testcase FAILED. Status: ${finalStatus}. Time: ${res.time}ms. Details: ${res.error_log || 'Output does not match expected answer.'}`));
                    }

                    return { ...t, output: res.output, status: finalStatus, time: res.time };
                  }));
                  addLog(`Single testcase finished.`);
                }
              } catch (e) {
                console.error("JSON parse error:", e, line);
              }
            }
          }
        } finally {
          // Đưa về idle khi hoàn thành stream
          setRunStatus('idle');
        }
      },
      onError: (error: any) => {
        addLog(formatLogMessage(`Error running testcase: ${error.message}`));
        setTestcases(prev => prev.map(t => t.id === id ? { ...t, status: 'RE', output: `Client/Network Error: ${error.message}` } : t));
        setRunStatus('idle'); // Set idle nếu có lỗi mạng
      }
    });
  };

  const handleRun = async () => {
    if (isFileLoading) {
      addLog(formatLogMessage('⏳ Vui lòng chờ testcases tải xong trước khi chạy...'));
      return;
    }
    const codeToRun = editorRef.current?.getValue();
    if (!activeFile || codeToRun === undefined) {
      addLog(formatLogMessage('Lỗi: Không có file hoặc nội dung code để chạy.'));
      return;
    }

    // 1. Reset UI state immediately to 'pending' to stop flickering and show user action is in progress.
    // The UI now shows a clean state, waiting for results.
    setTestcases(prev => prev.map(tc => ({ ...tc, status: 'pending', output: '', time: -1 })));
    setCurrentTestIndex(0);
    const isPython = (settings as any).compiler.toLowerCase().includes('python'); // Check compiler from current settings
    setRunStatus(isPython ? 'running' : 'compiling');
    addLog(formatLogMessage(`Starting execution... (Syncing data with server)`));

    // 2. Call the run mutation. The backend will handle saving first, then running.
    // The payload includes everything the backend needs to establish the "source of truth".
    setIsDataDirty(false); // Clear dirty flag since backend takes care of saving
    runCodeMutation.mutate({
          path: activeFileId,
          code: codeToRun,
          testcases: testcases, // Send the full current state of testcases to be saved
          settings: settings,
          globalConfig: globalConfig,
    }, {
      onSuccess: async (response) => {
        // The streaming logic here updates the UI as results come in.
        // The key is that the backend is now running on guaranteed-to-be-saved data.
        try {
          if (!response.body) return;
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          
          let buffer = ''; 
          let completedTests = 0;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const data = JSON.parse(line);

                if (data.type === 'compile_finish') {
                  setRunStatus('running');
                  if (data.log) {
                    addLog(formatLogMessage(`Compiler Log:\n${data.log}`));
                    // If compile error, backend sends CE for all. UI should reflect this.
                    if (data.log.trim() !== '') {
                        setTestcases(prev => prev.map(tc => ({...tc, status: 'CE'})));
                    }
                  }
                } else if (data.type === 'test_result') {
                  const res = data.result;
                  setTestcases(prev => prev.map(tc => {
                    if (tc.id !== res.id) return tc;
                    if (res.status !== 'AC') {
                      const tcIndex = prev.findIndex(t => t.id === res.id);
                      addLog(formatLogMessage(`> Testcase #${tcIndex + 1} FAILED. Status: ${res.status}. Time: ${res.time}ms. Details: ${res.error_log || 'Output does not match expected answer.'}`));
                    }
                    return { ...tc, output: res.output, status: res.status, time: res.time };
                  }));

                  completedTests++;
                  setCurrentTestIndex(completedTests);
                } else if (data.type === 'results_saved') {
                  addLog(formatLogMessage('All results saved on server. State synchronized.'));
                  // This is still good for a final sync, ensuring UI matches the final DB state.
                  queryClient.invalidateQueries({ queryKey: ['fileData', data.path] });
                } else if (data.type === 'log') {
                  addLog(formatLogMessage(data.log));
                } else if (data.type === 'run_aborted') {
                  // Handle the new error case from server.py
                  setRunStatus('idle');
                  setTestcases(prev => prev.map(tc => ({...tc, status: 'RE', output: 'Execution aborted due to server-side save error.'})));
                }
              } catch (e) {
                console.error("JSON Parse error:", e, line);
              }
            }
          }
          addLog(formatLogMessage('Execution finished.'));
        } finally {
          setRunStatus('idle');
          // Fallback: Check for any testcases that didn't get a result and mark them as errored.
          setTestcases(prev => prev.map(tc => 
            tc.status === 'running' || tc.status === 'pending'
              ? { ...tc, status: 'RE', output: (tc.output || '') + "\nError: The execution result was not received from the backend." } 
              : tc
          ));
        }
      },
      onError: (error: any) => {
        addLog(formatLogMessage(`Error: ${error.message}`));
        setRunStatus('idle');
        setTestcases(prev => prev.map(tc => 
          tc.status === 'running' || tc.status === 'pending' ? { ...tc, status: 'RE', output: `Client/Network Error: ${error.message}` } : tc
        ));
      }
    });
  };

  const folderInputRef = useRef<HTMLInputElement>(null);
  const handleFolderSelect = () => {
    folderInputRef.current?.click();
  };

  const onFolderChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const fileMap: Record<string, { inp?: string, out?: string }> = {};
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const pathParts = file.webkitRelativePath.split('/');
      if (pathParts.length < 2) continue;
      
      const folderName = pathParts[pathParts.length - 2];
      const fileName = file.name.toLowerCase();
      
      if (!fileMap[folderName]) fileMap[folderName] = {};
      
      const rawContent = await file.text();
      const cleanContent = rawContent.replace(/\r?\n|\r/g, "\n").trim(); 

      if (fileName.endsWith('.inp')) fileMap[folderName].inp = cleanContent;
      if (fileName.endsWith('.out')) fileMap[folderName].out = cleanContent;
    }

    const loadedTestcases: TestCase[] = Object.entries(fileMap)
      .filter(([_, data]) => data.inp !== undefined || data.out !== undefined)
      .map(([name, data]) => ({
        id: crypto.randomUUID(),
        input: data.inp || '',
        answer: data.out || null, // Allow null for answer
        output: '',
        status: 'pending',
        time: -1
      }));

    if (loadedTestcases.length > 0) {
      setTestcases(loadedTestcases);
      addLog(formatLogMessage(`Loaded ${loadedTestcases.length} testcases from folder.`));
    }
    e.target.value = '';
  };

  const handleFileSelect = (type: 'brute' | 'ac' | 'gen') => {
    setCurrentSelecting(type);
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const fileState = {
        name: file.name,
        content,
        language: 'cpp'
      };

      if (currentSelecting === 'brute') setBruteFile(fileState);
      else if (currentSelecting === 'ac') setAcFile(fileState);
      else if (currentSelecting === 'gen') setGenFile(fileState);
      
      addLog(formatLogMessage(`Loaded ${file.name} as ${currentSelecting} code.`));
    };
    reader.readAsText(file);
    e.target.value = ''; 
  };

  const startStressTest = async () => {
    if (!bruteFile || !acFile || !genFile) {
      addLog(`Error: Please select all 3 files for stress testing.`);
      return;
    }
    addLog(formatLogMessage(`Starting stress test...`));
    setIsStressing(true);

    try {
      const response = await fetch(`${API_BASE_URL}/stress-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brute_code: bruteFile.content,
          ac_code: acFile.content,
          gen_code: genFile.content,
          settings: settings,
        }),
      });
      const result = await response.json(); 
      addLog(formatLogMessage(`Stress Test Result: ${result.message}`));
    } catch (error: any) {
      addLog(formatLogMessage(`Stress test failed: ${error.message}`));
    } finally {
      setIsStressing(false);
    }
  };

  const toggleTerminal = () => {
    if (isTerminalOpen) {
      terminalPanelRef.current?.collapse();
    } else {
      terminalPanelRef.current?.expand();
    }
  };

  const toggleTree = () => {
    if (isTreeOpen) {
      treePanelRef.current?.collapse();
    } else {
      treePanelRef.current?.expand();
    }
  };

  const restoreTreeOpenState = (nodes: FileNode[], savedState: { [id: string]: boolean }): FileNode[] => {
    return nodes.map(node => {
      if (node.type === 'folder') {
        const newNode = { ...node, isOpen: savedState[node.id] || false };
        if (node.children) {
          newNode.children = restoreTreeOpenState(node.children, savedState);
        }
        return newNode;
      }
      return node;
    });
  };

  const handleFileClick = async (node: FileNode) => {
    if (node.type === 'file') {
      openFile(node.id);
    } else { 
      // Logic to toggle folder in tree view state would go here if needed
      // For now, react-complex-tree handles its internal open/close state
    }
  };

  const isLoadingDataRef = useRef(false);

  useEffect(() => {
    // 1. Xử lý trường hợp không có file nào được chọn: reset về trạng thái mặc định.
    if (!activeFileId) {
      setEditorContent('');
      setTestcases([{ id: crypto.randomUUID(), input: '', answer: null, output: '', status: 'pending', time: -1 }]);
      return;
    }

    // 2. Khi đang tải file mới (isFileLoading), reset testcases để tránh hiển thị dữ liệu cũ.
    if (isFileLoading) {
      addLog(formatLogMessage(`Loading data for ${activeFileId}...`));
      setTestcases([]);
      return;
    }

    // 3. Khi đã tải xong (isFileLoading là false), cập nhật state từ fileData.
    addLog(formatLogMessage(`Data for ${activeFileId} loaded. Populating UI.`));
    isLoadingDataRef.current = true; // Chặn auto-save ngay sau khi load
    setIsDataDirty(false); // Đặt cờ dirty về false vì vừa load từ DB lên

    setEditorContent(fileData?.content || '');

    if (fileData?.settings) { // Ensure the loaded settings match the expected type
      if (isPythonFile) {
        setSettings(fileData.settings as PythonSettings);
      } else {
        setSettings(fileData.settings as CppSettings);
      }
    } else {
      // If no settings are found, initialize with defaults based on file type
      if (isPythonFile) {
        setSettings({
          compiler: 'python', timeLimit: 1000, memoryLimit: 256, useSandbox: true, useFileIO: true, customFileName: '',
        } as PythonSettings);
      } else {
        setSettings({
          compiler: 'g++', optimization: 'O2', warnings: true, extraWarnings: true, std: 'c++14',
          timeLimit: 1000, memoryLimit: 256, useSandbox: true, useFileIO: true, customFileName: '',
        } as CppSettings);
      }
    }
    
    if (fileData?.testcases && fileData.testcases.length > 0) { // Dùng spread (...) để đảm bảo tất cả các trường đã lưu (status, output, time) được giữ lại.
      // Dùng spread (...) để đảm bảo tất cả các trường đã lưu (status, output, time) được giữ lại.
      setTestcases(fileData.testcases);
    } else {
      // Nếu không có testcase nào, reset về trạng thái mặc định.
      setTestcases([{ id: crypto.randomUUID(), input: '', answer: null, output: '', status: 'pending', time: -1 }]);
    }

    // Tắt cờ khóa sau một khoảng trễ để cho phép auto-save hoạt động lại.
    setTimeout(() => { isLoadingDataRef.current = false; }, 500);

  }, [activeFileId, fileData, isFileLoading, isPythonFile]);

  // Cập nhật cờ dirty khi có thay đổi từ người dùng
  useEffect(() => {
    if (fileData && !isLoadingDataRef.current) { 
      setIsDataDirty(true);
    }
  }, [settings, testcases, fileData]);

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeFile(id);
  };


  const handleEditorChange = (value: string | undefined) => {
    const newContent = value || '';
    setEditorContent(newContent);
    addUnsaved(activeFileId);
  };

  const insertSnippet = (content: string) => {
    if (editorRef.current) {
      const editor = editorRef.current;
      const selection = editor.getSelection();
      const op = {
        range: selection,
        text: content,
        forceMoveMarkers: true
      };
      editor.executeEdits("snippet-insert", [op]);
      editor.focus();
    }
  };

  const handleFileDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const content = await file.text();
      const fileId = `temp-drop/${file.name}`;
      const newNode: FileNode = { id: fileId, name: file.name, type: 'file', content: content };

      openFile(fileId);

      addLog(formatLogMessage(`Opened ${file.name} from drag-and-drop.`));
      e.dataTransfer.clearData();
    }
  }

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.py')) return 'python';
    if (filename.endsWith('.cpp')) return 'cpp';
  };

  const handleCreateItem = async (type: 'file' | 'folder', targetParentPath?: string) => {
    const name = prompt(`Nhập tên ${type === 'file' ? 'tập tin' : 'thư mục'} mới:`);
    if (!name) return;

    let parentPath = targetParentPath || 'workspace';
    if (!targetParentPath && activeFileId && !activeFileId.startsWith('temp')) {
      const parts = activeFileId.split('/');
      if (parts.length > 1) {
        parts.pop();
        parentPath = parts.join('/');
      }
    }

    createItemMutation.mutate({ parent_path: parentPath, name: name, type: type }, {
      onSuccess: () => addLog(formatLogMessage(`Đã tạo ${type}: ${name}`)),
      onError: (err: any) => addLog(formatLogMessage(`Lỗi khi tạo: ${err.message}`)),
    });
  };

  const handleRenameNode = async (oldPath: string, oldName: string, newName?: string) => {
    const finalNewName = newName ?? window.prompt('Nhập tên mới:', oldName);
    if (!finalNewName || finalNewName === oldName) return;

    renameItemMutation.mutate({ old_path: oldPath, new_name: finalNewName }, {
      onSuccess: (data) => {
        addLog(formatLogMessage(`Đã đổi tên thành: ${finalNewName}`));
        const newPath = data.new_path;

        const newOpenFileIds = openFileIds.map(id => id === oldPath ? newPath : id);
        setOpenFileIds(newOpenFileIds);
        if (activeFileId === oldPath) {
          setActiveFileId(newPath);
        }
      },
      onError: (err: any) => addLog(formatLogMessage(`Lỗi khi đổi tên: ${err.message}`)),
    });
  };

  const handleDeleteNode = async () => {
    if (!contextMenu.node) return;
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn ${contextMenu.node.type === 'folder' ? 'thư mục' : 'file'} "${contextMenu.node.name}"?`)) return;

    deleteItemMutation.mutate(contextMenu.node.id, {
      onSuccess: () => {
        addLog(formatLogMessage(`Đã xóa: ${contextMenu.node!.name}`));
        const newOpenFileIds = openFileIds.filter(id => !id.startsWith(contextMenu.node!.id));
        setOpenFileIds(newOpenFileIds);
        if (activeFileId.startsWith(contextMenu.node!.id)) {
          setActiveFileId(newOpenFileIds.length > 0 ? newOpenFileIds[newOpenFileIds.length - 1] : '');
        }
      },
      onError: (err: any) => addLog(formatLogMessage(`Lỗi khi xóa: ${err.message}`)),
    });
  };
  const renderVscodeItem = ({ item, depth, children, title, context, arrow }: {
    item: TreeItem<any>;
    depth: number;
    children: React.ReactNode;
    title: React.ReactNode;
    context: TreeItemRenderContext<any>;
    arrow: React.ReactNode;
  }) => {
    const isActive = context.isSelected || context.isFocused;
    return (
      <li
        {...context.itemContainerWithChildrenProps}
        className={cn("rct-item-li flex flex-col items-start text-xs list-none")}
      >
        <div
          {...context.interactiveElementProps}
          className={cn(
            "flex items-center w-full gap-1.5 py-1 pr-1 relative select-none cursor-pointer",
            isActive ? "bg-[#37373d] text-gray-100" : "text-gray-400 hover:bg-[#2a2d2e]"
          )}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={(e) => {
            if (context.interactiveElementProps.onClick) {
              context.interactiveElementProps.onClick(e);
            }
            handleFileClick({ id: item.index as string, name: item.data, type: item.isFolder ? 'folder' : 'file' });
          }}
          onContextMenu={(e) => {
            if (context.interactiveElementProps.onContextMenu) {
               context.interactiveElementProps.onContextMenu(e);
            }
            const node: FileNode = {
              id: item.index as string, 
              name: item.data, 
              type: item.isFolder ? 'folder' : 'file',
            };
            showContextMenu(e.pageX, e.pageY, node);
          }}
        >
          {arrow}
          {item.isFolder ? (
            <Folder size={14} className="text-blue-400" />
          ) : (
            <File size={14} className={cn(isActive ? "text-blue-400" : "text-gray-500")} />
          )}
          <span className="truncate flex-1">{title}</span>
        </div>
        {children}
      </li>
    );
  };

  const treeDataProvider = React.useMemo(() => {
    function convertFileNodesToTreeData(nodes: FileNode[]): Record<TreeItemIndex, TreeItem> {
      const data: Record<TreeItemIndex, TreeItem> = {
        root: {
          index: 'root',
          isFolder: true,
          children: nodes.map(node => node.id),
          data: 'Workspace'
        }
      };

      function traverse(nodes: FileNode[]) {
        for (const node of nodes) {
          data[node.id] = {
            index: node.id,
            isFolder: node.type === 'folder',
            children: node.children ? node.children.map(child => child.id) : [],
            data: node.name,
          };
          if (node.children) {
            traverse(node.children);
          }
        }
      }
      traverse(nodes);
      return data;
    }
    
    const newTreeData = convertFileNodesToTreeData(fileTree);
    return new StaticTreeDataProvider(newTreeData, (item, data) => ({ ...item, data }));
  }, [fileTree]);

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white overflow-hidden font-sans" onContextMenu={(e) => e.preventDefault()}>
      <header className="h-12 border-b border-[#333] flex items-center justify-between px-4 bg-[#252526] shrink-0 z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsGlobalSettingsOpen(true)}
            className="bg-blue-600 p-1.5 rounded hover:bg-blue-700 transition-colors"
            title="Global Application Settings"
          >
            <SettingsIcon size={20} className="rotate-90" />
          </button>
          <h1 className="font-bold text-sm tracking-tight hidden sm:block">Nhanzzzz CP Editor</h1>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsSnippetManagerOpen(true)}
            className="p-2 rounded transition-colors hover:bg-[#333] text-gray-400"
            title="Snippet Manager"
          >
            <Scissors size={20} />
          </button>

          <div className="w-px h-6 bg-[#333] mx-1" />

          <button 
            onClick={handleRun}
            disabled={runStatus !== 'idle'}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded text-sm font-medium transition-all active:scale-95 min-w-[120px] justify-center",
              runStatus === 'idle' ? "bg-green-600 hover:bg-green-700" : "bg-blue-600/50 cursor-not-allowed"
            )}
          >
            {runStatus === 'idle' ? (
              <>
                <Play size={16} fill="currentColor" />
                Run Code
              </>
            ) : runStatus === 'compiling' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Compiling...
              </>
            ) : (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running {currentTestIndex}/{testcases.length}
              </>
            )}
          </button>
          
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded transition-colors hover:bg-[#333] text-gray-400"
            title="Compiler Settings"
          >
            <SettingsIcon size={20} />
          </button>

          <div className="w-px h-6 bg-[#333] mx-1" />

          <button 
            onClick={() => treePanelRef.current?.isCollapsed() ? treePanelRef.current?.expand() : treePanelRef.current?.collapse()}
            className={cn(
              "p-2 rounded transition-colors hover:bg-[#333]",
              isTreeOpen ? "text-blue-400 bg-[#333]" : "text-gray-400"
            )}
            title="Toggle Folder Tree"
          >
            <FolderTree size={20} />
          </button>

          <button 
            onClick={() => terminalPanelRef.current?.isCollapsed() ? terminalPanelRef.current?.expand() : terminalPanelRef.current?.collapse()}
            className={cn(
              "p-2 rounded transition-colors hover:bg-[#333]",
              isTerminalOpen ? "text-blue-400 bg-[#333]" : "text-gray-400"
            )}
            title="Toggle Terminal"
          >
            <TerminalIcon size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 w-full overflow-hidden relative">
        <PanelGroup direction="vertical" className="w-full h-full">
          <Panel minSize={30} className="min-h-0">
            <PanelGroup direction="horizontal" className="w-full h-full">
              <Panel 
                ref={treePanelRef}
                defaultSize={15} 
                minSize={5} 
                collapsible={true}
                onCollapse={() => setTreeOpen(false)}
                onExpand={() => setTreeOpen(true)}
              >
                <div className="h-full flex flex-col bg-[#252526] border-r border-[#333] overflow-hidden">
                  <div className="flex items-center justify-between pl-3 pr-2 py-2 border-b border-[#333] bg-[#1e1e1e] shrink-0">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Explorer</div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={handleOpenWorkspace} 
                        className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" 
                        title="Open Workspace Folder"
                      >
                        <FolderOpen size={14} />
                      </button>
                      
                      <button 
                        onClick={() => handleCreateItem('file')} 
                        className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" 
                        title="New File"
                      >
                        <FilePlus size={14} />
                      </button>
                      <button 
                        onClick={() => handleCreateItem('folder')} 
                        className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" 
                        title="New Folder"
                      >
                        <Folder size={14} />
                      </button>
                      <button 
                        onClick={refreshTree} 
                        className="p-1 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors" 
                        title="Refresh Tree"
                      >
                        <FolderTree size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2 rct-dark">
                    {isFileTreeLoading ? (
                      <div className="flex items-center justify-center h-full text-xs text-gray-500 gap-2">
                        <Loader2 size={14} className="animate-spin" />
                        Loading...
                      </div>
                    ) : fileTree.length > 0 ? (
                      <UncontrolledTreeEnvironment
                        canDragAndDrop={false}
                        canDropOnFolder={false}
                        canReorderItems={false}
                        dataProvider={treeDataProvider}
                        getItemTitle={item => item.data}
                        viewState={treeViewState}
                        onExpandItem={item => {}}
                        onCollapseItem={item => {}}
                        onRenameItem={async (item, newName) => {
                          await handleRenameNode(item.index as string, item.data, newName);
                        }}
                        renderItem={renderVscodeItem}
                        renderTreeContainer={({ children, ...props }) => (
                          <ul {...props} className="rct-tree-root w-full h-full !bg-transparent">
                            {children}
                          </ul>
                        )}
                      >
                        <Tree treeId="tree-1" rootItem="root" treeLabel="File Explorer" />
                      </UncontrolledTreeEnvironment>
                    ) : <div className="text-center text-xs text-gray-600 p-4">Workspace is empty.</div>}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-[#1e1e1e] hover:bg-blue-600/30 transition-colors flex items-center justify-center group relative z-10">
                <div className="w-px h-full bg-[#333] group-hover:bg-blue-400" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#252526] border border-[#333] rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={10} className="text-gray-400" />
                </div>
              </PanelResizeHandle>

              <Panel defaultSize={55} minSize={20}>
                <div className="h-full flex flex-col bg-[#1e1e1e] overflow-hidden">
                  <div className="flex bg-[#252526] overflow-x-auto scrollbar-none border-b border-[#333] shrink-0">
                    {openFileIds.map(id => {
                      const file = findFileById(id, fileTree);
                      const isUnsaved = unsavedFileIds.has(id);
                      if (!file) return null;
                      return (
                        <div 
                          key={id}
                          draggable
                          onDragStart={() => setDraggedTabId(id)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!draggedTabId || draggedTabId === id) return;
                            
                            const newIds = [...openFileIds];
                            const dragIndex = newIds.indexOf(draggedTabId);
                            const dropIndex = newIds.indexOf(id);
                            
                            newIds.splice(dragIndex, 1);
                            newIds.splice(dropIndex, 0, draggedTabId);

                            setOpenFileIds(newIds);
                            setDraggedTabId(null);
                          }}
                          onClick={() => setActiveFileId(id)}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-xs cursor-pointer border-r border-[#333] min-w-[120px] max-w-[200px] transition-colors group",
                            activeFileId === id ? "bg-[#1e1e1e] text-blue-400" : "text-gray-500 hover:bg-[#2a2d2e] hover:text-gray-300",
                            draggedTabId === id ? "opacity-50" : ""
                          )}
                        >
                          <File size={14} className={cn(activeFileId === id ? "text-blue-400" : "text-gray-500")} />
                          <span className="truncate flex-1">{file.name}</span>
                          <button
                            onClick={(e) => closeTab(e, id)}
                            className="p-0.5 rounded hover:bg-[#333]/70 transition-all text-gray-500 hover:text-gray-200"
                            aria-label={`Close ${file.name}`}
                          >
                            {isUnsaved ? (
                              <div className="w-3 h-3 flex items-center justify-center group-hover:hidden"><div className="w-1.5 h-1.5 rounded-full bg-current" /></div>
                            ) : null}
                            <X size={12} className={cn("transition-opacity", isUnsaved ? "hidden group-hover:block" : "opacity-0 group-hover:opacity-100")} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  <div 
                    className="flex-1 relative min-h-0"
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={(e) => e.preventDefault()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {activeFileId ? (
                      !isFileLoading ? (
                        <Editor // This should be isFileLoading
                          key={activeFileId}
                          height="100%"
                          language={getLanguage(activeFileId)}
                          theme="vs-dark"
                          path={activeFileId} 
                          value={editorContent} 
                          onMount={(editor, monaco) => {
                            editorRef.current = editor; // Giữ lại ref đến editor instance
                          }}
                          onChange={handleEditorChange}
                          options={{
                            minimap: { enabled: false },
                            fontSize: globalConfig?.editorFontSize,
                            padding: { top: 16 },
                            scrollBeyondLastLine: false,
                            automaticLayout: true,
                            fontFamily: globalConfig?.editorFontFamily,
                            cursorSmoothCaretAnimation: 'on',
                            cursorBlinking: 'smooth',
                            smoothScrolling: true,
                          }}
                        />
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm gap-3">
                          <Loader2 size={24} className="animate-spin text-blue-500" />
                          Đang tải nội dung file...
                        </div>
                      )
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-600 italic text-sm">
                        Select a file, or drop one here.
                      </div>
                    )}
                  </div>
                </div>
              </Panel>

              <PanelResizeHandle className="w-1.5 bg-[#1e1e1e] hover:bg-blue-600/30 transition-colors flex items-center justify-center group relative z-10">
                <div className="w-px h-full bg-[#333] group-hover:bg-blue-400" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#252526] border border-[#333] rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={10} className="text-gray-400" />
                </div>
              </PanelResizeHandle>

              <Panel defaultSize={30} minSize={20}>
                <div className="h-full flex flex-col bg-[#252526] overflow-hidden border-l border-[#333]">
                  <div className="flex border-b border-[#333] bg-[#1e1e1e]">
                    <button 
                      onClick={() => setActiveTab('testcases')}
                      className={cn(
                        "px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
                        activeTab === 'testcases' ? "border-blue-500 text-blue-400 bg-[#252526]" : "border-transparent text-gray-500 hover:text-gray-300"
                      )}
                    >
                      Testcases
                    </button>
                    <button 
                      onClick={() => setActiveTab('stress')}
                      className={cn(
                        "px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors border-b-2",
                        activeTab === 'stress' ? "border-blue-500 text-blue-400 bg-[#252526]" : "border-transparent text-gray-500 hover:text-gray-300"
                      )}
                    >
                      Stress Test
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {activeTab === 'testcases' ? (
                      <div className="p-4 space-y-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-gray-400 text-xs font-bold uppercase tracking-wider">
                            <FlaskConical size={14} />
                            Manage Testcases
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={handleFolderSelect}
                              className="p-1.5 rounded hover:bg-[#333] text-gray-400 hover:text-blue-400 transition-colors"
                              title="Load from folder"
                            >
                              <FolderOpen size={16} />
                            </button>
                            <button 
                              onClick={addTestCase}
                              className="p-1.5 rounded hover:bg-[#333] text-gray-400 hover:text-green-400 transition-colors"
                              title="Add testcase"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-8">
                          {testcases.map((tc, index) => (
                            <TestCaseItem
                              key={tc.id}
                              tc={tc}
                              index={index}
                              onUpdate={updateTestCase}
                              onRemove={removeTestCase}
                              onRun={runSingleTestCase}
                              runStatus={runStatus}
                              onOpenDiff={(expected, actual) => {
                                setDiffExpected(expected);
                                setDiffActual(actual);
                                setIsDiffOpen(true);
                              }}
                              isDiffSupported={isDiffSupported}
                          onOpenView={(tcData) => {
                            setViewTcData(tcData);
                            setIsViewTcOpen(true);
                          }}
                            />
                          ))}
                        </div>
                        
                        <button 
                          onClick={addTestCase}
                          className="w-full py-3 border-2 border-dashed border-[#3c3c3c] rounded-lg text-gray-500 hover:text-gray-300 hover:border-[#555] transition-all flex items-center justify-center gap-2 text-sm font-medium"
                        >
                          <Plus size={16} />
                          Add New Testcase
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 flex flex-col h-full">
                        <div className="flex items-center gap-2 mb-4 text-gray-400 text-xs font-bold uppercase tracking-wider">
                          <FlaskConical size={14} />
                          Stress Test Configuration
                        </div>

                        <div className="space-y-4">
                          <FileSelector 
                            label="Code Trâu (Brute)" 
                            file={bruteFile} 
                            onSelect={() => handleFileSelect('brute')} 
                          />
                          <FileSelector 
                            label="Code AC (Target)" 
                            file={acFile} 
                            onSelect={() => handleFileSelect('ac')} 
                          />
                          <FileSelector 
                            label="Random Test Gen" 
                            file={genFile} 
                            onSelect={() => handleFileSelect('gen')} 
                          />

                          <button 
                            onClick={startStressTest}
                            disabled={!bruteFile || !acFile || !genFile || isStressing}
                            className="w-full mt-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-95"
                          >
                            <FlaskConical size={16} />
                            {isStressing ? 'Stress Testing...' : 'Start Stress Test'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Panel>
            </PanelGroup>
          </Panel>

          <PanelResizeHandle className="w-full h-1.5 bg-[#1e1e1e] hover:bg-blue-600/30 transition-colors flex items-center justify-center group relative z-10 cursor-row-resize">
            <div className="h-px w-full bg-[#333] group-hover:bg-blue-400" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#252526] border border-[#333] rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <GripHorizontal size={10} className="text-gray-400" />
            </div>
          </PanelResizeHandle>

          <Panel 
            ref={terminalPanelRef}
            defaultSize={20} 
            minSize={5} 
            collapsible={true}
            onCollapse={() => setTerminalOpen(false)}
            onExpand={() => setTerminalOpen(true)}
            className="w-full" 
          >
            <Terminal logs={logs} onClear={clearLogs} />
          </Panel>
        </PanelGroup>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        setSettings={setSettings}
        isPythonFile={isPythonFile} // Pass a prop to indicate file type
      />

      {globalConfig && (
        <GlobalSettingsModal
          isOpen={isGlobalSettingsOpen}
          onClose={() => setIsGlobalSettingsOpen(false)}
          globalSettings={globalConfig}
          onSave={(newConfig) => saveGlobalConfigMutation.mutate(newConfig)}
        />
      )}

      <DiffViewerModal
        isOpen={isDiffOpen}
        onClose={() => setIsDiffOpen(false)}
        expected={diffExpected}
        actual={diffActual}
      />

      <TestCaseViewerModal
        isOpen={isViewTcOpen}
        onClose={() => setIsViewTcOpen(false)}
        tc={testcases.find(t => t.id === viewTcData?.id) || null}
        onUpdate={updateTestCase}
      />

      <SnippetManagerModal
        isOpen={isSnippetManagerOpen}
        onClose={() => setIsSnippetManagerOpen(false)}
        snippets={globalConfig?.snippets || []}
        onUpdate={(newSnippets) => saveGlobalConfigMutation.mutate({ ...globalConfig, snippets: newSnippets } as GlobalConfig)}
      />

      <SnippetMenu
        isOpen={isSnippetMenuOpen}
        onClose={() => setIsSnippetMenuOpen(false)}
        snippets={globalConfig?.snippets || []}
        onSelect={insertSnippet}
      />

      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={onFileChange}
        accept=".cpp,.c,.py,.java,.txt"
      />

      <input
        type="file"
        ref={folderInputRef}
        className="hidden"
        onChange={onFolderChange}
        {...({ webkitdirectory: "", directory: "" } as any)}
      />

      {contextMenu.visible && contextMenu.node && (
        <div
          className="fixed z-50 bg-[#252526] border border-[#3c3c3c] shadow-2xl rounded py-1.5 w-48 text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onContextMenu={(e) => e.preventDefault()}
        >
          {contextMenu.node.type === 'folder' && (
            <>
              <button
                onClick={() => handleCreateItem('file', contextMenu.node?.id)}
                className="w-full text-left px-4 py-2 hover:bg-blue-600 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <FilePlus size={14} /> File mới
              </button>
              <button
                onClick={() => handleCreateItem('folder', contextMenu.node?.id)}
                className="w-full text-left px-4 py-2 hover:bg-blue-600 text-gray-300 hover:text-white transition-colors flex items-center gap-2"
              >
                <Folder size={14} /> Thư mục mới
              </button>
              <div className="h-px bg-[#3c3c3c] my-1" />
            </>
          )}
          <button
            onClick={() => handleRenameNode(contextMenu.node!.id, contextMenu.node!.name)}
            className="w-full text-left px-4 py-2 hover:bg-[#333] text-gray-300 hover:text-white transition-colors"
          >
            Đổi tên (Rename)
          </button>
          <div className="h-px bg-[#3c3c3c] my-1" />
          <button
            onClick={handleDeleteNode}
            className="w-full text-left px-4 py-2 hover:bg-red-600/20 text-red-400 hover:text-red-300 transition-colors"
          >
            Xóa (Delete)
          </button>
        </div>
      )}
    </div>
  );
}

const FileSelector = ({ label, file, onSelect }: { label: string, file: FileState | null, onSelect: () => void }) => {
  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 ml-1">{label}</span>
        {file && <span className="text-[10px] text-green-500 font-mono">Loaded</span>}
      </div>
      <button
        onClick={onSelect}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-2 border rounded text-sm transition-all text-left overflow-hidden",
          file
            ? "border-blue-500 bg-blue-500/10 text-blue-100"
            : "border-[#3c3c3c] bg-[#1e1e1e] text-gray-400 hover:border-gray-500"
        )}
      >
        <Upload size={14} className="shrink-0" />
        <span className="truncate">{file ? file.name : "Select file..."}</span>
      </button>
    </div>
  );
};