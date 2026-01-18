import React from 'react';
import { Notification } from '../types';

interface NotificationSystemProps {
    notifications: Notification[];
    onRemove: (id: string) => void;
}

const NotificationSystem: React.FC<NotificationSystemProps> = ({ notifications, onRemove }) => {
    return (
        // Changed: Width restricted to w-1/2 (50%), aligned to right (right-4)
        <div className="fixed bottom-safe-bottom right-4 w-1/2 mb-6 z-[100] flex flex-col gap-3 pointer-events-none items-end">
            {notifications.map((notif) => (
                <ToastItem key={notif.id} notification={notif} onRemove={onRemove} />
            ))}
        </div>
    );
};

const ToastItem: React.FC<{ notification: Notification; onRemove: (id: string) => void }> = ({ notification, onRemove }) => {
    // Modern Glassmorphism Styles (Transparent & Blur)
    const getStyles = () => {
        switch (notification.type) {
            case 'success':
                return {
                    // Green Tint Glass: Subtle green bg, glowing green border
                    container: 'bg-green-500/10 border-green-500/20 shadow-[0_4px_20px_rgba(34,197,94,0.15)]',
                    icon: 'check_circle',
                    iconColor: 'text-green-400',
                    textColor: 'text-green-50'
                };
            case 'error':
                return {
                    // Red Tint Glass: Subtle red bg, glowing red border
                    container: 'bg-brand/10 border-brand/20 shadow-[0_4px_20px_rgba(218,41,28,0.15)]',
                    icon: 'error',
                    iconColor: 'text-red-400',
                    textColor: 'text-red-50'
                };
            default:
                return {
                    // Neutral Glass: Dark tint, white border
                    container: 'bg-white/5 border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
                    icon: 'info',
                    iconColor: 'text-blue-400',
                    textColor: 'text-gray-100'
                };
        }
    };

    const style = getStyles();

    return (
        <div 
            className={`
                pointer-events-auto
                backdrop-blur-xl
                rounded-2xl p-3 flex items-center gap-3 w-full
                border
                ${style.container}
                animate-slideInRight transform transition-all duration-300 origin-right
            `}
            role="alert"
        >
            {/* Icon Container with slight glow - Compact size */}
            <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-white/5 ${style.iconColor} shrink-0 border border-white/5`}>
                <span className="material-symbols-outlined text-lg">
                    {style.icon}
                </span>
            </div>
            
            <div className="flex-1 min-w-0">
                <p className={`font-semibold text-[13px] leading-snug ${style.textColor} drop-shadow-sm break-words`}>
                    {notification.message}
                </p>
            </div>

            <button 
                onClick={() => onRemove(notification.id)}
                className="w-6 h-6 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white/50 hover:text-white transition-all active:scale-90 shrink-0"
            >
                <span className="material-symbols-outlined text-base">close</span>
            </button>
        </div>
    );
};

export default NotificationSystem;