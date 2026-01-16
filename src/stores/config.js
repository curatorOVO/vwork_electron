import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConfigStore = defineStore('config', () => {
  const config = ref({
    sys: {
      server_port: '8888',
      callback: '',
      open_log: 'true',
      save_log: 'true'
    },
    custom: {
      login_info: []
    }
  })

  const loading = ref(false)

  // 加载配置
  const loadConfig = async () => {
    if (!window.electronAPI) return
    
    try {
      loading.value = true
      const result = await window.electronAPI.readConfig()
      if (result) {
        config.value = result
        // 解析 login_info JSON字符串
        if (config.value.custom?.login_info && typeof config.value.custom.login_info === 'string') {
          try {
            config.value.custom.login_info = JSON.parse(config.value.custom.login_info)
          } catch (e) {
            config.value.custom.login_info = []
          }
        }
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    } finally {
      loading.value = false
    }
  }

  // 保存配置
  const saveConfig = async (newConfig) => {
    if (!window.electronAPI) return { success: false, msg: 'Electron API不可用' }
    
    try {
      loading.value = true
      // 将 login_info 转换为 JSON 字符串
      const configToSave = { ...newConfig }
      if (configToSave.custom?.login_info && Array.isArray(configToSave.custom.login_info)) {
        configToSave.custom = {
          ...configToSave.custom,
          login_info: JSON.stringify(configToSave.custom.login_info)
        }
      }
      
      const result = await window.electronAPI.saveConfig(configToSave)
      if (result.success) {
        config.value = newConfig
      }
      return result
    } catch (error) {
      console.error('保存配置失败:', error)
      return { success: false, msg: error.message }
    } finally {
      loading.value = false
    }
  }

  // 获取登录信息
  const getLoginInfo = () => {
    const loginInfoStr = config.value.custom?.login_info
    if (Array.isArray(loginInfoStr)) {
      return loginInfoStr
    }
    if (typeof loginInfoStr === 'string') {
      try {
        return JSON.parse(loginInfoStr)
      } catch (e) {
        return []
      }
    }
    return []
  }

  // 更新登录信息
  const updateLoginInfo = async (loginInfo) => {
    const currentConfig = { ...config.value }
    if (!currentConfig.custom) {
      currentConfig.custom = {}
    }
    currentConfig.custom.login_info = loginInfo
    return await saveConfig(currentConfig)
  }

  return {
    config,
    loading,
    loadConfig,
    saveConfig,
    getLoginInfo,
    updateLoginInfo
  }
})

