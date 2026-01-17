/**
 * Electron版本的通用工具函数
 * Node.js版本，独立于vwork_qt项目
 */
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const ini = require('ini')
const { ReadConfig, LoginInfo } = require('../utils/schemas')
const { exec } = require('child_process')
const { promisify } = require('util')
const execAsync = promisify(exec)

/**
 * 获取配置文件路径
 */
function getConfigPath() {
  // 获取electron目录的绝对路径
  const electronDir = __dirname.replace(/[\\/]commons$/, '')
  // 配置文件在项目根目录的conf目录下
  const configPath = path.join(path.dirname(electronDir), 'conf', 'conf.ini')
  return configPath
}

/**
 * 获取应用根目录路径
 */
function getAppRootPath() {
  // 获取electron目录的绝对路径
  const electronDir = __dirname.replace(/[\\/]commons$/, '')
  // 返回项目根目录（electron目录的父目录）
  return path.dirname(electronDir)
}

/**
 * 保存日志到文件
 * @param {object} data - 日志数据对象
 * @returns {Promise<boolean>} 保存成功返回true，失败返回false
 */
async function saveLogToFile(data) {
  try {
    const appRoot = getAppRootPath()
    const logDir = path.join(appRoot, 'logs', 'runLog')
    
    // 确保日志目录存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    
    // 获取当前日期，格式：YYYY-MM-DD（使用本地时间）
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const logFileName = `${dateStr}.log`
    const logFilePath = path.join(logDir, logFileName)
    
    // 格式化时间戳
    const timestamp = data.time_stamp || Math.floor(now.getTime() / 1000)
    const logTime = new Date(timestamp * 1000)
    const timeStr = logTime.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/\//g, '-')
    
    // 格式化日志内容
    let logContent = ''
    if (data.sys) {
      // 系统消息
      logContent = `[${timeStr}] [系统] ${data.content || ''}\n`
    } else {
      // 普通消息
      const sender = data.sender || data.nick_name || ''
      const userId = data.user_id || ''
      const content = data.content || ''
      const msgType = data.is_self_msg === 1 ? '[发出]' : '[收到]'
      logContent = `[${timeStr}] ${msgType} ${sender}(${userId}): ${content}\n`
    }
    
    // 追加写入文件
    fs.appendFileSync(logFilePath, logContent, 'utf-8')
    return true
  } catch (error) {
    console.error(`保存日志失败: ${error.message}`)
    return false
  }
}

/**
 * 异步发送回调
 */
async function sendCallback(url, data) {
  try {
    const response = await axios.post(url, data, {
      timeout: 10000
    })
    return response.data
  } catch (error) {
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return false
    }
    return false
  }
}

/**
 * 判断授权是否有效
 * @param {string} dateStr - 日期字符串，格式：'YYYY-MM-DD HH:mm:ss'
 * @returns {boolean} True表示有效，False表示无效
 */
function validAuthDatetime(dateStr) {
  try {
    if (!dateStr || dateStr === '未授权') {
      return false
    }
    const dt = new Date(dateStr.replace(/-/g, '/'))
    const now = new Date()
    return now <= dt
  } catch (error) {
    return false
  }
}

/**
 * 检查端口是否被占用
 */
function isPortInUse(port) {
  return new Promise((resolve) => {
    const net = require('net')
    const server = net.createServer()
    server.listen(port, () => {
      server.once('close', () => resolve(false))
      server.close()
    })
    server.on('error', () => resolve(true))
  })
}

/**
 * 杀死占用指定端口的进程
 */
async function killProcessByPort(port) {
  const inUse = await isPortInUse(port)
  if (!inUse) {
    return false
  }

  // Windows 系统
  if (process.platform === 'win32') {
    try {
      // 查找占用端口的进程 PID
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`)
      const lines = stdout.trim().split('\n')
      if (!lines || lines.length === 0 || lines[0].trim() === '') {
        console.log(`未找到占用端口 ${port} 的进程`)
        return false
      }

      const pids = new Set()
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 5) {
          const pid = parseInt(parts[parts.length - 1])
          if (!isNaN(pid)) {
            pids.add(pid)
          }
        }
      }

      if (pids.size === 0) {
        return false
      }

      // 杀死所有找到的进程
      for (const pid of pids) {
        try {
          await execAsync(`taskkill /F /PID ${pid}`)
          console.log(`成功终止进程 (PID: ${pid})`)
        } catch (error) {
          console.error(`终止进程失败 (PID: ${pid}):`, error.message)
        }
      }
      return true
    } catch (error) {
      if (error.code === 1) {
        // 未找到进程
        return false
      }
      console.error(`终止进程失败: ${error.message}`)
      return false
    }
  } else {
    // Linux/MacOS 系统
    try {
      const { stdout } = await execAsync(`lsof -ti:${port}`)
      const pids = stdout.trim().split('\n').filter(pid => pid)
      if (pids.length === 0) {
        console.log(`未找到占用端口 ${port} 的进程`)
        return false
      }

      // 杀死所有找到的进程
      for (const pid of pids) {
        try {
          await execAsync(`kill -9 ${pid}`)
          console.log(`成功终止进程 (PID: ${pid})`)
        } catch (error) {
          console.error(`终止进程失败 (PID: ${pid}):`, error.message)
        }
      }
      return true
    } catch (error) {
      if (error.code === 1) {
        // 未找到进程
        return false
      }
      console.error(`终止进程失败: ${error.message}`)
      return false
    }
  }
}

/**
 * 读取INI配置文件
 * @param {string|null} configPath - 配置文件路径，如果为null则使用默认路径
 * @returns {ReadConfig} ReadConfig对象
 */
function readIni(configPath = null) {
  if (configPath === null) {
    configPath = getConfigPath()
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    const conf = ini.parse(content)

    let server_port = '8888'
    let callback = ''
    let open_log = true
    let save_log = true

    if (conf.sys) {
      server_port = conf.sys.server_port || server_port
      callback = conf.sys.callback || callback
      open_log = conf.sys.open_log === 'true' || conf.sys.open_log === true
      save_log = conf.sys.save_log === 'true' || conf.sys.save_log === true
    }

    let login_info_list = '[]'
    if (conf.custom && conf.custom.login_info) {
      login_info_list = conf.custom.login_info
    }

    let login_info = []
    try {
      const parsed = JSON.parse(login_info_list)
      if (Array.isArray(parsed)) {
        login_info = parsed.map(item => new LoginInfo(item))
      }
    } catch (e) {
      console.error('解析login_info失败:', e)
    }

    return new ReadConfig({
      server_port,
      callback,
      open_log,
      save_log,
      login_info
    })
  } catch (error) {
    console.error(`读取配置失败: ${error.message}`)
    return new ReadConfig({
      server_port: '8888',
      callback: '',
      open_log: true,
      save_log: true,
      login_info: []
    })
  }
}

module.exports = {
  getConfigPath,
  getAppRootPath,
  sendCallback,
  validAuthDatetime,
  isPortInUse,
  killProcessByPort,
  readIni,
  saveLogToFile
}

