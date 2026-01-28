// 前端授权校验工具：根据端口在配置中查找授权到期时间
// 注意：这里不直接依赖 Electron 主进程或 Node 模块，方便在渲染进程里使用
import { useConfigStore } from '../stores/config'

/**
 * 根据端口获取对应账号的授权到期时间
 */
export const getExpireByPort = (port) => {
  if (!port) return '未授权'
  const configStore = useConfigStore()
  const loginInfoList = configStore.getLoginInfo()
  const numericPort = Number(port)
  const item = loginInfoList.find((it) => Number(it.port) === numericPort)
  return item?.expire || '未授权'
}

/**
 * 判断授权是否有效（与后端 validAuthDatetime 保持同样逻辑）
 * @param {string} dateStr - 'YYYY-MM-DD HH:mm:ss' 或 '未授权'
 */
export const isValidAuthDatetime = (dateStr) => {
  try {
    if (!dateStr || dateStr === '未授权') {
      return false
    }
    const dt = new Date(dateStr.replace(/-/g, '/'))
    const now = new Date()
    return now <= dt
  } catch (e) {
    return false
  }
}

/**
 * 通用授权校验：根据端口检查是否已授权
 * 未授权时抛出错误，由上层捕获并提示
 */
export const ensureAuthorizedByPort = (port) => {
  const expire = getExpireByPort(port)
  if (!isValidAuthDatetime(expire)) {
    const error = new Error('当前账号未授权或授权已到期，禁止调用该接口')
    error.code = 'NO_AUTH'
    throw error
  }
}



