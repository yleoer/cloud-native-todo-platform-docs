# 阶段二验证总结

- 验证阶段：阶段二 `docs/chapters/stage-02-go-backend`
- 验证分支：`codex/revalidation-stage-01`
- 验证日期：2026-05-31
- 验证工作区：`/root/workspace/stage-validation/cloud-native-todo-platform-stage02`
- 课程项目来源：`/root/workspace/cloud-native-todo-platform`
- 网络策略：外网命令按要求附加 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`；本机回环访问补充 `NO_PROXY=127.0.0.1,localhost` 和 `no_proxy=127.0.0.1,localhost`。
- 镜像策略：Docker Compose 验证时把 PostgreSQL、Redis 镜像临时改为 `docker.1ms.run/postgres:18-alpine` 和 `docker.1ms.run/redis:8.2-alpine`。

## 阶段结论

修改后通过。

当前课程项目来源仓库只包含阶段一产物，缺少阶段二第 7-14 篇应落地的 Go 后端代码、配置、迁移和 Compose 文件。验证过程中未修改课程文档，也未修改真实项目仓库；在独立、持续保留的阶段二验证工作区中，按章节顺序从课程代码块生成阶段二产物，并执行临时修正后，最小验收路径、完整验收路径和 API smoke test 均通过。

阶段一环境已保留：`kind get clusters` 显示 `todo-dev`，`kubectl --context kind-todo-dev get nodes` 显示 `todo-dev-control-plane` 为 `Ready`。阶段二环境已保留：`todo-postgres`、`todo-redis` 容器运行且 healthy，数据卷未清理。

文档仓库自身的 `mkdocs build --strict` 未能执行，原因是当前环境未安装 `mkdocs`。

## 已验证章节

1. `07-go-basics.md`
2. `08-go-engineering-testing.md`
3. `09-go-net-http.md`
4. `10-go-web-api.md`
5. `11-go-concurrency.md`
6. `12-database.md`
7. `13-redis-cache.md`
8. `14-go-production.md`
9. `stage-02-acceptance.md`

## 按章节验证记录

### 第 7 篇：Go 语言基础

- 预期产物：`cmd/todo-cli/main.go`、`internal/todo/item.go`、`internal/todo/memory_store.go`、`go.mod`；CLI 支持 `add`、`list`、`done`、`update`、`delete`。
- 实际产物：验证工作区中生成上述文件；`go run ./cmd/todo-cli add '学习 Go 基础' add '完成 todo-cli' list done 1 update 2 '完成 Go module' list delete 1 list` 通过，并输出新增、完成、更新、删除后的 Todo 列表。
- 失败点：真实项目仓库缺少阶段二代码，原样无法运行第 7 篇命令。
- 临时修正：在阶段二验证工作区中按课程代码块生成 CLI 与 `internal/todo` 产物。

### 第 8 篇：Go 工程化与测试

- 预期产物：Go 后端工程骨架、配置、结构化日志、应用组装、单元测试、覆盖率和 Benchmark 能运行。
- 实际产物：课程文档第 8 篇代码块未给 `title=`，自动提取时没有落地 `cmd/todo-api`、`internal/app`、`internal/config`、`internal/logger`、`test/integration`；后续第 9-14 篇主线产物已覆盖阶段验收所需后端结构。`go test ./... -cover` 通过，API 相关包覆盖率包括 `handler/http` 79.1%、`handler/gin` 68.6%、`service` 72.0%；`go test ./api/internal/service -bench . -benchmem` 通过。
- 失败点：第 8 篇“完整代码”代码块缺少 `title="..."`，不利于自动化抽取和章节级产物核对；真实项目仓库缺少这些产物。
- 临时修正：以第 9-14 篇最终主线代码作为阶段二工程骨架进行验收，并记录第 8 篇文档结构问题。

### 第 9 篇：Go net/http 标准库与 HTTP 服务

- 预期产物：`api/cmd/todo-api`、`api/internal/model`、`api/internal/repository`、`api/internal/service`、`api/internal/handler/http`；标准库 Todo API v1 测试通过。
- 实际产物：相关文件已生成；`go test ./api/internal/handler/http` 通过，覆盖 Todo 生命周期、非法 JSON、Content-Type、非法状态和 request ID。
- 失败点：真实项目仓库缺少第 9 篇 API 代码，原样无法构建。
- 临时修正：在阶段二验证工作区中生成 API v1 代码并进入阶段总体验收。

### 第 10 篇：Go Web API 开发 Gin 框架

- 预期产物：Gin API v2、路由组、中间件、统一响应、OpenAPI 文档和 Handler 测试。
- 实际产物：`api/internal/handler/gin` 文件生成；`go test ./api/internal/handler/gin`、`go test -race ./api/internal/handler/gin` 通过；`go run ./api/cmd/todo-api openapi` 输出包含 `/api/v2/auth/login`、`bearerAuth` 和 `401` 的 OpenAPI YAML。
- 失败点：无阻塞性失败。
- 临时修正：无。

### 第 11 篇：Go 并发编程

- 预期产物：`api/internal/service/stats_service.go`、`stats_service_test.go`、`api/cmd/todo-load/main.go`；并发统计、超时取消、竞态检测和压测命令可运行。
- 实际产物：相关文件生成；`go test ./api/internal/service` 和 `go test -race ./api/internal/service` 通过；API 启动后执行 `go run ./api/cmd/todo-load -addr http://127.0.0.1:18080 -path /healthz -requests 10 -concurrency 2` 返回 `ok=10 failed=0`。
- 失败点：在 API 未启动时，`todo-load` 对 `/healthz` 返回 `ok=0 failed=3` 但进程退出码仍为 0，容易被脚本误判。
- 临时修正：先启动 API，再执行 `todo-load`；建议文档补充负载工具失败数不应只看退出码。

