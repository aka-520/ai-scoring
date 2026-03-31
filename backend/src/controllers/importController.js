const path = require('path');
const fs = require('fs');
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

// 欄位標題 → 欄位名稱
const COL_MAP = {
  '項目編號':               'itemNo',
  '所屬本部':               'division',
  '所屬部門':               'department',
  '所屬課別':               'section',
  '場景名稱':               'sceneName',
  '維持/開發/作廢':         'maintainOrDevelop',
  '是否由資訊協助完成':     'itAssisted',
  '開發方式':               'developMethod',
  'AI Agent用途分類':       'agentCategory',
  '開發工具說明':           'developToolDesc',
  '常見問項/希望AI處理什麼': 'inputDesc',
  '預期輸出成果':           'outputDesc',
  '任務步驟或處理邏輯':     'taskSteps',
  '原始資料範例說明':       'rawDataExample',
  '最終資料範例說明':       'finalDataExample',
  '每次執行耗費時間':       'timePerExecution',
  '執行頻率':               'monthlyFrequency',
  '有需求的人數':           'demandCount',
  '任務負責人':             'taskOwners',
  '種子負責人':             'seedOwners',
  '直屬主管':               'directSupervisor',
  '優先序':                 'priority',
  '狀態':                   'status',
  '進度(%)':                'progress',
  '成立日':                 'establishDate',
  '預計完成日':             'targetDate',
  '上線日期':               'goLiveDate',
  '原總作業時數':           'originalHours',
  '改善後預估總作業時數':   'improvedHours',
  '原總作業人數':           'originalHeadcount',
  '改善後總作業人數':       'improvedHeadcount',
  '文字成效說明':           'resultText',
  '上線實際成效說明':       'actualResultText',
  '其他量化成效說明':       'otherMetrics',
  '備註':                   'note',
};
const ALL_COLS = Object.keys(COL_MAP);
const REQUIRED_COLS = ['場景名稱', '所屬部門'];

function parseItAssisted(val) {
  if (val === null || val === undefined || val === '') return null;
  const s = String(val).trim().toLowerCase();
  if (['是', 'y', '1', 'true'].includes(s)) return true;
  if (['否', 'n', '0', 'false'].includes(s)) return false;
  return null;
}

