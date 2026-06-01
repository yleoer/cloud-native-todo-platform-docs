# 第 15 篇：Docker 基础

阶段二已经把 Todo API 推进到生产风格：它有 PostgreSQL 持久化、Redis 缓存与限流、JWT 鉴权、配置分层、结构化日志、健康检查、优雅关闭和 pprof 排障入口。从本篇开始，课程进入 **阶段三：容器化能力**。

本篇对应新版课程计划中的第 15 篇，类型为 **A 类：工具/环境章**。本篇特色项目是：**使用 Docker 运行 Todo API、PostgreSQL 和 Redis，并验证三类容器在同一个 Docker 网络中互通**。

本篇暂时不编写 Dockerfile，也不编写 Docker Compose YAML。Todo API 会使用官方 `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm` 镜像加代码目录挂载的方式运行。第 16 篇会把 Todo API 构建成自己的生产镜像，第 17 篇会把多容器启动命令整理成 Compose 编排文件。

本篇覆盖计划中的 5 个主题：

- 15.1 Docker 解决什么问题
- 15.2 镜像、容器、仓库与常用命令
- 15.3 容器生命周期与日志查看
- 15.4 Docker 数据卷与端口映射
- 15.5 Docker 网络基础

## 1. 本章学习目标

### 1.1 知识目标

- 能解释 Docker 解决的环境一致性、依赖隔离和交付复现问题。
- 能区分镜像、容器、仓库、数据卷、端口映射和 Docker 网络。
- 能描述容器从创建、启动、运行、停止到删除的生命周期。
- 能解释为什么容器内访问依赖服务要使用容器名，而不是 `127.0.0.1`。
- 能说明本篇手动 `docker run` 与后续 Dockerfile、Docker Compose 的关系。

### 1.2 技能目标

- 能使用 `docker run`、`docker ps`、`docker logs`、`docker exec`、`docker inspect`、`docker stop`、`docker rm` 管理容器。
- 能用 Docker 启动 PostgreSQL 18 和 Redis 8.2，并通过数据卷保存数据。
- 能把 Todo API 放入 Go 工具链容器中运行，并通过端口映射从宿主机访问。
- 能创建自定义 Docker 网络，并验证 Todo API、PostgreSQL、Redis 的容器间通信。
- 能排查 Docker daemon 未启动、端口冲突、容器退出、网络不通、数据卷误删等基础问题。

### 1.3 前置条件

开始本篇前，请确认你已经完成第 14 篇，项目中已有：

- `api/cmd/todo-api`
- `api/migrations/000001_create_todos.up.sql`
- `configs/base.json`
- `configs/dev.json`
- `api/internal/config`
- `api/internal/auth`
- `api/internal/handler/gin`

你还需要能执行：

```bash
docker version
docker compose version
```

本篇不会直接使用 Docker Compose，只在这里提前确认第 17 篇所需工具已经安装。如果你使用 Windows，推荐使用 Docker Desktop + WSL2 后端。后续命令会给出 Linux / macOS / WSL2 和 Windows PowerShell 两套写法。

## 2. 本章工作场景与真实案例

### 2.1 技术痛点

真实后端服务很少只依赖一个二进制文件。第 14 篇的 Todo API 启动时可能依赖 PostgreSQL、Redis、配置文件、环境变量、端口、日志输出和健康检查。如果每个同事都在本机手动安装依赖，很容易出现这些问题：

- A 同事 PostgreSQL 是 18，B 同事仍然是旧版本。
- 有人 Redis 设置了密码，有人没有设置密码。
- 有人本机 `5432` 端口已经被占用，API 连接到了错误数据库。
- 测试同学想复现缺陷，却不知道开发当时的依赖版本和启动参数。
- 新人入职第一天大半时间都耗在安装数据库、缓存和工具链上。

Docker 的价值不是“命令更酷”，而是把依赖运行环境变成可复制、可销毁、可检查的容器。团队可以约定统一镜像、统一端口、统一网络名、统一数据卷和统一清理命令，让开发、测试、CI 和后续 Kubernetes 部署拥有同一套语言。

### 2.2 团队协作场景

在团队里，Docker 基础能力会被多个角色共同使用：

- 后端开发用容器启动 PostgreSQL、Redis 和 Todo API，快速复现接口问题。
- 测试工程师用相同镜像和启动参数验证缺陷，不依赖个人电脑的本地服务。
- DevOps 把手工 `docker run` 参数沉淀为 Dockerfile、Compose、CI 和 Kubernetes YAML。
- SRE 通过容器日志、退出码、端口映射、网络和数据卷定位运行问题。
- 安全工程师审查镜像来源、端口暴露、Secret 注入、root 运行和数据持久化边界。

本篇先让你手动执行 Docker 命令，是为了看清每个运行参数的意义。第 17 篇再写 Compose 时，你会知道 YAML 中的 `ports`、`volumes`、`networks`、`environment` 分别来自哪里。

### 2.3 课程项目关联

本篇会把第 14 篇 Todo API v5 的运行环境改成三类容器：

```text
宿主机 curl
  |
  | 127.0.0.1:18080
  v
todo-api 容器
  |
  | Docker network: todo-net
  +-- todo-postgres:5432
  |
  +-- todo-redis:6379
```

本篇产出会被后续章节直接复用：

- 第 16 篇会把当前用 `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm` 临时运行的 Todo API，构建成 `todo-api` 应用镜像。
- 第 17 篇会把本篇多条 `docker run` 命令整理为 `compose.yaml`。
- 第 18 篇会深入解释本篇已经使用过的容器进程、文件系统、网络和数据卷隔离。
- 第 19 篇会把 Docker 背后的 containerd、runc 和 CRI 调用链拆开观察。

## 3. 核心概念

### 3.1 Docker 解决什么问题

Docker 是一种容器平台，用来创建、运行、分发和管理容器。它主要解决三类问题。

第一是环境一致性。应用依赖的运行时、系统库、命令行工具和默认文件系统可以通过镜像固定下来，减少“我电脑上可以跑”的问题。

第二是依赖隔离。PostgreSQL、Redis 和 Todo API 可以分别运行在不同容器中，它们有自己的进程、文件系统、环境变量和网络身份。

