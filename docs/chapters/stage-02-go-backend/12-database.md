# 第 12 篇：数据库与持久化开发

第 9 篇用标准库实现了 Todo API v1，第 10 篇把它重构为 Gin 版本，第 11 篇补上了并发统计和压测能力。但到目前为止，Todo 数据仍然存在进程内存里：服务一重启，数据就消失；如果未来部署多个 API 副本，每个副本也会有自己的内存数据。

本篇进入后端服务最核心的生产能力之一：**数据库持久化**。我们会把 Todo API 从内存存储升级为 PostgreSQL 存储，学习表设计、SQL CRUD、索引、事务、数据库迁移、`database/sql` 连接池、pgx 驱动和集成测试。

本篇属于 **C 类：实践/开发章**。本篇特色项目是：**为 Todo API v3 接入 PostgreSQL 持久化**。

本篇对应 5 个章节主题：

- 12.1 PostgreSQL 基础与表设计
- 12.2 SQL CRUD、索引与查询优化入门
- 12.3 Go 访问数据库：`database/sql`、GORM、sqlc 对比
- 12.4 事务、隔离级别与数据一致性
- 12.5 数据库迁移与版本管理

## 1. 本章学习目标

学完本篇后，你应该能把一个只靠内存存储的 Go API，演进为使用 PostgreSQL 的持久化服务。

### 1.1 知识目标

- 能解释关系型数据库为什么适合保存核心业务数据。
- 能为 Todo 设计表、字段类型、约束和索引。
- 能读懂基础 SQL CRUD、`RETURNING`、`EXPLAIN` 和事务语句。
- 能说明 `database/sql` 是连接池抽象，不是单个连接。
- 能比较 `database/sql`、GORM 和 sqlc 的适用场景。
- 能解释数据库迁移为什么需要版本管理和回滚脚本。

### 1.2 技能目标

- 能使用 Docker Compose 启动 PostgreSQL 18。
- 能编写并执行 Todo 表和事件表的迁移 SQL。
- 能使用 `database/sql` + pgx 实现 PostgreSQL Repository。
- 能用事务保证 Todo 变更和事件记录一致。
- 能编写需要真实 PostgreSQL 的集成测试，并用环境变量控制是否运行。
- 能启动 Todo API v3，验证服务重启后数据不丢失。

本篇结束时，你至少应该能成功执行：

```bash
cd ~/workspace/cloud-native-todo-platform
docker compose up -d postgres
docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
go test ./api/...
docker compose exec postgres createdb -U todo -O todo todo_platform_test || true
TODO_TEST_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform_test?sslmode=disable' TODO_ALLOW_DATABASE_RESET=true go test ./api/internal/repository -run Postgres -count=1
TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable' TODO_API_ADDR=127.0.0.1:18080 ./bin/todo-api
```

## 2. 本章工作场景与真实案例

### 2.1 技术痛点

内存存储适合教学，但真实后端服务不能长期依赖它：

- 服务重启后数据消失。
- 多个 API 实例之间无法共享数据。
- 无法使用 SQL 过滤、排序、分页和聚合。
- 没有事务，多个写操作可能只成功一半。
- 没有成熟的备份、恢复、权限、审计和监控能力。

本篇用 PostgreSQL 解决这些问题：Todo 数据进入 `todos` 表，状态变更进入 `todo_events` 表，API 仍然通过原来的 Handler 和 Service 对外提供能力。

### 2.2 团队协作场景

真实团队里，数据库改动通常会牵涉多个角色：

- 后端开发负责表设计、Repository、事务和集成测试。
- DBA 或资深后端会审查字段类型、索引、锁和慢查询风险。
- SRE 会关注连接池、备份恢复、监控告警和上线迁移窗口。
- 测试工程师会验证重启后数据是否保留、迁移是否可重复执行。
- 前端和产品会关心 API 契约是否稳定，不能因为换数据库就破坏返回格式。

本篇会刻意保持 API 契约不变：Handler 仍然调用 Service，Service 仍然依赖 Repository 接口，只是 Repository 的实现从内存换成 PostgreSQL。

### 2.3 课程项目关联

本篇会新增和修改：

```text
cloud-native-todo-platform/
├── docker-compose.yml
└── api/
    ├── cmd/
    │   └── todo-api/
    │       └── main.go
    ├── internal/
    │   ├── database/
    │   │   └── postgres.go
    │   └── repository/
    │       ├── postgres.go
    │       └── postgres_integration_test.go
    └── migrations/
        ├── 000001_create_todos.up.sql
        └── 000001_create_todos.down.sql
```

第 10 篇的 Gin Handler 不需要改。第 11 篇的 `StatsService` 也不需要改，因为它只依赖 `List(ctx, status)` 这个读接口。换成 PostgreSQL 后，统计任务和压测命令可以继续用来观察数据库访问是否稳定。

## 3. 核心概念

### 3.1 PostgreSQL

PostgreSQL 是成熟的开源关系型数据库。关系型数据库把数据组织成表、行和列，并用 SQL 查询数据。

Todo 数据可以放进 `todos` 表：

| id | title | status | created_at | updated_at |
|---|---|---|---|---|
| 1 | learn PostgreSQL | pending | 2026-05-28 10:00:00+00 | 2026-05-28 10:00:00+00 |
| 2 | write integration test | done | 2026-05-28 10:05:00+00 | 2026-05-28 10:20:00+00 |

数据库不是“更高级的文件”。它提供约束、索引、事务、连接池、权限、备份、恢复和并发控制，是后端服务保存核心数据的基础设施。关系型数据库常说的核心保证是 ACID（Atomicity 原子性、Consistency 一致性、Isolation 隔离性、Durability 持久性），后面的事务和持久化验证会逐步用到这些概念。

### 3.2 表设计、字段类型与约束

表设计要回答三个问题：保存什么、允许什么、如何查询。

