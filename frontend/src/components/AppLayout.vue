<template>
  <el-container class="layout">
    <!-- 側邊欄 -->
    <el-aside width="220px" class="sidebar">
      <div class="logo">AI 推動管理系統</div>
      <el-menu :default-active="activeMenu" router class="side-menu">
        <el-menu-item index="/dashboard">
          <el-icon><DataAnalysis /></el-icon>
          <span>總覽</span>
        </el-menu-item>
        <el-menu-item index="/scenes">
          <el-icon><Document /></el-icon>
          <span>場景管理</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isAdmin || auth.isManager || auth.isBoss" index="/import">
          <el-icon><Upload /></el-icon>
          <span>Excel 匯入</span>
        </el-menu-item>

        <el-sub-menu v-if="auth.isAdmin" index="admin">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>系統管理</span>
          </template>
          <el-menu-item index="/admin/users">使用者管理</el-menu-item>
          <el-menu-item index="/admin/org">組織架構</el-menu-item>
          <el-menu-item index="/admin/config">目標設定</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <!-- 主區域 -->
    <el-container>
      <el-header class="topbar">
        <div class="topbar-right">
          <span class="username">{{ auth.user?.name }}</span>
          <el-dropdown @command="handleCommand">
            <el-icon style="cursor:pointer; margin-left:8px"><User /></el-icon>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">個人設定</el-dropdown-item>
                <el-dropdown-item command="logout" divided>登出</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      <el-main class="main-content">
        <slot />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.js'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const activeMenu = computed(() => route.path)

function handleCommand(cmd) {
  if (cmd === 'logout') {
    auth.logout()
    router.push('/login')
  } else if (cmd === 'profile') {
    router.push('/profile')
  }
}
</script>

<style scoped>
.layout { height: 100vh; overflow: hidden; }

/* ── 側邊欄 ── */
.sidebar {
  background: #0f172a;
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 8px rgba(0,0,0,.25);
}

.logo {
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  padding: 22px 20px;
  letter-spacing: .5px;
  border-bottom: 1px solid rgba(255,255,255,.07);
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
}

.side-menu {
  border-right: none;
  background: transparent;
  flex: 1;
  padding: 8px 0;
}

/* 一般選單項目文字 */
.side-menu :deep(.el-menu-item),
.side-menu :deep(.el-sub-menu__title) {
  color: #94a3b8;
  height: 46px;
  line-height: 46px;
  margin: 2px 8px;
  border-radius: 8px;
  transition: background .15s, color .15s;
}

/* hover */
.side-menu :deep(.el-menu-item:hover),
.side-menu :deep(.el-sub-menu__title:hover) {
  background: rgba(99,102,241,.15) !important;
  color: #c7d2fe !important;
}

/* 已選中 */
.side-menu :deep(.el-menu-item.is-active) {
  background: #6366f1 !important;
  color: #fff !important;
  font-weight: 600;
}

/* 子選單背景 */
.side-menu :deep(.el-sub-menu .el-menu) {
  background: transparent !important;
}

.side-menu :deep(.el-sub-menu .el-menu .el-menu-item) {
  color: #94a3b8;
  padding-left: 48px !important;
  height: 40px;
  line-height: 40px;
}

.side-menu :deep(.el-sub-menu .el-menu .el-menu-item.is-active) {
  background: #6366f1 !important;
  color: #fff !important;
}

/* sub-menu 展開箭頭顏色 */
.side-menu :deep(.el-sub-menu__icon-arrow) {
  color: #64748b;
}

/* ── 頂部欄 ── */
.topbar {
  background: #fff;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,.06);
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 28px;
  height: 60px;
}

.topbar-right { display: flex; align-items: center; gap: 10px; }
.username { font-size: 14px; color: #475569; font-weight: 500; }

/* ── 主內容 ── */
.main-content { overflow-y: auto; background: #f1f5f9; padding: 28px; }
</style>
