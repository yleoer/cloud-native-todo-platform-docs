# 第 15 篇：Dockerfile 与镜像构建

第 14 篇已经让 Todo API、PostgreSQL 和 Redis 可以通过 Docker CLI 运行起来。但上一章的 Todo API 仍然依赖官方 `golang` 镜像和宿主机源码挂载，这种方式适合学习和开发，不适合交付。

真实公司交付服务时，需要把应用编译产物、运行参数、用户权限、健康接口约定和版本信息封装成一个可发布镜像。这个镜像应当足够小、可复现、可扫描、可追踪，也能被 Docker Compose、Kubernetes 和 CI/CD 复用。

本篇特色项目是：**为 Todo 平台构建安全、小体积、可发布的 Go 服务镜像**。

## 1. 本章学习目标

学完本篇后，你应该能够：

- 理解 Dockerfile 的核心指令：`FROM`、`WORKDIR`、`COPY`、`RUN`、`USER`、`EXPOSE`、`ENV`、`ENTRYPOINT`、`CMD`、`HEALTHCHECK`、`LABEL`。
- 能为 Go 服务编写多阶段构建 Dockerfile。
- 能解释构建上下文、镜像层缓存和 `.dockerignore` 的作用。
- 能使用非 root 用户和最小运行镜像降低安全风险。
- 能使用 `docker build`、`docker image ls`、`docker history`、`docker inspect` 分析镜像。
- 能运行镜像并验证 Todo API 的健康接口、配置检查和镜像元数据。
- 能使用 Trivy 或 Docker Scout 对镜像做基础安全扫描。
- 能为镜像打版本标签，并推送到 Docker Hub、GitHub Container Registry 或公司私有仓库。

本篇完成后，你会得到一个可复用镜像：

```text
todo-api:v0.1.0
├── 已编译 Go 二进制
├── configs/
├── migrations/
├── 非 root 运行用户
├── 健康检查增强预留
└── 版本标签与 OCI 元数据
```

## 2. 本章工作场景

真实团队里，后端服务通常不会把源码目录挂载到生产容器中运行。生产镜像需要满足几个要求：

- 开发、测试、预发、生产使用同一个镜像，只通过配置区分环境。
- 镜像能被 CI/CD 自动构建、扫描和推送。
- 镜像标签能追踪到 Git commit、版本号和构建时间。
- 运行容器时不使用 root 用户。
- 运行镜像尽量小，减少漏洞面和拉取时间。
- 出问题时能通过 `docker inspect`、`docker history` 和镜像标签快速定位来源。

本章模拟一个典型任务：

> Todo API 已经可以在 Docker 中运行。现在团队要求为 Todo API 编写生产风格 Dockerfile，生成可发布镜像，并能解释镜像每一层为什么存在、如何优化、如何扫描和如何推送到镜像仓库。

这个能力是 Go 后端开发、DevOps、SRE 和平台工程师都需要掌握的交付基本功。

## 3. 前置知识

必须掌握：

- 第 14 篇 Docker 镜像、容器、端口映射、网络和数据卷。
- 第 13 篇 Todo API 的 `serve`、`config-check`、`migrate`、`hash-password` 命令。
- Go 基础构建命令：`go build`、`go test`、`go mod download`。
- Linux 文件权限、用户和可执行文件概念。

建议了解：

- Git commit、语义化版本和镜像标签。
- Docker Hub、GitHub Container Registry 或公司 Harbor 仓库。
- CVE、镜像漏洞扫描、供应链安全的基本概念。

本篇实验需要：

| 工具 | 要求 | 说明 |
|---|---|---|
| Docker | Docker Desktop 或 Docker Engine | 能执行 `docker build` 和 `docker run` |
| Todo Platform 代码 | 已完成第 13 篇 | 需要 `cmd/todo-api`、`configs`、`migrations` |
| curl | 必需 | 验证 `/healthz` 和 API |
| jq | 可选 | Linux / macOS / WSL2 下解析登录 token |
| Trivy 或 Docker Scout | 可选 | 用于镜像安全扫描 |
| 镜像仓库账号 | 可选 | 推送镜像时需要 |

!!! note "关于本篇代码位置"
    本篇会在 Todo Platform 应用仓库根目录创建 `Dockerfile` 和 `.dockerignore`。课程文档仓库只记录完整内容和操作步骤，实际练习时请在应用项目根目录执行命令。

## 4. 核心概念

### 4.1 Dockerfile 是什么

Dockerfile 是构建镜像的说明书。它把“如何准备运行环境、复制哪些文件、执行哪些构建命令、容器启动后运行什么进程”写成可版本管理的文本。

一个最小示例：

```dockerfile
FROM alpine:3.20
CMD ["echo", "hello dockerfile"]
```

构建并运行：

```bash
docker build -t hello-dockerfile .
docker run --rm hello-dockerfile
```

Dockerfile 的价值不只是“能构建镜像”，更重要的是把运行环境变成团队可审查、可重复、可追踪的交付物。

### 4.2 构建上下文

执行：

```bash
docker build -t todo-api:v0.1.0 .
```

最后的 `.` 表示构建上下文，也就是 Docker 客户端会把当前目录中的文件发送给 Docker daemon 作为构建输入。

如果上下文里包含 `.git`、日志、临时文件、测试数据、构建产物，就会带来问题：

- 构建变慢。
- 缓存更容易失效。
- 镜像可能意外包含敏感信息。
- CI/CD 中传输大量无关文件。

因此需要 `.dockerignore` 排除不该进入构建上下文的内容。

### 4.3 镜像层与缓存

Dockerfile 中很多指令都会产生镜像层，例如 `COPY`、`RUN`。Docker 会尽量复用已有层缓存。

对于 Go 项目，常见优化是先复制 `go.mod`、`go.sum` 下载依赖，再复制业务源码：

```dockerfile
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o /out/todo-api ./cmd/todo-api
```

这样业务代码变化时，依赖下载层通常可以复用，不必每次都重新下载所有 module。

### 4.4 多阶段构建

Go 编译需要 Go 工具链，但运行编译后的二进制不一定需要完整 Go 环境。

多阶段构建把“编译”和“运行”拆开：

```text
builder 阶段：golang 镜像，下载依赖，编译二进制
runtime 阶段：最小运行镜像，只复制二进制和必要文件
```

这样最终镜像不包含 Go 编译器、module 缓存和源码中不需要的文件，体积更小，风险也更低。

### 4.5 非 root 用户

