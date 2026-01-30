/**
 * 消息发送相关路由
 * 
 * 授权说明：
 * - 所有接口都需要授权验证
 */
const express = require('express')
const router = express.Router()
const { createAPIHandler } = require('../middleware/apiHandler')

/**
 * 发送文本消息
 * POST /api/message/text
 * 请求体: { "port": 8080, "user_id": "用户ID", "msg": "消息内容" }
 */
router.post('/text', createAPIHandler(3000, '发送文本消息', (params) => {
  if (!params.user_id) {
    return { valid: false, message: '缺少参数: user_id (用户ID)' }
  }
  if (!params.msg) {
    return { valid: false, message: '缺少参数: msg (消息内容)' }
  }
  return { valid: true, params: { user_id: params.user_id, msg: params.msg } }
}))

/**
 * 发送图片消息
 * POST /api/message/image
 * 请求体: { "port": 8080, "user_id": "用户ID", "path": "图片路径" }
 */
router.post('/image', createAPIHandler(3001, '发送图片消息', (params) => {
  if (!params.user_id) {
    return { valid: false, message: '缺少参数: user_id (用户ID)' }
  }
  if (!params.path) {
    return { valid: false, message: '缺少参数: path (图片路径)' }
  }
  return { valid: true, params: { user_id: params.user_id, path: params.path } }
}))

/**
 * 发送小程序
 * POST /api/message/applet
 * 请求体: { 
 *   "port": 8080, 
 *   "user_id": "用户ID", 
 *   "title": "标题",
 *   "desc": "描述",
 *   "cover_path": "封面路径",
 *   "wechat_id": "微信ID",
 *   "page_path": "页面路径",
 *   "avatar_url": "头像URL",
 *   "app_id": "小程序ID"
 * }
 */
router.post('/applet', createAPIHandler(3006, '发送小程序', (params) => {
  if (!params.user_id) {
    return { valid: false, message: '缺少参数: user_id (用户ID)' }
  }
  if (!params.title) {
    return { valid: false, message: '缺少参数: title (标题)' }
  }
  if (!params.desc) {
    return { valid: false, message: '缺少参数: desc (描述)' }
  }
  if (!params.cover_path) {
    return { valid: false, message: '缺少参数: cover_path (封面路径)' }
  }
  if (!params.wechat_id) {
    return { valid: false, message: '缺少参数: wechat_id (微信ID)' }
  }
  if (!params.page_path) {
    return { valid: false, message: '缺少参数: page_path (页面路径)' }
  }
  return {
    valid: true,
    params: {
      user_id: params.user_id,
      title: params.title,
      desc: params.desc,
      avatar_url: params.avatar_url || '',
      cover_path: params.cover_path,
      app_id: params.app_id || '',
      wechat_id: params.wechat_id,
      page_path: params.page_path
    }
  }
}))

/**
 * 发送群@消息
 * POST /api/message/at
 * 请求体: { 
 *   "port": 8080, 
 *   "chat_room_id": "群ID", 
 *   "at_list": ["用户ID1", "用户ID2"] 或 "用户ID",
 *   "msg": "消息内容" 
 * }
 */
router.post('/at', createAPIHandler(3009, '发送群@消息', (params) => {
  if (!params.chat_room_id) {
    return { valid: false, message: '缺少参数: chat_room_id (群ID)' }
  }
  if (!params.at_list) {
    return { valid: false, message: '缺少参数: at_list (@的用户列表)' }
  }
  if (!params.msg) {
    return { valid: false, message: '缺少参数: msg (消息内容)' }
  }
  const atArray = Array.isArray(params.at_list) ? params.at_list : [params.at_list]
  return {
    valid: true,
    params: {
      chat_room_id: params.chat_room_id,
      at_list: atArray,
      msg: params.msg
    }
  }
}))

module.exports = router

