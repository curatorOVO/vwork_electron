/**
 * 用户相关路由
 * 
 * 授权说明：
 * - 所有接口都需要授权验证
 */
const express = require('express')
const router = express.Router()
const { createAPIHandler } = require('../middleware/apiHandler')

/**
 * 获取个人信息
 * POST /api/user/info
 * 请求体: { "port": 8080 }
 */
router.post('/info', createAPIHandler(1002, '获取个人信息'))

module.exports = router

