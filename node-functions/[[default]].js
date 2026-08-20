/**
 * EdgeOne Makers Cloud Functions 入口文件
 *
 * 路由约定：
 * - 文件路径 node-functions/[[default]].js 对应 catch-all 路由 example.com/*
 * - 除根路径（/）外的所有请求都会进入此函数
 * - 根路径 / 由 EdgeOne Pages 静态托管直接返回 public/index.html
 *
 * 部署约束（来自官方文档）：
 * - 框架路由必须集中在单个 [[default]].js 文件内
 * - 无需启动 HTTP Server 或监听端口
 * - 必须 export default 导出 Express 实例
 *
 * 此入口通过引入项目根的 server.js 复用所有业务路由：
 * - /api/* 接口
 * - /login 后台页面
 * - 其他路径的 index.html 兜底
 *
 * 静态资源（CSS/JS/img/fonts）由 EdgeOne Pages 自动托管，无需函数处理。
 */
import app from '../server.js';

// 导出 Express 应用实例供 EdgeOne Makers 平台接管
export default app;
