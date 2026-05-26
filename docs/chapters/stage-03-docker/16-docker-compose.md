# 第 16 篇：Docker Compose 本地编排

第 14 篇我们用多条 `docker run` 命令启动 PostgreSQL、Redis 和 Todo API。第 15 篇我们为 Todo API 构建了自己的镜像。到了真实团队里，如果每个新人都手动敲十几条命令，很快就会出现端口不一致、密码不一致、网络名不一致、数据卷丢失、启动顺序混乱等问题。

Docker Compose 解决的就是这个问题：把一个应用的多个容器、网络、数据卷、环境变量和依赖关系写进一个 `compose.yaml` 文件，然后用一条命令启动完整本地环境。

本篇特色项目是：**一条命令启动 Todo 平台完整本地环境**。

## 1. 本章学习目标

学完本篇后，你应该能够：

- 理解 Docker Compose 的服务、网络、数据卷和项目模型。
- 能编写现代 `compose.yaml`，定义 Todo API、PostgreSQL、Redis 和迁移任务。
- 能使用 `.env` 管理本地开发环境变量，并理解 Compose 插值和容器环境变量的区别。
- 能使用 `healthcheck` 和 `depends_on.condition` 控制基础启动顺序。
- 能用 `docker compose up`、`down`、`ps`、`logs`、`exec`、`run`、`config` 管理多服务环境。
- 能处理端口冲突、数据库未就绪、Redis 密码错误、环境变量未生效、数据卷残留等常见问题。
- 能把第 15 篇构建出的 Todo API 镜像放入本地多容器开发工作流。

本篇完成后，你会得到一套本地开发编排文件：

```text
cloud-native-todo-platform/
├── Dockerfile
├── compose.yaml
├── .env.example
└── .env
```

最终可以用：

```bash
docker compose up -d --build
```

启动：

```text
Todo API      -> http://127.0.0.1:8080
PostgreSQL    -> postgres:5432
Redis         -> redis:6379
Migration Job -> 启动前自动执行
```

## 2. 本章工作场景

真实公司里，一个后端服务很少单独运行。Todo API 需要 PostgreSQL 保存数据，需要 Redis 做缓存、限流和异步任务，还需要迁移脚本初始化数据库结构。如果只靠手动命令，团队会遇到这些问题：

- 新人入职后花半天配置本地环境。
- 开发、测试、CI 使用不同启动命令，问题难以复现。
- 数据库和 Redis 容器名不统一，服务连接失败。
- 数据库还没 ready，API 就启动并退出。
- 环境变量散落在命令行、README 和个人笔记里。
- 端口冲突后不知道该改哪里。
- 删除容器后数据还在，导致测试结果被旧数据污染。

Compose 把这些规则固化成团队约定：

```text
docker compose up -d --build   # 启动完整开发环境
docker compose logs -f api     # 看 API 日志
docker compose down            # 停止并删除容器和网络
docker compose down -v         # 连数据卷一起删除
```

在真实团队中，Compose 常用于：

- 本地开发环境。
- 联调环境。
- 自动化测试前置依赖。
- Demo 环境。
- 新人 onboarding。
- 轻量级服务复现和排障。

它不是 Kubernetes 的替代品，但它能在进入 Kubernetes 之前，帮助你把“一个服务依赖哪些东西、如何配置、如何启动、如何验证”梳理清楚。

## 3. 前置知识

必须掌握：

- 第 14 篇 Docker 容器、网络、数据卷、端口映射。
- 第 15 篇 Dockerfile、多阶段构建、Todo API 镜像。
- 第 11 篇 PostgreSQL DSN 和数据库迁移。
- 第 12 篇 Redis 连接和密码。
- 第 13 篇 Todo API 的 `serve`、`migrate`、`config-check`、`hash-password` 命令。

建议了解：

- YAML 基本语法。
- `.env` 文件的 key-value 格式。
- HTTP 健康检查 `/healthz` 和 `/readyz` 的区别。
- 本地端口冲突的基本排查方法。

本篇实验需要：

| 工具 | 要求 | 说明 |
|---|---|---|
| Docker | Docker Desktop 或 Docker Engine | 需要包含 Compose v2 插件 |
| Docker Compose | 建议 v2.20 或更新版本 | 使用空格形式 `docker compose`，不是老的 `docker-compose` |
| Todo Platform 代码 | 已完成第 15 篇 | 需要 `Dockerfile`、`configs`、`migrations` |
| curl | 必需 | 验证 API |
| jq | 可选 | Linux / macOS / WSL2 下解析登录 token |

!!! note "关于 Compose 版本"
    本篇使用现代 Compose Specification 写法，文件名使用 `compose.yaml`，不再写老式顶层 `version: "3"`。示例中会用到 `depends_on.condition`、`service_healthy` 和 `service_completed_successfully`。如果你的环境只支持 `docker-compose` 命令，或者这些字段不生效，建议升级 Docker Desktop 或 Docker Compose v2 插件。

## 4. 核心概念

### 4.1 Compose 是什么

Docker Compose 是本地多容器应用编排工具。它用一个 YAML 文件描述多个容器如何一起运行。

一个最小示例：

```yaml title="compose.yaml"
services:
  hello:
    image: alpine:3.20
    command: ["echo", "hello compose"]
```

运行：

```bash
docker compose up
```

Compose 的价值不是“少敲几条命令”，而是把多容器开发环境变成可以版本管理、可以审查、可以复现的工程资产。

### 4.2 service

`services` 是 Compose 文件的核心。每个 service 描述一个长期运行的组件或一次性任务。

Todo 平台会有四个服务：

| service | 类型 | 作用 |
|---|---|---|
| `postgres` | 长期运行 | 保存 Todo 数据 |
| `redis` | 长期运行 | 缓存、限流、异步任务 |
| `migrate` | 一次性任务 | 执行数据库迁移 |
| `api` | 长期运行 | 提供 Todo HTTP API |

