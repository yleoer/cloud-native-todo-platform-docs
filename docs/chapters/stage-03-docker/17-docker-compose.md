# 第 17 篇：Docker Compose 本地编排

第 15 篇中，我们手动执行 `docker network create`、`docker volume create` 和多条 `docker run` 命令，把 PostgreSQL、Redis 和 Todo API 连在一起。第 16 篇中，我们把 Todo API 构建成了可发布的 `todo-api:v0.1.0` 镜像。

到了团队协作场景，如果每个人都靠复制十几条命令启动本地环境，很快会出现端口不同、密码不同、容器名不同、数据卷残留、启动顺序不一致、排障步骤无法复现等问题。Docker Compose 解决的就是这类问题：把一组服务的镜像、环境变量、端口、网络、数据卷、健康检查和依赖关系写成声明式 YAML，让完整本地环境可以被版本管理、被审查、被一条命令启动。

本篇特色项目是：**一条命令启动 Todo Platform 完整本地环境（API + PostgreSQL + Redis + Traefik）**。

## 1. 本章学习目标

### 1.1 知识目标

- 能解释 Docker Compose 的 `services`、`networks`、`volumes`、`environment`、`healthcheck` 和 `depends_on` 分别解决什么问题。
- 能描述 Compose 项目、服务、容器、默认网络、命名数据卷之间的关系。
- 能对比 `.env` 文件变量插值和容器内环境变量的区别。
- 能解释为什么容器之间应该使用服务名 `postgres:5432`、`redis:6379`，而不是宿主机端口或 `127.0.0.1`。
- 能说明 Traefik 在本地 Compose 环境中承担的入口代理职责，以及为什么生产环境不能无脑复用本篇配置。

### 1.2 技能目标

- 能独立编写 `deployments/docker-compose/compose.yaml`，编排 Todo API、PostgreSQL、Redis、迁移任务和 Traefik。
- 能编写 `.env.example`，并生成本地 `.env` 注入端口、数据库密码、Redis 密码、JWT Secret 和管理员密码哈希。
- 能使用 `docker compose config`、`up`、`ps`、`logs`、`exec`、`run`、`restart`、`down` 管理多服务开发环境。
- 能通过 `healthcheck` 和 `depends_on.condition` 处理 PostgreSQL、Redis、迁移任务与 API 的基础启动顺序。
- 能排查 Compose 环境中的端口冲突、服务名错误、环境变量未加载、数据卷残留、Traefik 502 等常见问题。

### 1.3 前置条件

开始本篇前，请确认你已经完成：

- 第 14 篇的 Todo API 生产化命令：`serve`、`config-check`、`hash-password`、`migrate`。
- 第 15 篇的手工 Docker 运行实验，理解容器网络、端口映射和数据卷。
- 第 16 篇的镜像构建实验，并且本地存在 `todo-api:v0.1.0` 镜像。

如果你还没有构建镜像，请在应用仓库根目录先执行：

```bash linenums="0"
docker build -f api/Dockerfile -t todo-api:v0.1.0 .
```

预期能看到本地镜像：

```bash linenums="0"
docker image ls todo-api:v0.1.0
```

```text linenums="0"
REPOSITORY   TAG       IMAGE ID       CREATED          SIZE
todo-api     v0.1.0    ...            ...              ...
```

本篇命令默认在 **Cloud Native Todo Platform 应用仓库根目录** 执行。进入 Compose 目录后会单独说明。

## 2. 本章工作场景与真实案例

### 2.1 技术痛点

一个后端服务很少单独运行。Todo API 需要 PostgreSQL 保存任务数据，需要 Redis 做缓存、限流和异步任务，需要迁移命令初始化表结构，还需要本地入口代理模拟后续 Kubernetes Ingress 的访问方式。如果这些规则只散落在 README、个人脚本和聊天记录里，团队会遇到非常具体的麻烦：

- 新人入职后不知道该先启动数据库还是先启动 API。
- 有人用 `127.0.0.1:5432`，有人用 `todo-postgres:5432`，同一个 Bug 在不同机器上表现不同。
- 数据库容器删除后数据仍然存在，旧数据污染了新实验。
- Redis 密码、JWT Secret、管理员密码哈希在命令行里复制来复制去，容易泄露或写错。
- 测试同学无法复现开发同学的本地环境，只能凭日志猜测。
- 进入 Kubernetes 前，没有一份清晰的服务依赖清单。

Compose 不是把命令变短这么简单。它把“本地环境应该长什么样”变成可审查的工程文件。团队可以在 PR 中讨论端口、服务名、数据卷、健康检查、入口代理和清理策略，而不是在每个人电脑上各自演化一套启动命令。

### 2.2 团队协作场景

在真实团队中，Compose 文件通常由后端开发、平台工程师或 DevOps 共同维护：

- 后端开发负责定义 API 需要的环境变量、迁移命令、健康检查路径和本地调试方式。
- 平台工程师负责审查端口绑定、数据卷命名、入口代理、安全边界和镜像标签策略。
- 测试同学使用同一份 Compose 文件启动联调环境，执行接口测试和回归测试。
- CI 可以复用其中的 PostgreSQL、Redis 等依赖服务，减少“本地能跑，流水线不能跑”的偏差。
- 出问题时，开发和测试可以用同一组 `docker compose logs`、`ps`、`exec` 命令定位，而不是互相猜测容器怎么启动的。

本篇不会把 Compose 当作生产部署方案。生产阶段会进入 Kubernetes、Helm、Kustomize、GitOps 和 CI/CD。但 Compose 是进入这些内容前非常重要的一层：它让你先把服务依赖、配置注入、启动顺序和本地入口代理梳理清楚。

