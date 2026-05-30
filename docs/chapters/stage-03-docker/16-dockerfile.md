# 第 16 篇：Dockerfile 与镜像构建 [C]

第 15 篇已经让 Todo API、PostgreSQL 和 Redis 通过 Docker CLI 跑在同一个 Docker 网络里。但 Todo API 仍然依赖 `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm + 源码挂载 + go run`。这种方式适合学习容器运行参数，不适合交付给测试、CI/CD、预发环境或 Kubernetes。

本篇把 Todo API 构建成真正的应用镜像：源码在构建阶段编译成 Linux 二进制，运行阶段只保留二进制、配置文件和迁移脚本；镜像使用非 root 用户运行，带 OCI 元数据标签，并能用 `hadolint`、`dive`、`trivy` 或 Docker Scout 做基础检查。

本篇对应新版课程计划中的第 16 篇，类型为 **C 类：实践/开发章**。本篇特色项目是：**为 Todo 平台构建安全、小体积、可发布的 Go 服务镜像**。

本篇覆盖计划中的 6 个主题：

- 16.1 Dockerfile 指令详解
- 16.2 Go 服务多阶段构建
- 16.3 镜像缓存、构建上下文与 `.dockerignore`
- 16.4 非 root 用户、最小镜像与安全扫描
- 16.5 镜像版本、标签和推送仓库
- 16.6 镜像调试与优化工具（dive 分析镜像层、hadolint 检查 Dockerfile、trivy 漏洞扫描）

## 1. 本章学习目标

### 1.1 知识目标

- 能解释 Dockerfile、构建上下文、镜像层、缓存和 `.dockerignore` 的关系。
- 能说明 `FROM`、`ARG`、`COPY`、`RUN`、`ENV`、`USER`、`EXPOSE`、`ENTRYPOINT`、`CMD`、`LABEL` 等指令的作用。
- 能解释 Go 服务为什么适合多阶段构建，以及构建阶段和运行阶段应该如何分工。
- 能对比 `golang`、`alpine`、`debian-slim`、`scratch`、`distroless` 作为运行镜像时的取舍。
- 能说明镜像标签、OCI Label、digest、漏洞扫描和推送仓库在真实交付中的意义。

### 1.2 技能目标

- 能在 Todo Platform 应用仓库中编写 `api/Dockerfile` 和根目录 `.dockerignore`。
- 能构建 `todo-api:v0.1.0` 与 `todo-api:git-<commit>` 两类标签。
- 能使用镜像执行 `hash-password`、`config-check`、`migrate` 和 `serve` 命令。
- 能用 `docker history`、`docker image inspect`、`dive` 分析镜像层、运行用户和体积来源。
- 能用 `hadolint` 检查 Dockerfile，用 `trivy` 或 Docker Scout 做基础漏洞扫描。
- 能把镜像推送到本地 registry，并知道真实团队推送 GHCR、Harbor 或云厂商镜像仓库时要补哪些认证信息。

### 1.3 前置条件

开始本篇前，请确认你已经完成第 15 篇，并且项目中已有第 14 篇生产化后的 Todo API：

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
docker buildx version
```

本篇的 Dockerfile 位于 `api/Dockerfile`，但构建命令必须在项目根目录执行，并使用根目录作为构建上下文：

```bash
docker build -f api/Dockerfile -t todo-api:v0.1.0 .
```

这样做是为了让 Docker build 同时访问根目录的 `go.mod`、`go.sum`、`configs/` 和 `api/`。如果进入 `api/` 目录再构建，Dockerfile 会找不到 Go module 和配置目录。

## 2. 本章工作场景与真实案例

### 2.1 技术痛点

真实团队不会把源码目录挂到生产容器里再执行 `go run`。那种方式存在几个明显问题：

- 运行容器里有完整 Go 编译器、module 缓存和源码，体积大，漏洞面也大。
- 容器启动时还要编译，启动速度慢，错误也更晚暴露。
- 镜像无法准确对应一次 Git commit，测试和生产很难证明跑的是同一份代码。
- Secret、`.env`、本地日志、临时文件可能被构建进镜像。
- 默认 root 用户运行，一旦应用被攻破，容器内权限边界更差。

Dockerfile 的工作不是“把命令写进文件”这么简单。它把服务的构建、运行用户、启动命令、默认配置、版本元数据和安全边界固化为可审查、可复现、可扫描的交付物。

### 2.2 团队协作场景

在企业团队中，Dockerfile 通常由后端开发和平台团队共同维护：

- 后端开发负责编译命令、运行参数、配置路径、健康接口和迁移命令是否正确。
- DevOps 或平台工程师负责构建缓存、镜像标签、仓库推送、多架构和 CI/CD 流水线。
- 安全工程师审查基础镜像来源、非 root、Secret 泄露、漏洞扫描结果和供应链元数据。
- 测试工程师使用同一个镜像在测试环境复现缺陷，避免“开发机能跑、测试环境不能跑”。
- SRE 在事故中通过镜像标签、commit、digest、`docker inspect` 和镜像仓库记录追踪版本来源。

本篇实验会模拟这条协作链路：先写 Dockerfile，再构建、运行、扫描、分析和推送镜像。你不仅要能让镜像跑起来，还要能解释为什么这样构建更适合生产交付。

### 2.3 课程项目关联

本篇会把第 15 篇的临时运行方式：

```text
registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm + 源码挂载 + go run ./api/cmd/todo-api serve
```

升级为可发布镜像：

```text
todo-api:v0.1.0
├── /app/todo-api          # 已编译 Go 二进制
├── /app/configs           # 配置文件
├── /app/api/migrations    # 数据库迁移脚本
├── OCI Labels             # 版本、commit、构建时间
└── nonroot 用户            # 非 root 运行
```

本篇产出会被后续章节复用：

- 第 17 篇会在 Docker Compose 中直接使用 `todo-api:v0.1.0`，不再用 `golang` 镜像临时运行源码。
- 第 18 篇会基于本篇镜像观察镜像层、rootfs、进程和文件系统隔离。
- 第 19 篇会把本篇镜像导入 containerd / kind 节点，观察 Docker、containerd、runc 和 CRI 的关系。
- 第 29 篇 CI/CD 会把本篇手工构建和推送流程自动化。

## 3. 核心概念

### 3.1 Dockerfile 是什么

Dockerfile 是镜像构建说明书。它描述基础镜像是什么、复制哪些文件、执行哪些构建命令、设置哪些环境变量、容器启动时默认执行什么程序。

最小 Dockerfile 可以只有两行：

```dockerfile
FROM registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
CMD ["echo", "hello dockerfile"]
```

构建并运行：

```bash
docker build -t hello-dockerfile -f Dockerfile .
docker run --rm hello-dockerfile
```

这个最小例子只用 `CMD` 运行一次性命令。本章最终 Dockerfile 会使用 `ENTRYPOINT + CMD` 组合，让同一个镜像既能运行服务，也能执行迁移、配置检查、OpenAPI 输出等运维命令。

在 Todo API 项目中，Dockerfile 不只是为了运行一个命令，而是要把 Go 编译、测试、配置、迁移脚本、非 root 用户和镜像元数据一起纳入交付流程。

### 3.2 构建上下文

执行下面命令时，最后的 `.` 是构建上下文：

```bash
docker build -f api/Dockerfile -t todo-api:v0.1.0 .
```

Docker 客户端会把构建上下文中的文件发送给 Docker daemon。Dockerfile 里的 `COPY` 只能访问构建上下文里的文件，不能随意读取上下文外部路径。

本课程项目采用根目录作为构建上下文，因为 Dockerfile 需要读取：

```text
cloud-native-todo-platform/
├── go.mod
├── go.sum
├── configs/
└── api/
    ├── cmd/todo-api/
    ├── internal/
    └── migrations/
