const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const fs = require('fs')
const net = require('net')
const os = require('os')
let ini
try {
  ini = require('ini')
} catch (e) {
  // 如果ini包不存在，使用简单的解析器
  ini = {
    parse: (str) => {
      const result = {}
      let currentSection = null
      str.split('\n').forEach(line => {
        line = line.trim()
        if (line.startsWith('[') && line.endsWith(']')) {
          currentSection = line.slice(1, -1)
          result[currentSection] = {}
        } else if (line.includes('=') && currentSection) {
          const [key, ...valueParts] = line.split('=')
          result[currentSection][key.trim()] = valueParts.join('=').trim()
        }
      })
      return result
    },
    stringify: (obj) => {
      let result = ''
      Object.keys(obj).forEach(section => {
        result += `[${section}]\n`
        Object.keys(obj[section]).forEach(key => {
          result += `${key} = ${obj[section][key]}\n`
        })
        result += '\n'
      })
      return result
    }
  }
}
const axios = require('axios')

let mainWindow
let fastapiProcess = null
let messageServer = null // 消息接收服务器

// 查找Python可执行文件
const findPython = () => {
  const { execSync } = require('child_process')
  const possiblePaths = []
  
  // Windows系统
  if (process.platform === 'win32') {
    // 1. 尝试通过 where 命令查找
    try {
      const pythonPath = execSync('where python', { encoding: 'utf-8', timeout: 2000 }).trim().split('\n')[0]
      if (pythonPath && !pythonPath.includes('not found')) {
        possiblePaths.push(pythonPath)
      }
    } catch (e) {
      // 忽略错误
    }
    
    // 2. 尝试通过 where 命令查找 python3
    try {
      const python3Path = execSync('where python3', { encoding: 'utf-8', timeout: 2000 }).trim().split('\n')[0]
      if (python3Path && !python3Path.includes('not found')) {
        possiblePaths.push(python3Path)
      }
    } catch (e) {
      // 忽略错误
    }
    
    // 3. 尝试通过 py launcher
    try {
      const pyPath = execSync('where py', { encoding: 'utf-8', timeout: 2000 }).trim().split('\n')[0]
      if (pyPath && !pyPath.includes('not found')) {
        possiblePaths.push(pyPath)
      }
    } catch (e) {
      // 忽略错误
    }
    
    // 4. 常见安装路径
    const commonPaths = [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python39', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python310', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python311', 'python.exe'),
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python', 'Python312', 'python.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Python39', 'python.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Python310', 'python.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Python311', 'python.exe'),
      path.join(process.env.PROGRAMFILES || '', 'Python312', 'python.exe'),
      path.join(process.env.PROGRAMFILES || 'C:\\Program Files', 'Python', 'python.exe'),
    ]
    possiblePaths.push(...commonPaths)
    
    // 5. 打包后的路径
    if (process.resourcesPath) {
      possiblePaths.push(path.join(process.resourcesPath, 'python', 'python.exe'))
    }
  } else {
    // Linux/Mac系统
    possiblePaths.push('python3', 'python')
  }
  
  // 测试每个路径
  for (const pythonPath of possiblePaths) {
    try {
      const result = execSync(`"${pythonPath}" --version`, { 
        encoding: 'utf-8', 
        timeout: 2000,
        stdio: 'pipe'
      })
      if (result && result.trim()) {
        console.log(`找到Python: ${pythonPath}`)
        return pythonPath
      }
    } catch (e) {
      // 继续尝试下一个路径
      continue
    }
  }
  
  // 如果都找不到，返回默认值并输出警告
  console.error('警告: 未找到Python可执行文件，将使用默认值 "python"')
  console.error('请确保Python已安装并添加到PATH环境变量中')
  return 'python'
}

// 启动消息接收服务器（用于接收FastAPI推送的消息）
const startMessageServer = () => {
  const http = require('http')
  const messagePort = 9999 // 固定端口用于消息推送
  
  if (messageServer) {
    messageServer.close()
  }
  
  messageServer = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/message') {
      let body = ''
      req.on('data', chunk => {
        body += chunk.toString()
      })
      req.on('end', () => {
        try {
          const data = JSON.parse(body)
          // 发送消息到渲染进程
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.send('fastapi-message', data)
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true }))
        } catch (e) {
          console.error('解析消息失败:', e)
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: e.message }))
        }
      })
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  
  messageServer.listen(messagePort, '127.0.0.1', () => {
    console.log(`消息接收服务器启动在端口 ${messagePort}`)
  })
  
  messageServer.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.log(`端口 ${messagePort} 已被占用，尝试使用其他端口`)
    } else {
      console.error('消息服务器错误:', error)
    }
  })
}

// Express 服务器管理（Node.js版本，替代Python FastAPI）
let expressServer = null