### 2.3 Todo 平台模拟案例

> Todo 平台本地开发需要一条命令启动 API、PostgreSQL、Redis 和入口代理。你需要用 Docker Compose 描述服务依赖、网络、端口、环境变量、健康检查和数据卷。

这个案例用于训练本地编排思维：开发环境应该可重复启动、可检查状态、可清理数据，并能清楚表达服务之间的依赖关系。
## 3. 核心概念

### 3.1 Compose 文件是什么

Docker Compose 文件是一个声明式 YAML，用来描述一组容器服务如何一起运行。它不负责构建业务逻辑，也不替代 Dockerfile。Dockerfile 负责“镜像怎么来”，Compose 负责“这些镜像如何一起跑”。

一个最小 Compose 文件如下：

```yaml linenums="0"
services:
  hello:
    image: registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
    command: ["echo", "hello compose"]
```

运行：

```bash linenums="0"
docker compose up
```

这里的 `hello` 是服务名，`registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23` 是镜像，`command` 是容器启动命令。到了 Todo Platform，本篇会把 `hello` 扩展成 `postgres`、`redis`、`migrate`、`api`、`traefik` 五个服务。

现代 Compose Specification 不再要求写顶层 `version: "3"`。本篇使用 `compose.yaml` 文件名，并使用 Docker Compose v2 的空格命令：

```bash linenums="0"
docker compose version
```

不要使用旧式连字符命令作为默认写法：

```text linenums="0"
docker-compose
```

旧命令在一些机器上仍然存在，但行为和支持字段可能落后，尤其是 `depends_on.condition`、`service_healthy`、`service_completed_successfully` 这类启动顺序能力。

### 3.2 `services`

`services` 是 Compose 文件的核心。每个 service 描述一个组件或一次性任务。服务最终会被 Compose 创建为容器，容器名通常包含项目名、服务名和序号。在 Compose 网络中，服务名也会自动成为 DNS 名称，例如 `api` 可以直接访问 `postgres:5432` 和 `redis:6379`。

表 17-1 Todo Platform Compose 服务设计：

| service | 类型 | 镜像 | 作用 |
|---|---|---|---|
| `postgres` | 长期运行 | `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` | 保存 Todo 数据和迁移状态 |
| `redis` | 长期运行 | `registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine` | 提供缓存、限流和异步任务队列 |
| `migrate` | 一次性任务 | `todo-api:v0.1.0` | 在 API 启动前执行数据库迁移 |
| `api` | 长期运行 | `todo-api:v0.1.0` | 提供 Todo HTTP API |
| `traefik` | 长期运行 | `registry.cn-guangzhou.aliyuncs.com/yleoer/traefik:v3.6` | 本地入口代理，转发请求到 API |

注意 `migrate` 不是长期服务。它执行完成后会退出，状态通常是 `Exited (0)`。这不是错误，而是我们希望看到的结果。

### 3.3 `networks`

Compose 会为项目创建网络。同一网络内的服务可以通过服务名互相访问。你不需要知道 PostgreSQL 容器的 IP，也不应该把容器 IP 写进配置。

本篇 API 访问 PostgreSQL 的 DSN 是：

```text linenums="0"
postgres://todo:todo_password@postgres:5432/todo_platform?sslmode=disable
```

这里的 `postgres` 是 Compose 服务名，`5432` 是 PostgreSQL 容器内部端口。它不是宿主机端口 `15432`。

API 访问 Redis 时使用：

```text linenums="0"
redis:6379
```

这里的 `redis` 同样是服务名，`6379` 是容器内部端口。容器内部的 `127.0.0.1` 永远指向当前容器自己，不会指向另一个服务。

### 3.4 `volumes`

容器可以删除和重建，但数据库数据不能跟着容器一起消失。本篇使用两个命名数据卷：

```yaml linenums="0"
volumes:
  postgres-data:
  redis-data:
```

然后挂载到 PostgreSQL 和 Redis：

```yaml linenums="0"
services:
  postgres:
    volumes:
      - postgres-data:/var/lib/postgresql/data

  redis:
    volumes:
      - redis-data:/data
```

执行 `docker compose down` 会删除容器和网络，但不会删除命名数据卷。执行 `docker compose down -v` 才会删除数据卷。这个差异非常重要：前者适合日常重启环境，后者适合彻底清空实验数据。

### 3.5 `.env` 与 `environment`

Compose 中有两个容易混淆的概念：

表 17-2 `.env` 与 `environment` 对比：

| 写法 | 作用 | 是否自动进入容器 | 示例 |
|---|---|---|---|
| `.env` 文件 | 给 Compose YAML 做变量插值 | 不一定 | `${POSTGRES_PORT:-15432}` |
| `environment` | 设置容器内部环境变量 | 是 | `TODO_ENV: dev` |

例如 `.env` 中有：

```text linenums="0"
POSTGRES_PORT=15432
```

Compose 文件中可以这样使用它：

```yaml linenums="0"
ports:
  - "127.0.0.1:${POSTGRES_PORT:-15432}:5432"
```

这表示宿主机本地 `127.0.0.1:15432` 转发到容器内 `5432`。但这不代表容器内一定存在 `POSTGRES_PORT` 环境变量。如果要让应用容器读取环境变量，需要写在 `environment` 中。

本篇会把本地机密配置放入 `deployments/docker-compose/.env`，并只提交 `.env.example`。真实项目中，`.env` 应进入 `.gitignore`。

### 3.6 `healthcheck` 与 `depends_on`

`depends_on` 表示服务之间有启动依赖，但“容器进程启动”不等于“服务已经可用”。PostgreSQL 进程起来后，还需要几秒钟初始化数据目录、监听端口、接受连接。