```

如果你在 `api/` 目录里执行 `docker build .`，上下文里就没有根目录 `go.mod` 和 `configs/`，构建会失败。

### 3.3 `.dockerignore`

`.dockerignore` 用来排除不应该进入构建上下文的文件。它的语法类似 `.gitignore`。

最常见的排除对象包括：

```dockerignore
.git
.env
*.log
bin/
dist/
tmp/
```

没有 `.dockerignore` 时，构建上下文可能包含 Git 历史、本地密钥、日志、临时文件和旧构建产物。这会让构建变慢，也可能把敏感信息送进 Docker daemon，甚至误复制进镜像。

### 3.4 镜像层与构建缓存

Dockerfile 中的很多指令会产生镜像层。Docker 会尽量复用前一次构建生成的缓存层。

Go 项目常见写法是先复制依赖清单，再下载 module：

```dockerfile
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
RUN go build -o /out/todo-api ./api/cmd/todo-api
```

这样业务代码变化时，`go mod download` 层通常还能复用；只有 `go.mod` 或 `go.sum` 变化时才重新下载依赖。构建缓存不是玄学，它依赖 Dockerfile 指令顺序和输入文件内容。

### 3.5 多阶段构建

Go 服务编译时需要 Go 工具链，运行时通常只需要编译好的二进制、配置文件、证书和少量运行依赖。多阶段构建把这两件事拆开：

```text
builder 阶段：使用 golang 镜像，下载依赖、运行测试、编译二进制
runtime 阶段：使用 distroless 镜像，只复制二进制、配置和迁移脚本
```

最终镜像不会包含 Go 编译器、module 缓存、测试文件缓存和源代码中无关内容。镜像体积更小，漏洞面更窄，启动也更接近生产运行形态。

### 3.6 `ENTRYPOINT` 与 `CMD`

`ENTRYPOINT` 定义容器默认执行程序，`CMD` 定义默认参数。

本篇 Dockerfile 使用：

```dockerfile
ENTRYPOINT ["/app/todo-api"]
CMD ["serve"]
```

默认启动等价于：

```text
/app/todo-api serve
```

如果你覆盖 `CMD`，同一个镜像还能执行运维命令：

```bash
docker run --rm todo-api:v0.1.0 config-check
docker run --rm todo-api:v0.1.0 hash-password "change-me-123"
docker run --rm todo-api:v0.1.0 migrate
docker run --rm todo-api:v0.1.0 openapi
```

这就是“一个镜像，多种命令”的常见后端服务交付方式。

### 3.7 非 root 用户与最小镜像

很多基础镜像默认以 root 用户运行。生产容器应尽量使用非 root 用户，避免应用漏洞直接获得容器内高权限。

运行镜像的常见选择如下。

表 16-1 常见 Go 服务运行镜像对比：

| 运行镜像 | 默认用户 | 优点 | 代价 |
|---|---|---|---|
| `golang` | root | 工具齐全，排障方便 | 体积巨大，不适合生产运行 |
| `debian:bookworm-slim` | root | 兼容性好，有包管理生态 | 体积较大，漏洞面更宽 |
| `alpine` | root | 小，带 shell | musl 与 glibc 差异，仍有 shell 和包管理器 |
| `scratch` | 无预置用户 | 极小 | 没有 shell、证书、用户信息，排障困难 |
| `distroless` | 视标签而定 | 小，无 shell，适合生产 | 不能直接进入容器用 shell 排障 |

本篇使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/static-debian12:nonroot`，也就是 distroless 的 `:nonroot` 变体，让运行镜像默认更接近生产安全基线。distroless 没有 shell，因此排障更依赖日志、指标、`docker inspect`、镜像分析工具和后续 Kubernetes 的临时调试容器。

### 3.8 镜像标签、OCI Label 与 digest

OCI（Open Container Initiative，开放容器标准组织）定义了容器镜像和运行时的通用规范。OCI Label 是写入镜像配置里的标准元数据，digest 是镜像内容摘要，也就是由镜像内容计算出的不可变标识。

镜像标签是人类可读引用：

```text
todo-api:v0.1.0
todo-api:git-a1b2c3d
localhost:5000/todo-api:v0.1.0
```

生产环境不应只依赖 `latest`。更好的做法是同时保留：

- 语义版本标签，例如 `v0.1.0`。
- Git commit 标签，例如 `git-a1b2c3d`。
- OCI Label，例如 `org.opencontainers.image.revision`。
- 镜像 digest（内容摘要），例如 `sha256:...`，用于不可变追踪。

标签可以被覆盖，digest 才是镜像内容的不可变标识。后续 Kubernetes 部署和 CI/CD 章节会继续使用这个概念。

## 4. 原理深入

### 4.1 Docker build 运行流程

图 16-1 Docker build 运行流程：

```mermaid
flowchart LR
    CLI["docker build"] --> Context["读取构建上下文"]
    Context --> Ignore["应用 .dockerignore"]
    Ignore --> Parser["解析 api/Dockerfile"]
    Parser --> Steps["逐条执行指令"]
    Steps --> Cache["命中或生成缓存层"]
    Cache --> Image["生成本地镜像"]
    Image --> Tags["写入镜像标签"]
    Tags --> Registry["可选推送仓库"]
```

这条链路里有三个最容易被新手忽略的点：

1. `.dockerignore` 在构建上下文发送前生效，不是镜像构建后再删除。
2. Dockerfile 指令顺序决定缓存命中率，频繁变化的文件应该后复制。
3. `docker build -t` 只是给镜像添加引用，真正内容由镜像 config 和 layers 决定。

### 4.2 Todo API 多阶段构建流程

图 16-2 Todo API 多阶段构建：

```mermaid
flowchart TB
    subgraph Builder["builder 阶段：registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm"]
        A["COPY go.mod go.sum"] --> B["go mod download"]
        B --> C["COPY . ."]
        C --> D["go test ./..."]
        D --> E["CGO_ENABLED=0 go build"]
    end

    subgraph Runtime["runtime 阶段：distroless nonroot"]
        F["COPY /out/todo-api"] --> G["COPY configs"]
        G --> H["COPY api/migrations"]
        H --> I["USER nonroot:nonroot"]
        I --> J["ENTRYPOINT /app/todo-api"]
    end

    E --> F
```

构建阶段可以包含编译器、测试工具、module 缓存和源码；运行阶段应该克制，只放运行必须的文件。这样镜像更小，扫描结果更清晰，也减少了容器被入侵后的可用工具。

### 4.3 为什么 Go 服务要 `CGO_ENABLED=0`

