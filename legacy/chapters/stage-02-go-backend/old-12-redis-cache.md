# 第 12 篇：Redis、缓存与异步任务

第 11 篇已经让 Todo Platform 拥有 PostgreSQL 持久化能力。服务可以可靠保存数据，但在真实后端系统中，仅有数据库还不够：热点查询会反复打到数据库，恶意或突发请求会冲垮接口，耗时统计也不适合每次同步计算。

本篇进入后端系统的第二层数据能力：**Redis 缓存、接口限流和简单异步任务处理**。

本篇不会把 Redis 当成“更快的数据库”来讲，而是围绕真实工作场景说明它适合解决什么问题、不适合承担什么职责，以及在 Todo Platform 中如何安全接入。

本篇特色项目是：**为 Todo 平台增加缓存、接口限流和异步统计任务**。

## 1. 本章学习目标

学完本篇后，你应该能够：

- 理解 Redis 为什么常用于缓存、计数器、限流、分布式锁和轻量任务队列。
- 能使用 Redis 常见数据结构：String、Hash、List、Set、Sorted Set。
- 能用 Go 和 `go-redis` 连接 Redis，并正确处理超时、错误和连接关闭。
- 能为 Todo 查询和统计增加缓存，并设计合理的缓存 Key 和 TTL。
- 能解释缓存穿透、缓存击穿、缓存雪崩的现象、原因和解决方案。
- 能用 Redis 实现固定窗口限流，并说明这种限流方式的边界。
- 能理解分布式锁的基本写法和风险，不把锁当成万能一致性工具。
- 能用 Redis List 实现一个简单任务队列，让 Todo 统计刷新异步执行。
- 能说明 Redis 在生产环境中的安全、容量、持久化、高可用和可观测风险。

本篇完成后，Todo Platform 会从“可靠持久化数据的后端服务”继续升级为“具备缓存、限流和异步处理能力的后端服务”。

## 2. 本章工作场景

在公司项目里，Redis 常出现在这些场景中：

- 高频读接口：例如首页 Todo 列表、统计面板、用户信息、权限信息。
- 热点数据保护：避免每个请求都查询 PostgreSQL。
- 接口限流：限制同一个 IP、用户或 API Token 在短时间内的请求数量。
- 幂等和短期状态：保存验证码、一次性 token、短期任务状态。
- 分布式锁：控制多个服务副本不要同时执行同一段关键逻辑。
- 简单异步任务：把“更新统计”“写审计补充信息”“发送通知”从请求链路中拆出去。

本篇的 Todo 平台会模拟一个真实需求：

> Todo API 上线后，`GET /api/v1/todos` 和 `/readyz` 中的统计读取频率很高。团队希望用 Redis 缓存 Todo 列表和统计结果；同时为业务接口增加 IP 限流，避免压测或异常客户端把服务打满；最后把统计刷新放入 Redis 队列，由后台 worker 异步处理。

这里有一个重要边界：Redis 是加速层和协调层，不是本篇 Todo 数据的最终事实来源。Todo 的最终数据仍然在 Repository 背后的文件存储或 PostgreSQL 中，Redis 缓存随时可以删除并重建。

## 3. 前置知识

学习本篇前，必须掌握：

- 第 7 篇的 Go 基础语法、结构体、接口和错误处理。
- 第 8 篇的 goroutine、channel、context 超时和取消。
- 第 9 篇的项目结构、配置、日志和测试。
- 第 10 篇的 Todo API、Handler、中间件和优雅关闭。
- 第 11 篇的 Repository 分层、数据库连接池和生产数据风险意识。

建议了解：

- Docker Compose 基本命令。
- HTTP 请求链路和 IP / Header 的含义。
- 数据库压力、缓存命中率、超时和重试的基本概念。

如果你第一次接触 Redis，可以先把它理解成一个运行在内存里的网络服务。Go 程序通过 TCP 连接 Redis，发送 `GET`、`SET`、`INCR`、`LPUSH` 这类命令，Redis 返回结果。

## 4. 核心概念

### 4.1 Redis 是什么

Redis 是一种内存型数据存储系统，常用于缓存、计数、排行榜、消息队列和分布式协调。

它和 PostgreSQL 的定位不同：

| 对比项 | PostgreSQL | Redis |
|---|---|---|
| 主要定位 | 关系型持久化数据库 | 内存型数据结构服务 |
| 数据模型 | 表、行、SQL、事务 | Key-Value 和多种数据结构 |
| 常见用途 | 事实数据、事务、一致性 | 缓存、限流、队列、短期状态 |
| 数据可靠性 | 强持久化能力 | 可持久化，但通常不作为唯一事实来源 |
| 查询方式 | SQL | 命令 |

在 Todo Platform 中，PostgreSQL 或文件存储负责保存 Todo 的最终状态，Redis 负责加速读取、限制请求和异步处理。

### 4.2 常见数据结构

Redis 的 Key 是字符串，Value 可以有不同结构：

| 数据结构 | 示例命令 | 典型用途 |
|---|---|---|
| String | `SET`、`GET`、`INCR` | 缓存 JSON、计数器、限流 |
| Hash | `HSET`、`HGETALL` | 对象字段、配置、会话摘要 |
| List | `LPUSH`、`BRPOP` | 简单队列 |
| Set | `SADD`、`SISMEMBER` | 去重集合、标签 |
| Sorted Set | `ZADD`、`ZRANGE` | 排行榜、延迟任务 |

本篇会重点使用：

- String：缓存 Todo 列表和统计结果。
- String + `INCR`：实现接口限流计数。
- List：实现简单异步任务队列。

### 4.3 缓存 Key 和 TTL

缓存不是随便 `SET` 一个值就结束。生产项目要认真设计 Key 和过期时间。

Todo 缓存 Key 示例：

```text
todo:cache:list:all
todo:cache:list:pending
todo:cache:list:done
todo:cache:stats
```

设计原则：

- 用业务前缀区分模块，例如 `todo`。
- 用用途区分缓存、限流、任务，例如 `cache`、`ratelimit`、`tasks`。
- Key 中包含查询条件，例如 `pending`、`done`。
- 给缓存设置 TTL，避免永久脏数据。

TTL 不是越长越好。TTL 太短，命中率低；TTL 太长，数据可能过旧。本地实验使用 `30s`，生产环境要结合业务实时性和数据库压力调整。

### 4.4 缓存穿透、击穿、雪崩

缓存系统最常见的三个问题：

| 问题 | 现象 | 常见解决方案 |
|---|---|---|
| 缓存穿透 | 查询不存在的数据，每次都打到数据库 | 缓存空值、参数校验、布隆过滤器 |
| 缓存击穿 | 一个热点 Key 过期，大量请求同时打到数据库 | 互斥重建、提前刷新、热点 Key 不轻易过期 |
| 缓存雪崩 | 大量 Key 同时过期，数据库瞬间被打爆 | TTL 加随机抖动、分批预热、降级限流 |

本篇的 Todo 项目会做两个基础动作：

- 对列表和统计缓存设置 TTL。
- 写操作后主动删除相关缓存，让下一次读请求重建缓存。

### 4.5 限流

限流是为了保护系统在异常流量下仍然可控。

最简单的固定窗口限流可以这样理解：

```text
同一个客户端在 1 分钟内最多请求 60 次。
超过 60 次后，接口返回 429 Too Many Requests。
下一分钟重新计数。
```

固定窗口实现简单，但边界也明显：如果客户端在窗口结尾请求 60 次，又在下个窗口开头请求 60 次，短时间内可能形成突刺。生产中常见更平滑的算法包括滑动窗口和令牌桶。

### 4.6 分布式锁

在单进程里可以用 `sync.Mutex` 加锁；多个 Pod 或多个进程之间，内存锁就不够了。Redis 可以用 `SET key value NX PX 3000` 实现一个基础分布式锁。

但要记住：

- 锁必须有过期时间，避免持锁进程崩溃后永远不释放。
- 解锁时必须校验 value，避免误删别人的锁。
- 锁超时后业务还没执行完，会出现并发执行风险。
- 分布式锁不能替代数据库事务和唯一约束。

本篇会讲分布式锁思想，但项目主线不依赖锁保证 Todo 一致性。Todo 一致性仍然交给 Repository 和数据库事务。

### 4.7 简单任务队列

Redis List 可以实现一个轻量队列：

```text
生产者：RPUSH todo:tasks:stats {"type":"refresh_stats"}
消费者：BLPOP todo:tasks:stats 5
```

本篇用它做异步统计刷新。写操作完成后，把“刷新统计缓存”的任务放进队列；后台 worker 消费任务，重新计算统计结果。

这不是完整消息队列方案。生产中如果需要可靠投递、重试、死信、顺序语义和消费组，应该评估 Redis Streams、Kafka、RabbitMQ 或云厂商消息队列。

## 5. 原理深入

### 5.1 接入 Redis 后的请求链路

```mermaid
sequenceDiagram
    participant Client as HTTP Client
    participant API as Todo API
    participant RL as Redis Rate Limit
    participant Cache as Redis Cache
    participant Repo as Todo Repository
    participant DB as PostgreSQL or File

    Client->>API: GET /api/v1/todos
    API->>RL: INCR rate limit key
    RL-->>API: allowed
    API->>Cache: GET todo:cache:list:all
    alt cache hit
        Cache-->>API: cached JSON
    else cache miss
        API->>Repo: List()
        Repo->>DB: read data
        DB-->>Repo: rows/items
        Repo-->>API: items
        API->>Cache: SET cached JSON EX 30
    end
    API-->>Client: JSON response
```

关键点：

- 限流发生在业务处理之前，用来保护后端资源。
- 缓存命中时，不需要访问 Repository 背后的数据库或文件。
- 缓存未命中时，从 Repository 读取真实数据，再写入 Redis。
- 写操作后要删除相关缓存，否则读请求可能拿到旧数据。

### 5.2 Cache-Aside 模式

本篇采用 Cache-Aside，也叫旁路缓存。

读流程：

1. 先读 Redis。
2. 命中则直接返回。
3. 未命中则读 Repository。
4. 把结果写入 Redis。
5. 返回结果。

写流程：

1. 先写 Repository。
2. 写成功后删除相关缓存。
3. 下次读请求重新加载并写入缓存。

为什么写操作后通常删除缓存，而不是直接更新缓存？

因为一个写操作可能影响多个缓存 Key。例如 Todo 标记完成后，`list:all`、`list:pending`、`list:done`、`stats` 都可能变化。直接更新所有缓存很容易漏掉 Key。删除缓存更简单，也更不容易出错。

### 5.3 Redis 连接不是每次请求都创建