因此本篇会为 PostgreSQL 和 Redis 增加健康检查：

```yaml linenums="0"
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
  interval: 5s
  timeout: 3s
  retries: 20
  start_period: 10s
```

然后让 `migrate` 等待 PostgreSQL 健康：

```yaml linenums="0"
depends_on:
  postgres:
    condition: service_healthy
```

再让 `api` 等待迁移任务成功：

```yaml linenums="0"
depends_on:
  migrate:
    condition: service_completed_successfully
```

这不是万能的分布式系统启动编排，但足够解决本地开发环境中最常见的“数据库还没 ready，API 先启动失败”的问题。

### 3.7 Traefik 本地入口代理

Traefik 是一个反向代理和入口网关。本篇用它模拟后续 Kubernetes Ingress 的入口层：

```text linenums="0"
浏览器 / curl
  -> 127.0.0.1:18080
  -> Traefik
  -> api:18080
```

API 容器不直接暴露宿主机端口，而是通过 Traefik 暴露。这样本地开发时就能提前练习“入口代理 -> 服务”的访问模式。后续进入 Kubernetes 后，这个思路会演进为 Ingress Controller、Service 和 Pod。

本篇为了本地教学，会把 Docker socket 以只读方式挂给 Traefik，让 Traefik 自动发现带标签的 `api` 服务。生产环境必须严肃评估 Docker socket 权限风险，不能直接照搬。

## 4. 原理深入

### 4.1 Compose 启动流程

图 17-1 Docker Compose 启动流程：

```mermaid
flowchart TD
    A["读取 compose.yaml"] --> B["读取 .env 并做变量插值"]
    B --> C["解析 services / networks / volumes"]
    C --> D["创建项目网络 todo-net"]
    D --> E["创建命名数据卷 postgres-data / redis-data"]
    E --> F["启动 postgres 和 redis"]
    F --> G["执行 healthcheck"]
    G --> H["postgres / redis healthy"]
    H --> I["运行 migrate 一次性任务"]
    I --> J["migrate Exited (0)"]
    J --> K["启动 api"]
    K --> L["启动 traefik 并发现 api 标签"]
    L --> M["宿主机通过 127.0.0.1:18080 访问 API"]
```

这个流程里最关键的是：Compose 不是简单按 YAML 顺序启动容器，而是根据依赖关系、健康检查和服务状态决定什么时候启动后续服务。

### 4.2 服务发现与容器 DNS

Compose 为项目网络提供内置 DNS。同一个网络中的容器可以解析服务名：

```text linenums="0"
api 容器内：
postgres -> postgres 容器 IP
redis    -> redis 容器 IP
```

这就是为什么 API 的 DSN 使用 `postgres:5432`，而不是 `127.0.0.1:15432`：

```text linenums="0"
宿主机访问 PostgreSQL：
127.0.0.1:15432 -> postgres 容器 5432

API 容器访问 PostgreSQL：
postgres:5432 -> postgres 容器 5432
```

宿主机端口映射只服务于宿主机访问容器。容器之间通信应该走 Compose 网络内的服务名和容器内部端口。

### 4.3 配置注入链路

图 17-2 Compose 配置注入链路：

```mermaid
flowchart LR
    EnvFile[".env 本地文件"] --> Interpolation["Compose 变量插值"]
    Interpolation --> ComposeYaml["compose.yaml"]
    ComposeYaml --> ContainerEnv["容器 environment"]
    ContainerEnv --> AppConfig["Todo API 配置加载"]
    AppConfig --> DB["PostgreSQL DSN"]
    AppConfig --> Redis["Redis 地址和密码"]
    AppConfig --> Auth["JWT Secret 和管理员用户"]
```

这里有一个常见坑：`.env` 文件既可以参与 Compose 插值，也可能通过 `environment` 进入容器，但这两个动作不是一回事。本篇会显式把 Todo API 需要的配置写入 `environment`，让配置来源清晰可查。

### 4.4 一次性迁移任务

数据库迁移不应该和 API 主进程混在一起启动。更稳妥的方式是把迁移作为独立的一次性服务：

```text linenums="0"
postgres healthy
  -> migrate 执行 todo-api migrate
  -> migrate 成功退出
  -> api 启动 serve
```

这样做有三个好处：

- API 容器职责单一，只负责长期运行 HTTP 服务。
- 迁移日志可以单独查看：`docker compose logs migrate`。
- 后续迁移到 Kubernetes 时，可以把这个模型演进为 Job 或 Helm hook。

如果迁移失败，`api` 不应该假装启动成功。Compose 中 `service_completed_successfully` 能让本地环境更早暴露迁移问题。

### 4.5 Traefik 如何发现 API

Traefik 通过 Docker Provider 读取容器标签。API 服务上会有这些标签：

```yaml linenums="0"
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.todo-api.rule=PathPrefix(`/`)"
  - "traefik.http.routers.todo-api.entrypoints=web"
  - "traefik.http.services.todo-api.loadbalancer.server.port=18080"
```

它们的含义是：

- `traefik.enable=true`：允许 Traefik 暴露这个服务。
- `PathPrefix(`/`)`：本地所有路径都转发给 API。
- `entrypoints=web`：使用 Traefik 的 `web` 入口。
- `server.port=18080`：Traefik 访问 API 容器内的 `18080` 端口。

本地实验为了降低访问门槛，使用 `PathPrefix(`/`)`，这样 `http://127.0.0.1:18080/readyz` 和 API 路径都能直接进入 Todo API。真实团队通常会使用 `Host(`todo.localhost`)` 或正式域名作为路由规则，并配合 TLS、认证、限流、访问日志和更严格的路由边界。

## 5. 手把手实验

