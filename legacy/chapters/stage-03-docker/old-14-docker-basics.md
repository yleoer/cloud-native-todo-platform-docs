# 第 14 篇：Docker 基础

阶段二已经把 Todo Platform 打造成了一个具备认证、配置、日志、数据库迁移和运维命令的 Go 后端服务。从这一篇开始，课程进入 **Docker 容器技术**。

Docker 的第一价值不是“看起来更高级”，而是让应用、依赖和运行环境可以被清晰地打包、隔离、启动、销毁和复现。对于后端开发、测试、DevOps、SRE 和 Kubernetes 学习者来说，Docker 是从本地开发走向云原生部署的第一座桥。

本篇特色项目是：**使用 Docker 运行 Todo API、PostgreSQL、Redis**。

本篇暂时不编写 Dockerfile，也不编写 Docker Compose YAML。Todo API 会使用官方 `golang` 镜像加代码目录挂载的方式运行。下一篇会正式把 Todo API 构建成自己的应用镜像，第 16 篇再把多容器启动命令整理成 Compose 编排文件。

## 1. 本章学习目标

学完本篇后，你应该能够：

- 说明 Docker 解决了环境不一致、依赖隔离和交付复现问题。
- 区分镜像、容器、仓库、数据卷、端口映射和 Docker 网络。
- 熟练使用 `docker run`、`docker ps`、`docker logs`、`docker exec`、`docker stop`、`docker rm`、`docker inspect` 等基础命令。
- 能用 Docker 启动 PostgreSQL 和 Redis，并通过网络别名让 Todo API 访问它们。
- 能把宿主机目录挂载到容器中运行 Go 服务。
- 能排查容器未启动、端口冲突、网络不通、数据未持久化、日志异常等基础问题。
- 能说明开发环境 Docker 使用方式和生产环境容器运行要求的差异。

本篇完成后，你会得到一个本地容器化运行环境：

```text
宿主机 curl
    |
    | 127.0.0.1:8080
    v
todo-api 容器
    |
    | Docker bridge 网络 todo-net
    +---- todo-postgres:5432
    |
    +---- todo-redis:6379
```

## 2. 本章工作场景

真实公司中，后端服务往往不会只依赖一个二进制文件。一个 API 服务可能还需要 PostgreSQL、Redis、消息队列、对象存储、本地回调服务等依赖。

如果每个同事都在本机手动安装这些依赖，会很容易出现问题：

- A 同事 PostgreSQL 是 15，B 同事是 16。
- 有人 Redis 没设置密码，有人设置了密码。
- Windows、macOS、Linux 的安装路径和启动方式不同。
- 测试同学复现问题时，数据库初始化脚本版本不一致。
- 新人入职第一天大半时间都耗在安装环境上。

Docker 可以把这些依赖变成可重复运行的容器命令。团队可以约定：本地开发统一使用 `postgres:16`、`redis:7`，统一网络名、容器名、端口映射和数据卷。这样后端开发、测试、CI 和后续 Kubernetes 部署就有了共同语言。

本章模拟一个典型任务：

> Todo API 已经具备 Go 后端能力。现在需要把 PostgreSQL、Redis 和 Todo API 都放进 Docker 中运行，让开发者只依赖 Docker 就能启动完整服务，并能排查基础容器问题。

## 3. 前置知识

必须掌握：

- 第 1 篇的 Docker 安装和基础命令验证。
- 第 4 篇的端口、监听地址、DNS 和 HTTP 排障。
- 第 10 篇的 Todo API HTTP 服务。
- 第 11 篇的 PostgreSQL DSN 和数据库迁移。
- 第 12 篇的 Redis 地址、密码和缓存/限流能力。
- 第 13 篇的 `serve`、`migrate`、`hash-password`、`config-check` 命令。

建议了解：

- Linux 当前目录、相对路径和环境变量。
- `curl` 基础用法。
- `localhost`、`127.0.0.1`、`0.0.0.0` 的区别。

本篇实验需要：

| 工具 | 要求 | 说明 |
|---|---|---|
| Docker | Docker Desktop 或 Docker Engine | 能执行 `docker version` |
| Todo Platform 代码 | 已完成第 13 篇 | 需要 `cmd/todo-api`、`configs`、`migrations` |
| curl | 必需 | 验证 HTTP 接口 |
| Git Bash / WSL2 / PowerShell | 三选一 | Windows 推荐 WSL2 或 PowerShell |

!!! note "关于 Windows"
    Windows 推荐使用 Docker Desktop + WSL2 后端。运行目录挂载命令前，请确认 Docker Desktop 已启用 WSL integration，或当前项目所在磁盘允许被 Docker 访问。

## 4. 核心概念

### 4.1 Docker 解决什么问题

Docker 主要解决三类问题。

第一，环境一致性。应用依赖的操作系统库、运行时、命令行工具和配置可以被固定下来，减少“我电脑上可以跑”的问题。

第二，依赖隔离。PostgreSQL、Redis、Todo API 可以运行在不同容器中，它们有各自的进程空间、文件系统和网络身份。

第三，交付复现。团队可以通过镜像标签、启动参数和环境变量复现同一套运行环境，后续 CI/CD 和 Kubernetes 都会沿用这个思路。

### 4.2 镜像

镜像是容器的只读模板。你可以把它理解为：

```text
应用程序 + 运行时 + 文件系统快照 + 默认启动命令
```

例如：

- `postgres:16`：包含 PostgreSQL 16。
- `redis:7`：包含 Redis 7。
- `golang:1.26`：包含 Go 1.26 工具链。

镜像通常从镜像仓库拉取：

```bash
docker pull postgres:16
```

这里的 `postgres` 是镜像名，`16` 是标签。生产环境不建议长期使用 `latest`，因为它会让运行结果随时间变化。

### 4.3 容器

容器是镜像运行起来后的进程实例。同一个镜像可以启动多个容器：

```text
postgres:16 镜像
    ├── todo-postgres 容器
    └── test-postgres 容器
```

容器有生命周期：

```text
create -> start -> running -> stop -> remove
```

常见命令：

```bash
docker ps
docker stop todo-postgres
docker start todo-postgres
docker rm todo-postgres
```

### 4.4 仓库

仓库用于保存和分发镜像。常见仓库包括：

- Docker Hub。
- GitHub Container Registry。
- Harbor。
- 云厂商容器镜像仓库。

本篇只使用官方公共镜像。后续第 15 篇会构建 Todo API 镜像，第 27 篇会把镜像构建纳入 CI/CD。

### 4.5 数据卷

容器默认文件系统会随着容器删除而消失。数据库这类有状态服务不能把数据只放在容器可写层中。

