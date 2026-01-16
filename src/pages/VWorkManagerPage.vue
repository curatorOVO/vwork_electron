<template>
  <div class="vwork-manager-page">
    <el-table
      :data="tableData"
      style="width: 100%"
      height="100%"
      stripe
      highlight-current-row
      @row-contextmenu="handleContextMenu"
    >
      <el-table-column prop="nick_name" label="昵称" width="150" align="center" />
      <el-table-column prop="user_id" label="ID" width="200" align="center" show-overflow-tooltip />
      <el-table-column prop="port" label="HTTP端口" width="120" align="center" />
      <el-table-column prop="pid" label="PID" width="100" align="center" />
      <el-table-column prop="expire" label="授权到期时间" width="180" align="center" />
      <el-table-column prop="label" label="标签" align="center" />
    </el-table>

    <!-- 添加企微对话框 -->
    <el-dialog
      v-model="showAddDialog"
      title="添加企微"
      width="400px"
    >
      <el-radio-group v-model="portType">
        <el-radio label="random">随机端口</el-radio>
        <el-radio label="custom">指定端口</el-radio>
      </el-radio-group>
      <el-input
        v-if="portType === 'custom'"
        v-model="customPort"
        placeholder="请输入端口号(1024-10000)"
        style="margin-top: 20px"
      />
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="handleAddWechat">确定</el-button>
      </template>
    </el-dialog>

    <!-- 设置标签对话框 -->
    <el-dialog
      v-model="showTagDialog"
      title="设置标签"
      width="400px"
    >
      <el-input v-model="tagValue" placeholder="请输入标签" />
      <template #footer>
        <el-button @click="showTagDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSetTag">确定</el-button>
      </template>
    </el-dialog>

    <!-- 右键菜单（使用Element Plus的Dropdown） -->
    <el-dropdown ref="contextMenuRef" trigger="contextmenu" @command="handleMenuCommand">
      <span style="display: none;"></span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item divided :command="'add-random'">添加企微（随机端口）</el-dropdown-item>
          <el-dropdown-item :command="'add-custom'">添加企微（指定端口）</el-dropdown-item>
          <el-dropdown-item divided :command="'refresh-auth'" :disabled="!selectedRow">
            刷新授权
          </el-dropdown-item>
          <el-dropdown-item :command="'copy-id'" :disabled="!selectedRow">复制ID</el-dropdown-item>
          <el-dropdown-item divided :command="'set-tag'" :disabled="!selectedRow">设置标签</el-dropdown-item>
          <el-dropdown-item :command="'exit-wechat'" :disabled="!selectedRow">退出微信</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useConfigStore } from '../stores/config'
import { VWorkApi } from '../utils/api'

const configStore = useConfigStore()
const tableData = ref([])
const selectedRow = ref(null)
const contextMenuRef = ref(null)
const showAddDialog = ref(false)
const portType = ref('random')
const customPort = ref('')
const showTagDialog = ref(false)
const tagValue = ref('')
const selectedRowIndex = ref(-1)

const serverPort = computed(() => configStore.config.sys?.server_port || '8888')
const injectKey = 'FUAyVli9Ee15q1wdbzpRsSjbyrVo2cDuhgNdLK3CWCW3Y95YepvLarcVszNGmETk'

// 加载登录信息
const loadLoginInfo = async () => {
  const loginInfo = configStore.getLoginInfo()
  const aliveWechat = []
  
  // 检查每个企微是否还在运行
  for (const item of loginInfo) {
    if (item.port && item.pid) {
      const port = parseInt(item.port)
      const pid = parseInt(item.pid)
      
      // 检查端口是否在使用
      if (window.electronAPI) {
        const portCheck = await window.electronAPI.isPortInUse(port)
        if (portCheck.inUse) {
          // 检查PID是否匹配
          const currentPid = await getPidByPort(port)
          if (currentPid === pid) {
            // 企微还在运行，添加到表格
            tableData.value.push({
              nick_name: item.nick_name || '-',
              user_id: item.user_id || '-',
              port: String(item.port || '-'),
              pid: String(item.pid || '-'),
              expire: item.expire || '未授权',
              label: item.label || ''
            })
            aliveWechat.push(item)
          }
        }
      } else {
        // 如果API不可用，直接添加（开发环境）
        tableData.value.push({
          nick_name: item.nick_name || '-',
          user_id: item.user_id || '-',
          port: String(item.port || '-'),
          pid: String(item.pid || '-'),
          expire: item.expire || '未授权',
          label: item.label || ''
        })
        aliveWechat.push(item)
      }
    }
  }
  
  // 更新配置，只保留存活的企微
  if (aliveWechat.length !== loginInfo.length) {
    await configStore.updateLoginInfo(aliveWechat)
  }
}

