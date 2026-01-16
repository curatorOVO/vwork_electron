/**
 * API 接口封装
 * 保留原项目的接口定义，为后续修改做预留
 */

/**
 * 基础URL生成
 */
export const baseUrl = (port) => `http://127.0.0.1:${port}/api`

/**
 * 调用API
 * port: 企微的HTTP端口（不是FastAPI服务器端口）
 */
export const callAPI = async (port, jsonData) => {
  if (!window.electronAPI) {
    throw new Error('Electron API不可用')
  }
  
  // 直接调用企微的HTTP端口
  const url = baseUrl(port)
  const result = await window.electronAPI.callAPI({
    url,
    method: 'POST',
    data: jsonData
  })
  
  if (!result.success) {
    throw new Error(result.msg || 'API调用失败')
  }
  
  return result.data
}

/**
 * VWork API 类 - 保留原项目接口定义
 */
export class VWorkApi {
  // 1000: 获取登录状态
  static async getLoginStatus(port, type = 1000) {
    return await callAPI(port, { type })
  }

  // 1001: 刷新并获取登录二维码
  static async refreshAndGetLoginQrCode(port, robotId, type = 1001, path = '') {
    return await callAPI(port, { type, path })
  }

  // 1002: 获取个人信息
  static async getPersonalInfo(port, type = 1002) {
    return await callAPI(port, { type })
  }

  // 1003: 退出登录
  static async logout(port, robotId, type = 1003) {
    return await callAPI(port, { type })
  }

  // 1005: 输入登录验证码
  static async inputLoginCaptcha(port, robotId, captcha, type = 1005) {
    return await callAPI(port, { type, code: captcha })
  }

  // 2003: 获取群成员列表
  static async getGroupMemberList(port, robotId, groupId, type = 2003) {
    return await callAPI(port, { type, chat_room_id: groupId })
  }

  // 3000: 发送文本消息
  static async sendTextMessage(port, robotId, userId, msg, type = 3000) {
    return await callAPI(port, { type, user_id: userId, msg })
  }

  // 3001: 发送图片消息
  static async sendImageMessage(port, robotId, userId, path, type = 3001) {
    return await callAPI(port, { type, user_id: userId, path })
  }

  // 3006: 发送小程序
  static async sendApplet(port, userId, title, desc, coverPath, wechatId, pagePath, type = 3006, avatarUrl = '', appId = '') {
    return await callAPI(port, {
      type,
      user_id: userId,
      title,
      desc,
      avatar_url: avatarUrl,
      cover_path: coverPath,
      app_id: appId,
      wechat_id: wechatId,
      page_path: pagePath
    })
  }

  // 3009: 发送群@消息
  static async sendAtMessage(port, robotId, chatRoomId, atList, msg, type = 3009) {
    const atArray = Array.isArray(atList) ? atList : [atList]
    return await callAPI(port, {
      type,
      chat_room_id: chatRoomId,
      at_list: atArray,
      msg
    })
  }

  // 5008: 获取群信息
  static async getGroupInfo(port, robotId, groupId, type = 5008) {
    return await callAPI(port, { type, chat_room_id: groupId })
  }

  // 9001: CDN下载企微图片
  static async cdnDownloadVWorkImage(port, robotId, cdnKey, aesKey, size, imgType, savePath, type = 9001) {
    return await callAPI(port, {
      type,
      cdn_key: cdnKey,
      aes_key: aesKey,
      size,
      img_type: imgType,
      save_path: savePath
    })
  }

  // 9004: CDN下载个微图片/视频/文件
  static async cdnDownloadVPersonImage(port, robotId, url, authKey, aesKey, size, savePath, type = 9004) {
    return await callAPI(port, {
      type,
      url,
      auth_key: authKey,
      aes_key: aesKey,
      size,
      save_path: savePath
    })
  }
}

export default VWorkApi

