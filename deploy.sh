#!/bin/bash

echo "🚀 临时网盘部署工具"
echo "=================="
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js 未安装"
  exit 1
fi

# 检查 Wrangler
if ! command -v wrangler &> /dev/null; then
  echo "⚠️  Wrangler 未全局安装，将使用本地版本"
fi

echo "📦 安装依赖..."
npm install

echo ""
echo "🏗️  构建前端..."
npm run build

echo ""
echo "📝 设置 R2 存储桶..."
wrangler r2 bucket create tmp-cloud-r2 2>/dev/null || echo "✓ 存储桶已存在"

echo ""
echo "🔐 设置密码..."
read -sp "请输入上传密码 (空间不足时需要): " PASSWORD
echo ""

if [ -n "$PASSWORD" ]; then
  echo "$PASSWORD" | wrangler secret:bulk
  echo "✓ 密码已设置"
fi

echo ""
echo "🌐 部署到 Cloudflare Pages..."
wrangler pages deploy dist

echo ""
echo "✅ 部署完成！"
echo ""
echo "下一步:"
echo "1. 登录 Cloudflare 控制面板"
echo "2. 进入 Pages > tmp-cloud"
echo "3. 等待部署完成"
echo "4. 访问分配的 URL"