Go 中 `redis.Client` 内部维护连接池。正确方式是应用启动时创建一次，整个进程复用，退出时关闭。

错误方式：

```go
func handler(w http.ResponseWriter, r *http.Request) {
	client := redis.NewClient(...)
	defer client.Close()
}
```

这样每个请求都创建连接池，会导致连接频繁建立和释放，延迟变高，也可能压垮 Redis。

### 5.4 限流 Key 的设计

限流 Key 通常包含：

```text
业务前缀:限流对象:时间窗口
```

示例：

```text
todo:ratelimit:127.0.0.1:29401234
```

其中最后一段是当前时间窗口编号。每个窗口内用 `INCR` 计数，并设置过期时间。窗口过期后，Key 自动删除。

### 5.5 Redis 队列的可靠性边界

Redis List 适合学习和轻量任务，但有几个边界：

- 消费者取出任务后如果崩溃，任务可能丢失。
- 没有天然死信队列。
- 重试需要自己设计。
- 多消费者场景要考虑任务幂等。

因此本篇的异步统计任务只用于“可丢弃、可重算”的统计刷新。即使任务丢失，下一次读请求仍然可以重新计算统计结果。

## 6. 手把手实验

### 6.1 实验目标

本实验会完成以下工作：

- 使用 Docker Compose 启动 Redis。
- 学习 Redis 常见命令和数据结构。
- 在 Go 项目中接入 `go-redis`。
- 增加 Redis 配置和连接初始化。
- 为 Todo Repository 增加缓存包装层。
- 为 API 增加 Redis 固定窗口限流。
- 用 Redis List 实现简单异步统计刷新队列。
- 补充 Redis 缓存、限流和任务队列的自动化测试。
- 更新启动入口、验证脚本和验收命令。

### 6.2 实验环境

需要准备：

- Go 1.24 或更新版本。
- Docker Desktop 或 Docker Engine。
- Docker Compose v2。
- 已完成第 10 篇 Todo API；如果已完成第 11 篇 PostgreSQL，本篇也能直接叠加。

本篇使用：

```text
redis:8.4.3-alpine
github.com/redis/go-redis/v9 v9.19.0
github.com/alicebob/miniredis/v2 v2.38.0
```

说明：

- Redis Open Source 8.4 已发布 GA，本篇固定使用 `8.4.3-alpine` 补丁版本，避免使用浮动 `latest` 或只固定到 minor 的 `8.4-alpine`。
- `go-redis/v9` 是 Redis 官方维护的 Go 客户端，当前用于连接 Redis 7+ 和 Redis 8 系列。
- `miniredis` 用于单元测试中模拟 Redis，这样限流、缓存和队列测试不依赖本机 Docker 是否已经启动。

检查命令：

=== "Linux / macOS / WSL2"

    ```bash
    go version
    docker version
    docker compose version
    ```

=== "Windows PowerShell"

    ```powershell
    go version
    docker version
    docker compose version
    ```

### 6.3 本篇目录结构

完成后，项目会新增或修改这些文件：

```text
cloud-native-todo-platform/
├── cmd/
│   └── todo-api/
│       └── main.go
├── configs/
│   └── local.example.json
├── internal/
│   ├── app/
│   │   └── app.go
│   ├── cache/
│   │   └── redis.go
│   ├── config/
│   │   └── config.go
│   ├── httpapi/
│   │   ├── middleware.go
│   │   └── router.go
│   ├── ratelimit/
│   │   ├── redis_limiter.go
│   │   └── redis_limiter_test.go
│   ├── tasks/
│   │   ├── redis_queue.go
│   │   └── redis_queue_test.go
│   └── todo/
│       ├── redis_cache.go
│       └── redis_cache_test.go
├── docker-compose.yml
├── go.mod
├── Makefile
└── scripts/
    └── verify.ps1
```

### 6.4 启动 Redis

修改 `docker-compose.yml`，在第 11 篇 PostgreSQL 基础上增加 Redis 服务。如果你暂时没有 PostgreSQL，也可以只保留 `redis` 服务。

```yaml title="docker-compose.yml"
services:
  postgres:
    image: postgres:18.4-alpine
    container_name: todo-postgres
    environment:
      POSTGRES_USER: todo
      POSTGRES_PASSWORD: todo_password
      POSTGRES_DB: todo_platform
      PGDATA: /var/lib/postgresql/18/docker
    ports:
      - "5432:5432"
    volumes:
      - todo-postgres-data:/var/lib/postgresql
      - ./migrations:/migrations:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U todo -d todo_platform"]
      interval: 5s
      timeout: 3s
      retries: 10

  redis:
    image: redis:8.4.3-alpine
    container_name: todo-redis
    command:
      - redis-server
      - --appendonly
      - "yes"
      - --requirepass
      - todo_redis_password
    ports:
      - "6379:6379"
    volumes:
      - todo-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "todo_redis_password", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  todo-postgres-data:
  todo-redis-data:
```

关键字段说明：

- `image`：固定 Redis 8.4.3 Alpine 镜像，便于复现；生产环境升级 Redis 时应先阅读 release notes，再灰度升级。
- `command`：开启 AOF，并设置本地实验密码。
- `ports`：把容器内 `6379` 暴露到本机。
- `volumes`：把 Redis 数据目录持久化到 Docker volume。
- `healthcheck`：用 `redis-cli ping` 判断 Redis 是否可用。

启动 Redis：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose up -d redis
    docker compose ps
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose up -d redis
    docker compose ps
    ```

预期看到 `todo-redis` 处于 `running` 或 `healthy` 状态。

如果这里失败，先不要继续写 Go 代码，优先确认三件事：

- `docker version` 能正常输出客户端和服务端版本。
- Docker Desktop 已启动，并且 Windows 用户已经开启 WSL2 集成。
- 本机 `6379` 端口没有被其他 Redis 或旧容器占用。

端口冲突时可以先执行：

=== "Linux / macOS / WSL2"

    ```bash
    lsof -i :6379
    ```

=== "Windows PowerShell"

    ```powershell
    netstat -ano | findstr :6379
    ```

验证连接：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec redis redis-cli -a todo_redis_password ping
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec redis redis-cli -a todo_redis_password ping
    ```

预期输出：

```text
PONG
```

### 6.5 练习 Redis 常用命令

String 缓存：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec redis redis-cli -a todo_redis_password SET todo:demo "hello redis" EX 60
    docker compose exec redis redis-cli -a todo_redis_password GET todo:demo
    docker compose exec redis redis-cli -a todo_redis_password TTL todo:demo
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec redis redis-cli -a todo_redis_password SET todo:demo "hello redis" EX 60
    docker compose exec redis redis-cli -a todo_redis_password GET todo:demo
    docker compose exec redis redis-cli -a todo_redis_password TTL todo:demo
    ```

Hash 对象：

```bash
docker compose exec redis redis-cli -a todo_redis_password HSET todo:item:1 title "learn redis" status pending
docker compose exec redis redis-cli -a todo_redis_password HGETALL todo:item:1
```

List 队列：

```bash
docker compose exec redis redis-cli -a todo_redis_password RPUSH todo:tasks:stats '{"type":"refresh_stats"}'
docker compose exec redis redis-cli -a todo_redis_password LPOP todo:tasks:stats
```

计数器：

```bash
docker compose exec redis redis-cli -a todo_redis_password INCR todo:counter:demo
docker compose exec redis redis-cli -a todo_redis_password EXPIRE todo:counter:demo 60
```

这些命令分别对应本篇项目中的缓存、任务队列和限流能力。

### 6.6 更新 Go module

修改 `go.mod`：

```go title="go.mod"
module cloud-native-todo-platform

go 1.24

require (
	github.com/alicebob/miniredis/v2 v2.38.0
	github.com/go-chi/chi/v5 v5.3.0
	github.com/jackc/pgx/v5 v5.9.2
	github.com/redis/go-redis/v9 v9.19.0
)
```

执行：

=== "Linux / macOS / WSL2"

    ```bash
    go mod tidy
    ```

=== "Windows PowerShell"

    ```powershell
    go mod tidy
    ```

`go mod tidy` 会根据实际导入补全间接依赖。

### 6.7 增加 Redis 配置

修改 `internal/config/config.go`：

```go title="internal/config/config.go"
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	defaultAppName           = "todo-api"
	defaultEnv               = "local"
	defaultHTTPAddr          = ":8080"
	defaultLogLevel          = "info"
	defaultShutdownTimeout   = 5 * time.Second
	defaultCacheTTL          = 30 * time.Second
	defaultRateLimitRequests = 60
	defaultRateLimitWindow   = time.Minute
)

type Config struct {
	AppName           string
	Env               string
	HTTPAddr          string
	DataPath          string
	DatabaseDSN       string
	RedisAddr         string
	RedisPassword     string
	RedisDB           int
	CacheTTL          time.Duration
	RateLimitRequests int
	RateLimitWindow   time.Duration
	LogLevel          string
	ShutdownTimeout   time.Duration
	EnableDebug       bool
}

type fileConfig struct {
	AppName           string `json:"app_name"`
	Env               string `json:"env"`
	HTTPAddr          string `json:"http_addr"`
	DataPath          string `json:"data_path"`
	DatabaseDSN       string `json:"database_dsn"`
	RedisAddr         string `json:"redis_addr"`
	RedisPassword     string `json:"redis_password"`
	RedisDB           *int   `json:"redis_db"`
	CacheTTL          string `json:"cache_ttl"`
	RateLimitRequests *int   `json:"rate_limit_requests"`
	RateLimitWindow   string `json:"rate_limit_window"`
	LogLevel          string `json:"log_level"`
	ShutdownTimeout   string `json:"shutdown_timeout"`
	EnableDebug       *bool  `json:"enable_debug"`
}