Docker Volume 用来持久化数据：

```text
todo-postgres-data 数据卷 -> /var/lib/postgresql/data
todo-redis-data    数据卷 -> /data
```

删除容器不等于删除数据卷。这个特性对数据库非常重要。

### 4.6 端口映射

容器内部服务监听的是容器自己的端口。宿主机要访问容器服务，需要端口映射：

```text
宿主机 127.0.0.1:8080  -> 容器 8080
宿主机 127.0.0.1:15432 -> 容器 5432
宿主机 127.0.0.1:16379 -> 容器 6379
```

命令格式：

```bash
docker run -p 127.0.0.1:宿主机端口:容器端口 ...
```

本篇使用 `15432` 和 `16379` 映射数据库与 Redis，是为了避免和本机已安装的 PostgreSQL、Redis 端口冲突。端口映射绑定到 `127.0.0.1`，表示只允许本机访问，避免把本地实验服务暴露到局域网。容器之间访问仍然使用内部端口 `5432` 和 `6379`。

### 4.7 Docker 网络

默认情况下，容器可以通过 Docker bridge 网络互相通信。我们会创建一个自定义网络：

```bash
docker network create todo-net
```

加入同一个自定义网络后，容器可以通过容器名互相解析：

```text
todo-api -> todo-postgres:5432
todo-api -> todo-redis:6379
```

这和后续 Kubernetes Service DNS 的思路很像。

## 5. 原理深入

### 5.1 Docker 基本运行链路

```mermaid
flowchart LR
    CLI["docker CLI"] --> Daemon["Docker daemon"]
    Daemon --> Registry["镜像仓库"]
    Registry --> Image["本地镜像"]
    Image --> Container["容器进程"]
    Container --> Log["stdout / stderr 日志"]
    Container --> Volume["数据卷"]
    Container --> Network["Docker 网络"]
```

执行 `docker run postgres:16` 时，大致发生了这些事：

1. Docker CLI 把请求发送给 Docker daemon。
2. Docker daemon 检查本地是否已有 `postgres:16` 镜像。
3. 如果本地没有，就从镜像仓库拉取。
4. 基于镜像创建容器文件系统。
5. 挂载数据卷、配置网络、设置环境变量和端口映射。
6. 启动容器里的主进程。
7. 主进程输出到 stdout / stderr，`docker logs` 可以查看。

### 5.2 镜像层和容器可写层

镜像由多层只读层组成，容器启动时会在最上面加一个可写层：

```text
容器可写层       <- 容器运行时写入的临时文件
镜像层 N
镜像层 N-1
镜像层 ...
基础镜像层
```

如果把数据库数据写在容器可写层，删除容器后数据会消失。因此数据库必须使用数据卷。

### 5.3 容器不是虚拟机

容器不是完整虚拟机。容器内进程仍然运行在宿主机内核之上，只是通过 Linux namespace、cgroup、文件系统层等机制实现隔离和资源控制。

这意味着：

- 容器启动通常比虚拟机快。
- 容器镜像通常比虚拟机镜像小。
- 容器隔离不是安全边界的全部，生产环境仍然要考虑用户权限、内核能力、只读文件系统、镜像漏洞和运行时策略。

### 5.4 监听地址为什么要用 `0.0.0.0`

Go API 在容器里如果只监听 `127.0.0.1:8080`，这个 `127.0.0.1` 指的是容器自己的回环地址。即使做了 `-p 127.0.0.1:8080:8080`，宿主机也可能访问不到服务。

容器内服务通常应该监听：

```text
0.0.0.0:8080
```

这表示监听容器内所有网卡。端口映射后，宿主机才能通过 `127.0.0.1:8080` 访问。

### 5.5 容器 DNS 与服务发现

在自定义 Docker 网络中，Docker 会为容器名提供 DNS 解析。Todo API 使用：

```text
postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable
```

这里的 `todo-postgres` 不是公网域名，而是 Docker 网络中的容器名。后续进入 Kubernetes 后，会用 Service 名称完成类似的服务发现。

## 6. 手把手实验

### 6.1 实验目标

本实验会完成：

- 验证 Docker 可用。
- 拉取并运行官方镜像。
- 创建 Docker 网络 `todo-net`。
- 创建 PostgreSQL 和 Redis 数据卷。
- 使用 Docker 运行 PostgreSQL、Redis。
- 使用官方 `golang:1.26` 镜像运行 Todo API。
- 完成数据库迁移、密码哈希生成、登录和 Todo 接口访问。
- 查看日志、进入容器、检查网络、停止和清理容器。

本篇实验只使用 Docker CLI，不引入 YAML。这样做是为了先把镜像、容器、网络、数据卷和端口映射这些基础概念讲透，再进入后续 Dockerfile 与 Docker Compose。

### 6.2 实验环境

请先进入 Todo Platform 项目根目录。根目录下应该能看到：

```text
cloud-native-todo-platform/
├── cmd/todo-api/
├── configs/
├── go.mod
├── internal/
└── migrations/
```

验证当前目录：

=== "Linux / macOS / WSL2"

    ```bash
    pwd
    ls
    test -f go.mod && test -d cmd/todo-api && echo "project root ok"
    ```

=== "Windows PowerShell"

    ```powershell
    Get-Location
    Get-ChildItem
    if ((Test-Path go.mod) -and (Test-Path cmd/todo-api)) { "project root ok" }
    ```

为什么要从项目根目录执行？因为后面会把当前目录挂载到容器的 `/workspace`，让 `golang` 容器直接运行课程项目代码。

### 6.3 验证 Docker

执行：

=== "Linux / macOS / WSL2"

    ```bash
    docker version
    docker info
    docker run --rm hello-world
    ```

=== "Windows PowerShell"

    ```powershell
    docker version
    docker info
    docker run --rm hello-world
    ```

预期现象：

- `docker version` 能看到 Client 和 Server。
- `docker info` 能看到 Docker Root Dir、Storage Driver、Operating System。
- `hello-world` 能正常输出欢迎信息。

如果只看到 Client，看不到 Server，通常说明 Docker daemon 没启动。Windows 和 macOS 需要启动 Docker Desktop；Linux 需要检查 `docker` 服务。

### 6.4 实验前检查与重复执行准备

Docker 实验经常需要重复执行。为了避免新手第二次练习时被旧容器、旧端口或旧网络卡住，先做三类检查。

第一，检查本篇需要用到的宿主机端口：