本篇 `todos` 表使用：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `BIGSERIAL`（自增大整数） | 自增主键 |
| `title` | `TEXT` | Todo 标题 |
| `status` | `TEXT` | `pending` 或 `done` |
| `created_at` | `TIMESTAMPTZ`（TIMESTAMP WITH TIME ZONE） | 创建时间，带时区 |
| `updated_at` | `TIMESTAMPTZ`（TIMESTAMP WITH TIME ZONE） | 更新时间，带时区 |

关键约束示例：

```sql
status TEXT NOT NULL CHECK (status IN ('pending', 'done'))
```

服务层会校验标题和状态，数据库约束是最后一道防线。真实生产里，不能假设所有写入都一定来自你当前这份 Go 代码。

### 3.3 SQL CRUD 与 `RETURNING`

CRUD 是后端最常见的四类操作：

| 动作 | SQL | Todo 场景 |
|---|---|---|
| Create | `INSERT` | 创建 Todo |
| Read | `SELECT` | 查询 Todo |
| Update | `UPDATE` | 修改标题、标记完成 |
| Delete | `DELETE` | 删除 Todo |

PostgreSQL 的 `RETURNING` 很适合 API 场景：

```sql
INSERT INTO todos (title, status)
VALUES ($1, 'pending')
RETURNING id, title, status, created_at, updated_at;
```

插入后直接返回新行，Go 代码不需要再 `SELECT` 一次。

### 3.4 索引与查询优化入门

索引让数据库更快找到数据。本篇 Todo API 经常按状态筛选：

```sql
SELECT id, title, status, created_at, updated_at
FROM todos
WHERE status = 'pending'
ORDER BY id;
```

所以迁移文件会创建：

```sql
CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
```

索引不是越多越好。索引会加快部分查询，但会增加写入成本和磁盘占用。生产里应根据真实查询路径、数据规模和 `EXPLAIN ANALYZE` 结果设计索引。

### 3.5 `database/sql`、pgx、GORM 和 sqlc

Go 访问数据库常见方式有三类：

| 方式 | 特点 | 适合场景 |
|---|---|---|
| `database/sql` + 驱动 | 标准库抽象，手写 SQL，控制力强 | 学习底层机制、核心业务路径 |
| GORM | ORM，结构体映射方便，开发快 | 后台管理系统 CRUD、快速原型 |
| sqlc | 根据 SQL 生成类型安全 Go 代码 | SQL 较复杂、团队重视编译期检查 |

本篇使用 `database/sql` + pgx 驱动。`database/sql` 提供统一接口和连接池，pgx 提供 PostgreSQL 驱动实现。这样你能直接看到 SQL、事务和连接池边界。

### 3.6 事务与隔离级别

事务用于保证一组数据库操作要么全部成功，要么全部失败。Todo 场景中，标记完成时我们希望同时做两件事：

1. 更新 `todos.status = 'done'`。
2. 写入一条 `todo_events` 事件。

如果状态更新成功但事件写入失败，系统就不一致了。事务可以让这两步一起提交或一起回滚。

PostgreSQL 默认隔离级别是 `Read Committed`。本篇使用它就足够：每条 SQL 只能看到已经提交的数据。更复杂的余额、库存、配额场景，需要进一步讨论锁、隔离级别和重试策略。

## 4. 原理深入

### 4.1 接入 PostgreSQL 后的请求链路

图 12-1 Todo API v3 PostgreSQL 持久化请求链路：

```mermaid
sequenceDiagram
    participant Client as Client
    participant API as Gin Handler
    participant Svc as TodoService
    participant Repo as PostgresRepository
    participant Pool as database/sql Pool
    participant PG as PostgreSQL

    Client->>API: POST /api/v2/todos
    API->>Svc: Create(ctx, title)
    Svc->>Repo: Create(ctx, title)
    Repo->>Pool: BeginTx(ctx)
    Pool->>PG: INSERT todos RETURNING ...
    Pool->>PG: INSERT todo_events
    Pool->>PG: COMMIT
    Repo-->>Svc: Todo
    Svc-->>API: Todo
    API-->>Client: 201 JSON
```

Handler 和 Service 不需要知道 SQL 细节。Repository 负责把业务对象转换成 SQL，把 SQL 结果转换回 `model.Todo`。

### 4.2 为什么 Repository 接口能保护上层

第 10 篇的 `TodoService` 依赖的是接口：

```go
type Repository interface {
	List(ctx context.Context, status model.Status) ([]model.Todo, error)
	Get(ctx context.Context, id int) (model.Todo, error)
	Create(ctx context.Context, title string) (model.Todo, error)
	Update(ctx context.Context, id int, title string) (model.Todo, error)
	MarkDone(ctx context.Context, id int) (model.Todo, error)
	Delete(ctx context.Context, id int) error
}
```

内存 Repository 和 PostgreSQL Repository 只要都实现这个接口，Service 和 Handler 就可以复用。这就是分层的价值：不是为了多写文件，而是为了让替换基础设施时，上层业务契约保持稳定。

### 4.3 `*sql.DB` 是连接池

`*sql.DB` 这个名字容易误导初学者。它不是一条数据库连接，而是一个并发安全的连接池句柄。

你应该在进程启动时创建一个 `*sql.DB`，在整个服务生命周期内复用它，而不是每个请求都 `sql.Open` 一次。每个请求只应该通过 `QueryContext`、`ExecContext` 或事务从连接池借用连接。

本篇会设置：

```go
db.SetMaxOpenConns(10)
db.SetMaxIdleConns(5)
db.SetConnMaxLifetime(30 * time.Minute)
```

这三个参数会影响并发请求下的数据库连接数量和复用效率。

### 4.4 迁移为什么需要版本

数据库结构会随着代码演进而变化。今天创建 `todos` 表，明天可能增加 `priority` 字段，后天可能增加索引。如果只靠手工在数据库里执行 SQL，很快就会不知道某个环境到底执行到了哪一步。

