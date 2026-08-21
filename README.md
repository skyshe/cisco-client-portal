# Cisco Client Portal

支持 Docker、Windows、Linux 部署，并已适配腾讯云 EdgeOne Makers（原 EdgeOne Pages）一键部署。

---

## 部署方式

### 方式一：EdgeOne Makers 部署（推荐）

本项目已按 EdgeOne Makers（Cloud Functions + 静态托管）规范改造，以下是完整的部署流程与控制台参数填写指南。

#### 1. 仓库结构说明（按平台约定组织）

| 路径 | 作用 |
|---|---|
| `node-functions/[[default]].js` | Cloud Functions 入口，按官方文件路由约定承载除根路径外的全部请求（API、后台页面、兜底路由）。代码本身只是 `import app from '../server.js'` 并 `export default app`，业务逻辑仍集中在 [server.js](server.js)。 |
| `public/` | 静态资源目录（`index.html`、`admin.html`、`css/`、`js/`、`img/`、`fonts/`），由 EdgeOne Pages 全球边缘网络自动托管与加速。根路径 `/` 直接命中此目录下的 `index.html`。 |
| `server.js` | 业务主体：Express 实例模块化导出；`require.main === module` 时才启动 HTTP Server（本地/Docker）；Cloud Functions 模式下使用 `/tmp` 作为可写目录，并从仓库 `data.json` 做冷启动初始化。 |
| `edgeone.json` | 项目级构建参数文件（Node 版本、输出目录、编译命令、安装命令）。**项目接入仓库后默认生效，控制台再次填写会覆盖此文件。** |
| `data.json` | 首次部署/函数冷启动时的默认数据快照（站点文案、下载链接、账号哈希等），在 Cloud Functions 实例中会被复制到 `/tmp/cisco-portal/data.json` 作为运行时可写副本。 |

---

#### 2. 部署前准备（一次性）