很多镜像默认使用 root 用户运行。生产容器不应该默认 root，因为一旦应用被攻破，攻击者获得的容器内权限会更高。

Dockerfile 中可以创建普通用户：

```dockerfile
RUN addgroup -S todo && adduser -S -G todo -u 10001 todo
USER 10001:10001
```

或者使用 distroless 这类自带非 root 用户的镜像。本篇会使用 `gcr.io/distroless/static-debian12:nonroot` 作为运行镜像，直接以非 root 身份运行。

### 4.6 最小镜像

最小镜像不是越极端越好，而是要在安全、可排障、证书支持、时区、DNS、运行依赖之间取得平衡。

Go 服务常见运行镜像选择：

| 镜像 | 优点 | 风险或限制 |
|---|---|---|
| `alpine` | 小，包含 shell，排障方便 | musl 与 glibc 差异，仍有包管理器和 shell |
| `debian:bookworm-slim` | 兼容性好，排障较方便 | 体积更大 |
| `scratch` | 极小 | 没有 shell、证书、用户信息，排障困难 |
| `distroless` | 小，默认无 shell，适合生产 | 容器内不能直接 `sh` 排障 |

本篇选择 distroless，目的是让学习者从一开始就接触更接近生产的镜像思路。

### 4.7 镜像标签

镜像标签用于标识版本：

```text
todo-api:v0.1.0
todo-api:git-b2f2d38
todo-api:20260527-001
```

生产环境不建议只使用 `latest`。更好的做法是：

- 人类可读版本：`v0.1.0`。
- Git commit 标签：`git-<short-sha>`。
- CI 构建号或时间标签。
- 必要时记录镜像 digest。

## 5. 原理深入

### 5.1 Docker build 运行流程

```mermaid
flowchart LR
    CLI["docker build"] --> Context["读取构建上下文"]
    Context --> Ignore["应用 .dockerignore"]
    Ignore --> Parser["解析 Dockerfile"]
    Parser --> Step["逐条执行指令"]
    Step --> Cache["命中或生成镜像层缓存"]
    Cache --> Image["生成本地镜像"]
    Image --> Tag["打标签"]
    Tag --> Push["推送镜像仓库"]
```

关键点：

- Dockerfile 指令顺序会影响缓存命中。
- `.dockerignore` 会影响构建上下文内容。
- `RUN` 会在构建阶段执行命令，`CMD` / `ENTRYPOINT` 是容器运行阶段的默认命令。
- 镜像标签只是引用，真正不可变的是 digest。

### 5.2 多阶段构建流程

```mermaid
flowchart TB
    subgraph Builder["builder 阶段"]
        A["FROM golang:1.24-bookworm"] --> B["COPY go.mod go.sum"]
        B --> C["go mod download"]
        C --> D["COPY 源码"]
        D --> E["go test ./..."]
        E --> F["CGO_ENABLED=0 go build"]
    end

    subgraph Runtime["runtime 阶段"]
        G["FROM distroless static nonroot"] --> H["COPY --from=builder /out/todo-api"]
        H --> I["COPY configs / migrations"]
        I --> J["USER nonroot"]
        J --> K["ENTRYPOINT /app/todo-api"]
    end

    F --> H
```

这里的关键思想是：构建阶段可以复杂，运行阶段要克制。

### 5.3 为什么 Go 服务适合静态编译

Go 可以编译成单个二进制文件。对于大多数不依赖 CGO 的服务，可以使用：

```bash
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build
```

静态编译后的二进制更适合放进 distroless 或 scratch 这类最小镜像中。这样运行镜像不需要 Go 工具链，也不需要很多系统动态库。

注意：如果项目使用 SQLite、某些 DNS 解析特性、系统认证库或 CGO 依赖，就不能简单套用 `CGO_ENABLED=0`，需要根据实际依赖选择运行镜像。

### 5.4 ENTRYPOINT 与 CMD

`ENTRYPOINT` 定义容器默认执行程序，`CMD` 定义默认参数。

本篇 Dockerfile 使用：

```dockerfile
ENTRYPOINT ["/app/todo-api"]
CMD ["serve"]
```

这表示默认执行：

```text
/app/todo-api serve
```

如果要执行配置检查，可以覆盖 `CMD`：

```bash
docker run --rm todo-api:v0.1.0 config-check
```

如果要执行迁移：

```bash
docker run --rm todo-api:v0.1.0 migrate
```

这样同一个镜像可以承担服务启动、配置检查、数据库迁移等运维命令。

### 5.5 镜像安全的基本边界

镜像安全不是一个工具就能解决的。至少要关注：

- 基础镜像来源是否可信。
- 镜像是否固定版本或 digest。
- 是否使用非 root 用户。
- 是否包含 shell、包管理器、编译器等不必要工具。
- 是否包含密钥、`.env`、Git 历史、测试数据。
- 是否经过漏洞扫描。
- 镜像标签是否能追踪到源码版本。

本篇会用 Dockerfile 和 `.dockerignore` 解决其中一部分问题，后续 CI/CD 与 Kubernetes 章节会继续完善供应链安全。

## 6. 手把手实验

### 6.1 实验目标

本实验会完成：

- 创建 `.dockerignore`。
- 编写生产风格多阶段 `Dockerfile`。
- 构建 Todo API 镜像 `todo-api:v0.1.0`。
- 分析镜像层和镜像元数据。
- 使用镜像执行 `config-check`、`hash-password`、`serve`。
- 启动 PostgreSQL 和 Redis 依赖容器，并验证 Todo API 访问链路。
- 执行基础安全扫描。
- 为镜像打标签并演示推送仓库流程。
- 清理实验容器和镜像。

### 6.2 实验环境

请在 Todo Platform 应用项目根目录执行命令。目录应该类似：

```text
cloud-native-todo-platform/
├── cmd/todo-api/
├── configs/
├── internal/
├── migrations/
├── go.mod
└── go.sum
```

验证当前目录：

=== "Linux / macOS / WSL2"

    ```bash
    pwd
    test -f go.mod && test -d cmd/todo-api && test -d configs && test -d migrations && echo "project root ok"
    ```

=== "Windows PowerShell"

    ```powershell
    Get-Location
    if ((Test-Path go.mod) -and (Test-Path cmd/todo-api) -and (Test-Path configs) -and (Test-Path migrations)) {
      "project root ok"
    }
    ```

检查 Docker：

```bash
docker version
docker buildx version
```

`docker buildx` 是现代 Docker 构建能力入口。即使本篇主要使用 `docker build`，了解 buildx 对后续多平台镜像和 CI/CD 很重要。

