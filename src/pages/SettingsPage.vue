<template>
  <div class="settings-page">
    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <span>HTTP 设置</span>
          <el-tooltip content="当你需要调用框架的接口时，就是用的这个端口&#10;调用框架的地址为：http://127.0.0.1:端口号/api&#10;如果修改了这个端口之后，必须要重启框架，设置才会生效" placement="top">
            <span><el-icon><QuestionFilled /></el-icon></span>
          </el-tooltip>
        </div>
      </template>
      
      <div class="form-item">
        <label>监听端口：</label>
        <el-input
          v-model="formData.server_port"
          placeholder="请输入端口号(1024-10000)"
          style="width: 300px"
        />
      </div>

      <div class="form-item">
        <label>回调地址：</label>
        <el-input
          v-model="formData.callback"
          placeholder="请输入回调地址，如: http://127.0.0.1:8001/msg"
          style="width: 500px"
        />
        <el-tooltip content="这个回调地址，是框架向你推送企微消息的地址&#10;接口需要是POST，且我传给你的是JSON&#10;你需要搭建这个回调服务，并把地址填入&#10;修改之后不需要重启框架" placement="top">
          <span style="margin-left: 8px"><el-icon><QuestionFilled /></el-icon></span>
        </el-tooltip>
      </div>
    </el-card>

    <el-card class="settings-card">
      <template #header>
        <div class="card-header">
          <span>日志设置</span>
        </div>
      </template>
      
      <div class="form-item">
        <el-checkbox v-model="formData.open_log">开启日志</el-checkbox>
        <el-checkbox v-model="formData.save_log">保存日志</el-checkbox>
        <el-tooltip content="开启之后，会把运行日志保存到logs/runLog下&#10;如果需要开启的话，需要先打开[开启日志]才能生效" placement="top">
          <span style="margin-left: 8px"><el-icon><QuestionFilled /></el-icon></span>
        </el-tooltip>
      </div>
    </el-card>

    <div class="footer-actions">
      <el-button type="primary" size="large" @click="handleSave" :loading="saving">
        保存修改
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'
import { useConfigStore } from '../stores/config'

const configStore = useConfigStore()
const saving = ref(false)

const formData = reactive({
  server_port: '8888',
  callback: '',
  open_log: true,
  save_log: true
})

// 加载配置
const loadConfig = () => {
  const config = configStore.config
  formData.server_port = config.sys?.server_port || '8888'
  formData.callback = config.sys?.callback || ''
  formData.open_log = config.sys?.open_log === 'true' || config.sys?.open_log === true
  formData.save_log = config.sys?.save_log === 'true' || config.sys?.save_log === true
}

// 保存配置
const handleSave = async () => {
  // 验证端口
  const port = parseInt(formData.server_port)
  if (isNaN(port) || port <= 1024 || port > 10000) {
    ElMessage.warning('端口号的范围(1024, 10000]')
    loadConfig() // 恢复原值
    return
  }

  saving.value = true
  try {
    const newConfig = {
      sys: {
        server_port: String(formData.server_port),
        callback: formData.callback || '',
        open_log: String(formData.open_log),
        save_log: String(formData.save_log)
      },
      custom: {
        login_info: configStore.getLoginInfo()
      }
    }

    const result = await configStore.saveConfig(newConfig)
    
    if (result.success) {
      // 如果端口改变了，需要重启FastAPI服务器
      const oldPort = configStore.config.sys?.server_port
      if (oldPort !== String(formData.server_port) && window.electronAPI) {
        await window.electronAPI.restartFastAPIServer(parseInt(formData.server_port))
      }
      ElMessage.success('修改部分设置后，需要重启框架')
    } else {
      ElMessage.error(result.msg || '保存失败')
      loadConfig() // 恢复原值
    }
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
    loadConfig() // 恢复原值
  } finally {
    saving.value = false
  }
}

// 监听配置变化，自动更新表单（当配置加载完成后）
watch(
  () => configStore.config.sys,
  (newSys) => {
    if (newSys && newSys.server_port) {
      loadConfig()
    }
  },
  { deep: true }
)

onMounted(async () => {
  // 确保配置已加载（检查 callback 是否存在，避免空字符串误判）
  const hasLoaded = configStore.config.sys?.server_port && 
                    (configStore.config.sys?.callback !== undefined)
  
  if (!hasLoaded) {
    await configStore.loadConfig()
  }
  loadConfig()
})
</script>

<style scoped>
.settings-page {
  padding: 20px;
  height: 100%;
  overflow-y: auto;
}

.settings-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.form-item {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.form-item label {
  width: 100px;
  text-align: right;
  margin-right: 12px;
  font-size: 14px;
}

.footer-actions {
  display: flex;
  justify-content: center;
  margin-top: 30px;
}

.footer-actions .el-button {
  padding: 12px 48px;
  font-size: 16px;
}
</style>

