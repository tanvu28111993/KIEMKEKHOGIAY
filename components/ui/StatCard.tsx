import React, { useRef, useEffect } from 'react';
import { PaperRoll } from '../../types';
import { formatVNNumber } from '../../utils';

const EDIT_COLOR = '#FF8C00'; // Dark Orange

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

export default StatCard;