const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const multer = require('multer');

// 创建 Express 应用实例
const app = express();

// 服务监听端口（仅在本地开发时使用，EdgeOne Makers Cloud Functions 运行时会忽略此值）
const PORT = process.env.PORT || 9907;

// 判断当前是否运行在 EdgeOne Makers Cloud Functions 运行时
// 判断依据：server.js 不是直接 node 启动的入口（require.main !== module）
// 此场景下平台会通过 export default 接管路由，无需监听端口；文件系统除 /tmp 外只读
const IS_EDGEONE_CLOUD_FUNCTION = require.main !== module;

// 确定可写基础目录：
// - Cloud Functions 运行时：使用 /tmp 作为唯一可写的临时目录
// - 本地/Docker 运行时：使用项目根目录或 pkg 可执行文件所在目录
const externalBaseDir = IS_EDGEONE_CLOUD_FUNCTION
  ? '/tmp/cisco-portal'
  : (typeof process.pkg !== 'undefined' ? path.dirname(process.execPath) : __dirname);

// 内部资源目录（构建产物中的只读资源，用于初始化或回退）
const internalBaseDir = __dirname;

// 确保可写目录存在（用于运行时数据文件与上传文件存储）
const uploadDir = path.join(externalBaseDir, 'public', 'img');
const dataDir = path.join(externalBaseDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 静态文件服务配置
// 1. 优先从可写外部目录提供服务（允许用户上传覆盖与运行时新增资源）
app.use(express.static(path.join(externalBaseDir, 'public')));

// 2. 若为 pkg 打包的可执行文件，则从内部快照回退提供静态资源
if (typeof process.pkg !== 'undefined') {
  app.use(express.static(path.join(internalBaseDir, 'public')));
}

// 配置 body-parser 解析 JSON 请求体
app.use(bodyParser.json());

// 配置 multer 用于文件上传（运行时上传到可写目录）
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // 使用动态计算的上传目录
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // 保留原始文件名，不做重命名
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// 数据文件路径（运行时可写位置）
const dataPath = path.join(externalBaseDir, 'data.json');

// 初始默认数据（用于首次初始化或读取失败时回退）
const initialData = {
  admin: {
    username: 'admin',
    // 默认密码 'admin' 的 bcrypt 哈希
    password: '$2a$10$7zc2W6OBSAElWz7FljChBOBFDG3.nObfbzJSXn6/LBVlu6gzFJKwu'
  },
  texts: {},
  downloads: {},
  manuals: {},
  qrcodes: {},
  headerNav: {},
  banner: {}
};

// 确保数据文件存在：优先从内部构建产物复制，否则使用硬编码初始数据
if (!fs.existsSync(dataPath)) {
  const internalDataPath = path.join(internalBaseDir, 'data.json');
  let initialized = false;

  if (fs.existsSync(internalDataPath)) {
    try {
      console.log('Initializing data.json from packaged default...');
      const content = fs.readFileSync(internalDataPath, 'utf8');
      fs.writeFileSync(dataPath, content);
      initialized = true;
    } catch (e) {
      console.error('Failed to copy internal data.json', e);
    }
  }

  // 复制失败时使用硬编码的初始数据兜底
  if (!initialized) {
    console.log('Initializing data.json from hardcoded defaults...');
    fs.writeFileSync(dataPath, JSON.stringify(initialData, null, 2));
  }
}

/**
 * 读取并合并数据
 * @returns {Object} 合并后的完整数据对象
 */
function readData() {
  try {
    const data = fs.readFileSync(dataPath, 'utf8');
    const parsedData = JSON.parse(data);

    // 数据结构迁移：从 texts 迁移顶部导航数据到 headerNav
    if (!parsedData.headerNav && parsedData.texts) {
      parsedData.headerNav = {
        btn1: {
          text: parsedData.texts.headerBtn1Text || '飞将咨询',
          url: parsedData.texts.headerBtn1Url || '#',
          visible: parsedData.texts.headerBtn1Visible !== false
        },
        btn2: {
          text: parsedData.texts.headerBtn2Text || '飞将官网',
          url: parsedData.texts.headerBtn2Url || '#',
          visible: parsedData.texts.headerBtn2Visible !== false
        },
        btn3: {
          text: parsedData.texts.headerBtn3Text || '博客站',
          url: parsedData.texts.headerBtn3Url || '#',
          visible: parsedData.texts.headerBtn3Visible !== false
        }
      };
    }

    // 与 initialData 深度合并，确保新字段存在
    const mergedData = {
      ...initialData,
      ...parsedData,
      texts: { ...initialData.texts, ...(parsedData.texts || {}) },
      headerNav: parsedData.headerNav || initialData.headerNav,
      banner: { ...initialData.banner, ...(parsedData.banner || {}) },
      downloads: { ...initialData.downloads, ...(parsedData.downloads || {}) },
      manuals: { ...initialData.manuals, ...(parsedData.manuals || {}) },
      qrcodes: { ...initialData.qrcodes, ...(parsedData.qrcodes || {}) }
    };

    // 数据结构迁移/修复：确保 manuals 各平台字段类型一致
    if (typeof mergedData.manuals.windows === 'object' && mergedData.manuals.windows !== null) {
      // 旧对象结构提取 link1 作为新的字符串值
      mergedData.manuals.windows = mergedData.manuals.windows.link1 || '';
    }

    if (typeof mergedData.manuals.macos === 'string') {
      mergedData.manuals.macos = { appStore: '', dmg: mergedData.manuals.macos };
    }
    if (typeof mergedData.manuals.linux === 'string') {
      mergedData.manuals.linux = { server: mergedData.manuals.linux, desktop: '' };
    }
    if (typeof mergedData.manuals.android === 'string') {
      mergedData.manuals.android = { latest: mergedData.manuals.android, old: '' };
    }

    return mergedData;
  } catch (error) {
    console.error('读取数据失败:', error);
    return initialData;
  }
}

/**
 * 保存数据到磁盘
 * @param {Object} data 待保存的数据对象
 * @returns {boolean} 是否保存成功
 */
function saveData(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('保存数据失败:', error);
    return false;
  }
}