本篇 Dockerfile 默认使用 Go `1.24`，这是课程前后章节保持一致的工具链基线。真实项目可以替换为团队当前使用的 Go 稳定版本，但要同步检查 `go.mod`、CI 构建镜像和本地开发环境，避免不同环境构建出不一致的结果。

### 6.3 本篇新增文件

完成后，Todo Platform 应用仓库会新增：

```text
cloud-native-todo-platform/
├── .dockerignore
└── Dockerfile
```

本篇不会创建 Compose YAML。多容器编排会放到第 16 篇。

### 6.4 编写 `.dockerignore`

在项目根目录创建 `.dockerignore`：

```dockerignore title=".dockerignore"
.git
.github
.idea
.vscode
.DS_Store

# 本地构建产物
bin/
dist/
tmp/
site/
coverage.out
*.test
*.log

# 本地配置和密钥
.env
.env.*
*.pem
*.key
*.crt

# Docker / Compose 本地临时文件
docker-compose.override.yml
```

关键解释：

| 规则 | 原因 |
|---|---|
| `.git` | 避免把 Git 历史传入构建上下文 |
| `.env`、`.env.*` | 避免把本地密钥打进镜像 |
| `bin/`、`dist/`、`tmp/` | 避免旧构建产物污染镜像 |
| `*.log` | 日志属于运行时数据，不应进入镜像 |
| `.idea`、`.vscode` | IDE 配置和镜像运行无关 |

`.dockerignore` 会在后面的 `docker build` 中生效。构建时可以观察 `load build context` 或 `transferring context` 的输出，如果上下文仍然很大，通常说明仓库里有大文件没有被 `.dockerignore` 排除。

### 6.5 编写生产风格 Dockerfile

在项目根目录创建 `Dockerfile`：

```dockerfile title="Dockerfile"
# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.24
ARG APP_NAME=todo-api
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_DATE=unknown

FROM golang:${GO_VERSION}-bookworm AS builder

ARG APP_NAME
ARG VERSION
ARG COMMIT
ARG BUILD_DATE

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
      -o /out/${APP_NAME} ./cmd/todo-api

FROM gcr.io/distroless/static-debian12:nonroot AS runtime

ARG APP_NAME
ARG VERSION
ARG COMMIT
ARG BUILD_DATE

LABEL org.opencontainers.image.title="Cloud Native Todo API" \
      org.opencontainers.image.description="Todo Platform Go API service" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${COMMIT}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.source="https://github.com/yleoer/cloud-native-todo-platform"

WORKDIR /app

COPY --from=builder /out/${APP_NAME} /app/todo-api
COPY configs /app/configs
COPY migrations /app/migrations

ENV TODO_CONFIG_DIR=/app/configs \
    TODO_ENV=prod \
    TODO_HTTP_ADDR=0.0.0.0:8080 \
    TODO_MIGRATIONS_DIR=/app/migrations

EXPOSE 8080

USER nonroot:nonroot

HEALTHCHECK NONE

ENTRYPOINT ["/app/todo-api"]
CMD ["serve"]
```

这个 Dockerfile 主线选择 `HEALTHCHECK NONE`，是为了保证当前 Todo API 不需要额外改 Go 代码也能直接构建和运行。它是本篇的“教学主线版”。生产环境仍然建议应用提供独立健康检查命令，再启用 Dockerfile 的 `HEALTHCHECK`，后面会作为“生产增强版”说明。

如果 Todo API 已经支持 `version`、`commit`、`buildDate` 这类构建变量，可以把 `go build` 的 `-ldflags` 增强为：

```dockerfile
-ldflags="-s -w -X main.version=${VERSION} -X main.commit=${COMMIT} -X main.buildDate=${BUILD_DATE}"
```

前提是 `main` 包中确实定义了这些字符串变量。否则不要盲目添加，避免构建参数和应用代码脱节。

`RUN go test ./...` 适合当前课程项目这类不依赖外部服务的单元测试。如果团队后续增加了必须连接 PostgreSQL、Redis 或第三方服务的集成测试，不建议直接放进 Dockerfile 主构建阶段。更稳妥的方式是把集成测试放到 CI 的单独 job，或者使用 `-tags=integration`、`--target test` 等方式拆分测试阶段。

### 6.6 Dockerfile 指令详解

| 指令 | 本篇用法 | 作用 |
|---|---|---|
| `# syntax` | `docker/dockerfile:1.7` | 启用 BuildKit Dockerfile 语法，支持 cache mount |
| `ARG` | `VERSION`、`COMMIT`、`BUILD_DATE` | 构建时变量 |
| `FROM ... AS builder` | Go 构建阶段 | 下载依赖、测试、编译 |
| `WORKDIR` | `/src`、`/app` | 设置工作目录 |
| `COPY go.mod go.sum` | 先复制依赖文件 | 提高依赖缓存命中率 |
| `RUN go mod download` | 下载 Go 依赖 | 生成可复用依赖层 |
| `RUN go test ./...` | 构建时运行测试 | 防止测试失败的代码进入镜像 |
| `RUN go build` | 编译二进制 | 生成 Linux 可执行文件 |
| `FROM distroless` | 运行阶段 | 最小化运行镜像 |
| `LABEL` | OCI 镜像元数据 | 记录版本、commit、来源 |
| `ENV` | 默认运行配置 | 给容器提供默认路径和监听地址 |
| `EXPOSE` | `8080` | 声明服务端口，不能替代 `-p` |
| `USER` | `nonroot:nonroot` | 使用非 root 用户运行 |
| `HEALTHCHECK` | 本篇主线使用 `NONE` | 保证镜像可直接运行；生产增强时再接入应用健康检查 |
| `ENTRYPOINT` | `/app/todo-api` | 固定执行程序 |
| `CMD` | `serve` | 默认执行参数 |

### 6.7 生产增强：补充应用 healthcheck 命令

本篇主线 Dockerfile 不强制健康检查，是为了保证复制即可构建。生产环境更推荐 Todo API 自己提供 `healthcheck` 子命令，然后把 Dockerfile 从教学主线版增强为生产检查版：

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["/app/todo-api", "healthcheck"]
```

如果你希望现在就启用 Docker 内置健康状态，可以按第 13 篇生成的 `cmd/todo-api/main.go` 结构做下面三处修改。

第一处，在 import 中增加：

```go title="cmd/todo-api/main.go"
import (
	"net/http"
	"time"
)
```

第二处，在 `switch command` 中增加命令分支：

```go title="cmd/todo-api/main.go 中的命令分支示例"
case "healthcheck":
	return healthcheck(parent, cfg)