第三是交付复现。团队可以通过镜像标签、启动参数、环境变量、数据卷和网络，把一套运行环境复现在开发机、测试机、CI 和后续 Kubernetes 集群中。

### 3.2 镜像

镜像是容器的只读模板。你可以把镜像理解为：

```text
应用程序 + 运行时 + 文件系统快照 + 默认启动命令
```

本篇会使用这些官方镜像：

| 镜像 | 用途 |
|---|---|
| `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` | 运行 PostgreSQL 数据库 |
| `registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine` | 运行 Redis 缓存与限流依赖 |
| `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm` | 临时运行 Todo API 源码 |
| `registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23` | 作为轻量工具容器测试网络 |

拉取镜像：

```bash
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
```

查看本地镜像：

```bash
docker image ls
```

生产环境不要依赖 `latest`。`latest` 不是“最新版”的严格承诺，而是一个普通标签，会让环境随时间变化，降低可复现性。

### 3.3 容器

容器是镜像运行起来后的进程实例。同一个镜像可以启动多个容器：

```text
registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine 镜像
  ├── todo-postgres 容器
  └── test-postgres 容器
```

容器生命周期可以简化理解为：

```text
create -> start -> running -> stop -> remove
```

常用命令：

```bash
docker ps
docker ps -a
docker stop todo-postgres
docker start todo-postgres
docker rm todo-postgres
```

`docker ps` 只显示正在运行的容器，`docker ps -a` 会显示已经退出的容器。排查“容器没起来”时，优先看 `docker ps -a` 和 `docker logs`。

### 3.4 仓库

镜像仓库用于保存和分发镜像。常见仓库包括：

- Docker Hub
- GitHub Container Registry
- Harbor
- 云厂商容器镜像仓库

本篇只使用 Docker Hub 上的官方公共镜像。后续第 16 篇会构建 Todo API 自己的镜像，第 29 篇会把镜像构建和推送纳入 CI/CD。

### 3.5 端口映射

容器有自己的网络命名空间。容器内服务监听的端口，默认不能直接被宿主机访问。宿主机要访问容器服务，需要端口映射：

```text
宿主机 127.0.0.1:18080 -> todo-api 容器 18080
宿主机 127.0.0.1:15432 -> todo-postgres 容器 5432
宿主机 127.0.0.1:16379 -> todo-redis 容器 6379
```

命令格式：

```bash
docker run -p 127.0.0.1:宿主机端口:容器端口 ...
```

本篇把 PostgreSQL 映射到 `15432`，Redis 映射到 `16379`，是为了避免和本机已经安装的 PostgreSQL、Redis 默认端口冲突。端口绑定到 `127.0.0.1`，表示只允许本机访问，避免把本地实验服务暴露到局域网。

### 3.6 数据卷

容器默认可写层会随着容器删除而消失。数据库这类有状态服务不能把数据只放在容器可写层中。

Docker Volume 用来持久化数据：

```text
todo-postgres-data -> /var/lib/postgresql/data
todo-redis-data    -> /data
```

创建数据卷：

```bash
docker volume create todo-postgres-data
docker volume create todo-redis-data
```

查看数据卷：

```bash
docker volume ls
```

删除容器不等于删除数据卷。只有执行 `docker volume rm` 或 `docker compose down -v` 这类命令时，数据卷才会被删除。

### 3.7 Docker 网络

Docker 默认会创建 bridge 网络。为了让本章容器能通过稳定名字互相访问，我们会创建自定义网络：

```bash
docker network create todo-net
```

加入同一个自定义网络后，容器可以通过容器名互相解析：

```text
todo-api -> todo-postgres:5432
todo-api -> todo-redis:6379
```

注意：容器里的 `127.0.0.1` 指的是容器自己，不是宿主机，也不是其他容器。因此 Todo API 容器访问数据库时应该使用 `todo-postgres:5432`，而不是 `127.0.0.1:15432`。

### 3.8 日志、进入容器与 Inspect

容器的主进程应该把日志输出到 stdout / stderr。Docker 会收集这些输出：

```bash
docker logs todo-api
docker logs --tail 80 todo-api
docker logs -f todo-api
```

进入带有 shell 的容器：

```bash
docker exec -it todo-api bash
```

查看容器详细信息：

```bash
docker inspect todo-api
docker inspect todo-api --format '{{.State.Status}} {{.State.ExitCode}}'
```

`docker inspect` 输出很长，但它包含排障需要的关键信息：退出码、启动命令、环境变量、端口映射、挂载点、网络地址、健康状态等。

## 4. 原理深入

### 4.1 Docker 基本运行链路

图 15-1 Docker 基本运行链路：

```mermaid
flowchart LR
    CLI["docker CLI"] --> Daemon["Docker daemon"]
    Daemon --> Local["本地镜像缓存"]
    Daemon --> Registry["镜像仓库"]
    Registry --> Local
    Local --> Container["容器进程"]
    Container --> Logs["stdout / stderr"]
    Container --> Volume["数据卷"]
    Container --> Network["Docker 网络"]
```

执行 `docker run registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` 时，大致发生这些事：

1. Docker CLI 把请求发送给 Docker daemon。
2. Docker daemon 检查本地是否已有 `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` 镜像。
3. 如果本地没有，就从镜像仓库拉取。
4. 基于镜像创建容器文件系统，并加上容器可写层。
5. 挂载数据卷，设置环境变量，配置端口映射和网络。
6. 启动容器里的主进程。
7. 主进程输出到 stdout / stderr，`docker logs` 可以查看。

### 4.2 镜像层和容器可写层

镜像由多层只读层组成，容器启动时会在最上面加一个可写层：

图 15-2 镜像层与容器可写层：

```text
容器可写层        <- 容器运行时写入的临时文件
镜像层 N
镜像层 N-1
镜像层 ...
基础镜像层
```

如果把数据库数据写在容器可写层，删除容器后数据会消失。因此 PostgreSQL 和 Redis 要把数据目录挂载到数据卷。本篇只建立分层概念，第 18 篇会继续深入 UnionFS、rootfs、Namespace 和 Cgroups 如何共同组成容器隔离。

