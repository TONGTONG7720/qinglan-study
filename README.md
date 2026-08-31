# 清朗学习系统

面向家庭邀请制使用的初中学习系统。仓库包含 NestJS API、React/Vite Web、共享 Zod 合同、Prisma/PostgreSQL 数据模型、数据库迁移与自动化测试。

## 本地运行

要求：Node.js `24.15.x`、pnpm `11.21.0`、Docker Desktop。

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
pnpm install --frozen-lockfile
pnpm --filter @study/api prisma:migrate:deploy
pnpm build
pnpm dev
```

默认 API 地址为 `http://127.0.0.1:3001`。Web 可通过 `pnpm dev:web` 单独启动。

## 验证

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## 数据与发布边界

- `.env`、密码、令牌、真实家庭或学生资料、浏览器 Profile、日志和本地数据库不得提交。
- 正式 AI 评测结果、人工盲审结果、教材审查报告和生产 Secret 保持在 Git 外。
- `DEVELOPMENT_FIXTURE` 仅用于本地开发与 QA；生产构建不得把 Fixture 当作真实数据或成功结果。
- 当前代码通过工程门禁不等于完整产品已具备正式上线条件；未接入的生产服务必须保持明确不可用边界。