预计耗时：120 分钟（动手操作约 80 分钟，排障和记录约 40 分钟）。

### 5.1 实验目标

编写 `deployments/docker-compose/compose.yaml` 和 `.env.example`，通过一条 `docker compose up -d` 启动 Todo Platform 的 PostgreSQL、Redis、迁移任务、API 和 Traefik，并完成登录与 Todo 创建验证。

### 5.2 实验环境

表 17-3 实验工具与镜像版本：

| 工具或镜像 | 建议版本 | 用途 |
|---|---|---|
| Docker Engine / Docker Desktop | 29.x | 运行容器 |
| Docker Compose | v2.20 或更新版本 | 本地多服务编排 |
| Todo API 镜像 | `todo-api:v0.1.0` | 第 16 篇构建产物 |
| PostgreSQL | `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` | 业务数据库 |
| Redis | `registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine` | 缓存、限流、异步队列 |
| Traefik | `registry.cn-guangzhou.aliyuncs.com/yleoer/traefik:v3.6` | 本地入口代理 |
| curl | 任意常见版本 | 验证 HTTP API |
| jq | 可选 | Linux / macOS / WSL2 解析登录响应 |

检查版本：

```bash linenums="0"
docker version
docker compose version
docker image inspect todo-api:v0.1.0
```

如果 `todo-api:v0.1.0` 不存在，回到仓库根目录构建：

```bash linenums="0"
docker build -f api/Dockerfile -t todo-api:v0.1.0 .
```

如果你的网络无法拉取 `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine`、`registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine`、`registry.cn-guangzhou.aliyuncs.com/yleoer/traefik:v3.6` 或概念示例中的 `registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23`，先确认 Docker Hub 访问和镜像代理配置。发布课程前应使用以下命令验证标签可拉取：

```bash linenums="0"
docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine
docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/traefik:v3.6
docker manifest inspect registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
```

### 5.3 文件目录结构

本篇会在应用仓库中新增以下文件：

```text linenums="0"
cloud-native-todo-platform/
├── api/
│   ├── Dockerfile
│   └── migrations/
├── configs/
├── deployments/
│   └── docker-compose/
│       ├── .env.example
│       ├── compose.yaml
│       └── README.md
├── .dockerignore
└── .gitignore
```

其中：

- `compose.yaml` 是本地编排主文件。
- `.env.example` 是可提交的配置模板。
- `.env` 是本地真实配置文件，本篇会生成但不提交。
- `README.md` 是本地环境启动、查看日志和清理说明。

如果 `.gitignore` 还没有忽略本地 `.env`，请补充：

```gitignore linenums="0"
deployments/docker-compose/.env
```

### 5.4 执行命令

先按下面内容创建或更新实验文件；保存完成后，再继续执行后续命令。

先创建 Compose 配置目录。Linux / macOS / WSL2：

```bash linenums="0"
mkdir -p deployments/docker-compose
```

Windows PowerShell：

```powershell linenums="0"
New-Item -ItemType Directory -Force deployments\docker-compose
```

在 `deployments/docker-compose/.env.example` 中写入：

```text linenums="0"
COMPOSE_PROJECT_NAME=todo-platform

TODO_API_VERSION=v0.1.0
TODO_HTTP_PORT=18080
TRAEFIK_DASHBOARD_PORT=18090

POSTGRES_USER=todo
POSTGRES_PASSWORD=todo_password
POSTGRES_DB=todo_platform
POSTGRES_PORT=15432

REDIS_PASSWORD=todo_redis_password
REDIS_PORT=16379

TODO_JWT_SECRET=0123456789abcdef0123456789abcdef
```

这些密码和 JWT Secret 只服务于本地实验，不应复用到共享环境或生产环境。这个文件不包含 `TODO_AUTH_USERS`，因为管理员密码哈希应该在本地生成后写入 `.env`，不要把真实用户哈希提交到仓库。

在 `deployments/docker-compose/compose.yaml` 中写入：

```yaml linenums="0"
# 结构：项目名 → API 环境变量锚点 → 5 个服务 → 网络 → 数据卷
name: ${COMPOSE_PROJECT_NAME:-todo-platform}

x-api-environment: &api-environment
  TODO_ENV: "dev"
  TODO_CONFIG_DIR: "/app/configs"
  TODO_API_ADDR: "0.0.0.0:18080"
  TODO_DATABASE_DSN: "postgres://${POSTGRES_USER:-todo}:${POSTGRES_PASSWORD:-todo_password}@postgres:5432/${POSTGRES_DB:-todo_platform}?sslmode=disable"
  TODO_REDIS_ADDR: "redis:6379"
  TODO_REDIS_PASSWORD: "${REDIS_PASSWORD:-todo_redis_password}"
  TODO_JWT_SECRET: "${TODO_JWT_SECRET:-0123456789abcdef0123456789abcdef}"
  TODO_AUTH_USERS: "${TODO_AUTH_USERS:?set TODO_AUTH_USERS in deployments/docker-compose/.env}"

services:
  postgres:
    image: registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
    environment:
      POSTGRES_USER: "${POSTGRES_USER:-todo}"
      POSTGRES_PASSWORD: "${POSTGRES_PASSWORD:-todo_password}"
      POSTGRES_DB: "${POSTGRES_DB:-todo_platform}"
      PGDATA: "/var/lib/postgresql/data/pgdata"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:${POSTGRES_PORT:-15432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 10s
    networks:
      - todo-net

  redis:
    image: registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine
    environment:
      REDIS_PASSWORD: "${REDIS_PASSWORD:-todo_redis_password}"
    command:
      - sh
      - -c
      - redis-server --requirepass "$${REDIS_PASSWORD}" --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "127.0.0.1:${REDIS_PORT:-16379}:6379"
    healthcheck:
      test: ["CMD-SHELL", "redis-cli -a \"$${REDIS_PASSWORD}\" ping | grep PONG"]
      interval: 5s
      timeout: 3s
      retries: 20
      start_period: 5s
    networks:
      - todo-net

  migrate:
    image: todo-api:${TODO_API_VERSION:-v0.1.0}
    command: ["migrate"]
    environment: *api-environment
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"
    networks:
      - todo-net

  api:
    image: todo-api:${TODO_API_VERSION:-v0.1.0}
    command: ["serve"]
    environment: *api-environment
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    healthcheck:
      test: ["CMD", "/app/todo-api", "config-check"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 15s
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.todo-api.rule=PathPrefix(`/`)"
      - "traefik.http.routers.todo-api.entrypoints=web"
      - "traefik.http.services.todo-api.loadbalancer.server.port=18080"
    networks:
      - todo-net

  traefik:
    image: registry.cn-guangzhou.aliyuncs.com/yleoer/traefik:v3.6
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--api.dashboard=true"
      - "--api.insecure=true"
    ports:
      - "127.0.0.1:${TODO_HTTP_PORT:-18080}:80"
      - "127.0.0.1:${TRAEFIK_DASHBOARD_PORT:-18090}:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    depends_on:
      api:
        condition: service_started
    networks:
      - todo-net

networks:
  todo-net:

volumes:
  postgres-data:
  redis-data:
```

