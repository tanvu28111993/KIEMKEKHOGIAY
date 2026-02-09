// --- UTILS: Formatting Helpers ---

export const formatVNNumber = (value: string | number | undefined, isInteger: boolean = false): string => {
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

export const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    if (/^\d{2}\/\d{2}\/\d{4}/.test(dateStr)) return dateStr;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(d);
};