```

第三处，在文件中增加 `healthcheck` 函数：

```go title="cmd/todo-api/main.go 中的 healthcheck 示例"
func healthcheck(ctx context.Context, cfg config.Config) error {
	checkCtx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()

	addr := strings.TrimSpace(cfg.HTTPAddr)
	if addr == "" {
		addr = "0.0.0.0:8080"
	}

	url := "http://127.0.0.1:" + addr
	if strings.HasPrefix(addr, "http://") || strings.HasPrefix(addr, "https://") {
		url = addr
	} else if strings.HasPrefix(addr, ":") {
		url = "http://127.0.0.1" + addr
	} else if strings.HasPrefix(addr, "0.0.0.0:") {
		url = "http://127.0.0.1:" + strings.TrimPrefix(addr, "0.0.0.0:")
	} else if strings.Contains(addr, ":") {
		url = "http://" + addr
	}

	req, err := http.NewRequestWithContext(checkCtx, http.MethodGet, url+"/healthz", nil)
	if err != nil {
		return err
	}

	client := &http.Client{Timeout: 2 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("healthcheck status: %s", resp.Status)
	}
	return nil
}
```

这个实现依赖 HTTP 服务已经启动，适合容器运行期间健康检查。对于 `config-check` 这类启动前检查，仍然应该使用第 13 篇已有命令。

修改后先启动 Todo API，再在另一个终端验证：

=== "Linux / macOS / WSL2"

    ```bash
    TODO_CONFIG_DIR=configs TODO_ENV=dev go run ./cmd/todo-api healthcheck
    ```

=== "Windows PowerShell"

    ```powershell
    $env:TODO_CONFIG_DIR = "configs"
    $env:TODO_ENV = "dev"
    go run ./cmd/todo-api healthcheck
    ```

如果服务没有启动，`healthcheck` 返回失败是正常的。它检查的是运行中的 HTTP 服务，而不是配置文件是否存在。

如果你暂时不想改 Go 代码，就保留主线 Dockerfile 中的 `HEALTHCHECK NONE`。第 16 篇 Compose 会继续演示如何在编排层面做 HTTP 健康检查。

本篇后续实验默认继续使用教学主线版 Dockerfile。也就是说，即使你暂时没有实现 `healthcheck` 子命令，也不影响后面的镜像构建、迁移、启动和接口验证。

### 6.8 构建镜像

设置版本变量：

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

构建镜像：

=== "Linux / macOS / WSL2"

    ```bash
    docker build \
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
      --build-arg VERSION="$VERSION" `
      --build-arg COMMIT="$COMMIT" `
      --build-arg BUILD_DATE="$BUILD_DATE" `
      -t "todo-api:$VERSION" `
      -t "todo-api:git-$COMMIT" `
      .
    ```

为什么要传这些参数？

- `VERSION`：面向发布的版本号。
- `COMMIT`：追踪到源码提交。
- `BUILD_DATE`：记录构建时间。
- 两个 `-t`：同一个镜像同时拥有语义版本标签和 Git 标签。

### 6.9 查看镜像和层信息

查看镜像：

```bash
docker image ls todo-api
```

查看镜像历史：

```bash
docker history todo-api:v0.1.0
```

查看镜像元数据：

```bash
docker image inspect todo-api:v0.1.0
```

只查看 OCI 标签：

=== "Linux / macOS / WSL2"

    ```bash
    docker image inspect todo-api:v0.1.0 \
      --format '{{ json .Config.Labels }}'
    ```

=== "Windows PowerShell"

    ```powershell
    docker image inspect todo-api:v0.1.0 --format '{{ json .Config.Labels }}'
    ```

重点观察：

- 镜像大小是否明显小于完整 `golang` 镜像。
- `Config.User` 是否为非 root。
- `Config.Entrypoint` 是否是 `/app/todo-api`。
- `Config.Cmd` 是否是 `serve`。
- OCI label 是否包含版本、commit、构建时间。

### 6.10 使用镜像执行 config-check