关键设计说明：

- 顶层 `name` 固定 Compose 项目名，生成的网络和数据卷会带上 `todo-platform` 前缀。
- `x-api-environment` 是 YAML anchor，用来复用 `migrate` 和 `api` 的环境变量，避免两处配置不一致。
- `TODO_DATABASE_DSN` 使用 `postgres:5432`，这是 Compose 网络内服务名和容器端口。
- `TODO_REDIS_ADDR` 使用 `redis:6379`，不是宿主机 `127.0.0.1:16379`。
- PostgreSQL 和 Redis 的 `ports` 都绑定到 `127.0.0.1`，避免暴露到局域网。
- `migrate` 只等待 PostgreSQL 健康，因为迁移不依赖 Redis。
- `api` 同时等待 PostgreSQL、Redis 健康，并等待 `migrate` 成功完成。
- `api.healthcheck` 使用 `config-check` 做轻量配置检查，不等价于完整业务就绪；真正的依赖可用性仍以后面的 `/readyz` 验证为准。
- `api` 不直接映射宿主机端口，外部请求通过 Traefik 进入。
- Traefik 挂载 Docker socket 是本地教学便利，生产环境必须替换为更安全的入口管理方式。Windows 用户请确认 Docker Desktop 使用 Linux containers / WSL2 后端，否则 `/var/run/docker.sock` 挂载方式可能不可用。

在 `deployments/docker-compose/README.md` 中写入：

```markdown linenums="0"
# Todo Platform Docker Compose

## Start

    docker build -f api/Dockerfile -t todo-api:v0.1.0 .
    cd deployments/docker-compose
    cp .env.example .env
    HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
    printf "\nTODO_AUTH_USERS='admin=%s'\n" "$HASH" >> .env
    docker compose --env-file .env up -d

Windows 用户请参考主文档中的 PowerShell 命令。

## Verify

    docker compose --env-file .env ps
    curl -i http://127.0.0.1:18080/readyz

## Logs

    docker compose --env-file .env logs -f api
    docker compose --env-file .env logs migrate
    docker compose --env-file .env logs traefik

## Stop

    docker compose --env-file .env down

## Reset Data

    docker compose --env-file .env down -v

`down -v` deletes PostgreSQL and Redis volumes. Use it only when you intentionally want a clean local environment.
```

上面这个 README 是项目交付物的一部分，真实团队中它比单独把命令写在课程里更有用。新人只需要进入目录，按 README 启动，就能得到与其他成员一致的本地环境。


以下命令请从应用仓库根目录开始执行。

确认当前目录和镜像：

```bash linenums="0"
test -f go.mod
test -f api/Dockerfile
docker image inspect todo-api:v0.1.0
```

如果镜像不存在，构建镜像：

```bash linenums="0"
docker build -f api/Dockerfile -t todo-api:v0.1.0 .
```

进入 Compose 目录：

```bash linenums="0"
cd deployments/docker-compose
```

Windows PowerShell：

```powershell linenums="0"
Set-Location deployments\docker-compose
```

复制本地 `.env` 并生成管理员密码哈希。Linux / macOS / WSL2：

```bash linenums="0"
cp .env.example .env
HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
printf "\nTODO_AUTH_USERS='admin=%s'\n" "$HASH" >> .env
```

Windows PowerShell：

```powershell linenums="0"
Copy-Item .env.example .env -Force
$hash = docker run --rm todo-api:v0.1.0 hash-password "change-me-123"
Add-Content -Path .env -Value ""
Add-Content -Path .env -Value "TODO_AUTH_USERS='admin=$hash'"
```

这里使用单引号包住 `admin=<hash>`，是为了避免 bcrypt 哈希中的 `$` 被错误解释。`.env` 不要提交到 Git。后面执行 `docker compose config` 时，输出中的 `$` 可能显示为 `$$`，这是 Compose 为了再次渲染配置而做的转义，不代表容器里拿到的哈希损坏。

检查 Compose 解析结果：

```bash linenums="0"
docker compose --env-file .env config
docker compose --env-file .env config --services
```

Compose 默认会自动加载当前目录下的 `.env` 文件。本篇显式使用 `--env-file .env`，是为了让配置来源在命令里一眼可见；如果你确认 `.env` 就在当前 Compose 目录，也可以省略这个参数。

