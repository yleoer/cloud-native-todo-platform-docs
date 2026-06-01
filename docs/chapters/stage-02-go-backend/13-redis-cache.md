# 第 13 篇：Redis、缓存与异步任务

第 12 篇已经把 Todo API v3 接入 PostgreSQL，让 Todo 数据具备持久化能力。数据库适合保存权威数据，但真实后端服务还会遇到另外一类问题：某些查询太频繁、异常客户端请求太密、部分统计刷新不应该阻塞用户请求。

本篇引入 Redis。Redis 是内存型数据结构服务（data structure server），常用于缓存、计数器、限流、分布式锁和轻量任务队列。我们不会把 Redis 当成“更快的数据库”，而是把它放在 PostgreSQL 前面和请求链路旁边：PostgreSQL 仍然是事实来源，Redis 负责加速读取、保护接口和承接可重算的异步任务。

本篇属于 **C 类：实践/开发章**。本篇特色项目是：**为 Todo API v4 增加 Redis 缓存、接口限流和异步统计任务**。

本篇对应 5 个章节主题：

- 13.1 Redis 安装、数据类型与常用命令
- 13.2 Go 操作 Redis
- 13.3 缓存穿透、击穿、雪崩与解决方案
- 13.4 分布式锁、计数器与接口限流
- 13.5 简单任务队列与异步处理模型

## 1. 本章学习目标

学完本篇后，你应该能判断 Redis 应该放在系统链路的哪个位置，而不是只会背 `SET`、`GET`、`INCR`。

### 1.1 知识目标

- 能说明 Redis 和 PostgreSQL 的职责边界。
- 能解释 Redis String、Hash、List、Set、Sorted Set 的典型用途。
- 能设计缓存 Key、TTL（Time To Live，过期时间）和缓存失效策略。
- 能区分缓存穿透、缓存击穿和缓存雪崩。
- 能解释 Redis 分布式锁、固定窗口限流的实现方式和边界。
- 能说明 Redis List 做任务队列的可靠性限制。

### 1.2 技能目标

- 能使用 Docker Compose 启动 Redis 8.2。
- 能使用 `redis-cli` 验证 Redis 常用命令。
- 能使用 `go-redis` 初始化 Redis 客户端并复用连接池。
- 能用 Cache-Aside 模式为 Todo 列表增加缓存。
- 能用 Redis 计数器和 Lua（Redis 内置脚本语言）脚本实现固定窗口限流。
- 能用 Redis List 实现简单异步统计刷新任务。

本篇结束时，你至少应该能成功执行：

```bash linenums="0"
cd ~/workspace/cloud-native-todo-platform
docker compose up -d postgres redis
docker compose exec redis redis-cli -a todo_redis_password ping
go get github.com/redis/go-redis/v9@v9.19.0
go test ./api/...
go build -o bin/todo-api ./api/cmd/todo-api
TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable' TODO_REDIS_ADDR=127.0.0.1:6379 TODO_REDIS_PASSWORD=todo_redis_password TODO_API_ADDR=127.0.0.1:18080 ./bin/todo-api
```

## 2. 本章工作场景与真实案例

### 2.1 技术痛点

PostgreSQL 是权威数据源，但它不是所有问题的唯一答案：

- 列表接口被频繁访问，每次都查数据库会增加数据库压力。
- 压测或异常客户端短时间打出大量请求，可能把 API、数据库和 Redis 都拖慢。
- 统计刷新不一定要阻塞用户写请求，可以放到后台异步处理。
- 缓存设计不当会出现脏数据、穿透、击穿和雪崩。
- Redis 故障时，如果没有降级策略，缓存层反而会变成新的单点风险。

本篇会把这些问题放进 Todo API：给列表查询加缓存；给 API 增加 IP 维度固定窗口限流；写操作后删除缓存并投递一个“刷新统计”的异步任务。

### 2.2 团队协作场景

真实团队使用 Redis 时，经常需要多人协作：

- 后端开发设计缓存 Key、TTL、失效策略、限流中间件和任务处理逻辑。
- SRE 关注 Redis 内存、连接数、慢命令、持久化、高可用和告警。
- DBA 关注缓存是否真的降低数据库压力，以及缓存失效后数据库能否承受回源流量。
- 测试工程师验证缓存命中、限流 429、Redis 故障降级和队列堆积。
- 架构师决定哪些数据可以缓存、哪些数据必须强一致、哪些任务可以异步。

Redis 的核心价值不是“快”，而是把短期状态、热点读取、计数和轻量协调从主数据库里分离出来。

### 2.3 课程项目关联

本篇会新增或修改：

```text linenums="0"
cloud-native-todo-platform/
├── docker-compose.yml
└── api/
    ├── cmd/
    │   └── todo-api/
    │       └── main.go
    └── internal/
        ├── cache/
        │   └── redis.go
        ├── middleware/
        │   └── ratelimit.go
        ├── ratelimit/
        │   └── redis_limiter.go
        ├── repository/
        │   └── cached.go
        └── tasks/
            └── redis_queue.go
```

第 12 篇的 PostgreSQL Repository 仍然是事实数据源。本篇新增的 `CachedRepository` 是包装层：读列表时先查 Redis，未命中再查真实 Repository；写操作成功后删除相关缓存并投递统计刷新任务。

## 3. 核心概念

### 3.1 Redis 是什么

Redis 是内存型数据结构服务。它通过网络接收命令，例如：

```text linenums="0"
SET todo:cache:list:all "..."
GET todo:cache:list:all
INCR todo:ratelimit:127.0.0.1:29401234
LPUSH todo:tasks refresh_stats
BRPOP todo:tasks 5
```

Redis 常见用途是缓存、计数器、限流、排行榜、短期会话、分布式锁和轻量队列。它不应该默认替代 PostgreSQL，因为 Redis 更强调低延迟和短期状态，PostgreSQL 更强调事务、约束和权威数据。

### 3.2 Redis 数据类型

Redis 的 Key 是字符串，Value 可以是不同结构：

