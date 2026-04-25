# 🚀 完整部署指南 - 已构建完成

## ✅ 已完成的步骤

- ✅ 前端代码已构建 (`dist/` 文件夹已生成)
- ✅ 后端 Functions 已准备就绪 (`functions/api/` 文件夹)
- ✅ 所有配置文件已创建 (`wrangler.toml`, `package.json`)
- ✅ 项目代码已提交到 Git
- ✅ 依赖已安装 (`node_modules/` 文件夹)

---

## 📋 接下来的步骤 (需要在 Cloudflare 后台完成)

### 步骤 1️⃣: 创建 R2 Bucket

1. 登录 [Cloudflare 控制面板](https://dash.cloudflare.com)
2. 进入 **R2** 服务
3. 点击 **Create Bucket**
4. 填入 Bucket 名称: `tmp-cloud-r2`
5. 选择地区 (推荐亚太地区以减低延迟)
6. 点击 **Create Bucket**
7. 进入新创建的 Bucket，获取 **S3 API Token**

### 步骤 2️⃣: 创建 API Token

1. 进入 **My Profile** → **API Tokens**
2. 点击 **Create Token**
3. 选择模板: **Edit Cloudflare Workers**
4. 配置权限:
   - Account > Cloudflare Pages > Edit
   - Account > R2 > Edit
   - Account > Workers Secrets > Edit
5. 点击 **Continue to Summary**
6. 复制生成的 token (保存好!)

### 步骤 3️⃣: 设置密码 Secret

1. 进入 [Cloudflare 控制面板](https://dash.cloudflare.com)
2. 进入 **Workers & Pages**
3. 创建新的 Pages 项目，选择 **Direct Upload** 并上传 `dist/` 文件夹
4. 项目创建后，进入 **Settings** → **Environment variables**
5. 点击 **Add Secret**
6. 名称: `UPLOAD_PASSWORD`
7. 值: 输入你要设置的密码 (例如: `admin123`)
8. 点击 **Save**

### 步骤 4️⃣: 部署前端到 Pages

**方法 A: 通过网页控制面板 (推荐新手)**

1. 进入 [Cloudflare Pages](https://pages.cloudflare.com)
2. 点击 **Create a project** → **Direct upload**
3. 项目名称: `tmp-cloud`
4. 上传 `dist/` 文件夹
5. 点击 **Deploy**
6. 等待部署完成，记下分配的 URL

**方法 B: 通过 CLI (需要认证)**

```bash
# 使用网页认证
wrangler login

# 或使用 API Token (设置环境变量)
export CLOUDFLARE_API_TOKEN="your-token-here"

# 部署
cd /workspaces/tmp-cloud
wrangler pages deploy dist --project-name=tmp-cloud
```

### 步骤 5️⃣: 配置 Functions 路由

Pages 部署完成后:

1. 进入项目 **Settings**
2. 找到 **Build settings** → **Build output directory**: 确认为 `dist`
3. 进入 **Functions** 标签
4. 配置路由:
   - 路由: `/api/*`
   - 指向: `functions/api/`

#### 或者使用 `_routes.json` (更简单)

在 `dist/` 文件夹创建 `_routes.json`:

```json
{
  "version": 1,
  "include": ["/api/*"],
  "exclude": []
}
```

重新部署即可。

---

## 🎯 完整部署步骤 (CLI 方式)

```bash
# 1. 进入项目目录
cd /workspaces/tmp-cloud

# 2. 设置 Cloudflare API Token (推荐方式)
export CLOUDFLARE_API_TOKEN="your-api-token-here"

# 3. 部署到 Pages
wrangler pages deploy dist --project-name=tmp-cloud

# 4. 设置 Secret
wrangler secret:bulk --env=production
# 输入:
# UPLOAD_PASSWORD=your-password-here

# 5. 验证部署
wrangler pages deployment list --project-name=tmp-cloud
```

---

## 📂 文件结构验证

```bash
# 验证前端构建
ls -la /workspaces/tmp-cloud/dist/

# 验证后端文件
ls -la /workspaces/tmp-cloud/functions/api/

# 验证配置
cat /workspaces/tmp-cloud/wrangler.toml
```

---

## 🔐 密码设置

部署完成后，你可以随时修改密码:

```bash
# 更新密码
wrangler secret:bulk --env=production

# 列出已设置的 Secrets
wrangler secret:list
```

---

## 🌐 部署完成后

1. 获取 Pages 分配的 URL (例如: `tmp-cloud.pages.dev`)
2. 分享给他人使用
3. 验证功能:
   - 打开网页，应该看到文件列表界面
   - 尝试上传文件
   - 验证文件是否保存在 R2

---

## 🐛 解决常见问题

### 问题 1: "认证失败"

**解决方案:**
```bash
# 方式 A: 使用网页认证
wrangler login

# 方式 B: 使用 API Token
export CLOUDFLARE_API_TOKEN="your-token"
```

### 问题 2: "R2 Bucket 不存在"

**解决方案:**
1. 在 Cloudflare 控制面板创建 R2 Bucket: `tmp-cloud-r2`
2. 确保 API Token 有 R2 编辑权限

### 问题 3: "Functions 没有权限访问 R2"

**解决方案:**
1. 检查 `wrangler.toml` 中的 `R2_BUCKET` 绑定
2. 在 Pages 项目 Settings 中添加环境绑定
3. 重新部署

### 问题 4: "上传提示需要密码但密码错误"

**解决方案:**
1. 确认 Secret 已设置: `wrangler secret:list`
2. 确认密码一致
3. 重新部署 Pages

---

## 💡 测试功能

部署完成后，在浏览器测试:

```javascript
// 在控制台测试 API

// 1. 获取文件列表
fetch('/api/list').then(r => r.json()).then(console.log)

// 2. 验证密码
fetch('/api/verify-password', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({password: 'your-password'})
}).then(r => r.json()).then(console.log)

// 3. 检查已用空间
fetch('/api/list').then(r => r.json()).then(d => {
  console.log('已用空间:', (d.totalUsed / 1024 / 1024 / 1024).toFixed(2), 'GB')
})
```

---

## 📞 需要帮助?

1. 检查 [DEPLOYMENT.md](./DEPLOYMENT.md) - 完整技术文档
2. 检查 [README.md](./README.md) - 项目介绍
3. 查看 [Cloudflare 官方文档](https://developers.cloudflare.com/)

---

**下一步**: 按照上述步骤在 Cloudflare 后台完成部署! 🎉
