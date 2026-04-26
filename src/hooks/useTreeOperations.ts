import { useCallback } from 'react';
import { useAppStore } from '../store';
import { useDataStore } from '../dataStore';
import { useSessionStore } from '../sessionStore';

export const useTreeOperations = (formatLogMessage: (msg: string) => string) => {
  const createItem = useDataStore(state => state.createItem);
  const renameItem = useDataStore(state => state.renameItem);
  const deleteItem = useDataStore(state => state.deleteItem);

  const handleCreateItem = useCallback(async (type: 'file' | 'folder', targetParentPath?: string) => {
    const name = prompt(`Nhập tên ${type === 'file' ? 'tập tin' : 'thư mục'} mới:`);
    if (!name) return;

    let parentPath = targetParentPath || 'workspace';
    const activeSessionId = useSessionStore.getState().activeSessionId;
    if (!targetParentPath && activeSessionId && !activeSessionId.startsWith('temp')) {
      const parts = activeSessionId.split('/');
      if (parts.length > 1) {
        parts.pop();
        parentPath = parts.join('/');
      }
    }
    try {
      await createItem(parentPath, name, type);
      useAppStore.getState().addLog(formatLogMessage(`Đã tạo ${type}: ${name}`));
    } catch (err: any) {
      useAppStore.getState().addLog(formatLogMessage(`Lỗi khi tạo: ${err.message}`));
    }
  }, [createItem, formatLogMessage]);

  const handleRenameNode = useCallback(async (oldPath: string, oldName: string, newName?: string) => {
    const finalNewName = newName ?? window.prompt('Nhập tên mới:', oldName);
    if (!finalNewName || finalNewName === oldName) return;

    try {
      const data = await renameItem(oldPath, finalNewName);
      if (data) {
        useAppStore.getState().addLog(formatLogMessage(`Đã đổi tên thành: ${finalNewName}`));
        const newPath = data.new_path;

        const sessionStore = useSessionStore.getState();
        const newOpenSessionIds = sessionStore.openSessionIds.map(id => id === oldPath ? newPath : id);
        sessionStore.setOpenSessionIds(newOpenSessionIds);
        if (sessionStore.activeSessionId === oldPath) {
          sessionStore.setActiveSessionId(newPath);
        }
      }
    } catch (err: any) {
      useAppStore.getState().addLog(formatLogMessage(`Lỗi khi đổi tên: ${err.message}`));
    }
  }, [renameItem, formatLogMessage]);

  const handleDeleteNode = useCallback(async () => {
    const contextMenu = useAppStore.getState().contextMenu;
    if (!contextMenu.node) return;
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn ${contextMenu.node.type === 'folder' ? 'thư mục' : 'file'} "${contextMenu.node.name}"?`)) return;

    try {
      await deleteItem(contextMenu.node.id);
      useAppStore.getState().addLog(formatLogMessage(`Đã xóa: ${contextMenu.node!.name}`));
      const sessionStore = useSessionStore.getState();
      const newOpenSessionIds = sessionStore.openSessionIds.filter(id => !id.startsWith(contextMenu.node!.id));
      sessionStore.setOpenSessionIds(newOpenSessionIds);
      if (sessionStore.activeSessionId.startsWith(contextMenu.node!.id)) {
        sessionStore.setActiveSessionId(newOpenSessionIds.length > 0 ? newOpenSessionIds[newOpenSessionIds.length - 1] : '');
      }
    } catch (err: any) {
      useAppStore.getState().addLog(formatLogMessage(`Lỗi khi xóa: ${err.message}`));
    }
  }, [deleteItem, formatLogMessage]);

  return { handleCreateItem, handleRenameNode, handleDeleteNode };
};