一个 service 最终会变成一个或多个容器。默认情况下，本篇每个 service 只运行一个容器。

### 4.3 network

Compose 会为项目创建默认网络，同一个 Compose 项目里的服务可以通过服务名互相访问。

例如 Todo API 容器访问 PostgreSQL，不需要写宿主机 IP，而是写：

```text
postgres://todo:todo_password@postgres:5432/todo_platform?sslmode=disable
```

这里的 `postgres` 就是 service 名。Redis 也是同理：

```text
redis:6379
```

这比使用容器 IP 更稳定，因为容器重建后 IP 可能变化，但服务名不变。

### 4.4 volume

容器删除后，容器内部文件系统也会消失。数据库数据不能只放在容器层里，因此需要数据卷。

本篇会定义：

```yaml
volumes:
  postgres-data:
  redis-data:
```

然后挂载到：

```yaml
postgres:
  volumes:
    - postgres-data:/var/lib/postgresql/data

redis:
  volumes:
    - redis-data:/data
```

这样执行 `docker compose down` 后，数据卷仍然保留。只有执行 `docker compose down -v` 才会删除数据卷。

### 4.5 environment 与 .env

Compose 中有两个容易混淆的概念：

| 概念 | 作用 | 是否自动进入容器 |
|---|---|---|
| `.env` | 给 Compose 文件做变量插值 | 不一定 |
| `environment` | 设置容器内部环境变量 | 是 |

例如：

```env title=".env"
TODO_API_PORT=8080
```

```yaml title="compose.yaml"
services:
  api:
    ports:
      - "127.0.0.1:${TODO_API_PORT:-8080}:8080"
```

这里 `.env` 中的 `TODO_API_PORT` 会在 Compose 解析 YAML 时替换进去。它本身不代表容器里一定存在 `TODO_API_PORT`。

如果要传给容器，需要写：

```yaml
environment:
  TODO_ENV: dev
```

本篇会同时使用 `.env` 和 `environment`，并解释每个变量为什么存在。

### 4.6 depends_on 与 healthcheck

`depends_on` 可以描述服务启动顺序。最简单写法只能保证“先创建依赖容器”，不能保证依赖已经可用。

数据库这类服务需要健康检查：

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U \"$${POSTGRES_USER}\" -d \"$${POSTGRES_DB}\""]
```

然后 API 或迁移任务可以等待 PostgreSQL 变为 healthy：

```yaml
depends_on:
  postgres:
    condition: service_healthy
```

这不等于完美解决所有启动顺序问题。真实系统仍然需要应用具备重试能力。但对本地开发来说，它能减少“数据库还没起来，应用先失败”的常见问题。

### 4.7 docker compose run 与 exec

这两个命令常被混淆：

| 命令 | 作用 | 使用场景 |
|---|---|---|
| `docker compose exec api sh` | 进入已经运行的服务容器 | 查看运行中服务 |
| `docker compose run --rm api config-check` | 基于 service 配置启动一个临时容器 | 执行一次性命令 |

本篇 Todo API 使用 distroless 镜像，没有 shell，所以不能 `exec api sh`。这正是第 15 篇讲过的安全取舍。我们会用 `logs`、`ps`、`run`、`exec postgres`、`exec redis` 来排查。

## 5. 原理深入

### 5.1 Compose 应用模型

Compose 把一个应用抽象成项目。项目里包含服务、网络、数据卷、配置和密钥。

```mermaid
flowchart TB
    Project["Compose Project<br/>cloud-native-todo-platform"] --> Services["services"]
    Project --> Networks["networks"]
    Project --> Volumes["volumes"]

    Services --> API["api"]
    Services --> Migrate["migrate"]
    Services --> Postgres["postgres"]
    Services --> Redis["redis"]

    Networks --> Backend["todo-backend"]
    Volumes --> PGData["postgres-data"]
    Volumes --> RedisData["redis-data"]

    API --> Backend
    Migrate --> Backend
    Postgres --> Backend
    Redis --> Backend

    Postgres --> PGData
    Redis --> RedisData
```

Compose 会根据项目名给资源打标签，例如：

```text
com.docker.compose.project=cloud-native-todo-platform
```

这让 `docker compose down` 能准确删除当前项目创建的容器和网络，而不影响其他项目。

### 5.2 docker compose up 做了什么

执行：

```bash
docker compose up -d --build
```

大致流程是：

```mermaid
flowchart LR
    A["读取 compose.yaml"] --> B["读取 .env 并做变量插值"]
    B --> C["校验并生成最终配置"]
    C --> D["构建或拉取镜像"]
    D --> E["创建网络和数据卷"]
    E --> F["按依赖顺序创建容器"]
    F --> G["执行 healthcheck"]
    G --> H["启动 migrate 一次性任务"]
    H --> I["启动 api 服务"]
```

关键点：

- `--build` 会在启动前构建本地镜像。
- `-d` 表示后台运行。
- Compose 会自动创建网络和数据卷。
- `depends_on.condition: service_healthy` 会等待依赖服务健康。
- `migrate` 是一次性任务，成功退出后 `api` 才启动。

### 5.3 Compose 和 Dockerfile 的关系

Dockerfile 解决“如何构建一个镜像”。Compose 解决“如何把多个镜像一起运行”。

本篇 `api` 和 `migrate` 都会使用第 15 篇的 Dockerfile：

```yaml
build:
  context: .
  dockerfile: Dockerfile
image: todo-api:${TODO_IMAGE_TAG:-v0.1.0}
```

这表示：

- 从当前目录构建镜像。
- 使用 `Dockerfile`。
- 构建结果命名为 `todo-api:v0.1.0`。
- `api` 和 `migrate` 复用同一个镜像，只是 `command` 不同。

### 5.4 为什么需要 migrate 服务

真实部署中，数据库迁移不应该混在 API 多副本启动里随便执行。否则两个 API 副本同时启动时，可能同时执行迁移。

本地 Compose 中，我们把迁移设计成独立一次性服务：

```yaml
migrate:
  command: ["migrate"]
  restart: "no"
  depends_on:
    postgres:
      condition: service_healthy