启动完整环境：

```bash linenums="0"
docker compose --env-file .env up -d
```

查看服务状态：

```bash linenums="0"
docker compose --env-file .env ps
docker compose --env-file .env ps -a
```

查看迁移日志：

```bash linenums="0"
docker compose --env-file .env logs migrate
```

验证 PostgreSQL 和 Redis：

```bash linenums="0"
docker compose --env-file .env exec postgres pg_isready -U todo -d todo_platform
docker compose --env-file .env exec redis redis-cli -a todo_redis_password ping
```

验证 API 就绪：

```bash linenums="0"
curl -i http://127.0.0.1:18080/healthz
curl -i http://127.0.0.1:18080/readyz
```

登录并创建 Todo。Linux / macOS / WSL2：

```bash linenums="0"
TOKEN=$(curl -s \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me-123"}' \
  http://127.0.0.1:18080/api/v2/auth/login | jq -r '.data.token')

curl -i \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"compose smoke test"}' \
  http://127.0.0.1:18080/api/v2/todos
```

如果没有 `jq`，可以先观察登录响应，再手动复制 `token` 字段。

Windows PowerShell：

```powershell linenums="0"
$login = curl.exe -s -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"change-me-123\"}" http://127.0.0.1:18080/api/v2/auth/login | ConvertFrom-Json
$token = $login.data.token
curl.exe -i -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"title\":\"compose smoke test\"}" http://127.0.0.1:18080/api/v2/todos
```

查看 API 日志：

```bash linenums="0"
docker compose --env-file .env logs --tail 80 api
```

查看 Traefik Dashboard：

```text linenums="0"
http://127.0.0.1:18090/dashboard/
```

Dashboard 只是本地调试入口，生产环境不能使用 `--api.insecure=true`。

### 5.5 预期输出

`docker compose --env-file .env config --services` 应输出：

```text linenums="0"
postgres
redis
migrate
api
traefik
```

`docker compose --env-file .env ps` 应看到类似结果：

```text linenums="0"
NAME                         IMAGE                 SERVICE    STATUS
todo-platform-postgres-1     registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine    postgres   Up ... (healthy)
todo-platform-redis-1        registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine      redis      Up ... (healthy)
todo-platform-migrate-1      todo-api:v0.1.0       migrate    Exited (0)
todo-platform-api-1          todo-api:v0.1.0       api        Up ... (healthy)
todo-platform-traefik-1      registry.cn-guangzhou.aliyuncs.com/yleoer/traefik:v3.6          traefik    Up ...
```

如果默认 `ps` 没有显示已经退出的 `migrate` 容器，请执行：

```bash linenums="0"
docker compose --env-file .env ps -a
```

迁移日志应出现成功信息，具体文本以你的实现为准：

```text linenums="0"
... migration completed
```

PostgreSQL 健康检查：

```text linenums="0"
/var/run/postgresql:5432 - accepting connections
```

Redis 健康检查：

```text linenums="0"
PONG
```

`curl -i http://127.0.0.1:18080/readyz` 应返回 `200 OK`：

```text linenums="0"
HTTP/1.1 200 OK
Content-Type: application/json
...
```

创建 Todo 成功时，应看到 `201 Created` 或项目实现中约定的成功响应：

```text linenums="0"
HTTP/1.1 201 Created
Content-Type: application/json
...
```

### 5.6 验证方法

#### 5.6.1 最小验证

完成本篇最小验收，需要全部通过：

```bash linenums="0"
docker compose --env-file .env config --services
docker compose --env-file .env ps
docker compose --env-file .env ps -a
curl -i http://127.0.0.1:18080/readyz
docker compose --env-file .env exec postgres pg_isready -U todo -d todo_platform
docker compose --env-file .env exec redis redis-cli -a todo_redis_password ping
docker compose --env-file .env logs migrate
```

判断标准：

- 服务列表包含 `postgres`、`redis`、`migrate`、`api`、`traefik`。
- PostgreSQL 和 Redis 状态为 `healthy`。
- `migrate` 状态为 `Exited (0)`。
- `/readyz` 返回 `200 OK`。
- Redis 返回 `PONG`。
- 迁移日志没有错误。

#### 5.6.2 进阶验证

完成进阶验收，建议继续执行：

```bash linenums="0"
docker compose --env-file .env exec postgres psql -U todo -d todo_platform -c "\dt"
docker compose --env-file .env exec redis redis-cli -a todo_redis_password INFO persistence
docker volume ls --filter name=todo-platform
docker network ls --filter name=todo-platform
docker compose --env-file .env logs --tail 80 api
docker compose --env-file .env config | grep -E "postgres:5432|redis:6379"
```

Windows PowerShell：

```powershell linenums="0"
docker compose --env-file .env exec postgres psql -U todo -d todo_platform -c "\dt"
docker compose --env-file .env exec redis redis-cli -a todo_redis_password INFO persistence
docker volume ls --filter name=todo-platform
docker network ls --filter name=todo-platform
docker compose --env-file .env logs --tail 80 api
docker compose --env-file .env config | Select-String "postgres:5432|redis:6379"
```

如果能看到迁移后的表、数据卷、网络、API 正常日志，并且配置中确实使用 `postgres:5432` 和 `redis:6379`，说明你已经掌握了本地 Compose 多服务编排的核心链路。

### 5.7 清理步骤

日常停止环境但保留数据：

```bash linenums="0"
docker compose --env-file .env down
```

彻底清空实验数据：

```bash linenums="0"
docker compose --env-file .env down -v
```

删除本地 `.env`：

```bash linenums="0"
rm -f .env
```

Windows PowerShell：