const startExpressServer = (port) => {
  // 停止旧服务器
  if (expressServer) {
    try {
      expressServer.close(() => {
        console.log('Express服务器已关闭')
      })
      expressServer = null
    } catch (e) {
      console.error('停止旧服务器失败:', e)
    }
  }
  
  // 先杀死占用端口的进程
  killProcessByPort(port).then(() => {
    // 设置环境变量
    process.env.MESSAGE_SERVER_URL = 'http://127.0.0.1:9999/message'
    
    // 导入并启动Express服务器
    const { runServer } = require('./express_server')
    
    console.log(`启动Express服务器，端口: ${port}`)
    
    runServer(port).then((server) => {
      expressServer = server
      console.log(`Express服务器启动成功，监听端口 ${port}`)
    }).catch((error) => {
      console.error('启动Express服务器失败:', error.message)
      expressServer = null
    })
  })
}

// 根据端口查找PID
const findPidByPort = (port) => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const { exec } = require('child_process')
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve(-1)
          return
        }
        const lines = stdout.trim().split('\n')
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
            const pid = parseInt(parts[parts.length - 1])
            if (!isNaN(pid)) {
              resolve(pid)
              return
            }
          }
        }
        resolve(-1)
      })
    } else {
      // Linux/Mac
      const { exec } = require('child_process')
      exec(`lsof -ti:${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve(-1)
          return
        }
        const pid = parseInt(stdout.trim().split('\n')[0])
        resolve(isNaN(pid) ? -1 : pid)
      })
    }
  })
}

// 根据端口杀死进程
const killProcessByPort = (port) => {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      const { exec } = require('child_process')
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          resolve(false)
          return
        }
        const lines = stdout.trim().split('\n')
        const pids = new Set()
        for (const line of lines) {
          const parts = line.trim().split(/\s+/)
          if (parts.length >= 5 && parts[1].includes(`:${port}`)) {
            const pid = parseInt(parts[parts.length - 1])
            if (!isNaN(pid)) {
              pids.add(pid)
            }
          }
        }
        if (pids.size === 0) {
          resolve(false)
          return
        }
        // 杀死所有找到的进程
        let killed = 0
        pids.forEach(pid => {
          exec(`taskkill /F /PID ${pid}`, (err) => {
            if (!err) killed++
            if (killed === pids.size) {
              resolve(killed > 0)
            }
          })
        })
        if (pids.size === 0) {
          resolve(false)
        }
      })
    } else {
      // Linux/Mac
      const { exec } = require('child_process')
      exec(`lsof -ti:${port} | xargs kill -9`, (error) => {
        resolve(!error)
      })
    }
  })
}

// 读取配置文件
const readConfig = () => {
  const configPath = path.join(__dirname, '../conf/conf.ini')
  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    return ini.parse(content)
  } catch (error) {
    console.error('读取配置失败:', error)
    return {
      sys: {
        server_port: '8888',
        callback: '',
        open_log: 'true',
        save_log: 'true'
      },
      custom: {
        login_info: '[]'
      }
    }
  }
}

// 保存配置文件
const saveConfig = (config) => {
  const configPath = path.join(__dirname, '../conf/conf.ini')
  try {
    const content = ini.stringify(config)
    fs.writeFileSync(configPath, content, 'utf-8')
    return { success: true }
  } catch (error) {
    console.error('保存配置失败:', error)
    return { success: false, msg: error.message }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../src/assets/logo.jpg'),
    title: '北极熊企微框架Pro v1.1'
  })

  // 开发环境加载本地服务器，生产环境加载构建后的文件
  // 检查是否是开发模式（通过检查 dist 目录是否存在来判断）
  const distPath = path.join(__dirname, '../dist/index.html')
  const isDev = !fs.existsSync(distPath) || process.env.NODE_ENV === 'development'
  
  console.log('Environment:', process.env.NODE_ENV)
  console.log('isDev:', isDev)
  console.log('distPath exists:', fs.existsSync(distPath))
  
  if (isDev) {
    // 开发模式：等待 Vite 服务器启动
    let retryCount = 0
    const maxRetries = 30 // 最多等待30秒
    
    const checkServer = () => {
      const http = require('http')
      console.log(`Checking Vite server... (attempt ${retryCount + 1}/${maxRetries})`)
      
      const req = http.get('http://localhost:5173', (res) => {
        console.log('Vite server responded with status:', res.statusCode)
        if (res.statusCode === 200) {
          console.log('Loading http://localhost:5173')
          mainWindow.loadURL('http://localhost:5173')
          mainWindow.webContents.openDevTools()
        } else {
          retryCount++
          if (retryCount < maxRetries) {
            setTimeout(checkServer, 1000)
          } else {
            console.error('Vite server not available after 30 seconds')
            mainWindow.loadURL('http://localhost:5173') // 仍然尝试加载
          }
        }
      })
      
      req.on('error', (err) => {
        console.log('Vite server check error:', err.message)
        retryCount++
        if (retryCount < maxRetries) {
          setTimeout(checkServer, 1000)
        } else {
          console.error('Vite server not available after 30 seconds')
          mainWindow.loadURL('http://localhost:5173') // 仍然尝试加载
        }
      })
      
      req.setTimeout(5000, () => {
        req.destroy()
        retryCount++
        if (retryCount < maxRetries) {
          setTimeout(checkServer, 1000)
        } else {
          console.error('Vite server timeout after 30 seconds')
          mainWindow.loadURL('http://localhost:5173') // 仍然尝试加载
        }
      })
    }
    
    // 立即尝试一次，如果失败则开始重试
    checkServer()
  } else {
    console.log('Loading production build from:', distPath)
    mainWindow.loadFile(distPath)
  }
  
  // 监听页面加载错误
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, 'Error:', errorCode, errorDescription)
  })
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully')
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    if (expressServer) {
      expressServer.close(() => {
        console.log('Express服务器已关闭')
      })
    }
    if (messageServer) {
      messageServer.close()
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  
  // 启动消息接收服务器
  startMessageServer()
  
  // 启动Express服务器（Node.js版本）
  const config = readConfig()
  startExpressServer(parseInt(config.sys?.server_port || 8888))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 通信处理
ipcMain.handle('read-config', () => {
  return readConfig()
})

ipcMain.handle('save-config', (event, config) => {
  return saveConfig(config)
})

ipcMain.handle('call-api', async (event, { url, method = 'POST', data }) => {
  try {
    const response = await axios({
      method,
      url,
      data,
      timeout: 10000
    })
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, msg: error.message, data: null }
  }
})

// 检查端口是否在使用
ipcMain.handle('check-port', async (event, port) => {
  const net = require('net')
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(port, () => {
      server.once('close', () => resolve({ inUse: false }))
      server.close()
    })
    server.on('error', () => resolve({ inUse: true }))
  })
})

// 查找可用端口
ipcMain.handle('find-available-port', async (event, startPort = 1024) => {
  const net = require('net')
  for (let port = startPort; port < 10000; port++) {
    const result = await new Promise((resolve) => {
      const server = net.createServer()
      server.listen(port, () => {
        server.once('close', () => resolve(true))
        server.close()
      })
      server.on('error', () => resolve(false))
    })
    if (result) {
      return { port }
    }
  }
  return { port: null }
})

// 执行注入工具（需要根据实际情况调整）
ipcMain.handle('run-inject-tool', async (event, { port, serverPort, key }) => {
  const injectToolPath = path.join(__dirname, '../bin/it.exe')
  return new Promise((resolve) => {
    const child = spawn(injectToolPath, [
      'start',
      String(port),
      `--my_port=${serverPort}`,
      `--key=${key}`
    ])
    
    let output = ''
    child.stdout.on('data', (data) => {
      output += data.toString()
    })
    child.stderr.on('data', (data) => {
      output += data.toString()
    })
    
    child.on('close', (code) => {
      resolve({ success: code === 0, output })
    })
  })
})

// 获取授权信息
ipcMain.handle('get-auth-info', async (event, wxid) => {
  const backendIp = '8.137.76.99'
  const authUrl = `http://${backendIp}:5516/polarBear/getAuthInfo/${wxid}`
  try {
    const response = await axios.get(authUrl, { timeout: 10000 })
    return { success: true, data: response.data }
  } catch (error) {
    return { success: false, msg: '获取授权信息失败，请稍后重试', data: null }
  }
})

// 打开外部链接
ipcMain.handle('open-external', async (event, url) => {
  await shell.openExternal(url)
})

// 根据端口查找PID
ipcMain.handle('find-pid-by-port', async (event, port) => {
  return await findPidByPort(port)
})

// 根据端口杀死进程
ipcMain.handle('kill-process-by-port', async (event, port) => {
  return await killProcessByPort(port)
})

// 检查端口是否在使用
ipcMain.handle('is-port-in-use', async (event, port) => {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.listen(port, () => {
      server.once('close', () => resolve({ inUse: false }))
      server.close()
    })
    server.on('error', () => resolve({ inUse: true }))
  })
})

// 重启Express服务器
ipcMain.handle('restart-express-server', async (event, port) => {
  startExpressServer(port)
  return { success: true }
})

// 兼容旧名称
ipcMain.handle('restart-fastapi-server', async (event, port) => {
  startExpressServer(port)
  return { success: true }
})

// 发送消息到渲染进程（用于日志推送）
ipcMain.on('send-message-to-renderer', (event, data) => {
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('fastapi-message', data)
  }
})