Go 程序默认可能根据依赖和平台使用 CGO。CGO 会让二进制依赖系统动态库。把动态链接二进制复制进 distroless static 镜像时，可能出现一个很迷惑的错误：

```text
exec /app/todo-api: no such file or directory
```

文件明明存在，却提示找不到，常见原因是动态链接器或系统库不存在。本篇使用：

```bash
CGO_ENABLED=0 GOOS=linux go build
```

这样大多数纯 Go 服务会生成更适合最小镜像的静态二进制。如果你的项目使用 SQLite、图像处理、本地认证库或其他 CGO 依赖，就不能机械照搬，需要换成 `debian:bookworm-slim` 等包含运行库的镜像，并明确安装依赖。

### 4.4 `RUN`、`CMD` 与容器生命周期

`RUN` 在构建镜像时执行，结果进入镜像层；`CMD` 和 `ENTRYPOINT` 在容器启动时执行。

错误理解这三者会导致两类问题：

- 把 `go run ./api/cmd/todo-api serve` 写进 `RUN`，构建过程会卡住，因为服务启动后不会退出。
- 把 `go test ./...` 写进 `CMD`，容器每次启动都先跑测试，生产服务无法稳定启动。

本篇的边界是：

```text
构建时：go mod download -> go test ./... -> go build
运行时：/app/todo-api serve
运维时：/app/todo-api config-check / migrate / openapi / hash-password
```

### 4.5 镜像安全检查链路

图 16-3 镜像安全检查链路：

```mermaid
flowchart LR
    Dockerfile["api/Dockerfile"] --> Hadolint["hadolint 静态检查"]
    Dockerfile --> Build["docker build"]
    Build --> Image["todo-api:v0.1.0"]
    Image --> Dive["dive 分析镜像层"]
    Image --> Trivy["trivy / Docker Scout 漏洞扫描"]
    Image --> Inspect["docker inspect 检查用户和标签"]
    Inspect --> Push["推送 registry"]
```

这些工具关注点不同：

表 16-2 镜像构建与分析工具对比：

| 工具 | 主要回答的问题 |
|---|---|
| `hadolint` | Dockerfile 写法有没有明显反模式 |
| `docker history` | 镜像由哪些层组成，每层大概多大 |
| `dive` | 哪些文件进入了镜像，是否存在冗余层 |
| `trivy` | 镜像依赖和 OS 包是否有已知漏洞 |
| Docker Scout | Docker 生态下的漏洞和基础镜像建议 |
| `docker inspect` | 镜像运行用户、入口命令、Label、环境变量是什么 |

工具只能降低风险，不能替代人工审查。比如漏洞扫描可能发现不了你把 `.env` 复制进镜像，也不能判断某个 Secret 是否已经泄露到构建日志。

## 5. 手把手实验

### 5.1 实验目标

本实验会完成一条完整镜像构建链路：

1. 在应用项目根目录创建 `.dockerignore`。
2. 在 `api/` 下创建生产风格多阶段 `Dockerfile`。
3. 构建 `todo-api:v0.1.0` 和 `todo-api:git-<commit>`。
4. 用镜像执行 `hash-password`、`config-check`、`migrate` 和 `serve`。
5. 启动 PostgreSQL、Redis 和 Todo API 镜像，完成登录与创建 Todo。
6. 用 `docker history`、`docker inspect`、`dive`、`hadolint`、`trivy` 或 Docker Scout 做基础分析。
7. 启动本地 registry 并推送镜像。
8. 清理容器、网络、数据卷和本地 registry。

### 5.2 实验环境

请在 **Cloud Native Todo Platform 应用仓库根目录** 执行命令，不是在课程文档仓库中执行。

| 工具或镜像 | 建议版本 | 说明 |
|---|---|---|
| Docker Desktop / Docker Engine | 29.x 或当前稳定版 | 需要支持 BuildKit |
| Go 构建镜像 | `registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm` | 编译 Todo API |
| 运行镜像 | `registry.cn-guangzhou.aliyuncs.com/yleoer/static-debian12:nonroot` | 非 root 最小运行环境 |
| PostgreSQL 镜像 | `registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` | 验证数据库迁移和 API |
| Redis 镜像 | `registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine` | 验证缓存、限流和队列 |
| Registry 镜像 | `registry:2` | 本地推送实验 |
| curl | 任意现代版本 | 验证 HTTP API |
| jq | 可选 | Linux / macOS / WSL2 下解析登录 JSON |
| hadolint | 当前稳定版 | 可选，检查 Dockerfile |
| dive | 当前稳定版 | 可选，分析镜像层和文件 |
| Trivy | 当前稳定版 | 可选，漏洞扫描 |
| Docker Scout | 随 Docker Desktop / CLI 提供 | 可选，漏洞扫描 |

确认 Docker 和 buildx 可用：

```bash
docker version
docker buildx version
```

如果 `docker buildx version` 报 `command not found` 或 Docker 子命令不存在，先执行 `docker build --help` 确认当前 Docker 是否仍能构建镜像；Linux 发行版包管理器安装的 Docker 可能需要单独安装 buildx 插件，Docker Desktop 通常已经内置。

如果已经安装镜像分析工具，可以先记录版本。它们不是最小实验的硬性依赖，但属于本章的进阶能力：

=== "Linux / macOS / WSL2"

    ```bash
    hadolint --version || true
    dive --version || true
    trivy --version || true
    docker scout version || true
    ```

=== "Windows PowerShell"

    ```powershell
    if (Get-Command hadolint -ErrorAction SilentlyContinue) { hadolint --version } else { "hadolint not installed" }
    if (Get-Command dive -ErrorAction SilentlyContinue) { dive --version } else { "dive not installed" }
    if (Get-Command trivy -ErrorAction SilentlyContinue) { trivy --version } else { "trivy not installed" }
    docker scout version
    ```

如果输出 `not installed`，说明该工具尚未安装。你仍然可以完成最小镜像构建实验；后面的 hadolint、dive、Trivy 和 Docker Scout 属于进阶验证。

确认当前目录是项目根目录：

=== "Linux / macOS / WSL2"

    ```bash
    test -f go.mod
    test -f go.sum
    test -d api/cmd/todo-api
    test -d configs
    test -d api/migrations
    ```

=== "Windows PowerShell"

    ```powershell
    Test-Path .\go.mod
    Test-Path .\go.sum
    Test-Path .\api\cmd\todo-api
    Test-Path .\configs
    Test-Path .\api\migrations
    ```

以上命令都返回成功，才继续后面的构建。

### 5.3 文件目录结构

本篇新增两个文件：

```text
cloud-native-todo-platform/
├── .dockerignore
├── configs/
├── go.mod
├── go.sum
└── api/
    ├── Dockerfile
    ├── cmd/
    │   └── todo-api/
    └── migrations/
```

为什么不是把 Dockerfile 放在根目录？因为本课程项目主线把 API 服务相关交付物收敛到 `api/` 下，后续 Kubernetes、Helm 和 CI/CD 会继续围绕 `api/Dockerfile` 构建镜像。但 `.dockerignore` 必须放在构建上下文根目录，也就是项目根目录。

### 5.4 完整代码或配置

在项目根目录创建 `.dockerignore`：