=== "Linux / macOS / WSL2"

    ```bash
    if command -v ss >/dev/null 2>&1; then
      ss -ltnp | grep -E ':(8080|15432|16379)\b' || true
    elif command -v lsof >/dev/null 2>&1; then
      lsof -nP -iTCP:8080 -iTCP:15432 -iTCP:16379 -sTCP:LISTEN || true
    else
      netstat -an | grep -E '[:.](8080|15432|16379)[[:space:]]' || true
    fi
    ```

=== "Windows PowerShell"

    ```powershell
    Get-NetTCPConnection -State Listen -LocalPort 8080,15432,16379 -ErrorAction SilentlyContinue |
      Select-Object LocalAddress,LocalPort,OwningProcess
    ```

如果没有输出，说明这几个端口当前没有监听进程。如果有输出，需要先停止对应程序，或把后续 `-p` 参数中的宿主机端口改成其他端口。

第二，清理可能残留的旧容器，但保留数据卷：

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-api todo-postgres todo-redis 2>/dev/null || true
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-api todo-postgres todo-redis 2>$null
    ```

删除容器不会删除 `todo-postgres-data` 和 `todo-redis-data` 数据卷。这样既能避免容器名冲突，也不会误删数据库数据。

第三，确认当前目录可以被 Docker 挂载。如果后续 Go 容器里看不到 `/workspace/go.mod`，通常是 Docker Desktop 没有开启文件共享或 WSL integration。

### 6.5 创建项目网络

创建自定义网络：

=== "Linux / macOS / WSL2"

    ```bash
    docker network inspect todo-net >/dev/null 2>&1 || docker network create todo-net
    docker network ls --filter name=todo-net
    ```

=== "Windows PowerShell"

    ```powershell
    if (-not (docker network ls --format "{{.Name}}" | Select-String -SimpleMatch "todo-net")) {
      docker network create todo-net
    }
    docker network ls --filter name=todo-net
    ```

如果想确认网络详细信息，可以执行：

```bash
docker network inspect todo-net
```

为什么要创建网络？因为 Todo API、PostgreSQL、Redis 需要通过稳定名称互相访问。如果只依赖随机容器 IP，容器重建后地址可能变化。

### 6.6 创建数据卷

执行：

=== "Linux / macOS / WSL2"

    ```bash
    docker volume create todo-postgres-data
    docker volume create todo-redis-data
    docker volume ls
    ```

=== "Windows PowerShell"

    ```powershell
    docker volume create todo-postgres-data
    docker volume create todo-redis-data
    docker volume ls
    ```

这两个卷分别保存：

| 数据卷 | 挂载位置 | 用途 |
|---|---|---|
| `todo-postgres-data` | `/var/lib/postgresql/data` | PostgreSQL 数据目录 |
| `todo-redis-data` | `/data` | Redis AOF/RDB 数据目录 |

### 6.7 启动 PostgreSQL

执行：

=== "Linux / macOS / WSL2"

    ```bash
    docker run -d --name todo-postgres \
      --network todo-net \
      -p 127.0.0.1:15432:5432 \
      -v todo-postgres-data:/var/lib/postgresql/data \
      -e POSTGRES_USER=todo \
      -e POSTGRES_PASSWORD=todo_password \
      -e POSTGRES_DB=todo_platform \
      postgres:16
    ```

=== "Windows PowerShell"

    ```powershell
    docker run -d --name todo-postgres `
      --network todo-net `
      -p 127.0.0.1:15432:5432 `
      -v todo-postgres-data:/var/lib/postgresql/data `
      -e POSTGRES_USER=todo `
      -e POSTGRES_PASSWORD=todo_password `
      -e POSTGRES_DB=todo_platform `
      postgres:16
    ```

参数解释：

| 参数 | 作用 |
|---|---|
| `-d` | 后台运行容器 |
| `--name todo-postgres` | 固定容器名，方便网络访问和排障 |
| `--network todo-net` | 加入项目网络 |
| `-p 127.0.0.1:15432:5432` | 宿主机本地地址 `127.0.0.1:15432` 映射到容器 `5432` |
| `-v todo-postgres-data:/var/lib/postgresql/data` | 持久化数据库数据 |
| `POSTGRES_USER` | 初始化数据库用户 |
| `POSTGRES_PASSWORD` | 初始化数据库密码 |
| `POSTGRES_DB` | 初始化数据库名 |

等待 PostgreSQL ready：

=== "Linux / macOS / WSL2"

    ```bash
    until docker exec todo-postgres pg_isready -U todo -d todo_platform >/dev/null 2>&1; do
      echo "waiting for postgres..."
      sleep 1
    done
    ```

=== "Windows PowerShell"

    ```powershell
    do {
      docker exec todo-postgres pg_isready -U todo -d todo_platform | Out-Null
      if ($LASTEXITCODE -ne 0) {
        "waiting for postgres..."
        Start-Sleep -Seconds 1
      }
    } while ($LASTEXITCODE -ne 0)
    ```

容器启动成功不等于数据库已经可以接收连接。`pg_isready` 可以避免后续迁移命令因为数据库还没初始化完而失败。

验证：

=== "Linux / macOS / WSL2"

    ```bash
    docker ps --filter name=todo-postgres
    docker logs --tail 30 todo-postgres
    docker exec -it todo-postgres psql -U todo -d todo_platform -c "SELECT version();"
    ```

=== "Windows PowerShell"

    ```powershell
    docker ps --filter name=todo-postgres
    docker logs --tail 30 todo-postgres
    docker exec -it todo-postgres psql -U todo -d todo_platform -c "SELECT version();"
    ```

预期能看到 PostgreSQL 版本信息。

### 6.8 启动 Redis

执行：

=== "Linux / macOS / WSL2"

    ```bash
    docker run -d --name todo-redis \
      --network todo-net \
      -p 127.0.0.1:16379:6379 \
      -v todo-redis-data:/data \
      redis:7 redis-server --requirepass todo_redis_password --appendonly yes
    ```

=== "Windows PowerShell"

    ```powershell
    docker run -d --name todo-redis `
      --network todo-net `
      -p 127.0.0.1:16379:6379 `
      -v todo-redis-data:/data `
      redis:7 redis-server --requirepass todo_redis_password --appendonly yes
    ```

参数解释：

| 参数 | 作用 |
|---|---|
| `--name todo-redis` | 固定 Redis 容器名 |
| `-p 127.0.0.1:16379:6379` | 宿主机本地地址 `127.0.0.1:16379` 映射到容器 `6379` |
| `-v todo-redis-data:/data` | 持久化 Redis 数据 |
| `--requirepass` | 设置 Redis 密码 |
| `--appendonly yes` | 开启 AOF 持久化 |

等待 Redis ready：