| 类型 | 常用命令 | Todo 场景 |
|---|---|---|
| String | `SET`、`GET`、`INCR` | 缓存 JSON、限流计数 |
| Hash | `HSET`、`HGETALL` | 保存对象字段 |
| List | `LPUSH`、`BRPOP` | 简单任务队列 |
| Set | `SADD`、`SMEMBERS` | 去重集合 |
| Sorted Set | `ZADD`、`ZRANGE` | 排行榜、延迟任务 |

本篇使用 String 做 Todo 列表缓存和限流计数，使用 List 做异步统计刷新队列。

### 3.3 Cache-Aside 缓存模式

Cache-Aside 也叫旁路缓存，是后端最常见的缓存模式。

读路径：

1. 先读 Redis。
2. 命中则直接返回。
3. 未命中则读 PostgreSQL。
4. 把结果写回 Redis，并设置 TTL。

写路径：

1. 先写 PostgreSQL。
2. 写成功后删除相关缓存。
3. 下一次读请求重新加载并写入缓存。

为什么写操作后通常删除缓存，而不是直接更新缓存？因为一个写操作可能影响多个缓存 Key。例如 Todo 标记完成后，`list:all`、`list:pending`、`list:done` 都可能变化。删除缓存更简单，也更不容易漏。

### 3.4 缓存穿透、击穿和雪崩

缓存系统常见三类问题：

| 问题 | 现象 | 常见处理 |
|---|---|---|
| 缓存穿透 | 查询不存在的数据，每次都打到数据库 | 参数校验、缓存空值、布隆过滤器 |
| 缓存击穿 | 热点 Key 过期，大量请求同时回源 | 互斥重建、提前刷新、热点 Key 延长 TTL |
| 缓存雪崩 | 大量 Key 同时过期或 Redis 故障 | TTL 随机抖动、限流、降级、预热 |

本篇会给缓存 TTL 加随机抖动，避免大量列表缓存同时过期。

布隆过滤器是一种概率型数据结构，可以快速判断某个值“一定不存在”或“可能存在”；互斥重建则是用锁保证热点 Key 失效时只有一个请求回源数据库。

### 3.5 计数器、分布式锁与固定窗口限流

Redis String 不只可以保存字符串，也可以做原子计数器。`INCR` 会在 Redis 单线程命令执行模型下原子递增 Key 的值，因此非常适合做访问次数、失败次数和限流窗口计数。

分布式锁也是 Redis 常见用法，但它比计数器更容易写错。最小正确模型通常是：

```text linenums="0"
SET todo:lock:stats <unique-token> NX PX 30000
```

- `NX` 表示 Key 不存在时才设置，避免多个实例同时拿到锁。
- `PX 30000` 表示锁自动过期，避免持锁进程崩溃后永久占用。
- `<unique-token>` 是当前持锁者身份，释放锁时必须校验 token。

释放锁不能简单执行 `DEL todo:lock:stats`，否则可能误删别人刚拿到的新锁。生产中通常用 Lua 脚本完成“比较 token + 删除 Key”的原子操作：

```text linenums="0"
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
```

本篇不会把分布式锁接入 Todo API v4 的业务代码，因为当前项目主线是缓存、限流和轻量异步任务；但你需要知道 Redis 锁的正确边界，避免把 `SETNX` 当成万能锁。换句话说，13.4 的“分布式锁”在本章是概念和风险训练，不是必须落入 Todo API 的功能点；真正的项目实现会把精力放在计数器限流和 Redis List 任务上。

限流是为了保护系统在异常流量下仍然可控。本篇实现固定窗口限流：

```text linenums="0"
todo:ratelimit:<client-ip>:<minute-window>
```

每个请求执行一次计数递增。如果计数第一次出现，就给 Key 设置过期时间。超过阈值后返回 `429 Too Many Requests`。代码里会用 Lua 脚本把 `INCR` 和设置过期时间放在同一次 Redis 执行中，避免计数 Key 因中途失败而没有 TTL。

固定窗口简单、易懂、适合教学。它的缺点是窗口边界可能产生流量突刺。生产中还会使用滑动窗口、漏桶或令牌桶。

### 3.6 Redis List 简单任务队列

Redis List 可以做轻量队列。`LPUSH`（Left Push，左侧推入）负责生产任务，`BRPOP`（Blocking Right Pop，阻塞式右侧弹出）负责消费任务：

```text linenums="0"
LPUSH todo:tasks refresh_stats
BRPOP todo:tasks 5
```

写请求完成后投递 `refresh_stats` 任务，后台 worker 消费任务并刷新第 11 篇的 `StatsService`。

这个队列不是完整消息系统。任务被消费后如果进程崩溃，Redis List 不会自动重试。它适合本篇这种“可丢失、可重算”的统计刷新，不适合扣款、发货这类强可靠业务。

## 4. 原理深入

### 4.1 接入 Redis 后的请求链路

图 13-1 Todo API v4 Redis 缓存、限流与异步任务链路：

```mermaid
sequenceDiagram
    participant Client as Client
    participant RL as RateLimit Middleware
    participant API as Gin Handler
    participant Svc as TodoService
    participant Cache as CachedRepository
    participant Redis as Redis
    participant PG as PostgreSQL Repository
    participant Q as Redis Queue
    participant Worker as Stats Worker

    Client->>RL: HTTP request
    RL->>Redis: INCR ratelimit key
    RL->>API: allowed request
    API->>Svc: List(ctx, status)
    Svc->>Cache: List(ctx, status)
    Cache->>Redis: GET cache key
    alt cache hit
        Redis-->>Cache: cached JSON
    else cache miss
        Cache->>PG: List(ctx, status)
        PG-->>Cache: []Todo
        Cache->>Redis: SET cache key with TTL
    end
    Cache-->>Svc: []Todo
    Svc-->>API: []Todo
    API-->>Client: JSON
    Cache->>Q: enqueue refresh_stats after writes
    Worker->>Q: BRPOP task
    Worker->>Svc: Refresh stats
```

限流发生在业务逻辑之前，缓存发生在 Repository 外层，异步任务发生在写操作之后。图里的 Redis 和 Redis Queue 是逻辑角色拆分，实际可以是同一个 Redis 实例里的不同 Key。三者各管一段链路，不互相替代。

