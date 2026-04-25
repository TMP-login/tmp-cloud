#!/bin/bash

echo "🔍 临时网盘项目完整性检查"
echo "================================"
echo ""

# 检查前端构建
echo "1️⃣  检查前端构建..."
if [ -d "dist" ]; then
  echo "   ✅ dist/ 文件夹存在"
  echo "   📦 包含文件:"
  ls -lh dist/ | tail -5
else
  echo "   ❌ dist/ 文件夹不存在"
  exit 1
fi

echo ""
echo "2️⃣  检查后端 Functions..."
if [ -f "functions/api/upload.js" ] && [ -f "functions/api/list.js" ]; then
  echo "   ✅ Functions 已就位"
  echo "   📄 文件列表:"
  ls -1 functions/api/
else
  echo "   ❌ Functions 文件不完整"
  exit 1
fi

echo ""
echo "3️⃣  检查配置文件..."
if [ -f "wrangler.toml" ] && [ -f "package.json" ]; then
  echo "   ✅ 配置文件已备齐"
  echo "   Account ID: $(grep 'account_id' wrangler.toml | head -1)"
else
  echo "   ❌ 配置文件缺失"
  exit 1
fi

echo ""
echo "4️⃣  检查 Node 依赖..."
if [ -d "node_modules" ]; then
  echo "   ✅ node_modules 已安装"
  echo "   📦 包数量: $(ls -1d node_modules/*/ 2>/dev/null | wc -l)"
else
  echo "   ❌ 依赖未安装"
  exit 1
fi

echo ""
echo "5️⃣  检查 Git 提交..."
if git rev-parse --git-dir > /dev/null 2>&1; then
  COMMIT_COUNT=$(git rev-list --all --count 2>/dev/null || echo "0")
  echo "   ✅ Git 仓库有效"
  echo "   📝 提交数: $COMMIT_COUNT"
else
  echo "   ⚠️  Git 仓库不可用"
fi

echo ""
echo "================================"
echo "✅ 项目验证完成！"
echo ""
echo "📋 接下来的步骤:"
echo "1. 打开 Cloudflare 控制面板"
echo "2. 创建 R2 Bucket: tmp-cloud-r2"
echo "3. 创建 API Token (带 Pages/R2/Secrets 权限)"
echo "4. 运行部署命令:"
echo ""
echo "   cd /workspaces/tmp-cloud"
echo "   export CLOUDFLARE_API_TOKEN='your-token'"
echo "   wrangler pages deploy dist --project-name=tmp-cloud"
echo ""
echo "更多信息见: DEPLOY_NOW.md"
echo ""