迁移文件把结构变化写成版本化脚本：

```text
api/migrations/
├── 000001_create_todos.up.sql
└── 000001_create_todos.down.sql
```

本篇为了教学清晰，用 `psql -f` 手动执行迁移，并创建 `schema_migrations` 表记录版本。真实团队通常会使用 golang-migrate、Flyway、Liquibase 或平台内置迁移工具。

## 5. 手把手实验

### 5.1 实验目标

本篇要完成 5 件事：

- 使用 Docker Compose 启动 PostgreSQL 18。
- 编写 Todo 表、事件表、索引和迁移版本表。
- 使用 `database/sql` + pgx 实现 PostgreSQL Repository。
- 修改 `todo-api` 启动逻辑：有 `TODO_DATABASE_DSN` 时使用 PostgreSQL，否则保留内存存储。
- 编写 PostgreSQL 集成测试，并验证服务重启后数据仍然存在。

### 5.2 实验环境

| 工具 | 版本 | 用途 |
|---|---|---|
| Ubuntu | 24.04 LTS | 统一实验环境 |
| Go | 1.26.x | 编译、测试和运行 |
| Docker Engine | 29.x | 运行 PostgreSQL 容器 |
| Docker Compose | v2 | 启动 PostgreSQL |
| PostgreSQL | 18 | 本地数据库 |
| curl | Ubuntu 24.04 默认版本 | 验证 API |

进入课程项目根目录：

```bash
cd ~/workspace/cloud-native-todo-platform
```

确认 Docker 可用：

```bash
docker version
docker compose version
```

确认第 10 篇和第 11 篇文件已存在：

```bash
test -f api/cmd/todo-api/main.go
test -f api/internal/repository/memory.go
test -f api/internal/service/stats_service.go
```

### 5.3 文件目录结构

创建本篇新增目录：

```bash
mkdir -p api/internal/database api/migrations
```

本篇新增或覆盖文件如下：

```text
cloud-native-todo-platform/
├── docker-compose.yml
└── api/
    ├── cmd/
    │   └── todo-api/
    │       └── main.go
    ├── internal/
    │   ├── database/
    │   │   └── postgres.go
    │   └── repository/
    │       ├── postgres.go
    │       └── postgres_integration_test.go
    └── migrations/
        ├── 000001_create_todos.up.sql
        └── 000001_create_todos.down.sql
```

### 5.4 完整代码

创建 `docker-compose.yml`：

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

volumes:
  todo-postgres-data:
```

这里把端口绑定到 `127.0.0.1`，表示只允许本机访问。数据库密码写在教学 Compose 文件里是为了本地实验可复现；生产环境应使用 Secret 或受控配置系统。

`PGDATA` 被显式设置到 `/var/lib/postgresql/data/pgdata`，是为了让数据目录稳定落在 `todo-postgres-data` volume 里。PostgreSQL 18 官方镜像的默认数据目录和旧版本不同，教学中显式写出路径可以避免学生误以为挂了 volume，实际数据却写到另一个目录。`registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine` 会跟随 PostgreSQL 18 的最新补丁镜像；如果团队要求完全可复现，可以改成具体补丁标签。第 17 篇会把这个根目录 `docker-compose.yml` 演进为 `deployments/docker-compose/compose.yaml`，纳入 API、PostgreSQL、Redis 和 Traefik 的完整本地编排。

创建 `api/migrations/000001_create_todos.up.sql`：

```sql title="api/migrations/000001_create_todos.up.sql"
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todos (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at DESC);