=== "Linux / macOS / WSL2"

    ```bash
    until docker exec todo-redis redis-cli -a todo_redis_password PING 2>/dev/null | grep -q PONG; do
      echo "waiting for redis..."
      sleep 1
    done
    ```

=== "Windows PowerShell"

    ```powershell
    do {
      $pong = docker exec todo-redis redis-cli -a todo_redis_password PING 2>$null
      if ($pong -ne "PONG") {
        "waiting for redis..."
        Start-Sleep -Seconds 1
      }
    } while ($pong -ne "PONG")
    ```

Redis 容器启动很快，但仍然建议显式验证 `PING`，这样后续 Todo API 连接 Redis 时更容易判断问题边界。

验证：

=== "Linux / macOS / WSL2"

    ```bash
    docker ps --filter name=todo-redis
    docker logs --tail 30 todo-redis
    docker exec -it todo-redis redis-cli -a todo_redis_password PING
    ```

=== "Windows PowerShell"

    ```powershell
    docker ps --filter name=todo-redis
    docker logs --tail 30 todo-redis
    docker exec -it todo-redis redis-cli -a todo_redis_password PING
    ```

预期输出：

```text
PONG
```

`redis-cli -a` 在终端中会暴露密码，课程实验可以接受。生产环境应通过 Secret、受控终端和权限管理降低泄露风险。

### 6.9 使用容器执行数据库迁移

现在 PostgreSQL 已经在 `todo-net` 中运行。Todo API 的迁移命令可以通过官方 Go 镜像执行。

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm --network todo-net \
      -v "$PWD:/workspace" \
      -w /workspace \
      -e TODO_CONFIG_DIR=configs \
      -e TODO_ENV=dev \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      golang:1.26 \
      go run ./cmd/todo-api migrate
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm --network todo-net `
      -v "${PWD}:/workspace" `
      -w /workspace `
      -e TODO_CONFIG_DIR=configs `
      -e TODO_ENV=dev `
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' `
      golang:1.26 `
      go run ./cmd/todo-api migrate
    ```

参数解释：

| 参数 | 作用 |
|---|---|
| `--rm` | 命令执行结束后自动删除临时容器 |
| `--network todo-net` | 让迁移命令能访问 `todo-postgres` |
| `-v "$PWD:/workspace"` | 把当前代码目录挂载进容器 |
| `-w /workspace` | 设置容器工作目录 |
| `TODO_DATABASE_DSN` | 使用 Docker 网络中的 PostgreSQL 地址 |
| `golang:1.26` | 使用官方 Go 镜像执行项目命令 |

第一次运行可能会下载 Go module，时间会稍长。

验证表是否创建：

=== "Linux / macOS / WSL2"

    ```bash
    docker exec -it todo-postgres psql -U todo -d todo_platform -c "\dt"
    docker exec -it todo-postgres psql -U todo -d todo_platform -c "SELECT version FROM schema_migrations;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker exec -it todo-postgres psql -U todo -d todo_platform -c "\dt"
    docker exec -it todo-postgres psql -U todo -d todo_platform -c "SELECT version FROM schema_migrations;"
    ```

预期能看到 `todos` 和 `schema_migrations` 等表，迁移版本包含 `000001_create_todos`。

### 6.10 生成登录密码哈希

Todo API 第 13 篇已经要求不保存明文密码。先在 Go 容器中生成 Argon2id 哈希：

=== "Linux / macOS / WSL2"

    ```bash
    HASH=$(docker run --rm \
      -v "$PWD:/workspace" \
      -w /workspace \
      -e TODO_CONFIG_DIR=configs \
      -e TODO_ENV=dev \
      golang:1.26 \
      go run ./cmd/todo-api hash-password "change-me-123")

    echo "$HASH"
    ```

=== "Windows PowerShell"

    ```powershell
    $hash = docker run --rm `
      -v "${PWD}:/workspace" `
      -w /workspace `
      -e TODO_CONFIG_DIR=configs `
      -e TODO_ENV=dev `
      golang:1.26 `
      go run ./cmd/todo-api hash-password "change-me-123"

    $hash
    ```

预期输出类似：

```text
argon2id$v=19$m=65536,t=3,p=2$...$...
```

注意哈希中包含 `$`。如果你手动复制到 shell 环境变量中，建议使用单引号，避免 `$v`、`$m` 被 shell 当成变量解析。本实验后面会直接使用 `HASH` 或 `$hash` 变量。

### 6.11 启动前执行配置检查

启动服务前，先在 Go 容器中执行一次 `config-check`。这一步不会启动 HTTP 服务，只检查配置是否能被正确加载。

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm --network todo-net \
      -v "$PWD:/workspace" \
      -w /workspace \
      -e TODO_CONFIG_DIR=configs \
      -e TODO_ENV=dev \
      -e TODO_HTTP_ADDR=0.0.0.0:8080 \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      -e TODO_REDIS_ADDR='todo-redis:6379' \
      -e TODO_REDIS_PASSWORD='todo_redis_password' \
      -e TODO_JWT_SECRET='0123456789abcdef0123456789abcdef' \
      -e "TODO_AUTH_USERS=admin=$HASH" \
      golang:1.26 \
      go run ./cmd/todo-api config-check
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm --network todo-net `
      -v "${PWD}:/workspace" `
      -w /workspace `
      -e TODO_CONFIG_DIR=configs `
      -e TODO_ENV=dev `
      -e TODO_HTTP_ADDR=0.0.0.0:8080 `
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' `
      -e TODO_REDIS_ADDR='todo-redis:6379' `
      -e TODO_REDIS_PASSWORD='todo_redis_password' `
      -e TODO_JWT_SECRET='0123456789abcdef0123456789abcdef' `
      -e "TODO_AUTH_USERS=admin=$hash" `
      golang:1.26 `
      go run ./cmd/todo-api config-check
    ```

预期能看到 `env`、`http_addr`、`data_path`、`auth_users` 等配置摘要。如果这里失败，先修复配置，不要急着启动服务。

### 6.12 启动 Todo API

执行：

=== "Linux / macOS / WSL2"

    ```bash
    docker run -d --name todo-api \
      --network todo-net \
      -p 127.0.0.1:8080:8080 \
      -v "$PWD:/workspace" \
      -w /workspace \
      -e TODO_CONFIG_DIR=configs \
      -e TODO_ENV=dev \
      -e TODO_HTTP_ADDR=0.0.0.0:8080 \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      -e TODO_REDIS_ADDR='todo-redis:6379' \
      -e TODO_REDIS_PASSWORD='todo_redis_password' \
      -e TODO_JWT_SECRET='0123456789abcdef0123456789abcdef' \
      -e "TODO_AUTH_USERS=admin=$HASH" \
      golang:1.26 \
      go run ./cmd/todo-api serve
    ```