```powershell linenums="0"
Remove-Item .env -ErrorAction SilentlyContinue
```

如果你只想重启 API，不要删除数据库和 Redis：

```bash linenums="0"
docker compose --env-file .env restart api
```

如果你修改了 `compose.yaml` 或 `.env`，建议重新创建容器：

```bash linenums="0"
docker compose --env-file .env up -d --force-recreate
```


## 6. 常见错误与排障

### 错误 1：`TODO_AUTH_USERS` 未设置或登录一直 `401 Unauthorized`

- **现象**：

  ```text linenums="0"
  invalid interpolation format for services.api.environment.TODO_AUTH_USERS
  ```

  或者 API 能启动，但登录返回：

  ```text linenums="0"
  HTTP/1.1 401 Unauthorized
  ```

- **原因**：没有把 `TODO_AUTH_USERS` 写入 `.env`；或者 bcrypt 哈希中的 `$` 没有被单引号保护，导致 Compose 插值或 shell 处理后内容发生变化。

- **排查**：

  ```bash linenums="0"
  docker compose --env-file .env config | grep TODO_AUTH_USERS
  docker compose --env-file .env logs --tail 80 api
  ```

  如果输出里 `TODO_AUTH_USERS` 为空，或哈希被截断，说明 `.env` 写法有问题。如果 `docker compose config` 里看到 `$2a$10$...` 被显示成 `$$2a$$10$$...`，这是 Compose 的转义显示，通常不是错误。

- **修复**：

  ```bash linenums="0"
  HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
  printf "\nTODO_AUTH_USERS='admin=%s'\n" "$HASH" >> .env
  docker compose --env-file .env up -d --force-recreate api
  ```

  Windows PowerShell：

  ```powershell linenums="0"
  $hash = docker run --rm todo-api:v0.1.0 hash-password "change-me-123"
  Add-Content -Path .env -Value "TODO_AUTH_USERS='admin=$hash'"
  docker compose --env-file .env up -d --force-recreate api
  ```

- **预防**：`.env.example` 不写真实哈希，只保留生成步骤；`.env` 中的 bcrypt 哈希用单引号包住。

### 错误 2：API 连不上 PostgreSQL 或 Redis

- **现象**：

  ```text linenums="0"
  dial tcp 127.0.0.1:5432: connect: connection refused
  ```

  或：

  ```text linenums="0"
  dial tcp: lookup todo-postgres: no such host
  ```

- **原因**：API 容器内使用了宿主机地址 `127.0.0.1`，或沿用了第 15 篇手工容器名 `todo-postgres`、`todo-redis`。在本篇 Compose 文件中，服务名是 `postgres` 和 `redis`。

- **排查**：

  ```bash linenums="0"
  docker compose --env-file .env config | grep -E "TODO_DATABASE_DSN|TODO_REDIS_ADDR"
  docker compose --env-file .env exec api /app/todo-api config-check
  docker compose --env-file .env ps
  ```

  正确配置应该包含 `postgres:5432` 和 `redis:6379`。

- **修复**：修改 `compose.yaml` 中 API 环境变量：

  ```yaml linenums="0"
  TODO_DATABASE_DSN: "postgres://${POSTGRES_USER:-todo}:${POSTGRES_PASSWORD:-todo_password}@postgres:5432/${POSTGRES_DB:-todo_platform}?sslmode=disable"
  TODO_REDIS_ADDR: "redis:6379"
  ```

  然后重建 API：

  ```bash linenums="0"
  docker compose --env-file .env up -d --force-recreate api
  ```

- **预防**：记住宿主机访问容器使用映射端口，容器访问容器使用服务名和内部端口。

### 错误 3：`migrate` 失败导致 `api` 没有启动

- **现象**：

  ```text linenums="0"
  dependency failed to start: container todo-platform-migrate-1 exited (1)
  ```

  或 `docker compose ps` 中只看到 `migrate` 是 `Exited (1)`。

- **原因**：数据库未健康、DSN 错误、迁移脚本不存在、迁移已经部分执行但状态表不一致，都会导致迁移失败。因为 `api` 依赖 `migrate` 成功完成，所以 API 不会继续启动。

- **排查**：

  ```bash linenums="0"
  docker compose --env-file .env logs migrate
  docker compose --env-file .env exec postgres pg_isready -U todo -d todo_platform
  docker compose --env-file .env exec postgres psql -U todo -d todo_platform -c "\dt"
  ```

  先看 `migrate` 日志中的 SQL 错误，再确认 PostgreSQL 是否 healthy。

- **修复**：修正迁移脚本或配置后重新运行：

  ```bash linenums="0"
  docker compose --env-file .env up -d postgres
  docker compose --env-file .env up --force-recreate migrate
  docker compose --env-file .env up -d api traefik
  ```

  如果只是教学实验数据污染，可以清空数据卷后重来：

  ```bash linenums="0"
  docker compose --env-file .env down -v
  docker compose --env-file .env up -d
  ```

- **预防**：迁移任务单独建服务，保留日志；不要把迁移静默塞进 API 启动脚本。

### 错误 4：端口冲突，Compose 无法启动

- **现象**：

  ```text linenums="0"
  Bind for 127.0.0.1:18080 failed: port is already allocated
  ```

  或：

  ```text linenums="0"
  Ports are not available: exposing port TCP 127.0.0.1:15432
  ```

- **原因**：宿主机端口已经被本地进程、旧容器或其他 Compose 项目占用。

- **排查**：

  ```bash linenums="0"
  docker ps --format "table {{.Names}}\t{{.Ports}}"
  docker compose --env-file .env ps
  ```

  Windows PowerShell 可查看端口占用：

  ```powershell linenums="0"
  netstat -ano | Select-String ":18080|:15432|:16379|:18090"
  ```

