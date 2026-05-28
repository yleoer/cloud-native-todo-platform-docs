# 阶段二附录 A：Go 后端项目综合验收

阶段二的目标不是只学会几段 Go 语法，而是把 `cloud-native-todo-platform` 推进成一个可运行、可测试、可排障、可展示的后端项目。

完成本附录后，你应该能把第 7-14 篇的成果整理成一份作品集：命令行 Todo 工具、工程化项目结构、标准库 API、Gin API、并发统计任务、PostgreSQL 持久化、Redis 缓存与限流、JWT 鉴权、配置分层、结构化日志、自动化测试和生产化运行命令。

## 1. 验收目标

阶段二最终验收关注 6 件事：

| 验收方向 | 你需要证明什么 |
|---|---|
| Go 基础能力 | 能组织 package、struct、interface、error、defer 和 Go module |
| 并发能力 | 能使用 goroutine、channel、context、WaitGroup、Mutex 和竞态检测 |
| 工程化能力 | 能组织 `cmd/`、`internal/`、配置、日志、测试和验证脚本 |
| Web API 能力 | 能开发可测试的 RESTful API，并提供健康检查和优雅关闭 |
| 数据与缓存能力 | 能接入 PostgreSQL、Redis，并说明事务、缓存、限流和队列边界 |
| 生产化能力 | 能实现认证、安全响应、审计日志、配置分层和运维命令 |

## 2. 最终作品集目录

建议在 `cloud-native-todo-platform` 仓库中形成以下结构：

```text
cloud-native-todo-platform/
├── README.md
├── Makefile
├── docker-compose.yml
├── go.mod
├── go.sum
├── api/
│   ├── cmd/
│   │   ├── todo-api/
│   │   │   └── main.go
│   │   └── todo-load/
│   │       └── main.go
│   └── internal/
│       ├── handler/
│       │   ├── gin/
│       │   └── http/
│       ├── model/
│       ├── repository/
│       └── service/
├── cmd/
│   └── todo-cli/
│       └── main.go
├── configs/
│   ├── base.json
│   ├── dev.json
│   ├── test.json
│   └── prod.json
├── docs/
│   ├── api/
│   │   └── openapi.yaml
│   └── stage-02-acceptance.md
├── internal/
│   ├── app/
│   ├── auth/
│   ├── cache/
│   ├── config/
│   ├── db/
│   ├── logger/
│   ├── ratelimit/
│   ├── tasks/
│   └── todo/
├── migrations/
│   ├── 000001_create_todos.up.sql
│   └── 000001_create_todos.down.sql
├── scripts/
│   └── verify.ps1
└── test/
    └── integration/
```

如果你的目录和这里不完全一致，没有关系。验收重点是：你能说明每个目录的职责，并能通过命令证明关键功能可运行。

## 3. 统一版本与工具基线

阶段二建议统一使用以下基线：

| 工具 | 建议版本 | 说明 |
|---|---|---|
| Go | `1.26.x` | 与新版课程 Go 工具链保持一致。 |
| Docker Compose | v2 | 第 12、13 篇用于启动 PostgreSQL 和 Redis。 |
| PostgreSQL | 18 | 本地实验可使用 Docker Compose。 |
| Redis | 8.2 | 本地实验可使用 Docker Compose。 |
| curl | 任意现代版本 | 用于 API smoke test。 |
| jq | 可选 | Linux、macOS、WSL2 中可用于解析登录响应。 |

不要把版本差异理解成“教程错误”。真实工作中，工具链版本需要在 README、CI 和容器镜像里固定或说明。

## 4. 两档验收路径

### 4.1 最小验收路径

如果你暂时没有 Docker 或外部依赖，先完成最小验收：

=== "Linux / macOS / WSL2"

    ```bash
    go mod tidy
    go fmt ./...
    go test ./...
    go test -race ./api/internal/service ./api/internal/handler/gin ./api/internal/handler/http
    go build ./api/cmd/todo-api ./api/cmd/todo-load
    go run ./api/cmd/todo-api openapi
    ```

=== "Windows PowerShell"

    ```powershell
    go mod tidy
    go fmt ./...
    go test ./...
    go test -race ./api/internal/service ./api/internal/handler/gin ./api/internal/handler/http
    go build ./api/cmd/todo-api ./api/cmd/todo-load
    go run ./api/cmd/todo-api openapi
    ```

这条路径主要验证：Go 代码完整、测试能跑、主要命令能构建、基础配置能加载。

### 4.2 完整验收路径

