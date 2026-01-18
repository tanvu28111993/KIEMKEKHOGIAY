import React, { useState, useRef, useEffect } from 'react';
import { PaperRoll, User, CheckStatus } from '../types';
import Scanner from './Scanner';

interface DashboardProps {
    user: User;
    foundItem: PaperRoll | null;
    checkStatus: CheckStatus | null;
    searchError: boolean;
    isLoading: boolean;
    onSearch: (code: string) => void;
    onLogout: () => void;
    onClearResult: () => void;
    onUpdateItem: (field: keyof PaperRoll, value: string | number) => void;
    onConfirmCheck: (overrideItem?: PaperRoll) => void;
    onNotify: (message: string, type: 'success' | 'error' | 'info') => void;
    queueLength: number;
    sessionTotal: number;
    isSyncing: boolean;
    onSync: () => void;
}

const EDIT_COLOR = '#FF8C00'; // Dark Orange
const WARNING_COLOR = '#FF8C00'; // Match request for Orange warning

// --- UTILS: Vietnamese Number Formatting ---
const formatVNNumber = (value: string | number | undefined, isInteger: boolean = false): string => {
    if (value === '' || value === null || value === undefined) return '-';
    
    let num: number;
    if (typeof value === 'string') {
        num = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    } else {
        num = value;
    }

    if (isNaN(num)) return String(value);

    return new Intl.NumberFormat('vi-VN', { 
        maximumFractionDigits: isInteger ? 0 : 2,
        minimumFractionDigits: 0
    }).format(num);
};

// --- COMPONENTS ---

interface InfoRowProps {
    label: string;
    value: string | number;
    copyable?: boolean;
}

const InfoRow: React.FC<InfoRowProps> = React.memo(({ label, value, copyable }) => (
    <div className="flex justify-between items-start py-3.5 border-b border-white/5 last:border-0 group">
        <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider flex items-center shrink-0 mr-3 mt-0.5">
            {label}
        </span>
        <span 
            className={`font-medium text-[14px] text-right flex-1 break-words text-gray-200 leading-snug ${copyable ? 'active:text-brand cursor-copy' : ''}`}
            onClick={() => {
                if (copyable && value && navigator.clipboard) {
                    navigator.clipboard.writeText(String(value));
                    if (navigator.vibrate) navigator.vibrate(10);
                }
            }}
        >
            {value || '-'}
        </span>
    </div>
));

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

interface StatCardProps {
    fieldKey?: keyof PaperRoll;
    label: string;
    value: string | number;
    unit?: string;
    icon?: string;
    isEditable?: boolean;
    fullWidth?: boolean;
    isInteger?: boolean;
    isEditingThis: boolean;
    tempValue: string | number;
    onStartEditing: (field: keyof PaperRoll, value: string | number, e?: React.MouseEvent) => void;
    onSave: () => void;
    onValueChange: (val: string) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const StatCard: React.FC<StatCardProps> = React.memo(({ 
    fieldKey, label, value, unit, icon, isEditable = false, fullWidth = false, isInteger = false,
    isEditingThis, tempValue, onStartEditing, onSave, onValueChange, onKeyDown,
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingThis && inputRef.current) {
            inputRef.current.focus();
            setTimeout(() => inputRef.current?.select(), 50);
        }
    }, [isEditingThis]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        
        // OPTIMIZATION: Auto-replace comma with dot for standard decimal format
        val = val.replace(/,/g, '.');

        // Allow only digits and one dot
        if (/^\d*\.?\d*$/.test(val)) {
            onValueChange(val);
        }
    };

    // Style logic: Match "Vị trí lưu kho" (font-black tracking-tight) but 80% size of 2rem -> 1.6rem
    const textStyleClass = "font-black tracking-tight leading-none text-[1.6rem]";