### 第 12 篇：数据库与持久化开发

- 预期产物：`docker-compose.yml`、`api/migrations/000001_create_todos.up.sql`、`down.sql`、PostgreSQL 连接封装、PostgreSQL Repository 和集成测试。
- 实际产物：相关文件生成；`docker compose up -d postgres redis` 成功；`docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql` 成功创建表和索引；带 `TODO_TEST_DATABASE_DSN` 与 `TODO_ALLOW_DATABASE_RESET=true` 的 `go test ./...` 通过。
- 失败点：课程正文 Compose 镜像使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine`，不符合本次要求的 `docker.1ms.run` 优先策略。
- 临时修正：在验证工作区将 Compose 镜像改为 `docker.1ms.run/postgres:18-alpine`。

### 第 13 篇：Redis、缓存与异步任务

- 预期产物：Redis Compose 服务、Redis 客户端、CachedRepository、限流中间件、Redis fixed-window limiter、Redis queue 和 API 集成。
- 实际产物：相关文件生成；`docker compose ps` 显示 `todo-redis` healthy；API 启动日志显示 `redis cache enabled`、`redis rate limit enabled`、`stats worker started`；API smoke test 中创建 Todo 后日志出现 cache miss、cache hit 和 stats refreshed。
- 失败点：课程正文 Compose 镜像使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine`，不符合本次要求的 `docker.1ms.run` 优先策略；`docker.1ms.run` 拉取成功但 PostgreSQL/Redis 镜像层下载较慢。
- 临时修正：在验证工作区将 Redis 镜像改为 `docker.1ms.run/redis:8.2-alpine`，等待镜像拉取完成后继续验证。

### 第 14 篇：Go 后端生产化能力

- 预期产物：`configs/base.json`、`dev.json`、`test.json`、`prod.json`、配置加载、JWT 鉴权、密码哈希、用户存储、审计日志、安全 Header、OpenAPI、`config-check`、`hash-password`、`migrate`、`serve`。
- 实际产物：相关文件生成；`config-check` 在缺少 `TODO_AUTH_USERS` 时失败并提示 `at least one auth user is required`；设置 `TODO_AUTH_USERS="admin=$HASH"` 后通过；API smoke test 通过：`/healthz` 返回 200，无 Token 访问 `/api/v2/todos` 返回 401，登录返回 JWT，带 Token 创建 Todo 返回 201，安全响应头包含 `X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`。
- 失败点：验收文档示例必须强调 bcrypt 哈希包含 `$`，`TODO_AUTH_USERS` 需要正确引号；否则配置检查会失败。
- 临时修正：使用 `HASH=$(go run ./api/cmd/todo-api hash-password 'change-me-123')` 后通过双引号设置 `TODO_AUTH_USERS="admin=$HASH"`。