function parseDate(val) {
  if (!val) return null;
  // Excel 序列號
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(d.y, d.m - 1, d.d);
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
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
    let updatedCount = 0;
    let failedCount = 0;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2;
      const get = (field) => {
        const idx = colIndex[field];
        return idx !== undefined ? String(row[idx] ?? '').trim() : '';
      };
      const getRaw = (field) => {
        const idx = colIndex[field];
        return idx !== undefined ? row[idx] : '';
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
          errors.push({ row: rowNum, error: '所屬部門為空' });
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

        const sceneData = {
          departmentId: dept.id,
          sectionId,
          sceneName,
          maintainOrDevelop: get('maintainOrDevelop') || null,
          itAssisted: parseItAssisted(get('itAssisted')),
          developMethod: get('developMethod') || null,
          agentCategory: get('agentCategory') || null,
          developToolDesc: get('developToolDesc') || null,
          inputDesc: get('inputDesc') || null,
          outputDesc: get('outputDesc') || null,
          taskSteps: get('taskSteps') || null,
          rawDataExample: get('rawDataExample') || null,
          finalDataExample: get('finalDataExample') || null,
          timePerExecution: get('timePerExecution') || null,
          monthlyFrequency: get('monthlyFrequency') || null,
          demandCount: get('demandCount') ? parseInt(get('demandCount')) : null,
          taskOwners: get('taskOwners') || null,
          seedOwners: get('seedOwners') || null,
          directSupervisor: get('directSupervisor') || null,
          priority: get('priority') || '中',
          status: get('status') || '規劃中',
          progress: get('progress') ? Math.min(100, Math.max(0, parseInt(get('progress')))) : 0,
          establishDate: parseDate(getRaw('establishDate')),
          targetDate: parseDate(getRaw('targetDate')),
          goLiveDate: parseDate(getRaw('goLiveDate')),
          originalHours: get('originalHours') ? parseFloat(get('originalHours')) : null,
          improvedHours: get('improvedHours') ? parseFloat(get('improvedHours')) : null,
          originalHeadcount: get('originalHeadcount') ? parseInt(get('originalHeadcount')) : null,
          improvedHeadcount: get('improvedHeadcount') ? parseInt(get('improvedHeadcount')) : null,
          resultText: get('resultText') || null,
          actualResultText: get('actualResultText') || null,
          otherMetrics: get('otherMetrics') || null,
          note: get('note') || null,
        };

        const providedItemNo = get('itemNo');

        if (providedItemNo) {
          // 有項目編號 → upsert
          const existing = await prisma.scene.findUnique({ where: { itemNo: providedItemNo } });
          if (existing) {
            await prisma.scene.update({ where: { itemNo: providedItemNo }, data: sceneData });
            errors.push({ row: rowNum, error: `已覆蓋更新（${providedItemNo}）`, level: 'warn' });
            updatedCount++;
          } else {
            await prisma.scene.create({ data: { itemNo: providedItemNo, ...sceneData } });
            successCount++;
          }
        } else {
          // 無項目編號 → 新增，自動產生
          const last = await prisma.scene.findFirst({ orderBy: { id: 'desc' } });
          const nextNum = last ? (parseInt(last.itemNo.replace('AI-', '')) + 1) : 1;
          const itemNo = `AI-${String(nextNum).padStart(4, '0')}`;
          await prisma.scene.create({ data: { itemNo, ...sceneData } });
          successCount++;
        }
      } catch (err) {
        errors.push({ row: rowNum, error: err.message });
        failedCount++;
      }
    }

    res.json({
      message: '匯入完成',
      totalRows: dataRows.length,
      successRows: successCount,
      updatedRows: updatedCount,
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
  const ws = XLSX.utils.aoa_to_sheet([ALL_COLS]);
  ws['!cols'] = ALL_COLS.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ws, '場景匯入範本');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="scene_import_template.xlsx"');
  res.send(buf);
};

exports.exportExcel = async (req, res) => {
  try {
    const scenes = await prisma.scene.findMany({
      include: {
        department: { include: { division: true } },
        section: true,
      },
      orderBy: { itemNo: 'asc' },
    });

    const header = ALL_COLS;
    const dataRows = scenes.map(s => [
      s.itemNo,
      s.department?.division?.name || '',
      s.department?.name || '',
      s.section?.name || '',
      s.sceneName,
      s.maintainOrDevelop || '',
      s.itAssisted === true ? '是' : s.itAssisted === false ? '否' : '',
      s.developMethod || '',
      s.agentCategory || '',
      s.developToolDesc || '',
      s.inputDesc || '',
      s.outputDesc || '',
      s.taskSteps || '',
      s.rawDataExample || '',
      s.finalDataExample || '',
      s.timePerExecution || '',
      s.monthlyFrequency || '',
      s.demandCount ?? '',
      s.taskOwners || '',
      s.seedOwners || '',
      s.directSupervisor || '',
      s.priority,
      s.status,
      s.progress,
      s.establishDate ? s.establishDate.toISOString().substring(0, 10) : '',
      s.targetDate ? s.targetDate.toISOString().substring(0, 10) : '',
      s.goLiveDate ? s.goLiveDate.toISOString().substring(0, 10) : '',
      s.originalHours ?? '',
      s.improvedHours ?? '',
      s.originalHeadcount ?? '',
      s.improvedHeadcount ?? '',
      s.resultText || '',
      s.actualResultText || '',
      s.otherMetrics || '',
      s.note || '',
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws['!cols'] = header.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, '場景資料');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const filename = `scenes_export_${new Date().toISOString().substring(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: '匯出失敗：' + err.message });
  }
};
