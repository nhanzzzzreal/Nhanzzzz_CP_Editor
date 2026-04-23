import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as monaco from 'monaco-editor';
import { Play, Terminal as TerminalIcon, FlaskConical, GripVertical, GripHorizontal, FolderOpen, Settings as SettingsIcon, Folder, Loader2, FilePlus, FolderTree, Scissors } from 'lucide-react';
import { PanelGroup, Panel, PanelResizeHandle, ImperativePanelHandle } from 'react-resizable-panels';
import { useDebouncedCallback } from 'use-debounce';

import { cn } from './lib/utils';
import { AppSettings, FileNode, FileState, GlobalConfig, TestCase, CppSettings, PythonSettings } from './types';
import { useAppStore } from './store';
import { useDataStore } from './dataStore';

// --- Component Imports ---
import { SettingsModal } from './components/SettingsModal';
import { TestCaseItem } from './components/TestCaseItem';
import { Terminal } from './components/Terminal';
import { SnippetManagerModal } from './components/SnippetManagerModal';
import { SnippetMenu } from './components/SnippetMenu';
import { GlobalSettingsModal } from './components/GlobalSettingsModal';
import { useHotkeys } from 'react-hotkeys-hook';
import { DiffViewerModal } from './components/DiffViewerModal';
import { MonacoEditor, CodeEditorRef } from './components/MonacoEditor';
import { TestCaseViewerModal } from './components/TestCaseViewerModal';
import { FileExplorer } from './components/FileExplorer';
import { useCodeExecution } from './hooks/useCodeExecution';
import { useTreeOperations } from './hooks/useTreeOperations';
import { TestcaseManager } from './components/TestcaseManager';
import { StressTest } from './components/StressTest';
import { FileTabs } from './components/FileTabs';

// --- Constants ---
const API_BASE_URL = 'http://localhost:3691/api'; // Default FastAPI port