```dockerignore title=".dockerignore"
.git
.github
.idea
.vscode
.DS_Store
Thumbs.db

# Local environment and secrets
.env
.env.*
*.pem
*.key
*.crt
*.p12

# Build outputs and temporary files
bin/
dist/
tmp/
coverage.out
*.test
*.log

# Documentation site output
site/

# Docker local overrides
docker-compose.override.yml
compose.override.yaml

# Runtime data should live in volumes, not in image context
data/
postgres-data/
redis-data/
```

关键字段解释：

表 16-3 `.dockerignore` 规则说明：

| 规则 | 作用 |
|---|---|
| `.git` | 避免把 Git 历史传入构建上下文 |
| `.env`、`.env.*` | 避免把本地 Secret 发送给 Docker daemon |
| `bin/`、`dist/`、`tmp/` | 避免旧构建产物污染镜像 |
| `*.log` | 日志属于运行时数据，不应进入镜像 |
| `data/` | 数据库和缓存数据应放在 volume，不应进入镜像 |

在 `api/` 目录创建 `Dockerfile`：

```dockerfile title="api/Dockerfile"
# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.26
ARG RUNTIME_IMAGE=registry.cn-guangzhou.aliyuncs.com/yleoer/static-debian12:nonroot

FROM golang:${GO_VERSION}-bookworm AS builder

ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=unknown

WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go test ./...

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=linux go build \
      -trimpath \
      -ldflags="-s -w" \
      -o /out/todo-api ./api/cmd/todo-api

FROM ${RUNTIME_IMAGE} AS runtime

ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="Cloud Native Todo API" \
      org.opencontainers.image.description="Todo Platform Go API service" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.source="https://github.com/<your-org>/cloud-native-todo-platform"

WORKDIR /app

COPY --from=builder /out/todo-api /app/todo-api
COPY --from=builder /src/configs /app/configs
COPY --from=builder /src/api/migrations /app/api/migrations

ENV TODO_CONFIG_DIR=/app/configs \
    TODO_ENV=prod \
    TODO_API_ADDR=0.0.0.0:18080

EXPOSE 18080

USER nonroot:nonroot

ENTRYPOINT ["/app/todo-api"]
CMD ["serve"]
```

`# syntax=docker/dockerfile:1.7` 用来固定本章使用的 Dockerfile frontend 版本，保证 `RUN --mount=type=cache` 行为稳定可复现。真实团队也可以使用 `# syntax=docker/dockerfile:1` 跟随 Dockerfile 1.x 稳定线，但 CI 中应保持团队统一，避免不同构建环境解析规则不一致。

这份 Dockerfile 有几个关键设计：

- `api/Dockerfile` 使用项目根目录作为构建上下文，所以能 `COPY go.mod go.sum ./`。
- 构建阶段执行 `go test ./...`，避免测试失败的代码进入镜像。它会执行项目全部测试；依赖 PostgreSQL 或 Redis 的集成测试应通过环境变量门控自动跳过（见第 12/13 篇）。如果构建时测试卡住或失败，先检查对应测试是否正确跳过外部依赖。
- `CGO_ENABLED=0` 生成适合 distroless static 镜像的二进制。
- 运行阶段只复制二进制、`configs/` 和 `api/migrations/`。
- `TODO_CONFIG_DIR=/app/configs` 与第 14 篇配置加载规则保持一致。
- `TODO_API_ADDR=0.0.0.0:18080` 继承第 15 篇容器内监听地址要求。
- `USER nonroot:nonroot` 避免默认 root 运行。
- `ENTRYPOINT` 固定二进制，`CMD` 默认执行 `serve`，方便覆盖为 `config-check`、`migrate`、`openapi`。
- `org.opencontainers.image.source` 中的 `<your-org>` 是占位符，练习时替换成自己的组织、用户名或企业仓库地址。

### 5.5 执行命令

正式构建前先设置版本变量：

=== "Linux / macOS / WSL2"

    ```bash
    VERSION=v0.1.0
    COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
    BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    ```

=== "Windows PowerShell"

    ```powershell
    $VERSION = "v0.1.0"
    $COMMIT = git rev-parse --short HEAD
    if (-not $COMMIT) { $COMMIT = "unknown" }
    $BUILD_DATE = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    ```

构建 Todo API 镜像：

=== "Linux / macOS / WSL2"

    ```bash
    docker build \
      -f api/Dockerfile \
      --build-arg VERSION="$VERSION" \
      --build-arg COMMIT="$COMMIT" \
      --build-arg BUILD_DATE="$BUILD_DATE" \
      -t todo-api:$VERSION \
      -t todo-api:git-$COMMIT \
      .
    ```

=== "Windows PowerShell"

    ```powershell
    docker build `
      -f api/Dockerfile `
      --build-arg VERSION="$VERSION" `
      --build-arg COMMIT="$COMMIT" `
      --build-arg BUILD_DATE="$BUILD_DATE" `
      -t "todo-api:$VERSION" `
      -t "todo-api:git-$COMMIT" `
      .
    ```

这个命令会完整构建镜像。如果你想查看构建上下文大小和 `.dockerignore` 是否生效，可以在构建命令中加上 `--progress=plain`，输出里会出现 `load .dockerignore` 和 `transferring context`。如果 `transferring context` 显示几十 MB 甚至几百 MB，通常说明 `.dockerignore` 漏掉了大文件。这里不单独提供“只检查上下文”的伪命令，因为 `docker build` 会执行完整 Dockerfile，单独跑一次会让新手重复等待。

查看镜像列表：

```bash
docker image ls todo-api
```

查看镜像历史：

```bash
docker history todo-api:v0.1.0
```

查看镜像运行用户、入口命令和默认参数：

```bash
docker image inspect todo-api:v0.1.0 --format '{{.Config.User}} {{.Config.Entrypoint}} {{.Config.Cmd}}'
```

查看 OCI Label：

```bash
docker image inspect todo-api:v0.1.0 --format '{{json .Config.Labels}}'
```

生成本地管理员密码哈希：

=== "Linux / macOS / WSL2"

    ```bash
    HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
    echo "$HASH"
    ```

=== "Windows PowerShell"

    ```powershell
    $hash = docker run --rm todo-api:v0.1.0 hash-password "change-me-123"
    $hash
    ```

执行配置检查：

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm \
      -e TODO_ENV=dev \
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
      -e "TODO_AUTH_USERS=admin=$HASH" \
      todo-api:v0.1.0 config-check
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm `
      -e TODO_ENV=dev `
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef `
      -e "TODO_AUTH_USERS=admin=$hash" `
      todo-api:v0.1.0 config-check
    ```

下面复用第 15 篇的三容器网络验证流程。先清理旧容器，再创建网络和数据卷：

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-api todo-postgres todo-redis 2>/dev/null || true
    docker network inspect todo-net >/dev/null 2>&1 || docker network create todo-net
    docker volume create todo-postgres-data
    docker volume create todo-redis-data
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-api todo-postgres todo-redis 2>$null
    docker network inspect todo-net *> $null
    if ($LASTEXITCODE -ne 0) { docker network create todo-net }
    docker volume create todo-postgres-data
    docker volume create todo-redis-data
    ```

启动 PostgreSQL：

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

启动 Redis：

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

等待依赖就绪：

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

执行数据库迁移：

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm \
      --network todo-net \
      -e TODO_ENV=dev \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
      -e "TODO_AUTH_USERS=admin=$HASH" \
      todo-api:v0.1.0 migrate
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm `
      --network todo-net `
      -e TODO_ENV=dev `
      -e "TODO_DATABASE_DSN=postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable" `
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef `
      -e "TODO_AUTH_USERS=admin=$hash" `
      todo-api:v0.1.0 migrate
    ```