1. 登录 [腾讯云 EdgeOne Makers 控制台](https://console.cloud.tencent.com/edgeone/pages)。
2. 首次使用按提示完成 EdgeOne 服务开通（免费版即可）与 GitHub 授权（需授权访问 `skyshe/cisco-client-portal` 仓库）。
3. 确保远程 `main` 分支已包含上述文件（当前最新 commit `9ae8578` 已完成适配，直接使用即可）。

---

#### 3. 控制台创建项目（Step-by-Step）

##### 步骤 1：创建项目 → 选择代码源

- 进入 **EdgeOne Makers → 项目列表 → 新建项目**。
- **代码来源** 选择 **GitHub**，在仓库列表中选中 `skyshe/cisco-client-portal`。
- **生产分支** 选择 `main`（推荐）。
- 勾选 **"推送代码时自动触发部署"**（可选但推荐），后续提交会自动构建发布。

> ⚠️ 部署会立即生效。生产环境建议先用预览分支验证，再合并到 `main`。

##### 步骤 2：构建部署配置

在 **项目设置 → 构建与部署 → 构建部署配置** 中，按以下表格逐一填写。
优先级：**控制台手动填写 > `edgeone.json` > 框架预设默认值**。

| 控制台字段 | 含义说明 | 必填？ | 可接受取值范围 | 本项目推荐值 | 填写示例 | 为什么这么填 |
|---|---|---|---|---|---|---|
| **框架预设**（Framework Preset） | 平台据此推断默认 `buildCommand`、`outputDirectory`、依赖安装命令等 | 可选 | `Next.js` / `Nuxt` / `Vue` / `React` / `Astro` / `Angular` / `SvelteKit` / `Remix` / `Hugo` / `Hexo` / `Jekyll` / `Docusaurus` / `Gatsby` / `Other` | **`Other`** | `Other` | 本项目既非前端框架（无构建），也非官方预设的全栈 SSR 框架；选 `Other` 可完全自定义后续四项，避免被预设值错误覆盖。 |
| **根目录**（Project Root / Monorepo Root） | 构建工作目录。对 Monorepo 才需要填写子包路径；单仓库直接使用仓库根 | 可选（默认 `/`） | 相对路径，`/` 代表仓库根目录；若填写子目录需以 `/` 结尾 | **`/`**（留空或显式写 `/`） | `/` | 本项目是单仓库结构，`package.json` / `server.js` / `public/` / `node-functions/` 均位于仓库根，不需偏移。 |
| **输出目录**（Output Directory） | 静态资源构建产物目录，Pages 会把此目录下的文件作为边缘节点托管的静态资源分发 | 可选 | 相对仓库根（或相对根目录）的路径字符串，必须存在于构建后文件系统 | **`./public`** | `./public` | 项目无需前端构建，静态文件在仓库中直接存在于 `public/`。如果不填且框架预设为 Other，平台可能找不到静态资源导致首页 404。 |
| **编译命令**（Build Command） | 在 Bash Shell 中执行的构建脚本；本项目因为静态资源已直接存在于仓库、无前端编译/打包步骤，实际不需要 | 可选 | 任何 Bash 可执行命令（可包含 `&&` 串接）。可使用 `$VARIABLE` 引用平台预置环境变量 | **`echo "No build step required"`**（或留空） | `echo "No build step required"` | 显式写成空操作让构建阶段有日志可查。若写成 `npm run build` 会触发 `pkg` 打包生成可执行文件（项目原有脚本），这在 EdgeOne Makers 构建容器内毫无意义，徒增耗时与失败概率。 |
| **安装命令**（Install Command） | 安装依赖的命令。Cloud Functions 运行时需要 `express`、`bcryptjs`、`body-parser`、`multer`、`cors` 等生产依赖才能够初始化函数实例 | 可选 | 包管理器相关 Bash 命令：`npm install` / `npm ci` / `pnpm i` / `yarn` 等。可附加参数 | **`npm install --omit=dev`** | `npm install --omit=dev` | 只安装 `dependencies`，跳过 `devDependencies`（`pkg`），缩短构建时间、减小函数代码包体积（Cloud Functions 代码包上限 128MB）。若使用锁文件安装更可重现，可改用 `npm ci --omit=dev`。 |

> **控制台 → edgeone.json 的对应关系（优先级）**：如果 `edgeone.json` 已配置，且控制台留空，平台会读取 `edgeone.json` 中对应字段；若控制台显式填写了任何字段，**以控制台为准**。建议本项目将控制台五项**显式按推荐值填写**（而不仅仅依赖 `edgeone.json`），以便后续维护者直接在 UI 看到真实配置。

###### 构建部署配置填写示例（对应截图 1）

```
框架预设      →  Other
根目录        →  /                         （可留空）
输出目录      →  ./public
编译命令      →  echo "No build step required"      （或留空）
安装命令      →  npm install --omit=dev
```

点击 **保存**。保存后控制台会提示"配置变更将在下一次部署生效"，需手动触发一次新的部署或后续推送代码才会应用。

##### 步骤 3：Node.js 版本选择

在 **项目设置 → 构建与部署 → Node.js 版本** 下拉框中选择构建与运行时使用的 Node.js 版本。

| 字段 | 含义说明 | 必填？ | 可接受取值 | 本项目推荐值 | 为什么这么选 |
|---|---|---|---|---|---|
| **Node.js 版本** | 构建容器与 Cloud Functions Runtime 共同使用的版本 | 可选（控制台有默认） | `14.21.3` / `16.20.2` / `18.20.4` / `20.18.0` / `22.11.0`（均为官方推荐预装版本） | **`20.18.0`**（与 `edgeone.json` 一致） | 1）20.x 是当前 LTS，生态兼容最好，`bcryptjs` 等原生模块预构建 ABI 对齐最全；2）22.x 虽新但个别 npm 模块偶有预编译失败，生产环境建议 LTS。 |

> 如果控制台下拉的版本号比文档多（例如 22.11.x 的小版本不同），选最接近的即可，Node 次版本对本项目无行为差异。

###### Node.js 版本填写示例（对应截图 2 下半部）

```
Node.js 版本 →  20.18.0（下拉选择）
```

点击 **保存**。

##### 步骤 4：环境变量（可选）

在 **项目设置 → 环境变量** 中，可添加 KV 形式的环境变量。
环境变量在 Cloud Functions 中通过 `context.env` 或 Node 常规 `process.env` 读取；在构建阶段同样可在编译/安装命令里引用。

| 控制台列 | 含义说明 | 必填？ | 可接受取值/约束 | 本项目是否需要 | 示例 |
|---|---|---|---|---|---|
| **变量名** | 环境变量名，大小写敏感，仅支持 ASCII 字母数字下划线 | 必填（添加时） | `[A-Za-z_][A-Za-z0-9_]*`，长度通常 ≤ 128 | 无强制变量 | `PORT` / `ADMIN_PASSWORD_HASH` / `CORS_ORIGIN` |
| **变量值** | 环境变量值，明文存储；若含密钥建议使用带加密能力的"密钥变量"入口（若控制台提供） | 必填（添加时） | 任意字符串，敏感变量长度注意不超过平台上限 | 无强制变量 | `9907` / `$2a$10$...` |
| **备注** | 给团队的说明文字，不影响运行 | 可选 | ≤ 255 字符 | 可选 | `仅用于本地开发时的端口号（Cloud Functions 不生效）` |
| **生效范围** | 变量作用域：`构建时` / `运行时` / `全部` | 必填（添加时） | `构建时`（Build）/ `运行时`（Runtime）/ `全部`（All） | 按用途选择 | `全部` |
| **操作** | 编辑/删除行 | - | - | - | - |

###### 本项目可用的可选环境变量（按需添加）

| 变量名 | 建议生效范围 | 推荐值 | 说明 |
|---|---|---|---|
| `PORT` | 构建时 | `9907` | 仅在本地/Docker 模式使用；Cloud Functions 运行时平台会自动接管端口，此变量不影响部署。 |
| `NODE_ENV` | 全部 | `production` | 对 Express 中间件、依赖行为（如 JSON 压缩、错误栈屏蔽）有标准影响，建议显式设置。 |
| `CORS_ORIGIN` | 运行时 | `*` 或指定域名 | 当前 `server.js` 虽未显式使用 `cors`，但作为生产级项目可保留预留。 |
| `ADMIN_PASSWORD_HASH` | 运行时 | bcrypt 哈希字符串 | 如希望与 `data.json` 分离管理管理员密码，可在此变量配置并在 `server.js` 读取覆盖。 |

> 当前 `server.js` 未读取上述可选变量；如要使用需自行在 `server.js` 中增加 `process.env.XXX` 读取逻辑。默认留空环境变量表也可正常部署。

##### 步骤 5：开始部署 / 触发重新部署

- 首次创建项目会自动触发一次构建部署。
- 若只修改了设置项而未提交代码，可在 **部署记录 → 重新部署** 触发。
- 构建过程约 1~3 分钟，可在 **部署日志** 看到：
  1. `Installing dependencies...`（执行 `npm install --omit=dev`）
  2. `Running build command...`（执行 `echo "No build step required"`，瞬间完成）
  3. `Publishing assets...`（上传 `./public` 作为边缘静态资源）
  4. `Packaging functions...`（打包 `node_modules` + `node-functions/[[default]].js` → Cloud Functions）
  5. `Deploying to EdgeOne Global Network...`（生效阶段，约 1 分钟）
- 成功后会给出默认域名，形如 `https://<随机标识>.edgeone.app`。

---

#### 4. 部署后访问方式

| 入口 | EdgeOne Makers 默认域名访问 | 绑定自定义域名后访问 |
|---|---|---|
| **首页（用户下载/文档导航页）** | `https://<随机标识>.edgeone.app/` | `https://<你的自定义域名>/` |
| **管理后台登录页** | `https://<随机标识>.edgeone.app/login` | `https://<你的自定义域名>/login` |
| **公开数据接口**（供前端 XHR 调用） | `https://<随机标识>.edgeone.app/api/data` | 同上，改域名即可 |
| **登录校验接口**（`POST`） | `https://<随机标识>.edgeone.app/api/login` | 同上，改域名即可 |
| **其他管理接口**（`/api/update-*`、`/api/*client*` 等） | 仅登录后由 `admin.html` 页面发起请求使用 | 同上 |

> 管理后台路径是 `/login`（不是 `/admin`）。这个路径在 `server.js` 中注册为 `app.get('/login', ...)`，它返回 `public/admin.html`。

##### 默认管理员账号

- **用户名**：`admin`
- **初始密码**：`admin`
- **修改方式**：登录后点击「管理员设置」，输入原密码、填写新密码后提交。密码会以 bcrypt 哈希形式写回运行时 `data.json`。

> ⚠️ EdgeOne Makers 的 Cloud Functions 实例是按请求冷/热启动的，且**本地磁盘 `/tmp` 不可跨实例持久化**。以下行为在生产中需知晓：
> - 修改管理员密码、修改文案、上传图片等写入操作，**在同一实例存活期间有效**；实例回收或新建实例后会重置为仓库 `data.json`。
> - 若需要密码/数据跨实例持久化，建议迁移到：
>   - EdgeOne KV 存储（key-value，边缘低延迟读写），或
>   - 腾讯云 COS（保存上传图片，data.json 存 URL），或
>   - 外部数据库（MySQL/PostgreSQL/Supabase 等）。

---

#### 5. 绑定自定义域名（可选）

1. 控制台 → 项目 → **域名 → 添加自定义域名**，输入例如 `cisco.example.com`。
2. 控制台给出 CNAME 目标值（形如 `xxxx.edgeone.app`）。
3. 到你的 DNS 服务商（DNSPod / Cloudflare / 阿里云 DNS 等）添加：
   - 记录类型：`CNAME`
   - 主机记录：`cisco`（或 `@` 裸域，看你的目标）
   - 记录值：控制台给出的 CNAME 目标
4. 等待 DNS 生效，EdgeOne Makers 会自动颁发免费 SSL 证书并启用 HTTPS。
5. 生效后访问 `https://cisco.example.com/` 与 `https://cisco.example.com/login`。

---

#### 6. 常见问题定位

| 现象 | 排查路径 |
|---|---|
| 首页 404 / 静态资源 404 | 1）确认输出目录填 `./public`；2）检查仓库根是否存在 `public/index.html` 与 `public/css`/`js`；3）重新部署。 |
| 管理后台 `/login` 404 | 1）确认仓库存在 `node-functions/[[default]].js` 与 `public/admin.html`；2）查看部署日志是否有 `Packaging functions...` 成功阶段；3）Cloud Functions 路由应被平台识别到。 |
| `/api/login` 返回 500 | 1）查看 **函数日志**（Pages 控制台提供）；2）常见原因是 `bcryptjs` 未被正确安装（构建阶段未执行安装命令），把安装命令显式写成 `npm install --omit=dev` 后重部署。 |
| 上传图片失败 | 1）函数代码包中 `multer` 是否被安装；2）本项目上传路径为实例 `/tmp/cisco-portal/public/img`，文件**只在同一实例有效期内可访问**，跨实例会丢失；生产环境请将上传转存到 COS 再返回 URL。 |
| 修改的数据刷新后丢失 | 符合预期：Cloud Functions Serverless 的 `/tmp` 非持久化。按运行时说明迁移到 KV/COS/外部数据库即可解决。 |
| 构建日志报 `npm command not found` | 控制台 Node.js 版本一定要选 `20.18.0`（或 18/22），使用自带 npm；不要选非 Node 平台。 |

---

### 方式二：Docker 部署

```bash
docker build -t cisco-client-portal .
docker run -d -p 9907:9907 cisco-client-portal
```

- 首页：`http://<host>:9907/`
- 管理后台：`http://<host>:9907/login`

### 方式三：源码运行

```bash
npm install
npm start
```

- 首页：`http://<host>:9907/`
- 管理后台：`http://<host>:9907/login`

---

## 访问与默认账号汇总

| 部署方式 | 首页地址 | 管理后台地址 | 默认账号/密码 |
|---|---|---|---|
| EdgeOne Makers 默认域名 | `https://<随机标识>.edgeone.app/` | `https://<随机标识>.edgeone.app/login` | `admin` / `admin` |
| EdgeOne Makers 自定义域名 | `https://<你的域名>/` | `https://<你的域名>/login` | `admin` / `admin` |
| Docker / 源码本地 | `http://<host>:9907/` | `http://<host>:9907/login` | `admin` / `admin` |

> 首次登录后台后，请立即点击右上角头像或"管理员设置"修改默认密码。

---

## 项目说明

- 初始化数据：`data.json`（Cloud Functions 冷启动 / Docker 容器首次启动 / 本地首次运行的默认数据）
- 演示站：https://cisco.yydy.link
- 详细使用教程请阅读：搭建 [Cisco Secure Client 下载导航页](https://blog.yydy.link/archives/2018.html)

![yydy_2025-12-28_21-20-53](https://github.com/user-attachments/assets/6132f79c-4fec-420f-8fb1-acfb0185ecb8)