=== "Windows PowerShell"

    ```powershell
    docker run -d --name todo-api `
      --network todo-net `
      -p 127.0.0.1:8080:8080 `
      -v "${PWD}:/workspace" `
      -w /workspace `
      -e TODO_CONFIG_DIR=configs `
      -e TODO_ENV=dev `
      -e TODO_HTTP_ADDR=0.0.0.0:8080 `
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' `
      -e TODO_REDIS_ADDR='todo-redis:6379' `
      -e TODO_REDIS_PASSWORD='todo_redis_password' `
      -e TODO_JWT_SECRET='0123456789abcdef0123456789abcdef' `
      -e "TODO_AUTH_USERS=admin=$hash" `
      golang:1.26 `
      go run ./cmd/todo-api serve
    ```

这里有几个关键点：

- `TODO_HTTP_ADDR=0.0.0.0:8080` 让服务在容器内对所有网卡监听。
- `TODO_DATABASE_DSN` 使用 `todo-postgres:5432`，不是 `127.0.0.1:15432`。
- `TODO_REDIS_ADDR` 使用 `todo-redis:6379`，不是 `127.0.0.1:16379`。
- `-p 127.0.0.1:8080:8080` 只把 API 暴露给宿主机本机，避免局域网其他机器访问实验服务。
- 当前目录通过 `-v` 挂载进容器，所以代码修改后重启容器即可生效。

查看启动状态：

=== "Linux / macOS / WSL2"

    ```bash
    docker ps --filter name=todo-api
    docker logs --tail 50 todo-api
    ```

=== "Windows PowerShell"

    ```powershell
    docker ps --filter name=todo-api
    docker logs --tail 50 todo-api
    ```

### 6.13 验证 API

健康检查：

=== "Linux / macOS / WSL2"

    ```bash
    curl -i http://127.0.0.1:8080/healthz
    ```

=== "Windows PowerShell"

    ```powershell
    curl.exe -i http://127.0.0.1:8080/healthz
    ```

预期返回 `200 OK`。

登录并创建 Todo：

=== "Linux / macOS / WSL2"

    如果已经安装 `jq`：

    ```bash
    TOKEN=$(curl -s -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:8080/api/v1/auth/login | jq -r '.data.token')

    curl -s -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"title":"run todo api with docker"}' \
      http://127.0.0.1:8080/api/v1/todos
    ```

    如果没有安装 `jq`，先打印登录响应，再手动复制 `data.token`：

    ```bash
    curl -s -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:8080/api/v1/auth/login

    TOKEN='<复制 data.token 字段>'

    curl -s -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"title":"run todo api with docker"}' \
      http://127.0.0.1:8080/api/v1/todos
    ```

=== "Windows PowerShell"

    ```powershell
    $login = curl.exe -s -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"change-me-123\"}" http://127.0.0.1:8080/api/v1/auth/login | ConvertFrom-Json
    $token = $login.data.token
    curl.exe -s -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"title\":\"run todo api with docker\"}" http://127.0.0.1:8080/api/v1/todos
    ```

验证无 Token 被拒绝：

=== "Linux / macOS / WSL2"

    ```bash
    curl -i http://127.0.0.1:8080/api/v1/todos
    ```

=== "Windows PowerShell"

    ```powershell
    curl.exe -i http://127.0.0.1:8080/api/v1/todos
    ```

预期返回 `401 Unauthorized`。

### 6.14 查看容器日志

查看最近日志：

=== "Linux / macOS / WSL2"

    ```bash
    docker logs --tail 100 todo-api
    docker logs --tail 100 todo-postgres
    docker logs --tail 100 todo-redis
    ```

=== "Windows PowerShell"

    ```powershell
    docker logs --tail 100 todo-api
    docker logs --tail 100 todo-postgres
    docker logs --tail 100 todo-redis
    ```

持续跟踪日志：

```bash
docker logs -f todo-api
```

容器最佳实践是把应用日志输出到 stdout / stderr，而不是只写容器内部文件。这样 Docker、Kubernetes 和日志采集系统都能统一收集。

### 6.15 进入容器排查

进入 Todo API 容器：

=== "Linux / macOS / WSL2"

    ```bash
    docker exec -it todo-api sh
    pwd
    ls
    env | sort | grep '^TODO_'
    exit
    ```

=== "Windows PowerShell"

    ```powershell
    docker exec -it todo-api sh
    pwd
    ls
    env | sort | grep '^TODO_'
    exit
    ```

进入 PostgreSQL 容器查看表：

```bash
docker exec -it todo-postgres psql -U todo -d todo_platform
```

在 `psql` 中执行：

```sql
\dt
SELECT id, title, completed FROM todos ORDER BY created_at DESC LIMIT 5;
\q
```

进入容器不是日常操作的目标，但它是学习和排障阶段非常重要的观察窗口。生产环境通常会限制直接进入容器，更多依赖日志、指标、追踪和受控调试流程。

### 6.16 检查网络和端口

查看网络：

=== "Linux / macOS / WSL2"

    ```bash
    docker network inspect todo-net
    docker port todo-api
    docker port todo-postgres
    docker port todo-redis
    ```

=== "Windows PowerShell"

    ```powershell
    docker network inspect todo-net
    docker port todo-api
    docker port todo-postgres
    docker port todo-redis
    ```

重点看：

- 三个容器是否都在 `todo-net`。
- `todo-api` 是否映射了 `8080/tcp`。
- PostgreSQL 是否映射到宿主机 `127.0.0.1:15432`。
- Redis 是否映射到宿主机 `127.0.0.1:16379`。

从临时容器测试 DNS：

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm --network todo-net alpine:3.23 nslookup todo-postgres
    docker run --rm --network todo-net alpine:3.23 nslookup todo-redis
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm --network todo-net alpine:3.23 nslookup todo-postgres
    docker run --rm --network todo-net alpine:3.23 nslookup todo-redis
    ```

如果能解析到 IP，说明 Docker 网络 DNS 正常。

### 6.17 容器生命周期操作

查看所有课程容器：

```bash
docker ps -a --filter name=todo-
```

停止 Todo API：

```bash
docker stop todo-api
```

再次启动：

```bash
docker start todo-api
```

重启：

```bash
docker restart todo-api
```

删除 Todo API 容器：

```bash
docker rm -f todo-api
```

注意：删除 `todo-api` 容器不会删除你的代码，因为代码在宿主机目录中。删除 `todo-postgres` 容器也不会删除数据库数据，因为数据在 `todo-postgres-data` 数据卷中。

### 6.18 清理实验环境

如果只是停止服务，保留数据：

=== "Linux / macOS / WSL2"

    ```bash
    docker stop todo-api todo-postgres todo-redis
    ```

=== "Windows PowerShell"

    ```powershell
    docker stop todo-api todo-postgres todo-redis
    ```

如果要删除容器，但保留数据卷：

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-api todo-postgres todo-redis
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-api todo-postgres todo-redis
    ```