### 阶段二验收文档

- 预期产物：最小验收路径、完整验收路径和 API smoke test 均能执行。
- 实际产物：`go mod tidy`、`go fmt ./...`、`go test ./...`、`go test -race ./api/internal/service ./api/internal/handler/gin ./api/internal/handler/http`、`go build ./api/cmd/todo-api ./api/cmd/todo-load`、`go run ./api/cmd/todo-api openapi` 均通过；完整路径的 Docker Compose、迁移、PostgreSQL/Redis 环境变量下 `go test ./...` 通过；API smoke test 通过。
- 失败点：真实项目仓库缺少阶段二产物，必须先按章节生成或补齐代码；文档仓库缺少 `mkdocs`，无法执行 `mkdocs build --strict`。
- 临时修正：使用持续验证工作区补齐阶段二代码，并安装 `docker-compose-v2` 后继续验收。

## 已验证产物

- CLI：`cmd/todo-cli` 与 `internal/todo`。
- 工程化：Go module、依赖、格式化、测试、覆盖率、Benchmark。
- 标准库 API：`api/internal/handler/http` 和 v1 Handler 测试。
- Gin API：`api/internal/handler/gin`、OpenAPI、v2 Handler 测试。
- 并发：`StatsService`、race test、`todo-load`。
- 数据库：PostgreSQL Compose 服务、迁移 SQL、数据库连接、PostgreSQL Repository、集成测试。
- Redis：Redis Compose 服务、go-redis 客户端、缓存包装、限流、任务队列。
- 生产化：配置分层、JWT、密码哈希、用户存储、审计日志、安全 Header、运维子命令。
- 阶段验收：最小路径、完整路径、API smoke test。

## 失败项分类

### P0

无。

### P1

- `docs/chapters/stage-02-go-backend/07-go-basics.md` 至 `14-go-production.md`：真实项目仓库当前缺少阶段二所有主线代码产物，原样无法从阶段一环境直接执行阶段二验收；必须把章节代码落地到项目仓库或提供配套代码分支。
- `docs/chapters/stage-02-go-backend/08-go-engineering-testing.md:312` 至 `837`：第 8 篇“完整代码”代码块未使用 `title="path"` 标注，自动化验证无法直接抽取文件路径，章节产物可复现性弱。
- `docs/chapters/stage-02-go-backend/11-go-concurrency.md:592`：`todo-load` 在请求全部失败时仍返回退出码 0，脚本只看退出码会误判压测通过。

### P2

- `docs/chapters/stage-02-go-backend/12-database.md:355`：PostgreSQL 镜像使用阿里云地址，建议改为或补充 `docker.1ms.run/postgres:18-alpine`。
- `docs/chapters/stage-02-go-backend/13-redis-cache.md:370`：Redis 镜像使用阿里云地址，建议改为或补充 `docker.1ms.run/redis:8.2-alpine`。
- `docs/chapters/stage-02-go-backend/13-redis-cache.md`：`docker.1ms.run` 可用但拉取 PostgreSQL/Redis 层较慢，建议教材附录给出镜像预拉取和超时排查命令。
- `docs/chapters/stage-02-go-backend/14-go-production.md:2315` 和 `stage-02-acceptance.md:142`：应更明确提示 bcrypt 哈希包含 `$`，`TODO_AUTH_USERS` 必须用引号保存。
- 文档仓库本地验证：`mkdocs build --strict` 因未安装 `mkdocs` 无法执行。

## 网络/镜像源问题

- `apt-get update && apt-get install -y docker-compose-v2` 通过代理环境执行成功，安装版本为 Docker Compose `2.40.3+ds1-0ubuntu1~24.04.1`。
- Go 依赖下载使用 `GOPROXY=https://goproxy.cn,direct` 并附加代理变量，`go mod tidy` 成功下载 Gin、pgx、go-redis、x/crypto 等依赖。
- Docker Compose 原文镜像为阿里云镜像；本次验证工作区临时改为 `docker.1ms.run/postgres:18-alpine`、`docker.1ms.run/redis:8.2-alpine`。
- `docker.1ms.run` 镜像拉取最终成功，但 PostgreSQL/Redis 层下载耗时数分钟，存在速度不稳定问题。
- 本机 `127.0.0.1` 访问必须显式 `NO_PROXY` 或 `curl --noproxy 127.0.0.1,localhost`，避免代理干扰 API、PostgreSQL、Redis 本地连接。