```

API 等待迁移成功：

```yaml
api:
  depends_on:
    migrate:
      condition: service_completed_successfully
```

这比在 `api` 容器启动命令里写 `migrate && serve` 更清晰，也更接近后续 Kubernetes 中使用 Job 执行迁移的思路。

数据库迁移本质上只依赖 PostgreSQL。本篇后面的完整环境会同时启动 Redis，是为了让 API 启动前依赖都已经就绪；但 `migrate` 服务本身不需要等待 Redis。

### 5.5 启动顺序不等于应用可用性

Compose 可以等待 PostgreSQL healthy，但它不能替你解决所有运行时问题：

- 数据库启动后仍可能执行慢查询。
- Redis 可能运行中断开。
- 网络可能短暂抖动。
- 迁移可能因为 SQL 版本不兼容失败。
- API 仍然应该在代码中处理连接错误、重试和超时。

所以 Compose 适合本地开发编排，不应该被误解为生产级高可用平台。后续 Kubernetes 会继续学习健康检查、重启、自愈、滚动发布和配置管理。

## 6. 手把手实验

### 6.1 实验目标

本实验会完成：

- 创建 `.env.example`。
- 创建本地 `.env`。
- 编写完整 `compose.yaml`。
- 一条命令构建并启动 Todo API、PostgreSQL、Redis 和迁移任务。
- 验证服务状态、健康检查、日志和接口调用。
- 使用 Compose 管理本地开发、测试、调试工作流。
- 处理常见启动顺序、配置、端口和数据卷问题。
- 清理容器、网络和数据卷。

### 6.2 实验环境

请在 Todo Platform 应用仓库根目录执行命令。目录应该类似：

```text
cloud-native-todo-platform/
├── Dockerfile
├── cmd/todo-api/
├── configs/
├── migrations/
├── go.mod
└── go.sum
```

验证当前目录：

=== "Linux / macOS / WSL2"

    ```bash
    pwd
    test -f Dockerfile && test -d cmd/todo-api && test -d configs && test -d migrations && echo "project root ok"
    ```

=== "Windows PowerShell"

    ```powershell
    Get-Location
    if ((Test-Path Dockerfile) -and (Test-Path cmd/todo-api) -and (Test-Path configs) -and (Test-Path migrations)) {
      "project root ok"
    }
    ```

检查 Compose：

```bash
docker compose version
```

如果提示找不到 `docker compose`，请升级 Docker Desktop 或安装 Docker Compose v2 插件。本篇不使用老命令 `docker-compose`。

### 6.3 本篇新增文件

完成后，Todo Platform 应用仓库会新增：

```text
cloud-native-todo-platform/
├── compose.yaml
└── .env.example
```

本地实验还会创建：

```text
cloud-native-todo-platform/
└── .env
```

`.env` 通常不提交到 Git，因为里面可能包含本地密码、JWT Secret、端口和个人配置。`.env.example` 应该提交，用来告诉团队需要哪些变量。

### 6.4 编写 `.env.example`

在项目根目录创建 `.env.example`：

```dotenv title=".env.example"
# Compose project
COMPOSE_PROJECT_NAME=cloud-native-todo-platform

# Image
TODO_IMAGE_TAG=v0.1.0

# API
TODO_API_BIND=127.0.0.1
TODO_API_PORT=8080
TODO_ENV=dev
TODO_JWT_SECRET=0123456789abcdef0123456789abcdef

# 先留空，后面用 hash-password 生成后再填入。
# 注意：Argon2id 哈希包含 $，建议使用单引号包裹完整值。
TODO_AUTH_USERS=

# PostgreSQL
POSTGRES_USER=todo
POSTGRES_PASSWORD=todo_password
POSTGRES_DB=todo_platform
POSTGRES_PORT=5432