先生成密码哈希：

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
      -e TODO_JWT_SECRET='0123456789abcdef0123456789abcdef' \
      -e "TODO_AUTH_USERS=admin=$HASH" \
      todo-api:v0.1.0 config-check
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm `
      -e TODO_ENV=dev `
      -e TODO_JWT_SECRET='0123456789abcdef0123456789abcdef' `
      -e "TODO_AUTH_USERS=admin=$hash" `
      todo-api:v0.1.0 config-check
    ```

预期能看到配置摘要。这里还没有连接 PostgreSQL 和 Redis，只验证镜像内部的配置文件、二进制和命令入口是否正常。

### 6.11 连接 PostgreSQL 和 Redis 运行镜像

本节复用第 14 篇的网络名和容器名。为了让本篇可以独立复现，下面会完整创建网络、启动依赖容器、等待依赖就绪，再运行 Todo API 镜像。

创建 Docker 网络：

=== "Linux / macOS / WSL2"

    ```bash
    docker network inspect todo-net >/dev/null 2>&1 || docker network create todo-net
    ```

=== "Windows PowerShell"

    ```powershell
    docker network inspect todo-net *> $null
    if ($LASTEXITCODE -ne 0) {
      docker network create todo-net
    }
    ```

启动 PostgreSQL。这里先删除同名旧容器，是为了避免旧实验状态影响本篇复现；如果你要保留第 14 篇的数据，可以跳过删除命令。

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-postgres 2>/dev/null || true

    docker run -d --name todo-postgres \
      --network todo-net \
      -e POSTGRES_USER=todo \
      -e POSTGRES_PASSWORD=todo_password \
      -e POSTGRES_DB=todo_platform \
      postgres:16
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-postgres 2>$null

    docker run -d --name todo-postgres `
      --network todo-net `
      -e POSTGRES_USER=todo `
      -e POSTGRES_PASSWORD=todo_password `
      -e POSTGRES_DB=todo_platform `
      postgres:16
    ```

启动 Redis：

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-redis 2>/dev/null || true

    docker run -d --name todo-redis \
      --network todo-net \
      redis:7 \
      redis-server --requirepass todo_redis_password
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-redis 2>$null

    docker run -d --name todo-redis `
      --network todo-net `
      redis:7 `
      redis-server --requirepass todo_redis_password
    ```

等待 PostgreSQL 就绪：

=== "Linux / macOS / WSL2"

    ```bash
    until docker exec todo-postgres pg_isready -U todo -d todo_platform; do
      sleep 1
    done
    ```

=== "Windows PowerShell"

    ```powershell
    do {
      docker exec todo-postgres pg_isready -U todo -d todo_platform
      if ($LASTEXITCODE -ne 0) {
        Start-Sleep -Seconds 1
      }
    } while ($LASTEXITCODE -ne 0)
    ```

确认 Redis 可访问：

```bash
docker exec todo-redis redis-cli -a todo_redis_password ping
```

预期输出：

```text
PONG
```

这里使用固定容器名 `todo-postgres`、`todo-redis`，是因为 Docker 网络内置 DNS 会把容器名解析为容器 IP。Todo API 容器里的 `todo-postgres:5432` 和 `todo-redis:6379` 就是这样找到依赖服务的。

执行数据库迁移：

=== "Linux / macOS / WSL2"

    ```bash
    docker run --rm --network todo-net \
      -e TODO_ENV=dev \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      todo-api:v0.1.0 migrate
    ```

=== "Windows PowerShell"

    ```powershell
    docker run --rm --network todo-net `
      -e TODO_ENV=dev `
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' `
      todo-api:v0.1.0 migrate
    ```

启动 Todo API：

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-api 2>/dev/null || true

    docker run -d --name todo-api \
      --network todo-net \
      -p 127.0.0.1:8080:8080 \
      -e TODO_ENV=dev \
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' \
      -e TODO_REDIS_ADDR='todo-redis:6379' \
      -e TODO_REDIS_PASSWORD='todo_redis_password' \
      -e TODO_JWT_SECRET='0123456789abcdef0123456789abcdef' \
      -e "TODO_AUTH_USERS=admin=$HASH" \
      todo-api:v0.1.0
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-api 2>$null

    docker run -d --name todo-api `
      --network todo-net `
      -p 127.0.0.1:8080:8080 `
      -e TODO_ENV=dev `
      -e TODO_DATABASE_DSN='postgres://todo:todo_password@todo-postgres:5432/todo_platform?sslmode=disable' `
      -e TODO_REDIS_ADDR='todo-redis:6379' `
      -e TODO_REDIS_PASSWORD='todo_redis_password' `
      -e TODO_JWT_SECRET='0123456789abcdef0123456789abcdef' `
      -e "TODO_AUTH_USERS=admin=$hash" `
      todo-api:v0.1.0
    ```

验证服务健康接口：

=== "Linux / macOS / WSL2"

    ```bash
    docker ps --filter name=todo-api
    docker logs --tail 50 todo-api
    curl -i http://127.0.0.1:8080/healthz
    ```

=== "Windows PowerShell"

    ```powershell
    docker ps --filter name=todo-api
    docker logs --tail 50 todo-api
    curl.exe -i http://127.0.0.1:8080/healthz
    ```

本篇主线 Dockerfile 使用 `HEALTHCHECK NONE`，因此容器本身不会出现 Docker health 状态。只有在 6.7 中启用应用级 `healthcheck` 子命令后，才需要查看容器健康状态：

```bash
docker inspect todo-api --format '{{.State.Health.Status}}'
```

### 6.12 验证登录和 Todo 创建

=== "Linux / macOS / WSL2"

    ```bash
    TOKEN=$(curl -s -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:8080/api/v1/auth/login | jq -r '.data.token')

    curl -s -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"title":"build todo api image"}' \
      http://127.0.0.1:8080/api/v1/todos
    ```

=== "Windows PowerShell"

    ```powershell
    $login = curl.exe -s -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"change-me-123\"}" http://127.0.0.1:8080/api/v1/auth/login | ConvertFrom-Json
    $token = $login.data.token
    curl.exe -s -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"title\":\"build todo api image\"}" http://127.0.0.1:8080/api/v1/todos
    ```

如果 Linux / macOS / WSL2 没有安装 `jq`，先打印登录响应并手动复制 `data.token` 字段。

### 6.13 验证非 root 用户

distroless 镜像没有 shell，不能直接 `docker exec -it todo-api sh`。这正是它的安全特性之一。

通过 `docker inspect` 查看运行用户：

```bash
docker inspect todo-api --format '{{.Config.User}}'
```

预期输出类似：

```text
nonroot:nonroot
```

如果输出为空，说明镜像可能以默认用户运行，需要检查 Dockerfile 的 `USER` 指令或基础镜像默认用户。

### 6.14 对比镜像体积

查看 Go 构建镜像和 Todo API 运行镜像体积：

```bash
docker image ls golang
docker image ls todo-api
```

你会看到 `golang` 镜像通常数百 MB，而多阶段构建后的运行镜像显著更小。镜像越小，通常拉取越快、漏洞面越小，但也会牺牲容器内排障工具。生产环境应通过日志、指标、追踪和临时调试容器解决排障问题。

### 6.15 安全扫描

先检查本机是否已经有扫描工具：

=== "Linux / macOS / WSL2"

    ```bash
    command -v trivy || true
    docker scout version || true
    ```

=== "Windows PowerShell"

    ```powershell
    Get-Command trivy -ErrorAction SilentlyContinue
    docker scout version
    ```

如果安装了 Trivy：

```bash
trivy image todo-api:v0.1.0
```

如果使用 Docker Scout：

```bash
docker scout cves todo-api:v0.1.0
```

如果两个工具都没有安装，可以先跳过扫描步骤，但要理解生产流水线不能跳过这类检查。真实团队通常会在 CI/CD 或镜像仓库中强制执行扫描，而不是依赖开发者本地手工执行。

扫描结果要重点看：

- `CRITICAL` 和 `HIGH` 漏洞数量。
- 漏洞是否来自基础镜像。
- 是否有修复版本。
- 是否是运行时实际可利用风险。

扫描不是为了追求“永远零漏洞”，而是让团队知道风险来源、修复路径和例外审批依据。

### 6.16 打标签

为镜像增加仓库标签。下面以 GitHub Container Registry 为例：

=== "Linux / macOS / WSL2"

    ```bash
    OWNER=<你的 GitHub 用户名或组织名>
    IMAGE=ghcr.io/$OWNER/cloud-native-todo-api

    docker tag todo-api:v0.1.0 $IMAGE:v0.1.0
    docker tag todo-api:v0.1.0 $IMAGE:git-$COMMIT
    ```

=== "Windows PowerShell"

    ```powershell
    $OWNER = "<你的 GitHub 用户名或组织名>"
    $IMAGE = "ghcr.io/$OWNER/cloud-native-todo-api"

    docker tag todo-api:v0.1.0 "${IMAGE}:v0.1.0"
    docker tag todo-api:v0.1.0 "${IMAGE}:git-$COMMIT"
    ```

查看标签：

=== "Linux / macOS / WSL2"

    ```bash
    docker image ls | grep cloud-native-todo-api
    ```

=== "Windows PowerShell"

    ```powershell
    docker image ls | Select-String "cloud-native-todo-api"
    ```

查看本地镜像 ID：

```bash
docker image inspect todo-api:v0.1.0 --format '{{.Id}}'
```

推送到仓库后，还可以查看远程仓库返回的 digest。digest 是镜像内容哈希，比 tag 更适合做最终发布记录。tag 可以被覆盖，digest 不能被同内容外的镜像伪装。

### 6.17 登录并推送镜像

推送到 GHCR 前，需要准备 token。个人本地实验可以使用 GitHub Personal Access Token，至少需要 `write:packages` 权限；如果镜像包关联私有仓库，还要确认仓库访问权限。GitHub Actions 中更推荐使用自动注入的 `GITHUB_TOKEN`，并在 workflow 中授予 `packages: write`。

不要把 token 写进 Dockerfile、`.dockerignore`、`.env` 示例真实值或 Git 仓库。`docker login` 会把登录信息交给 Docker 凭据存储；如果本机没有配置 credential store，凭据可能落到 Docker 配置文件中，因此公共机器和临时环境要在推送后执行 `docker logout`。

登录并推送：

=== "Linux / macOS / WSL2"

    ```bash
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$OWNER" --password-stdin
    docker push $IMAGE:v0.1.0
    docker push $IMAGE:git-$COMMIT
    ```

=== "Windows PowerShell"

    ```powershell
    $env:GHCR_TOKEN | docker login ghcr.io -u $OWNER --password-stdin
    docker push "${IMAGE}:v0.1.0"
    docker push "${IMAGE}:git-$COMMIT"
    ```

`GHCR_TOKEN` 应该使用 GitHub Personal Access Token 或 GitHub Actions 自动注入的 token。不要把 token 写进 Dockerfile、文档示例的真实值或 Git 仓库。

推送成功后，可以查看远程镜像 digest：

=== "Linux / macOS / WSL2"

    ```bash
    docker buildx imagetools inspect $IMAGE:v0.1.0
    ```

=== "Windows PowerShell"

    ```powershell
    docker buildx imagetools inspect "${IMAGE}:v0.1.0"
    ```

如果推送失败，优先检查三件事：

- `OWNER` 是否是正确的 GitHub 用户名或组织名。
- token 是否有 `write:packages` 权限。
- 镜像标签是否带了 `ghcr.io/<owner>/...` 仓库前缀。

如果使用 Docker Hub，标签通常类似：

```text
docker.io/<用户名>/cloud-native-todo-api:v0.1.0
```

如果使用 Harbor，标签通常类似：

```text
harbor.example.com/todo/cloud-native-todo-api:v0.1.0
```

### 6.18 清理实验资源

停止并删除 Todo API 容器：

```bash
docker rm -f todo-api
```

如果你想完整清理本篇实验依赖，也可以删除 PostgreSQL、Redis 和网络：

=== "Linux / macOS / WSL2"

    ```bash
    docker rm -f todo-postgres todo-redis
    docker network rm todo-net
    ```

=== "Windows PowerShell"

    ```powershell
    docker rm -f todo-postgres todo-redis
    docker network rm todo-net
    ```

删除本地镜像：

=== "Linux / macOS / WSL2"

    ```bash
    docker image rm todo-api:v0.1.0 todo-api:git-$COMMIT
    ```

=== "Windows PowerShell"

    ```powershell
    docker image rm todo-api:v0.1.0 "todo-api:git-$COMMIT"
    ```

如果你还要继续第 16 篇 Docker Compose，可以保留 PostgreSQL、Redis、`todo-net` 和数据卷。

## 7. 真实工作案例

某公司准备把 Todo API 从本地开发推进到测试环境。早期团队使用 `golang` 镜像挂载源码运行，测试环境经常出现源码版本不一致、依赖下载失败、启动命令不统一的问题。

团队后来制定镜像规范：

- 每个服务必须有 Dockerfile。
- Go 服务必须使用多阶段构建。
- 运行镜像必须非 root。
- 镜像必须包含 OCI label，记录版本、commit、构建时间和源码地址。
- CI 构建时执行测试和安全扫描。
- 镜像推送到公司 Harbor，部署只引用不可变版本标签。

职责边界通常是：

| 角色 | 关注点 |
|---|---|
| 后端开发 | Dockerfile、构建参数、健康检查命令、配置路径 |
| DevOps | CI 构建、镜像仓库、扫描策略、标签规范 |
| 测试 | 使用指定镜像版本复现问题 |
| SRE | 镜像体积、漏洞风险、运行用户、资源限制 |
| 架构师 | 镜像基线、供应链安全、回滚策略 |

本篇实验就是这个流程的简化版。它让 Todo API 从“开发环境能跑”进入“可被 CI/CD 和 Kubernetes 消费”的阶段。

## 8. 常见错误

| 错误现象 | 常见原因 | 修复方向 |
|---|---|---|
| `COPY failed` | 构建上下文不在项目根目录 | 在包含 `go.mod` 的目录执行 `docker build` |
| `go.sum: no such file` | 项目没有生成 `go.sum` 或 Dockerfile 假设文件存在 | 先执行 `go mod tidy`，或按实际项目调整 `COPY` |
| 每次构建都重新下载依赖 | 先 `COPY . .` 再 `go mod download`，缓存失效 | 先复制 `go.mod go.sum`，再下载依赖 |
| 镜像里包含 `.env` | `.dockerignore` 缺失或规则错误 | 添加 `.env`、`.env.*` 到 `.dockerignore` |
| 容器启动后退出 | `ENTRYPOINT`、`CMD` 或配置错误 | 查看 `docker logs`，用 `config-check` 验证 |
| 迁移连接 PostgreSQL 失败 | PostgreSQL 尚未 ready，或容器不在 `todo-net` 网络 | 执行 `pg_isready`，确认容器名是 `todo-postgres` |
| Todo API 访问 Redis 失败 | Redis 密码错误或容器名不一致 | 用 `redis-cli -a todo_redis_password ping` 验证 |
| `permission denied` | 非 root 用户没有文件执行或读取权限 | 检查 `COPY` 后文件权限和运行用户 |
| 启用 `HEALTHCHECK` 后一直 unhealthy | 镜像没有 `healthcheck` 命令，或服务未监听正确地址 | 暂时改回 `HEALTHCHECK NONE`，或实现应用健康检查命令 |
| `exec /app/todo-api: no such file or directory` | 架构不匹配、动态链接库缺失或二进制路径错误 | 确认 `CGO_ENABLED=0`、`GOOS=linux`、路径正确 |
| distroless 无法 `sh` 进入 | distroless 默认没有 shell | 使用日志、inspect、debug 镜像或临时调试容器 |
| 本地无法执行扫描 | 没安装 Trivy，或 Docker Scout 不可用 | 本地可跳过，但 CI/CD 或仓库扫描不能省略 |
| 推送镜像失败 | 未登录、仓库名错误、token 缺少 `write:packages` | 检查 `docker login`、镜像标签和仓库权限 |
| 扫描漏洞很多 | 基础镜像或依赖存在 CVE | 升级基础镜像、升级依赖、记录例外风险 |

## 9. 排障方法

### 9.1 检查构建上下文

```bash
docker build --progress=plain -t todo-api:debug .
```

重点看：

- `load build context` 的大小是否异常。
- `COPY go.mod go.sum ./` 是否成功。
- `go mod download` 是否能访问依赖。

如果上下文过大，检查 `.dockerignore`。

### 9.2 检查 Dockerfile 缓存

连续构建两次：

```bash
docker build -t todo-api:v0.1.0 .
docker build -t todo-api:v0.1.0 .
```

第二次构建应该大量命中缓存。如果每次都下载依赖，说明 Dockerfile 指令顺序或构建上下文导致缓存失效。

### 9.3 检查镜像入口

```bash
docker image inspect todo-api:v0.1.0 --format '{{.Config.Entrypoint}} {{.Config.Cmd}}'
```

预期能看到：

```text
[/app/todo-api] [serve]
```

如果为空或不符合预期，检查 `ENTRYPOINT` 和 `CMD`。

### 9.4 检查运行用户

```bash
docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'
```

预期不应该是空字符串或 `root`。如果为空，说明镜像可能使用默认 root 用户。

### 9.5 检查二进制是否能运行

```bash
docker run --rm todo-api:v0.1.0 config-check
```

如果提示 `no such file or directory`，常见原因是：

- 二进制不是 Linux 平台。
- 使用了 CGO 但运行镜像缺少动态库。
- `COPY --from=builder` 路径不正确。

### 9.6 检查镜像层

```bash
docker history todo-api:v0.1.0
```

重点看：

- 是否有异常大的层。
- 是否有把源码、测试数据或临时文件复制到运行镜像。
- 是否有敏感参数出现在历史记录中。

不要用 `RUN echo "secret=..."` 这类方式写密钥。镜像层历史可能留下痕迹。

### 9.7 检查健康状态

本篇主线 Dockerfile 使用 `HEALTHCHECK NONE`。这种情况下 `.State.Health` 为空是正常现象，说明 Docker 没有为这个容器维护内置健康状态。

只有在你按 6.7 启用 `HEALTHCHECK` 后，才需要检查：

```bash
docker inspect todo-api --format '{{json .State.Health}}'
```

如果状态是 `unhealthy`：

- 先看 `docker logs todo-api`。
- 确认 `HEALTHCHECK` 命令在镜像中存在。
- 确认服务监听 `0.0.0.0:8080`。
- 确认健康检查超时时间足够。

### 9.8 检查镜像标签和仓库

```bash
docker image ls todo-api
docker image ls ghcr.io/<你的 GitHub 用户名或组织名>/cloud-native-todo-api
```

推送失败时，确认：

- 已执行 `docker login`。
- 本地镜像标签包含仓库地址。
- 用户对目标仓库有写权限。
- 公司网络允许访问对应 registry。

## 10. 生产环境注意事项

### 10.1 固定基础镜像版本

不要在生产 Dockerfile 中长期使用：

```dockerfile
FROM golang:latest
```

更推荐：

```dockerfile
FROM golang:1.24-bookworm
```

严格场景可以固定 digest：

```dockerfile
FROM golang:1.24-bookworm@sha256:<digest>
```

固定 digest 可复现性更强，但升级需要主动维护。

### 10.2 构建时不要注入密钥

不要通过 `ARG` 或 `ENV` 把数据库密码、JWT Secret、registry token 写进镜像。Dockerfile、镜像层和构建日志都可能留下痕迹。

敏感信息应在运行时注入：

- Docker `-e`。
- Docker Compose `env_file` 或 secret。
- Kubernetes Secret。
- CI/CD 密钥管理。

### 10.3 非 root 不是万能安全

非 root 能降低容器内权限风险，但仍然需要配合：

- 最小 capabilities。
- 只读根文件系统。
- 不使用 privileged。
- 限制 hostPath / volume。
- 网络访问控制。
- 镜像漏洞扫描。

### 10.4 distroless 的排障策略

distroless 没有 shell，这是安全优势，也是排障限制。

生产中常见做法：

- 应用日志输出到 stdout / stderr。
- 暴露 `/healthz`、`/readyz`、`/metrics`。
- 使用 Kubernetes ephemeral container 调试。
- 准备 debug 版本镜像，但不能用于生产常态运行。
- 用 `docker inspect`、`kubectl describe`、日志平台和监控系统定位问题。

### 10.5 镜像扫描要进入流水线

本地手工扫描只能帮助学习。生产环境应把扫描纳入 CI/CD：

- PR 构建镜像后扫描。
- 主干合并后扫描。
- 推送仓库后由 registry 继续扫描。
- 对 `CRITICAL`、`HIGH` 漏洞设置阻断策略或例外审批。

### 10.6 标签策略要支持回滚

生产发布不要只依赖 `latest`。至少保留：

- 版本标签：`v0.1.0`。
- Git 标签：`git-<short-sha>`。
- 构建号或日期标签。
- 部署记录中的镜像 digest。

回滚时应能明确回到哪个镜像，而不是重新构建一个“看起来一样”的镜像。

### 10.7 多平台镜像要谨慎

如果团队同时使用 amd64 和 arm64，需要构建多平台镜像：

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t <image>:v0.1.0 --push .
```