如果要完全清理本篇实验资源：

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-api todo-postgres todo-redis 2>/dev/null || true
    docker volume rm todo-postgres-data todo-redis-data
    docker network rm todo-net
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-api todo-postgres todo-redis
    docker volume rm todo-postgres-data todo-redis-data
    docker network rm todo-net
    ```

删除数据卷会删除 PostgreSQL 和 Redis 数据。执行前要确认这些数据不是你还需要的实验结果。

## 7. 真实工作案例

某团队开发订单系统时，后端服务依赖 PostgreSQL、Redis 和一个模拟支付回调服务。早期每个人都在本机安装依赖，结果经常出现版本不一致、端口冲突和初始化脚本漏执行。

团队后来统一用 Docker 管理本地依赖：

- PostgreSQL 和 Redis 使用固定镜像标签。
- 所有容器加入同一个项目网络。
- 数据库和缓存使用命名数据卷。
- API 服务通过环境变量读取依赖地址。
- README 中写清楚启动、验证、排障和清理命令。

职责边界通常是：

| 角色 | 关注点 |
|---|---|
| 后端开发 | 服务启动参数、数据库迁移、接口验证 |
| 测试 | 快速拉起一致环境，复现缺陷 |
| DevOps | 镜像仓库、容器运行参数、CI 环境 |
| SRE | 资源限制、日志采集、健康检查、故障恢复 |
| 架构师 | 容器化边界、镜像标准、网络与安全规范 |

本篇实验就是这个工作场景的缩小版。它不是最终生产部署方式，但能帮助你理解后续 Docker Compose、Kubernetes Deployment、ConfigMap、Secret、Service 和 PersistentVolume。

## 8. 常见错误

| 错误现象 | 常见原因 | 修复方向 |
|---|---|---|
| `Cannot connect to the Docker daemon` | Docker Desktop 或 Docker Engine 未启动 | 启动 Docker Desktop；Linux 检查 `systemctl status docker` |
| `port is already allocated` | 宿主机端口已被占用 | 换宿主机端口，或停止占用端口的进程 |
| `Conflict. The container name is already in use` | 已存在同名容器 | 使用 `docker ps -a` 查看，必要时 `docker rm -f <name>` |
| `migrate` 偶发连接失败 | PostgreSQL 容器启动了，但数据库还没 ready | 先执行 `pg_isready` 等待数据库可连接 |
| Todo API 启动后马上退出 | 配置缺失、认证用户为空、依赖连接失败 | 先执行容器内 `config-check`，再看 `docker logs todo-api` |
| Todo API 无法连接数据库 | DSN 写成 `127.0.0.1:15432` | 容器内应使用 `todo-postgres:5432` |
| 宿主机访问不到 API | API 只监听 `127.0.0.1:8080` | 设置 `TODO_HTTP_ADDR=0.0.0.0:8080` |
| Windows 挂载目录失败 | Docker Desktop 没有文件共享权限或路径格式不对 | 启用 WSL integration，使用 PowerShell `${PWD}` |
| 重新创建 PostgreSQL 后密码没变化 | 数据卷中已有旧初始化数据 | 删除旧数据卷后重新初始化 |
| Redis 返回 `NOAUTH Authentication required` | 没有传密码 | 使用 `redis-cli -a todo_redis_password`，应用设置 `TODO_REDIS_PASSWORD` |
| `go run` 下载依赖很慢 | 容器首次运行需要下载 Go module | 等待下载完成，或配置 Go module 代理 |
| 镜像拉取很慢或失败 | 网络无法访问 Docker Hub 或代理配置不稳定 | 重试、配置镜像加速、使用公司内部镜像仓库 |
| 登录一直 401 | `TODO_AUTH_USERS` 哈希被 shell 错误展开 | 用变量传入，手动复制时使用单引号 |
| `exec format error` | 镜像架构和宿主机架构不匹配 | 检查镜像平台，必要时指定 `--platform` |

## 9. 排障方法

### 9.1 先看容器状态

```bash
docker ps -a --filter name=todo-
```

重点看：

- `STATUS` 是 `Up` 还是 `Exited`。
- `PORTS` 是否包含预期端口映射。
- 容器名是否和命令中一致。

如果容器反复退出，下一步看日志。

### 9.2 查看日志

```bash
docker logs --tail 100 todo-api
docker logs --tail 100 todo-postgres
docker logs --tail 100 todo-redis
```

判断方式：

- Todo API 日志里如果出现 `connection refused`，优先检查数据库和 Redis 是否启动。
- PostgreSQL 日志里如果出现认证失败，检查用户名、密码、数据库名和 DSN。
- Redis 日志里如果没有启动完成信息，检查命令参数是否写错。

### 9.3 检查端口映射

```bash
docker port todo-api
docker port todo-postgres
docker port todo-redis
```

宿主机访问 API 用：

```text
http://127.0.0.1:8080
```

容器内访问 PostgreSQL 用：

```text
todo-postgres:5432
```

不要把宿主机端口和容器内部端口混用。

如果 `docker run` 提示端口被占用，先确认宿主机监听情况：

=== "Linux / macOS / WSL2"

    ```bash
    ss -ltnp | grep -E ':(8080|15432|16379)\b' || true
    ```

=== "Windows PowerShell"

    ```powershell
    Get-NetTCPConnection -State Listen -LocalPort 8080,15432,16379 -ErrorAction SilentlyContinue |
      Select-Object LocalAddress,LocalPort,OwningProcess
    ```

### 9.4 检查网络

```bash
docker network inspect todo-net
```

重点看 `Containers` 字段中是否包含 `todo-api`、`todo-postgres`、`todo-redis`。如果容器不在 `todo-net` 中，更推荐删除并按本篇命令重建容器，而不是临时手工补网络。课程实验要训练的是“用可复现命令创建正确状态”，不是把错误状态临时修好。

### 9.5 检查环境变量

```bash
docker exec -it todo-api sh
env | sort | grep '^TODO_'
exit
```

重点看：

- `TODO_HTTP_ADDR` 是否是 `0.0.0.0:8080`。
- `TODO_DATABASE_DSN` 是否使用 `todo-postgres:5432`。
- `TODO_REDIS_ADDR` 是否使用 `todo-redis:6379`。
- `TODO_AUTH_USERS` 是否存在且没有被截断。

### 9.6 检查数据卷

```bash
docker volume inspect todo-postgres-data
docker volume inspect todo-redis-data
```

如果你删除并重建 PostgreSQL 容器后发现数据库仍然存在，这是数据卷在起作用。如果你希望重新初始化数据库，需要先删除数据卷：

```bash
docker rm -f todo-postgres
docker volume rm todo-postgres-data
```

这会删除数据库数据，执行前要确认。

### 9.7 检查资源占用

```bash
docker stats
```

如果容器 CPU 或内存异常升高，先结合日志判断是否有循环重试、连接失败、请求风暴或缓存异常。生产环境还需要配置资源限制，避免单个容器拖垮宿主机。

### 9.8 检查依赖是否 ready

PostgreSQL：

```bash
docker exec todo-postgres pg_isready -U todo -d todo_platform
```

Redis：

```bash
docker exec todo-redis redis-cli -a todo_redis_password PING
```

如果 PostgreSQL 或 Redis 没有 ready，不要先怀疑 Todo API 代码。先看依赖容器日志、数据卷初始化状态和密码配置。

### 9.9 检查代码目录挂载

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace golang:1.26 ls go.mod cmd/todo-api
```