# Redis
REDIS_PASSWORD=todo_redis_password
REDIS_PORT=6379
```

关键解释：

| 变量 | 作用 |
|---|---|
| `COMPOSE_PROJECT_NAME` | 固定 Compose 项目名，避免目录名变化导致资源名变化 |
| `TODO_IMAGE_TAG` | 控制 Todo API 镜像标签 |
| `TODO_API_BIND` | API 只绑定本机地址，避免局域网直接访问 |
| `TODO_API_PORT` | 宿主机访问 API 的端口 |
| `TODO_AUTH_USERS` | 登录用户和密码哈希，格式为 `admin=<hash>` |
| `POSTGRES_*` | 初始化 PostgreSQL |
| `REDIS_PASSWORD` | Redis 本地密码 |

创建本地 `.env`：

=== "Linux / macOS / WSL2"

    ```bash
    cp .env.example .env
    ```

=== "Windows PowerShell"

    ```powershell
    Copy-Item .env.example .env
    ```

### 6.5 编写 `compose.yaml`

在项目根目录创建 `compose.yaml`：

```yaml title="compose.yaml"
name: ${COMPOSE_PROJECT_NAME:-cloud-native-todo-platform}

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-todo}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-todo_password}
      POSTGRES_DB: ${POSTGRES_DB:-todo_platform}
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$${POSTGRES_USER}\" -d \"$${POSTGRES_DB}\""]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s
    networks:
      - todo-backend

  redis:
    image: redis:7
    command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD:-todo_redis_password}"]
    ports:
      - "127.0.0.1:${REDIS_PORT:-6379}:6379"
    volumes:
      - redis-data:/data
    environment:
      REDIS_PASSWORD: ${REDIS_PASSWORD:-todo_redis_password}
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a \"$${REDIS_PASSWORD}\" ping"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 5s
    networks:
      - todo-backend

  migrate:
    build:
      context: .
      dockerfile: Dockerfile
    image: todo-api:${TODO_IMAGE_TAG:-v0.1.0}
    command: ["migrate"]
    restart: "no"
    environment:
      TODO_CONFIG_DIR: /app/configs
      TODO_ENV: ${TODO_ENV:-dev}
      TODO_DATABASE_DSN: postgres://${POSTGRES_USER:-todo}:${POSTGRES_PASSWORD:-todo_password}@postgres:5432/${POSTGRES_DB:-todo_platform}?sslmode=disable
      TODO_REDIS_ADDR: redis:6379
      TODO_REDIS_PASSWORD: ${REDIS_PASSWORD:-todo_redis_password}
      TODO_JWT_SECRET: ${TODO_JWT_SECRET:-0123456789abcdef0123456789abcdef}
      TODO_AUTH_USERS: ${TODO_AUTH_USERS:-}
      TODO_MIGRATIONS_DIR: /app/migrations
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - todo-backend

  api:
    build:
      context: .
      dockerfile: Dockerfile
    image: todo-api:${TODO_IMAGE_TAG:-v0.1.0}
    command: ["serve"]
    environment:
      TODO_CONFIG_DIR: /app/configs
      TODO_ENV: ${TODO_ENV:-dev}
      TODO_HTTP_ADDR: 0.0.0.0:8080
      TODO_DATABASE_DSN: postgres://${POSTGRES_USER:-todo}:${POSTGRES_PASSWORD:-todo_password}@postgres:5432/${POSTGRES_DB:-todo_platform}?sslmode=disable
      TODO_REDIS_ADDR: redis:6379
      TODO_REDIS_PASSWORD: ${REDIS_PASSWORD:-todo_redis_password}
      TODO_JWT_SECRET: ${TODO_JWT_SECRET:-0123456789abcdef0123456789abcdef}
      TODO_AUTH_USERS: ${TODO_AUTH_USERS:-}
      TODO_MIGRATIONS_DIR: /app/migrations
    ports:
      - "${TODO_API_BIND:-127.0.0.1}:${TODO_API_PORT:-8080}:8080"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    networks:
      - todo-backend

volumes:
  postgres-data:
  redis-data:

networks:
  todo-backend:
    driver: bridge
```

这个文件没有顶层 `version`。现代 Compose Specification 已经不需要它。保留 `version: "3"` 通常只是老教程习惯，不再建议新项目继续依赖。

### 6.6 Compose 文件字段详解

| 字段 | 本篇用法 | 作用 |
|---|---|---|
| `name` | 固定项目名 | 让容器、网络、数据卷名称稳定 |
| `services` | 定义 4 个服务 | 描述应用由哪些容器组成 |
| `image` | `postgres:16`、`redis:7`、`todo-api:v0.1.0` | 指定镜像 |
| `build` | `context: .`、`dockerfile: Dockerfile` | 使用第 15 篇 Dockerfile 构建 Todo API |
| `command` | `migrate`、`serve` | 覆盖镜像默认命令 |
| `environment` | 注入 Todo API 配置 | 设置容器内部环境变量 |
| `ports` | `127.0.0.1:8080:8080` | 把容器端口映射到宿主机 |
| `volumes` | `postgres-data`、`redis-data` | 持久化数据库和 Redis 数据 |
| `healthcheck` | `pg_isready`、`redis-cli ping` | 判断依赖服务是否 ready |
| `depends_on` | API 等待依赖和迁移 | 控制本地启动顺序 |
| `networks` | `todo-backend` | 给服务提供内部通信网络 |

注意 `redis` 的命令：

```yaml
command: ["redis-server", "--appendonly", "yes", "--requirepass", "${REDIS_PASSWORD:-todo_redis_password}"]
```

这里同时做了两件事：

- `--appendonly yes`：启用 AOF 持久化，更接近真实开发环境。
- `--requirepass`：设置 Redis 密码，让本地环境不要养成无密码访问习惯。

### 6.7 生成本地登录密码哈希

Todo API 的 `TODO_AUTH_USERS` 需要密码哈希。先构建 API 镜像并执行 `hash-password`：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose build api
    docker compose run --rm --no-deps api hash-password "change-me-123"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose build api
    docker compose run --rm --no-deps api hash-password "change-me-123"
    ```

把输出写入 `.env` 的 `TODO_AUTH_USERS`。

示例格式：

```dotenv
TODO_AUTH_USERS='admin=$argon2id$v=19$m=65536,t=3,p=2$...'
```

这里必须特别注意：Argon2id 哈希包含 `$`。在 `.env` 中建议使用单引号包住完整值，避免 Compose 把 `$argon2id`、`$v` 等片段当成变量插值。

错误示例：

```dotenv
TODO_AUTH_USERS=admin=$argon2id$v=19$m=65536,t=3,p=2$...
```

正确示例：

```dotenv
TODO_AUTH_USERS='admin=$argon2id$v=19$m=65536,t=3,p=2$...'
```

确认 Compose 能解析配置：

```bash
docker compose config
```

如果 `.env` 格式错误，这一步会先暴露问题，比直接 `up` 后再排查更清楚。

建议同时在 `.gitignore` 中确认以下规则存在：

```gitignore title=".gitignore"
.env
compose.override.yaml
```

`.env.example` 应该提交，`.env` 和个人调试用的 `compose.override.yaml` 不应该提交。

### 6.8 一条命令启动完整环境

执行：

```bash
docker compose up -d --build
```

这条命令会：

- 构建 Todo API 镜像。
- 启动 PostgreSQL。
- 启动 Redis。
- 等待 PostgreSQL 健康后执行 `migrate` 服务。
- 等待 Redis 健康。
- 等待迁移成功。
- 启动 `api` 服务。

查看服务状态：

```bash
docker compose ps
```

预期能看到：

