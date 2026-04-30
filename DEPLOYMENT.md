# 临时网盘部署指南

本文档整理了这个仓库从本地构建到 Cloudflare Pages 上线的完整流程，并单独说明“强制部署”命令。

## 部署命令速查

### 普通部署

```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name=tmp-cloud
```

### 强制部署

如果你想在工作区有未提交修改时也继续部署，或者希望尽量跳过缓存重新上传，可以使用：

```bash
npm run build
npx wrangler pages deploy dist --project-name=tmp-cloud --commit-dirty=true --skip-caching
```

说明：
- `--commit-dirty=true` 允许在当前目录有未提交修改时继续部署。
- `--skip-caching` 用于尽量跳过缓存，适合你想“强制重新发版”的场景。
- `wrangler pages deploy` 本身没有独立的 `--force` 参数，这两个选项就是这个项目里最接近“强制部署”的组合。

## 部署前准备

### 1. 安装依赖

```bash
npm install
```

### 2. 登录 Cloudflare

二选一即可：

```bash
wrangler login
```

或者使用 API Token：

```bash
export CLOUDFLARE_API_TOKEN="your_api_token"
```

### 3. 确认 Pages 与 R2 配置

当前仓库的关键配置在 [wrangler.toml](wrangler.toml)：

- Pages 构建输出目录：`dist`
- R2 bucket 名称：`tmp-cloud-r2`
- R2 绑定：`R2_BUCKET`

如果你要换 bucket 名，记得同步修改 [wrangler.toml](wrangler.toml) 和后端代码里引用的名称。

### 4. 配置上传密码

当空间不足时，上传需要密码。使用 Secrets 配置：

```bash
wrangler secret:bulk
```

输入内容：

```bash
UPLOAD_PASSWORD=your_password_here
```

如果你想更新密码，再执行一次同样的命令即可。

## 完整部署流程

### 第一步：确认本地代码能构建

```bash
npm run build
```

构建成功后会生成 `dist/` 目录，Pages 部署就是上传这个目录。

### 第二步：创建 R2 Bucket

如果 bucket 还不存在，先创建：

```bash
wrangler r2 bucket create tmp-cloud-r2
```

如果已存在，命令会返回提示，不影响后续部署。

### 第三步：设置密码 Secret

```bash
wrangler secret:bulk
```

输入：

```bash
UPLOAD_PASSWORD=your_password_here
```

### 第四步：部署到 Cloudflare Pages

```bash
npx wrangler pages deploy dist --project-name=tmp-cloud
```

如果你要强制重新部署，使用：

```bash
npx wrangler pages deploy dist --project-name=tmp-cloud --commit-dirty=true --skip-caching
```

### 第五步：确认部署结果

部署完成后，登录 Cloudflare 控制面板检查：

1. Pages 项目是否成功创建或更新。
2. Functions 是否可正常访问 `/api/*`。
3. R2 绑定是否仍指向 `tmp-cloud-r2`。
4. Secret `UPLOAD_PASSWORD` 是否存在。

## 本地调试流程

如果你只是想先在本地确认页面：

```bash
npm run dev
```

如果想模拟生产构建：

```bash
npm run build
npm run preview
```

## 推荐的发布顺序

日常发布建议按下面顺序执行：

```bash
npm install
npm run build
npx wrangler pages deploy dist --project-name=tmp-cloud
```

如果本地有未提交改动，或者你想确保重新部署最新产物：

```bash
npm run build
npx wrangler pages deploy dist --project-name=tmp-cloud --commit-dirty=true --skip-caching
```

## 常见问题

### 1. 部署后页面打开正常，但 API 不工作

检查以下内容：

- `functions/api/` 是否存在。
- Pages 项目是否启用了 Functions。
- 路由是否能访问 `/api/list`、`/api/upload` 等接口。

### 2. R2 读取或上传失败

检查：

```bash
wrangler r2 bucket list
```

确认 bucket 名称是否还是 `tmp-cloud-r2`，以及 [wrangler.toml](wrangler.toml) 中的绑定是否一致。

### 3. 空间不足时提示密码错误

重新设置 Secrets：

```bash
wrangler secret:bulk
```

然后重新部署一次。

### 4. 想重新发布但页面缓存看起来没更新

优先用“强制部署”命令：

```bash
npx wrangler pages deploy dist --project-name=tmp-cloud --commit-dirty=true --skip-caching
```

## 关联文件

- [package.json](package.json)
- [wrangler.toml](wrangler.toml)
- [deploy.sh](deploy.sh)
- [READY_TO_DEPLOY.md](READY_TO_DEPLOY.md)