多平台构建可能涉及 QEMU 模拟、CGO、基础镜像平台支持和构建耗时。生产中应在 CI 环境明确平台策略。

## 11. 本章小项目

本章小项目是：**为 Todo 平台构建安全、小体积、可发布的 Go 服务镜像**。

项目成果：

- `.dockerignore`：控制构建上下文，避免敏感文件进入镜像。
- `Dockerfile`：多阶段构建 Todo API。
- `todo-api:v0.1.0`：本地可运行镜像。
- `todo-api:git-<commit>`：可追踪源码版本的镜像标签。
- 可选仓库镜像：`ghcr.io/<owner>/cloud-native-todo-api:v0.1.0`。

### 验收命令

```bash
docker build -t todo-api:v0.1.0 .
docker image ls todo-api
docker history todo-api:v0.1.0
docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'
docker run --rm todo-api:v0.1.0 config-check
docker run --rm todo-api:v0.1.0 hash-password "change-me-123"
```

### 能力验收标准

- 能写出完整 Dockerfile，并解释每条关键指令。
- 能写出 `.dockerignore`，并说明为什么要排除敏感文件。
- 能解释多阶段构建如何减少镜像体积和风险。
- 能构建 Todo API 镜像并运行 `config-check`。
- 能通过镜像运行 Todo API 并完成接口验证。
- 能解释非 root 用户、distroless、健康检查和安全扫描的价值。
- 能为镜像打版本标签和 Git 标签。
- 能说明推送镜像仓库的登录、标签和权限要求。