```text
NAME                                      SERVICE    STATUS
cloud-native-todo-platform-postgres-1     postgres   Up ... (healthy)
cloud-native-todo-platform-redis-1        redis      Up ... (healthy)
cloud-native-todo-platform-migrate-1      migrate    Exited (0)
cloud-native-todo-platform-api-1          api        Up ...
```

`migrate` 显示 `Exited (0)` 是正常的。它是一次性任务，成功执行完数据库迁移后就应该退出。

### 6.9 验证 API

查看 API 日志：

```bash
docker compose logs --tail 80 api
```

验证健康接口：

=== "Linux / macOS / WSL2"

    ```bash
    curl -i http://127.0.0.1:8080/healthz
    ```

=== "Windows PowerShell"

    ```powershell
    curl.exe -i http://127.0.0.1:8080/healthz
    ```

预期响应包含：

```text
HTTP/1.1 200 OK
```

验证登录和创建 Todo：

=== "Linux / macOS / WSL2"

    ```bash
    TOKEN=$(curl -s -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:8080/api/v1/auth/login | jq -r '.data.token')

    curl -s -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"title":"run todo platform with compose"}' \
      http://127.0.0.1:8080/api/v1/todos
    ```

=== "Windows PowerShell"

    ```powershell
    $login = curl.exe -s -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"change-me-123\"}" http://127.0.0.1:8080/api/v1/auth/login | ConvertFrom-Json
    $token = $login.data.token
    curl.exe -s -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"title\":\"run todo platform with compose\"}" http://127.0.0.1:8080/api/v1/todos
    ```

如果 Linux / macOS / WSL2 没有安装 `jq`，可以先打印登录响应，手动复制 `data.token` 字段。

### 6.10 查看数据库和 Redis

进入 PostgreSQL：

```bash
docker compose exec postgres psql -U todo -d todo_platform
```

在 `psql` 中执行：

```sql
\dt
SELECT id, title, completed FROM todos ORDER BY id DESC LIMIT 5;
\q
```

进入 Redis：

```bash
docker compose exec redis redis-cli -a todo_redis_password
```

在 `redis-cli` 中执行：

```text
PING
KEYS *
QUIT
```

`KEYS *` 在生产 Redis 中不建议随意使用，因为可能阻塞实例。本地学习环境可以用来观察缓存 key，生产应使用 `SCAN`。

### 6.11 本地开发工作流

常见开发命令：

```bash
docker compose up -d --build
docker compose logs -f api
docker compose ps
docker compose restart api
docker compose down
```

修改 Go 代码后，如果 Dockerfile 会重新编译应用，执行：

```bash
docker compose up -d --build api
```

如果怀疑 Docker 构建缓存导致旧代码仍然被使用，可以强制无缓存重建：

```bash
docker compose build --no-cache api
docker compose up -d api
```

如果修改了 `.env`，例如端口、Redis 密码、JWT Secret 或 `TODO_AUTH_USERS`，建议强制重建容器，让环境变量重新注入：

```bash
docker compose up -d --force-recreate
```

如果只想更新远程基础镜像或依赖镜像，例如 `postgres:16`、`redis:7`：

```bash
docker compose pull
docker compose up -d
```

只执行配置检查：

```bash
docker compose run --rm --no-deps api config-check
```

只重新执行迁移：

```bash
docker compose logs migrate
docker compose run --rm migrate
```

查看最终解析后的 Compose 配置：

```bash
docker compose config
```

查看插值时使用的环境变量：

```bash
docker compose config --environment
```

这两个命令非常适合排查 `.env` 没生效、变量被 shell 覆盖、端口不符合预期等问题。

### 6.12 使用 override 做本地调试

有时你想临时打开更多日志、换端口、或者只在自己机器上挂载某个目录。不建议直接改团队共享的 `compose.yaml`，可以使用 `compose.override.yaml`。

示例：

```yaml title="compose.override.yaml"
services:
  api:
    environment:
      TODO_LOG_LEVEL: debug
    ports:
      - "127.0.0.1:18080:8080"
```

默认情况下，Docker Compose 会自动读取同目录下的 `compose.yaml` 和 `compose.override.yaml`。如果这是个人临时文件，建议加入 `.gitignore`，避免把个人端口、路径、调试配置提交到仓库。

也可以显式指定多个文件：

```bash
docker compose -f compose.yaml -f compose.override.yaml up -d
```

后面的文件会覆盖或追加前面的配置。这是很多团队区分本地、测试、CI 配置的基础方式。

### 6.13 停止和清理

停止并删除容器和网络，保留数据卷：

```bash
docker compose down
```

连数据卷一起删除：

```bash
docker compose down -v
```

`down -v` 会删除 PostgreSQL 和 Redis 数据。执行后再次 `up`，数据库会重新初始化，迁移任务也会重新创建表。

如果只想停掉服务但保留容器：

```bash
docker compose stop
```

重新启动：

```bash
docker compose start
```

### 6.14 实验验收

执行以下命令：

```bash
docker compose config
docker compose up -d --build
docker compose ps
curl -i http://127.0.0.1:8080/healthz
docker compose logs --tail 80 api
docker compose exec postgres psql -U todo -d todo_platform -c "SELECT COUNT(*) FROM todos;"
docker compose exec redis redis-cli -a todo_redis_password ping
```

验收标准：

- `docker compose config` 能输出完整配置，没有变量缺失错误。
- `postgres` 和 `redis` 状态为 healthy。
- `migrate` 状态为 `Exited (0)`。
- `api` 状态为 running。
- `/healthz` 返回 `200 OK`。
- 能登录并创建 Todo。
- PostgreSQL 中能看到 Todo 数据。
- Redis 能返回 `PONG`。

## 7. 真实工作案例

某团队开发一个订单系统，服务依赖 PostgreSQL、Redis、Kafka 和一个本地模拟支付服务。早期新人需要照着文档执行几十条命令，平均一天才能把本地环境跑起来。后来团队把依赖服务整理成 Compose：

```text
docker compose up -d --build
```

