<template>
  <AppLayout>
    <h2 class="page-title">使用者管理</h2>
    <el-button type="primary" style="margin-bottom:16px" @click="openCreate">+ 新增使用者</el-button>

    <el-table :data="users" stripe v-loading="loading" size="small">
      <el-table-column prop="username" label="帳號" width="120" />
      <el-table-column prop="name" label="姓名" width="110" />
      <el-table-column label="角色" width="200">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r" size="small" style="margin-right:4px">{{ roleLabel(r) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="所屬組織" min-width="160">
        <template #default="{ row }">
          <span v-if="row.section">{{ row.section?.department?.division?.name }} / {{ row.section?.department?.name }} / {{ row.section?.name }}</span>
          <span v-else-if="row.department">{{ row.department?.division?.name }} / {{ row.department?.name }}</span>
          <span v-else-if="row.division">{{ row.division?.name }}</span>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="狀態" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.active ? 'success' : 'info'" size="small">{{ row.active ? '啟用' : '停用' }}</el-tag>
          <br />
          <el-button
            size="small"
            :type="row.active ? 'warning' : 'success'"
            style="margin-top:4px"
            @click="toggleActive(row)"
          >{{ row.active ? '停用' : '啟用' }}</el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="210">
        <template #default="{ row }">
          <el-button size="small" @click="openEdit(row)">編輯</el-button>
          <el-button size="small" @click="openResetPw(row)">重設密碼</el-button>
          <el-button size="small" type="danger" @click="handleDelete(row)">刪除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 新增/編輯對話框 -->
    <el-dialog v-model="showDialog" :title="editingUser ? '編輯使用者' : '新增使用者'" width="540px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="帳號" v-if="!editingUser">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="初始密碼" v-if="!editingUser">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>

        <!-- 三層組織選擇 -->
        <el-form-item label="本部">
          <el-select v-model="form.divisionId" clearable placeholder="選擇本部" style="width:100%" @change="onDivisionChange">
            <el-option v-for="d in divisions" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="部門">
          <el-select v-model="form.departmentId" clearable placeholder="選擇部門（可選）" style="width:100%" :disabled="!form.divisionId" @change="onDepartmentChange">
            <el-option v-for="d in filteredDepts" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="課別">
          <el-select v-model="form.sectionId" clearable placeholder="選擇課別（可選）" style="width:100%" :disabled="!form.departmentId" @change="onSectionChange">
            <el-option v-for="s in filteredSections" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>

        <!-- 姓名：有 DeptPerson 候選時改下拉，否則輸入框 -->
        <el-form-item label="姓名">
          <div style="display:flex;gap:8px;width:100%">
            <template v-if="nameCandidates.length > 0 && !manualNameInput">
              <el-select v-model="form.name" filterable allow-create placeholder="從主管名單選擇或自行輸入" style="flex:1">
                <el-option v-for="p in nameCandidates" :key="p.id" :label="p.name" :value="p.name" />
              </el-select>
            </template>
            <template v-else>
              <el-input v-model="form.name" placeholder="輸入姓名" style="flex:1" />
            </template>
            <el-button v-if="nameCandidates.length > 0" size="small" @click="manualNameInput = !manualNameInput">
              {{ manualNameInput ? '從名單選' : '手動輸入' }}
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="角色">
          <el-checkbox-group v-model="form.roles">
            <el-checkbox v-for="r in roleOptions" :key="r" :value="r">{{ roleLabel(r) }}</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">儲存</el-button>
      </template>
    </el-dialog>

    <!-- 重設密碼 -->
    <el-dialog v-model="showResetPw" title="重設密碼" width="380px">
      <el-input v-model="newPassword" type="password" show-password placeholder="輸入新密碼（至少 6 字元）" />
      <template #footer>
        <el-button @click="showResetPw = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleResetPw">確認重設</el-button>
      </template>
    </el-dialog>
  </AppLayout>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usersApi, divisionsApi, departmentsApi, sectionsApi, deptPersonsApi } from '../../api/index.js'
import { ROLE_OPTIONS, getRoleLabel } from '../../constants/roles.js'
import AppLayout from '../../components/AppLayout.vue'

const users = ref([])
const divisions = ref([])
const allDepartments = ref([])
const allSections = ref([])
const nameCandidates = ref([])
const manualNameInput = ref(false)

const loading = ref(false)
const saving = ref(false)
const showDialog = ref(false)
const showResetPw = ref(false)
const editingUser = ref(null)
const resetTarget = ref(null)
const newPassword = ref('')

const roleOptions = ROLE_OPTIONS
function roleLabel(r) { return getRoleLabel(r) }

const form = reactive({
  username: '', password: '', name: '', roles: [],
  divisionId: null, departmentId: null, sectionId: null,
})

