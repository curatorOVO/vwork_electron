/**
 * CDN下载相关路由
 * 
 * 授权说明：
 * - 所有接口都需要授权验证
 */
const express = require('express')
const router = express.Router()
const { createAPIHandler } = require('../middleware/apiHandler')

/**
 * CDN下载企微图片
 * POST /api/cdn/vwork-image
 * 请求体: { 
 *   "port": 8080, 
 *   "cdn_key": "CDN密钥",
 *   "aes_key": "AES密钥",
 *   "size": "尺寸",
 *   "img_type": "图片类型",
 *   "save_path": "保存路径"
 * }
 */
router.post('/vwork-image', createAPIHandler(9001, 'CDN下载企微图片', (params) => {
  if (!params.cdn_key) {
    return { valid: false, message: '缺少参数: cdn_key (CDN密钥)' }
  }
  if (!params.aes_key) {
    return { valid: false, message: '缺少参数: aes_key (AES密钥)' }
  }
  if (!params.size) {
    return { valid: false, message: '缺少参数: size (尺寸)' }
  }
  if (!params.img_type) {
    return { valid: false, message: '缺少参数: img_type (图片类型)' }
  }
  if (!params.save_path) {
    return { valid: false, message: '缺少参数: save_path (保存路径)' }
  }
  return {
    valid: true,
    params: {
      cdn_key: params.cdn_key,
      aes_key: params.aes_key,
      size: params.size,
      img_type: params.img_type,
      save_path: params.save_path
    }
  }
}))

/**
 * CDN下载个微图片/视频/文件
 * POST /api/cdn/vperson-file
 * 请求体: { 
 *   "port": 8080, 
 *   "url": "URL",
 *   "auth_key": "认证密钥",
 *   "aes_key": "AES密钥",
 *   "size": "尺寸",
 *   "save_path": "保存路径"
 * }
 */
router.post('/vperson-file', createAPIHandler(9004, 'CDN下载个微文件', (params) => {
  if (!params.url) {
    return { valid: false, message: '缺少参数: url (URL)' }
  }
  if (!params.auth_key) {
    return { valid: false, message: '缺少参数: auth_key (认证密钥)' }
  }
  if (!params.aes_key) {
    return { valid: false, message: '缺少参数: aes_key (AES密钥)' }
  }
  if (!params.size) {
    return { valid: false, message: '缺少参数: size (尺寸)' }
  }
  if (!params.save_path) {
    return { valid: false, message: '缺少参数: save_path (保存路径)' }
  }
  return {
    valid: true,
    params: {
      url: params.url,
      auth_key: params.auth_key,
      aes_key: params.aes_key,
      size: params.size,
      save_path: params.save_path
    }
  }
}))

module.exports = router

