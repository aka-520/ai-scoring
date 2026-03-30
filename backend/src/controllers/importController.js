const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const XLSX = require('xlsx');
const prisma = require('../prisma');

const UPLOAD_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') cb(null, true);
    else cb(new Error('僅接受 .xlsx 或 .xls 檔案'));
  },
});

const COL_MAP = {
  '部門': 'department',
  '課級': 'section',
  '場景名稱': 'sceneName',
  '維持型或開發型': 'maintainOrDevelop',
  '是否由資訊協助完成': 'itAssisted',
  'Agent類型': 'agentCategory',
  '開發工具/方法描述': 'developToolDesc',
  '輸入描述': 'inputDesc',
  '輸出描述': 'outputDesc',
  '工作步驟': 'taskSteps',
  '每次花費時間(小時)': 'timePerExecution',
  '月執行頻率': 'monthlyFrequency',
  '需求人次': 'demandCount',
  '執行人員': 'taskOwners',
  '種子人員': 'seedOwners',
  '直屬主管': 'directSupervisor',
  '預估省時(小時/月)': 'timeSavedHours',
  '優先度': 'priority',
  '備註': 'note',
};
const REQUIRED_COLS = Object.keys(COL_MAP);

function parseItAssisted(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim().toLowerCase();
  if (['是', 'y', '1', 'true'].includes(s)) return true;
  if (['否', 'n', '0', 'false'].includes(s)) return false;
  return null;
}

exports.uploadMiddleware = upload.single('file');

exports.importExcel = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '請上傳 Excel 檔案' });
  const filePath = req.file.path;

  try {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    if (rows.length < 2) {
      return res.status(400).json({ error: 'Excel 內容為空（至少需要標題列 + 一筆資料）' });
    }

    const headerRow = rows[0].map(h => String(h).trim());
    const colIndex = {};
    for (const [title, field] of Object.entries(COL_MAP)) {
      const idx = headerRow.indexOf(title);
      if (idx !== -1) colIndex[field] = idx;
    }

    const missing = REQUIRED_COLS.filter(title => colIndex[COL_MAP[title]] === undefined);
    if (missing.length > 0) {
      return res.status(400).json({ error: '缺少必要欄位，匯入被拒絕', missingColumns: missing });
    }

    const dataRows = rows.slice(1).filter(row => row.some(cell => cell !== ''));
    const errors = [];
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      const get = (field) => {
        const idx = colIndex[field];
        return idx !== undefined ? String(row[idx] ?? '').trim() : '';
      };

      try {
        const sceneName = get('sceneName');
        if (!sceneName) {
          errors.push({ row: rowNum, error: '場景名稱為空，跳過此列' });
          failedCount++;
          continue;
        }

        const deptName = get('department');
        if (!deptName) {
          errors.push({ row: rowNum, error: '部門名稱為空' });
          failedCount++;
          continue;
        }

        const dept = await prisma.department.findFirst({ where: { name: deptName } });
        if (!dept) {
          errors.push({ row: rowNum, error: `找不到部門：${deptName}` });
          failedCount++;
          continue;
        }

        let sectionId = null;
        const sectionName = get('section');
        if (sectionName) {
          const sec = await prisma.section.findFirst({ where: { name: sectionName, departmentId: dept.id } });
          if (sec) sectionId = sec.id;
        }

        const hashSource = `${deptName}|${sectionName}|${sceneName}`;
        const importHash = crypto.createHash('md5').update(hashSource).digest('hex');

        const existing = await prisma.scene.findUnique({ where: { importHash } });
        if (existing) {
          errors.push({ row: rowNum, error: `場景已存在（itemNo: ${existing.itemNo}），跳過`, level: 'warn' });
          failedCount++;
          continue;
        }

        const last = await prisma.scene.findFirst({ orderBy: { id: 'desc' } });
        const nextNum = last ? (parseInt(last.itemNo.replace('AI-', '')) + 1) : 1;
        const itemNo = `AI-${String(nextNum).padStart(4, '0')}`;

        await prisma.scene.create({
          data: {
            itemNo,
            departmentId: dept.id,
            sectionId,
            sceneName,
            maintainOrDevelop: get('maintainOrDevelop') || null,
            itAssisted: parseItAssisted(get('itAssisted')),
            agentCategory: get('agentCategory') || null,
            developToolDesc: get('developToolDesc') || null,
            inputDesc: get('inputDesc') || null,
            outputDesc: get('outputDesc') || null,
            taskSteps: get('taskSteps') || null,
            timePerExecution: get('timePerExecution') ? parseFloat(get('timePerExecution')) : null,
            monthlyFrequency: get('monthlyFrequency') ? parseFloat(get('monthlyFrequency')) : null,
            demandCount: get('demandCount') ? parseInt(get('demandCount')) : null,
            taskOwners: get('taskOwners') || null,
            seedOwners: get('seedOwners') || null,
            directSupervisor: get('directSupervisor') || null,
            timeSavedHours: get('timeSavedHours') ? parseFloat(get('timeSavedHours')) : null,
            priority: get('priority') || '中',
            note: get('note') || null,
            importHash,
          },
        });
        successCount++;
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
        failedCount++;
      }
    }

    res.json({
      message: '匯入完成',
      totalRows: dataRows.length,
      successRows: successCount,
      failedRows: failedCount,
      errors,
    });
  } catch (err) {
    res.status(500).json({ error: '匯入失敗：' + err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }
};

exports.getTemplate = async (req, res) => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([REQUIRED_COLS]);
  ws['!cols'] = REQUIRED_COLS.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, '場景匯入範本');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="scene_import_template.xlsx"');
  res.send(buf);
};