新人只需要准备 Docker Desktop 和仓库代码，就能启动完整开发环境。

团队还规定：

- `.env.example` 记录所有变量。
- `.env` 不提交。
- 所有服务通过 service 名互相访问。
- 依赖服务必须有 healthcheck。
- 数据库迁移使用独立一次性服务。
- CI 使用同一份 Compose 启动测试依赖。
- 排障时优先收集 `docker compose ps`、`logs`、`config` 输出。

职责边界通常是：

| 角色 | 关注点 |
|---|---|
| 后端开发 | API 配置、迁移、日志、调试命令 |
| 测试 | 一键启动环境、重置数据、复现缺陷 |
| DevOps | Compose 和 CI 的衔接、镜像构建、端口和资源规范 |
| SRE | 本地问题和生产问题的边界、依赖健康检查、数据清理 |
| 架构师 | 服务边界、配置分层、向 Kubernetes 迁移的路径 |

本篇 Todo 平台就是这个工作方式的缩小版。

## 8. 常见错误

| 错误现象 | 常见原因 | 修复方向 |
|---|---|---|
| `docker compose` 命令不存在 | 使用老版本 Docker 或只有 `docker-compose` | 升级 Docker Desktop 或安装 Compose v2 |
| `service_completed_successfully` 不生效 | Compose v2 版本过旧 | 升级 Docker Desktop 或 Docker Compose v2 插件 |
| `yaml: did not find expected key` | YAML 缩进错误 | 使用空格缩进，不要混用 Tab |
| `variable is not set` | `.env` 缺少变量，或当前目录不对 | 检查 `.env` 和 `docker compose config` |
| 登录一直 401 | `TODO_AUTH_USERS` 中的 `$` 被插值 | 在 `.env` 中用单引号包住哈希 |
| `api` 不启动 | `migrate` 失败或依赖不 healthy | 查看 `docker compose ps` 和 `docker compose logs migrate` |
| `migrate` 连接数据库失败 | PostgreSQL 还没 ready，或 DSN service 名写错 | 检查 `depends_on`、`pg_isready`、DSN 中的 `postgres` |
| Redis 连接失败 | 密码错误，或地址仍写 `127.0.0.1` | 容器内应访问 `redis:6379` |
| 端口被占用 | 宿主机已有服务占用 8080、5432、6379 | 修改 `.env` 中的端口 |
| 数据删除后又出现 | 数据卷没有删除 | 执行 `docker compose down -v` |
| 修改代码后没有生效 | 镜像没有重新构建 | 执行 `docker compose up -d --build api` |
| 修改 `.env` 后不生效 | 容器仍使用旧环境变量 | 执行 `docker compose up -d --force-recreate` |
| `compose.override.yaml` 被提交 | 没有加入 `.gitignore` | 把个人 override 文件移出提交，保留团队共享 `compose.yaml` |
| `exec api sh` 失败 | Todo API 使用 distroless，无 shell | 用日志、配置检查、临时 debug 镜像排障 |
| Windows 下路径或换行异常 | Git 换行、PowerShell 引号、路径格式差异 | 使用本篇 Windows PowerShell 命令 |

## 9. 排障方法

### 9.1 检查最终配置

```bash
docker compose config
```

重点看：

- `api.environment.TODO_DATABASE_DSN` 是否指向 `postgres:5432`。
- `api.environment.TODO_REDIS_ADDR` 是否是 `redis:6379`。
- `ports` 是否是你期望的宿主机端口。
- `TODO_AUTH_USERS` 是否为空。

如果你怀疑 `.env` 被 shell 环境覆盖，执行：

```bash
docker compose config --environment
```

Compose 插值优先级中，shell 环境变量通常高于 `.env`。如果你的 shell 里已经设置了同名变量，可能覆盖 `.env` 中的值。

### 9.2 检查服务状态

```bash
docker compose ps
```

判断方式：

- `postgres` 应该是 `running` 且 `healthy`。
- `redis` 应该是 `running` 且 `healthy`。
- `migrate` 应该是 `exited` 且退出码为 `0`。
- `api` 应该是 `running`。

如果 `migrate` 是 `Exited (1)`，先看迁移日志。

### 9.3 查看日志

查看所有服务日志：

```bash
docker compose logs --tail 120
```

只看 API：

```bash
docker compose logs -f api
```

只看迁移：

```bash
docker compose logs migrate
```

日志排查顺序建议：

1. 先看 `migrate` 是否成功。
2. 再看 `api` 是否配置错误。
3. 最后看 `postgres`、`redis` 是否健康。

### 9.4 检查健康检查

PostgreSQL：

```bash
docker compose exec postgres pg_isready -U todo -d todo_platform
```

Redis：

```bash
docker compose exec redis redis-cli -a todo_redis_password ping
```

如果命令成功，但 Compose 仍显示 unhealthy，检查 `compose.yaml` 中 healthcheck 的变量是否被正确传入。

### 9.5 单独排查迁移任务

如果 `migrate` 失败，先看日志：

```bash
docker compose logs migrate
```

确认 PostgreSQL 可访问：

```bash
docker compose exec postgres pg_isready -U todo -d todo_platform
```

确认配置展开后的 DSN：

```bash
docker compose config
```

修复配置或 SQL 后，可以单独重跑迁移：

```bash
docker compose run --rm migrate
```

如果迁移失败是因为旧数据卷中已经存在不兼容结构，本地学习环境可以重置数据卷：

```bash
docker compose down -v
docker compose up -d --build
```

生产环境不能用删除数据卷来处理迁移失败，必须通过迁移回滚、备份恢复或人工修复脚本处理。

### 9.6 检查网络解析

Todo API 使用 service 名访问依赖。优先检查 Compose 网络里是否已经挂载了相关容器：

```bash
docker network ls
docker network inspect cloud-native-todo-platform_todo-backend
```

