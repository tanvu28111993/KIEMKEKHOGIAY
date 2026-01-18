export interface PaperRoll {
    sku: string;          // 1. THẺ KHO GIẤY SKU
    purpose: string;      // 2. MỤC ĐÍCH
    packageId: string;    // 3. KIỆN GIẤY
    type: string;         // 4. LOẠI GIẤY
    gsm: number | string; // 5. Định Lượng
    supplier: string;     // 6. NHÀ CUNG CẤP
    manufacturer: string; // 7. NHÀ SX
    importDate: string;   // 8. NGÀY NHẬP
    prodDate: string;     // 9. NGÀY SX
    lengthCm: number | string; // 10. LÔ/DÀI (CM)
    widthCm: number | string;  // 11. RỘNG (CM)
    weight: number | string;   // 12. TRỌNG LƯỢNG
    quantity: number | string; // 13. SỐ LƯỢNG
    customerOrder: string;// 14. ĐƠN HÀNG/ KHÁCH HÀNG
    materialCode: string; // 15. MÃ VẬT TƯ
    location: string;     // 16. VỊ TRÍ HÀNG
    pendingOut: string;   // 17. VẬT TƯ CHỜ XUẤT
    importer: string;     // 18. NGƯỜI NHẬP
    updatedAt: string;    // 19. CẬP NHẬT
}

export interface User {
    id: string;
    name: string;
    role: 'admin' | 'staff';
}

export interface Notification {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export type ViewState = 'LOGIN' | 'DASHBOARD';

export interface CheckStatus {
    exists: boolean;
    scannedBy?: string;
    scannedAt?: string;
}

// Global type definition for Google Apps Script
export interface GoogleScriptRunner {
    withSuccessHandler(callback: (result: any, userObject?: any) => void): GoogleScriptRunner;
    withFailureHandler(callback: (error: Error, userObject?: any) => void): GoogleScriptRunner;
    [key: string]: any;
}

declare global {
    interface Window {
        google?: {
            script: {
                run: GoogleScriptRunner;
            };
        };
    }
}