func Load() (Config, error) {
	cfg := defaultConfig()

	if path := strings.TrimSpace(os.Getenv("TODO_CONFIG_FILE")); path != "" {
		if err := applyConfigFile(&cfg, path); err != nil {
			return Config{}, err
		}
	}

	if err := applyEnv(&cfg); err != nil {
		return Config{}, err
	}

	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func defaultConfig() Config {
	return Config{
		AppName:           defaultAppName,
		Env:               defaultEnv,
		HTTPAddr:          defaultHTTPAddr,
		DataPath:          defaultDataPath(),
		CacheTTL:          defaultCacheTTL,
		RateLimitRequests: defaultRateLimitRequests,
		RateLimitWindow:   defaultRateLimitWindow,
		LogLevel:          defaultLogLevel,
		ShutdownTimeout:   defaultShutdownTimeout,
	}
}

func applyConfigFile(cfg *Config, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read config file %s: %w", path, err)
	}

	var file fileConfig
	if err := json.Unmarshal(data, &file); err != nil {
		return fmt.Errorf("parse config file %s: %w", path, err)
	}

	if value := strings.TrimSpace(file.AppName); value != "" {
		cfg.AppName = value
	}
	if value := strings.TrimSpace(file.Env); value != "" {
		cfg.Env = value
	}
	if value := strings.TrimSpace(file.HTTPAddr); value != "" {
		cfg.HTTPAddr = value
	}
	if value := strings.TrimSpace(file.DataPath); value != "" {
		cfg.DataPath = value
	}
	if value := strings.TrimSpace(file.DatabaseDSN); value != "" {
		cfg.DatabaseDSN = value
	}
	if value := strings.TrimSpace(file.RedisAddr); value != "" {
		cfg.RedisAddr = value
	}
	if value := file.RedisPassword; value != "" {
		cfg.RedisPassword = value
	}
	if file.RedisDB != nil {
		cfg.RedisDB = *file.RedisDB
	}
	if value := strings.TrimSpace(file.CacheTTL); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse config file cache_ttl: %w", err)
		}
		cfg.CacheTTL = duration
	}
	if file.RateLimitRequests != nil {
		cfg.RateLimitRequests = *file.RateLimitRequests
	}
	if value := strings.TrimSpace(file.RateLimitWindow); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse config file rate_limit_window: %w", err)
		}
		cfg.RateLimitWindow = duration
	}
	if value := strings.TrimSpace(file.LogLevel); value != "" {
		cfg.LogLevel = value
	}
	if value := strings.TrimSpace(file.ShutdownTimeout); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse config file shutdown_timeout: %w", err)
		}
		cfg.ShutdownTimeout = duration
	}
	if file.EnableDebug != nil {
		cfg.EnableDebug = *file.EnableDebug
	}

	return nil
}

func applyEnv(cfg *Config) error {
	if value := strings.TrimSpace(os.Getenv("TODO_APP_NAME")); value != "" {
		cfg.AppName = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_ENV")); value != "" {
		cfg.Env = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_HTTP_ADDR")); value != "" {
		cfg.HTTPAddr = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_LOG_LEVEL")); value != "" {
		cfg.LogLevel = value
	}
	if path := strings.TrimSpace(os.Getenv("TODO_CLI_DATA")); path != "" {
		cfg.DataPath = path
	}
	if path := strings.TrimSpace(os.Getenv("TODO_API_DATA_PATH")); path != "" {
		cfg.DataPath = path
	}
	if value := strings.TrimSpace(os.Getenv("TODO_DATABASE_DSN")); value != "" {
		cfg.DatabaseDSN = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_REDIS_ADDR")); value != "" {
		cfg.RedisAddr = value
	}
	if value := os.Getenv("TODO_REDIS_PASSWORD"); value != "" {
		cfg.RedisPassword = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_REDIS_DB")); value != "" {
		db, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("parse TODO_REDIS_DB: %w", err)
		}
		cfg.RedisDB = db
	}
	if value := strings.TrimSpace(os.Getenv("TODO_CACHE_TTL")); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse TODO_CACHE_TTL: %w", err)
		}
		cfg.CacheTTL = duration
	}
	if value := strings.TrimSpace(os.Getenv("TODO_RATE_LIMIT_REQUESTS")); value != "" {
		limit, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("parse TODO_RATE_LIMIT_REQUESTS: %w", err)
		}
		cfg.RateLimitRequests = limit
	}
	if value := strings.TrimSpace(os.Getenv("TODO_RATE_LIMIT_WINDOW")); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse TODO_RATE_LIMIT_WINDOW: %w", err)
		}
		cfg.RateLimitWindow = duration
	}
	if value := strings.TrimSpace(os.Getenv("TODO_SHUTDOWN_TIMEOUT")); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse TODO_SHUTDOWN_TIMEOUT: %w", err)
		}
		cfg.ShutdownTimeout = duration
	}
	if value := strings.TrimSpace(os.Getenv("TODO_ENABLE_DEBUG")); value != "" {
		enabled, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("parse TODO_ENABLE_DEBUG: %w", err)
		}
		cfg.EnableDebug = enabled
	}

	return nil
}

func (c Config) Validate() error {
	if strings.TrimSpace(c.AppName) == "" {
		return errors.New("app name is required")
	}
	if strings.TrimSpace(c.Env) == "" {
		return errors.New("env is required")
	}
	if strings.TrimSpace(c.HTTPAddr) == "" {
		return errors.New("http addr is required")
	}
	if strings.TrimSpace(c.DataPath) == "" && strings.TrimSpace(c.DatabaseDSN) == "" {
		return errors.New("data path or database dsn is required")
	}
	if c.RedisDB < 0 {
		return errors.New("redis db must be greater than or equal to 0")
	}
	if c.CacheTTL <= 0 {
		return errors.New("cache ttl must be greater than 0")
	}
	if c.RateLimitRequests <= 0 {
		return errors.New("rate limit requests must be greater than 0")
	}
	if c.RateLimitWindow <= 0 {
		return errors.New("rate limit window must be greater than 0")
	}
	if c.ShutdownTimeout <= 0 {
		return errors.New("shutdown timeout must be greater than 0")
	}
	switch strings.ToLower(strings.TrimSpace(c.LogLevel)) {
	case "debug", "info", "warn", "error":
		return nil
	default:
		return fmt.Errorf("unsupported log level %q", c.LogLevel)
	}
}

func defaultDataPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".todo-cli", "todos.json")
	}
	return filepath.Join(home, ".todo-cli", "todos.json")
}
```

关键变化：

- 新增 `RedisAddr`、`RedisPassword`、`RedisDB`。
- 新增 `CacheTTL` 控制缓存过期时间。
- 新增 `RateLimitRequests` 和 `RateLimitWindow` 控制限流。
- Redis 配置为空时，应用仍然可以不启用 Redis，兼容前面章节。

修改 `configs/local.example.json`：

```json title="configs/local.example.json"
{
  "app_name": "todo-api",
  "env": "local",
  "http_addr": ":8080",
  "data_path": ".todo-cli/todos.json",
  "database_dsn": "",
  "redis_addr": "127.0.0.1:6379",
  "redis_password": "todo_redis_password",
  "redis_db": 0,
  "cache_ttl": "30s",
  "rate_limit_requests": 60,
  "rate_limit_window": "1m",
  "log_level": "debug",
  "shutdown_timeout": "5s",
  "enable_debug": true
}
```

本地示例可以写实验密码，生产环境要使用 Secret 或密钥管理系统，不要把真实 Redis 密码提交到 Git。

### 6.8 更新配置测试

修改 `internal/config/config_test.go`：

```go title="internal/config/config_test.go"
package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadFromEnv(t *testing.T) {
	dataPath := filepath.Join(t.TempDir(), "todos.json")
	dsn := "postgres://todo:secret@127.0.0.1:5432/todo_platform?sslmode=disable"

	t.Setenv("TODO_APP_NAME", "todo-platform")
	t.Setenv("TODO_ENV", "test")
	t.Setenv("TODO_HTTP_ADDR", "127.0.0.1:18080")
	t.Setenv("TODO_API_DATA_PATH", dataPath)
	t.Setenv("TODO_DATABASE_DSN", dsn)
	t.Setenv("TODO_REDIS_ADDR", "127.0.0.1:6379")
	t.Setenv("TODO_REDIS_PASSWORD", "secret")
	t.Setenv("TODO_REDIS_DB", "1")
	t.Setenv("TODO_CACHE_TTL", "45s")
	t.Setenv("TODO_RATE_LIMIT_REQUESTS", "10")
	t.Setenv("TODO_RATE_LIMIT_WINDOW", "30s")
	t.Setenv("TODO_LOG_LEVEL", "debug")
	t.Setenv("TODO_SHUTDOWN_TIMEOUT", "3s")
	t.Setenv("TODO_ENABLE_DEBUG", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.AppName != "todo-platform" {
		t.Fatalf("AppName = %q", cfg.AppName)
	}
	if cfg.HTTPAddr != "127.0.0.1:18080" {
		t.Fatalf("HTTPAddr = %q", cfg.HTTPAddr)
	}
	if cfg.DataPath != dataPath {
		t.Fatalf("DataPath = %q", cfg.DataPath)
	}
	if cfg.DatabaseDSN != dsn {
		t.Fatalf("DatabaseDSN = %q", cfg.DatabaseDSN)
	}
	if cfg.RedisAddr != "127.0.0.1:6379" {
		t.Fatalf("RedisAddr = %q", cfg.RedisAddr)
	}
	if cfg.RedisPassword != "secret" {
		t.Fatalf("RedisPassword = %q", cfg.RedisPassword)
	}
	if cfg.RedisDB != 1 {
		t.Fatalf("RedisDB = %d", cfg.RedisDB)
	}
	if cfg.CacheTTL != 45*time.Second {
		t.Fatalf("CacheTTL = %s", cfg.CacheTTL)
	}
	if cfg.RateLimitRequests != 10 {
		t.Fatalf("RateLimitRequests = %d", cfg.RateLimitRequests)
	}
	if cfg.RateLimitWindow != 30*time.Second {
		t.Fatalf("RateLimitWindow = %s", cfg.RateLimitWindow)
	}
	if cfg.ShutdownTimeout != 3*time.Second {
		t.Fatalf("ShutdownTimeout = %s", cfg.ShutdownTimeout)
	}
	if !cfg.EnableDebug {
		t.Fatal("EnableDebug = false")
	}
}

func TestLoadFromConfigFile(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "local.json")
	dataPath := filepath.Join(dir, "todos.json")
	dsn := "postgres://todo:secret@127.0.0.1:5432/todo_platform?sslmode=disable"
	redisDB := 2
	rateLimitRequests := 20

	writeConfig(t, configPath, map[string]any{
		"app_name":            "todo-api",
		"env":                 "local",
		"http_addr":           "127.0.0.1:19090",
		"data_path":           dataPath,
		"database_dsn":        dsn,
		"redis_addr":          "127.0.0.1:6379",
		"redis_password":      "file-secret",
		"redis_db":            redisDB,
		"cache_ttl":           "2m",
		"rate_limit_requests": rateLimitRequests,
		"rate_limit_window":   "15s",
		"log_level":           "warn",
		"shutdown_timeout":    "2s",
		"enable_debug":        true,
	})

	t.Setenv("TODO_CONFIG_FILE", configPath)

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.HTTPAddr != "127.0.0.1:19090" {
		t.Fatalf("HTTPAddr = %q", cfg.HTTPAddr)
	}
	if cfg.DataPath != dataPath {
		t.Fatalf("DataPath = %q", cfg.DataPath)
	}
	if cfg.DatabaseDSN != dsn {
		t.Fatalf("DatabaseDSN = %q", cfg.DatabaseDSN)
	}
	if cfg.RedisAddr != "127.0.0.1:6379" {
		t.Fatalf("RedisAddr = %q", cfg.RedisAddr)
	}
	if cfg.RedisPassword != "file-secret" {
		t.Fatalf("RedisPassword = %q", cfg.RedisPassword)
	}
	if cfg.RedisDB != 2 {
		t.Fatalf("RedisDB = %d", cfg.RedisDB)
	}
	if cfg.CacheTTL != 2*time.Minute {
		t.Fatalf("CacheTTL = %s", cfg.CacheTTL)
	}
	if cfg.RateLimitRequests != 20 {
		t.Fatalf("RateLimitRequests = %d", cfg.RateLimitRequests)
	}
	if cfg.RateLimitWindow != 15*time.Second {
		t.Fatalf("RateLimitWindow = %s", cfg.RateLimitWindow)
	}
	if cfg.LogLevel != "warn" {
		t.Fatalf("LogLevel = %q", cfg.LogLevel)
	}
	if cfg.ShutdownTimeout != 2*time.Second {
		t.Fatalf("ShutdownTimeout = %s", cfg.ShutdownTimeout)
	}
	if !cfg.EnableDebug {
		t.Fatal("EnableDebug = false")
	}
}

