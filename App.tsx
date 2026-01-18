import React, { useState, useCallback, useEffect, useRef } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import NotificationSystem from './components/NotificationSystem';
import { PaperRoll, ViewState, User, Notification, CheckStatus } from './types';
import { storage } from './storage';
import { api } from './api';

interface QueueItem {
    id: string;
    data: PaperRoll;
    timestamp: number;
    retryCount: number;
}

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const BATCH_SIZE = 5; // Send up to 5 items per request

const App: React.FC = () => {
    const [view, setView] = useState<ViewState>('LOGIN');
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);
    
    // User State
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    
    // Search State
    const [foundItem, setFoundItem] = useState<PaperRoll | null>(null);
    const [searchError, setSearchError] = useState<boolean>(false);
    
    // WARNING STATE: Already Checked
    const [checkStatus, setCheckStatus] = useState<CheckStatus | null>(null);

    // DATA CACHING LAYER
    const [dataCache, setDataCache] = useState<Map<string, PaperRoll>>(new Map());

    // OFFLINE QUEUE
    const [offlineQueue, setOfflineQueue] = useState<QueueItem[]>([]);
    
    // SYNC PROGRESS STATE
    const [sessionTotal, setSessionTotal] = useState(0); // Tracks total items for the "1/5" UI
    const [isSyncing, setIsSyncing] = useState(false); // Visual state for spinner

    // Storage Ready Flag (Prevent writing empty state over existing DB)
    const [isStorageReady, setIsStorageReady] = useState(false);

    // Notification State
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // --- SYNC LOGIC STATE ---
    const [syncIntervalMs, setSyncIntervalMs] = useState(10000); // Start with 10s
    const isSyncingRef = useRef(false);

    const showNotification = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
        const id = Date.now().toString();
        const newNotification = { id, message, type };
        
        setNotifications(prev => [...prev, newNotification]);
        setTimeout(() => {
            setNotifications(current => current.filter(n => n.id !== id));
        }, 3000); // Auto dismiss after 3 seconds
    }, []);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // Manual Logout Handler
    const handleLogout = useCallback((reason?: string) => {
        setView('LOGIN');
        setCurrentUser(null);
        setFoundItem(null);
        setSearchError(false);
        setCheckStatus(null);
        storage.removeUser(); // Clear Session Async
        showNotification(reason || 'Đã đăng xuất thành công', 'info');
    }, [showNotification]);

    // 0. SESSION INACTIVITY TIMER
    useEffect(() => {
        if (!currentUser || view !== 'DASHBOARD') return;

        let timeoutId: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                handleLogout('Phiên làm việc hết hạn (30 phút)');
            }, INACTIVITY_LIMIT_MS);
        };

        const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
        
        // Attach listeners
        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Initialize timer
        resetTimer();

        // Cleanup
        return () => {
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, [currentUser, view, handleLogout]);

    // 1. INIT: Load Data from IndexedDB (Async)
    useEffect(() => {
        const initData = async () => {
            try {
                // Load User
                const user = await storage.getUser();
                if (user) {
                    setCurrentUser(user);
                    setView('DASHBOARD');
                    console.log("[Storage] Auto-login successful");
                }

                // Load Cache
                const cachedData = await storage.getCache();
                if (cachedData.size > 0) {
                    setDataCache(cachedData);
                    console.log(`[Storage] Loaded ${cachedData.size} items from IndexedDB`);
                }

                // Load Offline Queue
                const queue = await storage.getQueue();
                setOfflineQueue(queue);
                if (queue.length > 0) {
                    setSessionTotal(queue.length);
                }

            } catch (e) {
                console.error("Failed to initialize storage", e);
            } finally {
                setIsStorageReady(true);
            }
        };

        initData();
    }, []);

    // 2. PERSISTENCE: Save Cache whenever it changes (Only if storage is ready)
    useEffect(() => {
        if (!isStorageReady) return;
        storage.setCache(dataCache);
    }, [dataCache, isStorageReady]);

    // 3. PERSISTENCE: Save Queue whenever it changes (Only if storage is ready)
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

    // 4. SMART SYNC WORKER (Batch Processing + Exponential Backoff)
    const processSyncQueue = useCallback(async () => {
        // Conditions to stop trying
        if (offlineQueue.length === 0 || isSyncingRef.current || !navigator.onLine) {
            return;
        }

        isSyncingRef.current = true;
        setIsSyncing(true);
        
        // Take a batch of items (up to BATCH_SIZE)
        const batch = offlineQueue.slice(0, BATCH_SIZE);
        
        // EXTRACT data object only. Server expects Array<PaperRoll>
        const batchItems = batch.map(b => ({
            ...b.data,
            _clientQueueId: b.id 
        }));

        console.log(`[SyncWorker] Sending batch of ${batch.length} items to Server...`);

        try {
            // Call API
            await api.saveBatchToKiemKeSheet(batchItems);
            
            console.log(`[SyncWorker] Batch success`);
            
            // Remove the processed batch from the queue
            setOfflineQueue(prev => prev.slice(batch.length));
            
            // Explicitly confirm the destination sheet in the notification
            showNotification(`Đã lưu ${batch.length} phiếu lên hệ thống`, 'success');
            
            // If success, reset delay to very short to process next batch quickly (Burst Mode)
            setSyncIntervalMs(1000); 

        } catch (error: any) {
            console.error(`[SyncWorker] Batch failed`, error);
            // Exponential Backoff: Double the delay, max 5 minutes (300,000ms)
            setSyncIntervalMs(prev => Math.min(prev * 2, 300000));
            
            // Optional: Notify user if it's a critical persistent error, otherwise keep silent retry
            if (syncIntervalMs > 60000) {
                 showNotification(`Lỗi đồng bộ: ${error.message || 'Mất kết nối'}`, 'error');
            }
        } finally {
            isSyncingRef.current = false;
            setIsSyncing(false);
        }

    }, [offlineQueue, syncIntervalMs, showNotification]);

    // Trigger Sync Loop
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        if (offlineQueue.length > 0) {
            // Only start the timeout if we have data.
            timeoutId = setTimeout(() => {
                processSyncQueue();
            }, syncIntervalMs);
        } else {
            // Reset delay to standard 10s when queue is empty so next time we start fresh
            if (syncIntervalMs !== 10000) setSyncIntervalMs(10000);
        }

        return () => clearTimeout(timeoutId);
    }, [offlineQueue, syncIntervalMs, processSyncQueue]);

    // Listen for Online Event to Sync Immediately
    useEffect(() => {
        const handleOnline = () => {
            if (offlineQueue.length > 0) {
                console.log("[Network] Back Online - Triggering Sync");
                setSyncIntervalMs(100); // Immediate retry triggers the loop effect above
            }
        };
        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, [offlineQueue.length]);

    // Manual Sync Handler
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
        setSyncIntervalMs(100); // Force immediate retry
    }, [offlineQueue, showNotification]);

    const handleLogin = (username: string) => {
        const newUser: User = {
            id: `user-${Date.now()}`,
            name: username,
            role: 'staff'
        };
        setCurrentUser(newUser);
        storage.setUser(newUser); // Save Session Async
        showNotification(`Xin chào, ${username}!`, 'success');
        setView('DASHBOARD');
    };

    const updateCache = useCallback((item: PaperRoll) => {
        setDataCache(prev => {
            const newCache = new Map(prev);
            if (item.sku) newCache.set(item.sku.toLowerCase(), item);
            if (item.packageId) newCache.set(item.packageId.toLowerCase(), item);
            return newCache;
        });
    }, []);

    const handleSearch = useCallback(async (code: string) => {
        const normalizedCode = code.trim().toLowerCase();
        setFoundItem(null);
        setSearchError(false);
        setCheckStatus(null); // Reset warning

        // OPTIMIZATION: Check Local Cache First (Instant)
        if (dataCache.has(normalizedCode)) {
            const cachedResult = dataCache.get(normalizedCode);
            if (cachedResult) {
                console.log("Serving from Cache (Fast Mode):", normalizedCode);
                setFoundItem(cachedResult);
                if (navigator.vibrate) navigator.vibrate(50);
                
                // Even if cached, check status via API
                api.checkSkuInKiemKe(normalizedCode)
                    .then(status => {
                        if (status && status.exists) {
                            setCheckStatus(status);
                            if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        }
                    })
                    .catch(err => console.warn("Background Check Failed:", err));
                
                return;
            }
        }

        setIsLoadingSearch(true);

        try {
            // 1. Get Item Data
            console.log("Calling API for SKU:", code);
            const result = await api.searchPaperBySku(code);
            console.log("API Result:", result);
            
            setIsLoadingSearch(false);
            if (result) {
                setFoundItem(result);
                updateCache(result); 
                if (navigator.vibrate) navigator.vibrate(50);

                // 2. Check Status
                try {
                    const status = await api.checkSkuInKiemKe(normalizedCode);
                    if (status && status.exists) {
                        setCheckStatus(status);
                        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
                    }
                } catch (statusErr) {
                    console.warn("Status Check Failed:", statusErr);
                }

            } else {
                setSearchError(true);
                showNotification(`Không tìm thấy mã: ${code}`, 'error');
            }
        } catch (error: any) {
            setIsLoadingSearch(false);
            console.error("Critical Search Error:", error);
            setSearchError(true);
            showNotification("Lỗi API: " + (error.message || "Kiểm tra Deployment"), 'error');
        }
    }, [showNotification, dataCache, updateCache]);

    const handleUpdateItem = useCallback((field: keyof PaperRoll, value: string | number) => {
        setFoundItem(current => {
            if (!current) return null;
            const updatedItem = { ...current, [field]: value };
            updateCache(updatedItem); 
            return updatedItem;
        });
    }, [updateCache]);

    const handleClearResult = useCallback(() => {
        setFoundItem(null);
        setSearchError(false);
        setCheckStatus(null);
    }, []);

    const handleConfirmCheck = useCallback((overrideItem?: PaperRoll) => {
        const itemToSave = overrideItem || foundItem;
        if (!itemToSave || !currentUser) return;
        
        // 1. Prepare Data
        const now = new Date();
        const formattedTime = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        
        const finalData: PaperRoll = { 
            ...itemToSave, 
            importer: currentUser.name,
            updatedAt: formattedTime
        };
        
        // 2. UI Updates (Instant)
        updateCache(finalData);
        setFoundItem(null); 
        setSearchError(false);
        setCheckStatus(null);
        showNotification(`Đã lưu ${finalData.sku} (Offline Ready)`, 'success');
        if (navigator.vibrate) navigator.vibrate(100);

        // 3. Add to Offline Queue immediately
        const queueItem: QueueItem = {
            id: `q-${Date.now()}`,
            data: finalData,
            timestamp: Date.now(),
            retryCount: 0
        };

        setOfflineQueue(prev => [...prev, queueItem]);
        
        // 4. Update Session Total for Progress UI
        setSessionTotal(prev => prev + 1);

    }, [foundItem, currentUser, showNotification, updateCache]);

    return (
        <div className="min-h-[100dvh] w-full relative bg-[#0a0a0a] overflow-hidden">
            <NotificationSystem 
                notifications={notifications} 
                onRemove={removeNotification} 
            />
            
            {!isStorageReady ? (
                 <div className="flex items-center justify-center h-full">
                     <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin"></div>
                 </div>
            ) : (
                <>
                    {view === 'LOGIN' && (
                        <Login 
                            onLogin={handleLogin} 
                            onError={(msg) => showNotification(msg, 'error')}
                        />
                    )}

                    {view === 'DASHBOARD' && currentUser && (
                        <Dashboard 
                            user={currentUser}
                            foundItem={foundItem}
                            checkStatus={checkStatus}
                            searchError={searchError}
                            isLoading={isLoadingSearch}
                            onSearch={handleSearch}
                            onLogout={() => handleLogout()}
                            onClearResult={handleClearResult}
                            onUpdateItem={handleUpdateItem}
                            onConfirmCheck={handleConfirmCheck}
                            onNotify={showNotification}
                            queueLength={offlineQueue.length}
                            sessionTotal={sessionTotal}
                            isSyncing={isSyncing}
                            onSync={handleManualSync}
                        />
                    )}
                </>
            )}
        </div>
    );
};

export default App;