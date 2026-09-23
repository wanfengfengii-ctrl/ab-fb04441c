# syntax=docker/dockerfile:1

# 依赖层：安装全部依赖（含 devDependencies，供测试与构建使用）
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 构建层：类型检查 + 产出静态站点
FROM deps AS build
COPY . .
RUN npm run build

# 验证层：代码测试 + 构建检查 + HTTP 冒烟，执行后自行退出并以退出码报告结果
FROM deps AS verify
COPY . .
RUN chmod +x scripts/verify.sh
CMD ["sh", "scripts/verify.sh"]

# 交付层（默认目标）：Nginx 托管静态站点
FROM nginx:1.27-alpine AS web
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
