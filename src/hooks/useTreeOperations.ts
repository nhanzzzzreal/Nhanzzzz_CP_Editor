import { useCallback } from 'react';
import { useAppStore } from '../store';
import { useDataStore } from '../dataStore';

export const useTreeOperations = (formatLogMessage: (msg: string) => string) => {
  const { activeFileId, setActiveFileId, openFileIds, setOpenFileIds, addLog, contextMenu } = useAppStore();
  const { createItem, renameItem, deleteItem } = useDataStore();

  const handleCreateItem = useCallback(async (type: 'file' | 'folder', targetParentPath?: string) => {
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
    try {
      await createItem(parentPath, name, type);
      addLog(formatLogMessage(`Đã tạo ${type}: ${name}`));
    } catch (err: any) {
      addLog(formatLogMessage(`Lỗi khi tạo: ${err.message}`));
    }
  }, [activeFileId, createItem, addLog, formatLogMessage]);

  const handleRenameNode = useCallback(async (oldPath: string, oldName: string, newName?: string) => {
    const finalNewName = newName ?? window.prompt('Nhập tên mới:', oldName);
    if (!finalNewName || finalNewName === oldName) return;

    try {
      const data = await renameItem(oldPath, finalNewName);
      if (data) {
        addLog(formatLogMessage(`Đã đổi tên thành: ${finalNewName}`));
        const newPath = data.new_path;

        const newOpenFileIds = openFileIds.map(id => id === oldPath ? newPath : id);
        setOpenFileIds(newOpenFileIds);
        if (activeFileId === oldPath) {
          setActiveFileId(newPath);
        }
      }
    } catch (err: any) {
      addLog(formatLogMessage(`Lỗi khi đổi tên: ${err.message}`));
    }
  }, [renameItem, addLog, formatLogMessage, openFileIds, setOpenFileIds, activeFileId, setActiveFileId]);

  const handleDeleteNode = useCallback(async () => {
    if (!contextMenu.node) return;
    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn ${contextMenu.node.type === 'folder' ? 'thư mục' : 'file'} "${contextMenu.node.name}"?`)) return;

    try {
      await deleteItem(contextMenu.node.id);
      addLog(formatLogMessage(`Đã xóa: ${contextMenu.node!.name}`));
      const newOpenFileIds = openFileIds.filter(id => !id.startsWith(contextMenu.node!.id));
      setOpenFileIds(newOpenFileIds);
      if (activeFileId.startsWith(contextMenu.node!.id)) {
        setActiveFileId(newOpenFileIds.length > 0 ? newOpenFileIds[newOpenFileIds.length - 1] : '');
      }
    } catch (err: any) {
      addLog(formatLogMessage(`Lỗi khi xóa: ${err.message}`));
    }
  }, [contextMenu.node, deleteItem, addLog, formatLogMessage, openFileIds, setOpenFileIds, activeFileId, setActiveFileId]);

  return { handleCreateItem, handleRenameNode, handleDeleteNode };
};