### 4.2 Redis 客户端也要复用

和 `*sql.DB` 一样，go-redis 的 `*redis.Client` 也是并发安全的连接池句柄。它应该在应用启动时创建并复用，不应该每个请求创建一次。

本篇会在 `api/internal/cache/redis.go` 中创建客户端，并在启动时 `Ping` Redis。设置了 `TODO_REDIS_ADDR` 才启用 Redis；不设置时，API 仍然能使用 PostgreSQL 或内存模式运行。

### 4.3 缓存一致性边界

本篇采用“写数据库成功后删除缓存”的策略。这种策略不能保证强一致，但通常能提供可接受的最终一致性：

- 写操作成功后，旧缓存被删除。
- 下一次读请求回源 PostgreSQL 并重建缓存。
- 如果删除缓存失败，可能短时间读到旧数据，所以需要日志和监控。

如果业务需要强一致，例如余额、库存、权限最终判定，就不应该只依赖 Redis 缓存。

### 4.4 限流失败时应该怎么办

Redis 限流中间件有两种故障策略：

- 失败关闭：Redis 出错就拒绝请求，保护后端资源。
- 失败开放：Redis 出错就放行请求，保证业务可用。

本篇选择失败开放：限流 Redis 出错时记录日志并放行。这适合教学和普通 Todo 查询；生产中应根据接口重要性和攻击风险决定策略。

限流实现还要注意两个边界：第一，固定窗口在窗口切换瞬间可能允许短时间突刺；第二，`INCR` 和过期时间应尽量原子设置，否则网络抖动或进程崩溃可能留下没有 TTL 的计数 Key。本篇代码使用 Redis Lua 脚本处理第二个问题，但仍然保留固定窗口算法的教学简洁性。

### 4.5 队列任务必须幂等

异步任务可能重复、丢失或延迟执行。本篇的 `refresh_stats` 是可重算任务：重复刷新没有副作用，任务丢失也可以由下一次读写触发重新刷新。

这类任务适合用 Redis List 教学。更可靠的业务任务应考虑 Redis Streams、Kafka、RabbitMQ 或云厂商消息队列，并设计重试、死信和幂等键。

## 5. 手把手实验

### 5.1 实验目标

本篇要完成 5 件事：

- 在第 12 篇 `docker-compose.yml` 中新增 Redis。
- 使用 `go-redis` 初始化 Redis 客户端。
- 增加 `CachedRepository` 包装 PostgreSQL 或内存 Repository。
- 增加 HTTP 固定窗口限流 middleware。
- 使用 Redis List 实现异步统计刷新任务。

### 5.2 实验环境

| 工具 | 版本 | 用途 |
|---|---|---|
| Ubuntu | 24.04 LTS | 统一实验环境 |
| Go | 1.26.x | 编译、测试和运行 |
| Docker Engine | 29.x | 运行 PostgreSQL 和 Redis 容器 |
| Docker Compose | v2 | 启动本地依赖 |
| PostgreSQL | 18 | 权威数据源 |
| Redis | 8.2 | 缓存、限流和队列 |
| curl | Ubuntu 24.04 默认版本 | 验证 API |

进入课程项目根目录：

```bash linenums="0"
cd ~/workspace/cloud-native-todo-platform
```

确认 Docker、Compose 和 Go 模块代理可用：

```bash linenums="0"
docker version
docker compose version
go env GOPROXY
```

确认第 12 篇文件已存在：

```bash linenums="0"
test -f api/internal/repository/postgres.go
test -f api/internal/database/postgres.go
test -f docker-compose.yml
```

### 5.3 文件目录结构

创建本篇新增目录：

```bash linenums="0"
mkdir -p api/internal/cache api/internal/middleware api/internal/ratelimit api/internal/tasks
```

本篇新增或覆盖文件如下：

```text linenums="0"
cloud-native-todo-platform/
├── docker-compose.yml
└── api/
    ├── cmd/
    │   └── todo-api/
    │       └── main.go
    └── internal/
        ├── cache/
        │   └── redis.go
        ├── middleware/
        │   └── ratelimit.go
        ├── ratelimit/
        │   └── redis_limiter.go
        ├── repository/
        │   └── cached.go
        └── tasks/
            └── redis_queue.go
```

### 5.4 完整代码

覆盖 `docker-compose.yml`，在第 12 篇 PostgreSQL 基础上增加 Redis：

```yaml title="docker-compose.yml"
services:
  postgres:
    image: registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
    container_name: todo-postgres
    environment:
      POSTGRES_USER: todo
      POSTGRES_PASSWORD: todo_password
      POSTGRES_DB: todo_platform
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "127.0.0.1:5432:5432"
    volumes:
      - todo-postgres-data:/var/lib/postgresql/data
      - ./api/migrations:/migrations:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U todo -d todo_platform"]
      interval: 5s
      timeout: 3s
      retries: 20

  redis:
    image: registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine
    container_name: todo-redis
    command: ["redis-server", "--requirepass", "todo_redis_password", "--appendonly", "yes"]
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - todo-redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "todo_redis_password", "ping"]
      interval: 5s
      timeout: 3s
      retries: 20

volumes:
  todo-postgres-data:
  todo-redis-data:
```

这里仍然把端口绑定到 `127.0.0.1`，避免本地实验服务暴露到外部网络。`--appendonly yes` 启用 AOF（Append Only File，追加式日志文件）持久化，Redis 重启后可以从日志恢复数据。Redis 密码写在 Compose 文件中是教学简化；生产环境应使用 Secret。

创建 `api/internal/cache/redis.go`：