func TestLoadEnvOverridesConfigFile(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "local.json")
	fileDataPath := filepath.Join(dir, "file-todos.json")
	envDataPath := filepath.Join(dir, "env-todos.json")
	envDSN := "postgres://todo:env@127.0.0.1:5432/todo_platform?sslmode=disable"

	writeConfig(t, configPath, map[string]any{
		"data_path":           fileDataPath,
		"database_dsn":        "postgres://todo:file@127.0.0.1:5432/todo_platform?sslmode=disable",
		"redis_addr":          "127.0.0.1:6379",
		"redis_password":      "file-secret",
		"cache_ttl":           "2m",
		"rate_limit_requests": 20,
		"log_level":           "debug",
	})

	t.Setenv("TODO_CONFIG_FILE", configPath)
	t.Setenv("TODO_API_DATA_PATH", envDataPath)
	t.Setenv("TODO_DATABASE_DSN", envDSN)
	t.Setenv("TODO_REDIS_ADDR", "redis.internal:6379")
	t.Setenv("TODO_REDIS_PASSWORD", "env-secret")
	t.Setenv("TODO_CACHE_TTL", "10s")
	t.Setenv("TODO_RATE_LIMIT_REQUESTS", "5")
	t.Setenv("TODO_LOG_LEVEL", "error")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}
	if cfg.DataPath != envDataPath {
		t.Fatalf("DataPath = %q", cfg.DataPath)
	}
	if cfg.DatabaseDSN != envDSN {
		t.Fatalf("DatabaseDSN = %q", cfg.DatabaseDSN)
	}
	if cfg.RedisAddr != "redis.internal:6379" {
		t.Fatalf("RedisAddr = %q", cfg.RedisAddr)
	}
	if cfg.RedisPassword != "env-secret" {
		t.Fatalf("RedisPassword = %q", cfg.RedisPassword)
	}
	if cfg.CacheTTL != 10*time.Second {
		t.Fatalf("CacheTTL = %s", cfg.CacheTTL)
	}
	if cfg.RateLimitRequests != 5 {
		t.Fatalf("RateLimitRequests = %d", cfg.RateLimitRequests)
	}
	if cfg.LogLevel != "error" {
		t.Fatalf("LogLevel = %q", cfg.LogLevel)
	}
}

func TestValidate(t *testing.T) {
	cfg := Config{
		AppName:           "todo-api",
		Env:               "test",
		HTTPAddr:          ":8080",
		DataPath:          "todos.json",
		CacheTTL:          time.Second,
		RateLimitRequests: 10,
		RateLimitWindow:   time.Minute,
		LogLevel:          "info",
		ShutdownTimeout:   time.Second,
	}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate() error = %v", err)
	}

	cfg.DataPath = ""
	cfg.DatabaseDSN = "postgres://todo:secret@127.0.0.1:5432/todo_platform?sslmode=disable"
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate() with database dsn error = %v", err)
	}
}

func TestLoadInvalidDuration(t *testing.T) {
	t.Setenv("TODO_CACHE_TTL", "soon")

	if _, err := Load(); err == nil {
		t.Fatal("Load() error = nil")
	}
}

func writeConfig(t *testing.T, path string, values map[string]any) {
	t.Helper()

	data, err := json.MarshalIndent(values, "", "  ")
	if err != nil {
		t.Fatalf("marshal config: %v", err)
	}
	if err := os.WriteFile(path, data, 0600); err != nil {
		t.Fatalf("write config: %v", err)
	}
}
```

配置测试的重点不是“为了覆盖率而写测试”，而是防止配置字段越加越多后，默认值、配置文件、环境变量覆盖关系变得不可控。

### 6.9 初始化 Redis 客户端

创建 `internal/cache/redis.go`：

```go title="internal/cache/redis.go"
package cache

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

type Options struct {
	Addr     string
	Password string
	DB       int
}

func Open(ctx context.Context, opts Options) (*redis.Client, error) {
	if strings.TrimSpace(opts.Addr) == "" {
		return nil, errors.New("redis addr is required")
	}

	client := redis.NewClient(&redis.Options{
		Addr:     opts.Addr,
		Password: opts.Password,
		DB:       opts.DB,
	})

	pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	if err := client.Ping(pingCtx).Err(); err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return client, nil
}
```

设计说明：

- 应用启动时创建一次 Redis 客户端。
- `Ping` 用于启动时快速发现密码、地址或网络错误。
- 失败时主动 `Close`，避免留下未使用的连接池。
- Redis 客户端会在应用退出时统一关闭。

### 6.10 实现 Redis 缓存 Repository

创建 `internal/todo/redis_cache.go`：

```go title="internal/todo/redis_cache.go"
package todo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

type StatsTaskQueue interface {
	EnqueueStatsRefresh(ctx context.Context) error
}

type CachedRepository struct {
	repo   Repository
	client *redis.Client
	logger *slog.Logger
	ttl    time.Duration
	queue  StatsTaskQueue
}

var _ Repository = (*CachedRepository)(nil)

func NewCachedRepository(repo Repository, client *redis.Client, logger *slog.Logger, ttl time.Duration, queue StatsTaskQueue) *CachedRepository {
	if logger == nil {
		logger = slog.Default()
	}
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &CachedRepository{
		repo:   repo,
		client: client,
		logger: logger,
		ttl:    ttl,
		queue:  queue,
	}
}

func (c *CachedRepository) List(ctx context.Context, status Status) ([]Item, error) {
	key := todoListCacheKey(status)

	var cached []Item
	if err := c.getJSON(ctx, key, &cached); err == nil {
		c.logger.Debug("todo list cache hit", "key", key)
		return cached, nil
	} else if !isCacheMiss(err) {
		c.logger.Warn("todo list cache read failed", "key", key, "error", err)
	}

	items, err := c.repo.List(ctx, status)
	if err != nil {
		return nil, err
	}

	if err := c.setJSON(ctx, key, items); err != nil {
		c.logger.Warn("todo list cache write failed", "key", key, "error", err)
	}
	return items, nil
}

func (c *CachedRepository) Get(ctx context.Context, id int) (Item, error) {
	return c.repo.Get(ctx, id)
}

func (c *CachedRepository) Add(ctx context.Context, title string) (Item, error) {
	item, err := c.repo.Add(ctx, title)
	if err != nil {
		return Item{}, err
	}
	c.afterMutation(ctx)
	return item, nil
}

func (c *CachedRepository) Done(ctx context.Context, id int) (Item, error) {
	item, err := c.repo.Done(ctx, id)
	if err != nil {
		return Item{}, err
	}
	c.afterMutation(ctx)
	return item, nil
}

func (c *CachedRepository) Update(ctx context.Context, id int, title string) (Item, error) {
	item, err := c.repo.Update(ctx, id, title)
	if err != nil {
		return Item{}, err
	}
	c.afterMutation(ctx)
	return item, nil
}

func (c *CachedRepository) Delete(ctx context.Context, id int) error {
	if err := c.repo.Delete(ctx, id); err != nil {
		return err
	}
	c.afterMutation(ctx)
	return nil
}

func (c *CachedRepository) Stats(ctx context.Context) (Stats, error) {
	const key = "todo:cache:stats"

	var cached Stats
	if err := c.getJSON(ctx, key, &cached); err == nil {
		c.logger.Debug("todo stats cache hit", "key", key)
		return cached, nil
	} else if !isCacheMiss(err) {
		c.logger.Warn("todo stats cache read failed", "key", key, "error", err)
	}

	stats, err := c.repo.Stats(ctx)
	if err != nil {
		return Stats{}, err
	}

	if err := c.setJSON(ctx, key, stats); err != nil {
		c.logger.Warn("todo stats cache write failed", "key", key, "error", err)
	}
	return stats, nil
}

func (c *CachedRepository) afterMutation(ctx context.Context) {
	if err := c.invalidate(ctx); err != nil {
		c.logger.Warn("invalidate todo cache failed", "error", err)
	}
	if c.queue != nil {
		if err := c.queue.EnqueueStatsRefresh(ctx); err != nil {
			c.logger.Warn("enqueue stats refresh failed", "error", err)
		}
	}
}

func (c *CachedRepository) invalidate(ctx context.Context) error {
	keys := []string{
		todoListCacheKey(""),
		todoListCacheKey(StatusPending),
		todoListCacheKey(StatusDone),
		"todo:cache:stats",
	}
	if err := c.client.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("delete cache keys: %w", err)
	}
	return nil
}

func (c *CachedRepository) getJSON(ctx context.Context, key string, dst any) error {
	data, err := c.client.Get(ctx, key).Bytes()
	if err != nil {
		return err
	}
	if err := json.Unmarshal(data, dst); err != nil {
		return fmt.Errorf("decode cache key %s: %w", key, err)
	}
	return nil
}

func (c *CachedRepository) setJSON(ctx context.Context, key string, value any) error {
	data, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("encode cache key %s: %w", key, err)
	}
	if err := c.client.Set(ctx, key, data, c.ttl).Err(); err != nil {
		return fmt.Errorf("set cache key %s: %w", key, err)
	}
	return nil
}

