import { PaperRoll, CheckStatus } from './types';

// The URL provided for the backend API
const GAS_EXEC_URL = 'https://script.google.com/macros/s/AKfycbww4Vsseqty82pF94f1pn3wpAdG0NeZKVWYkagG7Qw_GhvH_NSMPHXSHHemObeRWOyI/exec';

/**
 * Generic handler to call server-side functions.
 * It automatically switches between `google.script.run` (production) and `fetch` (dev/preview).
 */
const runServerFn = async (fnName: string, args: any[]): Promise<any> => {
    // 1. GAS Environment (Production inside Google Interface)
    // Google.script.run returns the RAW result directly from the server function, no wrapper.
    if (window.google && window.google.script) {
        return new Promise((resolve, reject) => {
            window.google.script.run
                .withSuccessHandler(resolve)
                .withFailureHandler(reject)
                [fnName](...args);
        });
    }

    // 2. Web Environment (Preview/Dev/Mobile Browser)
    console.log(`[API Request] Action: ${fnName}`, args);

    try {
        // GAS Web Apps require text/plain to avoid CORS preflight (OPTIONS request) failure
        const payload = JSON.stringify({ action: fnName, args: args });
        
        const response = await fetch(GAS_EXEC_URL, {
            method: 'POST',
            redirect: 'follow', // CRITICAL: GAS always redirects 302 to googleusercontent
            headers: { 
                'Content-Type': 'text/plain;charset=utf-8' 
            }, 
            body: payload
        });

        if (!response.ok) {
            throw new Error(`Server Error: ${response.status} ${response.statusText}`);
        }

        // Get text first to safely handle HTML error pages from Google
        const textResult = await response.text();
        
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(textResult);
        } catch (e) {
            console.error("[API Error] Response is not JSON. Likely HTML error page:", textResult);
            throw new Error("Server trả về dữ liệu không hợp lệ (HTML). Vui lòng kiểm tra Deployment (Web App: Anyone).");
        }

        // --- HANDLE BACKEND WRAPPER STRUCTURE ---
        // The doPost in your Backend returns: { status: 'success', data: ... } or { status: 'error', message: ... }
        if (jsonResponse && typeof jsonResponse === 'object') {
            if (jsonResponse.status === 'success') {
                console.log(`[API Success] ${fnName}:`, jsonResponse.data);
                // CRITICAL FIX: Return only the 'data' part
                return jsonResponse.data;
            } else if (jsonResponse.status === 'error') {
                console.error(`[API Error From Server] ${fnName}:`, jsonResponse.message);
                throw new Error(jsonResponse.message || "Lỗi xử lý từ Server");
            }
        }

        // Fallback: If the server returns raw data (unlikely with provided backend, but safe to keep)
        console.log(`[API Success Raw] ${fnName}:`, jsonResponse);
        return jsonResponse;

    } catch (error: any) {
        console.error(`[API Fail] ${fnName}:`, error);
        throw error;
    }
};

export const api = {
    checkLogin: (u: string, p: string) => runServerFn('checkLogin', [u, p]),
    searchPaperBySku: (sku: string) => runServerFn('searchPaperBySku', [sku]),
    // Optimized: Removed client-side Spreadsheet ID dependency. Server handles destination.
    checkSkuInKiemKe: (sku: string) => runServerFn('checkSkuInKiemKe', [sku]),
    saveBatchToKiemKeSheet: (items: any[]) => runServerFn('saveBatchToKiemKeSheet', [items]),
};