Windows PowerShell 使用：

```powershell
docker run --rm -v "${PWD}:/workspace" -w /workspace golang:1.26 ls go.mod cmd/todo-api
```

如果容器内看不到 `go.mod`，说明当前目录不对，或 Docker Desktop 没有权限挂载该路径。Windows 场景优先检查 Docker Desktop 的 WSL integration 和文件共享设置。

### 9.10 检查镜像拉取和平台架构

查看本地镜像：

=== "Linux / macOS / WSL2"

    ```bash
    docker image ls | grep -E '^(postgres|redis|golang)\b' || true
    ```

=== "Windows PowerShell"

    ```powershell
    docker image ls | Select-String -Pattern '^(postgres|redis|golang)\b'
    ```

查看镜像架构：

```bash
docker image inspect golang:1.26 --format '{{.Architecture}}/{{.Os}}'
```

如果 Apple Silicon、ARM 服务器或特殊开发机出现 `exec format error`，说明镜像平台可能不匹配。可以临时指定平台验证：

```bash
docker run --rm --platform linux/amd64 golang:1.26 go version
```

这只是排障手段。长期方案应选择适合团队机器和部署环境的平台镜像。

## 10. 生产环境注意事项

### 10.1 不要在生产中使用随意标签

开发环境可以为了方便使用 `redis:7`、`postgres:16`。生产环境更推荐使用明确版本甚至镜像 digest，例如：

```text
postgres:16.4
redis:7.4.1
```

这样回滚和审计更可控。

### 10.2 不要把密钥写进命令历史

本篇为了教学，把 `POSTGRES_PASSWORD`、`TODO_JWT_SECRET`、`TODO_REDIS_PASSWORD` 写在命令中。真实生产环境不应该这样做。

生产环境应使用：

- Kubernetes Secret。
- 云厂商 Secret Manager。
- CI/CD 密钥变量。
- 受权限控制的配置中心。

### 10.3 容器应以前台主进程方式运行

容器中应该有一个清晰的主进程，日志输出到 stdout / stderr。不要在容器里用传统方式启动多个后台守护进程。一个容器通常只负责一个主要职责。

### 10.4 数据卷要有备份策略

Docker Volume 可以让数据不随容器删除而消失，但它不是备份。生产数据库需要：

- 定期备份。
- 恢复演练。
- 监控磁盘容量。
- 明确的升级和回滚策略。

### 10.5 容器网络不是安全策略本身

把容器放进同一个 Docker 网络只是让它们能够通信，不等于已经完成安全隔离。生产环境还需要：

- 最小暴露端口。
- 网络访问控制。
- TLS。
- 防火墙或安全组。
- Kubernetes NetworkPolicy。

### 10.6 限制容器权限

生产容器应尽量：

- 使用非 root 用户运行。
- 避免 `--privileged`。
- 限制 Linux capabilities。
- 使用只读根文件系统。
- 配置 CPU、内存限制。
- 定期扫描镜像漏洞。

本篇使用的官方 `golang` 镜像适合开发和教学，不适合作为最终生产运行镜像。下一篇会构建更小、更可控的 Todo API 镜像。

### 10.7 配置资源限制和健康检查

生产容器不能只关注“能启动”。还要明确资源边界和健康状态：

- CPU、内存限制：避免单个容器耗尽宿主机资源。
- 启动检查：确认应用初始化完成后再接流量。
- 存活检查：发现进程卡死或不可恢复错误后自动重启。
- 就绪检查：依赖数据库、Redis 或配置异常时暂时不接流量。

Docker CLI 中可以用 `--memory`、`--cpus` 做基础限制，用 `HEALTHCHECK` 或编排系统做健康检查。后续进入 Dockerfile、Compose 和 Kubernetes 后，会把这些能力系统化。

### 10.8 Docker 与 Kubernetes 运行时关系

学习 Docker CLI 是理解容器的好入口，但不要把它等同于 Kubernetes 节点必须安装 Docker Engine。

现代 Kubernetes 通过 CRI 与容器运行时交互，生产集群常见运行时是 `containerd` 或 CRI-O。Docker Desktop、Docker Engine、containerd、runc、CRI 的关系会在第 18 篇继续展开。

本篇先掌握镜像、容器、网络、数据卷、日志和排障方法。后续学习 Kubernetes 时，这些概念会迁移到 Pod、Service、Volume、ConfigMap、Secret 和 `kubectl logs`。

### 10.9 本地 Docker 到 Kubernetes 的映射

本篇 Docker 概念会在 Kubernetes 中继续出现：

| Docker 概念 | Kubernetes 中的对应能力 |
|---|---|
| 镜像 | Pod 中的 container image |
| 容器 | Pod 内的 container |
| 环境变量 | Deployment env、ConfigMap、Secret |
| 端口映射 | Service、Ingress、port-forward |
| 数据卷 | Volume、PersistentVolumeClaim |
| Docker 网络 DNS | Kubernetes Service DNS |
| 容器日志 | `kubectl logs`、日志采集系统 |

理解 Docker 不是终点，而是理解 Kubernetes 工作负载的必要前置能力。

## 11. 本章小项目

本章小项目是：**使用 Docker 运行 Todo API、PostgreSQL、Redis**。

项目成果：