// ============== API 路由 ==============

// 获取所有公开数据（剔除管理员敏感信息）
app.get('/api/data', (req, res) => {
  const data = readData();
  const { admin, ...publicData } = data;
  res.json(publicData);
});

// 管理员登录校验
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const data = readData();

  if (username === data.admin.username && bcrypt.compareSync(password, data.admin.password)) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '用户名或密码错误' });
  }
});

// 更新管理员信息（用户名/密码）
app.post('/api/update-admin', (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  const data = readData();

  // 修改密码时需校验原密码
  if (newPassword && !bcrypt.compareSync(oldPassword, data.admin.password)) {
    return res.json({ success: false, message: '原密码不正确' });
  }

  data.admin.username = username;

  // 提供新密码时才更新密码哈希
  if (newPassword) {
    data.admin.password = bcrypt.hashSync(newPassword, 10);
  }

  if (saveData(data)) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// 更新文本内容
app.post('/api/update-texts', (req, res) => {
  const texts = req.body;
  const data = readData();

  data.texts = { ...data.texts, ...texts };

  if (saveData(data)) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// 更新下载链接
app.post('/api/update-downloads', (req, res) => {
  const downloads = req.body;
  const data = readData();

  data.downloads = { ...data.downloads, ...downloads };

  if (saveData(data)) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// 更新手册链接
app.post('/api/update-manuals', (req, res) => {
  const manuals = req.body;
  const data = readData();

  data.manuals = { ...data.manuals, ...manuals };

  if (saveData(data)) {
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// 更新顶部导航配置
app.post('/api/update-header-nav', (req, res) => {
  try {
    const navData = req.body;
    const data = readData();
    data.headerNav = { ...data.headerNav, ...navData };
    if (saveData(data)) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: '保存失败' });
    }
  } catch (error) {
    console.error('保存顶部导航失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 更新广告位配置
app.post('/api/update-banner', (req, res) => {
  try {
    const bannerData = req.body;
    const data = readData();
    data.banner = { ...data.banner, ...bannerData };
    if (saveData(data)) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: '保存失败' });
    }
  } catch (error) {
    console.error('保存广告位失败:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
});

// 上传二维码图片
app.post('/api/upload-qr', upload.single('qrImage'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: '未上传文件' });
  }

  const type = req.body.type;
  const data = readData();

  if (type === 'ios' || type === 'android' || type === 'harmony' || type === 'consulting') {
    // 二维码存储路径：img/原始文件名
    data.qrcodes[type] = `img/${req.file.originalname}`;

    if (saveData(data)) {
      return res.json({
        success: true,
        path: data.qrcodes[type]
      });
    }
  }

  res.json({ success: false, message: '上传失败' });
});

// 上传通用图片（自定义按钮等场景）
app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: '未上传文件' });
  }

  // 返回相对路径供前端使用
  res.json({
    success: true,
    path: `img/${req.file.originalname}`
  });
});

// 添加客户端（区分自定义与 OpenConnect 列表）
app.post('/api/add-client', (req, res) => {
  const { name, os, url, manual, icon, qrCode, type } = req.body;
  const data = readData();

  const targetList = type === 'custom' ? 'customClients' : 'openConnectClients';

  if (!data[targetList]) {
    data[targetList] = [];
  }

  data[targetList].push({ name, os, url, manual, icon, qrCode });

  if (saveData(data)) {
    res.json({ success: true, clients: data[targetList] });
  } else {
    res.json({ success: false });
  }
});

// 更新指定索引的客户端配置
app.post('/api/update-client', (req, res) => {
  const { index, name, os, url, manual, icon, qrCode, type } = req.body;
  const data = readData();

  const targetList = type === 'custom' ? 'customClients' : 'openConnectClients';

  if (!data[targetList] || index < 0 || index >= data[targetList].length) {
    return res.json({ success: false, message: '客户端不存在' });
  }

  data[targetList][index] = { name, os, url, manual, icon, qrCode };

  if (saveData(data)) {
    res.json({ success: true, clients: data[targetList] });
  } else {
    res.json({ success: false });
  }
});

// 保存客户端列表排序
app.post('/api/save-clients', (req, res) => {
  const { clients, type } = req.body;
  const data = readData();

  const targetList = type === 'custom' ? 'customClients' : 'openConnectClients';

  data[targetList] = clients;

  if (saveData(data)) {
    res.json({ success: true, clients: data[targetList] });
  } else {
    res.json({ success: false });
  }
});

// 删除指定索引的客户端
app.post('/api/remove-client', (req, res) => {
  const { index, type } = req.body;
  const data = readData();

  const targetList = type === 'custom' ? 'customClients' : 'openConnectClients';

  if (!data[targetList] || index < 0 || index >= data[targetList].length) {
    return res.json({ success: false, message: '客户端不存在' });
  }

  data[targetList].splice(index, 1);

  if (saveData(data)) {
    res.json({ success: true, clients: data[targetList] });
  } else {
    res.json({ success: false });
  }
});

// 管理后台页面路由
app.get('/login', (req, res) => {
  const externalPath = path.join(externalBaseDir, 'public', 'admin.html');
  const internalPath = path.join(internalBaseDir, 'public', 'admin.html');

  if (fs.existsSync(externalPath)) {
    res.sendFile(externalPath);
  } else {
    res.sendFile(internalPath);
  }
});

// 兜底路由：其他路径返回 index.html（用于 SPA / 后台访问首页）
app.get('*', (req, res) => {
  const externalPath = path.join(externalBaseDir, 'public', 'index.html');
  const internalPath = path.join(internalBaseDir, 'public', 'index.html');

  if (fs.existsSync(externalPath)) {
    res.sendFile(externalPath);
  } else {
    res.sendFile(internalPath);
  }
});

// 导出 Express 应用实例，供 EdgeOne Makers Cloud Functions 入口使用
module.exports = app;

// 仅在直接运行（本地开发或 Docker 部署）时启动 HTTP 服务
// EdgeOne Makers Cloud Functions 运行时会通过 export default app 接管路由，无需监听端口
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
}