const filteredDepts = computed(() =>
  form.divisionId ? allDepartments.value.filter(d => d.divisionId === form.divisionId) : []
)
const filteredSections = computed(() =>
  form.departmentId ? allSections.value.filter(s => s.departmentId === form.departmentId) : []
)

// 當三層任一改變，重新載入 DeptPerson 候選名單
async function loadNameCandidates() {
  manualNameInput.value = false
  const params = {}
  if (form.sectionId) params.sectionId = form.sectionId
  else if (form.departmentId) params.departmentId = form.departmentId
  else if (form.divisionId) params.divisionId = form.divisionId
  else { nameCandidates.value = []; return }

  try {
    const res = await deptPersonsApi.list(params)
    nameCandidates.value = res.data
  } catch {
    nameCandidates.value = []
  }
}

function onDivisionChange() {
  form.departmentId = null
  form.sectionId = null
  loadNameCandidates()
}
function onDepartmentChange() {
  form.sectionId = null
  loadNameCandidates()
}
function onSectionChange() {
  loadNameCandidates()
}

onMounted(async () => {
  loading.value = true
  try {
    const [uRes, divRes, dRes, sRes] = await Promise.all([
      usersApi.list(),
      divisionsApi.list(),
      departmentsApi.list(),
      sectionsApi.list(),
    ])
    users.value = uRes.data
    divisions.value = divRes.data
    allDepartments.value = dRes.data
    allSections.value = sRes.data
  } finally { loading.value = false }
})

function openCreate() {
  editingUser.value = null
  nameCandidates.value = []
  manualNameInput.value = false
  Object.assign(form, { username: '', password: '', name: '', roles: [], divisionId: null, departmentId: null, sectionId: null })
  showDialog.value = true
}

function openEdit(user) {
  editingUser.value = user
  nameCandidates.value = []
  manualNameInput.value = false
  Object.assign(form, {
    name: user.name,
    roles: [...user.roles],
    divisionId: user.divisionId || null,
    departmentId: user.departmentId || null,
    sectionId: user.sectionId || null,
  })
  showDialog.value = true
  // 帶入後載入候選名單
  loadNameCandidates()
}

async function handleSave() {
  if (!form.name?.trim()) return ElMessage.warning('請輸入姓名')
  if (form.roles.length === 0) return ElMessage.warning('請至少選擇一個角色')
  
  // 新增時檢查帳號是否填入
  if (!editingUser.value && !form.username?.trim()) {
    return ElMessage.warning('請輸入帳號')
  }
  
  // 新增時檢查密碼
  if (!editingUser.value && !form.password?.trim()) {
    return ElMessage.warning('請輸入密碼')
  }
  if (!editingUser.value && form.password.length < 6) {
    return ElMessage.warning('密碼至少 6 個字元')
  }
  
  saving.value = true
  try {
    const payload = {
      name: form.name,
      roles: form.roles,
      divisionId: form.divisionId,
      departmentId: form.departmentId,
      sectionId: form.sectionId,
    }
    if (editingUser.value) {
      const res = await usersApi.update(editingUser.value.id, payload)
      const idx = users.value.findIndex(u => u.id === editingUser.value.id)
      if (idx !== -1) users.value[idx] = res.data
    } else {
      const res = await usersApi.create({ ...form, ...payload })
      users.value.push(res.data)
    }
    showDialog.value = false
    ElMessage.success('儲存成功')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '儲存失敗')
  } finally { saving.value = false }
}

function openResetPw(user) { resetTarget.value = user; newPassword.value = ''; showResetPw.value = true }

async function handleResetPw() {
  if (!newPassword.value || newPassword.value.length < 6) return ElMessage.warning('密碼至少 6 字元')
  saving.value = true
  try {
    await usersApi.resetPassword(resetTarget.value.id, { newPassword: newPassword.value })
    ElMessage.success('密碼已重設，使用者下次登入需變更密碼')
    showResetPw.value = false
  } finally { saving.value = false }
}

async function toggleActive(user) {
  await usersApi.update(user.id, { active: !user.active })
  user.active = !user.active
}

async function handleDelete(user) {
  try {
    await ElMessageBox.confirm(
      `確定要刪除使用者「${user.name}」（${user.username}）？`,
      '確認刪除',
      { type: 'warning', confirmButtonText: '確認刪除', cancelButtonText: '取消' }
    )
  } catch { return }
  try {
    await usersApi.remove(user.id)
    const idx = users.value.findIndex(u => u.id === user.id)
    if (idx !== -1) users.value.splice(idx, 1)
    ElMessage.success('使用者已刪除')
  } catch (e) {
    ElMessage.error(e.response?.data?.error || '刪除失敗')
  }
}
</script>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
</style>
