<template>
  <el-container class="app-container">
    <el-main class="app-main">
      <el-tabs v-model="activeTab" type="border-card" class="main-tabs">
        <el-tab-pane label="首页" name="index">
          <IndexPage />
        </el-tab-pane>
        <el-tab-pane label="运行日志" name="logs">
          <RunLogsPage />
        </el-tab-pane>
        <el-tab-pane label="企微管理" name="manager">
          <VWorkManagerPage />
        </el-tab-pane>
        <el-tab-pane label="设置" name="settings">
          <SettingsPage />
        </el-tab-pane>
      </el-tabs>
    </el-main>
  </el-container>
</template>

<script setup>
import { ref } from 'vue'
import IndexPage from './pages/IndexPage.vue'
import RunLogsPage from './pages/RunLogsPage.vue'
import VWorkManagerPage from './pages/VWorkManagerPage.vue'
import SettingsPage from './pages/SettingsPage.vue'
import { useConfigStore } from './stores/config'

const activeTab = ref('index')
const version = '1.1'

// 初始化配置
const configStore = useConfigStore()
configStore.loadConfig()
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.app-container {
  height: 100vh;
  overflow: hidden;
}

.app-main {
  padding: 0;
  height: calc(100vh - 60px);
}

.main-tabs {
  height: 100%;
  border: none;
}

.main-tabs .el-tabs__content {
  height: calc(100% - 55px);
  overflow: auto;
}

.main-tabs .el-tab-pane {
  height: 100%;
}
</style>

