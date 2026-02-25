#!/bin/bash
set -e

# ============================================
# copilot-api 部署脚本 (目标服务器使用)
# 用法: ./deploy.sh <version>
# 示例: ./deploy.sh 0.10.0
# ============================================

VERSION=${1:-latest}
TAG="v${VERSION}"
TAR_FILE="copilot-api-${TAG}.tar.gz"
REPO="Ritel-T/copilot-api"

echo "============================================"
echo "部署 copilot-api ${TAG}"
echo "============================================"

# 检测是否需要下载镜像
if [ "$VERSION" != "latest" ]; then
  if [ ! -f "$TAR_FILE" ]; then
    echo ""
    echo "[1/3] 下载镜像..."
    wget -q --show-progress "https://github.com/${REPO}/releases/download/${TAG}/${TAR_FILE}"
  fi
  
  echo ""
  echo "[2/3] 加载镜像..."
  docker load < "$TAR_FILE"
  
  echo ""
  echo "[3/3] 启动服务..."
  docker tag ghcr.io/ritel-t/copilot-api:${TAG} ghcr.io/ritel-t/copilot-api:latest 2>/dev/null || true
else
  echo ""
  echo "[1/2] 拉取最新镜像..."
  docker pull ghcr.io/ritel-t/copilot-api:latest
  
  echo ""
  echo "[2/2] 启动服务..."
fi

docker compose up -d --force-recreate

echo ""
echo "============================================"
echo "部署完成!"
echo ""
echo "查看日志: docker compose logs -f"
echo "查看状态: docker compose ps"
echo "============================================"