// 检查端口是否在使用
const checkPort = async (port) => {
  if (!window.electronAPI) return false
  const result = await window.electronAPI.checkPort(parseInt(port))
  return result.inUse
}

// 添加表格项
const addTableItem = (item) => {
  const newItem = {
    nick_name: item.nick_name || '-',
    user_id: item.user_id || '-',
    port: String(item.port || '-'),
    pid: String(item.pid || '-'),
    expire: item.expire || '未授权',
    label: item.label || ''
  }
  tableData.value.push(newItem)
  return tableData.value.length - 1 // 返回新添加项的索引
}

// 更新表格项
const updateTableItem = (index, updates) => {
  if (index >= 0 && index < tableData.value.length) {
    tableData.value[index] = { ...tableData.value[index], ...updates }
  }
}

// 删除表格项
const deleteTableItem = (index) => {
  if (index >= 0 && index < tableData.value.length) {
    tableData.value.splice(index, 1)
  }
}

// 右键菜单处理
const handleContextMenu = (row, column, event) => {
  event.preventDefault()
  const index = tableData.value.findIndex(item => item === row)
  selectedRow.value = row
  selectedRowIndex.value = index
}

// 菜单命令处理
const handleMenuCommand = async (command) => {
  switch (command) {
    case 'add-random':
    case 'add-custom':
      portType.value = command === 'add-random' ? 'random' : 'custom'
      showAddDialog.value = true
      break
    case 'refresh-auth':
      await handleRefreshAuth()
      break
    case 'copy-id':
      handleCopyId()
      break
    case 'set-tag':
      if (selectedRow.value) {
        tagValue.value = selectedRow.value.label || ''
        showTagDialog.value = true
      }
      break
    case 'exit-wechat':
      await handleExitWechat()
      break
  }
}

// 添加企微
const handleAddWechat = async () => {
  let port
  if (portType.value === 'random') {
    // 查找可用端口
    if (window.electronAPI) {
      const result = await window.electronAPI.findAvailablePort(1024)
      port = result.port
      if (!port) {
        ElMessage.error('未找到可用端口')
        return
      }
    } else {
      ElMessage.error('Electron API不可用')
      return
    }
  } else {
    port = parseInt(customPort.value)
    if (isNaN(port) || port <= 1024 || port > 10000) {
      ElMessage.warning('端口可用范围(1024, 10000]')
      return
    }
    const inUse = await checkPort(port)
    if (inUse) {
      ElMessage.warning('端口已被使用')
      return
    }
  }

  // 运行注入工具
  if (window.electronAPI) {
    try {
      const result = await window.electronAPI.runInjectTool({
        port,
        serverPort: serverPort.value,
        key: injectKey
      })

      if (result.success || (result.output && result.output.includes('注入成功'))) {
        ElMessage.success('企微启动成功，正在登录...')
        const rowIndex = addTableItem({ nick_name: '登录中', port: String(port) })
        showAddDialog.value = false
        
        // 定时检查登录状态
        checkLoginStatus(port, rowIndex)
      } else {
        ElMessage.error('启动失败: ' + result.output)
      }
    } catch (error) {
      ElMessage.error('启动失败: ' + error.message)
    }
  }
}

// 检查登录状态
const checkLoginStatus = async (port, rowIndex) => {
  const maxAttempts = 120 // 最多检查120次（4分钟，每2秒一次）
  let attempts = 0
  let loginCacheKey = `login_${port}`
  let loginCacheExpire = Date.now() + 120000 // 2分钟缓存

  const checkInterval = setInterval(async () => {
    attempts++
    
    // 检查缓存是否过期
    if (Date.now() > loginCacheExpire) {
      clearInterval(checkInterval)
      ElMessage.warning('登录超时，已关闭')
      deleteTableItem(rowIndex)
      // 杀死进程
      if (window.electronAPI) {
        await window.electronAPI.killProcessByPort(port)
      }
      return
    }
    
    // 检查端口是否还在使用
    if (window.electronAPI) {
      const portCheck = await window.electronAPI.isPortInUse(port)
      if (!portCheck.inUse) {
        clearInterval(checkInterval)
        ElMessage.warning('进程已被关闭')
        deleteTableItem(rowIndex)
        return
      }
    }
    
    try {
      const result = await VWorkApi.getLoginStatus(port)
      if (result && result.data) {
        const status = result.data.status
        if (status === 1) {
          // 已登录
          clearInterval(checkInterval)
          const personalInfo = await VWorkApi.getPersonalInfo(port)
          if (personalInfo && personalInfo.data) {
            const data = personalInfo.data.data
            const pid = await getPidByPort(port)
            
            updateTableItem(rowIndex, {
              nick_name: data.nick_name || '-',
              user_id: data.user_id || '-',
              port: String(port),
              pid: String(pid || '-')
            })

            // 获取授权信息
            await refreshAuthForRow(rowIndex, data.user_id, {
              ...data,
              port,
              pid
            })
          }
        }
      }
      
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        ElMessage.warning('登录超时')
        deleteTableItem(rowIndex)
        if (window.electronAPI) {
          await window.electronAPI.killProcessByPort(port)
        }
      }
    } catch (error) {
      console.error('检查登录状态失败:', error)
      if (attempts >= maxAttempts) {
        clearInterval(checkInterval)
        deleteTableItem(rowIndex)
        if (window.electronAPI) {
          await window.electronAPI.killProcessByPort(port)
        }
      }
    }
  }, 2000)
}

