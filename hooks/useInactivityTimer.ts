import { useEffect } from 'react';
import { User, ViewState } from '../types';

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

export const useInactivityTimer = (
    currentUser: User | null,
    view: ViewState,
    onLogout: (reason?: string) => void
) => {
    useEffect(() => {
        if (!currentUser || view !== 'DASHBOARD') return;

        let timeoutId: ReturnType<typeof setTimeout>;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                onLogout('Phiên làm việc hết hạn (30 phút)');
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
    }, [currentUser, view, onLogout]);
};