func todoListCacheKey(status Status) string {
	if status == "" {
		return "todo:cache:list:all"
	}
	return "todo:cache:list:" + string(status)
}

func isCacheMiss(err error) bool {
	return errors.Is(err, redis.Nil)
}
```

关键点：

- `CachedRepository` 实现同一个 `Repository` 接口，因此 Service 层不需要关心缓存细节。
- 读操作先查 Redis，未命中再查真实 Repository。
- 写操作先写真实 Repository，成功后删除缓存。
- 缓存失败只记录日志，不让业务请求失败。这是因为 Redis 在本项目里是加速层，不是事实来源。

### 6.11 实现 Redis 限流器

创建 `internal/ratelimit/redis_limiter.go`：

```go title="internal/ratelimit/redis_limiter.go"
package ratelimit

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type RedisLimiter struct {
	client *redis.Client
	limit  int
	window time.Duration
	prefix string
	now    func() time.Time
}

func NewRedisLimiter(client *redis.Client, limit int, window time.Duration, prefix string) *RedisLimiter {
	if limit <= 0 {
		limit = 60
	}
	if window <= 0 {
		window = time.Minute
	}
	if prefix == "" {
		prefix = "todo:ratelimit"
	}
	return &RedisLimiter{
		client: client,
		limit:  limit,
		window: window,
		prefix: prefix,
		now:    time.Now,
	}
}

func (l *RedisLimiter) Allow(ctx context.Context, identity string) (bool, error) {
	if identity == "" {
		identity = "unknown"
	}

	windowNumber := l.now().UnixNano() / l.window.Nanoseconds()
	key := fmt.Sprintf("%s:%s:%d", l.prefix, identity, windowNumber)

	count, err := l.client.Incr(ctx, key).Result()
	if err != nil {
		return false, fmt.Errorf("increment rate limit key: %w", err)
	}
	if count == 1 {
		if err := l.client.Expire(ctx, key, l.window+time.Second).Err(); err != nil {
			return false, fmt.Errorf("expire rate limit key: %w", err)
		}
	}

	return count <= int64(l.limit), nil
}
```

这是固定窗口限流：

- 第一次请求创建计数 Key，并设置过期时间。
- 每次请求 `INCR`。
- 超过阈值返回 `false`。

生产中如果需要更平滑的限流，可以改成滑动窗口或令牌桶。

### 6.12 给 HTTP API 增加限流中间件

修改 `internal/httpapi/middleware.go`：

```go title="internal/httpapi/middleware.go"
package httpapi

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"
)

type RateLimiter interface {
	Allow(ctx context.Context, identity string) (bool, error)
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{
				ResponseWriter: w,
				status:         http.StatusOK,
			}

			next.ServeHTTP(recorder, r)

			logger.Info(
				"http request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", recorder.status,
				"duration_ms", time.Since(start).Milliseconds(),
			)
		})
	}
}

func rateLimit(limiter RateLimiter, logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			identity := clientIdentity(r)
			allowed, err := limiter.Allow(r.Context(), identity)
			if err != nil {
				logger.Error("rate limiter failed", "identity", identity, "error", err)
				writeError(w, http.StatusServiceUnavailable, "rate_limiter_unavailable", "rate limiter unavailable")
				return
			}
			if !allowed {
				writeError(w, http.StatusTooManyRequests, "rate_limited", "too many requests")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func clientIdentity(r *http.Request) string {
	if forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		return strings.TrimSpace(parts[0])
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
```

注意：真实生产环境中，`X-Forwarded-For` 只能在可信代理后面使用。直接信任客户端传来的 Header 会被伪造。

修改 `internal/httpapi/router.go`：

```go title="internal/httpapi/router.go"
package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"cloud-native-todo-platform/internal/todo"
)

type Server struct {
	todos  *todo.Service
	logger *slog.Logger
}

func NewRouter(todos *todo.Service, logger *slog.Logger, limiters ...RateLimiter) http.Handler {
	server := &Server{
		todos:  todos,
		logger: logger,
	}

	var limiter RateLimiter
	if len(limiters) > 0 {
		limiter = limiters[0]
	}

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(10 * time.Second))
	r.Use(requestLogger(logger))

	r.Get("/healthz", server.healthz)
	r.Get("/readyz", server.readyz)

	r.Route("/api/v1", func(r chi.Router) {
		if limiter != nil {
			r.Use(rateLimit(limiter, logger))
		}
		r.Get("/todos", server.listTodos)
		r.Post("/todos", server.createTodo)
		r.Get("/todos/{id}", server.getTodo)
		r.Put("/todos/{id}", server.updateTodo)
		r.Post("/todos/{id}/done", server.doneTodo)
		r.Delete("/todos/{id}", server.deleteTodo)
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, errorCodeNotFound, "route not found")
	})

	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusMethodNotAllowed, errorCodeInvalidRequest, "method not allowed")
	})

	return r
}
```

限流只放在 `/api/v1` 业务路由下，不限制 `/healthz` 和 `/readyz`。健康检查如果被限流，Kubernetes 或负载均衡可能误判服务不可用。

### 6.13 实现 Redis 任务队列

创建 `internal/tasks/redis_queue.go`：

```go title="internal/tasks/redis_queue.go"
package tasks

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"

	"cloud-native-todo-platform/internal/todo"
)

type TaskType string

const TaskRefreshStats TaskType = "refresh_stats"

type Task struct {
	Type      TaskType  `json:"type"`
	CreatedAt time.Time `json:"created_at"`
}

type Handler func(ctx context.Context, task Task) error

type Queue struct {
	client *redis.Client
	key    string
	logger *slog.Logger
}

func NewQueue(client *redis.Client, key string, logger *slog.Logger) *Queue {
	if key == "" {
		key = "todo:tasks:stats"
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Queue{client: client, key: key, logger: logger}
}

func (q *Queue) EnqueueStatsRefresh(ctx context.Context) error {
	task := Task{
		Type:      TaskRefreshStats,
		CreatedAt: time.Now().UTC(),
	}
	data, err := json.Marshal(task)
	if err != nil {
		return fmt.Errorf("encode task: %w", err)
	}
	if err := q.client.RPush(ctx, q.key, data).Err(); err != nil {
		return fmt.Errorf("push task: %w", err)
	}
	return nil
}

func (q *Queue) Run(ctx context.Context, handler Handler) error {
	for {
		select {
		case <-ctx.Done():
			return nil
		default:
		}

		result, err := q.client.BLPop(ctx, 5*time.Second, q.key).Result()
		if err != nil {
			if errors.Is(err, redis.Nil) {
				continue
			}
			if ctx.Err() != nil {
				return nil
			}
			return fmt.Errorf("pop task: %w", err)
		}
		if len(result) != 2 {
			q.logger.Warn("invalid redis task payload", "result", result)
			continue
		}

		var task Task
		if err := json.Unmarshal([]byte(result[1]), &task); err != nil {
			q.logger.Warn("decode redis task failed", "error", err)
			continue
		}

		if err := handler(ctx, task); err != nil {
			q.logger.Warn("handle redis task failed", "type", task.Type, "error", err)
			continue
		}
	}
}

func RefreshStatsHandler(service *todo.Service, logger *slog.Logger) Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(ctx context.Context, task Task) error {
		if task.Type != TaskRefreshStats {
			return nil
		}

		stats, err := service.Stats(ctx)
		if err != nil {
			return fmt.Errorf("refresh todo stats: %w", err)
		}
		logger.Info(
			"todo stats refreshed",
			"total", stats.Total,
			"done", stats.Done,
			"pending", stats.Pending,
		)
		return nil
	}
}
```

这里的队列只处理可重算的统计刷新任务。即使任务失败或丢失，下一次读请求仍然能重新计算统计。

### 6.14 更新应用组装层

修改 `internal/app/app.go`：

```go title="internal/app/app.go"
package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"time"

	"cloud-native-todo-platform/internal/config"
	"cloud-native-todo-platform/internal/httpapi"
	"cloud-native-todo-platform/internal/todo"
)

type App struct {
	Config  config.Config
	Logger  *slog.Logger
	Todos   *todo.Service
	closer  io.Closer
	limiter httpapi.RateLimiter
}

func New(cfg config.Config, logger *slog.Logger, repo todo.Repository, closer io.Closer, limiters ...httpapi.RateLimiter) *App {
	if repo == nil {
		repo = todo.NewFileStore(cfg.DataPath)
	}

	var limiter httpapi.RateLimiter
	if len(limiters) > 0 {
		limiter = limiters[0]
	}

	return &App{
		Config:  cfg,
		Logger:  logger,
		Todos:   todo.NewService(repo, logger),
		closer:  closer,
		limiter: limiter,
	}
}

func (a *App) Close() error {
	if a.closer == nil {
		return nil
	}
	return a.closer.Close()
}

func (a *App) Run(ctx context.Context) error {
	if a.Logger == nil {
		a.Logger = slog.Default()
	}

	stats, err := a.Todos.Stats(ctx)
	if err != nil {
		return fmt.Errorf("load todo stats during app startup: %w", err)
	}

	handler := httpapi.NewRouter(a.Todos, a.Logger, a.limiter)
	server := &http.Server{
		Addr:              a.Config.HTTPAddr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}

	listener, err := net.Listen("tcp", a.Config.HTTPAddr)
	if err != nil {
		return fmt.Errorf("listen http addr %s: %w", a.Config.HTTPAddr, err)
	}

	errCh := make(chan error, 1)
	go func() {
		a.Logger.Info(
			"todo api server started",
			"app", a.Config.AppName,
			"env", a.Config.Env,
			"http_addr", listener.Addr().String(),
			"todo_total", stats.Total,
			"todo_done", stats.Done,
			"todo_pending", stats.Pending,
		)

		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), a.Config.ShutdownTimeout)
		defer cancel()

		a.Logger.Info("todo api server shutting down", "timeout", a.Config.ShutdownTimeout.String())
		if err := server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown http server: %w", err)
		}
		return <-errCh
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("run http server: %w", err)
		}
		return nil
	}
}
```

### 6.15 更新启动入口

修改 `cmd/todo-api/main.go`：

```go title="cmd/todo-api/main.go"
package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"cloud-native-todo-platform/internal/app"
	"cloud-native-todo-platform/internal/cache"
	"cloud-native-todo-platform/internal/config"
	"cloud-native-todo-platform/internal/db"
	"cloud-native-todo-platform/internal/httpapi"
	"cloud-native-todo-platform/internal/logger"
	"cloud-native-todo-platform/internal/ratelimit"
	"cloud-native-todo-platform/internal/tasks"
	"cloud-native-todo-platform/internal/todo"
)

