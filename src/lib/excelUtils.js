import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const DATA_PATH = path.join(process.cwd(), 'data', 'item.xlsx');

// 确保目录和文件存在
function ensureFileExists() {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (!fs.existsSync(DATA_PATH)) {
    const ws = XLSX.utils.json_to_sheet([], { header: ['名称', '封装', '数量', '编号', '一级分类', '二级分类', '修改时间', '修改人'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    
    // 修复：使用原生 fs 写入 Buffer，而不是 XLSX.writeFile
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(DATA_PATH, buf);
  }
}

export function readInventory() {
  try {
    ensureFileExists();
    // 修复：使用原生 fs 读取 Buffer，而不是 XLSX.readFile
    const fileBuffer = fs.readFileSync(DATA_PATH);
    const wb = XLSX.read(fileBuffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json(ws);
  } catch (error) {
    console.error("🔥 [Excel读取失败]:", error);
    throw new Error("无法读取物料库文件，详情请查看终端日志。");
  }
}

export function writeInventory(data) {
  try {
    ensureFileExists();
    const ws = XLSX.utils.json_to_sheet(data, { header: ['名称', '封装', '数量', '编号', '一级分类', '二级分类', '修改时间', '修改人'] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    
    // 修复：使用原生 fs 写入 Buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    fs.writeFileSync(DATA_PATH, buf);
  } catch (error) {
    console.error("🔥 [Excel写入失败]:", error);
    throw new Error("无法写入物料库文件，请确保该 Excel 文件没有被其他软件(如WPS)打开。");
  }
}