- **修复**：修改 `.env` 中的本地端口，例如：

  ```text linenums="0"
  TODO_HTTP_PORT=18081
  POSTGRES_PORT=15433
  REDIS_PORT=16380
  TRAEFIK_DASHBOARD_PORT=18091
  ```

  然后重启：

  ```bash linenums="0"
  docker compose --env-file .env up -d --force-recreate
  ```

- **预防**：所有本地暴露端口都放在 `.env`，不要把个人机器上的端口改动直接写进 `compose.yaml`。

### 错误 5：Traefik 返回 `502 Bad Gateway`

- **现象**：

  ```text linenums="0"
  HTTP/1.1 502 Bad Gateway
  ```

  Traefik 日志里可能出现：

  ```text linenums="0"
  service "todo-api" error: unable to find the IP address
  ```

- **原因**：API 没有启动成功、API 和 Traefik 不在同一个网络、Traefik 标签中的后端端口写错，或 API 监听地址不是 `0.0.0.0:18080`。

- **排查**：

  ```bash linenums="0"
  docker compose --env-file .env ps
  docker compose --env-file .env logs --tail 80 api
  docker compose --env-file .env logs --tail 80 traefik
  docker compose --env-file .env config | grep -E "traefik.http|TODO_API_ADDR"
  ```

  重点确认 `TODO_API_ADDR=0.0.0.0:18080`，以及 Traefik 标签中的 `server.port=18080`。

- **修复**：修正 API 监听地址或 Traefik 标签后重建：

  ```bash linenums="0"
  docker compose --env-file .env up -d --force-recreate api traefik
  ```

- **预防**：本地入口代理只转发容器内部端口；不要把 Traefik 标签写成宿主机映射端口 `18080`。

## 7. 生产环境注意事项

1. **不要把本篇 Compose 当作生产编排方案。** Compose 很适合本地开发、联调、Demo 和轻量测试，但生产环境需要更完整的调度、扩缩容、滚动发布、资源限制、健康探针、证书管理、审计、网络策略和故障自愈能力。后续 Kubernetes 章节会把本篇服务拆成 Deployment、StatefulSet、Service、Secret、ConfigMap、PVC 和 Ingress。

2. **不要提交 `.env` 或真实密钥。** 本篇把 `.env.example` 提交到仓库，把 `.env` 留在本地。生产环境中的数据库密码、Redis 密码、JWT Secret、管理员密码哈希应进入专门的密钥管理系统，例如 Kubernetes Secret、云厂商 Secret Manager 或 Vault。即使是哈希，也不应该随意提交到公开仓库。

3. **谨慎处理 Docker socket。** Traefik 挂载 `/var/run/docker.sock:ro` 可以方便地自动发现本地服务，但 Docker socket 权限非常敏感。能读取 Docker API 的组件可能获得宿主机容器拓扑、镜像和标签等信息，错误配置还可能扩大攻击面。生产入口代理应使用受控的服务发现机制和最小权限配置。

4. **区分停止环境和删除数据。** `docker compose down` 只删除容器和网络，保留命名数据卷；`docker compose down -v` 会删除 PostgreSQL 和 Redis 数据。生产或准生产环境中，不应把清理命令写成默认带 `-v`。任何删除数据卷的操作都必须有备份、确认和回滚方案。

5. **健康检查不是业务 SLA。** 本篇用 `pg_isready`、`redis-cli ping` 和 `config-check` 处理本地启动顺序，但生产环境还需要真实的 readiness、liveness、指标、日志、追踪和告警。`depends_on` 只能帮助本地环境按顺序启动，不能保证运行期间依赖永远可用。

## 8. 练习题与面试题

本章练习题和面试题已拆分到独立页面，完成正文学习后再进入题库练习与复盘。

[查看本章练习题与面试题](../../questions/stage-03-docker/17-docker-compose.md)

## 9. 本章总结

本篇把第 15 篇的手工 Docker 命令和第 16 篇的 `todo-api:v0.1.0` 镜像整合成了一套可复现的 Docker Compose 本地环境。你编写了 `compose.yaml`、`.env.example` 和本地 README，用一条命令启动 PostgreSQL、Redis、迁移任务、API 和 Traefik。

知识上，你应该已经理解 Compose 的服务、网络、数据卷、环境变量、健康检查、启动依赖和本地入口代理。技能上，你应该能独立启动完整 Todo Platform 本地环境，能通过日志、状态、健康检查和服务名定位常见故障。

本篇的关键收获不是“少敲命令”，而是把本地开发环境变成工程资产。只要 Compose 文件可信，团队就能围绕同一份环境排查问题、编写文档、接入 CI，并平滑过渡到 Kubernetes。

## 10. 下一章衔接

第 18 篇会进入容器运行原理。我们会基于本篇启动的容器观察 namespace、cgroups、UnionFS、容器进程、挂载点和网络隔离。到那时你会看到：Compose 负责把服务编排起来，但每个容器的底层仍然依赖 Linux 内核能力和 OCI 运行时。

下一篇会比前面几篇更底层：你会接触 `sudo`、`unshare`、cgroup v2、OverlayFS 和 `/proc`。如果你的环境是 macOS 或 Windows PowerShell，不需要硬闯底层命令，按第 18 篇的路线切到 WSL2 Ubuntu / Linux VM，或完成 Docker 替代观察实验即可。

也就是说，第 15 篇让你手动理解容器运行参数，第 16 篇让你构建可交付镜像，第 17 篇让你编排多服务本地环境。第 18 篇开始，我们会把这些现象继续拆开，看清容器为什么“看起来像一台小机器”，但本质上不是虚拟机。