启动 Todo API 镜像：

=== "Linux / macOS / WSL2"

    ```bash
    docker run -d \
      --name todo-api \
      --network todo-net \
      -p 127.0.0.1:18080:18080 \
      -e TODO_ENV=dev \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      -e TODO_REDIS_ADDR=todo-redis:6379 \
      -e TODO_REDIS_PASSWORD=todo_redis_password \
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
      -e "TODO_AUTH_USERS=admin=$HASH" \
      todo-api:v0.1.0
    ```

=== "Windows PowerShell"

    ```powershell
    docker run -d `
      --name todo-api `
      --network todo-net `
      -p 127.0.0.1:18080:18080 `
      -e TODO_ENV=dev `
      -e "TODO_DATABASE_DSN=postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable" `
      -e TODO_REDIS_ADDR=todo-redis:6379 `
      -e TODO_REDIS_PASSWORD=todo_redis_password `
      -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef `
      -e "TODO_AUTH_USERS=admin=$hash" `
      todo-api:v0.1.0
    ```

验证健康检查和登录：

=== "Linux / macOS / WSL2"

    ```bash
    curl -i http://127.0.0.1:18080/healthz

    TOKEN=$(curl -s -H 'Content-Type: application/json' \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:18080/api/v2/auth/login | jq -r '.data.token')

    curl -i -H "Authorization: Bearer $TOKEN" \
      -H 'Content-Type: application/json' \
      -d '{"title":"build todo api image"}' \
      http://127.0.0.1:18080/api/v2/todos
    ```

=== "Windows PowerShell"

    ```powershell
    curl.exe -i http://127.0.0.1:18080/healthz

    $login = curl.exe -s -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"change-me-123\"}" http://127.0.0.1:18080/api/v2/auth/login | ConvertFrom-Json
    $token = $login.data.token

    curl.exe -i -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"title\":\"build todo api image\"}" http://127.0.0.1:18080/api/v2/todos
    ```

Linux / macOS / WSL2 如果没有安装 `jq`，先直接查看登录响应，再手动复制 `data.token`，或使用第 15 篇的 `sed` 备用写法。

执行 hadolint 检查。已安装本地命令时使用：

```bash
hadolint api/Dockerfile
```

如果没有本地 hadolint，可以临时用容器运行：

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm -i hadolint/hadolint:latest-debian < api/Dockerfile
    ```

=== "Windows PowerShell"

    ```powershell
    Get-Content .\api\Dockerfile -Raw | docker run --rm -i hadolint/hadolint:latest-debian
    ```

这里用 `latest-debian` 只是为了降低本地临时工具镜像的安装门槛，不用于生产工作负载。教学场景中临时拉取工具镜像用浮动标签可以接受，因为工具本身不参与应用交付；团队 CI 中应固定 hadolint 版本或 digest，例如固定到团队验证过的 `hadolint/hadolint:<version>-debian`，避免规则升级导致流水线结果不可预测。

CI 中可以把工具版本固定成普通环境变量，方便统一升级和审计。例如：

```bash
HADOLINT_IMAGE="hadolint/hadolint:v2.14.0-debian"
TRIVY_IMAGE="aquasec/trivy:0.67.2"

