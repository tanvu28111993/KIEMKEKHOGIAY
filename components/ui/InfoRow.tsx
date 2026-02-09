import React, { useRef, useEffect } from 'react';

interface InfoRowProps {
    label: string;
    value: string | number;
    copyable?: boolean;
    // Editing Props
    isEditable?: boolean;
    isEditing?: boolean;
    inputType?: 'text' | 'date';
    tempValue?: string | number;
    onStartEdit?: () => void;
    onSave?: () => void;
    onChange?: (val: string) => void;
}

const InfoRow: React.FC<InfoRowProps> = React.memo(({ 
    label, value, copyable, 
    isEditable = false, isEditing = false, inputType = 'text', tempValue = '',
    onStartEdit, onSave, onChange 
}) => {
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            // For text inputs, select all. For date, just focus.
            if (inputType === 'text') {
                setTimeout(() => inputRef.current?.select(), 50);
            }
        }
    }, [isEditing, inputType]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.currentTarget.blur(); // Triggers onSave via onBlur
        }
    };

    return (
        <div 
            className={`
                flex justify-between items-center py-3.5 border-b border-white/5 last:border-0 group relative
                ${isEditable && !isEditing ? 'cursor-pointer active:bg-white/5 transition-colors -mx-2 px-2 rounded-lg' : ''}
            `}
            onClick={() => {
                if (isEditable && !isEditing && onStartEdit) {
                    onStartEdit();
                }
            }}
        >
            <span className="text-gray-500 text-[11px] font-bold uppercase tracking-wider flex items-center shrink-0 mr-3 mt-0.5">
                {label}
                {isEditable && !isEditing && (
                    <span className="material-symbols-outlined text-[14px] ml-1 text-[#FF8C00] opacity-70">edit</span>
                )}
            </span>

            <div className="flex-1 min-w-0 flex justify-end">
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type={inputType}
                        value={String(tempValue)}
                        onChange={(e) => onChange && onChange(e.target.value)}
                        onBlur={() => onSave && onSave()}
                        onKeyDown={handleKeyDown}
                        className={`
                            bg-[#2a2a2a] text-white text-right outline-none border border-[#FF8C00] rounded px-2 py-1 w-full max-w-[200px] text-[14px] font-medium
                            ${inputType === 'date' ? 'min-h-[30px]' : ''}
                        `}
                    />
                ) : (
                    <span 
                        className={`font-medium text-[14px] text-right break-words text-gray-200 leading-snug ${copyable ? 'active:text-brand cursor-copy' : ''}`}
                        onClick={(e) => {
                            if (copyable && !isEditable && value && navigator.clipboard) {
                                e.stopPropagation();
                                navigator.clipboard.writeText(String(value));
                                if (navigator.vibrate) navigator.vibrate(10);
                            }
                        }}
                    >
                        {value || '-'}
                    </span>
                )}
            </div>
        </div>
    );
});

export default InfoRow;