<template>
  <AppLayout>
    <div class="import-view">
      <h2 class="page-title">📊 Excel 批次匯入</h2>

      <!-- 使用說明 -->
      <el-alert type="info" :closable="false" style="margin-bottom: 16px">
        <template #title>
          請使用標準範本匯入，需包含以下 <strong>19 個必要欄位</strong>（標題名稱必須完全一致）
        </template>
        <div class="col-list">
          {{ requiredCols.join('、') }}
        </div>
      </el-alert>

      <!-- 模板和上傳區域 -->
      <div class="upload-section">
        <el-button @click="downloadTemplate" icon="Download" style="margin-bottom: 16px">
          下載 Excel 範本
        </el-button>

        <el-upload
          ref="uploadRef"
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx,.xls"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :disabled="uploading"
        >
          <el-icon class="upload-icon"><Upload /></el-icon>
          <div class="upload-text">拖曳 Excel 檔案至此，或 <em>點擊選取</em></div>
          <template #tip>
            <div class="el-upload__tip">僅支援 .xlsx / .xls，檔案大小不超過 10MB</div>
          </template>
        </el-upload>

        <div class="upload-actions">
          <el-button
            type="primary"
            :loading="uploading"
            :disabled="!selectedFile || uploading"
            @click="handleUpload"
          >
            {{ uploading ? '匯入中...' : '開始匯入' }}
          </el-button>
          <el-button v-if="selectedFile && !uploading" @click="handleReset">
            重置
          </el-button>
        </div>
      </div>

      <!-- 成功提示 -->
      <el-result
        v-if="result && !result.missingColumns && result.successRows > 0 && result.failedRows === 0"
        icon="success"
        title="匯入完成"
        :sub-title="`成功匯入 ${result.successRows} 筆場景`"
        style="margin: 32px 0"
      />

      <!-- 結果卡片 -->
      <el-card v-if="result" class="result-card">
        <template #header>
          <div class="card-header">
            <span>📊 匯入結果統計</span>
            <el-button type="link" @click="handleResetResult">清除結果</el-button>
          </div>
        </template>

        <!-- 統計摘要 -->
        <el-row :gutter="16" class="summary-row">
          <el-col :xs="24" :sm="8">
            <div class="stat-item">
              <div class="stat-label">總筆數</div>
              <div class="stat-value">{{ result.totalRows }}</div>
            </div>
          </el-col>
          <el-col :xs="24" :sm="8">
            <div class="stat-item success">
              <div class="stat-label">✓ 成功</div>
              <div class="stat-value">{{ result.successRows }}</div>
            </div>
          </el-col>
          <el-col :xs="24" :sm="8">
            <div class="stat-item error">
              <div class="stat-label">✗ 失敗/跳過</div>
              <div class="stat-value">{{ result.failedRows }}</div>
            </div>
          </el-col>
        </el-row>

        <!-- 缺失欄位提示 -->
        <div v-if="result.missingColumns" class="error-section">
          <el-alert type="error" :closable="false" title="❌ 缺少必要欄位，匯入被拒絕">
            <div class="missing-cols">{{ result.missingColumns.join('、') }}</div>
          </el-alert>
        </div>

        <!-- 錯誤詳細表格 -->
        <div v-if="result.errors && result.errors.length > 0" class="error-section">
          <p class="error-title">⚠️ 錯誤/警告明細（{{ result.errors.length }} 筆）</p>
          <el-table
            :data="result.errors"
            size="small"
            max-height="350"
            stripe
            :default-sort="{ prop: 'row', order: 'ascending' }"
          >
            <el-table-column prop="row" label="行號" width="70" sortable />
            <el-table-column prop="error" label="說明" show-overflow-tooltip />
            <el-table-column prop="level" label="類型" width="70">
              <template #default="{ row }">
                <el-tag
                  :type="row.level === 'warn' ? 'warning' : 'danger'"
                  size="small"
                >
                  {{ row.level === 'warn' ? '⚠️ 警告' : '❌ 錯誤' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { importApi } from '../api/index.js'
import AppLayout from '../components/AppLayout.vue'
import { Upload, Download } from '@element-plus/icons-vue'

const uploadRef = ref()
const selectedFile = ref(null)
const uploading = ref(false)
const result = ref(null)

const requiredCols = [
  '部門', '課級', '場景名稱', '維持型或開發型', '是否由資訊協助完成',
  'Agent類型', '開發工具/方法描述', '輸入描述', '輸出描述', '工作步驟',
  '每次花費時間(小時)', '月執行頻率', '需求人次', '執行人員', '種子人員',
  '直屬主管', '預估省時(小時/月)', '優先度', '備註',
]

function handleFileChange(file) {
  selectedFile.value = file.raw
}

function handleFileRemove() {
  selectedFile.value = null
}

function handleReset() {
  selectedFile.value = null
  uploadRef.value?.clearFiles()
}

function handleResetResult() {
  result.value = null
  handleReset()
}

async function downloadTemplate() {
  try {
    const res = await importApi.downloadTemplate()
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scene_import_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('範本下載成功')
  } catch {
    ElMessage.error('範本下載失敗')
  }
}

async function handleUpload() {
  if (!selectedFile.value) {
    ElMessage.warning('請先選擇要匯入的檔案')
    return
  }

  uploading.value = true
  result.value = null

  try {
    const fd = new FormData()
    fd.append('file', selectedFile.value)
    const res = await importApi.uploadExcel(fd)
    result.value = res.data

    if (res.data.successRows > 0) {
      ElMessage.success(`✓ 成功匯入 ${res.data.successRows} 筆場景`)
      // 匯入成功後延遲 1.5 秒再清空（讓用戶看到成功提示）
      setTimeout(() => {
        handleReset()
      }, 1500)
    }

    if (res.data.failedRows > 0) {
      ElMessage.warning(`⚠️ 有 ${res.data.failedRows} 筆未成功，請查看錯誤詳情`)
    }
  } catch (e) {
    const data = e.response?.data
    if (data?.missingColumns) {
      result.value = data
      ElMessage.error('❌ 缺少必要欄位，匯入被拒絕')
    } else {
      ElMessage.error('❌ ' + (data?.error || '匯入失敗'))
    }
  } finally {
    uploading.value = false
  }
}
</script>

<style scoped>
.import-view {
  max-width: 900px;
}

.page-title {
  margin: 0 0 20px;
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.col-list {
  margin-top: 8px;
  color: #606266;
  font-size: 13px;
  line-height: 1.6;
}

/* 上傳區塊 */
.upload-section {
  background: #fafafa;
  padding: 24px;
  border-radius: 4px;
  margin-bottom: 20px;
}

:deep(.el-upload-dragger) {
  width: 100%;
  border-radius: 6px;
  transition: all 0.3s ease;
}

:deep(.el-upload-dragger:hover) {
  border-color: #409eff;
  background-color: #f1f7ff;
}

:deep(.el-upload-dragger.is-dragover) {
  border-color: #409eff;
  background-color: #e6f7ff;
}

:deep(.el-upload-dragger.is-disabled) {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload-icon {
  font-size: 48px;
  color: #909399;
  margin-bottom: 8px;
}

.upload-text {
  margin-top: 12px;
  color: #606266;
  font-size: 15px;
}

.upload-text em {
  color: #409eff;
  font-weight: 500;
  font-style: normal;
}

:deep(.el-upload__tip) {
  color: #909399;
  font-size: 12px;
  margin-top: 8px;
}

.upload-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

/* 結果卡片 */
.result-card {
  margin-top: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.summary-row {
  margin-bottom: 20px;
  padding: 12px 0;
}

.stat-item {
  padding: 16px;
  background: #f5f7fa;
  border-radius: 4px;
  text-align: center;
  transition: all 0.3s ease;
}

.stat-item:hover {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.stat-item.success {
  background: #f0f9ff;
  border-left: 4px solid #67c23a;
}

.stat-item.error {
  background: #fef0f0;
  border-left: 4px solid #f56c6c;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
  font-weight: 500;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #303133;
}

.stat-item.success .stat-value {
  color: #67c23a;
}

.stat-item.error .stat-value {
  color: #f56c6c;
}

/* 錯誤區塊 */
.error-section {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.error-title {
  font-weight: 600;
  margin-bottom: 12px;
  color: #303133;
  font-size: 14px;
}

.missing-cols {
  color: #606266;
  font-size: 13px;
  line-height: 1.8;
  word-break: break-word;
}

:deep(.el-table) {
  background: #fff;
  border-radius: 4px;
  overflow: hidden;
}

:deep(.el-table__header tr) {
  background: #f5f7fa;
}

:deep(.el-table__body tr:hover > td) {
  background-color: #f5f7fa !important;
}

/* 響應式 */
@media (max-width: 768px) {
  .page-title {
    font-size: 20px;
  }

  .upload-section {
    padding: 16px;
  }

  .stat-value {
    font-size: 24px;
  }
}
</style>