docker run --rm -i "$HADOLINT_IMAGE" < api/Dockerfile
docker save todo-api:v0.1.0 -o todo-api-v0.1.0.tar
docker run --rm -v "$PWD:/work" "$TRIVY_IMAGE" image --input /work/todo-api-v0.1.0.tar --severity HIGH,CRITICAL
```

这里的版本号只是示例。真实团队应把工具镜像固定到团队验证过的版本或 digest，并在版本升级 PR 中单独查看规则变化和扫描结果变化。

使用 `dive` 分析镜像层。已安装本地命令时使用：

```bash
dive todo-api:v0.1.0
```

没有本地 `dive` 时，可以先跳过交互式分析，但要至少执行 `docker history todo-api:v0.1.0` 并记录输出。`dive` 属于镜像层观察工具，不影响镜像运行。

执行漏洞扫描。已安装 Trivy 时使用：

```bash
trivy image --severity HIGH,CRITICAL todo-api:v0.1.0
```

如果你使用 Docker Desktop，也可以执行：

```bash
docker scout cves todo-api:v0.1.0
```

扫描结果可能包含基础镜像或依赖库的漏洞。学习阶段重点不是追求“永远 0 漏洞”，而是能读懂扫描报告、区分严重等级、定位来源，并知道需要升级基础镜像、依赖库或等待上游修复。

如果你还没有安装 hadolint、dive、Trivy 或 Docker Scout，可以先完成前面的构建、运行和 API 验证，再把这些命令记录为“待补充进阶验证”。最小验收不应因为本地缺少分析工具而中断。

启动本地 registry，演示推送镜像：

```bash
docker rm -f todo-registry 2>/dev/null || true
docker run -d --name todo-registry -p 127.0.0.1:5000:5000 registry:2
docker tag todo-api:v0.1.0 localhost:5000/todo-api:v0.1.0
docker push localhost:5000/todo-api:v0.1.0
docker pull localhost:5000/todo-api:v0.1.0
```

Windows PowerShell 写法：

```powershell
docker rm -f todo-registry 2>$null
docker run -d --name todo-registry -p 127.0.0.1:5000:5000 registry:2
docker tag todo-api:v0.1.0 localhost:5000/todo-api:v0.1.0
docker push localhost:5000/todo-api:v0.1.0
docker pull localhost:5000/todo-api:v0.1.0
```

本地 registry 不需要登录，适合学习镜像推送流程。真实团队推送到 GHCR、Harbor 或云厂商镜像仓库时，需要先完成登录和命名空间配置，例如：

```bash
docker login ghcr.io
docker tag todo-api:v0.1.0 ghcr.io/<your-org>/todo-api:v0.1.0
docker push ghcr.io/<your-org>/todo-api:v0.1.0
```

这里的 `<your-org>` 必须替换成你的 GitHub 组织或用户名。不要把真实 Token 写入教程、脚本或 Git 仓库。

### 5.6 预期输出

镜像列表应能看到两个标签：

```text
REPOSITORY   TAG          IMAGE ID       CREATED          SIZE
todo-api     v0.1.0       ...            ...              ...
todo-api     git-a1b2c3d  ...            ...              ...
```

镜像运行用户应为非 root：

```text
nonroot:nonroot [/app/todo-api] [serve]
```

配置检查应输出类似日志：

```text
{"level":"INFO","msg":"configuration ok","env":"dev","addr":"0.0.0.0:18080"}
```

迁移命令应输出：

```text
migration applied
```

健康检查应返回：

```text
HTTP/1.1 200 OK
```

创建 Todo 应返回：

```text
HTTP/1.1 201 Created
```

本地 registry 推送应出现类似输出：

```text
The push refers to repository [localhost:5000/todo-api]
...
v0.1.0: digest: sha256:... size: ...
```

### 5.7 验证方法

#### 5.7.1 最小验证

验证 Dockerfile 和 `.dockerignore` 已创建：

```bash
test -f api/Dockerfile
test -f .dockerignore
```

Windows PowerShell：

```powershell
Test-Path .\api\Dockerfile
Test-Path .\.dockerignore
```

验证镜像包含必要文件，但不依赖 shell。distroless 镜像不能 `docker exec sh`，因此用应用自身命令验证：

```bash
docker run --rm todo-api:v0.1.0 openapi
docker run --rm todo-api:v0.1.0 hash-password "check-password"
```

验证镜像非 root：

```bash
docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'
```

预期输出：

```text
nonroot:nonroot
```

验证镜像标签包含 commit：

```bash
docker image inspect todo-api:v0.1.0 --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
```

验证容器实际运行镜像：

```bash
docker inspect todo-api --format '{{.Config.Image}} {{.State.Status}} {{.State.ExitCode}}'
docker logs --tail 80 todo-api
```

验证容器网络：

```bash
docker network inspect todo-net
docker exec todo-postgres pg_isready -U todo -d todo_platform
docker exec todo-redis redis-cli -a todo_redis_password ping
```

验证本地 registry 中镜像可拉取：

```bash
docker image rm localhost:5000/todo-api:v0.1.0
docker pull localhost:5000/todo-api:v0.1.0
```

#### 5.7.2 进阶验证

进阶验证用于证明你不仅能构建镜像，还能分析镜像质量。已安装工具时记录以下信息：

- `docker image ls todo-api` 的镜像大小。
- `docker image inspect` 中的 `Config.User`、`Entrypoint`、`Cmd`、OCI Label。
- `docker history` 或 `dive` 的层分析结果。
- `hadolint` 检查结果。
- `trivy` 或 Docker Scout 扫描结果。
- 本地 registry 推送成功的 digest。

### 5.8 清理步骤

停止并删除实验容器：

```bash
docker rm -f todo-api todo-postgres todo-redis todo-registry
```

删除本篇创建的网络：

```bash
docker network rm todo-net
```

如果确认不需要保留实验数据，再删除数据卷：

```bash
docker volume rm todo-postgres-data todo-redis-data
```

删除本地镜像标签：

```bash
docker image rm todo-api:v0.1.0
docker image rm localhost:5000/todo-api:v0.1.0
```

如果 `todo-api:git-<commit>` 仍然存在，先通过下面命令找到标签再删除：

```bash
docker image ls todo-api
```

清理时不要删除团队共享 registry 里的生产镜像。生产镜像的删除需要遵守保留策略、回滚策略和审计流程。

预计耗时：120 分钟（阅读约 40 分钟，动手实验约 80 分钟）。

## 6. 常见错误与排障

### 错误 1：Dockerfile 找不到 `go.mod` 或 `configs`

- **现象**：

  ```text
  failed to compute cache key: "/go.mod" not found
  COPY failed: file not found in build context or excluded by .dockerignore: stat configs: file does not exist
  ```

- **原因**：在 `api/` 目录中执行了 `docker build .`，导致构建上下文只有 `api/`；或者 `.dockerignore` 误排除了 `configs/`、`api/`、`go.mod`。
- **排查**：

  ```bash
  pwd
  test -f go.mod
  test -d configs
  test -f api/Dockerfile
  ```

  如果 `test -f go.mod` 失败，说明当前目录不是项目根目录。

- **修复**：回到项目根目录执行：

  ```bash
  docker build -f api/Dockerfile -t todo-api:v0.1.0 .
  ```

- **预防**：记住 `-f api/Dockerfile` 指定 Dockerfile 路径，最后的 `.` 指定构建上下文。两者不是同一个概念。

### 错误 2：distroless 镜像拉取失败或容器启动失败

- **现象**：

  ```text
  failed to solve: registry.cn-guangzhou.aliyuncs.com/yleoer/static-debian12:nonroot: failed to resolve source metadata
  exec /app/todo-api: no such file or directory
  ```

- **原因**：第一类问题是网络、代理或公司镜像策略导致无法拉取 `registry.cn-guangzhou.aliyuncs.com/yleoer/static-debian12:nonroot`。第二类问题是文件可能真的没复制进去，也可能是二进制依赖动态链接器或系统库，而 distroless static 镜像里没有这些依赖。
- **排查**：

  ```bash
  docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/static-debian12:nonroot
  docker image inspect todo-api:v0.1.0 --format '{{.Config.Entrypoint}}'
  docker history todo-api:v0.1.0
  ```

  如果 `docker pull` 失败，先处理网络、代理或公司镜像缓存；如果镜像能拉取但容器启动失败，并且 Dockerfile 中没有 `CGO_ENABLED=0`，要重点怀疑动态链接问题。

- **修复**：确保构建命令包含：

  ```dockerfile
  CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/todo-api ./api/cmd/todo-api
  ```

  如果只是 distroless 拉取受阻，可以先让公司代理或镜像仓库缓存该镜像；本地教学也可以临时传入 `--build-arg RUNTIME_IMAGE=debian:bookworm-slim` 验证构建链路，但这会改变非 root 用户和镜像体积，需要同步调整 Dockerfile。`debian:bookworm-slim` 没有预置 `nonroot` 用户，切换后还要创建用户或调整 `USER` 指令，因此它只适合作为紧急教学绕过方案，不应作为最终生产方案。如果项目确实需要 CGO，改用包含运行库的 `debian:bookworm-slim`，并明确安装所需动态库。

- **预防**：Go 服务进入 distroless static 镜像前，先确认是否有 CGO 依赖。不要把“镜像越小越好”变成机械选择。

### 错误 3：`config-check` 报 JWT Secret 或用户缺失

- **现象**：

  ```text
  TODO_JWT_SECRET must be at least 32 bytes
  at least one auth user is required
  ```

- **原因**：镜像默认 `TODO_ENV=prod`，生产配置要求显式设置 JWT Secret 和登录用户；或者运行命令忘了传 `TODO_AUTH_USERS`。
- **排查**：

  ```bash
  docker run --rm todo-api:v0.1.0 config-check
  docker image inspect todo-api:v0.1.0 --format '{{json .Config.Env}}'
  ```

  如果没有看到运行时传入的 Secret 和用户变量，说明容器启动命令缺少 `-e`。

- **修复**：先用镜像生成密码哈希，再传入环境变量：

  ```bash
  HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
  docker run --rm \
    -e TODO_ENV=dev \
    -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
    -e "TODO_AUTH_USERS=admin=$HASH" \
    todo-api:v0.1.0 config-check
  ```

- **预防**：Secret 只在运行时注入，不写进 Dockerfile，也不写入镜像层。生产环境使用 Secret 管理系统或 CI/CD Secret。

### 错误 4：API 容器运行但宿主机访问失败

- **现象**：

  ```text
  curl: (7) Failed to connect to 127.0.0.1 port 18080
  ```

  或 Docker 日志里看到服务监听：

  ```text
  "addr":"127.0.0.1:18080"
  ```

- **原因**：容器内服务监听了 `127.0.0.1`，Docker 端口映射无法从宿主机转到容器内部回环地址；或者 `-p` 端口映射写错。
- **排查**：

  ```bash
  docker logs --tail 80 todo-api
  docker port todo-api
  docker inspect todo-api --format '{{json .NetworkSettings.Ports}}'
  ```

  重点看日志中的监听地址是否为 `0.0.0.0:18080`，以及 `docker port` 是否出现 `127.0.0.1:18080`。

- **修复**：启动容器时设置：

  ```bash
  -e TODO_API_ADDR=0.0.0.0:18080
  -p 127.0.0.1:18080:18080
  ```

- **预防**：容器内监听 `0.0.0.0`，宿主机访问用端口映射，容器间访问用容器名和内部端口。

### 错误 5：镜像体积异常或扫描发现敏感文件

- **现象**：

  ```text
  docker image ls todo-api
  # SIZE 过大
  ```

  或 `dive` 中看到 `.git`、`.env`、日志、测试数据等文件进入镜像。

- **原因**：`.dockerignore` 缺失或规则不完整；Dockerfile 把整个上下文复制到了运行镜像；构建产物、日志和密钥没有排除。
- **排查**：

  ```bash
  docker build -f api/Dockerfile -t todo-api:v0.1.0 --progress=plain .
  docker history todo-api:v0.1.0
  dive todo-api:v0.1.0
  ```

  重点看 `transferring context` 的大小、`COPY . .` 后的层大小，以及运行阶段是否只复制了必要文件。

- **修复**：完善 `.dockerignore`，运行阶段只从 builder 复制 `/out/todo-api`、`configs/` 和 `api/migrations/`，不要 `COPY --from=builder /src /app`。
- **预防**：把 `.dockerignore` 作为代码审查重点；在 CI 中加入 hadolint、trivy 和镜像体积检查。

## 7. 生产环境注意事项

1. **镜像标签必须可追踪，发布时优先使用不可变引用**。`latest` 适合本地尝试，不适合生产回滚和审计。生产发布至少保留语义版本、Git commit、构建时间和 OCI Label；关键环境可以使用 digest 部署，确保“这次上线的镜像内容”不会被后来同名标签覆盖。

2. **不要把 Secret 和环境私有配置写入 Dockerfile**。Dockerfile、构建参数、镜像层、构建日志和 registry 都可能被多人访问。数据库密码、Redis 密码、JWT Secret、第三方 Token 应由运行时 Secret 管理系统注入。即使后续层删除了文件，Secret 仍可能留在历史层中。

3. **非 root 和最小镜像是默认安全基线，不是锦上添花**。非 root 能降低容器逃逸或应用漏洞后的破坏范围；distroless 能减少 shell、包管理器和调试工具带来的攻击面。但最小镜像也会降低在线排障便利性，因此团队必须配套日志、指标、追踪和临时调试容器方案。

4. **漏洞扫描要变成发布门禁，但不能机械追求零告警**。扫描结果要区分严重等级、可利用性、是否存在修复版本和业务暴露面。基础镜像、Go 依赖和系统 CA 包都可能引入 CVE。真实团队需要定义“阻塞发布”的阈值，并定期重建镜像吸收上游修复。

5. **构建流程必须可复现、可缓存、可审计**。本地构建成功不代表 CI 构建稳定。生产流水线应固定 Go 版本、基础镜像标签、构建参数和构建平台；记录 commit、构建时间、构建人或流水线编号；使用 registry 保留策略支持回滚，而不是只保留最新镜像。

## 8. 本章小项目

本章小项目是 **Todo API 生产风格镜像**。目标是把第 15 篇的源码挂载运行方式升级为可发布镜像。

项目产出：

- 根目录 `.dockerignore`。
- `api/Dockerfile`。
- 本地镜像 `todo-api:v0.1.0`。
- Git 标签镜像 `todo-api:git-<commit>`。
- 本地 registry 镜像 `localhost:5000/todo-api:v0.1.0`。
- 一份镜像构建记录，可以放入应用仓库 `docs/docker/chapter-16-image-build-record.md`。

最小验收标准：

- `docker build -f api/Dockerfile -t todo-api:v0.1.0 .` 构建成功。
- `docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'` 输出 `nonroot:nonroot`。
- `docker run --rm todo-api:v0.1.0 hash-password "change-me-123"` 能输出 bcrypt 哈希。
- `docker run --rm ... todo-api:v0.1.0 config-check` 能通过配置检查。
- `docker run -d --name todo-api ... todo-api:v0.1.0` 后 `/healthz` 返回 `200 OK`。
- 登录接口能返回 JWT，带 Token 创建 Todo 返回 `201 Created`。
- 你能解释为什么 Dockerfile 在 `api/` 目录，而构建上下文仍然使用项目根目录。