CREATE TABLE IF NOT EXISTS todo_events (
    id BIGSERIAL PRIMARY KEY,
    todo_id BIGINT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'done', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todo_events_todo_id ON todo_events(todo_id);
CREATE INDEX IF NOT EXISTS idx_todo_events_created_at ON todo_events(created_at DESC);

INSERT INTO schema_migrations (version)
VALUES ('000001_create_todos')
ON CONFLICT (version) DO NOTHING;
```

创建 `api/migrations/000001_create_todos.down.sql`：

```sql title="api/migrations/000001_create_todos.down.sql"
DELETE FROM schema_migrations WHERE version = '000001_create_todos';

DROP TABLE IF EXISTS todo_events;
DROP TABLE IF EXISTS todos;
DROP TABLE IF EXISTS schema_migrations;
```

`todo_events.todo_id` 没有设置外键，是一个教学上的简化：本篇的 `Delete` 会先写入 `deleted` 事件再删除 Todo，如果加外键，删除后审计事件会遇到引用问题。生产审计表通常会额外保存标题、操作者、请求 ID 等快照字段。

这个 down 迁移会删除 `schema_migrations`，是因为它是本项目的第一个教学迁移。真实项目里通常由迁移工具统一管理迁移版本表，回滚某个业务迁移时不应随意删除整张版本表。

创建 `api/internal/database/postgres.go`：

```go title="api/internal/database/postgres.go"
package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// ErrMissingDSN is returned when PostgreSQL is requested without a DSN.
var ErrMissingDSN = errors.New("missing database dsn")

// Config controls the PostgreSQL connection pool.
type Config struct {
	DSN             string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

// Open creates a database/sql pool backed by the pgx PostgreSQL driver.
func Open(ctx context.Context, cfg Config) (*sql.DB, error) {
	if cfg.DSN == "" {
		return nil, ErrMissingDSN
	}
	if cfg.MaxOpenConns == 0 {
		cfg.MaxOpenConns = 10
	}
	if cfg.MaxIdleConns == 0 {
		cfg.MaxIdleConns = 5
	}
	if cfg.ConnMaxLifetime == 0 {
		cfg.ConnMaxLifetime = 30 * time.Minute
	}

	db, err := sql.Open("pgx", cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.ConnMaxLifetime)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := db.PingContext(pingCtx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}
	return db, nil
}
```

`sql.Open` 不会立刻建立连接，所以启动时要 `PingContext`。如果数据库连不上，应在服务启动阶段失败，而不是等第一个用户请求进来才暴露问题。

创建 `api/internal/repository/postgres.go`：

```go title="api/internal/repository/postgres.go"
package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	"cloud-native-todo-platform/api/internal/model"
)

// PostgresRepository stores Todos in PostgreSQL.
type PostgresRepository struct {
	db *sql.DB
}

var _ interface {
	List(context.Context, model.Status) ([]model.Todo, error)
	Get(context.Context, int) (model.Todo, error)
	Create(context.Context, string) (model.Todo, error)
	Update(context.Context, int, string) (model.Todo, error)
	MarkDone(context.Context, int) (model.Todo, error)
	Delete(context.Context, int) error
} = (*PostgresRepository)(nil)

// NewPostgresRepository creates a PostgreSQL-backed repository.
func NewPostgresRepository(db *sql.DB) *PostgresRepository {
	return &PostgresRepository{db: db}
}

// List returns Todos filtered by status. An empty status means no filter.
func (r *PostgresRepository) List(ctx context.Context, status model.Status) ([]model.Todo, error) {
	query := `
SELECT id, title, status, created_at, updated_at
FROM todos
ORDER BY id`
	args := []any(nil)

	if status != "" {
		query = `
SELECT id, title, status, created_at, updated_at
FROM todos
WHERE status = $1
ORDER BY id`
		args = append(args, string(status))
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query todos: %w", err)
	}
	defer rows.Close()

	items := make([]model.Todo, 0)
	for rows.Next() {
		item, err := scanTodo(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate todos: %w", err)
	}
	return items, nil
}

// Get returns a Todo by ID.
func (r *PostgresRepository) Get(ctx context.Context, id int) (model.Todo, error) {
	query := `
SELECT id, title, status, created_at, updated_at
FROM todos
WHERE id = $1`

	item, err := scanTodo(r.db.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return model.Todo{}, fmt.Errorf("%w: id=%d", ErrNotFound, id)
	}
	if err != nil {
		return model.Todo{}, err
	}
	return item, nil
}

// Create inserts a new pending Todo and writes a created event.
func (r *PostgresRepository) Create(ctx context.Context, title string) (model.Todo, error) {
	var item model.Todo
	err := r.withTx(ctx, func(tx *sql.Tx) error {
		created, err := insertTodo(ctx, tx, title)
		if err != nil {
			return err
		}
		if err := insertEvent(ctx, tx, created.ID, "created"); err != nil {
			return err
		}
		item = created
		return nil
	})
	if err != nil {
		return model.Todo{}, err
	}
	return item, nil
}

// Update changes a Todo title and writes an updated event.
func (r *PostgresRepository) Update(ctx context.Context, id int, title string) (model.Todo, error) {
	var item model.Todo
	err := r.withTx(ctx, func(tx *sql.Tx) error {
		updated, err := updateTodoTitle(ctx, tx, id, title)
		if err != nil {
			return err
		}
		if err := insertEvent(ctx, tx, updated.ID, "updated"); err != nil {
			return err
		}
		item = updated
		return nil
	})
	if err != nil {
		return model.Todo{}, err
	}
	return item, nil
}

// MarkDone marks a Todo as done and writes a done event.
func (r *PostgresRepository) MarkDone(ctx context.Context, id int) (model.Todo, error) {
	var item model.Todo
	err := r.withTx(ctx, func(tx *sql.Tx) error {
		done, err := markTodoDone(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := insertEvent(ctx, tx, done.ID, "done"); err != nil {
			return err
		}
		item = done
		return nil
	})
	if err != nil {
		return model.Todo{}, err
	}
	return item, nil
}

// Delete removes a Todo and writes a deleted event in the same transaction.
func (r *PostgresRepository) Delete(ctx context.Context, id int) error {
	return r.withTx(ctx, func(tx *sql.Tx) error {
		if err := ensureTodoExists(ctx, tx, id); err != nil {
			return err
		}
		if err := insertEvent(ctx, tx, id, "deleted"); err != nil {
			return err
		}

		result, err := tx.ExecContext(ctx, `DELETE FROM todos WHERE id = $1`, id)
		if err != nil {
			return fmt.Errorf("delete todo: %w", err)
		}
		affected, err := result.RowsAffected()
		if err != nil {
			return fmt.Errorf("read delete rows affected: %w", err)
		}
		if affected == 0 {
			return fmt.Errorf("%w: id=%d", ErrNotFound, id)
		}
		return nil
	})
}

func (r *PostgresRepository) withTx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	})
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}

	if err := fn(tx); err != nil {
		if rollbackErr := tx.Rollback(); rollbackErr != nil {
			return fmt.Errorf("rollback after %v: %w", err, rollbackErr)
		}
		return err
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}
	return nil
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanTodo(row rowScanner) (model.Todo, error) {
	var item model.Todo
	var status string
	if err := row.Scan(&item.ID, &item.Title, &status, &item.CreatedAt, &item.UpdatedAt); err != nil {
		return model.Todo{}, err
	}
	item.Status = model.Status(status)
	return item, nil
}

func insertTodo(ctx context.Context, tx *sql.Tx, title string) (model.Todo, error) {
	query := `
INSERT INTO todos (title, status)
VALUES ($1, 'pending')
RETURNING id, title, status, created_at, updated_at`
	item, err := scanTodo(tx.QueryRowContext(ctx, query, title))
	if err != nil {
		return model.Todo{}, fmt.Errorf("insert todo: %w", err)
	}
	return item, nil
}