### 4.3 端口映射和监听地址

第 14 篇的 Todo API 默认监听 `127.0.0.1:18080`。这在宿主机上运行时没问题，但放进容器后会产生一个常见坑：服务只监听容器内部的回环地址，Docker 端口映射无法从宿主机连进去。

容器内服务应监听：

```text
0.0.0.0:18080
```

端口映射负责把宿主机请求转进容器：

图 15-3 宿主机端口映射到容器监听地址：

```text
curl 127.0.0.1:18080
  -> Docker 端口映射
  -> todo-api 容器 0.0.0.0:18080
```

因此本篇启动 Todo API 时会设置：

```bash
TODO_API_ADDR=0.0.0.0:18080
```

### 4.4 容器间网络通信

本篇的 API 容器访问数据库和 Redis 的链路是：

图 15-4 Todo API 容器间网络通信：

```mermaid
sequenceDiagram
    participant Host as 宿主机
    participant API as todo-api 容器
    participant PG as todo-postgres 容器
    participant Redis as todo-redis 容器

    Host->>API: curl /api/v2/auth/login
    API->>PG: todo-postgres:5432
    API->>Redis: todo-redis:6379
    API-->>Host: JSON 响应
```

`todo-postgres` 和 `todo-redis` 是容器名。它们在 `todo-net` 网络中会被 Docker DNS 解析到对应容器 IP。宿主机端口 `15432`、`16379` 只给宿主机访问容器使用，容器之间通信仍然使用内部端口 `5432` 和 `6379`。

### 4.5 手动 docker run 与 Dockerfile、Compose 的关系

本篇手动写 `docker run`，不是最终形态，而是为了让你看清容器运行的组成：

| 本篇手工参数 | 第 16/17 篇会演进为 |
|---|---|
| `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm` + `go run` | Dockerfile 多阶段构建出的 `todo-api` 镜像 |
| `-e TODO_DATABASE_DSN=...` | Compose / Kubernetes 中的环境变量和 Secret |
| `-v "$PWD:/workspace"` | 构建上下文、开发挂载或配置挂载 |
| `--network todo-net` | Compose network 或 Kubernetes Service |
| `-p 127.0.0.1:18080:18080` | Compose ports 或 Kubernetes Service / Ingress |

如果跳过本篇直接写 Compose，很多 YAML 字段会变成“照抄模板”。先手动运行一次，后面才能知道哪些字段是必需的，哪些只是工具生成的包装。

## 5. 手把手实验

### 5.1 实验目标

使用 Docker 手动启动 `todo-postgres`、`todo-redis` 和 `todo-api` 三个容器，完成数据库迁移、登录、带 JWT 创建 Todo，并验证容器网络、日志、端口映射和数据卷。

### 5.2 实验环境

| 工具或镜像 | 建议版本 | 说明 |
|---|---|---|
| Docker Desktop / Docker Engine | 29.x 或当前稳定版 | 需要能执行 `docker version` |
| Docker Compose | v2 | 本篇只做版本确认，第 17 篇正式使用 |
| Go 工具链镜像 | `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm` | 用来运行 Todo API 源码 |
| PostgreSQL 镜像 | `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` | 权威数据源 |
| Redis 镜像 | `registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine` | 缓存、限流和轻量任务 |
| Alpine 镜像 | `registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23` | 网络排查工具容器 |
| curl | 任意现代版本 | 验证 HTTP API |
| jq | 可选 | Linux / macOS / WSL2 下推荐用来解析登录 JSON |

确认 Docker 可用：

```bash
docker version
docker compose version
```

本篇不会直接使用 Docker Compose，此处提前检查是为了在第 17 篇之前暴露安装问题。预期能看到 Client 和 Server 两部分版本信息。如果只有 Client，没有 Server，说明 Docker daemon 没有连接成功。

### 5.3 文件目录结构

本篇不新增项目文件，重点是从项目根目录用 Docker 运行已有代码。开始前确认目录中存在这些文件：

```bash
test -d api/cmd/todo-api
test -f api/migrations/000001_create_todos.up.sql
test -d configs
```

项目关键目录应类似：

```text
cloud-native-todo-platform/
├── api/
│   ├── cmd/
│   │   └── todo-api/
│   ├── internal/
│   └── migrations/
│       └── 000001_create_todos.up.sql
├── configs/
│   ├── base.json
│   └── dev.json
├── docker-compose.yml
└── go.mod
```

`docker-compose.yml` 来自第 12、13 篇，本篇不会使用它启动服务。我们先手动执行 Docker 命令，第 17 篇再把这些参数整理成新版 Compose 文件。

### 5.4 完整运行配置

本篇会创建以下 Docker 资源：

| 资源 | 名称 | 作用 |
|---|---|---|
| 网络 | `todo-net` | 让 API、PostgreSQL、Redis 互相通过容器名访问 |
| 数据卷 | `todo-postgres-data` | 保存 PostgreSQL 数据 |
| 数据卷 | `todo-redis-data` | 保存 Redis AOF 数据 |
| 数据卷 | `todo-go-mod-cache` | 缓存 Go module 下载结果 |
| 数据卷 | `todo-go-build-cache` | 缓存 Go 编译结果 |
| 容器 | `todo-postgres` | PostgreSQL 18 |
| 容器 | `todo-redis` | Redis 8.2 |
| 容器 | `todo-api` | 使用 Go 镜像运行 Todo API 源码 |

Todo API 容器会使用这些关键环境变量：

| 环境变量 | 示例值 | 说明 |
|---|---|---|
| `TODO_ENV` | `dev` | 加载 `configs/dev.json` |
| `TODO_CONFIG_DIR` | `configs` | 配置目录 |
| `TODO_API_ADDR` | `0.0.0.0:18080` | 容器内必须监听所有地址 |
| `TODO_DATABASE_DSN` | `postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable` | 容器间访问 PostgreSQL |
| `TODO_REDIS_ADDR` | `todo-redis:6379` | 容器间访问 Redis |
| `TODO_REDIS_PASSWORD` | `todo_redis_password` | Redis 密码 |
| `TODO_JWT_SECRET` | `0123456789abcdef0123456789abcdef` | 本地实验用 JWT Secret |
| `TODO_AUTH_USERS` | `admin=<bcrypt-hash>` | 登录用户和密码哈希 |