```go title="api/internal/cache/redis.go"
package cache

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

// ErrMissingRedisAddr is returned when Redis is enabled without an address.
var ErrMissingRedisAddr = errors.New("missing redis address")

// Config controls Redis client setup.
type Config struct {
	Addr     string
	Password string
	DB       int
}

// Open creates a go-redis client and verifies connectivity.
func Open(ctx context.Context, cfg Config) (*redis.Client, error) {
	if cfg.Addr == "" {
		return nil, ErrMissingRedisAddr
	}
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.Addr,
		Password: cfg.Password,
		DB:       cfg.DB,
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

创建 `api/internal/repository/cached.go`：

```go title="api/internal/repository/cached.go"
package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"cloud-native-todo-platform/api/internal/model"

	"github.com/redis/go-redis/v9"
)

// cachedBackend mirrors service.Repository without importing service.
// Importing service from repository would invert the dependency direction:
// service depends on repository implementations in tests, while repository
// should stay below service in the package graph.
type cachedBackend interface {
	List(ctx context.Context, status model.Status) ([]model.Todo, error)
	Get(ctx context.Context, id int) (model.Todo, error)
	Create(ctx context.Context, title string) (model.Todo, error)
	Update(ctx context.Context, id int, title string) (model.Todo, error)
	MarkDone(ctx context.Context, id int) (model.Todo, error)
	Delete(ctx context.Context, id int) error
}

type statsTaskQueue interface {
	EnqueueStatsRefresh(ctx context.Context) error
}

// CachedRepository adds Redis cache-aside behavior around another repository.
type CachedRepository struct {
	next   cachedBackend
	redis  redis.Cmdable
	ttl    time.Duration
	logger *slog.Logger
	queue  statsTaskQueue
}

var _ cachedBackend = (*CachedRepository)(nil)

// NewCachedRepository creates a cache-aside repository wrapper.
func NewCachedRepository(next cachedBackend, client redis.Cmdable, ttl time.Duration, logger *slog.Logger, queue statsTaskQueue) *CachedRepository {
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &CachedRepository{
		next:   next,
		redis:  client,
		ttl:    ttl,
		logger: logger,
		queue:  queue,
	}
}

// List returns cached Todo lists when possible.
func (r *CachedRepository) List(ctx context.Context, status model.Status) ([]model.Todo, error) {
	key := listCacheKey(status)
	data, err := r.redis.Get(ctx, key).Bytes()
	if err == nil {
		var items []model.Todo
		if decodeErr := json.Unmarshal(data, &items); decodeErr == nil {
			r.logger.Info("todo list cache hit", "key", key)
			return items, nil
		} else {
			r.logger.Warn("decode todo list cache failed", "key", key, "error", decodeErr)
		}
	}
	if err != nil && err != redis.Nil {
		r.logger.Warn("read todo list cache failed", "key", key, "error", err)
	}

	items, err := r.next.List(ctx, status)
	if err != nil {
		return nil, err
	}
	payload, err := json.Marshal(items)
	if err != nil {
		r.logger.Warn("encode todo list cache failed", "key", key, "error", err)
		return items, nil
	}
	if err := r.redis.Set(ctx, key, payload, r.ttlWithJitter()).Err(); err != nil {
		r.logger.Warn("write todo list cache failed", "key", key, "error", err)
	}
	r.logger.Info("todo list cache miss", "key", key)
	return items, nil
}

func (r *CachedRepository) Get(ctx context.Context, id int) (model.Todo, error) {
	return r.next.Get(ctx, id)
}

func (r *CachedRepository) Create(ctx context.Context, title string) (model.Todo, error) {
	item, err := r.next.Create(ctx, title)
	if err != nil {
		return model.Todo{}, err
	}
	r.afterWrite(ctx)
	return item, nil
}

func (r *CachedRepository) Update(ctx context.Context, id int, title string) (model.Todo, error) {
	item, err := r.next.Update(ctx, id, title)
	if err != nil {
		return model.Todo{}, err
	}
	r.afterWrite(ctx)
	return item, nil
}

func (r *CachedRepository) MarkDone(ctx context.Context, id int) (model.Todo, error) {
	item, err := r.next.MarkDone(ctx, id)
	if err != nil {
		return model.Todo{}, err
	}
	r.afterWrite(ctx)
	return item, nil
}

func (r *CachedRepository) Delete(ctx context.Context, id int) error {
	if err := r.next.Delete(ctx, id); err != nil {
		return err
	}
	r.afterWrite(ctx)
	return nil
}

func (r *CachedRepository) afterWrite(ctx context.Context) {
	operationCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*time.Second)
	defer cancel()

	if err := r.invalidateLists(operationCtx); err != nil {
		r.logger.Warn("invalidate todo list cache failed", "error", err)
	}
	if r.queue != nil {
		if err := r.queue.EnqueueStatsRefresh(operationCtx); err != nil {
			r.logger.Warn("enqueue stats refresh failed", "error", err)
		}
	}
}

func (r *CachedRepository) invalidateLists(ctx context.Context) error {
	keys := []string{
		listCacheKey(""),
		listCacheKey(model.StatusPending),
		listCacheKey(model.StatusDone),
	}
	if err := r.redis.Del(ctx, keys...).Err(); err != nil {
		return fmt.Errorf("delete todo list cache: %w", err)
	}
	return nil
}

func (r *CachedRepository) ttlWithJitter() time.Duration {
	jitterMax := r.ttl / 10
	if jitterMax <= 0 {
		return r.ttl
	}
	return r.ttl + time.Duration(rand.Int63n(int64(jitterMax)))
}

func listCacheKey(status model.Status) string {
	if status == "" {
		return "todo:cache:list:all"
	}
	return "todo:cache:list:" + string(status)
}
```

这里没有写成 `var _ service.Repository = (*CachedRepository)(nil)`，是为了保持 `repository` 包不反向依赖 `service` 包。第 12 篇的 `PostgresRepository` 也采用同样策略：用一个和 `service.Repository` 方法集一致的本地接口做编译期断言，既能检查方法是否完整，又能避免包依赖方向倒置。

缓存失败时，本篇选择记录日志并继续访问真实 Repository。因为 Redis 在这里是加速层，不是事实来源。写操作成功后，`afterWrite` 会用一个 2 秒超时的 `WithoutCancel` 上下文删除缓存并投递任务。`context.WithoutCancel` 会创建一个不继承父 context 取消信号的新 context，确保即使客户端刚好断开连接，缓存失效和任务投递仍然会执行，但不会超过 2 秒超时限制。

创建 `api/internal/ratelimit/redis_limiter.go`：

```go title="api/internal/ratelimit/redis_limiter.go"
package ratelimit

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
)