## 12. 本章练习题

### 基础题

1. `RUN`、`CMD`、`ENTRYPOINT` 分别在什么时候执行？
2. 为什么 Go 服务适合使用多阶段构建？
3. `.dockerignore` 和 `.gitignore` 有什么区别？
4. 为什么生产镜像不建议使用 root 用户运行？
5. 为什么生产环境不建议只使用 `latest` 标签？

### 实操题

1. 修改 Dockerfile，让构建阶段输出 `go version`。
2. 故意删除 `.dockerignore` 中的 `.env` 规则，观察构建上下文变化，然后恢复。
3. 使用 `docker history` 找出镜像中最大的层。
4. 使用 `docker image inspect` 查看 OCI labels。
5. 给镜像增加 `todo-api:local` 标签，并运行该标签。

### 思考题

1. distroless 镜像无法进入 shell，生产排障应该如何设计？
2. 构建时执行 `go test ./...` 有什么好处和代价？
3. 镜像扫描发现高危漏洞时，团队应该如何决策？
4. 固定基础镜像 digest 的好处和维护成本是什么？
5. 为什么镜像 digest 比 tag 更适合做最终部署追踪？

## 13. 本章面试题

### 1. Dockerfile 中 `RUN`、`CMD`、`ENTRYPOINT` 的区别是什么？