func main() {
	if err := run(context.Background(), os.Stdout); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run(parent context.Context, stdout io.Writer) error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}

	log := logger.New(stdout, cfg.LogLevel, cfg.Env)

	ctx, stop := signal.NotifyContext(parent, os.Interrupt, syscall.SIGTERM)
	defer stop()

	repo := todo.Repository(todo.NewFileStore(cfg.DataPath))
	closers := make([]io.Closer, 0)

	if strings.TrimSpace(cfg.DatabaseDSN) != "" {
		database, err := db.Open(ctx, cfg.DatabaseDSN)
		if err != nil {
			return err
		}
		repo = todo.NewPostgresStore(database)
		closers = append(closers, database)
		log.Info("postgres repository enabled")
	} else {
		log.Info("file repository enabled", "data_path", cfg.DataPath)
	}

	var limiter httpapi.RateLimiter
	if strings.TrimSpace(cfg.RedisAddr) != "" {
		redisClient, err := cache.Open(ctx, cache.Options{
			Addr:     cfg.RedisAddr,
			Password: cfg.RedisPassword,
			DB:       cfg.RedisDB,
		})
		if err != nil {
			return err
		}
		closers = append(closers, redisClient)

		queue := tasks.NewQueue(redisClient, "todo:tasks:stats", log)
		repo = todo.NewCachedRepository(repo, redisClient, log, cfg.CacheTTL, queue)
		limiter = ratelimit.NewRedisLimiter(redisClient, cfg.RateLimitRequests, cfg.RateLimitWindow, "todo:ratelimit")

		workerService := todo.NewService(repo, log)
		go func() {
			if err := queue.Run(ctx, tasks.RefreshStatsHandler(workerService, log)); err != nil {
				log.Error("redis task worker stopped", "error", err)
			}
		}()

		log.Info(
			"redis enabled",
			"addr", cfg.RedisAddr,
			"cache_ttl", cfg.CacheTTL.String(),
			"rate_limit_requests", cfg.RateLimitRequests,
			"rate_limit_window", cfg.RateLimitWindow.String(),
		)
	}

	todoApp := app.New(cfg, log, repo, closeAll(closers...), limiter)
	defer func() {
		if err := todoApp.Close(); err != nil {
			log.Error("close app resources", "error", err)
		}
	}()

	return todoApp.Run(ctx)
}

type closeFunc func() error

func (f closeFunc) Close() error {
	return f()
}

func closeAll(closers ...io.Closer) io.Closer {
	if len(closers) == 0 {
		return nil
	}
	return closeFunc(func() error {
		var result error
		for _, closer := range closers {
			if closer == nil {
				continue
			}
			if err := closer.Close(); err != nil {
				result = errors.Join(result, err)
			}
		}
		return result
	})
}
```

启动逻辑现在有三层：

- 默认使用文件 Repository。
- 配置 `TODO_DATABASE_DSN` 后使用 PostgreSQL Repository。
- 配置 `TODO_REDIS_ADDR` 后，在 Repository 外面包一层 Redis 缓存，并启用限流和异步任务 worker。

### 6.16 更新验证脚本

修改 `Makefile`：

```makefile title="Makefile"
.PHONY: fmt test cover bench build verify redis-up redis-down

fmt:
	go fmt ./...

test:
	go test ./...

cover:
	go test ./... -cover

bench:
	go test ./internal/todo -bench BenchmarkServiceStats -benchmem

build:
	go build ./cmd/todo-cli
	go build ./cmd/todo-stats
	go build ./cmd/todo-api

verify: fmt test cover build

redis-up:
	docker compose up -d redis

redis-down:
	docker compose stop redis
```

修改 `scripts/verify.ps1`：

```powershell title="scripts/verify.ps1"
$ErrorActionPreference = "Stop"

go fmt ./...
go test ./...
go test ./... -cover
go build ./cmd/todo-cli
go build ./cmd/todo-stats
go build ./cmd/todo-api
```

### 6.17 补充 Redis 自动化测试

前面的验证脚本会执行 `go test ./...`。为了让 Redis 相关逻辑也能被测试覆盖，这里使用 `miniredis` 在测试进程里启动一个内存 Redis 服务。

创建 `internal/ratelimit/redis_limiter_test.go`：

```go title="internal/ratelimit/redis_limiter_test.go"
package ratelimit

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestRedisLimiterAllow(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Fatalf("close redis client: %v", err)
		}
	})

	limiter := NewRedisLimiter(client, 2, time.Minute, "test:ratelimit")
	now := time.Unix(1000, 0)
	limiter.now = func() time.Time {
		return now
	}

	ctx := context.Background()
	for i := 0; i < 2; i++ {
		allowed, err := limiter.Allow(ctx, "client-a")
		if err != nil {
			t.Fatalf("Allow() error = %v", err)
		}
		if !allowed {
			t.Fatalf("Allow() allowed = false, want true")
		}
	}

	allowed, err := limiter.Allow(ctx, "client-a")
	if err != nil {
		t.Fatalf("Allow() error = %v", err)
	}
	if allowed {
		t.Fatalf("Allow() allowed = true, want false after limit exceeded")
	}

	key := "test:ratelimit:client-a:16"
	ttl, err := client.TTL(ctx, key).Result()
	if err != nil {
		t.Fatalf("TTL() error = %v", err)
	}
	if ttl <= 0 {
		t.Fatalf("TTL() = %v, want positive duration", ttl)
	}

	now = now.Add(time.Minute)
	allowed, err = limiter.Allow(ctx, "client-a")
	if err != nil {
		t.Fatalf("Allow() error = %v", err)
	}
	if !allowed {
		t.Fatalf("Allow() allowed = false, want true in next window")
	}
}
```

创建 `internal/todo/redis_cache_test.go`：

```go title="internal/todo/redis_cache_test.go"
package todo