var fixedWindowScript = redis.NewScript(`
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return current
`)

// FixedWindowLimiter implements Redis Lua based fixed-window rate limiting.
type FixedWindowLimiter struct {
	redis  redis.Cmdable
	prefix string
	limit  int64
	window time.Duration
	now    func() time.Time
}

// NewFixedWindowLimiter creates a Redis-backed limiter.
func NewFixedWindowLimiter(client redis.Cmdable, prefix string, limit int64, window time.Duration) *FixedWindowLimiter {
	if prefix == "" {
		prefix = "todo:ratelimit"
	}
	if limit <= 0 {
		limit = 60
	}
	if window <= 0 {
		window = time.Minute
	}
	if window < time.Second {
		window = time.Second
	}
	return &FixedWindowLimiter{
		redis:  client,
		prefix: prefix,
		limit:  limit,
		window: window,
		now:    time.Now,
	}
}

// Allow reports whether subject is still within the current window.
func (l *FixedWindowLimiter) Allow(ctx context.Context, subject string) (bool, int64, error) {
	key := l.key(subject)
	count, err := fixedWindowScript.Run(ctx, l.redis, []string{key}, l.window.Milliseconds()).Int64()
	if err != nil {
		return true, 0, fmt.Errorf("update rate limit: %w", err)
	}
	return count <= l.limit, count, nil
}

func (l *FixedWindowLimiter) key(subject string) string {
	safeSubject := strings.NewReplacer(":", "_", " ", "_", "/", "_").Replace(subject)
	windowSeconds := int64(l.window.Seconds())
	if windowSeconds <= 0 {
		windowSeconds = 1
	}
	windowID := l.now().Unix() / windowSeconds
	return fmt.Sprintf("%s:%s:%d", l.prefix, safeSubject, windowID)
}
```

Lua 脚本让 `INCR` 和 `PEXPIRE` 在 Redis 内部一次执行完。这样既保留固定窗口算法的易懂性，也避免计数 Key 因中途失败而没有过期时间。`key()` 方法会把 IP 地址或用户标识中的特殊字符替换成 `_`，避免破坏 Redis Key 的命名约定。

创建 `api/internal/middleware/ratelimit.go`：

```go title="api/internal/middleware/ratelimit.go"
package middleware

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"strings"
)

type rateLimiter interface {
	Allow(ctx context.Context, subject string) (bool, int64, error)
}

// RateLimit wraps an HTTP handler with Redis-backed rate limiting.
func RateLimit(limiter rateLimiter, logger *slog.Logger, next http.Handler) http.Handler {
	if limiter == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		subject := clientIP(r)
		allowed, count, err := limiter.Allow(r.Context(), subject)
		if err != nil {
			logger.Warn("rate limit failed open", "subject", subject, "error", err)
			next.ServeHTTP(w, r)
			return
		}
		if !allowed {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("Retry-After", "60")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":{"code":"rate_limited","message":"too many requests"}}`))
			logger.Warn("rate limited request", "subject", subject, "count", count, "path", r.URL.Path)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func clientIP(r *http.Request) string {
	// X-Forwarded-For should only be trusted when requests come through a trusted gateway.
	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
```

这里用 net/http middleware 包住 Gin router，避免修改第 10 篇的 Gin Handler 结构。限流放在标准库 `http.Handler` 层，意味着请求进入 Gin 路由之前就会被保护，并且这段逻辑不会绑定到某个 Web 框架。后续第 14 篇做生产化中间件时，会继续整理认证、CORS、日志和限流的组合方式。

创建 `api/internal/tasks/redis_queue.go`：

```go title="api/internal/tasks/redis_queue.go"
package tasks

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"cloud-native-todo-platform/api/internal/service"

	"github.com/redis/go-redis/v9"
)

const refreshStatsTask = "refresh_stats"

type statsRefresher interface {
	Refresh(ctx context.Context) (service.Stats, error)
}

// RedisQueue stores lightweight tasks in a Redis List.
type RedisQueue struct {
	redis  redis.Cmdable
	key    string
	logger *slog.Logger
}

// NewRedisQueue creates a Redis-backed task queue.
func NewRedisQueue(client redis.Cmdable, key string, logger *slog.Logger) *RedisQueue {
	if key == "" {
		key = "todo:tasks"
	}
	return &RedisQueue{redis: client, key: key, logger: logger}
}

// EnqueueStatsRefresh requests an asynchronous stats refresh.
func (q *RedisQueue) EnqueueStatsRefresh(ctx context.Context) error {
	return q.redis.LPush(ctx, q.key, refreshStatsTask).Err()
}

// RunStatsWorker consumes refresh_stats tasks until ctx is canceled.
func (q *RedisQueue) RunStatsWorker(ctx context.Context, refresher statsRefresher) {
	q.logger.Info("stats worker started", "queue", q.key)
	for {
		result, err := q.redis.BRPop(ctx, 5*time.Second, q.key).Result()
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			q.logger.Info("stats worker stopped")
			return
		}
		if errors.Is(err, redis.Nil) {
			continue
		}
		if err != nil {
			q.logger.Warn("pop stats task failed", "error", err)
			continue
		}
		if len(result) != 2 {
			q.logger.Warn("unexpected task payload", "payload", result)
			continue
		}
		if result[1] != refreshStatsTask {
			q.logger.Warn("unknown task type", "task", result[1])
			continue
		}
		if _, err := refresher.Refresh(ctx); err != nil {
			q.logger.Warn("refresh stats failed", "error", err)
			continue
		}
		q.logger.Info("stats refreshed")
	}
}
```

创建 `api/cmd/todo-api/main.go`。本文件覆盖第 12 篇的同名入口，新增 Redis 缓存、限流和 worker 组装逻辑：

```go title="api/cmd/todo-api/main.go"
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"cloud-native-todo-platform/api/internal/cache"
	"cloud-native-todo-platform/api/internal/database"
	ginapi "cloud-native-todo-platform/api/internal/handler/gin"
	"cloud-native-todo-platform/api/internal/middleware"
	"cloud-native-todo-platform/api/internal/ratelimit"
	"cloud-native-todo-platform/api/internal/repository"
	"cloud-native-todo-platform/api/internal/service"
	"cloud-native-todo-platform/api/internal/tasks"

	"github.com/redis/go-redis/v9"
)