这里的 Secret 和密码都是本地教学值。真实环境不应把 Secret 写进命令历史、镜像层或公开仓库。

### 5.5 执行命令

下面命令会为了本地教学直接写入数据库密码、Redis 密码和 JWT Secret。真实项目应通过 Secret 管理系统、CI/CD Secret 或受控环境变量注入，不要把它们留在公开命令历史、镜像层或仓库中。

先拉取本篇要用的官方镜像。这样如果网络、镜像名或平台架构有问题，会在启动容器前暴露出来。

```bash
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
docker image ls
```

如果出现 `no matching manifest`，通常表示当前 CPU 架构没有对应镜像；如果出现 `pull access denied`，通常是镜像名写错、仓库私有或未登录。

先清理可能残留的同名容器，避免名称冲突。

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-api todo-postgres todo-redis 2>/dev/null || true
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-api todo-postgres todo-redis 2>$null
    ```

创建 Docker 网络和数据卷。

```bash
docker network create todo-net
docker volume create todo-postgres-data
docker volume create todo-redis-data
docker volume create todo-go-mod-cache
docker volume create todo-go-build-cache
```

如果网络或数据卷已经存在，Docker 会提示同名资源已存在。你可以保留已有资源继续实验，或者按 5.8 的清理步骤删除后重建。

启动 PostgreSQL 容器。

```bash
docker run -d \
  --name todo-postgres \
  --network todo-net \
  -e POSTGRES_USER=todo \
  -e POSTGRES_PASSWORD=todo_password \
  -e POSTGRES_DB=todo_platform \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -v todo-postgres-data:/var/lib/postgresql/data \
  -p 127.0.0.1:15432:5432 \
  registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
```

Windows PowerShell 写法：

```powershell
docker run -d `
  --name todo-postgres `
  --network todo-net `
  -e POSTGRES_USER=todo `
  -e POSTGRES_PASSWORD=todo_password `
  -e POSTGRES_DB=todo_platform `
  -e PGDATA=/var/lib/postgresql/data/pgdata `
  -v todo-postgres-data:/var/lib/postgresql/data `
  -p 127.0.0.1:15432:5432 `
  registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
```

启动 Redis 容器。

```bash
docker run -d \
  --name todo-redis \
  --network todo-net \
  -v todo-redis-data:/data \
  -p 127.0.0.1:16379:6379 \
  registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine \
  redis-server --requirepass todo_redis_password --appendonly yes
```

Windows PowerShell 写法：

```powershell
docker run -d `
  --name todo-redis `
  --network todo-net `
  -v todo-redis-data:/data `
  -p 127.0.0.1:16379:6379 `
  registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine `
  redis-server --requirepass todo_redis_password --appendonly yes
```

确认 PostgreSQL 和 Redis 已经就绪。首次启动数据库时会初始化数据目录，可能需要等待数秒；下面用重试循环避免新手在初始化未完成时误判为失败。

=== "Linux / macOS / WSL2"

    ```bash
    for i in $(seq 1 20); do
      if docker exec todo-postgres pg_isready -U todo -d todo_platform; then
        break
      fi
      sleep 2
    done

    for i in $(seq 1 20); do
      if docker exec todo-redis redis-cli -a todo_redis_password ping; then
        break
      fi
      sleep 1
    done
    ```

=== "Windows PowerShell"

    ```powershell
    for ($i = 1; $i -le 20; $i++) {
      docker exec todo-postgres pg_isready -U todo -d todo_platform
      if ($LASTEXITCODE -eq 0) { break }
      Start-Sleep -Seconds 2
    }

    for ($i = 1; $i -le 20; $i++) {
      docker exec todo-redis redis-cli -a todo_redis_password ping
      if ($LASTEXITCODE -eq 0) { break }
      Start-Sleep -Seconds 1
    }
    ```

预期输出：

```text
/var/run/postgresql:5432 - accepting connections
PONG
```

验证容器名可以被 Docker DNS 解析。

```bash
docker run --rm --network todo-net registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 nslookup todo-postgres
docker run --rm --network todo-net registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 nslookup todo-redis
```

预期输出中应能看到 `todo-postgres` 和 `todo-redis` 对应的容器 IP。

生成本地管理员密码哈希。这里使用 Go 工具链容器执行第 14 篇的 `hash-password` 命令。

=== "Linux / macOS / WSL2"

    ```bash
    HASH=$(docker run --rm \
      -v "$PWD:/workspace" \
      -v todo-go-mod-cache:/go/pkg/mod \
      -v todo-go-build-cache:/root/.cache/go-build \
      -w /workspace \
      registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm \
      go run ./api/cmd/todo-api hash-password "change-me-123")

    echo "$HASH"
    ```

=== "Windows PowerShell"

    ```powershell
    $hash = docker run --rm `
      -v "${PWD}:/workspace" `
      -v todo-go-mod-cache:/go/pkg/mod `
      -v todo-go-build-cache:/root/.cache/go-build `
      -w /workspace `
      registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm `
      go run ./api/cmd/todo-api hash-password "change-me-123"

    $hash
    ```

第一次执行会下载 Go 依赖，可能需要等待一段时间。`todo-go-mod-cache` 和 `todo-go-build-cache` 会让后续 `go run` 更快。