如果你已经安装 Docker Compose，再执行完整验收：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose up -d postgres redis
    docker compose ps

    docker compose exec -T postgres \
      psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql

    export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
    export TODO_TEST_DATABASE_DSN="$TODO_DATABASE_DSN"
    export TODO_ALLOW_DATABASE_RESET=true
    export TODO_REDIS_ADDR='127.0.0.1:6379'
    export TODO_REDIS_PASSWORD='todo_redis_password'

    go test ./...
    go run ./api/cmd/todo-api openapi
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose up -d postgres redis
    docker compose ps

    docker compose exec -T postgres `
      psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql

    $env:TODO_DATABASE_DSN = 'postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
    $env:TODO_TEST_DATABASE_DSN = $env:TODO_DATABASE_DSN
    $env:TODO_ALLOW_DATABASE_RESET = 'true'
    $env:TODO_REDIS_ADDR = '127.0.0.1:6379'
    $env:TODO_REDIS_PASSWORD = 'todo_redis_password'

    go test ./...
    go run ./api/cmd/todo-api openapi
    ```

完整路径会验证 PostgreSQL、Redis、集成测试、迁移文件和外部依赖配置。

## 5. API Smoke Test

先启动服务：

=== "Linux / macOS / WSL2"

    ```bash
    HASH=$(TODO_CONFIG_DIR=configs TODO_ENV=dev go run ./cmd/todo-api hash-password "change-me-123")

    export TODO_CONFIG_DIR=configs
    export TODO_ENV=dev
    export TODO_JWT_SECRET=0123456789abcdef0123456789abcdef
    export TODO_AUTH_USERS="admin=$HASH"

    go run ./cmd/todo-api serve
    ```

=== "Windows PowerShell"

    ```powershell
    $hash = go run ./cmd/todo-api hash-password "change-me-123"

    $env:TODO_CONFIG_DIR = 'configs'
    $env:TODO_ENV = 'dev'
    $env:TODO_JWT_SECRET = '0123456789abcdef0123456789abcdef'
    $env:TODO_AUTH_USERS = "admin=$hash"

    go run ./cmd/todo-api serve
    ```

另开终端验证 API：

=== "Linux / macOS / WSL2"

    ```bash
    curl -i http://127.0.0.1:8080/healthz

    curl -i http://127.0.0.1:8080/api/v1/todos

    TOKEN=$(curl -s -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:8080/api/v1/auth/login | jq -r '.data.token')

    curl -i -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"title":"stage 02 acceptance"}' \
      http://127.0.0.1:8080/api/v1/todos
    ```

=== "Windows PowerShell"

    ```powershell
    curl.exe -i http://127.0.0.1:8080/healthz

    curl.exe -i http://127.0.0.1:8080/api/v1/todos

    $login = curl.exe -s -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"change-me-123\"}" http://127.0.0.1:8080/api/v1/auth/login | ConvertFrom-Json
    $token = $login.data.token

    curl.exe -i -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"title\":\"stage 02 acceptance\"}" http://127.0.0.1:8080/api/v1/todos
    ```

预期结果：

- `/healthz` 返回 `200 OK`。
- 无 Token 访问 `/api/v1/todos` 返回 `401 Unauthorized`。
- 登录成功后能拿到 JWT。
- 带 Token 创建 Todo 返回 `201 Created`。
- 服务日志中包含 `request_id`、`status`、`method` 和 `path`。

如果没有安装 `jq`，Linux、macOS、WSL2 可以先打印登录响应，再手动复制 `data.token` 字段。

## 6. 编写阶段验收文档

创建 `docs/stage-02-acceptance.md`：

````markdown
# 阶段二验收记录

## 基础信息

- 操作系统：
- Go 版本：
- Docker Compose 版本：
- 项目路径：
- 验收日期：

## 已完成成果

- [ ] 第 7 篇：完成 `todo-cli`，支持 Todo 增删改查。
- [ ] 第 8 篇：完成 Go 后端工程骨架、配置、日志、测试和验证入口。
- [ ] 第 9 篇：完成标准库 Todo API v1、统一响应、健康检查和优雅关闭。
- [ ] 第 10 篇：完成 Gin Todo API v2、路由组、中间件和 OpenAPI 文档。
- [ ] 第 11 篇：完成并发 Todo 统计任务、压测命令、超时取消和竞态检测。
- [ ] 第 12 篇：完成 PostgreSQL 表设计、迁移、Repository 和集成测试。
- [ ] 第 13 篇：完成 Redis 缓存、限流和简单异步任务。
- [ ] 第 14 篇：完成 JWT 鉴权、审计日志、配置分层和生产化命令。

## 关键验证输出

```text
go version:
go test ./...:
go test -race ./api/internal/service ./api/internal/handler/gin ./api/internal/handler/http:
go build ./api/cmd/todo-api ./api/cmd/todo-load:
go run ./api/cmd/todo-api openapi:
curl /healthz:
curl /api/v1/auth/login:
```

## 排障复盘

记录至少 3 个你实际处理过的问题：

1. 问题：
   - 现象：
   - 定位命令：
   - 根因：
   - 修复方式：

2. 问题：
   - 现象：
   - 定位命令：
   - 根因：
   - 修复方式：

3. 问题：
   - 现象：
   - 定位命令：
   - 根因：
   - 修复方式：

## 作品集说明

用 5-8 句话说明这个项目体现了哪些后端能力：

- Go 工程化：
- RESTful API：
- 数据库：
- Redis：
- 并发：
- 测试：
- 生产化：
````