进阶验收标准：

- `hadolint api/Dockerfile` 无严重问题，或你能解释并记录每个告警的处理决定。
- `docker history todo-api:v0.1.0` 或 `dive todo-api:v0.1.0` 的层分析结果已记录。
- `trivy image --severity HIGH,CRITICAL todo-api:v0.1.0` 或 Docker Scout 扫描结果已记录。
- `docker push localhost:5000/todo-api:v0.1.0` 成功，并能重新 `docker pull`。
- 你能说明本地教学工具可以临时使用浮动标签，但 CI 中应固定工具版本或 digest。

构建记录模板：

```markdown title="docs/docker/chapter-16-image-build-record.md"
# Chapter 16 Image Build Record

## 基础信息

- 操作系统：
- Docker 版本：
- Git commit：
- 镜像标签：
- 构建时间：

## 构建结果

- 构建命令：
- 镜像大小：
- Config.User：
- Entrypoint / Cmd：
- OCI Label：

## 工具检查

- hadolint 结果：
- docker history 观察：
- dive 观察：
- trivy / Docker Scout 结果：

## 运行验证

- config-check：
- migrate：
- /healthz：
- 登录：
- 创建 Todo：

## 排障记录

| 问题 | 现象 | 原因 | 修复 | 预防 |
|---|---|---|---|---|
|  |  |  |  |  |
```

## 9. 本章练习题

### 基础题

1. Dockerfile 中 `RUN`、`ENTRYPOINT`、`CMD` 分别在什么时候生效？为什么不能把长期运行的服务写进 `RUN`？
2. 为什么本篇要先 `COPY go.mod go.sum ./`，再 `COPY . .`？这和构建缓存有什么关系？
3. `.dockerignore` 和 `.gitignore` 解决的问题有什么不同？为什么 `.gitignore` 不能替代 `.dockerignore`？
4. 为什么运行镜像不应该使用完整 `golang` 镜像？多阶段构建解决了什么问题？
5. 镜像标签和镜像 digest 有什么区别？为什么生产环境不能只依赖 `latest`？

### 实操题