    return (
        <div className={`
            relative overflow-hidden rounded-xl p-3.5 flex flex-col justify-between shadow-md transition-all min-h-[90px]
            ${fullWidth ? 'col-span-2 bg-[#252525] border-l-[3px]' : 'bg-[#252525] border border-white/5'}
            ${isEditable && !isEditingThis ? 'active:scale-[0.98] cursor-pointer hover:bg-[#2a2a2a]' : ''}
            ${isEditingThis ? 'ring-2 ring-[#FF8C00] bg-neutral-800 z-10' : ''}
        `}
        style={{ borderColor: fullWidth ? EDIT_COLOR : undefined }}
        onClick={(e) => {
            if (isEditable && fieldKey && !isEditingThis) {
                onStartEditing(fieldKey, value, e);
            }
        }}
        >
            <div className="flex justify-between items-start z-10 mb-1">
                <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest flex items-center">
                    {icon && <span className={`material-symbols-outlined text-[16px] mr-1.5 ${isEditable ? '' : 'text-gray-500'}`} style={{ color: isEditable ? EDIT_COLOR : undefined }}>{icon}</span>}
                    {label}
                </span>
            </div>

            <div className="flex items-baseline justify-end w-full z-10 min-h-[36px]">
                {isEditingThis ? (
                     <input
                        ref={inputRef}
                        type="text"
                        // Force decimal keyboard on mobile
                        inputMode="decimal"
                        value={tempValue}
                        onChange={handleInputChange}
                        onBlur={onSave}
                        onKeyDown={onKeyDown}
                        className={`w-full bg-transparent text-right outline-none p-0 m-0 text-white caret-[#FF8C00] h-full ${textStyleClass}`}
                    />
                ) : (
                    <>
                        <span className={`${textStyleClass} ${isEditable ? '' : 'text-white'}`}
                            style={{ 
                                color: isEditable ? EDIT_COLOR : undefined,
                            }}>
                            {formatVNNumber(value, isInteger)}
                        </span>
                        {unit && <span className="text-[10px] text-gray-500 font-bold ml-1 uppercase transform -translate-y-1">{unit}</span>}
                    </>
                )}
            </div>
            
            {isEditable && !isEditingThis && (
                <div className="absolute inset-0 bg-transparent" />
            )}
        </div>
    );
});

const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(d);
};

// --- UPDATED CONFIG: Renamed labels ---
const STAT_FIELDS_CONFIG = [
    { key: 'gsm', label: 'Định Lượng', unit: 'GSM', icon: 'line_weight', full: true, editable: false, isInteger: true },
    { key: 'weight', label: 'Trọng Lượng', unit: 'KG', icon: 'weight', full: false, editable: true, isInteger: false },
    { key: 'quantity', label: 'Số Lượng', unit: 'Cuộn', icon: 'layers', full: false, editable: true, isInteger: true },
    { key: 'lengthCm', label: 'KHỔ GIẤY/LÔ', unit: 'CM', icon: 'straighten', full: false, editable: true, isInteger: false }, // Renamed from Chiều Dài
    { key: 'widthCm', label: 'Khổ Rộng', unit: 'CM', icon: 'aspect_ratio', full: false, editable: true, isInteger: false }, // Renamed from Khổ Giấy
] as const;