参考答案：

`RUN` 在镜像构建阶段执行，会生成镜像层；`ENTRYPOINT` 和 `CMD` 在容器运行阶段生效。`ENTRYPOINT` 通常定义固定执行程序，`CMD` 提供默认参数。两者组合可以让同一个镜像支持默认启动服务，也支持覆盖参数执行 `config-check`、`migrate` 等命令。

### 2. 什么是多阶段构建？为什么 Go 项目常用它？

参考答案：

多阶段构建是在一个 Dockerfile 中使用多个 `FROM`。前一个阶段负责编译，后一个阶段只复制运行需要的产物。Go 项目可以在 `golang` 镜像中编译，然后把静态二进制复制到 distroless 或 scratch 运行镜像中，从而减少镜像体积和攻击面。

### 3. 如何优化 Docker 构建缓存？

参考答案：

把变化少的步骤放前面，变化频繁的源码复制放后面。Go 项目通常先复制 `go.mod`、`go.sum` 并执行 `go mod download`，再复制业务源码并编译。这样业务代码变化时，依赖下载层可以复用。

### 4. `.dockerignore` 有什么作用？

参考答案：

`.dockerignore` 控制哪些文件不会进入 Docker 构建上下文。它可以减少上下文大小、提高构建速度、避免缓存误失效，也能防止 `.env`、密钥、Git 历史、日志和临时文件进入镜像。

### 5. 为什么容器中要使用非 root 用户？

参考答案：

非 root 可以降低应用被攻破后的权限风险。即使攻击者获得容器内代码执行能力，也不应默认拥有 root 权限。非 root 还需要配合能力限制、只读文件系统、Secret 管理和网络控制。

### 6. distroless 镜像的优缺点是什么？

参考答案：

优点是体积小、无 shell、无包管理器、攻击面较小，适合生产运行。缺点是容器内排障不方便，不能直接 `sh` 进去查看。团队需要依赖日志、指标、追踪、健康检查和调试容器。

### 7. 镜像 tag 和 digest 有什么区别？

参考答案：

tag 是可变引用，同一个 tag 可能被重新推送覆盖；digest 是镜像内容的不可变哈希。生产部署可以使用 tag 做人类可读版本，但最终发布记录最好保存 digest，便于精确回滚和审计。

### 8. 如何处理镜像扫描发现的漏洞？

参考答案：

先判断漏洞来自基础镜像、系统包还是应用依赖；再看严重级别、是否有修复版本、服务是否实际暴露风险。能升级就升级；暂时不能修复时需要记录风险例外、缓解措施和后续修复计划。CI/CD 可对关键漏洞设置阻断策略。

## 14. 本章总结

本篇把 Todo API 从“使用 Go 镜像挂载源码运行”推进到“拥有自己的可发布镜像”：

- 学习了 Dockerfile 核心指令和运行阶段差异。
- 编写了 `.dockerignore` 控制构建上下文。
- 使用多阶段构建编译 Go 服务。
- 使用 distroless 和非 root 用户降低运行风险。
- 为镜像增加 OCI 标签、版本标签和 Git 标签。
- 使用 `docker history`、`docker inspect` 分析镜像。
- 使用 Trivy 或 Docker Scout 做基础安全扫描。
- 演示了镜像推送到仓库的流程。

本篇能力直接对应真实公司中的镜像交付、CI/CD 构建、漏洞扫描和版本回滚。

## 15. 下一章衔接

下一篇会进入 **Docker Compose 编排**。

第 14 篇中我们用多条 `docker run` 命令分别启动 PostgreSQL、Redis 和 Todo API。第 15 篇中我们把 Todo API 构建成了自己的镜像。接下来就可以把这些容器、网络、数据卷、环境变量、健康检查统一写入 Compose 文件。

下一篇会完成：

- 编写 `compose.yaml`。
- 一键启动 Todo API、PostgreSQL、Redis。
- 使用 Compose 管理网络、数据卷和环境变量。
- 使用 `.env` 管理本地开发配置。
- 排查多容器依赖启动、健康检查和日志问题。
