const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // 配置相关
  readConfig: () => ipcRenderer.invoke('read-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  
  // API调用
  callAPI: (options) => ipcRenderer.invoke('call-api', options),
  
  // 端口相关
  checkPort: (port) => ipcRenderer.invoke('check-port', port),
  findAvailablePort: (startPort) => ipcRenderer.invoke('find-available-port', startPort),
  isPortInUse: (port) => ipcRenderer.invoke('is-port-in-use', port),
  
  // 进程管理
  findPidByPort: (port) => ipcRenderer.invoke('find-pid-by-port', port),
  killProcessByPort: (port) => ipcRenderer.invoke('kill-process-by-port', port),
  
  // 注入工具
  runInjectTool: (options) => ipcRenderer.invoke('run-inject-tool', options),
  
  // 获取授权信息
  getAuthInfo: (wxid) => ipcRenderer.invoke('get-auth-info', wxid),
  
  // 打开外部链接
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  
  // FastAPI服务器
  restartFastAPIServer: (port) => ipcRenderer.invoke('restart-fastapi-server', port),
  
  // 消息监听（用于接收FastAPI推送的消息）
  onFastAPIMessage: (callback) => {
    ipcRenderer.on('fastapi-message', (event, data) => callback(data))
  },
  
  // 移除消息监听
  removeFastAPIMessageListener: () => {
    ipcRenderer.removeAllListeners('fastapi-message')
  }
})

