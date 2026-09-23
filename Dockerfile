# syntax=docker/dockerfile:1

# ---- 依赖层 ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 构建层 ----
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

# ---- 静态站点 ----
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
# 容器级健康检查（compose 中另有等价声明，便于单容器运行时同样生效）
HEALTHCHECK --interval=5s --timeout=3s --start-period=3s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:80/ || exit 1

# ---- 一次性核验服务：单元测试 + 构建检查 + HTTP 冒烟 ----
FROM deps AS verify
WORKDIR /app
COPY . .
COPY scripts/verify-entrypoint.sh /verify-entrypoint.sh
RUN chmod +x /verify-entrypoint.sh
CMD ["/verify-entrypoint.sh"]