func updateTodoTitle(ctx context.Context, tx *sql.Tx, id int, title string) (model.Todo, error) {
	query := `
UPDATE todos
SET title = $2, updated_at = now()
WHERE id = $1
RETURNING id, title, status, created_at, updated_at`
	item, err := scanTodo(tx.QueryRowContext(ctx, query, id, title))
	if errors.Is(err, sql.ErrNoRows) {
		return model.Todo{}, fmt.Errorf("%w: id=%d", ErrNotFound, id)
	}
	if err != nil {
		return model.Todo{}, fmt.Errorf("update todo: %w", err)
	}
	return item, nil
}

func markTodoDone(ctx context.Context, tx *sql.Tx, id int) (model.Todo, error) {
	query := `
UPDATE todos
SET status = 'done', updated_at = now()
WHERE id = $1
RETURNING id, title, status, created_at, updated_at`
	item, err := scanTodo(tx.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return model.Todo{}, fmt.Errorf("%w: id=%d", ErrNotFound, id)
	}
	if err != nil {
		return model.Todo{}, fmt.Errorf("mark todo done: %w", err)
	}
	return item, nil
}

func ensureTodoExists(ctx context.Context, tx *sql.Tx, id int) error {
	var existingID int
	err := tx.QueryRowContext(ctx, `SELECT id FROM todos WHERE id = $1 FOR UPDATE`, id).Scan(&existingID)
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("%w: id=%d", ErrNotFound, id)
	}
	if err != nil {
		return fmt.Errorf("check todo exists: %w", err)
	}
	return nil
}

func insertEvent(ctx context.Context, tx *sql.Tx, todoID int, eventType string) error {
	_, err := tx.ExecContext(ctx, `
INSERT INTO todo_events (todo_id, event_type)
VALUES ($1, $2)`, todoID, eventType)
	if err != nil {
		return fmt.Errorf("insert todo event: %w", err)
	}
	return nil
}
```

这里的核心是事务：`Create`、`Update`、`MarkDone`、`Delete` 都把 Todo 变更和事件写入放在同一个事务里。只要事件写入失败，前面的 Todo 变更也会回滚。

`PostgresRepository` 的编译期断言使用了匿名接口，而不是直接导入 `service.Repository`。这是有意为之：`repository` 是更底层的存储包，直接依赖 `service` 会让依赖方向倒置，并且第 11 篇的 service 包测试会导入 repository，反向导入会造成测试期 import cycle。匿名接口在这里用于验证方法集，同时保持包依赖方向清晰。

创建 `api/internal/repository/postgres_integration_test.go`：

```go title="api/internal/repository/postgres_integration_test.go"
package repository

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	"cloud-native-todo-platform/api/internal/model"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func TestPostgresRepositoryLifecycle(t *testing.T) {
	db := openIntegrationDB(t)
	resetIntegrationSchema(t, db)

	repo := NewPostgresRepository(db)
	ctx := context.Background()

	created, err := repo.Create(ctx, "persist with postgres")
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}
	if created.ID == 0 || created.Status != model.StatusPending {
		t.Fatalf("unexpected created todo: %+v", created)
	}

	updated, err := repo.Update(ctx, created.ID, "persist with PostgreSQL")
	if err != nil {
		t.Fatalf("update todo: %v", err)
	}
	if updated.Title != "persist with PostgreSQL" {
		t.Fatalf("updated title = %q", updated.Title)
	}

	done, err := repo.MarkDone(ctx, created.ID)
	if err != nil {
		t.Fatalf("mark done: %v", err)
	}
	if done.Status != model.StatusDone {
		t.Fatalf("status = %q", done.Status)
	}

	items, err := repo.List(ctx, model.StatusDone)
	if err != nil {
		t.Fatalf("list done: %v", err)
	}
	if len(items) != 1 || items[0].ID != created.ID {
		t.Fatalf("items = %+v", items)
	}

	if err := repo.Delete(ctx, created.ID); err != nil {
		t.Fatalf("delete todo: %v", err)
	}
	if _, err := repo.Get(ctx, created.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("get after delete err = %v, want ErrNotFound", err)
	}

	var events int
	if err := db.QueryRowContext(ctx, `SELECT count(*) FROM todo_events`).Scan(&events); err != nil {
		t.Fatalf("count events: %v", err)
	}
	if events != 4 {
		t.Fatalf("events = %d, want 4", events)
	}
}

func TestPostgresRepositoryHonorsContextCancel(t *testing.T) {
	db := openIntegrationDB(t)
	resetIntegrationSchema(t, db)

	repo := NewPostgresRepository(db)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	_, err := repo.List(ctx, "")
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want context.Canceled", err)
	}
}

func openIntegrationDB(t *testing.T) *sql.DB {
	t.Helper()

	dsn := os.Getenv("TODO_TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("set TODO_TEST_DATABASE_DSN to run PostgreSQL integration tests")
	}
	if os.Getenv("TODO_ALLOW_DATABASE_RESET") != "true" {
		t.Skip("set TODO_ALLOW_DATABASE_RESET=true to allow schema reset")
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		t.Fatalf("ping db: %v", err)
	}
	return db
}

