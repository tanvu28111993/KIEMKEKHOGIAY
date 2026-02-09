/**
 * BACKEND KHO GIẤY MOBILE v4.0 (Compatible with React args[])
 * 
 * --- CẤU HÌNH ---
 */

// 1. ID File chứa dữ liệu cuộn giấy (Master Data) - Sheet 'KHO'
const SOURCE_SHEET_ID = '1DSg_2nJoPkAfudCy4QnHBEbvKhwHm-j6Cd9CK_cwfkg';

// 2. ID File chứa User (Sheet 'DN') và Kết quả (Sheet 'KIEMKE')
const TARGET_SHEET_ID = '1zMacxcKnAAeSnIBUU3RrhreRUEEoXmvfTjvkCEjlX9o';

/**
 * HÀM XỬ LÝ REQUEST TỪ FRONTEND
 * Frontend gửi lên JSON: { action: "tên_hàm", args: [tham_số_1, tham_số_2...] }
 */
function doPost(e) {
  // Cấu hình CORS Header cho mọi phản hồi
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);

  if (!e || !e.postData || !e.postData.contents) {
    output.setContent(JSON.stringify({ status: 'error', message: 'No data' }));
    return output;
  }

  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const args = data.args || []; // Frontend gửi tham số dạng mảng
    let result = null;

    // --- ROUTER: Ánh xạ action với tham số trong mảng args ---
    switch (action) {
      case 'checkLogin':
        // args[0]: username, args[1]: password
        result = checkLogin(args[0], args[1]);
        break;

      case 'searchPaperBySku':
        // args[0]: sku
        result = searchPaperBySku(args[0]); 
        break;

      case 'checkSkuInKiemKe':
        // args[0]: sku, args[1]: spreadsheetId (opt), args[2]: sheetName (opt)
        result = checkSkuInKiemKe(args[0], args[1], args[2]);
        break;

      case 'saveBatchToKiemKeSheet':
        // args[0]: items array, args[1]: spreadsheetId (opt), args[2]: sheetName (opt)
        result = saveBatchToKiemKeSheet(args[0], args[1], args[2]);
        break;

      default:
        return output.setContent(JSON.stringify({ status: 'error', message: `Unknown action: ${action}` }));
    }

    // Trả về kết quả thành công
    output.setContent(JSON.stringify({ status: 'success', data: result }));
    return output;

  } catch (err) {
    Logger.log(err);
    output.setContent(JSON.stringify({ status: 'error', message: err.toString() }));
    return output;
  }
}

// Xử lý GET request (để test trên trình duyệt xem script chạy chưa)
function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({ 
    status: 'running', 
    message: 'Backend Kho Giấy is Active' 
  })).setMimeType(ContentService.MimeType.JSON);
}

// --- LOGIC NGHIỆP VỤ CHI TIẾT ---

/**
 * 1. Đăng nhập: Check sheet 'DN' trong file TARGET
 */