- `todo-net`：Todo Platform 本地 Docker 网络。
- `todo-postgres`：PostgreSQL 16 容器。
- `todo-redis`：Redis 7 容器。
- `todo-api`：通过官方 Go 镜像运行的 Todo API 容器。
- `todo-postgres-data`：PostgreSQL 数据卷。
- `todo-redis-data`：Redis 数据卷。

### 验收命令

```bash
docker ps --filter name=todo-
docker network inspect todo-net
docker volume ls
curl -i http://127.0.0.1:8080/healthz
docker logs --tail 50 todo-api
docker exec -it todo-postgres psql -U todo -d todo_platform -c "\dt"
docker exec -it todo-redis redis-cli -a todo_redis_password PING
```

### 能力验收标准

- 能解释镜像、容器、仓库、数据卷、端口映射和 Docker 网络的区别。
- 能创建 Docker 网络和数据卷。
- 能启动、停止、重启、删除容器。
- 能查看容器日志和容器状态。
- 能进入容器检查文件、环境变量和运行状态。
- 能使用容器名完成容器间访问。
- 能判断端口冲突、网络不通、认证失败和数据卷初始化问题。
- 能用 Docker 运行 Todo API、PostgreSQL、Redis，并完成登录和 Todo 创建验证。

## 12. 本章练习题

### 基础题

1. 镜像和容器有什么区别？
2. 为什么数据库容器需要数据卷？
3. `-p 127.0.0.1:8080:8080` 三段分别代表什么？
4. 为什么 Todo API 容器访问数据库时使用 `todo-postgres:5432`？
5. 为什么容器内服务通常要监听 `0.0.0.0`？

### 实操题

1. 把 Todo API 的宿主机端口改成 `18080`，验证访问地址应该如何变化。
2. 删除 `todo-api` 容器后重新创建，验证数据库中的 Todo 数据是否还在。
3. 停止 `todo-redis`，观察 Todo API 日志和接口行为。
4. 使用 `docker inspect todo-api` 找到容器 IP、网络和环境变量。
5. 使用 `docker stats` 观察三个容器的资源使用情况。

### 思考题

1. 为什么本篇没有直接把 Todo API 构建成镜像？
2. 如果多个项目都使用 PostgreSQL，宿主机端口应该如何规划？
3. 本地开发用 Docker 运行数据库，和生产数据库上云有什么差异？
4. 数据库密码写在 `docker run` 命令中有什么风险？
5. 为什么说 Docker 网络 DNS 和 Kubernetes Service DNS 有相似思想？

## 13. 本章面试题

### 1. Docker 镜像和容器的区别是什么？

参考答案：

镜像是只读模板，包含应用和运行环境；容器是镜像运行起来后的进程实例。一个镜像可以启动多个容器。容器运行时会有自己的可写层、网络、环境变量和生命周期。

### 2. Docker Volume 解决什么问题？

参考答案：

容器可写层会随容器删除而丢失，不适合保存数据库数据。Volume 独立于容器生命周期，可以持久化 PostgreSQL、Redis 等有状态服务的数据。生产环境仍然需要备份和恢复策略，Volume 本身不是备份。

### 3. `docker run -p 127.0.0.1:8080:80 nginx` 是什么意思？

参考答案：

它把宿主机本地地址 `127.0.0.1:8080` 映射到容器内的 `80` 端口。用户在宿主机访问 `127.0.0.1:8080`，流量会被转发到容器的 `80` 端口。绑定 `127.0.0.1` 表示只允许本机访问，适合本地实验。

### 4. 容器之间为什么不建议用容器 IP 访问？

参考答案：

容器 IP 可能在重建后变化。使用自定义 Docker 网络时，可以通过容器名进行 DNS 解析，例如 `todo-postgres:5432`。这比写死 IP 更稳定，也更接近 Kubernetes Service 的服务发现方式。

### 5. 为什么容器内服务监听 `127.0.0.1` 可能导致宿主机访问失败？

参考答案：

容器内的 `127.0.0.1` 是容器自己的回环地址，不是宿主机地址。服务只监听容器回环地址时，即使配置端口映射，外部也可能无法访问。容器内服务通常应监听 `0.0.0.0`。

### 6. 如何排查容器启动后马上退出？

参考答案：

先用 `docker ps -a` 查看退出状态，再用 `docker logs <container>` 查看错误日志。如果是配置错误，检查环境变量和启动命令；如果是依赖不可用，检查网络、数据库、Redis；如果是端口冲突，检查 `docker port` 和宿主机端口占用。

### 7. Dockerfile、Docker Compose 和 Kubernetes 分别解决什么问题？

参考答案：

Dockerfile 解决如何构建应用镜像；Docker Compose 解决本地多容器编排和依赖启动；Kubernetes 解决集群中的调度、扩缩容、服务发现、配置、存储、滚动发布和自愈。本篇只学习 Docker 基础，后续会逐步进入 Dockerfile、Compose 和 Kubernetes。

### 8. 生产环境运行容器需要注意哪些安全点？

参考答案：

需要固定镜像版本，扫描镜像漏洞，避免 root 和 privileged，限制 capabilities，使用 Secret 管理敏感信息，最小化暴露端口，配置资源限制，输出日志到 stdout / stderr，并设计健康检查、备份、监控和回滚策略。

## 14. 本章总结

本篇完成了 Docker 基础能力训练：

- 理解 Docker 解决环境一致性、依赖隔离和交付复现问题。
- 掌握镜像、容器、仓库、数据卷、端口映射和 Docker 网络。
- 使用 Docker 运行 PostgreSQL、Redis 和 Todo API。
- 使用官方 Go 镜像挂载代码目录运行课程项目。
- 完成数据库迁移、登录和 Todo API 访问验证。
- 学会查看日志、进入容器、检查端口、检查网络和清理资源。
- 明确开发环境 Docker 命令和生产容器运行要求的差异。

到这里，Todo Platform 已经可以用 Docker 组织本地运行依赖。虽然 Todo API 还没有自己的镜像，但你已经理解了它运行所需的容器网络、环境变量、数据卷和基础排障方法。

## 15. 下一章衔接

下一篇会进入 **Dockerfile 与镜像构建**。

本篇使用 `golang:1.26` 镜像挂载代码运行 Todo API，这种方式适合学习和本地开发，但不适合生产交付。生产交付需要一个属于 Todo API 自己的镜像，把编译产物、运行命令、非 root 用户、健康检查和镜像标签管理起来。

下一篇会完成：

- 编写 Todo API 的 Dockerfile。
- 使用多阶段构建生成更小的运行镜像。
- 设置容器启动命令和健康检查。
- 构建、标记、查看和清理镜像。
- 为后续 Docker Compose 和 Kubernetes 部署准备标准应用镜像。