type config struct {
	addr            string
	databaseDSN     string
	redisAddr       string
	redisPassword   string
	redisDB         int
	cacheTTL        time.Duration
	rateLimitPerMin int64
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	if len(os.Args) > 1 && os.Args[1] == "openapi" {
		fmt.Print(ginapi.OpenAPISpec())
		return
	}

	cfg := loadConfig()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	baseRepo, cleanupRepo, err := buildBaseRepository(ctx, cfg, logger)
	if err != nil {
		logger.Error("repository setup failed", "error", err)
		os.Exit(1)
	}
	defer cleanupRepo()

	repo, redisClient, queue, cleanupRedis, err := buildRedisFeatures(ctx, cfg, logger, baseRepo)
	if err != nil {
		logger.Error("redis setup failed", "error", err)
		os.Exit(1)
	}
	defer cleanupRedis()

	svc := service.NewTodoService(repo)
	if queue != nil {
		statsService, err := service.NewStatsService(svc, 0)
		if err != nil {
			logger.Error("stats service setup failed", "error", err)
			os.Exit(1)
		}
		go queue.RunStatsWorker(ctx, statsService)
	}

	router := ginapi.NewRouter(svc, logger)
	handler := http.Handler(router)
	if redisClient != nil {
		limiter := ratelimit.NewFixedWindowLimiter(redisClient, "todo:ratelimit", cfg.rateLimitPerMin, time.Minute)
		handler = middleware.RateLimit(limiter, logger, handler)
		logger.Info("redis rate limit enabled", "limit_per_minute", cfg.rateLimitPerMin)
	}

	server := &http.Server{
		Addr:              cfg.addr,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info("todo api starting", "addr", cfg.addr)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logger.Error("todo api failed", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	logger.Info("shutdown signal received")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Error("graceful shutdown failed", "error", err)
		os.Exit(1)
	}
	logger.Info("todo api stopped")
}

func loadConfig() config {
	addr := os.Getenv("TODO_API_ADDR")
	if addr == "" {
		addr = "127.0.0.1:18080"
	}
	return config{
		addr:            addr,
		databaseDSN:     os.Getenv("TODO_DATABASE_DSN"),
		redisAddr:       os.Getenv("TODO_REDIS_ADDR"),
		redisPassword:   os.Getenv("TODO_REDIS_PASSWORD"),
		redisDB:         intFromEnv("TODO_REDIS_DB", 0),
		cacheTTL:        durationFromEnv("TODO_CACHE_TTL", 30*time.Second),
		rateLimitPerMin: int64(intFromEnv("TODO_RATE_LIMIT_PER_MINUTE", 60)),
	}
}

func buildBaseRepository(ctx context.Context, cfg config, logger *slog.Logger) (service.Repository, func(), error) {
	if cfg.databaseDSN == "" {
		logger.Info("using memory repository")
		return repository.NewMemoryRepository(), func() {}, nil
	}

	db, err := database.Open(ctx, database.Config{DSN: cfg.databaseDSN})
	if err != nil {
		return nil, nil, err
	}
	logger.Info("using postgres repository")
	cleanup := func() {
		if err := db.Close(); err != nil {
			logger.Error("close database failed", "error", err)
		}
	}
	return repository.NewPostgresRepository(db), cleanup, nil
}

func buildRedisFeatures(ctx context.Context, cfg config, logger *slog.Logger, baseRepo service.Repository) (service.Repository, *redis.Client, *tasks.RedisQueue, func(), error) {
	if cfg.redisAddr == "" {
		logger.Info("redis disabled")
		return baseRepo, nil, nil, func() {}, nil
	}

	client, err := cache.Open(ctx, cache.Config{
		Addr:     cfg.redisAddr,
		Password: cfg.redisPassword,
		DB:       cfg.redisDB,
	})
	if err != nil {
		return nil, nil, nil, nil, err
	}

	queue := tasks.NewRedisQueue(client, "todo:tasks", logger)
	cachedRepo := repository.NewCachedRepository(baseRepo, client, cfg.cacheTTL, logger, queue)
	cleanup := func() {
		if err := client.Close(); err != nil {
			logger.Error("close redis failed", "error", err)
		}
	}

	logger.Info("redis cache enabled", "addr", cfg.redisAddr, "ttl", cfg.cacheTTL.String())
	return cachedRepo, client, queue, cleanup, nil
}

func intFromEnv(name string, fallback int) int {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return value
}

func durationFromEnv(name string, fallback time.Duration) time.Duration {
	raw := os.Getenv(name)
	if raw == "" {
		return fallback
	}
	value, err := time.ParseDuration(raw)
	if err != nil {
		return fallback
	}
	return value
}
```

这个入口保持了渐进式兼容：

- 不设置 `TODO_DATABASE_DSN`：使用内存 Repository。
- 设置 `TODO_DATABASE_DSN`：使用 PostgreSQL Repository。
- 设置 `TODO_REDIS_ADDR`：在当前 Repository 外面增加 Redis 缓存、限流和异步任务。

### 5.5 执行命令

拉取 Redis 依赖并整理依赖：

```bash linenums="0"
go get github.com/redis/go-redis/v9@v9.19.0
go mod tidy
```

启动 PostgreSQL 和 Redis：

```bash linenums="0"
docker compose up -d postgres redis
docker compose ps
```

确认 Redis 可用：

```bash linenums="0"
docker compose exec redis redis-cli -a todo_redis_password ping
```

`-a` 会把密码放在命令行参数中，本地实验可接受；生产环境更推荐使用 `REDISCLI_AUTH` 环境变量、交互式认证或更完整的密钥管理方案。

预期输出：

```text linenums="0"
PONG
```

如果第 12 篇迁移尚未执行，先执行迁移：

```bash linenums="0"
docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
```

格式化和测试：

```bash linenums="0"
go fmt ./api/...
go test ./api/...
```

这条测试命令会覆盖已有 Handler、Repository 和 Service 测试。本篇 Redis 缓存、限流和队列行为主要通过后面的 `redis-cli` 命令做手工验收；生产项目建议继续引入 Redis mock 或测试 Redis 容器补自动化测试。

构建 API：

```bash linenums="0"
go build -o bin/todo-api ./api/cmd/todo-api
```

启动 Todo API v4：

```bash linenums="0"
TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable' \
TODO_REDIS_ADDR=127.0.0.1:6379 \
TODO_REDIS_PASSWORD=todo_redis_password \
TODO_CACHE_TTL=30s \
TODO_RATE_LIMIT_PER_MINUTE=60 \
TODO_API_ADDR=127.0.0.1:18080 \
./bin/todo-api
```

另开一个终端，创建 Todo 并连续查询列表：

```bash linenums="0"
curl -s -X POST http://127.0.0.1:18080/api/v2/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"cache todo list with Redis"}'

curl -s http://127.0.0.1:18080/api/v2/todos
curl -s http://127.0.0.1:18080/api/v2/todos
```

检查缓存 Key：

```bash linenums="0"
docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:cache:*'
docker compose exec redis redis-cli -a todo_redis_password TTL todo:cache:list:all
```

验证限流，把阈值临时调低重新启动 API。先在运行 API 的终端按 `Ctrl-C` 停止旧进程，避免端口被占用：

```bash linenums="0"
TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable' \
TODO_REDIS_ADDR=127.0.0.1:6379 \
TODO_REDIS_PASSWORD=todo_redis_password \
TODO_RATE_LIMIT_PER_MINUTE=3 \
TODO_API_ADDR=127.0.0.1:18080 \
./bin/todo-api
```

连续请求：

```bash linenums="0"
curl -i http://127.0.0.1:18080/api/v2/todos
curl -i http://127.0.0.1:18080/api/v2/todos
curl -i http://127.0.0.1:18080/api/v2/todos
curl -i http://127.0.0.1:18080/api/v2/todos
```

第 4 次附近应看到 `429 Too Many Requests`。如果之前在同一分钟内已经发过请求，计数器可能已有残留值，429 会更早出现；等一分钟让窗口过期后再试即可。

查看任务队列：

```bash linenums="0"
docker compose exec redis redis-cli -a todo_redis_password LLEN todo:tasks
```

如果 API 日志出现 `stats refreshed`，说明 worker 已经消费了任务。

### 5.6 预期输出

API 启动日志中应出现：

```json linenums="0"
{"level":"INFO","msg":"using postgres repository"}
{"level":"INFO","msg":"redis cache enabled","addr":"127.0.0.1:6379","ttl":"30s"}
{"level":"INFO","msg":"redis rate limit enabled","limit_per_minute":60}
{"level":"INFO","msg":"stats worker started","queue":"todo:tasks"}
```

缓存命中前后日志类似：

```json linenums="0"
{"level":"INFO","msg":"todo list cache miss","key":"todo:cache:list:all"}
{"level":"INFO","msg":"todo list cache hit","key":"todo:cache:list:all"}
```

限流响应类似：

```text linenums="0"
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 60
```

响应体：

```json linenums="0"
{"error":{"code":"rate_limited","message":"too many requests"}}
```

### 5.7 验证方法

验证 Redis 服务：

```bash linenums="0"
docker compose exec redis redis-cli -a todo_redis_password ping
```

验证缓存 Key：

```bash linenums="0"
docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:cache:*'
```

验证限流 Key：

```bash linenums="0"
docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:ratelimit:*'
```

验证任务队列：

```bash linenums="0"
docker compose exec redis redis-cli -a todo_redis_password LLEN todo:tasks
```

验证 Redis 全局命中统计：

```bash linenums="0"
docker compose exec redis redis-cli -a todo_redis_password INFO stats
```

关注 `keyspace_hits` 和 `keyspace_misses`。它们是 Redis 全局指标，不能替代应用级缓存命中日志，但适合初步观察。

### 5.8 清理步骤

停止 API 后，停止依赖容器但保留数据卷：

```bash linenums="0"
docker compose down
```

如果要彻底清理 PostgreSQL 和 Redis 本地数据：

```bash linenums="0"
docker compose down -v
```

`-v` 会删除 PostgreSQL 和 Redis 数据卷。确认不需要保留实验数据再执行。

预计耗时：25 分钟阅读，80 分钟动手实验。

## 6. 常见错误与排障

### 错误 1：Redis 认证失败

- **现象**：

  ```text linenums="0"
  NOAUTH Authentication required
  ```

- **原因**：Redis 设置了 `--requirepass todo_redis_password`，但命令或 API 没有带密码。
- **排查**：

  ```bash linenums="0"
  docker compose exec redis redis-cli -a todo_redis_password ping
  echo "$TODO_REDIS_PASSWORD"
  ```

- **修复**：启动 API 时设置 `TODO_REDIS_PASSWORD=todo_redis_password`。
- **预防**：本地实验统一从 Compose 文件复制密码，生产使用 Secret。

### 错误 2：缓存没有生成

- **现象**：连续请求列表后，`redis-cli --scan --pattern 'todo:cache:*'` 没有任何 Key。
- **原因**：没有设置 `TODO_REDIS_ADDR`，API 仍在无 Redis 模式运行；或者请求被限流挡住，没有进入业务逻辑。
- **排查**：

  ```bash linenums="0"
  echo "$TODO_REDIS_ADDR"
  docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:cache:*'
  ```

- **修复**：设置 Redis 地址和密码后重启 API。
- **预防**：看启动日志，确认出现 `redis cache enabled`。

### 错误 3：写操作后读到旧数据

- **现象**：更新或标记完成后，列表接口短时间仍显示旧数据。
- **原因**：写操作后缓存失效失败，或有其他未覆盖的缓存 Key。
- **排查**：

  ```bash linenums="0"
  docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:cache:*'
  ```

- **修复**：确认 `afterWrite` 会删除 `all`、`pending`、`done` 三类列表缓存；必要时手动删除缓存验证：

  ```bash linenums="0"
  docker compose exec redis redis-cli -a todo_redis_password DEL todo:cache:list:all todo:cache:list:pending todo:cache:list:done
  ```

- **预防**：每新增一个缓存 Key，都要同步设计写路径的失效策略。

### 错误 4：限流一直返回 429

- **现象**：过了很久仍然被限流。
- **原因**：限流窗口过长、阈值过低，或多个请求都被识别成同一个客户端 IP。
- **排查**：

  ```bash linenums="0"
  docker compose exec redis redis-cli -a todo_redis_password --scan --pattern 'todo:ratelimit:*'
  docker compose exec redis redis-cli -a todo_redis_password TTL todo:ratelimit:127.0.0.1:0
  ```

  真实 Key 的最后一段是窗口编号，不一定是 `0`。

- **修复**：调大 `TODO_RATE_LIMIT_PER_MINUTE`，或等待窗口过期。
- **预防**：生产限流要明确维度：IP、用户 ID、租户 ID 或 API Token。

### 错误 5：任务队列堆积

- **现象**：`LLEN todo:tasks` 持续升高。
- **原因**：worker 没启动、Redis BRPOP 失败，或任务消费速度低于生产速度。
- **排查**：

  ```bash linenums="0"
  docker compose exec redis redis-cli -a todo_redis_password LLEN todo:tasks
  ```

  同时查看 API 日志是否出现 `stats worker started` 和 `stats refreshed`。

- **修复**：确认 `TODO_REDIS_ADDR` 已设置并重启 API；如果任务生产过快，需要降低写入频率或增加 worker 能力。
- **预防**：生产队列必须有队列长度、消费速率和失败次数监控。

## 7. 生产环境注意事项

1. **Redis 不是事实数据源**。缓存可以过期、被淘汰、被手动删除，也可能因为故障不可用。Todo 的权威状态仍然在 PostgreSQL。权限、余额、库存等强一致数据不能只写 Redis。

2. **缓存必须有失效策略和降级策略**。写操作后要删除相关缓存；TTL 应加随机抖动，避免雪崩。Redis 故障时要提前决定是失败开放、失败关闭，还是绕过缓存访问数据库并配合限流。

3. **限流要分层设计**。应用内 Redis 限流只是最后一道保护。生产中还会在网关、Ingress、API 网关、服务网格或 WAF 层限流。限流维度也不只 IP，还可以是用户、租户、Token 或接口路径；`X-Forwarded-For` 只能在可信网关后使用，不能无条件相信客户端传入的请求头。

4. **Redis 队列任务要幂等**。Redis List 不提供完整的确认、重试、死信和消费组能力。只适合可丢失、可重算、可重复执行的轻量任务。关键业务任务应使用更可靠的消息系统或 Redis Streams。

5. **Redis 要有容量和安全边界**。生产 Redis 不应裸露公网，要配置访问控制、TLS、内存上限、淘汰策略、慢命令监控和备份。缓存 Redis、锁 Redis、队列 Redis 最好按风险和容量隔离。

## 8. 本章小项目

本章小项目是 **Todo API v4 Redis 加速与异步处理**。项目目标是在 PostgreSQL 持久化基础上，为 Todo API 增加缓存、接口限流和异步统计刷新能力，同时说明 Redis 的一致性和可靠性边界。

交付物包括：

- 更新后的 `docker-compose.yml`
- `api/internal/cache/redis.go`
- `api/internal/repository/cached.go`
- `api/internal/ratelimit/redis_limiter.go`
- `api/internal/middleware/ratelimit.go`
- `api/internal/tasks/redis_queue.go`
- 更新后的 `api/cmd/todo-api/main.go`

能力验收标准：

- 能启动 Redis 8.2 并用 `redis-cli` 连接。
- 能解释 Redis 和 PostgreSQL 的职责差异。
- 能说明 Cache-Aside 的读写流程。
- 能验证 Todo 列表缓存 Key 和 TTL。
- 能触发并解释 `429 Too Many Requests`。
- 能说明 Redis 分布式锁为什么需要 token、过期时间和 Lua 释放。
- 能说明 Redis List 队列的可靠性边界。

## 9. 练习题与面试题

本章练习题和面试题已拆分到独立页面，完成正文学习后再进入题库练习与复盘。

[查看本章练习题与面试题](../../questions/stage-02-go-backend/13-redis-cache.md)

## 10. 本章总结

本篇把 Todo API 从“有数据库持久化”继续推进到“具备缓存、限流和异步处理能力”。你使用 Docker Compose 启动 Redis 8.2，学习了 String、List 等常用数据结构，理解了分布式锁的正确边界，用 `go-redis` 初始化客户端，并在 API 中按配置启用 Redis。

项目成果上，Todo API v4 新增了三层 Redis 能力：`CachedRepository` 用 Cache-Aside 模式缓存 Todo 列表；HTTP middleware 用固定窗口算法保护接口；Redis List 承接写操作后的统计刷新任务。PostgreSQL 仍然是事实来源，Redis 只做加速、保护和轻量协调。

能力价值上，你已经能说明 Redis 能解决什么，也能说清它不能解决什么。后续进入第 14 篇生产化时，Redis 的地址、密码、TTL、限流阈值、日志和故障策略都会进入配置分层和运维边界。

## 11. 下一章衔接

第 14 篇会把 Todo API 继续推向生产化：JWT 鉴权、审计日志、配置分层、结构化日志、健康检查强化和 pprof 性能分析都会围绕当前 API、PostgreSQL 和 Redis 组合展开。

学完本篇后，Todo Platform 已经具备 API、数据库、缓存、限流和简单异步任务。下一篇会开始处理“谁能访问、如何配置、如何观测、如何排障”的生产运行问题。