网络里应该能看到 `api`、`postgres`、`redis` 等容器。

再用依赖服务自带工具验证 service 名访问：

```bash
docker compose exec postgres pg_isready -h postgres -U todo -d todo_platform
docker compose exec redis redis-cli -h redis -a todo_redis_password ping
```

如果这里能成功，但 API 仍然连接失败，重点检查 API 的 `TODO_DATABASE_DSN` 和 `TODO_REDIS_ADDR` 是否仍然写成了 `127.0.0.1`。容器内部的 `127.0.0.1` 指向容器自己，不是宿主机，也不是其他服务。

### 9.7 检查端口占用

如果 `api` 端口绑定失败：

=== "Linux / macOS / WSL2"

    ```bash
    ss -lntp | grep ':8080' || true
    ```

=== "Windows PowerShell"

    ```powershell
    netstat -ano | Select-String ":8080"
    ```

临时解决方式是在 `.env` 中修改：

```dotenv
TODO_API_PORT=18080
```

然后重启：

```bash
docker compose up -d
```

访问地址变为：

```text
http://127.0.0.1:18080
```

### 9.8 检查数据卷

查看数据卷：

```bash
docker volume ls | grep cloud-native-todo-platform
```

Windows PowerShell：

```powershell
docker volume ls | Select-String "cloud-native-todo-platform"
```

如果你希望完全重置数据库：

```bash
docker compose down -v
docker compose up -d --build
```

注意：`down -v` 会删除本地数据。真实项目里不要把这类命令用于共享环境或生产环境。

## 10. 生产环境注意事项

### 10.1 Compose 不是 Kubernetes

Compose 很适合本地开发和轻量联调，但它不提供完整的生产调度能力：

- 没有 Kubernetes 那样的声明式滚动发布。
- 没有集群级调度和自愈。
- 没有原生 Service、Ingress、RBAC、NetworkPolicy。
- 多节点部署能力有限。
- Secret 和配置管理能力不如 Kubernetes 完整。

所以本篇不要把 Compose 当成生产平台，而是把它当成“本地环境标准化工具”和“进入 Kubernetes 前的服务关系模型”。

### 10.2 本地密码不等于生产密码

本篇使用：

```text
todo_password
todo_redis_password
0123456789abcdef0123456789abcdef
```

这些只适合本地教学。生产环境必须使用密钥管理系统，例如：

- Kubernetes Secret。
- 云厂商 Secret Manager。
- Vault。
- CI/CD Secret。

不要把真实生产密码写进 `.env.example`、`compose.yaml` 或 Git 仓库。

### 10.3 端口绑定要保守

本篇端口使用：

```yaml
ports:
  - "127.0.0.1:8080:8080"
```

这样 API 只监听本机访问。不要在不需要时写成：

```yaml
ports:
  - "8080:8080"
```

后者可能绑定到所有网卡，在办公室网络或公共 Wi-Fi 下暴露本地服务。

### 10.4 数据卷要有生命周期意识

本地开发中，数据卷既方便又危险：

- 方便：容器重建后数据仍然保留。
- 危险：旧数据可能影响测试结果。

团队应该约定：

- 什么时候用 `docker compose down`。
- 什么时候用 `docker compose down -v`。
- 测试前是否需要重置数据库。
- 本地是否允许使用生产导出的脱敏数据。

### 10.5 健康检查不等于业务正常

PostgreSQL healthy 只表示数据库进程可以响应 `pg_isready`。Redis healthy 只表示能 `PING`。API `/healthz` 通常只表示进程活着。

真实生产还需要：

- `/readyz` 检查依赖是否可用。
- 监控业务错误率。
- 监控数据库连接池。
- 监控 Redis 延迟和连接数。
- 监控迁移任务结果。

### 10.6 Compose 配置要避免漂移

如果每个人都有一份随意修改的 Compose 文件，最终又会回到“本地环境不可复现”的老问题。

建议：

- `compose.yaml` 保持团队共享。
- `.env.example` 记录变量。
- `.env` 只放个人本地值。
- `compose.override.yaml` 用于个人调试，默认不提交。
- CI 中使用显式 Compose 文件和明确变量。

### 10.7 注意本地资源占用

PostgreSQL、Redis 和 API 长期运行会占用 CPU、内存、磁盘和端口。开发结束后建议：

```bash
docker compose stop
```

如果短期不再使用，可以执行：

```bash
docker compose down
```

如果 Docker Desktop 分配资源较少，数据库初始化、镜像构建和测试可能明显变慢。团队文档应说明推荐的 Docker Desktop CPU、内存和磁盘空间配置。

### 10.8 镜像更新要可控

本地环境可以用：

```bash
docker compose pull
docker compose up -d --build
```

更新依赖镜像和应用镜像。但团队不要在毫无记录的情况下随意漂移基础镜像版本。生产相关镜像应固定 tag 或 digest，并通过 CI/CD 扫描、测试和发布记录进入环境。

## 11. 本章小项目

本章小项目是：**一条命令启动 Todo 平台完整本地环境**。

项目成果：

- `compose.yaml`：定义 Todo API、PostgreSQL、Redis、迁移任务。
- `.env.example`：记录本地开发变量模板。
- `.env`：本地实际配置。
- `postgres-data`：PostgreSQL 数据卷。
- `redis-data`：Redis 数据卷。
- `todo-backend`：服务间通信网络。

### 验收命令

```bash
docker compose config
docker compose up -d --build
docker compose ps
curl -i http://127.0.0.1:8080/healthz
docker compose exec postgres psql -U todo -d todo_platform -c "SELECT COUNT(*) FROM todos;"
docker compose exec redis redis-cli -a todo_redis_password ping
docker compose down
```

### 能力验收标准