这份文档会成为你的阶段二作品集说明。它比单纯贴代码更有说服力，因为它说明了你如何验证、如何排障、如何表达工程边界。

## 7. 常见验收失败

| 现象 | 常见原因 | 处理方式 |
|---|---|---|
| `go test ./...` 失败 | 代码块复制不完整、包路径错误、依赖未整理 | 执行 `go mod tidy`，根据失败包逐个定位 |
| `go test -race` 很慢 | 竞态检测有额外开销 | 只对核心包运行，例如 `api/internal/service`、`api/internal/handler/gin` |
| `docker compose up` 失败 | Docker Desktop 未启动、端口冲突、旧容器残留 | 执行 `docker compose ps`、`docker compose logs`、必要时 `docker compose down -v` |
| PostgreSQL 认证失败 | DSN 中用户名、密码、数据库名与 Compose 不一致 | 对照 `docker-compose.yml` 和 `TODO_DATABASE_DSN` |
| Redis 连接失败 | Redis 未启动、密码不一致、端口未映射 | 检查 `docker compose logs redis` 和 `TODO_REDIS_PASSWORD` |
| 登录一直 401 | 密码哈希未更新、`TODO_AUTH_USERS` 引号错误、JWT Secret 太短 | 重新执行 `hash-password`，使用单引号保存哈希 |
| API 没有启用数据库 | 没有设置 `TODO_DATABASE_DSN` | 设置 DSN 后重启服务 |
| API 没有启用 Redis | 没有设置 `TODO_REDIS_ADDR` | 设置 Redis 环境变量后重启服务 |

## 8. 生产环境红线

阶段二已经进入真实后端项目范畴，必须建立这些红线：

- 不提交数据库密码、Redis 密码、JWT Secret、真实 Token。
- 不在生产环境使用 `sslmode=disable`。
- 不把课程里的教学版 Redis List 队列当作可靠消息队列直接上生产。
- 不让应用运行账号拥有无限制 DDL 权限。
- 不把 `migrate` 命令和多副本应用启动混在一起无锁执行。
- 不把内部错误、SQL 原文、DSN、堆栈直接返回给客户端。
- 不记录明文密码、JWT 原文、认证 Header 和敏感请求体。
- 不无限制启动 goroutine，不忽略 `context` 取消。
- 不把覆盖率当成唯一质量指标。

## 9. 面试复盘题

完成阶段二后，建议用这些问题做自测：

1. 你如何组织一个 Go 后端项目的目录结构？
2. `internal/` 目录解决什么问题？
3. Go 的 interface 在 Repository 分层中有什么价值？
4. 如何判断应该使用 Mutex 还是 channel？
5. `context` 在 HTTP、数据库、Redis 调用中有什么作用？
6. 如何设计 RESTful API 的统一响应和错误码？
7. PostgreSQL 连接池为什么不能每个请求创建一次？
8. 事务隔离级别和数据一致性有什么关系？
9. Redis 缓存穿透、击穿、雪崩分别怎么处理？
10. Redis List 做队列有什么可靠性边界？
11. JWT 泄露后如何降低影响？
12. 生产配置为什么要区分 ConfigMap 和 Secret？
13. 迁移命令为什么要幂等、可重复执行？
14. 你会如何向面试官介绍这个 Todo Platform？

## 10. 作品集表达模板

可以在项目 `README.md` 中增加：

````markdown
## Stage 02 Go Backend

This project has completed the Go backend stage:

- CLI: Todo CRUD command-line tool
- Concurrency: Todo statistics executor with timeout and concurrency control
- Engineering: structured config, slog logging, tests, Makefile and verification scripts
- Web API: RESTful Todo API v1 with health checks and graceful shutdown
- Database: PostgreSQL persistence, SQL migrations, repository abstraction and integration tests
- Redis: cache-aside, rate limiting and simple async task queue
- Production style: JWT authentication, request ID, audit log, layered config and operational commands

Verification:

```bash
go test ./...
go test -race ./api/internal/service ./api/internal/handler/gin ./api/internal/handler/http
go build ./api/cmd/todo-api ./api/cmd/todo-load
go run ./api/cmd/todo-api openapi
```
````

这段说明能帮助别人快速理解你的项目不是“只有 CRUD”，而是覆盖了真实后端工程中的核心能力。

## 11. 下一阶段衔接

阶段二完成后，项目已经具备后端服务的主要形态。进入 Docker 阶段前，请确认：

- `todo-api` 可以通过配置切换文件存储、PostgreSQL 和 Redis。
- `go test ./...` 在无外部依赖时可运行。
- 外部依赖测试有明确环境变量和安全确认开关。
- `config-check`、`hash-password`、`migrate`、`serve` 命令职责清晰。
- README 能说明阶段二成果。
- 你能解释哪些实现是教学版，哪些能力需要在生产环境继续增强。

下一阶段会把 Todo API、PostgreSQL 和 Redis 放进容器环境，进一步学习 Dockerfile、镜像构建、Docker Compose、本地编排和容器运行边界。