func resetIntegrationSchema(t *testing.T, db *sql.DB) {
	t.Helper()

	// NOTE: Keep this DDL in sync with api/migrations/000001_create_todos.up.sql.
	// A production project should run the same migration tool in tests instead.
	statements := []string{
		`DROP TABLE IF EXISTS todo_events`,
		`DROP TABLE IF EXISTS todos`,
		`DROP TABLE IF EXISTS schema_migrations`,
		`CREATE TABLE schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE TABLE todos (
			id BIGSERIAL PRIMARY KEY,
			title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 120),
			status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE INDEX idx_todos_status ON todos(status)`,
		`CREATE INDEX idx_todos_created_at ON todos(created_at DESC)`,
		`CREATE TABLE todo_events (
			id BIGSERIAL PRIMARY KEY,
			todo_id BIGINT NOT NULL,
			event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'done', 'deleted')),
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE INDEX idx_todo_events_todo_id ON todo_events(todo_id)`,
		`INSERT INTO schema_migrations (version) VALUES ('test_schema')`,
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	for _, statement := range statements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			t.Fatalf("exec %q: %v", statement, err)
		}
	}
}
```

默认 `go test ./api/...` 不会要求本机必须有数据库；没有环境变量时集成测试会跳过。只有显式设置 `TODO_TEST_DATABASE_DSN` 和 `TODO_ALLOW_DATABASE_RESET=true`，测试才会重建测试库中的表。

覆盖 `api/cmd/todo-api/main.go`。本文件会替换第 10、11 篇的同名入口文件，新增 `buildRepository` 函数和数据库/内存双模式切换，其他启动、优雅关闭和 OpenAPI 子命令逻辑保持不变：

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
	"syscall"
	"time"

	ginapi "cloud-native-todo-platform/api/internal/handler/gin"
	"cloud-native-todo-platform/api/internal/database"
	"cloud-native-todo-platform/api/internal/repository"
	"cloud-native-todo-platform/api/internal/service"
)

type config struct {
	addr        string
	databaseDSN string
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

	repo, cleanup, err := buildRepository(ctx, cfg, logger)
	if err != nil {
		logger.Error("repository setup failed", "error", err)
		os.Exit(1)
	}
	defer cleanup()

	svc := service.NewTodoService(repo)
	router := ginapi.NewRouter(svc, logger)

	server := &http.Server{
		Addr:              cfg.addr,
		Handler:           router,
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
		addr:        addr,
		databaseDSN: os.Getenv("TODO_DATABASE_DSN"),
	}
}

func buildRepository(ctx context.Context, cfg config, logger *slog.Logger) (service.Repository, func(), error) {
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
```

这里保留了内存 Repository 作为默认值，是为了让前面章节的基础测试和本地快速启动仍然可用。设置 `TODO_DATABASE_DSN` 后，API 才切换到 PostgreSQL。

### 5.5 执行命令

确认 Go 代理配置。第 7 篇已经设置过 `GOPROXY`，这里再检查一次，避免依赖拉取卡在网络问题上：

```bash
go env GOPROXY
```

拉取 PostgreSQL 驱动并整理依赖。本篇固定 pgx 版本，保证同一批学员拿到一致的依赖；日常探索可以使用 latest，但团队项目应提交明确版本：

```bash
go get github.com/jackc/pgx/v5/stdlib@v5.9.2
go mod tidy
```

启动 PostgreSQL：

```bash
docker compose up -d postgres
docker compose ps
```

等待数据库就绪：

```bash
docker compose exec postgres pg_isready -U todo -d todo_platform
```

执行迁移。`-T` 表示不分配伪终端，更适合脚本化执行 SQL 文件：

```bash
docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
```

查看表和迁移版本：

```bash
docker compose exec postgres psql -U todo -d todo_platform -c "\dt"
docker compose exec postgres psql -U todo -d todo_platform -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
```

运行普通测试：

```bash
go test ./api/...
```

运行 PostgreSQL 集成测试：

```bash
docker compose exec postgres createdb -U todo -O todo todo_platform_test || true
TODO_TEST_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform_test?sslmode=disable' TODO_ALLOW_DATABASE_RESET=true go test ./api/internal/repository -run Postgres -count=1
```

`postgres_integration_test.go` 会重建测试库中的 `todos`、`todo_events` 和 `schema_migrations`。因此这里使用独立的 `todo_platform_test`，不要把 `TODO_TEST_DATABASE_DSN` 指向你想保留数据的开发库。

构建 API：

```bash
go build -o bin/todo-api ./api/cmd/todo-api
```

启动 PostgreSQL 版 API：

```bash
TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable' TODO_API_ADDR=127.0.0.1:18080 ./bin/todo-api
```

另开一个终端，创建并查询 Todo：

```bash
curl -s -X POST http://127.0.0.1:18080/api/v2/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"persist with PostgreSQL"}'

curl -s http://127.0.0.1:18080/api/v2/todos
```

停止 API 后重新启动，再次查询：

```bash
curl -s http://127.0.0.1:18080/api/v2/todos
```

如果重启后还能看到刚才创建的 Todo，说明数据已经持久化到 PostgreSQL。

### 5.6 预期输出

迁移执行后，`\dt` 输出类似：

```text
              List of relations
 Schema |       Name        | Type  | Owner
--------+-------------------+-------+-------
 public | schema_migrations | table | todo
 public | todo_events       | table | todo
 public | todos             | table | todo
```

迁移版本查询输出类似：

```text
       version        |          applied_at
----------------------+-------------------------------
 000001_create_todos  | 2026-05-28 10:00:00.000000+00
```

集成测试通过时，输出类似：

```text
ok  	cloud-native-todo-platform/api/internal/repository	0.42s
```

API 启动日志中应能看到：

```json
{"level":"INFO","msg":"using postgres repository"}
{"level":"INFO","msg":"todo api starting","addr":"127.0.0.1:18080"}
```

### 5.7 验证方法

验证数据库表存在：

```bash
docker compose exec postgres psql -U todo -d todo_platform -c "\d todos"
```

验证事件记录：

```bash
docker compose exec postgres psql -U todo -d todo_platform -c "SELECT todo_id, event_type FROM todo_events ORDER BY id;"
```

验证状态索引可能被使用：

```bash
docker compose exec postgres psql -U todo -d todo_platform -c "EXPLAIN SELECT id, title, status FROM todos WHERE status = 'pending' ORDER BY id;"
```

验证没有设置数据库时仍能使用内存模式：

```bash
TODO_API_ADDR=127.0.0.1:18080 ./bin/todo-api
```

这时日志应显示 `using memory repository`。

### 5.8 清理步骤

停止 API 后，停止数据库容器但保留数据卷：

