# 📁 临时网盘 (TMP Cloud)

> 无需登录、无数据库、完全免费的临时文件传输网盘

基于 Cloudflare Pages + Functions + R2 构建，支持国内直接访问，永不扣费。

## ✨ 核心特性

| 特性 | 说明 |
|-----|-----|
| 🔓 无需登录 | 打开即用，无账号限制 |
| 💰 完全免费 | 仅使用 Cloudflare 免费额度 |
| 🌍 国内可访问 | Pages Functions 同域部署 |
| 📦 大文件支持 | 支持任意大小文件上传 |
| 🛡️ 安全有保障 | 密码存储在 Secrets，无硬编码 |
| 📱 响应式设计 | 适配所有设备 |

## 🚀 快速开始

### 本地开发

```bash
npm install
npm run dev
```

访问 `http://localhost:5173`

### 部署到 Cloudflare

```bash
chmod +x deploy.sh
./deploy.sh
```

详见 [快速启动指南](./QUICKSTART.md)

---

## 📋 完整功能清单

### 上传功能
- [x] 点击选择单个或多个文件上传
- [x] 拖拽上传
- [x] 选择文件夹上传
- [x] 嵌套文件夹保留完整路径
- [x] 支持大文件无超时
- [x] 自动检查空间并提示

### 下载和删除
- [x] 点击文件直接下载
- [x] 删除文件无需密码
- [x] 删除即时生效，空间立即释放

### 文件浏览
- [x] 云盘风格界面
- [x] 显示当前路径
- [x] 点击进入文件夹
- [x] 返回上级/根目录
- [x] 文件夹优先显示
- [x] 显示文件大小和上传时间

### 权限和安全
- [x] 任何人可查看、下载、删除
- [x] 空间充足直接上传
- [x] 空间不足需输入密码
- [x] 密码仅存储在 Cloudflare Secrets
- [x] 所有验证在后端执行

### 空间管理
- [x] 10GB 免费额度
- [x] 上传前自动计算空间
- [x] 防止超额
- [x] 实时显示已用空间

---

## 📊 项目架构

```
┌─────────────────────────────────────────┐
│         Cloudflare Pages                │
│  ┌─────────────────────────────────┐   │
│  │  React + Vite (前端代码)        │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│     Cloudflare Pages Functions          │
│  • list.js       (获取文件列表)        │
│  • upload.js     (上传文件)            │
│  • download.js   (下载文件)            │
│  • delete.js     (删除文件)            │
│  • verify-password.js (验证密码)      │
└─────────────────────────────────────────┘
                     ↓
┌─────────────────────────────────────────┐
│     Cloudflare R2 (10GB 免费)          │
│     + Cloudflare Secrets (密码)        │
└─────────────────────────────────────────┘
```

---

## 🛠️ 技术栈

- **前端框架**: React 18 + Vite
- **后端服务**: Cloudflare Pages Functions
- **对象存储**: Cloudflare R2
- **密码存储**: Cloudflare Secrets
- **样式**: CSS3 (无框架)
- **构建工具**: Wrangler

---

## 📖 文档

- [快速启动指南](./QUICKSTART.md) - 5分钟快速部署
- [完整部署指南](./DEPLOYMENT.md) - 详细配置说明
- [API 文档](./DEPLOYMENT.md#api-接口) - 后端接口详情

---

## 🔐 安全考虑

✅ **密码安全**
- 密码存储在 Cloudflare Secrets，永不出现在代码中
- 前端无法获取密码，所有验证在后端进行
- 修改密码无需改代码，后台更新 Secret 即可

✅ **权限模型**
- 任何人都可以查看、下载、删除文件
- 此设计适合临时文件传输场景
- 生产环境可根据需求完善权限系统

✅ **数据安全**
- 文件直接存储在 Cloudflare R2，业界标准加密
- 无中间服务器，无额外日志记录
- 支持定期删除过期文件

---

## 📝 使用示例

### 场景 1: 快速分享大文件
```
1. 打开网页
2. 拖拽文件
3. 复制分享链接
4. 对方下载後自动删除 ✓
```

### 场景 2: 团队临时协作
```
1. 一人上传项目文件
2. 所有人可下载和查看
3. 用完后任何人可删除
4. 空间自动释放 ✓
```

### 场景 3: 跨设备文件同步
```
1. 手机上传文件
2. 电脑下载
3. 平板查看
4. 完成后删除 ✓
```

---

## 💡 成本分析

### Cloudflare 免费额度
| 服务 | 免费额度 | 此项目用量 |
|-----|--------|---------|
| Pages | 无限 | ✓ |
| Functions | 100,000 次/天 | ✓ |
| R2 | 10 GB | 10 GB |
| Secrets | 无限 | <1 KB |

**结论**: 完全免费，永不扣费 🎉

---

## 🔧 配置修改

### 更改密码
```bash
wrangler secret:bulk
# 修改 UPLOAD_PASSWORD
```

### 更改存储桶
编辑 `wrangler.toml`:
```toml
bucket_name = "your-bucket-name"
```

### 更改免费额度
编辑 `src/App.jsx` 和 `functions/api/upload.js`:
```javascript
const LIMIT = 50 * 1024 * 1024 * 1024 // 改为 50GB
```

---

## 📱 设备兼容性

| 设备 | 浏览器 | 支持 |
|-----|------|-----|
| 桌面 | Chrome, Firefox, Safari, Edge | ✅ |
| 平板 | Chrome, Safari | ✅ |
| 手机 | Chrome, Safari | ✅ |

---

## 🐛 故障排除

### 部署常见问题

| 问题 | 解决 |
|-----|-----|
| 存储未配置 | 运行 `wrangler r2 bucket list` 检查 |
| 密码错误 | 运行 `wrangler secret:list` 验证 |
| 文件上传失败 | 检查网络连接和浏览器控制台错误 |

详见 [DEPLOYMENT.md#故障排除](./DEPLOYMENT.md#故障排除)

---

## 📄 项目结构

```
tmp-cloud/
├── src/                    # 前端源代码
│   ├── App.jsx            # 主应用组件
│   ├── main.jsx           # React 入口
│   └── index.css          # 全局样式
├── functions/api/         # Cloudflare Functions
│   ├── list.js            # 获取文件列表
│   ├── upload.js          # 处理上传
│   ├── download.js        # 处理下载
│   ├── delete.js          # 处理删除
│   └── verify-password.js # 密码验证
├── public/                # 静态资源
├── index.html             # HTML 入口
├── vite.config.js         # Vite 配置
├── wrangler.toml          # Cloudflare 配置
├── package.json           # NPM 配置
├── QUICKSTART.md          # 快速开始
├── DEPLOYMENT.md          # 部署指南
└── README.md              # 本文件
```

---

## 📞 支持

遇到问题? 检查:
1. [快速启动指南](./QUICKSTART.md)
2. [完整部署指南](./DEPLOYMENT.md)
3. Cloudflare 控制面板的部署日志

---

## 📜 许可证

MIT License

---

## 🙏 贡献

欢迎贡献代码、报告 Bug 或建议新功能！

---

**💬 需要帮助?** 查看文档或在 GitHub Issue 中提问。