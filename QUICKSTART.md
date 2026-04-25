# 🚀 快速启动指南

## 本地开发

```bash
# 安装依赖
npm install

# 开发服务器
npm run dev
```

然后打开 `http://localhost:5173`

---

## 部署到 Cloudflare

### 方式 1: 自动部署脚本 (推荐)

```bash
chmod +x deploy.sh
./deploy.sh
```

按照提示输入密码，自动完成所有步骤。

### 方式 2: 手动部署

```bash
# 1. 创建 R2 存储桶
wrangler r2 bucket create tmp-cloud-r2

# 2. 设置密码 Secret
wrangler secret:bulk
# 输入:
# UPLOAD_PASSWORD=你的密码

# 3. 构建前端
npm run build

# 4. 部署
wrangler pages deploy dist
```

---

## 常见问题

### 如何修改密码？

```bash
wrangler secret:bulk
```

修改 UPLOAD_PASSWORD 的值，重新部署后生效。

### 如何修改存储桶名称？

编辑 `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "R2_BUCKET"
bucket_name = "your-bucket-name"  # 改这里
```

### 如何查看部署状态？

```bash
wrangler pages deployment list
```

---

## 部署完成后

1. 登录 Cloudflare 控制面板
2. 进入 **Pages** 服务
3. 找到 `tmp-cloud` 项目
4. 在部署详情中获取访问 URL
5. 分享给其他人使用

---

## 成本说明

- ✅ **完全免费** - 使用 Cloudflare 免费额度
- ✅ **不会扣费** - 代码保证永不超 10GB
- ✅ **自动清理** - 删除文件后立即释放空间

---

## 更多信息

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)