先执行配置检查。`config-check` 不会启动服务，但能提前发现 Secret 太短、用户配置缺失、配置目录挂载失败等问题。

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm \
      --network todo-net \
      -v "$PWD:/workspace" \
      -v todo-go-mod-cache:/go/pkg/mod \
      -v todo-go-build-cache:/root/.cache/go-build \
      -w /workspace \
      -e TODO_ENV=dev \
      -e TODO_CONFIG_DIR=configs \
      -e TODO_API_ADDR=0.0.0.0:18080 \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      -e TODO_REDIS_ADDR=todo-redis:6379 \
      -e TODO_REDIS_PASSWORD=todo_redis_password \
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
      -e TODO_AUTH_USERS="admin=$HASH" \
      registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm \
      go run ./api/cmd/todo-api config-check
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm `
      --network todo-net `
      -v "${PWD}:/workspace" `
      -v todo-go-mod-cache:/go/pkg/mod `
      -v todo-go-build-cache:/root/.cache/go-build `
      -w /workspace `
      -e TODO_ENV=dev `
      -e TODO_CONFIG_DIR=configs `
      -e TODO_API_ADDR=0.0.0.0:18080 `
      -e "TODO_DATABASE_DSN=postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable" `
      -e TODO_REDIS_ADDR=todo-redis:6379 `
      -e TODO_REDIS_PASSWORD=todo_redis_password `
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef `
      -e "TODO_AUTH_USERS=admin=$hash" `
      registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm `
      go run ./api/cmd/todo-api config-check
    ```

执行数据库迁移。

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm \
      --network todo-net \
      -v "$PWD:/workspace" \
      -v todo-go-mod-cache:/go/pkg/mod \
      -v todo-go-build-cache:/root/.cache/go-build \
      -w /workspace \
      -e TODO_ENV=dev \
      -e TODO_CONFIG_DIR=configs \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
      -e TODO_AUTH_USERS="admin=$HASH" \
      registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm \
      go run ./api/cmd/todo-api migrate
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm `
      --network todo-net `
      -v "${PWD}:/workspace" `
      -v todo-go-mod-cache:/go/pkg/mod `
      -v todo-go-build-cache:/root/.cache/go-build `
      -w /workspace `
      -e TODO_ENV=dev `
      -e TODO_CONFIG_DIR=configs `
      -e "TODO_DATABASE_DSN=postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable" `
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef `
      -e "TODO_AUTH_USERS=admin=$hash" `
      registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm `
      go run ./api/cmd/todo-api migrate
    ```

预期输出：

```text
migration applied
```

启动 Todo API 容器。

与前面的 `hash-password`、`config-check` 和 `migrate` 一样，首次执行 `serve` 也可能下载依赖并编译代码。启动后先查看 `docker logs --tail 80 todo-api`，看到服务监听日志后再执行 `curl` 验证。

=== "Linux / macOS / WSL2"

    ```bash
    docker run -d \
      --name todo-api \
      --network todo-net \
      -v "$PWD:/workspace" \
      -v todo-go-mod-cache:/go/pkg/mod \
      -v todo-go-build-cache:/root/.cache/go-build \
      -w /workspace \
      -e TODO_ENV=dev \
      -e TODO_CONFIG_DIR=configs \
      -e TODO_API_ADDR=0.0.0.0:18080 \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      -e TODO_REDIS_ADDR=todo-redis:6379 \
      -e TODO_REDIS_PASSWORD=todo_redis_password \
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
      -e TODO_AUTH_USERS="admin=$HASH" \
      -p 127.0.0.1:18080:18080 \
      registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm \
      go run ./api/cmd/todo-api serve
    ```

=== "Windows PowerShell"

    ```powershell
    docker run -d `
      --name todo-api `
      --network todo-net `
      -v "${PWD}:/workspace" `
      -v todo-go-mod-cache:/go/pkg/mod `
      -v todo-go-build-cache:/root/.cache/go-build `
      -w /workspace `
      -e TODO_ENV=dev `
      -e TODO_CONFIG_DIR=configs `
      -e TODO_API_ADDR=0.0.0.0:18080 `
      -e "TODO_DATABASE_DSN=postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable" `
      -e TODO_REDIS_ADDR=todo-redis:6379 `
      -e TODO_REDIS_PASSWORD=todo_redis_password `
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef `
      -e "TODO_AUTH_USERS=admin=$hash" `
      -p 127.0.0.1:18080:18080 `
      registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm `
      go run ./api/cmd/todo-api serve
    ```

查看容器状态和日志。

```bash
docker ps
docker logs --tail 80 todo-api
```

验证健康检查。

```bash
curl -i http://127.0.0.1:18080/healthz
curl -i http://127.0.0.1:18080/readyz
```

登录并创建 Todo。

=== "Linux / macOS / WSL2"

    如果已经安装 `jq`，优先使用结构化 JSON 解析方式提取 Token：

    ```bash
    TOKEN=$(curl -s -H 'Content-Type: application/json' \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:18080/api/v2/auth/login | jq -r '.data.token')

    echo "$TOKEN"
    ```

    如果没有安装 `jq`，可以临时使用 `sed`。这个写法假设 API 返回紧凑 JSON，后续如果响应格式变成多行或字段层级调整，应改回 `jq` 或直接查看登录响应。

    ```bash
    TOKEN=$(curl -s -H 'Content-Type: application/json' \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:18080/api/v2/auth/login | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

    echo "$TOKEN"
    ```

    如果 `echo "$TOKEN"` 没有输出，不要继续创建 Todo，先直接查看登录响应：

    ```bash
    curl -i -H 'Content-Type: application/json' \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:18080/api/v2/auth/login
    ```

    Token 有值后再创建 Todo：

    ```bash
    curl -i -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"title":"run todo api with docker"}' \
      http://127.0.0.1:18080/api/v2/todos
    ```

=== "Windows PowerShell"

    ```powershell
    $login = curl.exe -s -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"change-me-123\"}" http://127.0.0.1:18080/api/v2/auth/login | ConvertFrom-Json
    $token = $login.data.token

    curl.exe -i -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"title\":\"run todo api with docker\"}" http://127.0.0.1:18080/api/v2/todos
    ```

查看 Docker 网络、端口和数据卷。

```bash
docker port todo-api
docker network inspect todo-net
docker volume ls
docker inspect todo-api --format '{{.State.Status}} {{.State.ExitCode}}'
```

进入 API 容器观察运行环境。

```bash
docker exec -it todo-api bash
```

进入容器后可以执行：

```bash
pwd
ls
go version
exit
```

### 5.6 预期输出

`docker ps` 应能看到三个容器：