```bash
docker compose down
```

如果你要彻底删除本篇数据库数据：

```bash
docker compose down -v
```

`-v` 会删除数据卷，Todo 数据会丢失。只有确认不需要保留本地实验数据时再执行。

预计耗时：20 分钟阅读，70 分钟动手实验。

## 6. 常见错误与排障

### 错误 1：`connection refused`

- **现象**：

  ```text
  dial tcp 127.0.0.1:5432: connect: connection refused
  ```

- **原因**：PostgreSQL 容器没有启动、端口没有映射，或服务还没 ready。
- **排查**：

  ```bash
  docker compose ps
  docker compose logs postgres
  docker compose exec postgres pg_isready -U todo -d todo_platform
  ```

- **修复**：先启动数据库，等待健康检查通过后再运行迁移或 API。
- **预防**：在启动 API 前先执行 `pg_isready`。

### 错误 2：`password authentication failed`

- **现象**：

  ```text
  password authentication failed for user "todo"
  ```

- **原因**：DSN 中用户名、密码、数据库名和 `docker-compose.yml` 不一致。
- **排查**：

  ```bash
  echo "$TODO_DATABASE_DSN"
  docker compose exec postgres psql -U todo -d todo_platform -c "SELECT current_user;"
  ```

- **修复**：使用本篇统一 DSN：

  ```bash
  postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable
  ```

- **预防**：不要手工记多个密码；本地实验统一从 Compose 文件复制。

### 错误 3：`relation "todos" does not exist`

- **现象**：

  ```text
  ERROR: relation "todos" does not exist
  ```

- **原因**：数据库已启动，但还没有执行迁移。
- **排查**：

  ```bash
  docker compose exec postgres psql -U todo -d todo_platform -c "\dt"
  ```

- **修复**：

  ```bash
  docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
  ```

- **预防**：把迁移作为启动前的固定步骤。后续进入容器化和 CI/CD 时，迁移应由单独 job 或发布流程控制。

### 错误 4：集成测试被跳过

- **现象**：

  ```text
  set TODO_TEST_DATABASE_DSN to run PostgreSQL integration tests
  ```

- **原因**：本篇故意让普通 `go test ./api/...` 不依赖数据库；只有设置环境变量才跑集成测试。
- **排查**：

  ```bash
  echo "$TODO_TEST_DATABASE_DSN"
  echo "$TODO_ALLOW_DATABASE_RESET"
  ```

- **修复**：

  ```bash
  docker compose exec postgres createdb -U todo -O todo todo_platform_test || true
  TODO_TEST_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform_test?sslmode=disable' TODO_ALLOW_DATABASE_RESET=true go test ./api/internal/repository -run Postgres -count=1
  ```

- **预防**：数据库集成测试要显式启用，避免误删开发库或共享库。

### 错误 5：API 仍然使用内存存储

- **现象**：服务重启后 Todo 消失，或者日志显示 `using memory repository`。
- **原因**：没有设置 `TODO_DATABASE_DSN`。
- **排查**：

  ```bash
  echo "$TODO_DATABASE_DSN"
  ```

- **修复**：启动 API 时带上数据库 DSN。
- **预防**：用启动脚本或 `.env` 模板管理本地环境变量，不要每次手敲。

## 7. 生产环境注意事项

1. **迁移和审计结构必须纳入发布流程**。本篇用 `psql -f` 是为了教学透明，生产环境不要让开发临时手工改库。迁移应有版本、审核、执行日志和回滚方案，并且要区分向前兼容变更和破坏性变更。审计表也要在设计阶段保存必要快照，例如操作者、请求 ID、变更前后值和来源服务，避免主表删除后审计信息失去上下文。

2. **连接池不是越大越好**。API 的 `MaxOpenConns` 要和 PostgreSQL 的最大连接数、API 副本数、查询耗时一起设计。多个 API 副本同时把连接池开得过大，会把数据库连接打满，导致所有服务一起变慢。

3. **事务要短而清晰**。事务中不要做外部 HTTP 调用、长时间计算、文件处理或等待用户输入。事务越长，持有锁的时间越长，越容易影响其他请求。把必须保持一致的数据库写操作放进事务即可。

4. **索引要基于查询路径设计**。本篇按 `status` 查询，所以创建 `idx_todos_status`。如果后续按创建时间分页、按用户过滤、按关键词搜索，索引设计也要跟着变化。不要看到慢查询就盲目加索引，先看 `EXPLAIN ANALYZE`。

5. **集成测试和错误信息都要隔离风险**。本篇用 `todo_platform_test` 跑会重置 schema 的测试，避免误删开发库。生产团队通常会让 CI 为每次测试创建临时数据库、临时 schema 或容器化数据库实例，测试结束后整体销毁。服务端日志可以记录数据库错误细节，但 HTTP 响应不要暴露 SQL、表名、连接串或内部结构。

## 8. 本章小项目

本章小项目是 **Todo API v3 PostgreSQL 持久化**。项目目标是在不改变 HTTP API 契约的前提下，把 Todo 数据从内存切换到 PostgreSQL，让数据在服务重启后仍然存在，并用事务记录 Todo 事件。

交付物包括：

- `docker-compose.yml`
- `api/migrations/000001_create_todos.up.sql`
- `api/migrations/000001_create_todos.down.sql`
- `api/internal/database/postgres.go`
- `api/internal/repository/postgres.go`
- `api/internal/repository/postgres_integration_test.go`
- 更新后的 `api/cmd/todo-api/main.go`

能力验收标准：

- 能启动 PostgreSQL 18 并执行迁移。
- 能解释 `todos` 和 `todo_events` 的字段、约束和索引。
- 能运行 PostgreSQL 集成测试。
- 能启动 `TODO_DATABASE_DSN=... ./bin/todo-api` 并完成 Todo CRUD。
- 能停止并重启 API 后确认 Todo 数据仍然存在。
- 能说明事务如何保证 Todo 变更和事件记录一致。