// 获取PID
const getPidByPort = async (port) => {
  if (!window.electronAPI) return null
  try {
    const result = await window.electronAPI.findPidByPort(parseInt(port))
    return result > 0 ? result : null
  } catch (error) {
    console.error('获取PID失败:', error)
    return null
  }
}

// 刷新授权
const handleRefreshAuth = async () => {
  if (selectedRowIndex.value < 0) return
  
  const row = tableData.value[selectedRowIndex.value]
  if (!row.user_id || row.user_id === '-') {
    ElMessage.warning('该行数据无效')
    return
  }

  await refreshAuthForRow(selectedRowIndex.value, row.user_id, row)
}

// 刷新授权（内部方法）
const refreshAuthForRow = async (rowIndex, userId, loginInfo) => {
  try {
    if (!window.electronAPI) {
      ElMessage.error('Electron API不可用')
      return
    }

    const result = await window.electronAPI.getAuthInfo(userId)
    let expire = '未授权'
    
    if (result.success && result.data) {
      if (result.data.data) {
        expire = result.data.data.expire || '未授权'
      }
    } else {
      ElMessage.error(result.msg || '获取授权信息失败')
    }
    
    updateTableItem(rowIndex, { expire })

    // 更新配置
    const loginInfoList = configStore.getLoginInfo()
    const index = loginInfoList.findIndex(item => item.user_id === userId)
    const updatedInfo = { ...loginInfo, expire }
    
    if (index >= 0) {
      loginInfoList[index] = updatedInfo
    } else {
      loginInfoList.push(updatedInfo)
    }
    
    await configStore.updateLoginInfo(loginInfoList)
  } catch (error) {
    ElMessage.error('获取授权信息失败: ' + error.message)
    updateTableItem(rowIndex, { expire: '未授权' })
  }
}

// 复制ID
const handleCopyId = () => {
  if (selectedRow.value && selectedRow.value.user_id) {
    navigator.clipboard.writeText(selectedRow.value.user_id).then(() => {
      ElMessage.success('已复制到剪贴板')
    })
  }
}

// 设置标签
const handleSetTag = async () => {
  if (selectedRowIndex.value < 0) return
  
  updateTableItem(selectedRowIndex.value, { label: tagValue.value })
  showTagDialog.value = false

  // 更新配置
  const row = tableData.value[selectedRowIndex.value]
  const loginInfoList = configStore.getLoginInfo()
  const index = loginInfoList.findIndex(item => item.user_id === row.user_id)
  
  if (index >= 0) {
    loginInfoList[index].label = tagValue.value
    await configStore.updateLoginInfo(loginInfoList)
  }
}

// 退出微信
const handleExitWechat = async () => {
  if (selectedRowIndex.value < 0) return

  try {
    await ElMessageBox.confirm('确定要退出该微信吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    const row = tableData.value[selectedRowIndex.value]
    const port = parseInt(row.port)

    // 先尝试调用退出登录API
    try {
      if (row.user_id && row.user_id !== '-') {
        await VWorkApi.logout(port, row.user_id)
      }
    } catch (error) {
      console.error('调用退出登录API失败:', error)
    }
    
    // 杀死进程
    if (window.electronAPI) {
      const killed = await window.electronAPI.killProcessByPort(port)
      if (!killed) {
        console.warn('杀死进程失败，可能进程已不存在')
      }
    }
    
    // 从配置中移除
    const loginInfoList = configStore.getLoginInfo()
    const filtered = loginInfoList.filter(item => item.user_id !== row.user_id)
    await configStore.updateLoginInfo(filtered)
    
    deleteTableItem(selectedRowIndex.value)
    ElMessage.success('已退出微信')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('退出失败: ' + error.message)
    }
  }
}

onMounted(async () => {
  await loadLoginInfo()
})
</script>

<style scoped>
.vwork-manager-page {
  height: 100%;
  padding: 10px;
}

:deep(.el-table) {
  font-size: 13px;
}
</style>

