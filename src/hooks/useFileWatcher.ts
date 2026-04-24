import { useEffect } from 'react';
import { useDataStore } from '../dataStore';

const API_BASE_URL = 'http://localhost:3691/api';

export const useFileWatcher = () => {
  const fetchFileTree = useDataStore(state => state.fetchFileTree);

  useEffect(() => {
    const evtSource = new EventSource(`${API_BASE_URL}/files/watch`);
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'change') {
          fetchFileTree(true);
        }
      } catch (e) {}
    };
    return () => evtSource.close();
  }, [fetchFileTree]);
};