```text
CONTAINER ID   IMAGE                  COMMAND                  STATUS         PORTS                         NAMES
...            registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm   "go run ./api/cmd/..."   Up ...         127.0.0.1:18080->18080/tcp    todo-api
...            registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine     "docker-entrypoint..."   Up ...         127.0.0.1:15432->5432/tcp     todo-postgres
...            registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine       "docker-entrypoint..."   Up ...         127.0.0.1:16379->6379/tcp     todo-redis
```

`/healthz` 应返回：

```text
HTTP/1.1 200 OK
```

无 Token 请求 Todo 列表应返回：

```bash
curl -i http://127.0.0.1:18080/api/v2/todos
```

预期状态码：

```text
HTTP/1.1 401 Unauthorized
```

带 Token 创建 Todo 应返回：

```text
HTTP/1.1 201 Created
```

API 日志中应能看到请求日志和 Redis 启用信息，输出类似：

```text
{"level":"INFO","msg":"redis cache enabled","addr":"todo-redis:6379","ttl":"30s"}
{"level":"INFO","msg":"http request","method":"POST","path":"/api/v2/todos","status":201,"user":"admin"}
```

### 5.7 验证方法

验证 Docker 资源存在：

```bash
docker network inspect todo-net --format '{{.Name}}'
docker volume inspect todo-postgres-data --format '{{.Name}}'
docker volume inspect todo-redis-data --format '{{.Name}}'
```

验证 PostgreSQL 和 Redis 从容器内部可用：

```bash
docker exec todo-postgres psql -U todo -d todo_platform -c '\dt'
docker exec todo-redis redis-cli -a todo_redis_password ping
```

验证 API 容器通过容器名访问依赖：

```bash
docker exec todo-api getent hosts todo-postgres
docker exec todo-api getent hosts todo-redis
docker exec todo-api bash -lc ': </dev/tcp/todo-postgres/5432 && echo postgres-ok'
docker exec todo-api bash -lc ': </dev/tcp/todo-redis/6379 && echo redis-ok'
docker logs --tail 120 todo-api
```

如果 `getent hosts` 能解析出 IP，两个 TCP 探测能输出 `postgres-ok` 和 `redis-ok`，日志里没有数据库连接错误、Redis 连接错误，并且 `/readyz` 返回 `200`，说明依赖链路正常。

验证宿主机只能通过映射端口访问：

```bash
curl -i http://127.0.0.1:18080/healthz
```

验证容器 DNS：

```bash
docker run --rm --network todo-net registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 nslookup todo-postgres
docker run --rm --network todo-net registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 nslookup todo-redis
```

### 5.8 清理步骤

只停止和删除容器，保留数据卷：

```bash
docker rm -f todo-api todo-postgres todo-redis
```

删除本篇创建的网络：

```bash
docker network rm todo-net
```

如果确认不需要保留实验数据，再删除数据卷：

```bash
docker volume rm todo-postgres-data todo-redis-data todo-go-mod-cache todo-go-build-cache
```

`docker volume rm` 会删除 PostgreSQL、Redis 和 Go 缓存数据。生产环境或重要开发环境不要随手删除数据卷。

预计耗时：90 分钟（阅读约 30 分钟，动手实验约 60 分钟）。

## 6. 常见错误与排障

### 错误 1：Docker daemon 没有启动

- **现象**：

  ```text
  Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?
  ```

- **原因**：Docker Desktop 没启动，Linux 上 Docker daemon 未运行，或当前终端连接到了错误的 Docker context。
- **排查**：

  ```bash
  docker version
  docker context ls
  ```

  如果 `docker version` 只有 Client 没有 Server，说明 CLI 没连上 Docker daemon。

- **修复**：启动 Docker Desktop；Linux 上执行 `sudo systemctl start docker`；如果 context 错误，用 `docker context use <name>` 切换。
- **预防**：每次开始容器实验前先执行 `docker version` 和 `docker info`。

### 错误 2：端口已经被占用

- **现象**：

  ```text
  Bind for 127.0.0.1:18080 failed: port is already allocated
  ```

- **原因**：宿主机上已有进程或其他容器占用了 `18080` 端口。
- **排查**：

  ```bash
  docker ps --format 'table {{.Names}}\t{{.Ports}}'
  ss -ltnp | grep 18080
  ```

  Windows PowerShell 可用：

  ```powershell
  netstat -ano | findstr 18080
  ```

- **修复**：停止占用端口的容器或进程，或把本篇 API 映射改成其他宿主机端口，例如 `-p 127.0.0.1:18081:18080`。
- **预防**：课程实验统一使用明确端口，并在清理步骤中删除不再使用的容器。

### 错误 3：API 容器启动后立即退出

- **现象**：

  ```text
  docker ps
  # 看不到 todo-api

  docker ps -a
  # todo-api 状态是 Exited
  ```

- **原因**：应用启动失败，常见原因是 `TODO_JWT_SECRET` 太短、`TODO_AUTH_USERS` 没设置、配置目录挂载失败、Windows 路径没有挂载进容器，或 Go 依赖下载失败。
- **排查**：

  ```bash
  docker logs todo-api
  docker inspect todo-api --format '{{.State.Status}} {{.State.ExitCode}} {{.State.Error}}'
  ```

  重点看日志里是否出现 `TODO_JWT_SECRET must be at least 32 bytes`、`at least one auth user is required`、`no such file or directory`。

- **排查挂载问题**：如果日志里出现 `stat /workspace/api/cmd/todo-api: no such file or directory`，用轻量容器验证目录是否真的挂载成功：

  ```bash
  docker run --rm -v "$PWD:/workspace" -w /workspace registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 ls
  ```

  Windows PowerShell 写法：

  ```powershell
  Get-Location
  Test-Path .\api\cmd\todo-api
  docker run --rm -v "${PWD}:/workspace" -w /workspace registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 ls
  ```

- **修复**：按 5.5 重新生成 `HASH`，确认 `TODO_JWT_SECRET` 至少 32 字节，确认命令在项目根目录执行。Windows 用户还要确认 Docker Desktop 已启用 WSL integration 或允许当前磁盘共享；路径包含空格时保留 `-v "${PWD}:/workspace"` 的引号。
- **预防**：先用一次性 Go 容器执行 `config-check` 或 `migrate`，再启动长期运行的 `todo-api` 容器。