const Dashboard: React.FC<DashboardProps> = React.memo(({ 
    user, foundItem, checkStatus, searchError, isLoading,
    onSearch, onLogout, onClearResult, onUpdateItem, onConfirmCheck, onNotify, 
    queueLength, sessionTotal, isSyncing, onSync
}) => {
    const [manualCode, setManualCode] = useState('');
    const [editingField, setEditingField] = useState<keyof PaperRoll | null>(null);
    const [tempValue, setTempValue] = useState<string | number>('');
    const [showScanner, setShowScanner] = useState(false);

    const locationInputRef = useRef<HTMLInputElement>(null);

    // Calculate Sync Progress
    const itemsDone = sessionTotal > 0 ? (sessionTotal - queueLength) : 0;
    const progressPercentage = sessionTotal > 0 ? Math.min(100, Math.max(0, (itemsDone / sessionTotal) * 100)) : 0;

    useEffect(() => {
        if (editingField === 'location' && locationInputRef.current) {
            locationInputRef.current.focus();
            setTimeout(() => locationInputRef.current?.select(), 50);
        }
    }, [editingField]);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (manualCode.trim()) {
            if (navigator.vibrate) navigator.vibrate(20);
            onSearch(manualCode.trim());
            setManualCode('');
        }
    };

    const handleScanSuccess = (decodedText: string) => {
        setShowScanner(false);
        if (decodedText) {
            onSearch(decodedText);
        }
    };

    const startEditing = (field: keyof PaperRoll, value: string | number, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setEditingField(field);
        setTempValue(value === null || value === undefined ? '' : String(value));
        if (navigator.vibrate) navigator.vibrate(10);
    };

    const saveEditing = () => {
        if (editingField && foundItem) {
            let finalValue: string | number = tempValue;
            const isNumericField = ['weight', 'quantity', 'lengthCm', 'widthCm', 'gsm'].includes(editingField);
            
            if (isNumericField && typeof tempValue === 'string') {
                const parsed = parseFloat(tempValue);
                finalValue = isNaN(parsed) ? tempValue : parsed;
            }
            
            if (finalValue != foundItem[editingField]) {
                 onUpdateItem(editingField, finalValue);
            }
            setEditingField(null);
        }
    };

    const handleSafeConfirm = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
        if (editingField) saveEditing();
        onConfirmCheck();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur();
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-[#0a0a0a] text-white relative overflow-hidden">
            
            {showScanner && (
                <Scanner 
                    onScanSuccess={handleScanSuccess} 
                    onClose={() => setShowScanner(false)}
                    onError={(msg) => onNotify(msg, 'error')}
                />
            )}

            {/* Header */}
            <header className="bg-black/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex justify-between items-center sticky top-0 z-50 pt-safe-top">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 flex items-center justify-center">
                        <img src="https://i.postimg.cc/8zF3c24h/image.png" alt="Logo" className="w-full h-full object-contain drop-shadow-md" />
                    </div>
                    <div>
                        <h2 className="font-black text-[15px] leading-none uppercase tracking-wide text-gray-200">Kho Giấy</h2>
                        <div className="flex items-center text-[11px] text-gray-400 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>
                            <span className="font-medium text-gray-300">{user.name}</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    {/* SYNC BUTTON */}
                    <button 
                        onClick={onSync}
                        disabled={queueLength === 0}
                        className={`
                            relative overflow-hidden flex items-center gap-2 px-3 h-10 rounded-xl border transition-all duration-300
                            ${queueLength > 0 
                                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 cursor-pointer hover:bg-yellow-500/20 active:scale-95' 
                                : 'bg-green-500/10 border-green-500/20 text-green-500 cursor-default'}
                        `}
                    >
                        {queueLength > 0 && sessionTotal > 0 && (
                            <div 
                                className="absolute left-0 top-0 bottom-0 bg-yellow-500/10 transition-all duration-500 ease-out z-0"
                                style={{ width: `${progressPercentage}%` }}
                            ></div>
                        )}

                        <div className="relative z-10 flex items-center gap-2">
                            {isSyncing ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <span className="material-symbols-outlined text-xl">
                                    {queueLength > 0 ? 'cloud_upload' : 'cloud_done'}
                                </span>
                            )}
                            
                            {queueLength > 0 ? (
                                <div className="flex flex-col items-start leading-none">
                                    <span className="text-[9px] font-bold uppercase opacity-80 mb-0.5">Đồng bộ</span>
                                    <span className="text-[11px] font-black tracking-wider">
                                        {itemsDone}/{sessionTotal}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-[11px] font-bold hidden sm:inline-block">Đã xong</span>
                            )}
                        </div>
                    </button>

                    <button onClick={onLogout} className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 hover:text-white hover:bg-red-600 transition-all active:scale-95 border border-red-500/20">
                        <span className="material-symbols-outlined text-xl">logout</span>
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-32 scroll-smooth" onClick={() => editingField && saveEditing()}>
                
                {/* Search / Default View */}
                {!foundItem && !searchError && !isLoading && (
                    <div className="flex flex-col h-full justify-center items-center -mt-16 animate-[fadeIn_0.4s_ease-out]">
                        
                         {/* 1. BIG SCAN BUTTON */}
                        <div className="mb-10 w-full px-6 flex justify-center z-10">
                            <div 
                                onClick={() => setShowScanner(true)}
                                className="relative w-full aspect-square max-w-[280px] cursor-pointer group select-none active:scale-95 transition-transform duration-100"
                            >
                                <div className="absolute inset-0 bg-[#121212] rounded-[3rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.1)] border border-white/5 overflow-hidden">
                                     <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent opacity-30"></div>
                                </div>
                                <div className="absolute inset-3 bg-gradient-to-br from-[#2a2a2a] to-[#151515] rounded-[2.5rem] shadow-[0_10px_20px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col items-center justify-center border-t border-white/10 border-b border-black/80">
                                    <div className="w-24 h-24 rounded-full bg-[#0a0a0a] shadow-[inset_0_5px_15px_rgba(0,0,0,1)] flex items-center justify-center border border-white/5 relative group-hover:border-brand/30 transition-colors">
                                        <span className="material-symbols-outlined text-[3.5rem] text-gray-400 group-hover:text-brand transition-colors duration-300 drop-shadow-lg">
                                            qr_code_scanner
                                        </span>
                                    </div>
                                    <div className="mt-5 flex flex-col items-center gap-1.5">
                                        <span className="text-[13px] font-black text-gray-300 tracking-[0.25em] uppercase group-hover:text-white transition-colors">
                                            Quét Mã
                                        </span>
                                        <div className="h-0.5 w-10 bg-brand rounded-full opacity-50 group-hover:opacity-100 group-hover:w-16 transition-all duration-300"></div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. SEARCH INPUT */}
                        <form onSubmit={handleManualSubmit} className="w-full max-w-sm px-4 relative z-20" onClick={(e) => e.stopPropagation()}>
                            <div className="relative group">
                                <input
                                    type="text" 
                                    inputMode="text"
                                    enterKeyHint="search"
                                    value={manualCode}
                                    onChange={(e) => setManualCode(e.target.value)}
                                    placeholder="Nhập mã SKU..."
                                    className="w-full bg-[#1e1e1e] border border-white/10 text-white text-[16px] font-semibold rounded-2xl pl-6 pr-14 py-4 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all placeholder-gray-500 shadow-xl"
                                />
                                <button 
                                    type="submit" 
                                    className="absolute right-2 top-2 bottom-2 aspect-square bg-brand hover:bg-red-600 text-white rounded-xl flex items-center justify-center transition-all active:scale-90 shadow-lg"
                                >
                                    <span className="material-symbols-outlined text-xl">search</span>
                                </button>
                            </div>
                        </form>

                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex flex-col items-center justify-center pt-32 animate-fadeIn">
                        <div className="relative">
                            <div className="w-16 h-16 border-4 border-[#2a2a2a] rounded-full"></div>
                            <div className="w-16 h-16 border-4 border-brand border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                        </div>
                        <p className="text-gray-400 font-bold text-xs mt-6 animate-pulse uppercase tracking-widest">Đang truy xuất dữ liệu...</p>
                    </div>
                )}

                {/* Result Display: Found */}
                {foundItem && !isLoading && (
                    <div className="animate-[fadeInUp_0.4s_ease-out] pb-4">
                        
                        <div className="flex justify-between items-center mb-4">
                            <button onClick={(e) => {e.stopPropagation(); onClearResult();}} className="h-11 px-5 rounded-2xl bg-[#1e1e1e] text-gray-300 text-[13px] font-bold uppercase tracking-wider flex items-center hover:bg-[#2a2a2a] transition-colors active:scale-95 border border-white/5 shadow-md">
                                <span className="material-symbols-outlined mr-1.5 text-lg">arrow_back</span>
                                Quay lại
                            </button>
                        </div>
                        
                        {/* WARNING BANNER: ALREADY CHECKED */}
                        {checkStatus && checkStatus.exists && (
                            <div 
                                className="mb-5 rounded-2xl p-4 border flex items-start gap-4 shadow-[0_0_30px_rgba(255,140,0,0.15)] animate-[slideInRight_0.4s_ease-out]"
                                style={{ 
                                    backgroundColor: 'rgba(255, 140, 0, 0.1)', 
                                    borderColor: WARNING_COLOR 
                                }}
                            >
                                <div 
                                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm"
                                    style={{ backgroundColor: WARNING_COLOR }}
                                >
                                    <span className="material-symbols-outlined text-white text-xl">warning</span>
                                </div>
                                
                                <div className="flex-1 min-w-0 pt-0.5">
                                    <h3 
                                        className="text-[13px] font-black uppercase tracking-widest mb-2"
                                        style={{ color: WARNING_COLOR }}
                                    >
                                        Vật tư đã được kiểm kê
                                    </h3>
                                    
                                    <div className="text-gray-200 text-[13px] leading-snug space-y-1">
                                         {checkStatus.scannedBy ? (
                                            <div className="flex flex-wrap">
                                                <span className="opacity-60 w-24 shrink-0 text-[11px] font-bold uppercase tracking-wider pt-0.5">Người kiểm</span>
                                                <span className="font-bold">{checkStatus.scannedBy}</span>
                                            </div>
                                         ) : null}
                                         
                                         {checkStatus.scannedAt ? (
                                             <div className="flex flex-wrap">
                                                <span className="opacity-60 w-24 shrink-0 text-[11px] font-bold uppercase tracking-wider pt-0.5">Thời gian</span>
                                                <span className="font-mono text-[12px]">{checkStatus.scannedAt}</span>
                                            </div>
                                         ) : null}
                                         
                                         {!checkStatus.scannedBy && !checkStatus.scannedAt && (
                                             <span className="opacity-60 italic text-[12px]">Đã có trong danh sách kiểm kê.</span>
                                         )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Main SKU Card */}
                        <div className="bg-[#1e1e1e] border border-white/10 rounded-[1.75rem] p-6 shadow-2xl relative overflow-hidden mb-5">
                            <div className="absolute top-0 right-0 w-40 h-40 bg-brand/5 blur-3xl rounded-full -mr-10 -mt-10 pointer-events-none"></div>
                            
                            <div className="flex flex-row justify-between items-start mb-4 relative z-10 gap-2">
                                <div className="flex-1 min-w-0 pr-2">
                                    <span className="block text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Mã SKU</span>
                                    <h1 className="text-[1.75rem] font-black text-brand tracking-tight leading-none break-all font-mono">
                                        {foundItem.sku}
                                    </h1>
                                </div>
                                
                                <button
                                    onClick={handleSafeConfirm}
                                    className="flex-shrink-0 flex flex-col items-center justify-center w-[6.75rem] h-[6.75rem] rounded-[1.75rem] shadow-xl text-white bg-gradient-to-br from-[#FF8C00] to-[#E65100] border-t border-white/20 active:scale-90 transition-all z-20 cursor-pointer hover:shadow-[0_0_25px_rgba(255,140,0,0.5)]"
                                >
                                    <span className="material-symbols-outlined text-[3rem] mb-1 drop-shadow-md">fact_check</span>
                                    <span className="text-[13px] font-black uppercase tracking-widest">KIỂM</span>
                                </button>
                            </div>

                            <p className="text-gray-200 text-[16px] font-bold leading-tight relative z-10 mb-6 pb-4 border-b border-white/5">{foundItem.type}</p>
                            
                            <div className="relative z-10">
                                <div className="flex justify-between items-end mb-1">
                                     <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">Vị trí lưu kho</span>
                                </div>
                                
                                <div 
                                    className={`flex items-baseline transition-all rounded-lg min-h-[3rem] ${editingField === 'location' ? 'bg-[#2a2a2a] p-2 -ml-2 ring-1 ring-[#FF8C00]' : 'cursor-pointer active:opacity-70 p-1 -ml-1 border border-transparent'}`}
                                    onClick={(e) => { if (editingField !== 'location') startEditing('location', foundItem.location, e); }}
                                >
                                    {editingField === 'location' ? (
                                        <input
                                            ref={locationInputRef}
                                            type="text"
                                            value={tempValue}
                                            onChange={(e) => setTempValue(e.target.value)}
                                            onBlur={saveEditing}
                                            onKeyDown={handleKeyDown}
                                            className="w-full bg-transparent text-right outline-none p-0 m-0 font-black text-[2rem] text-white caret-[#FF8C00] text-[16px]"
                                        />
                                    ) : (
                                        <span className="text-[2rem] font-black tracking-tight text-right w-full block leading-none truncate" style={{ color: EDIT_COLOR }}>{foundItem.location}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Generated Stat Grid */}
                        <CardBox title="Thông số kỹ thuật" icon="analytics">
                            <div className="grid grid-cols-2 gap-2.5">
                                {STAT_FIELDS_CONFIG.map((field) => (
                                    <StatCard 
                                        key={field.key}
                                        fieldKey={field.key}
                                        label={field.label} 
                                        value={foundItem[field.key as keyof PaperRoll] as string | number} 
                                        unit={field.unit} 
                                        icon={field.icon} 
                                        fullWidth={field.full}
                                        isEditable={field.editable}
                                        isInteger={field.isInteger}
                                        isEditingThis={editingField === field.key}
                                        tempValue={tempValue}
                                        onStartEditing={startEditing}
                                        onSave={saveEditing}
                                        onValueChange={(val) => setTempValue(val)}
                                        onKeyDown={handleKeyDown}
                                    />
                                ))}
                            </div>
                        </CardBox>

                        <CardBox title="Thông tin vận hành" icon="inventory_2">
                            <InfoRow label="Kiện Giấy" value={foundItem.packageId} copyable={true} />
                            <InfoRow label="Mục Đích" value={foundItem.purpose} />
                            <InfoRow label="Vật Tư Chờ Xuất" value={foundItem.pendingOut} />
                        </CardBox>

                        <CardBox title="Nguồn gốc & Đơn hàng" icon="local_shipping">
                             <InfoRow label="Nhà Cung Cấp" value={foundItem.supplier} />
                             <InfoRow label="Nhà Sản Xuất" value={foundItem.manufacturer} />
                             <InfoRow label="Đơn Hàng / KH" value={foundItem.customerOrder} />
                             <InfoRow label="Mã Vật Tư" value={foundItem.materialCode} copyable={true} />
                        </CardBox>

                        <CardBox title="Thời gian & Nhân sự" icon="history">
                            <InfoRow label="Ngày Nhập" value={foundItem.importDate} />
                            <InfoRow label="Ngày SX" value={foundItem.prodDate} />
                            <InfoRow label="Người Nhập" value={foundItem.importer} />
                            <InfoRow label="Cập nhật cuối" value={formatDateTime(foundItem.updatedAt)} />
                        </CardBox>
                    </div>
                )}

                {/* Result Display: Not Found */}
                {searchError && !isLoading && (
                     <div className="flex flex-col items-center justify-center pt-20 animate-[fadeIn_0.3s_ease-out]">
                         <div className="w-24 h-24 bg-[#1e1e1e] rounded-full flex items-center justify-center mb-6 border border-red-500/20 shadow-[0_0_40px_rgba(220,38,38,0.1)]">
                            <span className="material-symbols-outlined text-5xl text-brand">search_off</span>
                         </div>
                         <h3 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Không tìm thấy!</h3>
                         <p className="text-gray-400 text-center mb-10 px-10 text-[14px] leading-relaxed">
                             Mã SKU này không có trong hệ thống.<br/>Vui lòng kiểm tra lại.
                         </p>
                         <div className="flex gap-4 w-full max-w-xs px-4">
                             <button onClick={(e) => {e.stopPropagation(); onClearResult();}} className="flex-1 bg-[#2a2a2a] hover:bg-[#333] text-white py-4 rounded-xl font-bold transition-all active:scale-95 border border-white/10 text-sm flex items-center justify-center">
                                <span className="material-symbols-outlined mr-2 text-xl">refresh</span>
                                Thử lại
                             </button>
                             <button onClick={() => setShowScanner(true)} className="flex-1 bg-brand hover:bg-red-600 text-white py-4 rounded-xl font-bold transition-all active:scale-95 shadow-lg text-sm flex items-center justify-center">
                                <span className="material-symbols-outlined mr-2 text-xl">qr_code_scanner</span>
                                Quét
                             </button>
                         </div>
                     </div>
                )}
            </div>

            {/* FLOATING ACTION BUTTON (FAB) FOR SCANNING */}
            {(foundItem || searchError) && !showScanner && !isLoading && (
                 <button
                    onClick={() => setShowScanner(true)}
                    className="fixed bottom-8 right-6 w-16 h-16 bg-brand rounded-full shadow-[0_4px_20px_rgba(218,41,28,0.5)] flex items-center justify-center text-white z-40 active:scale-90 transition-transform animate-slideInRight border border-white/20 hover:brightness-110"
                >
                    <span className="material-symbols-outlined text-[2rem]">qr_code_scanner</span>
                </button>
            )}
        </div>
    );
});

export default Dashboard;