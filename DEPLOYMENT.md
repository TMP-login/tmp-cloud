# 临时网盘 (TMP Cloud)

无登录、无数据库、基于 Cloudflare 免费额度的临时文件传输网盘。

## 项目特性

✅ **无需登录** - 打开网页即用
✅ **完全免费** - 使用 Cloudflare 免费额度（R2 10GB）
✅ **国内可访问** - Pages Functions 同域，无需自定义域名
✅ **支持大文件** - 无需担心超时或崩溃
✅ **灵活权限** - 任何人都可以上传、下载、删除文件

## 技术架构

- **前端**: Vite + React
- **后端**: Cloudflare Pages Functions
- **存储**: Cloudflare R2 (10GB 免费额度)
- **密码**: Cloudflare Secrets (安全存储)
- **数据库**: 无 (使用文件名模拟目录树)

## 快速开始

### 前置要求

- Node.js 18+
- Cloudflare 账户 (已创建 R2 Bucket)
- Wrangler CLI (`npm install -g wrangler`)

### 1. 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

访问 `http://localhost:5173`

### 2. 部署到 Cloudflare Pages

#### 步骤 1: 创建 R2 Bucket

```bash

```

#### 步骤 2: 设置密码

在 Cloudflare 后台设置 Secret：

```bash
wrangler secret:bulk
```

输入:
```
UPLOAD_PASSWORD=your_password_here
```

#### 步骤 3: 更新 wrangler.toml

编辑 wrangler.toml，设置你的 Account ID:

```toml
name = "tmp-cloud"
type = "javascript"
account_id = "your-account-id"

[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "tmp-cloud-r2"
```

#### 步骤 4: 部署

```bash
# 构建前端
npm run build

# 部署到 Cloudflare Pages
wrangler pages deploy dist
```

## 功能说明

### 文件上传

- **点击选择文件**: 选择单个或多个文件
- **拖拽上传**: 拖拽文件到网页任意区域
- **选择文件夹**: 支持选择整个文件夹上传
- **保留路径**: 上传的文件会保留完整文件夹路径

### 空间管理

- 免费额度: 10GB
- 上传前自动检查空间
- **空间充足** (≤10GB): 直接上传
- **空间不足** (>10GB): 需输入密码才能上传

### 文件操作

- **下载**: 点击文件快速下载
- **文件夹打包下载**: 由后端打包为 ZIP Store 纯存储压缩包
- **新建文件夹**: 创建时会写入 R2 目录标记对象
- **删除**: 任何人都可以删除文件（无需密码）
- **删除文件夹**: 会递归清理目录内文件和子目录标记
- **浏览**: 支持点击文件夹进入、返回上级

## API 接口

### GET /api/list

获取文件列表

**参数:**
- `path`: 当前路径 (optional)

**返回:**
```json
{
  "files": [
    {
      "name": "file.txt",
      "size": 1024,
      "uploaded": "2024-01-01T00:00:00Z",
      "isDirectory": false
    }
  ],
  "totalUsed": 5000000
}
```

目录通过 R2 中的 `目录名/` 空标记对象识别，因此空目录会保留。

### POST /api/create-folder

创建文件夹并写入目录标记。

**参数:**
- `path`: 文件夹路径

**返回:**
```json
{
  "success": true
}
```

### POST /api/upload

上传文件

**参数:**
- `file`: 文件内容 (FormData)
- `path`: 文件路径
- `password`: 密码 (optional, 当空间不足时需要)

**返回:**
```json
{
  "success": true
}
```

### POST /api/delete

删除文件

**参数:**
- `path`: 文件路径
- `isDirectory`: 是否删除文件夹

删除文件夹时会递归清理该目录下的全部子文件、子文件夹标记对象，并删除当前文件夹标记。

**返回:**
```json
{
  "success": true
}
```

### GET /api/download

下载文件

**参数:**
- `path`: 文件路径
- `type`: 可选，`folder` 表示打包下载整个文件夹

**返回:** 文件内容；文件夹时返回 ZIP Store 纯存储压缩包

### POST /api/verify-password

验证密码

**参数:**
- `password`: 密码

**返回:**
```json
{
  "success": true
}
```

## 配置说明

### 修改密码

密码存储在 Cloudflare Secrets，无需修改代码：

```bash
wrangler secret:bulk
```

输入新密码即可，重新部署后生效。

### 修改存储桶

编辑 wrangler.toml:

```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-bucket-name"
```

### 修改免费额度限制

编辑 `src/App.jsx` 和 `functions/api/upload.js`，修改 LIMIT 常量：

```javascript
const LIMIT = 10 * 1024 * 1024 * 1024 // 改为其他值
```

## 注意事项

⚠️ **安全提示:**
- 密码存储在 Cloudflare Secrets，永远不会出现在代码中
- 所有安全检查都在后端执行，前端无法绕过
- 任何人都可以删除文件，请自行管理访问权限

⚠️ **费用提示:**
- 本项目设计永不超出 10GB 免费额度
- 删除文件后空间立即释放，可继续上传
- 建议定期清理旧文件

## 故障排除

### "存储未配置"

确保已创建 R2 Bucket 并在 wrangler.toml 中正确配置：

```bash
wrangler r2 bucket list
```

### "密码不存在"

确保已设置 UPLOAD_PASSWORD Secret:

```bash
wrangler secret:list
```

### 文件路径问题

自动处理非法字符，文件路径会被规范化处理。

## 项目结构

```
tmp-cloud/
├── src/
│   ├── main.jsx          # React 入口
│   ├── App.jsx           # 主应用组件
│   └── index.css         # 样式
├── functions/
│   └── api/
│       ├── list.js       # 获取文件列表
│       ├── upload.js     # 上传文件
│       ├── create-folder.js # 创建文件夹
│       ├── delete.js     # 删除文件
│       ├── download.js   # 下载文件
│       └── verify-password.js  # 验证密码
├── public/               # 静态资源
├── index.html            # HTML 入口
├── vite.config.js        # Vite 配置
├── wrangler.toml         # Cloudflare 配置
└── package.json          # 项目配置
```

## 许可证

MIT

## 支持

如有问题，请检查：
1. Cloudflare 账户是否正确配置
2. R2 Bucket 是否已创建
3. Secret 是否已设置
4. wrangler.toml 中的 Account ID 是否正确
