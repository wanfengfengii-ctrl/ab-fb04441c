#!/bin/sh
# 一次性验证脚本：代码测试 → 构建检查 → HTTP 冒烟
# 任何一步失败即以求和退出码报告失败；全部通过以 0 退出。
set -e

echo "==> [1/3] 代码测试 (vitest run)"
npm run test:run

echo "==> [2/3] 构建检查 (tsc --noEmit && vite build)"
npm run build

WEB_URL="${WEB_URL:-http://web:80}"
echo "==> [3/3] HTTP 冒烟 (${WEB_URL})"

attempt=1
until wget -q -O /tmp/index.html "$WEB_URL/"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -gt 10 ]; then
    echo "冒烟失败：无法获取首页" >&2
    exit 1
  fi
  echo "    等待 web 服务就绪（第 $attempt 次重试）…"
  sleep 2
done

grep -q 'id="root"' /tmp/index.html || {
  echo "冒烟失败：首页缺少挂载点 #root" >&2
  exit 1
}

ASSET=$(grep -o '/assets/[^"]*\.js' /tmp/index.html | head -n 1)
if [ -z "$ASSET" ]; then
  echo "冒烟失败：首页未引用构建产物" >&2
  exit 1
fi
wget -q -O /tmp/main.js "$WEB_URL$ASSET" || {
  echo "冒烟失败：构建产物 $ASSET 不可达" >&2
  exit 1
}

# 求解器 Web Worker 分块（主包内以相对路径引用）也必须可达
WORKER_ASSET=$(grep -o 'assets/solver\.worker-[^"]*\.js' /tmp/main.js | head -n 1)
if [ -n "$WORKER_ASSET" ]; then
  wget -q -O /dev/null "$WEB_URL/$WORKER_ASSET" || {
    echo "冒烟失败：Worker 分块 $WORKER_ASSET 不可达" >&2
    exit 1
  }
else
  echo "冒烟失败：主包内未找到求解器 Worker 分块引用" >&2
  exit 1
fi

wget -q -O - "$WEB_URL/healthz" | grep -q ok || {
  echo "冒烟失败：/healthz 未返回 ok" >&2
  exit 1
}

echo "HTTP 冒烟通过：首页、构建产物、健康检查端点均正常"
echo "全部验证通过"
