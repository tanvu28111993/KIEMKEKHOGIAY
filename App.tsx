import React, { useState, useCallback, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import NotificationSystem from './components/NotificationSystem';
import { PaperRoll, ViewState, User, Notification, CheckStatus } from './types';
import { storage } from './storage';
import { api } from './api';

// Hooks
import { useInactivityTimer } from './hooks/useInactivityTimer';
import { useSyncWorker } from './hooks/useSyncWorker';

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

    // Storage Ready Flag (Prevent writing empty state over existing DB)
    const [isStorageReady, setIsStorageReady] = useState(false);

    // Notification State
    const [notifications, setNotifications] = useState<Notification[]>([]);

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

    // --- HOOKS ---
    // 1. Sync Logic (Offline Queue Management)
    const { 
        offlineQueue, 
        sessionTotal, 
        isSyncing, 
        handleManualSync, 
        addToQueue 
    } = useSyncWorker(isStorageReady, showNotification);

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

    // 2. Inactivity Logic
    useInactivityTimer(currentUser, view, handleLogout);

    // --- INIT ---
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

            } catch (e) {
                console.error("Failed to initialize storage", e);
            } finally {
                setIsStorageReady(true);
            }
        };

        initData();
    }, []);

    // PERSISTENCE: Save Cache whenever it changes (Only if storage is ready)
    useEffect(() => {
        if (!isStorageReady) return;
        storage.setCache(dataCache);
    }, [dataCache, isStorageReady]);


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

        // 3. Add to Queue via Hook
        addToQueue(finalData);

    }, [foundItem, currentUser, showNotification, updateCache, addToQueue]);

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