#!/bin/sh
# 一次性核验入口：单元测试 → 构建检查 → HTTP 冒烟；任一步失败即以非零码退出。
set -eu

WEB_URL="${SMOKE_URL:-http://web:80}"

echo "==> [1/3] 代码测试（vitest，含 120 组随机穷举对拍）"
npm test

echo "==> [2/3] 构建检查（tsc 类型检查 + vite 构建）"
npm run build

echo "==> [3/3] HTTP 冒烟（${WEB_URL}）"
fetch() { wget -q -O - "$1"; }

INDEX="$(fetch "${WEB_URL}/")" || {
  echo "FAIL: 无法获取首页 ${WEB_URL}/"
  exit 1
}

# 首页必须包含应用标题与入口脚本
echo "$INDEX" | grep -q '电子束' || {
  echo "FAIL: 首页内容不符合预期（缺少应用标题）"
  exit 1
}
ASSET="$(echo "$INDEX" | sed -n 's/.*src="\(\/assets\/[^"]*\.js\)".*/\1/p' | head -1)"
[ -n "$ASSET" ] || {
  echo "FAIL: 首页未引用构建产物 JS"
  exit 1
}

BODY="$(fetch "${WEB_URL}${ASSET}")" || {
  echo "FAIL: 构建产物 ${ASSET} 不可访问"
  exit 1
}
[ -n "$BODY" ] || {
  echo "FAIL: 构建产物 ${ASSET} 为空"
  exit 1
}

# 健康检查端点
wget -q --spider "${WEB_URL}/" || {
  echo "FAIL: 健康检查地址无响应"
  exit 1
}

# SPA 回退：未知路径也应返回首页
FALLBACK="$(fetch "${WEB_URL}/some/deep/route")" || {
  echo "FAIL: SPA 回退路径无响应"
  exit 1
}
echo "$FALLBACK" | grep -q '<div id="root">' || {
  echo "FAIL: SPA 回退未返回 index.html"
  exit 1
}

echo "OK: 单元测试、构建检查、HTTP 冒烟全部通过"
