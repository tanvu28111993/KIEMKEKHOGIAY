import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api';
import { storage } from '../storage';
import { PaperRoll } from '../types';

export interface QueueItem {
    id: string;
    data: PaperRoll;
    timestamp: number;
    retryCount: number;
}

const BATCH_SIZE = 5;

export const useSyncWorker = (
    isStorageReady: boolean,
    showNotification: (msg: string, type?: 'success' | 'error' | 'info') => void
) => {
    // OFFLINE QUEUE
    const [offlineQueue, setOfflineQueue] = useState<QueueItem[]>([]);
    
    // SYNC PROGRESS STATE
    const [sessionTotal, setSessionTotal] = useState(0); 
    const [isSyncing, setIsSyncing] = useState(false);

    // --- SYNC LOGIC STATE ---
    const [syncIntervalMs, setSyncIntervalMs] = useState(10000); // Start with 10s
    const isSyncingRef = useRef(false);

    // 1. INIT QUEUE from Storage
    useEffect(() => {
        if (!isStorageReady) return;
        
        const loadQueue = async () => {
             const queue = await storage.getQueue();
             setOfflineQueue(queue);
             if (queue.length > 0) {
                 setSessionTotal(queue.length);
             }
        };
        loadQueue();
    }, [isStorageReady]);

    // 2. PERSIST QUEUE
    useEffect(() => {
        if (!isStorageReady) return;
        storage.setQueue(offlineQueue);
    }, [offlineQueue, isStorageReady]);

    // RESET SESSION TOTAL WHEN QUEUE EMPTY
    useEffect(() => {
        if (offlineQueue.length === 0) {
            setSessionTotal(0);
            setIsSyncing(false);
        }
    }, [offlineQueue.length]);

    // WORKER
    const processSyncQueue = useCallback(async () => {
        if (offlineQueue.length === 0 || isSyncingRef.current || !navigator.onLine) {
            return;
        }

        isSyncingRef.current = true;
        setIsSyncing(true);
        
        const batch = offlineQueue.slice(0, BATCH_SIZE);
        const batchItems = batch.map(b => ({
            ...b.data,
            _clientQueueId: b.id 
        }));

        console.log(`[SyncWorker] Sending batch of ${batch.length} items to Server...`);

        try {
            await api.saveBatchToKiemKeSheet(batchItems);
            console.log(`[SyncWorker] Batch success`);
            
            setOfflineQueue(prev => prev.slice(batch.length));
            showNotification(`Đã lưu ${batch.length} phiếu lên hệ thống`, 'success');
            setSyncIntervalMs(1000); 

        } catch (error: any) {
            console.error(`[SyncWorker] Batch failed`, error);
            setSyncIntervalMs(prev => Math.min(prev * 2, 300000));
            if (syncIntervalMs > 60000) {
                 showNotification(`Lỗi đồng bộ: ${error.message || 'Mất kết nối'}`, 'error');
            }
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }

    }, [offlineQueue, syncIntervalMs, showNotification]);

    // TRIGGER LOOP
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;
        if (offlineQueue.length > 0) {
            timeoutId = setTimeout(() => {
                processSyncQueue();
            }, syncIntervalMs);
        } else {
            if (syncIntervalMs !== 10000) setSyncIntervalMs(10000);
        }
        return () => clearTimeout(timeoutId);
    }, [offlineQueue, syncIntervalMs, processSyncQueue]);

    // NETWORK LISTENER
    useEffect(() => {
        const handleOnline = () => {
            if (offlineQueue.length > 0) {
                console.log("[Network] Back Online - Triggering Sync");
                setSyncIntervalMs(100); 
            }
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [offlineQueue.length]);

    // HELPER ACTIONS
    const handleManualSync = useCallback(() => {
        if (!navigator.onLine) {
            showNotification('Không có kết nối mạng!', 'error');
            return;
        }
        if (offlineQueue.length === 0) {
            showNotification('Tất cả dữ liệu đã được đồng bộ', 'success');
            return;
        }
        showNotification('Đang đồng bộ dữ liệu...', 'info');
        setSyncIntervalMs(100);
    }, [offlineQueue, showNotification]);

    const addToQueue = useCallback((item: PaperRoll) => {
        const queueItem: QueueItem = {
            id: `q-${Date.now()}`,
            data: item,
            timestamp: Date.now(),
            retryCount: 0
        };
        setOfflineQueue(prev => [...prev, queueItem]);
        setSessionTotal(prev => prev + 1);
    }, []);

    return {
        offlineQueue,
        sessionTotal,
        isSyncing,
        handleManualSync,
        addToQueue
    };
};