### 错误 4：API 连不上 PostgreSQL 或 Redis

- **现象**：

  ```text
  dial tcp 127.0.0.1:5432: connect: connection refused
  dial tcp: lookup todo-postgres: no such host
  ```

- **原因**：容器内使用了错误地址。`127.0.0.1` 指向 API 容器自己，不是 PostgreSQL 容器。`no such host` 通常表示容器没有加入同一个 Docker 网络，或容器名写错。
- **排查**：

  ```bash
  docker network inspect todo-net
  docker run --rm --network todo-net registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 nslookup todo-postgres
  docker run --rm --network todo-net registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 nslookup todo-redis
  ```

- **修复**：确保三个容器都使用 `--network todo-net`；`TODO_DATABASE_DSN` 使用 `todo-postgres:5432`；`TODO_REDIS_ADDR` 使用 `todo-redis:6379`。
- **预防**：记住宿主机访问用映射端口，容器间访问用容器名和内部端口。

**补充排查：登录成功但后续请求返回 401**

如果登录接口看起来成功，但创建 Todo 返回 `401 Unauthorized`，先检查本地变量是否真的拿到了 Token：

```bash
echo "$TOKEN"
curl -i -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me-123"}' \
  http://127.0.0.1:18080/api/v2/auth/login
```

`TOKEN` 为空时，常见原因是 `sed` 没匹配到登录响应，或者登录接口实际返回了错误 JSON。优先安装 `jq` 并使用 `jq -r '.data.token'`；没有 `jq` 时，先查看完整登录响应，再调整提取命令。

### 错误 5：删除容器后数据不见了

- **现象**：重新创建 PostgreSQL 容器后，Todo 数据或迁移表不见了。
- **原因**：没有挂载数据卷，或清理时执行了 `docker volume rm todo-postgres-data`。
- **排查**：

  ```bash
  docker inspect todo-postgres --format '{{json .Mounts}}'
  docker volume ls
  ```

  如果 `Mounts` 里没有 `/var/lib/postgresql/data`，说明数据库没有挂载到数据卷。

- **修复**：按 5.5 重新创建带 `-v todo-postgres-data:/var/lib/postgresql/data` 的容器，并重新执行迁移。
- **预防**：容器可以删，数据卷要谨慎删；生产数据需要备份、恢复演练和权限控制。

## 7. 生产环境注意事项

1. **不要把手工 docker run 和 Go 工具链容器当成生产发布方式**。本篇手动命令适合学习和本地排障，`registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm` 加源码挂载也便于理解容器运行参数；但生产环境需要 Dockerfile、镜像标签、CI 构建、制品仓库、部署配置、回滚策略和审计记录。生产发布应使用第 16 篇的多阶段 Dockerfile 构建精简镜像，并配置非 root 用户运行。

2. **镜像来源和标签必须可控**。生产不应长期使用 `latest`，也不应随意拉取不可信镜像。团队需要固定镜像标签，必要时固定 digest，并使用漏洞扫描和镜像签名。第 16 篇会继续讲 Dockerfile、镜像体积、非 root 运行、构建缓存和安全扫描。

3. **Secret 不应出现在镜像层和公开命令历史中**。本篇为了教学把密码写在命令里，真实团队应使用 Secret 管理系统、CI/CD Secret、Kubernetes Secret 或受控环境变量注入。不要把 JWT Secret、数据库密码、Redis 密码写进 Dockerfile、镜像 label、Git 仓库或日志。

4. **端口暴露要有边界**。本篇使用 `127.0.0.1:宿主机端口:容器端口`，只允许本机访问。生产环境暴露端口要经过负载均衡、Ingress、TLS、鉴权和防火墙策略。数据库和 Redis 通常不应直接暴露公网，应该只允许应用所在网络访问。

5. **有状态数据必须有备份和生命周期策略**。Docker Volume 能让删除容器时数据不丢，但它不是备份方案。生产数据库需要定期备份、恢复演练、容量监控、权限隔离和升级方案。清理命令中带 `-v` 或 `docker volume rm` 时要格外小心。

## 8. 本章小项目

本章小项目是 **Todo Platform Docker 基础运行环境**。项目目标是不用 Dockerfile 和 Compose，完全通过 Docker CLI 手动运行 Todo API、PostgreSQL 和 Redis，并记录关键排障命令。

项目产出：

- 一个名为 `todo-net` 的 Docker 网络。
- 两个持久化数据卷：`todo-postgres-data`、`todo-redis-data`。
- 三个容器：`todo-postgres`、`todo-redis`、`todo-api`。
- 一次成功的 Todo API 登录和带 Token 创建 Todo 记录。
- 一份你自己的 Docker 运行记录，可以放入 `docs/docker/chapter-15-run-record.md`。

验收标准：

- `docker ps` 能看到三个容器运行。
- `curl -i http://127.0.0.1:18080/healthz` 返回 `200 OK`。
- `/api/v2/auth/login` 能返回 JWT。
- 带 Token 调用 `POST /api/v2/todos` 返回 `201 Created`。
- `docker network inspect todo-net` 中能看到三个容器。
- `docker volume ls` 中能看到 PostgreSQL 和 Redis 数据卷。
- 你能解释为什么 `TODO_DATABASE_DSN` 使用 `todo-postgres:5432`，不是 `127.0.0.1:15432`。
- 你能解释为什么容器内 API 要监听 `0.0.0.0:18080`，不是只监听 `127.0.0.1:18080`。

## 9. 本章练习题

### 基础题

1. 镜像和容器有什么区别？为什么同一个镜像可以启动多个容器？
2. 为什么数据库容器需要数据卷？如果不挂载数据卷会发生什么？
3. `-p 127.0.0.1:18080:18080` 中三个部分分别是什么意思？
4. 容器内访问另一个容器时，为什么应该使用容器名而不是 `127.0.0.1`？
5. `docker ps` 和 `docker ps -a` 的区别是什么？

### 实操题