import (
	"context"
	"log/slog"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

type cacheTestRepository struct {
	items      []Item
	listCalls  int
	statsCalls int
	now        time.Time
}

func newCacheTestRepository() *cacheTestRepository {
	now := time.Date(2026, 5, 26, 10, 0, 0, 0, time.UTC)
	return &cacheTestRepository{
		now: now,
		items: []Item{
			{ID: 1, Title: "learn redis", Status: StatusPending, CreatedAt: now, UpdatedAt: now},
		},
	}
}

func (r *cacheTestRepository) List(ctx context.Context, status Status) ([]Item, error) {
	r.listCalls++
	result := make([]Item, 0, len(r.items))
	for _, item := range r.items {
		if status == "" || item.Status == status {
			result = append(result, item)
		}
	}
	return result, nil
}

func (r *cacheTestRepository) Get(ctx context.Context, id int) (Item, error) {
	for _, item := range r.items {
		if item.ID == id {
			return item, nil
		}
	}
	return Item{}, ErrNotFound
}

func (r *cacheTestRepository) Add(ctx context.Context, title string) (Item, error) {
	item := Item{
		ID:        len(r.items) + 1,
		Title:     title,
		Status:    StatusPending,
		CreatedAt: r.now,
		UpdatedAt: r.now,
	}
	r.items = append(r.items, item)
	return item, nil
}

func (r *cacheTestRepository) Done(ctx context.Context, id int) (Item, error) {
	item, err := r.Get(ctx, id)
	if err != nil {
		return Item{}, err
	}
	item.Status = StatusDone
	return item, nil
}

func (r *cacheTestRepository) Update(ctx context.Context, id int, title string) (Item, error) {
	item, err := r.Get(ctx, id)
	if err != nil {
		return Item{}, err
	}
	item.Title = title
	return item, nil
}

func (r *cacheTestRepository) Delete(ctx context.Context, id int) error {
	return nil
}

func (r *cacheTestRepository) Stats(ctx context.Context) (Stats, error) {
	r.statsCalls++
	return Stats{Total: len(r.items), Pending: len(r.items)}, nil
}

type cacheTestQueue struct {
	enqueued int
}

func (q *cacheTestQueue) EnqueueStatsRefresh(ctx context.Context) error {
	q.enqueued++
	return nil
}

func TestCachedRepositoryListCacheAndInvalidate(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Fatalf("close redis client: %v", err)
		}
	})

	ctx := context.Background()
	repo := newCacheTestRepository()
	queue := &cacheTestQueue{}
	cached := NewCachedRepository(repo, client, slog.Default(), time.Minute, queue)

	first, err := cached.List(ctx, "")
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(first) != 1 || repo.listCalls != 1 {
		t.Fatalf("first List() len = %d, listCalls = %d", len(first), repo.listCalls)
	}

	repo.items = nil
	second, err := cached.List(ctx, "")
	if err != nil {
		t.Fatalf("List() cached error = %v", err)
	}
	if len(second) != 1 {
		t.Fatalf("cached List() len = %d, want 1", len(second))
	}
	if repo.listCalls != 1 {
		t.Fatalf("repo listCalls = %d, want cache hit without repository call", repo.listCalls)
	}

	if _, err := cached.Add(ctx, "invalidate cache"); err != nil {
		t.Fatalf("Add() error = %v", err)
	}
	exists, err := client.Exists(ctx, "todo:cache:list:all").Result()
	if err != nil {
		t.Fatalf("Exists() error = %v", err)
	}
	if exists != 0 {
		t.Fatalf("todo:cache:list:all exists = %d, want 0 after mutation", exists)
	}
	if queue.enqueued != 1 {
		t.Fatalf("queue.enqueued = %d, want 1", queue.enqueued)
	}
}
```

创建 `internal/tasks/redis_queue_test.go`：

```go title="internal/tasks/redis_queue_test.go"
package tasks

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestQueueEnqueueAndRun(t *testing.T) {
	server := miniredis.RunT(t)
	client := redis.NewClient(&redis.Options{Addr: server.Addr()})
	t.Cleanup(func() {
		if err := client.Close(); err != nil {
			t.Fatalf("close redis client: %v", err)
		}
	})

	ctx := context.Background()
	queue := NewQueue(client, "test:tasks", nil)
	if err := queue.EnqueueStatsRefresh(ctx); err != nil {
		t.Fatalf("EnqueueStatsRefresh() error = %v", err)
	}

	length, err := client.LLen(ctx, "test:tasks").Result()
	if err != nil {
		t.Fatalf("LLen() error = %v", err)
	}
	if length != 1 {
		t.Fatalf("LLen() = %d, want 1", length)
	}

	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	handled := make(chan Task, 1)
	errCh := make(chan error, 1)
	go func() {
		errCh <- queue.Run(runCtx, func(ctx context.Context, task Task) error {
			handled <- task
			cancel()
			return nil
		})
	}()

	select {
	case task := <-handled:
		if task.Type != TaskRefreshStats {
			t.Fatalf("task.Type = %s, want %s", task.Type, TaskRefreshStats)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("queue did not handle task")
	}

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("Run() error = %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("queue did not stop after context cancellation")
	}
}
```

这些测试覆盖三个关键风险点：

- 缓存命中后不会重复访问底层 Repository。
- 写操作后会删除缓存并投递统计刷新任务。
- 限流器会在同一窗口内拒绝超限请求，并在下一个窗口重新放行。
- Redis List 队列可以完成入队、阻塞消费和随应用上下文退出。

### 6.18 运行 API 并验证缓存

启动 Redis：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose up -d redis
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose up -d redis
    ```

启动 API：

=== "Linux / macOS / WSL2"

    ```bash
    export TODO_CONFIG_FILE=configs/local.example.json
    export TODO_REDIS_ADDR=127.0.0.1:6379
    export TODO_REDIS_PASSWORD=todo_redis_password
    go run ./cmd/todo-api
    ```

=== "Windows PowerShell"

    ```powershell
    $env:TODO_CONFIG_FILE = "configs\local.example.json"
    $env:TODO_REDIS_ADDR = "127.0.0.1:6379"
    $env:TODO_REDIS_PASSWORD = "todo_redis_password"
    go run ./cmd/todo-api
    ```

另开一个终端访问 API：

```bash
curl -s -H "Content-Type: application/json" -d '{"title":"learn redis cache"}' http://127.0.0.1:8080/api/v1/todos
curl -s http://127.0.0.1:8080/api/v1/todos
curl -s http://127.0.0.1:8080/api/v1/todos
curl -s http://127.0.0.1:8080/readyz
```

查看 Redis Key：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:*'
    docker compose exec redis redis-cli -a todo_redis_password GET todo:cache:stats
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec redis redis-cli -a todo_redis_password --scan --pattern "todo:*"
    docker compose exec redis redis-cli -a todo_redis_password GET todo:cache:stats
    ```

判断依据：

- 能看到 `todo:cache:list:all` 或 `todo:cache:stats`，说明缓存写入成功。
- 多次读取同一个接口时，日志中应该出现缓存命中相关信息。
- 创建、更新、完成或删除 Todo 后，缓存会被删除，下一次读取重新写入。

验证限流：

=== "Linux / macOS / WSL2"

    ```bash
    for i in $(seq 1 70); do curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8080/api/v1/todos; done
    ```

=== "Windows PowerShell"

    ```powershell
    1..70 | ForEach-Object { curl.exe -s -o NUL -w "%{http_code}`n" http://127.0.0.1:8080/api/v1/todos }
    ```

预期前面多数请求是 `200`，超过限制后出现 `429`。

查看队列：

```bash
docker compose exec redis redis-cli -a todo_redis_password LLEN todo:tasks:stats
```

如果 worker 正常消费，队列长度通常会很快回到 `0`。

查看缓存命中情况：

```bash
docker compose exec redis redis-cli -a todo_redis_password INFO stats
```

重点关注 `keyspace_hits` 和 `keyspace_misses`。一个粗略命中率可以这样理解：

```text
cache hit ratio = keyspace_hits / (keyspace_hits + keyspace_misses)
```

如果命中率长期很低，要回头检查 Key 是否稳定、TTL 是否过短、写操作是否过于频繁。

### 6.19 清理步骤

停止 API 后清理环境变量：

=== "Linux / macOS / WSL2"

    ```bash
    unset TODO_CONFIG_FILE
    unset TODO_REDIS_ADDR
    unset TODO_REDIS_PASSWORD
    docker compose down
    ```

=== "Windows PowerShell"

    ```powershell
    Remove-Item Env:TODO_CONFIG_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:TODO_REDIS_ADDR -ErrorAction SilentlyContinue
    Remove-Item Env:TODO_REDIS_PASSWORD -ErrorAction SilentlyContinue
    docker compose down
    ```

如果想连 Redis 数据卷也删除：

```bash
docker compose down -v
```

`-v` 会删除 PostgreSQL 和 Redis 的数据卷，本地实验可以使用，生产环境不要这样清理。

## 7. 真实工作案例

某团队的 Todo 平台上线后，数据库 CPU 在早高峰升高。排查发现首页每 5 秒刷新一次 Todo 统计，每个用户都会触发数据库查询。团队决定增加 Redis 缓存和限流。

改造方案：

- 后端为统计和列表接口增加 Cache-Aside 缓存。
- 写操作成功后删除相关缓存。
- SRE 配置 Redis 监控，关注内存、连接数、命中率和慢命令。
- 测试同学增加缓存失效和限流回归测试。
- 架构师明确 Redis 不是事实来源，缓存丢失时必须能从数据库重建。
- 运维在生产中使用托管 Redis 或 Redis Cluster，并配置备份、高可用和访问控制。

上线后效果：

- 高频统计请求大部分命中 Redis。
- PostgreSQL 压力下降。
- 异常客户端触发 `429`，不会继续压垮业务逻辑。
- 统计刷新从同步请求链路中拆出，接口延迟更稳定。

## 8. 常见错误

| 错误现象 | 常见原因 | 修复方向 |
|---|---|---|
| `connection refused` | Redis 容器没启动或地址错误 | 执行 `docker compose ps`，确认 `6379` 端口 |
| `NOAUTH Authentication required` | 没有传密码 | 设置 `TODO_REDIS_PASSWORD` |
| 缓存永不过期 | `SET` 时没有 TTL | 使用 `SET key value EX seconds` 或 Go 中传入 TTL |
| 修改 Todo 后列表还是旧数据 | 写操作后没有删除缓存 | 在 Add/Update/Done/Delete 后统一失效缓存 |
| 数据库压力没有下降 | 缓存 Key 不稳定或 TTL 太短 | 检查 Key 设计和命中率 |
| 大量请求突然打到数据库 | 缓存雪崩或热点 Key 过期 | TTL 加随机抖动、预热、限流 |
| 限流误伤健康检查 | 对 `/healthz` 或 `/readyz` 限流 | 只对业务路由限流 |
| 队列任务堆积 | worker 没启动或处理太慢 | 查看 `LLEN`，检查 worker 日志 |
| Redis 内存持续增长 | Key 没有 TTL 或队列不消费 | 检查 `TTL`、`MEMORY USAGE`、队列长度 |
| `docker` 命令不存在 | Docker 未安装或终端环境变量未刷新 | 安装 Docker Desktop 后重启终端 |
| `port is already allocated` | 本机 `6379` 已被占用 | 停止旧 Redis，或临时改成 `"6380:6379"` |

## 9. 排障方法

### 9.1 检查 Redis 容器

```bash
docker version
docker compose ps redis
docker compose logs redis --tail=50
```

判断依据：

- `docker version` 必须能看到 Docker Engine 服务端信息，只看到 Client 通常表示 Docker Desktop 没启动。
- `STATUS` 应该是 `running` 或 `healthy`。
- 日志中不应该反复出现认证、权限或持久化错误。

### 9.2 检查 Redis 连接

```bash
docker compose exec redis redis-cli -a todo_redis_password ping
```

预期输出 `PONG`。如果失败，先检查容器是否启动，再检查密码和端口。

### 9.3 检查缓存 Key

```bash
docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:cache:*'
docker compose exec redis redis-cli -a todo_redis_password TTL todo:cache:stats
docker compose exec redis redis-cli -a todo_redis_password GET todo:cache:stats
```

判断依据：

- `SCAN` 能看到缓存 Key，说明应用写入过缓存。
- `TTL` 返回正数，说明缓存有过期时间。
- `TTL = -1` 表示没有过期时间，需要修复。
- `TTL = -2` 表示 Key 不存在，可能尚未访问接口或刚被失效。

本地实验可以偶尔使用 `KEYS`，但生产环境不要在大规模 Redis 上执行 `KEYS`，它可能阻塞 Redis。线上排查优先使用 `SCAN` 或可观测平台。

### 9.4 检查限流 Key

```bash
docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:ratelimit:*'
docker compose exec redis redis-cli -a todo_redis_password TTL todo:ratelimit:127.0.0.1:0
```

真实 Key 的最后一段是窗口编号，不一定是 `0`。如果出现大量限流 Key，说明有很多不同客户端或 Header 身份。

### 9.5 检查队列堆积

```bash
docker compose exec redis redis-cli -a todo_redis_password LLEN todo:tasks:stats
docker compose exec redis redis-cli -a todo_redis_password LRANGE todo:tasks:stats 0 5
```

判断依据：

- `LLEN` 长时间增长，说明 worker 没有消费或消费太慢。
- `LRANGE` 可以查看任务内容是否格式正确。
- 如果任务无法消费，要检查 API 启动日志中是否启用了 Redis worker。

### 9.6 检查 Redis 内存

```bash
docker compose exec redis redis-cli -a todo_redis_password INFO memory
docker compose exec redis redis-cli -a todo_redis_password INFO stats
```

重点关注：

- `used_memory_human`：当前内存使用。
- `evicted_keys`：是否发生淘汰。
- `keyspace_hits` 和 `keyspace_misses`：缓存命中和未命中。

如果 `evicted_keys` 持续增长，说明 Redis 内存不足或淘汰策略正在生效。

缓存命中率可以用下面的公式粗略计算：

```text
keyspace_hits / (keyspace_hits + keyspace_misses)
```

生产应用还应该在业务日志或指标系统里记录 `cache_hit`、`cache_miss`、`cache_error`，因为只看 Redis 全局指标无法区分具体接口和具体 Key。

## 10. 生产环境注意事项

### 10.1 Redis 不能裸奔在公网

生产 Redis 必须：

- 禁止公网直接访问。
- 使用密码或 ACL。
- 限制安全组和网络策略。
- 启用 TLS 或使用受信内网链路。
- 不在日志中打印 Redis 密码。

### 10.2 缓存不是事实来源

缓存可以删除、过期、被淘汰。系统必须能从 PostgreSQL 或真实 Repository 重建缓存。

不要把用户订单、扣款状态、权限最终结果只写 Redis。强一致数据应该落在数据库中。

### 10.3 TTL 要加随机抖动

大量 Key 使用同一个 TTL，可能在同一时间过期，引发缓存雪崩。

生产中可以给 TTL 加随机抖动，例如：

```text
base ttl = 5m
actual ttl = 5m + random(0~60s)
```

本篇为了让新手容易观察，使用固定 TTL。生产代码应该补上抖动。

### 10.4 限流要分层

应用内限流只是最后一道保护。生产中通常还会在这些层做限流：

- CDN。
- API Gateway。
- Ingress Controller。
- Service Mesh。
- 应用中间件。

限流维度也不只 IP，还可以是用户 ID、租户 ID、API Token、接口路径。

### 10.5 Redis 故障要有降级策略

Redis 是加速层时，故障策略必须提前定义，不能等线上报错再临时决定。

常见策略有三种：

- 失败关闭：Redis 不可用时接口直接失败，适合强依赖 Redis 状态的接口。
- 绕过缓存：Redis 不可用时直接访问数据库，适合读缓存，但要配合限流保护数据库。
- 只读降级：保留查询能力，暂停部分写入或异步任务，适合故障窗口内保护核心链路。

本篇示例在缓存读写失败时会记录日志并继续访问真实 Repository，但启动时如果配置了 Redis 且连接失败，会直接报错。真实生产中可以根据业务重要程度调整这个选择。

### 10.6 设置内存上限和淘汰策略

生产 Redis 必须明确容量边界：

- 设置 `maxmemory`，避免 Redis 把宿主机或 Pod 内存打满。
- 根据业务选择 `maxmemory-policy`，例如缓存场景常见 `allkeys-lru` 或 `allkeys-lfu`。
- 区分缓存 Redis 和队列/锁 Redis，不要让大量缓存淘汰影响任务协调。
- 定期检查大 Key、热 Key 和无 TTL Key。

如果 Redis 运行在 Kubernetes 中，还要同时设置容器 `requests`、`limits` 和持久卷容量告警。

### 10.7 分布式锁要谨慎

Redis 锁适合短时间、可重试、可幂等的任务协调。它不适合替代数据库事务，也不适合保护长时间任务。

如果一定要用锁：

- 使用随机 value。
- 设置过期时间。
- 解锁时校验 value。
- 业务逻辑必须幂等。
- 锁超时和续期策略必须明确。

### 10.8 队列任务必须幂等

异步任务可能重复执行，也可能执行失败。任务处理逻辑要做到：

- 重复执行不会破坏数据。
- 失败可以重试。
- 超过重试次数进入死信或告警。
- 能通过日志和指标追踪处理结果。

本篇统计刷新任务是可重算的，因此适合用简单队列演示。

### 10.9 监控指标必须齐全

生产 Redis 至少关注：

- 内存使用率。
- 连接数。
- QPS。
- 慢命令。
- 命中率。
- Key 数量。
- 淘汰次数。
- 主从复制延迟。
- 持久化失败。

在 Kubernetes 中，还要关注 Redis Pod 的 CPU、内存、磁盘、重启次数和持久卷状态。

## 11. 本章小项目

本章小项目是：**Todo Platform Redis 加速与异步处理**。

项目成果：

- `docker-compose.yml`：本地 Redis 实验环境。
- `internal/cache/redis.go`：Redis 客户端初始化。
- `internal/todo/redis_cache.go`：Todo Repository 缓存包装层。
- `internal/ratelimit/redis_limiter.go`：固定窗口限流器。
- `internal/httpapi/middleware.go`：业务接口限流中间件。
- `internal/tasks/redis_queue.go`：Redis List 简单任务队列。
- `cmd/todo-api/main.go`：按配置启用 Redis 缓存、限流和 worker。

### 验收命令

基础验证：

=== "Linux / macOS / WSL2"

    ```bash
    go mod tidy
    go fmt ./...
    go test ./...
    go test ./... -cover
    go build ./cmd/todo-api
    ```

=== "Windows PowerShell"

    ```powershell
    go mod tidy
    go fmt ./...
    go test ./...
    go test ./... -cover
    go build ./cmd/todo-api
    ```

Redis 验证：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose up -d redis
    docker compose exec redis redis-cli -a todo_redis_password ping
    export TODO_CONFIG_FILE=configs/local.example.json
    export TODO_REDIS_ADDR=127.0.0.1:6379
    export TODO_REDIS_PASSWORD=todo_redis_password
    go run ./cmd/todo-api
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose up -d redis
    docker compose exec redis redis-cli -a todo_redis_password ping
    $env:TODO_CONFIG_FILE = "configs\local.example.json"
    $env:TODO_REDIS_ADDR = "127.0.0.1:6379"
    $env:TODO_REDIS_PASSWORD = "todo_redis_password"
    go run ./cmd/todo-api
    ```

### 能力验收标准

你可以用下面清单自检：

- 能解释 Redis 和 PostgreSQL 的职责差异。
- 能使用 `SET`、`GET`、`TTL`、`INCR`、`HSET`、`RPUSH`、`LPOP`。
- 能说明缓存 Key 和 TTL 如何设计。
- 能解释 Cache-Aside 模式。
- 能说明缓存穿透、击穿、雪崩的差异。
- 能实现 Todo 列表和统计缓存。
- 能在写操作后正确失效缓存。
- 能用 Redis 实现固定窗口限流。
- 能说明固定窗口限流的边界。
- 能用 Redis List 实现简单异步任务。
- 能说明 Redis 在生产环境中的安全和高可用风险。

### 作品集说明

完成本篇后，你的作品集可以新增一条：

```text
为 Go Todo Platform 接入 Redis，实现 Todo 查询缓存、统计缓存、接口限流和异步统计刷新任务，并说明缓存一致性、限流算法和 Redis 生产风险。
```

这比“会用 Redis 命令”更有说服力，因为它展示了缓存设计、请求保护、异步处理和生产边界意识。

## 12. 本章练习题

### 基础题

1. Redis 和 PostgreSQL 的主要职责有什么不同？
2. `SET key value EX 60` 中 `EX 60` 的作用是什么？
3. `TTL` 返回 `-1` 和 `-2` 分别代表什么？
4. Cache-Aside 的读流程是什么？
5. 为什么写操作后通常删除缓存，而不是只更新一个缓存 Key？

### 实操题

1. 把 Todo 列表缓存 TTL 从 `30s` 改为 `2m`，观察 `TTL` 变化。
2. 增加 `todo:cache:item:<id>` 单个 Todo 缓存。
3. 把限流阈值改成 `5` 次每分钟，验证接口返回 `429`。
4. 给任务队列增加一个 `cleanup_done_todos` 任务类型。
5. 给缓存 TTL 增加 0 到 10 秒随机抖动。

### 思考题

1. 如果 Redis 故障，Todo API 应该完全不可用，还是降级访问数据库？
2. 哪些数据可以放缓存，哪些数据不应该只放 Redis？
3. 限流应该按 IP、用户 ID 还是 API Token？不同选择有什么影响？
4. Redis List 和 Redis Streams 在任务队列场景有什么区别？
5. 为什么分布式锁不能替代数据库事务？

## 13. 本章面试题

### 1. Redis 常用于哪些场景？

参考答案：

Redis 常用于缓存、计数器、限流、排行榜、分布式锁、短期会话状态和轻量任务队列。回答时要强调 Redis 是内存型数据结构服务，不应该默认替代关系型数据库。强一致、事务性、长期持久化的数据通常仍然需要数据库。

### 2. 什么是缓存穿透、击穿和雪崩？

参考答案：

缓存穿透是查询不存在的数据，每次都绕过缓存打到数据库；缓存击穿是热点 Key 过期后大量请求同时访问数据库；缓存雪崩是大量 Key 同时过期或 Redis 故障，导致流量集中打到数据库。常见解决方案包括缓存空值、参数校验、互斥重建、TTL 抖动、预热、限流和降级。

### 3. Cache-Aside 模式怎么工作？

参考答案：

读请求先查缓存，命中直接返回；未命中查数据库，再写入缓存。写请求先更新数据库，再删除缓存。它的优点是简单、通用，缺点是需要处理缓存不一致、击穿和并发重建问题。

### 4. Redis 如何实现限流？

参考答案：

可以用 `INCR` 计数并给 Key 设置过期时间实现固定窗口限流。Key 通常包含限流对象和时间窗口。超过阈值返回 429。固定窗口简单但不够平滑，窗口边界可能产生流量突刺，生产中可使用滑动窗口或令牌桶。

### 5. Redis 分布式锁有哪些风险？

参考答案：

风险包括锁超时后业务仍在执行、误删其他客户端的锁、Redis 主从切换导致锁状态不一致、业务不幂等导致重复执行。基础写法应使用 `SET key value NX PX ttl`，解锁时校验 value。分布式锁不能替代数据库事务。

### 6. Redis List 做队列有什么问题？

参考答案：

Redis List 可以实现简单队列，但任务被消费者取出后如果进程崩溃，任务可能丢失；它没有天然重试、死信和消费组能力。可靠任务队列更适合使用 Redis Streams、Kafka、RabbitMQ 或云消息队列。

### 7. 如何判断缓存是否有效？

参考答案：

可以观察缓存命中率、数据库 QPS、接口延迟、Redis Key 数量和 TTL。Redis 中可以看 `INFO stats` 的 `keyspace_hits`、`keyspace_misses`，应用中也应记录 cache hit/miss 指标。只看 Redis 有 Key 不代表缓存设计有效。

### 8. Redis 生产环境要注意什么？

参考答案：

要注意访问控制、网络隔离、TLS、内存上限、淘汰策略、持久化配置、高可用、备份恢复、慢命令、监控告警和版本升级。还要明确 Redis 故障时应用是失败、降级还是绕过缓存访问数据库。

## 14. 本章总结

本篇完成了 Todo Platform 的 Redis 能力建设：

- 使用 Docker Compose 启动 Redis。
- 学习 Redis 常用数据结构和命令。
- 使用 `go-redis` 初始化 Redis 客户端。
- 用 Cache-Aside 模式为 Todo 列表和统计增加缓存。
- 用 `INCR` 和过期时间实现固定窗口限流。
- 用 Redis List 实现简单异步统计刷新任务。
- 补充了缓存穿透、击穿、雪崩、分布式锁和生产环境风险。

本篇的核心能力不是“会写几个 Redis 命令”，而是能判断 Redis 应该放在系统链路的哪个位置，知道它能解决什么问题，也知道它会带来什么风险。

## 15. 下一章衔接

下一篇会进入 Go 后端生产化能力，包括认证、安全响应、请求 ID、审计日志、配置分层和运行命令设计。

Redis 能力会继续被复用：

- 登录接口可以使用 Redis 保存短期验证码或登录失败次数。
- 请求 ID 和审计日志可以记录限流和缓存命中信息。
- 生产配置会把 Redis 地址、密码、TTL 和限流阈值按环境拆分。
- 后续 Docker Compose 和 Kubernetes 章节会把 API、PostgreSQL、Redis 一起编排和部署。

到这里，Todo Platform 已经具备后端服务常见的三层基础能力：API、数据库和缓存。接下来要把这些能力包装成更安全、更可运维、更接近生产环境的服务。