## 9. 本章练习题

### 9.1 基础题

1. PostgreSQL 相比进程内存存储解决了哪些问题？
2. `*sql.DB` 是单个连接还是连接池？为什么不能每个请求都 `sql.Open`？
3. `TIMESTAMPTZ` 和普通字符串保存时间相比有什么优势？
4. `RETURNING` 在 PostgreSQL 中有什么作用？
5. 为什么数据库约束不能完全被服务层校验替代？

### 9.2 实操题

1. 给 `todos` 表增加 `priority` 字段，允许值为 `low`、`normal`、`high`，默认 `normal`。不要修改已有 `000001` 迁移，新增 `000002_add_todo_priority.up.sql` 和对应 down 迁移。验收标准：迁移 SQL、Repository 查询和集成测试都能通过。
2. 给列表接口增加按 `created_at DESC` 排序的 Repository 方法。验收标准：插入 3 条 Todo 后，测试能验证最新创建的 Todo 排在前面。
3. 给 `todo_events` 增加 `request_id` 字段。验收标准：迁移文件包含字段，事件插入 SQL 能写入固定测试值。

### 9.3 思考题

1. 如果 `MarkDone` 已经把 Todo 改成 `done`，但写事件失败，你希望 API 返回成功还是失败？为什么？
2. 如果 API 副本数从 1 个增加到 10 个，数据库连接池参数应该如何重新评估？

## 10. 本章面试题

### 面试题 1：为什么生产后端服务通常不用本地文件或内存保存核心数据？

**一句话结论**：因为本地文件和内存无法可靠支持多实例、并发写入、复杂查询、事务和运维能力。

**展开解释**：内存重启就丢，文件很难处理并发写和多副本共享。数据库提供表结构、约束、索引、事务、备份恢复、权限和监控，是生产服务保存核心业务数据的标准选择。

**深入追问**：不是所有数据都必须进关系型数据库。缓存、日志、对象文件、搜索索引各有系统承载，但订单、用户、权限、Todo 这类结构化核心数据通常应进入数据库。

### 面试题 2：`database/sql` 中的 `*sql.DB` 是什么？

**一句话结论**：`*sql.DB` 是并发安全的连接池句柄，不是单条连接。

**展开解释**：应用启动时创建一个 `*sql.DB` 并复用。每次查询、执行或事务会从池里借用连接。可以通过 `SetMaxOpenConns`、`SetMaxIdleConns`、`SetConnMaxLifetime` 控制连接数量和生命周期。

**深入追问**：如果每个请求都 `sql.Open`，会造成连接资源浪费、认证开销增加、数据库连接数失控，还会让排障变复杂。

### 面试题 3：事务解决什么问题？

**一句话结论**：事务保证一组数据库操作要么全部提交，要么全部回滚。

**展开解释**：本篇 `MarkDone` 同时更新 Todo 状态和写入事件。如果没有事务，可能状态已经变成 `done`，但事件写入失败。放进同一个事务后，任何一步失败都会回滚，数据保持一致。

**深入追问**：事务不是越大越好。事务越长，锁持有时间越长。生产中应把事务边界控制在必须一致的数据库操作范围内。

### 面试题 4：GORM、sqlc 和 `database/sql` 如何选择？

**一句话结论**：看团队对 SQL 控制力、开发效率和类型安全的权衡。

**展开解释**：`database/sql` 适合学习底层机制和核心路径，SQL 明确但样板代码多。GORM 开发快，适合 CRUD 较多的后台系统，但要理解它生成的 SQL。sqlc 基于手写 SQL 生成类型安全代码，适合 SQL 复杂且团队愿意维护 SQL 文件的项目。

**深入追问**：无论选哪种工具，都不能绕过数据库基本功。索引、事务、连接池、慢查询和迁移风险仍然需要工程师理解。

### 面试题 5：数据库迁移为什么不能随便手工执行？

**一句话结论**：因为数据库结构是生产状态的一部分，必须可追踪、可审查、可重复和可回滚。

**展开解释**：手工改库容易遗漏环境、执行顺序不可追踪，也很难知道线上到底执行了哪些变更。迁移文件用版本记录结构变化，能让开发、测试、生产环境保持一致。

**深入追问**：破坏性迁移要特别谨慎，例如删除字段、重写大表、添加非空字段。常见做法是分阶段上线：先加兼容字段，再改代码写入，最后清理旧字段。

## 11. 本章总结

本篇把 Todo API 从内存存储升级到了 PostgreSQL 持久化。你设计了 `todos` 和 `todo_events` 两张表，编写了 up/down 迁移脚本，使用 Docker Compose 启动 PostgreSQL 18，并通过 `database/sql` + pgx 实现了 PostgreSQL Repository。

工程结构上，Handler 和 Service 基本不变，只有 Repository 实现被替换。这说明前面几篇坚持接口分层是有价值的：当底层基础设施从内存变成数据库时，上层 API 契约仍然稳定。事务部分让 Todo 变更和事件记录保持一致，集成测试则保证数据库路径不是“只在脑子里正确”。

能力价值上，你已经具备了后端工程师最常见的数据层能力：建表、写 SQL、设计索引、管理迁移、配置连接池、处理事务和编写数据库集成测试。后续进入 Redis、Docker 和 Kubernetes 时，PostgreSQL 会继续作为 Todo Platform 的核心依赖存在。

## 12. 下一章衔接

第 13 篇会在 PostgreSQL 持久化的基础上引入 Redis。数据库适合保存权威数据，但高频读取、限流计数、短期缓存和简单异步任务更适合交给 Redis 这类内存数据系统处理。

学完本篇后，你已经能把数据可靠写入 PostgreSQL；下一篇会继续解决“读得更快、挡住突发流量、把部分任务异步化”的问题。