- 能解释 `services`、`networks`、`volumes` 的作用。
- 能编写完整 `compose.yaml`。
- 能说明 `.env` 和 `environment` 的区别。
- 能用 `docker compose config` 检查最终配置。
- 能用 `depends_on.condition` 和 `healthcheck` 管理基础启动顺序。
- 能一条命令启动 Todo API、PostgreSQL、Redis 和迁移任务。
- 能通过日志、状态、健康检查和数据查询验证环境。
- 能处理端口冲突、数据卷残留、依赖未就绪、密码哈希插值等问题。

## 12. 本章练习题

### 基础题

1. Dockerfile 和 Docker Compose 分别解决什么问题？
2. `services`、`networks`、`volumes` 分别表示什么？
3. `.env` 文件和 `environment` 字段有什么区别？
4. `docker compose up -d --build` 中 `-d` 和 `--build` 分别是什么意思？
5. 为什么 `migrate` 更适合做成一次性 service？

### 实操题

1. 把 API 宿主机端口从 `8080` 改成 `18080`，并验证访问。
2. 执行 `docker compose down` 后重新 `up`，观察数据库数据是否还在。
3. 执行 `docker compose down -v` 后重新 `up`，观察数据库数据是否被清空。
4. 故意把 Redis 密码改错，观察 API 日志和排障过程。
5. 使用 `compose.override.yaml` 把 `TODO_LOG_LEVEL` 改成 `debug`。

### 思考题

1. 为什么 Compose 适合本地开发，但不能完全替代 Kubernetes？
2. 如果迁移任务失败，API 是否应该继续启动？为什么？
3. 本地 `.env` 中哪些值不应该提交到 Git？
4. 为什么容器之间应该使用 service 名，而不是容器 IP？
5. 数据卷残留会给测试带来哪些误导？

## 13. 本章面试题

### 1. Docker Compose 解决什么问题？

参考答案：

Compose 用一个 YAML 文件描述多容器应用的服务、网络、数据卷、环境变量和依赖关系。它让本地开发环境可以一键启动、停止、查看日志和清理，减少手工命令带来的不一致。它常用于本地开发、联调、测试依赖和 Demo 环境。

### 2. Compose 中 service 名有什么作用？

参考答案：

service 名不仅用于 Compose 管理容器，也会成为同一 Compose 网络中的 DNS 名称。比如 API 容器可以通过 `postgres:5432` 访问 PostgreSQL，通过 `redis:6379` 访问 Redis。这样不需要依赖不稳定的容器 IP。

### 3. `.env` 和 `env_file`、`environment` 有什么区别？

参考答案：

`.env` 默认用于 Compose 文件变量插值，例如替换 `${TODO_API_PORT}`。`environment` 用于设置容器内部环境变量。`env_file` 可以把文件中的变量批量传入容器。三者作用不同，不能简单混为一谈。排查时可以使用 `docker compose config` 查看最终配置。

### 4. `depends_on` 能保证数据库完全可用吗？

参考答案：

短语法 `depends_on` 只能保证依赖服务先创建或启动，不保证业务可用。结合 `healthcheck` 和 `condition: service_healthy` 可以等待依赖通过健康检查。但应用仍然应该实现连接重试、超时和错误处理，因为运行中依赖也可能故障。

### 5. 为什么迁移任务应该独立成 service？

参考答案：

迁移是一次性运维任务，不应该和 API 多副本启动混在一起。独立 `migrate` service 可以明确迁移生命周期，成功后退出，API 再启动。后续迁移到 Kubernetes 时，也能自然对应到 Job。

### 6. `docker compose down` 和 `docker compose down -v` 有什么区别？

参考答案：

`docker compose down` 会删除当前项目的容器和网络，但默认保留命名数据卷。`docker compose down -v` 会额外删除数据卷，导致 PostgreSQL、Redis 中的数据被清空。本地重置环境时可以使用，生产或共享环境要非常谨慎。

### 7. Compose 中为什么建议绑定 `127.0.0.1`？

参考答案：

本地开发服务通常只需要本机访问。绑定 `127.0.0.1` 可以避免服务暴露到局域网或公共网络，降低误访问和安全风险。如果写成 `8080:8080`，Docker 可能绑定到所有网卡。

### 8. 如何排查 Compose 环境变量没有生效？

参考答案：

先执行 `docker compose config` 查看最终配置，再执行 `docker compose config --environment` 查看插值来源。还要检查当前工作目录是否有 `.env`，shell 中是否设置了同名变量，是否使用了 `--env-file`，以及 `.env` 中包含 `$` 的值是否被错误插值。

## 14. 本章总结

本篇把 Todo 平台从“多条 docker run 命令”推进到“本地一键编排环境”：

- 学习了 Compose 的 service、network、volume、project 模型。
- 编写了 `.env.example` 管理本地变量模板。
- 编写了完整 `compose.yaml`。
- 使用 PostgreSQL、Redis healthcheck 管理依赖就绪。
- 使用 `migrate` 一次性服务执行数据库迁移。
- 使用 `api` 服务启动 Todo API。
- 学习了 `up`、`down`、`ps`、`logs`、`exec`、`run`、`config` 等常用命令。
- 训练了端口冲突、变量插值、数据卷残留、依赖未就绪等常见排障能力。

本篇能力直接对应真实团队中的本地开发环境标准化、联调环境搭建和 CI 测试依赖管理。

## 15. 下一章衔接

下一篇会进入 **容器运行原理**。

第 14 篇学习了 Docker 基础命令，第 15 篇学习了镜像构建，第 16 篇学习了多容器本地编排。现在你已经能把 Todo 平台用容器跑起来，接下来需要理解容器为什么能隔离进程、文件系统、网络和资源。

下一篇会继续学习：

- 容器和进程的关系。
- namespace 如何隔离进程、网络、挂载点。
- cgroups 如何限制 CPU 和内存。
- union filesystem 如何支撑镜像层。
- 容器日志、退出码和资源限制背后的机制。

理解这些原理后，再进入 Kubernetes 时，Pod、容器运行时、资源限制、探针和调度会更容易串起来。