const getLanguage = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.py')) return 'python';
  if (lower.endsWith('.cpp') || lower.endsWith('.c') || lower.endsWith('.h') || lower.endsWith('.hpp')) return 'cpp';
  return 'plaintext';
};

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
    monacoModels, addMonacoModel, updateMonacoModelCursor, removeMonacoModel,
    hydrate: hydrateStore,
  } = useAppStore();

  // Helper to determine if the active file is Python
  const isPythonFile = useMemo(() => activeFileId.toLowerCase().endsWith('.py'), [activeFileId]);

  // Local State
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  
  const [isDiffOpen, setIsDiffOpen] = useState(false);
  const [diffExpected, setDiffExpected] = useState('');
  const [diffActual, setDiffActual] = useState('');
  
  const [isViewTcOpen, setIsViewTcOpen] = useState(false);
  const [viewTcData, setViewTcData] = useState<TestCase | null>(null);
  const [isDataDirty, setIsDataDirty] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const isSettingFromLoad = useRef(false);
  
  // Đồng bộ lại testcases từ Database sau khi chạy xong
  const prevRunStatus = useRef(runStatus);
  useEffect(() => {
    if (prevRunStatus.current !== 'idle' && runStatus === 'idle') {
      if (activeFileId && !activeFileId.startsWith('temp')) {
        refreshFileData(activeFileId, isPythonFile).then(cache => {
          if (cache && cache.testcases && cache.testcases.length > 0) {
            isSettingFromLoad.current = true;
            setTestcases(cache.testcases);
            setTimeout(() => { isSettingFromLoad.current = false; }, 50);
          }
        });
      }
    }
    prevRunStatus.current = runStatus;
  }, [runStatus, activeFileId, isPythonFile]);

  // Refs
  const editorRef = useRef<CodeEditorRef>(null);
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
    { id: crypto.randomUUID(), name: 'Test 1', input: '', answer: null, output: '', status: 'pending', time: -1, memory: -1 } as any
  ]);

  const terminalPanelRef = useRef<ImperativePanelHandle>(null);
  const treePanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  
  // Zustand Data Store
  const {
    globalConfig, fileTree, isFileTreeLoading,
    fetchGlobalConfig, saveGlobalConfig,
    fetchFileTree, loadFileData, refreshFileData,
    updateFileCache, saveFileData, saveFileContent,
    openWorkspace, openFileDialog
  } = useDataStore();

  useEffect(() => {
    fetchGlobalConfig();
    fetchFileTree();
  }, [fetchGlobalConfig, fetchFileTree]);

  useEffect(() => {
    const evtSource = new EventSource(`${API_BASE_URL}/files/watch`);
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'change') {
          fetchFileTree(true); // Chỉ cập nhật dữ liệu ngầm, không bật màn hình Loading
        }
      } catch (e) {}
    };
    return () => {
      evtSource.close();
    };
  }, [fetchFileTree]);

  const handleFileOpenClick = useCallback(async () => {
    const data = await openFileDialog();
    if (data) {
      openFile(data.path);
      addLog(formatLogMessage(`Opened file: ${data.name}`));
      fetchFileTree();
    }
  }, [openFileDialog, openFile, addLog, fetchFileTree, formatLogMessage]);

  const saveActiveFile = useCallback(() => {
    if (!activeFileId || activeFileId.startsWith('temp')) return;
    let saved = false;
    
    const state = latestStateRef.current;

    if (state.unsavedFileIds.has(activeFileId)) {
      const currentContent = editorRef.current?.getValue() || '';
        saveFileContent(activeFileId, currentContent);
      removeUnsaved(activeFileId);
      saved = true;
    }
    
    if (state.isDataDirty) {
        updateFileCache(activeFileId, { settings: state.settings, testcases: state.testcases });
        saveFileData(activeFileId);
      setIsDataDirty(false);
      saved = true;
    }
    
    if (saved) {
      addLog(formatLogMessage(`File saved successfully.`));
    } else {
      addLog(formatLogMessage(`No changes to save.`));
    }
  }, [activeFileId, addLog, removeUnsaved, saveFileContent, saveFileData, updateFileCache, formatLogMessage]);

  const handleOpenWorkspace = useCallback(async () => {
    const path = await openWorkspace();
    if (path) {
      addLog(`Workspace changed to: ${path}`);
      setOpenFileIds([]);
      setActiveFileId('');
      fetchFileTree();
      fetchGlobalConfig();
    }
  }, [openWorkspace, addLog, setOpenFileIds, setActiveFileId, fetchFileTree, fetchGlobalConfig]);

  const handleTabSwitch = useCallback((id: string) => {
    if (id === activeFileId) return;
    
    const state = latestStateRef.current;

    // Lưu trạng thái file hiện tại vào RAM cache trước khi rời đi
    if (activeFileId && editorRef.current) {
      updateFileCache(activeFileId, { settings: state.settings, testcases: state.testcases });
      if (state.isDataDirty) {
        saveFileData(activeFileId);
      }
    }

    // BATCH UPDATE: Cập nhật song song state để tránh "Zombie UI" (Chớp giao diện)
    const targetCache = useDataStore.getState().fileCache[id];
    isSettingFromLoad.current = true;
    setIsDataDirty(false);
    setActiveFileId(id);
    
    if (targetCache) {
      setSettings(targetCache.settings);
      setTestcases(targetCache.testcases);
    } else {
      setTestcases([]);
    }
    setTimeout(() => { isSettingFromLoad.current = false; }, 50);
  }, [activeFileId, updateFileCache, saveFileData, setActiveFileId]);

  const { handleCreateItem, handleRenameNode, handleDeleteNode } = useTreeOperations(formatLogMessage);

  const findFileById = useCallback((id: string, nodes: FileNode[]): FileNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findFileById(id, node.children);
        if (found) return found;
      }
    }
    return null;
  }, []);
  const activeFile = useMemo(() => findFileById(activeFileId, fileTree), [activeFileId, fileTree, findFileById]);

  const { handleRun, runSingleTestCase } = useCodeExecution({
    activeFileId,
    activeFile,
    editorRef,
    settings,
    globalConfig,
    testcases,
    setTestcases,
    isFileLoading,
    setIsDataDirty,
    formatLogMessage
  });

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
          const currentContent = editorRef.current?.getValue() || '';
            saveFileContent(state.activeFileId, currentContent);
          removeUnsaved(state.activeFileId);
        }
        if (state.isDataDirty) {
            updateFileCache(state.activeFileId, { settings: state.settings, testcases: state.testcases });
            saveFileData(state.activeFileId);
          setIsDataDirty(false);
        }
      }
    }, delay);
    return () => clearInterval(timer); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalConfig?.autoSaveDelay, saveFileContent, saveFileData, removeUnsaved, updateFileCache]);

  // Hydrate store with initial file state from global config
  const isHydrated = useRef(false);
  useEffect(() => {
    if (globalConfig && !isHydrated.current) {
      hydrateStore(globalConfig);
      isHydrated.current = true;
    }
  }, [globalConfig, hydrateStore]);

  const debouncedSaveGlobalConfig = useDebouncedCallback((config: GlobalConfig) => {
    saveGlobalConfig(config);
  }, 1500);

  // Dùng useRef để giữ config mới nhất mà không kích hoạt lại useEffect
  const latestConfigRef = useRef(globalConfig);
  useEffect(() => { latestConfigRef.current = globalConfig; }, [globalConfig]);

  useEffect(() => {
    if (latestConfigRef.current && isHydrated.current) { 
      debouncedSaveGlobalConfig({ ...latestConfigRef.current, openFileIds, activeFileId });
    }
  }, [openFileIds, activeFileId, debouncedSaveGlobalConfig]);

  // Function to update a single testcase, now defined in App.tsx to be passed to TestCaseViewerModal
  const updateTestCase = useCallback((id: string, field: keyof TestCase, value: string) => {
    setTestcases(prev => prev.map(tc => tc.id === id ? { ...tc, [field]: value } : tc));
    setIsDataDirty(true); // Mark data as dirty when a testcase is updated
  }, []);
  
  const handleOpenDiff = useCallback((expected: string, actual: string) => { 
    setDiffExpected(expected); setDiffActual(actual); setIsDiffOpen(true); 
  }, []);

  const handleOpenView = useCallback((tcData: TestCase) => { 
    setViewTcData(tcData); setIsViewTcOpen(true); 
  }, []);

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

  const handleFileClick = useCallback(async (node: FileNode) => {
    if (node.type === 'file') {
      openFile(node.id);
    } else { 
      // Logic to toggle folder in tree view state would go here if needed
      // For now, react-complex-tree handles its internal open/close state
    }
  }, [openFile]);

  useEffect(() => {
    let isActive = true;

    if (!activeFileId) {
      setTestcases([{ id: crypto.randomUUID(), name: 'Test 1', input: '', answer: null, output: '', status: 'pending', time: -1, memory: -1 } as any]);
      return;
    }

    const currentCache = useDataStore.getState().fileCache[activeFileId];
    if (currentCache) {
      // Khôi phục Monaco Model nếu chưa có trong RAM
      if (!useAppStore.getState().monacoModels[activeFileId]) {
        const model = monaco.editor.createModel(currentCache.content, getLanguage(activeFileId), monaco.Uri.file(activeFileId));
        addMonacoModel(activeFileId, model);
      }
      return; // CỰC KỲ QUAN TRỌNG: Dừng hàm tại đây, không chạy xuống lệnh setIsFileLoading(true)
    } else {
      setTestcases([]);
    }

    setIsFileLoading(true);
    loadFileData(activeFileId, activeFileId.toLowerCase().endsWith('.py')).then(cache => {
      if (!isActive) return; // Tránh ghi đè state nếu user đã chuyển tab khác trong lúc đang tải
      if (cache) {
        isSettingFromLoad.current = true;
        setSettings(cache.settings);
        setTestcases(cache.testcases);
        
        if (!useAppStore.getState().monacoModels[activeFileId]) {
          const model = monaco.editor.createModel(cache.content, getLanguage(activeFileId), monaco.Uri.file(activeFileId));
          addMonacoModel(activeFileId, model);
        }
        
        setIsDataDirty(false);
        setTimeout(() => { isSettingFromLoad.current = false; }, 50);
      }
      setIsFileLoading(false);
    });

    return () => { isActive = false; };
  }, [activeFileId, loadFileData, addMonacoModel]);

  // Tự động focus lại vào Editor mỗi khi chuyển đổi Tab
  useEffect(() => {
    if (activeFileId) {
      setTimeout(() => {
        if (editorRef.current && typeof (editorRef.current as any).focus === 'function') {
          (editorRef.current as any).focus();
        }
      }, 100);
    }
  }, [activeFileId]);

  // Cập nhật cờ dirty khi có thay đổi từ người dùng
  useEffect(() => {
    // NGĂN CHẶN GHI ĐÈ: Không bao giờ bật cờ Save nếu Code đang chạy, bảo vệ trạng thái AC/WA trên Database.
    if (isSettingFromLoad.current || !activeFileId || runStatus !== 'idle') return;
    setIsDataDirty(true);
    updateFileCache(activeFileId, { settings, testcases });
  }, [settings, testcases, activeFileId, updateFileCache, runStatus]);

  const closeTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    closeFile(id);
    removeMonacoModel(id);
  };


  const handleEditorChange = () => {
    if (activeFileId && !unsavedFileIds.has(activeFileId)) {
      addUnsaved(activeFileId);
    }
  };

  const insertSnippet = (content: string) => {
    if (editorRef.current) {
      editorRef.current.insertSnippet(content);
    }
  };

  const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const content = await file.text();
      const fileId = `temp-drop-${Date.now()}-${file.name}`;
      addMonacoModel(fileId, monaco.editor.createModel(content, getLanguage(file.name), monaco.Uri.file(fileId)));
      const newNode: FileNode = { id: fileId, name: file.name, type: 'file', content: content };

      openFile(fileId);

      addLog(formatLogMessage(`Opened ${file.name} from drag-and-drop.`));
      e.dataTransfer.clearData();
    }
  }, [addMonacoModel, openFile, addLog, formatLogMessage]);

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
              runStatus === 'idle' ? "bg-green-600 hover:bg-green-700 text-white" : "bg-blue-600/50 cursor-not-allowed text-gray-300"
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
            onClick={() => rightPanelRef.current?.isCollapsed() ? rightPanelRef.current?.expand() : rightPanelRef.current?.collapse()}
            className={cn(
              "p-2 rounded transition-colors hover:bg-[#333]",
              isRightPanelOpen ? "text-blue-400 bg-[#333]" : "text-gray-400"
            )}
            title="Toggle Testcases Panel"
          >
            <FlaskConical size={20} />
          </button>
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
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Explorer</div>
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
                        onClick={() => fetchFileTree()} 
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
                  <FileExplorer
                    fileTree={fileTree}
                    activeFileId={activeFileId}
                    isLoading={isFileTreeLoading}
                    onFileClick={handleFileClick}
                    onContextMenu={showContextMenu}
                    onRenameNode={handleRenameNode}
                  />
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
                  <FileTabs 
                    openFileIds={openFileIds}
                    activeFileId={activeFileId}
                    unsavedFileIds={unsavedFileIds}
                    handleTabSwitch={handleTabSwitch}
                    closeTab={closeTab}
                    setDraggedTabId={setDraggedTabId}
                    draggedTabId={draggedTabId}
                    findFileById={findFileById}
                    fileTree={fileTree}
                  />

                  <div 
                    className="flex-1 relative min-h-0"
                    onDrop={handleFileDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={(e) => e.preventDefault()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {activeFileId ? (
                      <>
                        {isFileLoading && (
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#1e1e1e] text-gray-500 text-sm gap-3">
                            <Loader2 size={24} className="animate-spin text-blue-500" />
                            Đang tải nội dung file...
                          </div>
                        )}
                {monacoModels[activeFileId] && (
                  <MonacoEditor
                    ref={editorRef}
                    activeFileId={activeFileId}
                    onContentChange={handleEditorChange}
                    onSave={saveActiveFile}
                    globalConfig={globalConfig}
                  />
                )}
                      </>
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

              <Panel 
                ref={rightPanelRef}
                defaultSize={30} 
                minSize={20}
                collapsible={true}
                onCollapse={() => setIsRightPanelOpen(false)}
                onExpand={() => setIsRightPanelOpen(true)}
              >
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

                  <div className="flex-1 overflow-hidden">
                    <div className={cn("h-full", activeTab === 'testcases' ? 'block' : 'hidden')}>
                      <TestcaseManager
                        testcases={testcases}
                        setTestcases={setTestcases}
                        runStatus={runStatus}
                        runSingleTestCase={runSingleTestCase}
                        onOpenDiff={handleOpenDiff}
                        onOpenView={handleOpenView}
                        addLog={addLog}
                        formatLogMessage={formatLogMessage}
                        isDiffSupported={isDiffSupported}
                      />
                    </div>
                    <div className={cn("h-full overflow-y-auto", activeTab === 'stress' ? 'block' : 'hidden')}>
                      <StressTest />
                    </div>
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
          onSave={(newConfig) => saveGlobalConfig(newConfig)}
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
        tc={viewTcData ? (testcases.find(t => t.id === viewTcData.id) || null) : null}
        onUpdate={updateTestCase}
      />

      <SnippetManagerModal
        isOpen={isSnippetManagerOpen}
        onClose={() => setIsSnippetManagerOpen(false)}
        snippets={globalConfig?.snippets || []}
        onUpdate={(newSnippets) => saveGlobalConfig({ ...globalConfig, snippets: newSnippets } as GlobalConfig)}
      />

      <SnippetMenu
        isOpen={isSnippetMenuOpen}
        onClose={() => setIsSnippetMenuOpen(false)}
        snippets={globalConfig?.snippets || []}
        onSelect={insertSnippet}
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