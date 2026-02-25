#!/bin/bash
set -e

# ============================================
# copilot-api 构建发布脚本
# 用法: ./scripts/build-release.sh <version>
# 示例: ./scripts/build-release.sh 0.10.0
# ============================================

VERSION=${1:-}
if [ -z "$VERSION" ]; then
  echo "用法: $0 <version>"
  echo "示例: $0 0.10.0"
  exit 1
fi

TAG="v${VERSION}"
IMAGE_NAME="ghcr.io/ritel-t/copilot-api"
TAR_FILE="copilot-api-${TAG}.tar.gz"

echo "============================================"
echo "构建 copilot-api ${TAG}"
echo "============================================"

# 1. 构建后端
echo ""
echo "[1/5] 构建后端..."
bun run build

# 2. 构建前端
echo ""
echo "[2/5] 构建前端..."
cd web && bun run build && cd ..

# 3. 构建 Docker 镜像
echo ""
echo "[3/5] 构建 Docker 镜像..."
docker build \
  -t ${IMAGE_NAME}:${TAG} \
  -t ${IMAGE_NAME}:latest \
  .

# 4. 导出镜像为 tar.gz
echo ""
echo "[4/5] 导出 Docker 镜像..."
docker save ${IMAGE_NAME}:${TAG} | gzip > ${TAR_FILE}

# 5. 显示构建产物
echo ""
echo "[5/5] 构建完成!"
echo ""
echo "构建产物:"
echo "  - dist/main.js ($(du -h dist/main.js | cut -f1))"
echo "  - dist/main.js.map ($(du -h dist/main.js.map | cut -f1))"
echo "  - ${TAR_FILE} ($(du -h ${TAR_FILE} | cut -f1))"
echo ""
echo "镜像标签:"
echo "  - ${IMAGE_NAME}:${TAG}"
echo "  - ${IMAGE_NAME}:latest"
echo ""
echo "============================================"
echo "下一步操作:"
echo ""
echo "1. 上传到 GitHub Release:"
echo "   gh release upload ${TAG} dist/main.js dist/main.js.map ${TAR_FILE} --repo Ritel-T/copilot-api"
echo ""
echo "2. 推送镜像到 ghcr.io:"
echo "   docker push ${IMAGE_NAME}:${TAG}"
echo "   docker push ${IMAGE_NAME}:latest"
echo ""
echo "3. 目标服务器部署:"
echo "   wget https://github.com/Ritel-T/copilot-api/releases/download/${TAG}/${TAR_FILE}"
echo "   docker load < ${TAR_FILE}"
echo "   docker compose up -d"
echo "============================================"
