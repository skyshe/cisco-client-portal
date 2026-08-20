# Cisco Client Portal

支持 Docker、Windows、Linux 部署，并已适配腾讯云 EdgeOne Makers（原 EdgeOne Pages）一键部署。

## 部署方式

### 方式一：EdgeOne Makers 部署（推荐）

本项目已按 EdgeOne Makers 的 Cloud Functions 规范改造，仓库结构满足自动构建要求：

- `node-functions/[[default]].js`：Cloud Functions 入口，导出 Express 实例，承接除根路径外的全部路由（API、后台页面、SPA 兜底）。
- `public/`：静态资源目录，由 EdgeOne Pages 边缘网络自动托管（CSS / JS / 图片 / 字体 / index.html）。
- `edgeone.json`：构建参数配置（Node 版本、输出目录、安装命令）。
- `server.js`：业务主体，模块化导出 `app`，本地直接运行亦兼容。

部署步骤：

1. 进入 [EdgeOne Makers 控制台](https://console.cloud.tencent.com/edgeone/pages)，创建新项目。
2. 选择 GitHub 仓库作为源，连接本仓库。
3. 构建命令、输出目录已由 `edgeone.json` 自动配置，无需手动填写。
4. 点击部署，等待构建完成即可获得 `*.edgeone.app` 默认域名。
5. 如需自定义域名，在控制台绑定域名并按提示完成 DNS 解析。

运行时说明：Cloud Functions 为 Serverless 架构，运行实例的可写目录为 `/tmp`，`data.json` 与上传图片会写入该目录。实例冷启动时会自动从仓库内置的 `data.json` 初始化。如需跨实例持久化，建议接入 KV 存储或腾讯云 COS。

### 方式二：Docker 部署

```bash
docker build -t cisco-client-portal .
docker run -d -p 9907:9907 cisco-client-portal
```

### 方式三：源码运行

```bash
npm install
npm start
```

## 访问与默认账号

- 首页：`http://<host>:9907/`
- 管理后台：`http://<host>:9907/login`
- 默认账号密码：`admin` / `admin`（首次登录后请尽快修改）

## 项目说明

- 初始化数据：`data.json`
- 演示站：https://cisco.yydy.link
- 详细使用教程请阅读：搭建 [Cisco Secure Client 下载导航页](https://blog.yydy.link/archives/2018.html)

![yydy_2025-12-28_21-20-53](https://github.com/user-attachments/assets/6132f79c-4fec-420f-8fb1-acfb0185ecb8)