1. 修改 Dockerfile，把 `TODO_ENV` 默认值从 `prod` 改为 `dev`，重新构建镜像并执行 `docker image inspect`。当你能在 `Config.Env` 中看到新默认值时，说明修改生效。完成后再改回 `prod`，避免把开发默认值带入后续章节。
2. 故意删除 `.dockerignore` 中的 `site/` 或 `tmp/`，创建一个大文件后重新构建，观察 `transferring context` 和镜像构建耗时变化。当你能解释为什么上下文变大时，说明你理解了 `.dockerignore` 的作用。
3. 把 `USER nonroot:nonroot` 临时删除后重新构建，执行 `docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'`。当输出为空或不是 `nonroot:nonroot` 时，说明你看到了默认用户风险。实验结束后必须恢复 `USER` 指令。

### 思考题

1. 如果安全扫描报告里出现一个 HIGH 漏洞，但业务必须今天上线，你会如何和开发、安全、SRE 一起评估是否阻塞发布？
2. 如果 CI 中 Docker build 经常因为下载 Go module 超时失败，你会从构建缓存、代理、私有 module、基础镜像和流水线拆分几个角度怎么优化？

## 10. 本章面试题

### 面试题 1：什么是 Docker 多阶段构建？它解决了什么问题？

**一句话结论**：多阶段构建把编译环境和运行环境拆开，最终镜像只保留运行必需文件，从而减小体积、降低漏洞面并提升交付可控性。

**展开解释**：以 Go 服务为例，编译阶段需要 `golang` 镜像、module 缓存、测试工具和源码；运行阶段只需要编译后的二进制、配置文件和迁移脚本。Dockerfile 可以先在 builder 阶段执行 `go test` 和 `go build`，再在 runtime 阶段用 `COPY --from=builder` 复制产物。这样最终镜像不包含 Go 编译器和源码缓存，也更容易配合非 root、distroless 和漏洞扫描。

**深入追问**：多阶段构建不是越多阶段越好。要根据缓存命中、测试策略、构建速度和可读性拆分阶段。生产中还会结合 BuildKit cache mount、registry cache、SBOM、provenance 和多平台构建，把本地 Dockerfile 扩展成 CI/CD 构建链路。

### 面试题 2：`.dockerignore` 为什么重要？它和 `.gitignore` 有什么区别？

**一句话结论**：`.dockerignore` 控制发送给 Docker daemon 的构建上下文，`.gitignore` 控制 Git 是否跟踪文件，两者作用域不同，不能互相替代。

**展开解释**：Docker build 时，客户端会把构建上下文发送给 Docker daemon。即使某个文件没有提交到 Git，只要它在构建上下文里且没有被 `.dockerignore` 排除，就可能参与构建。`.env`、日志、大型临时文件、测试数据和旧二进制都可能拖慢构建或泄露敏感信息。因此 `.dockerignore` 是镜像构建安全和性能的一部分。

**深入追问**：在 monorepo 中，`.dockerignore` 的设计更重要。不同服务可能共享一个根上下文，错误排除会导致构建失败，排除不足会导致上下文巨大。团队可以用 `docker build --progress=plain`、BuildKit 输出和 CI 检查来监控上下文大小。

### 面试题 3：为什么容器要用非 root 用户运行？

**一句话结论**：非 root 运行能降低应用漏洞被利用后的权限范围，是容器生产安全基线的一部分。

**展开解释**：如果容器进程以 root 运行，攻击者拿到应用执行能力后，容器内文件修改、进程操作和潜在逃逸风险都会更高。非 root 不能解决所有安全问题，但能减少默认权限。配合只读文件系统、最小镜像、Capabilities 限制、Seccomp、AppArmor 和 Kubernetes SecurityContext，才能形成更完整的运行时防线。

**深入追问**：非 root 运行需要应用配合。例如日志不能写固定 root 目录，临时文件要写 `/tmp` 或挂载目录，监听低端口需要额外能力。镜像构建时还要处理文件属主和权限，避免运行时出现 `permission denied`。

### 面试题 4：`ENTRYPOINT` 和 `CMD` 怎么设计更适合后端服务？

**一句话结论**：通常用 `ENTRYPOINT` 固定应用二进制，用 `CMD` 提供默认子命令，这样既有默认服务启动方式，也能方便覆盖执行迁移、配置检查和工具命令。

**展开解释**：本篇使用 `ENTRYPOINT ["/app/todo-api"]` 和 `CMD ["serve"]`，默认运行 API 服务；执行 `docker run todo-api:v0.1.0 migrate` 时，Docker 会把 `migrate` 作为参数传给入口二进制。这样同一个镜像可以服务于启动、迁移、OpenAPI 输出、密码哈希和配置检查，减少“运行镜像”和“运维工具镜像”不一致的问题。

**深入追问**：如果入口脚本过于复杂，可能掩盖信号处理、退出码和日志问题。Go 服务应正确处理 SIGTERM 和优雅关闭；迁移命令应该明确失败退出码，避免 CI/CD 或 Kubernetes Job 误判成功。

### 面试题 5：镜像漏洞扫描发现 HIGH 漏洞时，你会怎么处理？

**一句话结论**：先定位漏洞来源和可利用性，再判断是否升级基础镜像或依赖、是否阻塞发布，并把处理决策记录到发布流程中。

**展开解释**：漏洞可能来自基础镜像 OS 包、Go module、间接依赖或扫描数据库误报。处理时要看严重等级、是否有修复版本、应用是否实际使用受影响功能、是否暴露攻击面，以及当前发布是否紧急。常见动作包括升级基础镜像、升级 Go 依赖、替换镜像、等待上游修复、增加临时缓解措施或阻塞发布。

**深入追问**：成熟团队会把扫描放进 CI/CD 门禁，并定义策略，例如 CRITICAL 阻塞、HIGH 需要安全审批、无修复版本需记录例外。还会生成 SBOM，保存镜像 digest 和扫描报告，确保上线后可以追踪和重建。

## 11. 本章总结

本章把 Todo API 从“用 Go 工具链容器临时运行源码”推进到“可构建、可运行、可扫描、可推送的应用镜像”。你学习了 Dockerfile 指令、构建上下文、`.dockerignore`、镜像层缓存、多阶段构建、非 root 用户、distroless 运行镜像、镜像标签、OCI Label、镜像分析和漏洞扫描。

本章项目产出是根目录 `.dockerignore`、`api/Dockerfile`、`todo-api:v0.1.0` 镜像和本地 registry 推送记录。这个镜像会成为后续 Compose、Kubernetes、运行时观察和 CI/CD 的基础制品。

掌握本章后，你已经具备企业后端服务镜像化的核心能力：能写出可审查的 Dockerfile，能解释镜像每一层为什么存在，能排查构建和运行问题，也能和 DevOps、安全、SRE 团队围绕镜像交付进行有效协作。

## 12. 下一章衔接

第 17 篇会把本篇构建出的 `todo-api:v0.1.0`、PostgreSQL 18、Redis 8.2 和端口、网络、数据卷、环境变量整理成 Docker Compose 本地编排。也就是说，第 15 篇手动理解运行参数，第 16 篇把 API 变成镜像，第 17 篇再把多容器环境变成一条 `docker compose up` 命令。

如果跳过本篇直接写 Compose，你会知道如何启动数据库和缓存，却不知道 `api` 服务镜像从哪里来、为什么不能用 `golang + go run` 当生产镜像，也很难理解 Compose 中的 `image`、`build`、`environment`、`ports` 和健康检查应该如何取舍。