1. 把 Todo API 的宿主机映射端口改为 `18081`，验证 `curl -i http://127.0.0.1:18081/healthz` 返回 `200 OK`。当 `docker port todo-api` 显示 `127.0.0.1:18081` 时，说明操作成功。
2. 停止并删除 `todo-api` 容器，然后用相同参数重新启动。验证 PostgreSQL 中之前创建的 Todo 是否仍然存在。当重新登录后能查询到旧数据时，说明数据卷生效。
3. 故意把 `TODO_REDIS_ADDR` 改成 `127.0.0.1:6379` 启动 API，观察日志中的连接错误。修复为 `todo-redis:6379` 后重新启动，当日志不再出现 Redis 连接错误时，说明你理解了容器网络地址。

### 思考题

1. 如果测试同学说“我本机 Docker 里能跑，但 CI 里跑不起来”，你会从镜像、网络、端口、环境变量、数据卷哪些方向排查？
2. 本篇用 `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm` 加源码挂载运行 API。它适合本地学习，但为什么不适合生产发布？

## 10. 本章面试题

### 面试题 1：Docker 镜像和容器有什么区别？

**一句话结论**：镜像是只读模板，容器是镜像运行起来后的进程实例。

**展开解释**：镜像包含文件系统、运行时、程序和默认命令，可以被推送到仓库并在不同机器上拉取。容器是在镜像基础上创建的运行实例，有自己的可写层、进程、网络和挂载。删除容器不会删除镜像，删除镜像也不能影响已经运行中的容器进程，除非先停止并删除相关容器。

**深入追问**：镜像通常由多层只读层组成，容器启动时会叠加一个可写层。数据库这类有状态数据不应依赖容器可写层，而应使用 Volume、持久化存储或外部数据库服务。

### 面试题 2：容器内为什么不能用 127.0.0.1 访问另一个容器？

**一句话结论**：每个容器有自己的网络命名空间，容器内的 `127.0.0.1` 只指向容器自己。

**展开解释**：Docker 为容器提供隔离的网络环境。API 容器里的 `127.0.0.1:5432` 表示 API 容器内部的 5432 端口，不是 PostgreSQL 容器，也不是宿主机映射端口。容器之间应加入同一个 Docker 网络，并通过容器名或网络别名访问，例如 `todo-postgres:5432`。

**深入追问**：这和 Kubernetes 中通过 Service DNS 访问依赖服务的思想一致。进入 Kubernetes 后，应用也不应该写 Pod IP，而应该访问稳定的 Service 名称。

### 面试题 3：Docker Volume 解决什么问题？

**一句话结论**：Volume 用来把数据从容器生命周期中独立出来，避免删除容器时数据丢失。

**展开解释**：容器可写层适合临时文件，不适合数据库持久化。PostgreSQL 和 Redis 需要把数据目录挂载到 Volume。这样容器删除后，Volume 仍然保留，重新创建容器时可以继续使用原有数据。

**深入追问**：Volume 不是备份。生产环境仍然需要备份、恢复演练、权限控制、容量监控和升级策略。进入 Kubernetes 后，同类问题会演进为 PersistentVolume 和 PersistentVolumeClaim。

### 面试题 4：如何排查一个容器启动后立刻退出？

**一句话结论**：先看 `docker ps -a` 确认退出状态，再看 `docker logs` 和 `docker inspect` 找退出原因。

**展开解释**：`docker ps` 只显示运行中容器，退出容器要用 `docker ps -a`。日志能看到应用启动失败原因，例如配置缺失、端口错误、数据库连接失败。`docker inspect` 可以查看退出码、启动命令、环境变量、挂载和网络。排查顺序通常是状态、日志、退出码、启动参数、依赖服务。

**深入追问**：退出码 125 往往是 Docker 参数错误，126/127 常见于命令不可执行或不存在，137 常见于 SIGKILL 或 OOM。进入 Kubernetes 后，这类问题会表现为 CrashLoopBackOff。

### 面试题 5：Dockerfile、docker run 和 Docker Compose 分别解决什么问题？

**一句话结论**：Dockerfile 定义镜像怎么构建，`docker run` 定义容器怎么启动，Docker Compose 定义一组服务如何一起运行。

**展开解释**：本篇的 `docker run` 手动指定了镜像、环境变量、端口、数据卷和网络。第 16 篇会用 Dockerfile 把 Todo API 变成可分发的镜像。第 17 篇会用 Compose 把 API、PostgreSQL、Redis 的启动参数写成声明式 YAML，一条命令启动完整环境。

**深入追问**：生产环境通常不会手动 `docker run`。镜像由 CI 构建并推送到仓库，运行参数由 Compose、Kubernetes、Helm、GitOps 或云平台托管。核心是可审查、可回滚、可复现。

## 11. 本章总结

本篇把阶段二的 Todo API 放进了 Docker 运行环境。你学习了镜像、容器、仓库、端口映射、数据卷和 Docker 网络，理解了 Docker CLI 到 Docker daemon、镜像仓库、本地镜像和容器进程之间的基本链路。你还手动启动了 PostgreSQL、Redis 和 Todo API 三个容器，完成了迁移、登录、带 Token 创建 Todo、日志查看、网络检查和资源清理。

项目成果上，Todo Platform 已经不再依赖本机手动安装 PostgreSQL 和 Redis，而是可以通过 Docker 复现完整依赖环境。本篇仍然使用 Go 官方镜像运行源码，这是教学阶段的过渡方案，不是生产发布方式。

能力价值上，你已经能胜任基础容器运行、容器日志查看、端口和网络排障、数据卷生命周期管理等工作任务。后续写 Dockerfile、Compose 和 Kubernetes YAML 时，本篇的每一个命令参数都会变成更高层配置的一部分。

## 12. 下一章衔接

第 16 篇会把本篇的 `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm + 源码挂载 + go run` 改造成真正的 Todo API 镜像。你将学习 Dockerfile、多阶段构建、构建缓存、`.dockerignore`、非 root 用户和镜像安全。如果跳过本篇，下一章里 `EXPOSE`、`CMD`、镜像标签、端口映射和运行用户这些概念会缺少运行经验支撑。
