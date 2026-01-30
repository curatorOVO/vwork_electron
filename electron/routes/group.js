/**
 * 群组相关路由
 * 
 * 授权说明：
 * - 所有接口都需要授权验证
 */
const express = require('express')
const router = express.Router()
const { createAPIHandler } = require('../middleware/apiHandler')

/**
 * 获取群成员列表
 * POST /api/group/members
 * 请求体: { "port": 8080, "chat_room_id": "群ID" }
 */
router.post('/members', createAPIHandler(2003, '获取群成员列表', (params) => {
  if (!params.chat_room_id) {
    return { valid: false, message: '缺少参数: chat_room_id (群ID)' }
  }
  return { valid: true, params: { chat_room_id: params.chat_room_id } }
}))

/**
 * 获取群信息
 * POST /api/group/info
 * 请求体: { "port": 8080, "chat_room_id": "群ID" }
 */
router.post('/info', createAPIHandler(5008, '获取群信息', (params) => {
  if (!params.chat_room_id) {
    return { valid: false, message: '缺少参数: chat_room_id (群ID)' }
  }
  return { valid: true, params: { chat_room_id: params.chat_room_id } }
}))

module.exports = router