function checkLogin(username, password) {
  if (!username || !password) return false;

  try {
    const ss = SpreadsheetApp.openById(TARGET_SHEET_ID);
    const sheet = ss.getSheetByName('DN');

    if (!sheet) {
      Logger.log("Lỗi: Không tìm thấy sheet 'DN'");
      return false;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return false;

    // Lấy cột A (User) và B (Pass)
    const data = sheet.getRange(2, 1, lastRow - 1, 2).getDisplayValues();
    
    const inputUser = String(username).toLowerCase().trim();
    const inputPass = String(password).trim();

    for (let i = 0; i < data.length; i++) {
      const rowUser = String(data[i][0]).toLowerCase().trim();
      const rowPass = String(data[i][1]).trim(); 

      // So sánh chính xác
      if (rowUser === inputUser && rowPass === inputPass) {
        return true;
      }
    }
    return false;
  } catch (e) {
    Logger.log("Login Error: " + e.toString());
    return false;
  }
}

/**
 * 2. Tìm kiếm SKU: Sheet 'KHO' trong file SOURCE
 */
function searchPaperBySku(sku) {
  if (!sku) return null;
  const searchSku = String(sku).trim();

  try {
    const ss = SpreadsheetApp.openById(SOURCE_SHEET_ID);
    const sheet = ss.getSheetByName('KHO');
    if (!sheet) return null;

    // Dùng TextFinder tìm chính xác ô
    const finder = sheet.getRange("A:A").createTextFinder(searchSku).matchEntireCell(true).matchCase(false);
    const result = finder.findNext();
    
    if (!result) return null;

    const row = result.getRow();
    // Lấy 19 cột dữ liệu (A -> S)
    const rowData = sheet.getRange(row, 1, 1, 19).getDisplayValues()[0];

    // Map dữ liệu sang Object JSON
    return {
      sku: rowData[0],
      purpose: rowData[1],
      packageId: rowData[2],
      type: rowData[3],
      gsm: rowData[4],
      supplier: rowData[5],
      manufacturer: rowData[6],
      importDate: rowData[7],
      prodDate: rowData[8],
      lengthCm: rowData[9],
      widthCm: rowData[10],
      weight: rowData[11],
      quantity: rowData[12],
      customerOrder: rowData[13],
      materialCode: rowData[14],
      location: rowData[15],
      pendingOut: rowData[16],
      importer: rowData[17],
      updatedAt: rowData[18]
    };
  } catch (e) {
    Logger.log("Search Error: " + e.toString());
    return null;
  }
}

/**
 * 3. Kiểm tra đã kiểm kê chưa: Sheet 'KIEMKE' trong file TARGET
 */
function checkSkuInKiemKe(sku, spreadSheetId, sheetName) {
  if (!sku) return { exists: false };
  const targetId = spreadSheetId || TARGET_SHEET_ID;
  const targetName = sheetName || 'KIEMKE';

  try {
    const ss = SpreadsheetApp.openById(targetId);
    let sheet = ss.getSheetByName(targetName);
    if (!sheet) return { exists: false };

    // Tìm SKU ở cột A
    const finder = sheet.getRange("A:A").createTextFinder(String(sku).trim()).matchEntireCell(true).matchCase(false);
    const result = finder.findNext();
    
    if (result) {
      const row = result.getRow();
      // Lấy thông tin người kiểm (Cột 18 - R) và Thời gian (Cột 19 - S)
      // Lưu ý: getRange(row, column, numRows, numColumns)
      const info = sheet.getRange(row, 18, 1, 2).getDisplayValues()[0];
      return {
        exists: true,
        scannedBy: info[0],
        scannedAt: info[1]
      };
    }
    return { exists: false };
  } catch (e) {
    return { exists: false };
  }
}

/**
 * 4. Lưu dữ liệu kiểm kê: Sheet 'KIEMKE' trong file TARGET
 */
function saveBatchToKiemKeSheet(dataArray, spreadSheetId, sheetName) {
  if (!Array.isArray(dataArray) || dataArray.length === 0) return { added: 0 };
  
  const targetId = spreadSheetId || TARGET_SHEET_ID;
  const targetName = sheetName || 'KIEMKE';
  const lock = LockService.getScriptLock(); // Khóa để tránh ghi đè khi nhiều người cùng quét
  
  try {
    lock.waitLock(10000); // Đợi tối đa 10s
    const ss = SpreadsheetApp.openById(targetId);
    let sheet = ss.getSheetByName(targetName);
    
    // Nếu chưa có sheet thì tạo mới và thêm Header
    if (!sheet) {
      sheet = ss.insertSheet(targetName);
      sheet.appendRow([
        "SKU", "Mục Đích", "Kiện Giấy", "Loại Giấy", "Định Lượng", 
        "Nhà CC", "Nhà SX", "Ngày Nhập", "Ngày SX", "Dài (cm)", 
        "Rộng (cm)", "Trọng Lượng", "Số Lượng", "Đơn Hàng", "Mã VT", 
        "Vị Trí", "Chờ Xuất", "Người Kiểm", "Thời Gian", "Client ID"
      ]);
    }
    
    // Check Client ID để tránh trùng lặp (Idempotency)
    const existingIds = new Set();
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
       // Cột 20 (T) lưu Client Queue ID
       const ids = sheet.getRange(2, 20, lastRow - 1, 1).getValues();
       ids.forEach(r => { if(r[0]) existingIds.add(String(r[0])); });
    }

    const rowsToAdd = [];
    const now = new Date();
    const nowStr = Utilities.formatDate(now, "GMT+7", "dd/MM/yyyy HH:mm:ss");

    for (const item of dataArray) {
      // Nếu ID này đã lưu rồi thì bỏ qua
      if (item._clientQueueId && existingIds.has(String(item._clientQueueId))) continue;

      rowsToAdd.push([
        item.sku, 
        item.purpose, 
        item.packageId, 
        item.type, 
        item.gsm,
        item.supplier, 
        item.manufacturer, 
        item.importDate, 
        item.prodDate,
        item.lengthCm, 
        item.widthCm, 
        item.weight, 
        item.quantity, 
        item.customerOrder, 
        item.materialCode, 
        item.location, 
        item.pendingOut,
        item.importer, 
        "'" + nowStr, // Thêm dấu ' để Excel hiểu là Text, không bị lỗi format ngày
        item._clientQueueId
      ]);
    }

    // Ghi hàng loạt vào cuối sheet
    if (rowsToAdd.length > 0) {
      sheet.getRange(lastRow + 1, 1, rowsToAdd.length, rowsToAdd[0].length).setValues(rowsToAdd);
    }

    return { added: rowsToAdd.length };

  } catch (e) {
    throw new Error(e.message);
  } finally {
    lock.releaseLock(); // Giải phóng khóa
  }
}