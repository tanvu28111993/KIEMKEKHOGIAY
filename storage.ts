import { get, set, del } from 'idb-keyval';
import { PaperRoll, User } from './types';

// Storage Keys
const KEYS = {
    CACHE: 'inventory_app_cache_v1',
    USER: 'inventory_app_user_v1',
    OFFLINE_QUEUE: 'inventory_app_queue_v1'
};

// Typed interface for Queue Item
interface QueueItem {
    id: string;
    data: PaperRoll;
    timestamp: number;
    retryCount: number;
}

export const storage = {
    // --- USER SESSION ---
    getUser: async (): Promise<User | undefined> => {
        return await get<User>(KEYS.USER);
    },
    setUser: async (user: User) => {
        await set(KEYS.USER, user);
    },
    removeUser: async () => {
        await del(KEYS.USER);
    },

    // --- DATA CACHE (Map structure persisted as Array) ---
    getCache: async (): Promise<Map<string, PaperRoll>> => {
        try {
            const rawData = await get<[string, PaperRoll][]>(KEYS.CACHE);
            if (rawData && Array.isArray(rawData)) {
                return new Map(rawData);
            }
        } catch (e) {
            console.error("IDB: Failed to load cache", e);
        }
        return new Map<string, PaperRoll>();
    },
    setCache: async (cache: Map<string, PaperRoll>) => {
        try {
            // Convert Map to Array for storage
            const arrayData = Array.from(cache.entries());
            await set(KEYS.CACHE, arrayData);
        } catch (e) {
            console.error("IDB: Failed to save cache", e);
        }
    },

    // --- OFFLINE QUEUE ---
    getQueue: async (): Promise<QueueItem[]> => {
        const q = await get<QueueItem[]>(KEYS.OFFLINE_QUEUE);
        return q || [];
    },
    setQueue: async (queue: QueueItem[]) => {
        await set(KEYS.OFFLINE_QUEUE, queue);
    }
};