## 需要修改的课程文档位置

- `docs/chapters/stage-02-go-backend/08-go-engineering-testing.md:312` 至 `837`：给第 8 篇所有应落地代码块补充 `title="..."`，并确保文件路径与目录树一致。
- `docs/chapters/stage-02-go-backend/11-go-concurrency.md:592`：调整 `todo-load`，当 `failed > 0` 时可选择返回非 0，或在文档中明确验收必须检查 `failed=0`。
- `docs/chapters/stage-02-go-backend/12-database.md:355`：把 PostgreSQL 镜像源说明调整为优先 `docker.1ms.run`，或提供镜像替换命令。
- `docs/chapters/stage-02-go-backend/13-redis-cache.md:370`：把 Redis 镜像源说明调整为优先 `docker.1ms.run`，或提供镜像替换命令。
- `docs/chapters/stage-02-go-backend/14-go-production.md:2315` 和 `docs/chapters/stage-02-go-backend/stage-02-acceptance.md:142`：补充 `TODO_AUTH_USERS` 引号要求和 `config-check` 失败示例。
- `docs/chapters/stage-02-go-backend/stage-02-acceptance.md:87`：补充“如果从阶段一继续验证，需先确认项目仓库已包含阶段二最终代码或切换到配套代码分支”。

## 需要实机复测的命令

```bash
docker compose ps
docker compose exec postgres pg_isready -U todo -d todo_platform
docker compose exec redis redis-cli -a todo_redis_password ping
```

```bash
export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
export TODO_TEST_DATABASE_DSN="$TODO_DATABASE_DSN"
export TODO_ALLOW_DATABASE_RESET=true
export TODO_REDIS_ADDR='127.0.0.1:6379'
export TODO_REDIS_PASSWORD='todo_redis_password'
go test ./...
```

```bash
HASH=$(TODO_CONFIG_DIR=configs TODO_ENV=dev go run ./api/cmd/todo-api hash-password 'change-me-123')
export TODO_CONFIG_DIR=configs
export TODO_ENV=dev
export TODO_JWT_SECRET=0123456789abcdef0123456789abcdef
export TODO_AUTH_USERS="admin=$HASH"
export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
export TODO_REDIS_ADDR='127.0.0.1:6379'
export TODO_REDIS_PASSWORD='todo_redis_password'
go run ./api/cmd/todo-api serve
```

```bash
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/healthz
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/api/v2/todos
TOKEN=$(curl --noproxy 127.0.0.1,localhost -s -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me-123"}' \
  http://127.0.0.1:18080/api/v2/auth/login | jq -r '.data.token')
curl --noproxy 127.0.0.1,localhost -i -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"stage 02 acceptance"}' \
  http://127.0.0.1:18080/api/v2/todos
```

## 可加入教材附录的命令清单

详见 `validation-notes/stage-02-command-appendix.md`。

## 验证后环境状态

- `kind get clusters`：保留 `todo-dev`，节点 `todo-dev-control-plane` 为 Ready。
- `docker compose ps`：保留 `todo-postgres` 和 `todo-redis`，均为 healthy。
- Docker 镜像：本地存在 `docker.1ms.run/postgres:18-alpine`、`docker.1ms.run/redis:8.2-alpine`。
- API 进程：阶段 smoke test 后已停止，避免占用 `127.0.0.1:18080`。
- 数据卷：`cloud-native-todo-platform-stage02_todo-postgres-data`、`cloud-native-todo-platform-stage02_todo-redis-data` 已保留。

## 环境保留策略

- 后续阶段验证继续复用阶段一 kind 集群和阶段二 PostgreSQL/Redis 容器。
- 阶段结束时只记录环境状态，不执行 `docker compose down`、`docker compose down -v`、`kind delete cluster`。
- 只有当残留环境阻塞下一阶段、冲突端口、或收到明确清理要求时，才执行销毁或回收。

## 文档仓库验证

- `git diff --check`：通过。
- `mkdocs build --strict`：失败，`mkdocs: command not found`。
