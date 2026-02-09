import React from 'react';

interface CardBoxProps {
    title: string;
    children: React.ReactNode;
    icon?: string;
    color?: string;
    action?: React.ReactNode;
    className?: string;
}

const CardBox: React.FC<CardBoxProps> = ({ title, children, icon, color = 'text-white', action, className = '' }) => (
    <div className={`bg-[#1e1e1e] border border-white/5 rounded-[1.25rem] p-5 mb-4 shadow-lg ${className}`}>
        <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
            <h3 className={`font-extrabold text-[12px] flex items-center uppercase tracking-widest opacity-80 ${color}`}>
                {icon && <span className="material-symbols-outlined text-lg mr-2 opacity-80">{icon}</span>}
                {title}
            </h3>
            {action}
        </div>
        <div className="w-full">
            {children}
        </div>
    </div>
);

export default CardBox;