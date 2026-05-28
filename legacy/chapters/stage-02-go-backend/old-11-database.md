# 第 11 篇：数据库与持久化开发

本篇进入 Go 后端服务最核心的生产能力之一：**关系型数据库持久化**。

第 10 篇已经完成 Todo Platform API v1，但数据仍然保存在本地 JSON 文件中。文件存储适合教学和单机实验，却不适合生产后端服务：多实例无法共享数据，并发写入容易互相覆盖，查询能力也很弱。

本篇会把 Todo 平台的数据层迁移到 PostgreSQL，学习表设计、SQL、索引、事务、Go 数据库访问和数据库迁移。

本篇特色项目是：**为 Todo 平台接入 PostgreSQL 持久化**。

## 1. 本章学习目标

学完本篇后，你应该能够：

- 理解关系型数据库解决什么问题，以及为什么云原生后端服务通常需要数据库。
- 能为 Todo 业务设计 PostgreSQL 表结构、字段类型、约束和索引。
- 能编写常见 SQL CRUD 语句，并理解 `WHERE`、`ORDER BY`、`LIMIT`、索引和执行计划。
- 能使用 Go 标准库 `database/sql` 访问 PostgreSQL。
- 能理解 GORM、sqlc、`database/sql` 的差异和适用场景。
- 能用事务保证 Todo 状态变更和事件记录的一致性。
- 能用迁移文件和迁移版本记录管理数据库结构变化。
- 能把第 10 篇的 Todo API 从文件存储切换到 PostgreSQL 存储。

本篇完成后，Todo Platform 会从“能对外提供 API”升级为“能可靠持久化数据的后端服务”。

## 2. 本章工作场景

在真实公司中，后端服务几乎都会遇到数据库相关工作。

典型场景包括：

- 开发 Todo、订单、用户、权限、审计日志等需要长期保存的数据。
- 为 API 设计表结构，确保字段类型、约束和索引能支撑业务查询。
- 排查接口变慢，判断是代码慢、SQL 慢、索引缺失，还是数据库连接池耗尽。
- 在版本发布时执行数据库迁移，把新字段、新索引和新表安全上线。
- 在多个 API 操作之间保持一致性，例如“修改状态”和“写入审计事件”必须同时成功或同时失败。
- 和 DBA、SRE、测试、前端一起对齐数据模型、查询路径和上线风险。

本篇的 Todo 平台会模拟一个真实工作场景：

> 产品要求 Todo 数据不能再写入本地文件，而是要进入 PostgreSQL。后端需要设计表、编写迁移、实现数据库 Repository、保证事务一致性，并让原有 HTTP API 基本不变。

这正是企业后端开发中常见的演进方式：**对外 API 尽量稳定，对内持久化层逐步生产化**。

## 3. 前置知识

学习本篇前，必须掌握：

- 第 7 篇的 Go 结构体、方法、interface、error。
- 第 8 篇的 `context`，尤其是超时、取消和资源释放。
- 第 9 篇的项目目录结构、配置、日志和测试。
- 第 10 篇的 Todo API、Service、Repository、Handler 分层。
- 基础 Linux 命令和 Docker 基础命令。

建议了解：

- SQL 的基本语法。
- Docker Compose 的基本用途。
- 关系型数据库中的主键、外键、索引、事务。

如果你从未接触过数据库，不要紧。本篇会从表、行、列、SQL 语句开始讲，但会始终保持和真实后端开发场景连接。

## 4. 核心概念

### 4.1 为什么需要数据库

第 10 篇的 Todo API 使用 JSON 文件存储。它有几个明显问题：

- 多个 API 实例无法共享同一份本地文件。
- 并发写入时可能覆盖数据。
- 查询只能把所有 Todo 读出来再过滤。
- 没有事务，多个操作无法保证同时成功。
- 没有成熟的备份、恢复、权限、监控和复制能力。

数据库就是为这些问题而生的。

PostgreSQL 能提供：

- 结构化表设计。
- SQL 查询能力。
- 主键、唯一约束、检查约束。
- 索引加速查询。
- 事务和隔离级别。
- 连接池、权限、备份、恢复和复制能力。

在 Todo 平台中，数据库会负责保存 Todo 的标题、状态、创建时间、更新时间和事件记录。

### 4.2 表、行、列和主键

关系型数据库中的核心对象是表。

Todo 表可以这样理解：

| id | title | status | created_at | updated_at |
|---|---|---|---|---|
| 1 | learn PostgreSQL | pending | 2026-05-26 10:00:00 | 2026-05-26 10:00:00 |
| 2 | write SQL tests | done | 2026-05-26 10:05:00 | 2026-05-26 10:20:00 |

解释：

- 表：`todos`。
- 行：一条 Todo 数据。
- 列：`id`、`title`、`status` 等字段。
- 主键：`id`，用于唯一标识一行数据。

Todo 平台中的 `id` 会使用 PostgreSQL 的 `BIGSERIAL` 自动生成。

### 4.3 字段类型和约束

字段类型决定数据怎么保存，约束决定什么数据允许写入。

Todo 表中的关键字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `BIGSERIAL` | 自增主键 |
| `title` | `TEXT` | Todo 标题 |
| `status` | `TEXT` | Todo 状态 |
| `created_at` | `TIMESTAMPTZ` | 创建时间，带时区 |
| `updated_at` | `TIMESTAMPTZ` | 更新时间，带时区 |

关键约束：

```sql
status TEXT NOT NULL CHECK (status IN ('pending', 'done'))
```

这条约束的意思是：`status` 不能为空，并且只能是 `pending` 或 `done`。

为什么需要数据库约束？

因为后端代码会变，调用方也可能绕过 API 直接写库。数据库约束是最后一道防线。业务校验应该写在 Go 服务层，关键一致性约束也应该写在数据库层。

### 4.4 SQL CRUD

CRUD 是后端最常见的数据操作：

| 动作 | SQL | Todo 场景 |
|---|---|---|
| Create | `INSERT` | 创建 Todo |
| Read | `SELECT` | 查询 Todo |
| Update | `UPDATE` | 修改标题、标记完成 |
| Delete | `DELETE` | 删除 Todo |

示例：

```sql
INSERT INTO todos (title, status)
VALUES ('learn PostgreSQL', 'pending')
RETURNING id, title, status, created_at, updated_at;
```

`RETURNING` 是 PostgreSQL 的常用能力，它可以在插入或更新后直接返回新数据，避免再查一次。

### 4.5 索引

索引可以让数据库更快找到数据。

Todo API 中常见查询是：

```sql
SELECT id, title, status, created_at, updated_at
FROM todos
WHERE status = 'pending'
ORDER BY id;
```

如果数据很多，没有索引时数据库可能扫描整张表。给 `status` 建索引后，数据库可以更快定位 `pending` 或 `done` 的数据。

本篇会创建：

```sql
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_created_at ON todos(created_at DESC);
```

索引不是越多越好。索引会加快查询，但会增加写入成本和磁盘占用。生产中要根据真实查询路径设计索引。

### 4.6 事务

事务用于保证多个数据库操作要么全部成功，要么全部失败。

Todo 平台中，标记完成时我们希望同时做两件事：

1. 把 `todos.status` 改为 `done`。
2. 往 `todo_events` 写一条 `done` 事件。

如果第 1 步成功，第 2 步失败，系统就会出现“状态已完成，但没有事件记录”的不一致。

事务可以解决这个问题：

```sql
BEGIN;

UPDATE todos
SET status = 'done', updated_at = now()
WHERE id = 1;

INSERT INTO todo_events (todo_id, event_type)
VALUES (1, 'done');

COMMIT;
```

如果中间任何一步失败，就执行：

```sql
ROLLBACK;
```

Go 中使用 `db.BeginTx` 开启事务，用 `tx.Commit` 提交，用 `tx.Rollback` 回滚。

### 4.7 `database/sql`、GORM 和 sqlc

Go 访问数据库常见方式有三类：

| 方式 | 特点 | 适合场景 |
|---|---|---|
| `database/sql` | 标准库接口，显式 SQL，控制力强 | 学习底层机制、生产核心路径 |
| GORM | ORM，开发效率高，结构体映射方便 | 后台管理系统、CRUD 较多的业务 |
| sqlc | 根据 SQL 生成类型安全 Go 代码 | SQL 较复杂、团队希望强约束 |

本篇使用 `database/sql` + `pgx` 驱动，原因是：

- 学习者能直接理解 SQL 和事务。
- 代码不被 ORM 细节遮住。
- 后续学习 GORM 或 sqlc 时更容易判断它们解决了什么问题。

本篇不会贬低 ORM。企业项目中 GORM 和 sqlc 都很常见，关键是团队要理解 SQL、事务、索引和连接池，而不是只会调用框架方法。

## 5. 原理深入

### 5.1 API 到数据库的调用链路

接入 PostgreSQL 后，请求链路会变成：

```mermaid
sequenceDiagram
    participant Client as HTTP Client
    participant Handler as Todo Handler
    participant Service as Todo Service
    participant Repo as Postgres Repository
    participant Pool as database/sql Pool
    participant PG as PostgreSQL

    Client->>Handler: POST /api/v1/todos
    Handler->>Service: Create(ctx, title)
    Service->>Repo: Add(ctx, title)
    Repo->>Pool: QueryRowContext
    Pool->>PG: INSERT ... RETURNING
    PG-->>Pool: row
    Pool-->>Repo: scan Item
    Repo-->>Service: Item
    Service-->>Handler: Item
    Handler-->>Client: 201 JSON
```

关键点：

- Handler 不直接写 SQL。
- Service 不关心 PostgreSQL 连接细节。
- Repository 负责把业务对象和 SQL 结果相互转换。
- `database/sql` 负责连接池、连接复用和执行 SQL。

### 5.2 连接池不是普通连接

`*sql.DB` 不是一个单独连接，而是一个连接池句柄。

这意味着：

- 不应该每个请求都 `sql.Open`。
- 应该在应用启动时创建一次 `*sql.DB`。
- 应该配置最大连接数、空闲连接数和连接生命周期。
- 应用退出时调用 `db.Close()`。

本篇会设置：

```go
database.SetMaxOpenConns(10)
database.SetMaxIdleConns(5)
database.SetConnMaxLifetime(30 * time.Minute)
database.SetConnMaxIdleTime(5 * time.Minute)
```

这些数字不是生产标准答案，只是适合本地实验的保守值。生产环境要结合 API 并发、数据库规格、慢查询和连接池指标调整。

### 5.3 查询为什么要带 `context`

数据库查询可能因为网络、锁等待、慢 SQL 等原因变慢。

如果请求已经超时或客户端断开，后端还继续执行数据库查询，就会浪费资源。

因此 Go 数据库访问应该优先使用：

- `QueryContext`
- `QueryRowContext`
- `ExecContext`
- `BeginTx`

这些方法能接收 `context.Context`，让 HTTP 请求超时、服务关闭和数据库操作形成一条取消链路。

### 5.4 事务和隔离级别

事务有四个常见特性，简称 ACID：

| 特性 | 含义 |
|---|---|
| Atomicity | 原子性，全部成功或全部失败 |
| Consistency | 一致性，事务前后数据满足约束 |
| Isolation | 隔离性，并发事务之间互相隔离 |
| Durability | 持久性，提交后数据不会随意丢失 |

隔离级别决定并发事务之间能看到什么数据。

PostgreSQL 常见隔离级别：

| 隔离级别 | 说明 |
|---|---|
| `Read Committed` | 默认级别，每条语句只能看到已提交数据 |
| `Repeatable Read` | 同一事务中多次查询看到一致快照 |
| `Serializable` | 最严格，像串行执行，但可能需要重试 |

Todo 平台大多数操作使用默认 `Read Committed` 就足够。涉及余额、库存、配额这类强一致业务时，必须更谨慎地设计锁、隔离级别和重试策略。

### 5.5 数据库迁移为什么必须版本化

数据库结构也是代码的一部分。

如果只在本地手动执行 SQL，团队很快会遇到问题：

- 开发环境和测试环境表结构不一致。
- 不知道线上执行过哪些 SQL。
- 回滚版本时不知道如何撤销字段或索引。
- 新同事无法一键创建相同数据库结构。

迁移文件的目标是让数据库结构变化可追踪、可复现、可审查。

常见命名：

```text
migrations/
  000001_create_todos.up.sql
  000001_create_todos.down.sql
```

本篇会用 SQL 迁移文件管理 Todo 表结构，并增加一个最小的 `schema_migrations` 表记录已执行版本。

需要注意：手工执行 `psql -f` 适合教学和本地实验，它能帮助你理解迁移文件背后的原理。真实团队通常会使用 `golang-migrate`、Flyway、Liquibase 或平台内置迁移工具，由工具负责记录版本、避免重复执行、控制回滚流程。

本篇先掌握迁移文件和版本表的思想，后续 CI/CD 阶段可以把迁移纳入发布流水线。

## 6. 手把手实验

### 6.1 实验目标

本实验会完成以下工作：

- 使用 Docker Compose 启动 PostgreSQL 18。
- 编写 Todo 数据库迁移 SQL。
- 使用 `psql` 执行迁移，并记录迁移版本。
- 给 Go 项目增加数据库配置。
- 使用 `database/sql` + `pgx` 连接 PostgreSQL。
- 实现 `PostgresStore` 替换文件存储。
- 在事务中完成 Todo 状态变更和事件写入。
- 更新应用启动逻辑，让 Todo API 可以使用 PostgreSQL。
- 编写带安全保护的数据库集成测试。

### 6.2 实验环境

需要准备：

- Go 1.24 或更新版本；如果是新安装环境，优先使用 Go 官方当前稳定版。
- Docker Desktop 或 Docker Engine。
- Docker Compose v2。
- 已完成第 10 篇代码。

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

预期能看到 Go、Docker 和 Docker Compose 的版本。如果 Docker 没有启动，先打开 Docker Desktop。

本篇固定使用 PostgreSQL 18 的补丁版本镜像：

```text
postgres:18.4-alpine
```

固定补丁版本可以减少“昨天还能运行、今天镜像内容变化”的问题。后续生产环境也建议固定镜像版本，再由团队按发布节奏升级。

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
│   ├── config/
│   │   ├── config.go
│   │   └── config_test.go
│   ├── db/
│   │   └── db.go
│   └── todo/
│       ├── postgres_store.go
│       ├── postgres_store_test.go
│       ├── service.go
│       └── store.go
├── migrations/
│   ├── 000001_create_todos.up.sql
│   └── 000001_create_todos.down.sql
├── docker-compose.yml
├── Makefile
└── scripts/
    └── verify.ps1
```

### 6.4 启动 PostgreSQL

创建 `docker-compose.yml`：

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

volumes:
  todo-postgres-data:
```

关键字段说明：

- `image`：使用 PostgreSQL 18.4 Alpine 镜像，固定补丁版本便于复现。
- `environment`：设置数据库用户名、密码和默认数据库。
- `PGDATA`：显式声明 PostgreSQL 18 镜像的数据目录。
- `ports`：把容器内 `5432` 暴露到本机 `5432`。
- `volumes`：保存数据库数据，并把本地迁移目录挂载进容器。
- `healthcheck`：用 `pg_isready` 判断数据库是否可连接。

PostgreSQL 官方 Docker 镜像从 18 开始把默认 `PGDATA` 调整为版本相关路径，例如 `/var/lib/postgresql/18/docker`。因此本篇把数据卷挂载到 `/var/lib/postgresql`，而不是旧版本常见的 `/var/lib/postgresql/data`。这样做能避免学员后续重建容器时误以为数据已经持久化，实际却写到了另一个位置。

启动数据库：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose up -d postgres
    docker compose ps
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose up -d postgres
    docker compose ps
    ```

预期看到 `todo-postgres` 处于 `running` 或 `healthy` 状态。

### 6.5 编写数据库迁移

创建目录：

=== "Linux / macOS / WSL2"

    ```bash
    mkdir -p migrations
    ```

=== "Windows PowerShell"

    ```powershell
    New-Item -ItemType Directory -Force migrations | Out-Null
    ```

创建 `migrations/000001_create_todos.up.sql`：

```sql title="migrations/000001_create_todos.up.sql"
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS todos (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    status TEXT NOT NULL CHECK (status IN ('pending', 'done')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todos_status ON todos(status);
CREATE INDEX IF NOT EXISTS idx_todos_created_at ON todos(created_at DESC);

CREATE TABLE IF NOT EXISTS todo_events (
    id BIGSERIAL PRIMARY KEY,
    todo_id BIGINT REFERENCES todos(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'done', 'deleted')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_todo_events_todo_id ON todo_events(todo_id);

INSERT INTO schema_migrations (version)
VALUES ('000001_create_todos')
ON CONFLICT (version) DO NOTHING;
```

创建 `migrations/000001_create_todos.down.sql`：

```sql title="migrations/000001_create_todos.down.sql"
DELETE FROM schema_migrations WHERE version = '000001_create_todos';
DROP TABLE IF EXISTS todo_events;
DROP TABLE IF EXISTS todos;
```

设计说明：

- `todos` 保存 Todo 主数据。
- `todo_events` 保存 Todo 事件，模拟真实系统中的审计或业务事件。
- `schema_migrations` 记录已执行迁移版本，让数据库结构变化可追踪。
- `status` 使用检查约束，防止写入非法状态。
- `title` 使用检查约束，防止写入空标题。
- `todo_events.todo_id` 使用 `ON DELETE SET NULL`，删除 Todo 后事件仍然保留；如果是审计级系统，通常还会保留不可变业务 ID 或采用软删除，避免删除后丢失直接关联。
- `idx_todos_status` 支撑按状态过滤。
- `idx_todos_created_at` 支撑按创建时间倒序查看。

### 6.6 执行迁移

先确认数据库已经 ready：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres pg_isready -U todo -d todo_platform
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres pg_isready -U todo -d todo_platform
    ```

执行 up 迁移：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
    ```

查看表：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "\dt"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "\dt"
    ```

预期看到：

```text
schema_migrations
todos
todo_events
```

查看迁移版本：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
    ```

预期能看到 `000001_create_todos`。这说明迁移不只是“执行了一段 SQL”，而是留下了可查询的版本记录。

查看索引：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "\di"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "\di"
    ```

如果要回滚本次迁移：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.down.sql
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.down.sql
    ```

回滚会删除表和数据，只能在本地实验或明确的回滚窗口中执行。生产环境回滚迁移前必须先确认数据是否可恢复，不能把 `down.sql` 当成无风险撤销按钮。

### 6.7 手写 SQL 验证 CRUD

插入 Todo：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "INSERT INTO todos (title, status) VALUES ('learn PostgreSQL', 'pending') RETURNING id, title, status;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "INSERT INTO todos (title, status) VALUES ('learn PostgreSQL', 'pending') RETURNING id, title, status;"
    ```

查询 Todo：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT id, title, status FROM todos ORDER BY id;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT id, title, status FROM todos ORDER BY id;"
    ```

更新 Todo：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "UPDATE todos SET status = 'done', updated_at = now() WHERE id = 1 RETURNING id, title, status;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "UPDATE todos SET status = 'done', updated_at = now() WHERE id = 1 RETURNING id, title, status;"
    ```

删除实验数据：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "DELETE FROM todos WHERE id = 1;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "DELETE FROM todos WHERE id = 1;"
    ```

这些命令的目的不是替代应用代码，而是让你先确认数据库表结构和 SQL 本身没有问题。真实排障时，也经常会先在 `psql` 中验证 SQL，再回到 Go 代码定位问题。

### 6.8 查看执行计划

插入几条数据：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "INSERT INTO todos (title, status) SELECT 'todo-' || g, CASE WHEN g % 2 = 0 THEN 'done' ELSE 'pending' END FROM generate_series(1, 20) AS g;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "INSERT INTO todos (title, status) SELECT 'todo-' || g, CASE WHEN g % 2 = 0 THEN 'done' ELSE 'pending' END FROM generate_series(1, 20) AS g;"
    ```

查看执行计划：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "EXPLAIN SELECT id, title, status FROM todos WHERE status = 'pending' ORDER BY id;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "EXPLAIN SELECT id, title, status FROM todos WHERE status = 'pending' ORDER BY id;"
    ```

判断依据：

- 如果看到 `Seq Scan`，表示顺序扫描。小表中这很正常，不一定是问题。
- 如果看到 `Index Scan` 或 `Bitmap Index Scan`，表示使用了索引。
- PostgreSQL 会根据表大小、统计信息、过滤条件决定是否使用索引。

不要看到 `Seq Scan` 就盲目加索引。小表顺序扫描可能比走索引更快。

### 6.9 更新 Go module

本篇使用 `pgx` 作为 PostgreSQL 驱动，并通过 `database/sql` 使用它。

修改 `go.mod`：

```go title="go.mod"
module cloud-native-todo-platform

go 1.24

require (
	github.com/go-chi/chi/v5 v5.3.0
	github.com/jackc/pgx/v5 v5.9.2
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

### 6.10 增加数据库配置

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
	defaultAppName         = "todo-api"
	defaultEnv             = "local"
	defaultHTTPAddr        = ":8080"
	defaultLogLevel        = "info"
	defaultShutdownTimeout = 5 * time.Second
)

type Config struct {
	AppName         string
	Env             string
	HTTPAddr        string
	DataPath        string
	DatabaseDSN     string
	LogLevel        string
	ShutdownTimeout time.Duration
	EnableDebug     bool
}

type fileConfig struct {
	AppName         string `json:"app_name"`
	Env             string `json:"env"`
	HTTPAddr        string `json:"http_addr"`
	DataPath        string `json:"data_path"`
	DatabaseDSN     string `json:"database_dsn"`
	LogLevel        string `json:"log_level"`
	ShutdownTimeout string `json:"shutdown_timeout"`
	EnableDebug     *bool  `json:"enable_debug"`
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
		AppName:         defaultAppName,
		Env:             defaultEnv,
		HTTPAddr:        defaultHTTPAddr,
		DataPath:        defaultDataPath(),
		LogLevel:        defaultLogLevel,
		ShutdownTimeout: defaultShutdownTimeout,
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

- 新增 `DatabaseDSN`。
- 配置文件支持 `database_dsn`。
- 环境变量支持 `TODO_DATABASE_DSN`。
- `Validate` 允许文件存储和数据库存储二选一。

生产环境不要把数据库密码写进普通配置文件。后续 Kubernetes 章节会把数据库连接串放进 Secret。

先创建示例配置 `configs/local.example.json`：

```json title="configs/local.example.json"
{
  "app_name": "todo-api",
  "env": "local",
  "http_addr": ":8080",
  "data_path": ".todo-cli/todos.json",
  "database_dsn": "",
  "log_level": "debug",
  "shutdown_timeout": "5s",
  "enable_debug": true
}
```

示例配置可以提交到 Git 仓库，因为里面没有真实密码。真正运行时建议通过环境变量传入 DSN：

=== "Linux / macOS / WSL2"

    ```bash
    export TODO_CONFIG_FILE=configs/local.example.json
    export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
    ```

=== "Windows PowerShell"

    ```powershell
    $env:TODO_CONFIG_FILE = "configs\local.example.json"
    $env:TODO_DATABASE_DSN = "postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable"
    ```

如果团队习惯使用 `configs/local.json` 保存本机配置，也应该把它加入 `.gitignore`。真实项目中不要提交生产数据库密码，也不要在日志里打印完整 DSN。

### 6.11 更新配置测试

修改 `internal/config/config_test.go` 中和配置字段相关的测试：

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

	writeConfig(t, configPath, map[string]any{
		"app_name":         "todo-api",
		"env":              "local",
		"http_addr":        "127.0.0.1:19090",
		"data_path":        dataPath,
		"database_dsn":     dsn,
		"log_level":        "warn",
		"shutdown_timeout": "2s",
		"enable_debug":     true,
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
		"data_path":    fileDataPath,
		"database_dsn": "postgres://todo:file@127.0.0.1:5432/todo_platform?sslmode=disable",
		"log_level":    "debug",
	})

	t.Setenv("TODO_CONFIG_FILE", configPath)
	t.Setenv("TODO_API_DATA_PATH", envDataPath)
	t.Setenv("TODO_DATABASE_DSN", envDSN)
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
	if cfg.LogLevel != "error" {
		t.Fatalf("LogLevel = %q", cfg.LogLevel)
	}
}

func TestValidate(t *testing.T) {
	cfg := Config{
		AppName:         "todo-api",
		Env:             "test",
		HTTPAddr:        ":8080",
		DataPath:        "todos.json",
		LogLevel:        "info",
		ShutdownTimeout: time.Second,
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
	t.Setenv("TODO_SHUTDOWN_TIMEOUT", "soon")

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

测试重点：

- 环境变量能设置 `TODO_DATABASE_DSN`。
- 配置文件能读取 `database_dsn`。
- 环境变量优先级高于配置文件。
- 没有文件路径时，只要有数据库 DSN 也能通过校验。

### 6.12 增加数据库连接包

创建 `internal/db/db.go`：

```go title="internal/db/db.go"
package db

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func Open(ctx context.Context, dsn string) (*sql.DB, error) {
	database, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, fmt.Errorf("open postgres: %w", err)
	}

	database.SetMaxOpenConns(10)
	database.SetMaxIdleConns(5)
	database.SetConnMaxLifetime(30 * time.Minute)
	database.SetConnMaxIdleTime(5 * time.Minute)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	if err := database.PingContext(pingCtx); err != nil {
		_ = database.Close()
		return nil, fmt.Errorf("ping postgres: %w", err)
	}

	return database, nil
}
```

关键点：

- 空白导入 `pgx/v5/stdlib` 是为了注册 `database/sql` 驱动。
- `sql.Open` 不会立刻建立连接，所以必须 `PingContext`。
- `PingContext` 用 5 秒超时，避免数据库不可达时启动卡住。
- 如果 ping 失败，要关闭连接池。

### 6.13 改造 Repository 接口和文件存储

为了让数据库查询能接收 `context`，需要把 Repository 接口改造成 context-aware。

修改 `internal/todo/store.go`：

```go title="internal/todo/store.go"
package todo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

type Repository interface {
	List(ctx context.Context, status Status) ([]Item, error)
	Get(ctx context.Context, id int) (Item, error)
	Add(ctx context.Context, title string) (Item, error)
	Done(ctx context.Context, id int) (Item, error)
	Update(ctx context.Context, id int, title string) (Item, error)
	Delete(ctx context.Context, id int) error
	Stats(ctx context.Context) (Stats, error)
}

type FileStore struct {
	Path string
	Now  func() time.Time
}

var _ Repository = (*FileStore)(nil)

func NewFileStore(path string) *FileStore {
	return &FileStore{
		Path: path,
		Now:  time.Now,
	}
}

func (s *FileStore) List(ctx context.Context, status Status) ([]Item, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	items, err := s.load()
	if err != nil {
		return nil, err
	}
	if status == "" {
		return items, nil
	}

	filtered := make([]Item, 0, len(items))
	for _, item := range items {
		if item.Status == status {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (s *FileStore) Get(ctx context.Context, id int) (Item, error) {
	if err := checkContext(ctx); err != nil {
		return Item{}, err
	}

	items, err := s.load()
	if err != nil {
		return Item{}, err
	}
	for _, item := range items {
		if item.ID == id {
			return item, nil
		}
	}
	return Item{}, fmt.Errorf("%w: id=%d", ErrNotFound, id)
}

func (s *FileStore) Add(ctx context.Context, title string) (Item, error) {
	if err := checkContext(ctx); err != nil {
		return Item{}, err
	}

	items, err := s.load()
	if err != nil {
		return Item{}, err
	}

	item, err := NewItem(nextID(items), title, s.now())
	if err != nil {
		return Item{}, err
	}

	items = append(items, item)
	if err := s.save(items); err != nil {
		return Item{}, err
	}

	return item, nil
}

func (s *FileStore) Done(ctx context.Context, id int) (Item, error) {
	if err := checkContext(ctx); err != nil {
		return Item{}, err
	}

	items, err := s.load()
	if err != nil {
		return Item{}, err
	}

	for i := range items {
		if items[i].ID == id {
			items[i].MarkDone(s.now())
			if err := s.save(items); err != nil {
				return Item{}, err
			}
			return items[i], nil
		}
	}

	return Item{}, fmt.Errorf("%w: id=%d", ErrNotFound, id)
}

func (s *FileStore) Update(ctx context.Context, id int, title string) (Item, error) {
	if err := checkContext(ctx); err != nil {
		return Item{}, err
	}

	items, err := s.load()
	if err != nil {
		return Item{}, err
	}

	for i := range items {
		if items[i].ID == id {
			if err := items[i].Rename(title, s.now()); err != nil {
				return Item{}, err
			}
			if err := s.save(items); err != nil {
				return Item{}, err
			}
			return items[i], nil
		}
	}

	return Item{}, fmt.Errorf("%w: id=%d", ErrNotFound, id)
}

func (s *FileStore) Delete(ctx context.Context, id int) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	items, err := s.load()
	if err != nil {
		return err
	}

	next := items[:0]
	deleted := false
	for _, item := range items {
		if item.ID == id {
			deleted = true
			continue
		}
		next = append(next, item)
	}

	if !deleted {
		return fmt.Errorf("%w: id=%d", ErrNotFound, id)
	}

	return s.save(next)
}

func (s *FileStore) Stats(ctx context.Context) (Stats, error) {
	items, err := s.List(ctx, "")
	if err != nil {
		return Stats{}, err
	}

	stats := Stats{Total: len(items)}
	for _, item := range items {
		switch item.Status {
		case StatusDone:
			stats.Done++
		default:
			stats.Pending++
		}
	}
	return stats, nil
}

func (s *FileStore) load() ([]Item, error) {
	data, err := os.ReadFile(s.Path)
	if errors.Is(err, os.ErrNotExist) {
		return []Item{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read todo file %s: %w", s.Path, err)
	}
	if len(data) == 0 {
		return []Item{}, nil
	}

	var items []Item
	if err := json.Unmarshal(data, &items); err != nil {
		return nil, fmt.Errorf("parse todo file %s: %w", s.Path, err)
	}

	return items, nil
}

func (s *FileStore) save(items []Item) error {
	if err := os.MkdirAll(filepath.Dir(s.Path), 0755); err != nil {
		return fmt.Errorf("create todo data directory: %w", err)
	}

	data, err := json.MarshalIndent(items, "", "  ")
	if err != nil {
		return fmt.Errorf("encode todo items: %w", err)
	}
	data = append(data, '\n')

	if err := os.WriteFile(s.Path, data, 0600); err != nil {
		return fmt.Errorf("write todo file %s: %w", s.Path, err)
	}

	return nil
}

func (s *FileStore) now() time.Time {
	if s.Now != nil {
		return s.Now()
	}
	return time.Now()
}

func nextID(items []Item) int {
	maxID := 0
	for _, item := range items {
		if item.ID > maxID {
			maxID = item.ID
		}
	}
	return maxID + 1
}
```

为什么要改接口？

因为 PostgreSQL 查询必须能感知请求取消和超时。把 `context` 放进 Repository 接口后，文件存储和数据库存储都遵循同一个调用方式，Service 层不需要知道底层实现是哪一种。

同步更新第 7 篇的 CLI 调用方。修改 `cmd/todo-cli/main.go`：

```go title="cmd/todo-cli/main.go"
package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"cloud-native-todo-platform/internal/todo"
)

const appName = "todo-cli"

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run(args []string) error {
	if len(args) == 0 {
		printUsage()
		return nil
	}

	ctx := context.Background()
	store := todo.NewFileStore(dataPath())

	switch args[0] {
	case "add":
		if len(args) < 2 {
			return errors.New("usage: todo-cli add <title>")
		}
		item, err := store.Add(ctx, strings.Join(args[1:], " "))
		if err != nil {
			return err
		}
		fmt.Printf("added #%d: %s\n", item.ID, item.Title)

	case "list":
		items, err := store.List(ctx, "")
		if err != nil {
			return err
		}
		printItems(items)

	case "done":
		if len(args) != 2 {
			return errors.New("usage: todo-cli done <id>")
		}
		id, err := parseID(args[1])
		if err != nil {
			return err
		}
		item, err := store.Done(ctx, id)
		if err != nil {
			return err
		}
		fmt.Printf("done #%d: %s\n", item.ID, item.Title)

	case "update":
		if len(args) < 3 {
			return errors.New("usage: todo-cli update <id> <title>")
		}
		id, err := parseID(args[1])
		if err != nil {
			return err
		}
		item, err := store.Update(ctx, id, strings.Join(args[2:], " "))
		if err != nil {
			return err
		}
		fmt.Printf("updated #%d: %s\n", item.ID, item.Title)

	case "delete":
		if len(args) != 2 {
			return errors.New("usage: todo-cli delete <id>")
		}
		id, err := parseID(args[1])
		if err != nil {
			return err
		}
		if err := store.Delete(ctx, id); err != nil {
			return err
		}
		fmt.Printf("deleted #%d\n", id)

	case "path":
		fmt.Println(dataPath())

	case "help", "-h", "--help":
		printUsage()

	default:
		return fmt.Errorf("unknown command %q", args[0])
	}

	return nil
}

func parseID(raw string) (int, error) {
	id, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("invalid id %q: %w", raw, err)
	}
	if id <= 0 {
		return 0, fmt.Errorf("invalid id %d: must be greater than 0", id)
	}
	return id, nil
}

func dataPath() string {
	if path := strings.TrimSpace(os.Getenv("TODO_CLI_DATA")); path != "" {
		return path
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".todo-cli", "todos.json")
	}

	return filepath.Join(home, ".todo-cli", "todos.json")
}

func printItems(items []todo.Item) {
	if len(items) == 0 {
		fmt.Println("No todo items.")
		return
	}

	for _, item := range items {
		mark := " "
		if item.Done() {
			mark = "x"
		}
		fmt.Printf("%d. [%s] %s (%s)\n", item.ID, mark, item.Title, item.Status)
	}
}

func printUsage() {
	fmt.Printf(`%s manages local todo items.

Usage:
  %s add <title>
  %s list
  %s done <id>
  %s update <id> <title>
  %s delete <id>
  %s path

Environment:
  TODO_CLI_DATA  custom JSON data file path
`, appName, appName, appName, appName, appName, appName, appName)
}
```

同步更新文件存储测试。修改 `internal/todo/store_test.go`：

```go title="internal/todo/store_test.go"
package todo

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func TestFileStoreLifecycle(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "todos.json")
	store := NewFileStore(path)
	store.Now = fixedNow

	item, err := store.Add(ctx, "  learn Go basics  ")
	if err != nil {
		t.Fatalf("add item: %v", err)
	}
	if item.ID != 1 {
		t.Fatalf("item id = %d, want 1", item.ID)
	}
	if item.Title != "learn Go basics" {
		t.Fatalf("item title = %q", item.Title)
	}
	if item.Status != StatusPending {
		t.Fatalf("item status = %q, want %q", item.Status, StatusPending)
	}

	items, err := store.List(ctx, "")
	if err != nil {
		t.Fatalf("list items: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len(items) = %d, want 1", len(items))
	}

	updated, err := store.Update(ctx, 1, "learn Go module")
	if err != nil {
		t.Fatalf("update item: %v", err)
	}
	if updated.Title != "learn Go module" {
		t.Fatalf("updated title = %q", updated.Title)
	}

	done, err := store.Done(ctx, 1)
	if err != nil {
		t.Fatalf("done item: %v", err)
	}
	if !done.Done() {
		t.Fatalf("done item status = %q", done.Status)
	}

	stats, err := store.Stats(ctx)
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if stats.Total != 1 || stats.Done != 1 || stats.Pending != 0 {
		t.Fatalf("stats = %+v", stats)
	}

	if err := store.Delete(ctx, 1); err != nil {
		t.Fatalf("delete item: %v", err)
	}

	items, err = store.List(ctx, "")
	if err != nil {
		t.Fatalf("list after delete: %v", err)
	}
	if len(items) != 0 {
		t.Fatalf("len(items) after delete = %d, want 0", len(items))
	}
}

func TestNewItemRejectsEmptyTitle(t *testing.T) {
	_, err := NewItem(1, "   ", fixedNow())
	if !errors.Is(err, ErrEmptyTitle) {
		t.Fatalf("error = %v, want ErrEmptyTitle", err)
	}
}

func TestFileStoreReturnsNotFound(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "todos.json")
	store := NewFileStore(path)

	_, err := store.Done(ctx, 42)
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("error = %v, want ErrNotFound", err)
	}
}

func fixedNow() time.Time {
	return time.Date(2026, 5, 26, 10, 0, 0, 0, time.UTC)
}
```

### 6.14 更新 Service 层

修改 `internal/todo/service.go`：

```go title="internal/todo/service.go"
package todo

import (
	"context"
	"fmt"
	"log/slog"
	"strings"
)

type Service struct {
	repo   Repository
	logger *slog.Logger
}

type CreateRequest struct {
	Title string
}

type UpdateRequest struct {
	Title string
}

type ListRequest struct {
	Status Status
}

type Stats struct {
	Total   int `json:"total"`
	Done    int `json:"done"`
	Pending int `json:"pending"`
}

func NewService(repo Repository, logger *slog.Logger) *Service {
	if logger == nil {
		logger = slog.Default()
	}
	return &Service{
		repo:   repo,
		logger: logger,
	}
}

func (s *Service) Create(ctx context.Context, req CreateRequest) (Item, error) {
	if err := checkContext(ctx); err != nil {
		return Item{}, err
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return Item{}, ErrEmptyTitle
	}

	item, err := s.repo.Add(ctx, title)
	if err != nil {
		return Item{}, fmt.Errorf("create todo: %w", err)
	}

	s.logger.Info("todo created", "id", item.ID, "title", item.Title)
	return item, nil
}

func (s *Service) List(ctx context.Context, req ListRequest) ([]Item, error) {
	if err := checkContext(ctx); err != nil {
		return nil, err
	}

	items, err := s.repo.List(ctx, req.Status)
	if err != nil {
		return nil, fmt.Errorf("list todos: %w", err)
	}
	return items, nil
}

func (s *Service) Get(ctx context.Context, id int) (Item, error) {
	if err := checkContext(ctx); err != nil {
		return Item{}, err
	}
	if id <= 0 {
		return Item{}, ErrNotFound
	}

	item, err := s.repo.Get(ctx, id)
	if err != nil {
		return Item{}, fmt.Errorf("get todo %d: %w", id, err)
	}
	return item, nil
}

func (s *Service) Update(ctx context.Context, id int, req UpdateRequest) (Item, error) {
	if err := checkContext(ctx); err != nil {
		return Item{}, err
	}

	title := strings.TrimSpace(req.Title)
	if title == "" {
		return Item{}, ErrEmptyTitle
	}

	item, err := s.repo.Update(ctx, id, title)
	if err != nil {
		return Item{}, fmt.Errorf("update todo %d: %w", id, err)
	}

	s.logger.Info("todo updated", "id", item.ID)
	return item, nil
}

func (s *Service) Done(ctx context.Context, id int) (Item, error) {
	if err := checkContext(ctx); err != nil {
		return Item{}, err
	}

	item, err := s.repo.Done(ctx, id)
	if err != nil {
		return Item{}, fmt.Errorf("mark todo %d done: %w", id, err)
	}

	s.logger.Info("todo marked done", "id", item.ID)
	return item, nil
}

func (s *Service) Delete(ctx context.Context, id int) error {
	if err := checkContext(ctx); err != nil {
		return err
	}

	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("delete todo %d: %w", id, err)
	}

	s.logger.Info("todo deleted", "id", id)
	return nil
}

func (s *Service) Stats(ctx context.Context) (Stats, error) {
	stats, err := s.repo.Stats(ctx)
	if err != nil {
		return Stats{}, fmt.Errorf("load todo stats: %w", err)
	}
	return stats, nil
}

func checkContext(ctx context.Context) error {
	if ctx == nil {
		return nil
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
		return nil
	}
}
```

关键变化：

- `Service` 不再自己过滤列表，而是把 `status` 传给 Repository。
- `Get` 不再通过全量 `List` 查找，而是直接调用 `repo.Get`。
- `Stats` 由 Repository 执行，PostgreSQL 可以用聚合 SQL 高效统计。

同步更新 Service 测试。修改 `internal/todo/service_test.go`：

```go title="internal/todo/service_test.go"
package todo

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"testing"
	"time"
)

type fakeRepository struct {
	items      []Item
	addFunc    func(ctx context.Context, title string) (Item, error)
	listFunc   func(ctx context.Context, status Status) ([]Item, error)
	getFunc    func(ctx context.Context, id int) (Item, error)
	doneFunc   func(ctx context.Context, id int) (Item, error)
	updateFunc func(ctx context.Context, id int, title string) (Item, error)
	deleteFunc func(ctx context.Context, id int) error
	statsFunc  func(ctx context.Context) (Stats, error)
}

func (f *fakeRepository) List(ctx context.Context, status Status) ([]Item, error) {
	if f.listFunc != nil {
		return f.listFunc(ctx, status)
	}
	if status == "" {
		return f.items, nil
	}
	filtered := make([]Item, 0, len(f.items))
	for _, item := range f.items {
		if item.Status == status {
			filtered = append(filtered, item)
		}
	}
	return filtered, nil
}

func (f *fakeRepository) Get(ctx context.Context, id int) (Item, error) {
	if f.getFunc != nil {
		return f.getFunc(ctx, id)
	}
	for _, item := range f.items {
		if item.ID == id {
			return item, nil
		}
	}
	return Item{}, ErrNotFound
}

func (f *fakeRepository) Add(ctx context.Context, title string) (Item, error) {
	if f.addFunc != nil {
		return f.addFunc(ctx, title)
	}
	item := Item{
		ID:        len(f.items) + 1,
		Title:     title,
		Status:    StatusPending,
		CreatedAt: time.Unix(100, 0),
		UpdatedAt: time.Unix(100, 0),
	}
	f.items = append(f.items, item)
	return item, nil
}

func (f *fakeRepository) Done(ctx context.Context, id int) (Item, error) {
	if f.doneFunc != nil {
		return f.doneFunc(ctx, id)
	}
	return Item{}, ErrNotFound
}

func (f *fakeRepository) Update(ctx context.Context, id int, title string) (Item, error) {
	if f.updateFunc != nil {
		return f.updateFunc(ctx, id, title)
	}
	return Item{}, ErrNotFound
}

func (f *fakeRepository) Delete(ctx context.Context, id int) error {
	if f.deleteFunc != nil {
		return f.deleteFunc(ctx, id)
	}
	return ErrNotFound
}

func (f *fakeRepository) Stats(ctx context.Context) (Stats, error) {
	if f.statsFunc != nil {
		return f.statsFunc(ctx)
	}
	stats := Stats{Total: len(f.items)}
	for _, item := range f.items {
		switch item.Status {
		case StatusDone:
			stats.Done++
		default:
			stats.Pending++
		}
	}
	return stats, nil
}

func TestServiceCreate(t *testing.T) {
	tests := []struct {
		name    string
		title   string
		wantErr error
	}{
		{name: "valid title", title: " learn engineering "},
		{name: "empty title", title: "   ", wantErr: ErrEmptyTitle},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var logs bytes.Buffer
			service := NewService(&fakeRepository{}, slog.New(slog.NewTextHandler(&logs, nil)))

			item, err := service.Create(context.Background(), CreateRequest{Title: tt.title})
			if tt.wantErr != nil {
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("error = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("create todo: %v", err)
			}
			if item.Title != "learn engineering" {
				t.Fatalf("Title = %q", item.Title)
			}
			if !bytes.Contains(logs.Bytes(), []byte("todo created")) {
				t.Fatalf("expected create log, got %q", logs.String())
			}
		})
	}
}

func TestServiceCreateWrapsRepositoryError(t *testing.T) {
	repoErr := errors.New("database is readonly")
	service := NewService(&fakeRepository{
		addFunc: func(ctx context.Context, title string) (Item, error) {
			return Item{}, repoErr
		},
	}, slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)))

	_, err := service.Create(context.Background(), CreateRequest{Title: "write tests"})
	if !errors.Is(err, repoErr) {
		t.Fatalf("error = %v, want wrapping %v", err, repoErr)
	}
}

func TestServiceListFiltersByStatus(t *testing.T) {
	service := NewService(&fakeRepository{
		items: []Item{
			{ID: 1, Title: "done task", Status: StatusDone},
			{ID: 2, Title: "pending task", Status: StatusPending},
		},
	}, slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)))

	items, err := service.List(context.Background(), ListRequest{Status: StatusDone})
	if err != nil {
		t.Fatalf("list todos: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("len(items) = %d, want 1", len(items))
	}
	if items[0].Status != StatusDone {
		t.Fatalf("Status = %s", items[0].Status)
	}
}

func TestServiceStats(t *testing.T) {
	service := NewService(&fakeRepository{
		items: []Item{
			{ID: 1, Title: "done task", Status: StatusDone},
			{ID: 2, Title: "pending task", Status: StatusPending},
			{ID: 3, Title: "another pending task", Status: StatusPending},
		},
	}, slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)))

	stats, err := service.Stats(context.Background())
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if stats.Total != 3 || stats.Done != 1 || stats.Pending != 2 {
		t.Fatalf("stats = %+v", stats)
	}
}

func TestServiceRespectsCanceledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	service := NewService(&fakeRepository{}, slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)))
	_, err := service.Create(ctx, CreateRequest{Title: "should not create"})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("error = %v, want context.Canceled", err)
	}
}

func BenchmarkServiceStats(b *testing.B) {
	items := make([]Item, 0, 1000)
	for i := 0; i < 1000; i++ {
		status := StatusPending
		if i%3 == 0 {
			status = StatusDone
		}
		items = append(items, Item{ID: i + 1, Title: "benchmark todo", Status: status})
	}

	service := NewService(&fakeRepository{items: items}, slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := service.Stats(context.Background()); err != nil {
			b.Fatal(err)
		}
	}
}
```

### 6.15 实现 PostgreSQL Repository

创建 `internal/todo/postgres_store.go`：

```go title="internal/todo/postgres_store.go"
package todo

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type PostgresStore struct {
	db *sql.DB
}

var _ Repository = (*PostgresStore)(nil)

func NewPostgresStore(db *sql.DB) *PostgresStore {
	return &PostgresStore{db: db}
}

func (s *PostgresStore) List(ctx context.Context, status Status) ([]Item, error) {
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

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query todos: %w", err)
	}
	defer rows.Close()

	items := make([]Item, 0)
	for rows.Next() {
		item, err := scanItem(rows)
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

func (s *PostgresStore) Get(ctx context.Context, id int) (Item, error) {
	query := `
SELECT id, title, status, created_at, updated_at
FROM todos
WHERE id = $1`

	item, err := scanItem(s.db.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	if err != nil {
		return Item{}, err
	}
	return item, nil
}

func (s *PostgresStore) Add(ctx context.Context, title string) (Item, error) {
	var item Item
	err := s.withTx(ctx, func(tx *sql.Tx) error {
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
		return Item{}, err
	}
	return item, nil
}

func (s *PostgresStore) Update(ctx context.Context, id int, title string) (Item, error) {
	var item Item
	err := s.withTx(ctx, func(tx *sql.Tx) error {
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
		return Item{}, err
	}
	return item, nil
}

func (s *PostgresStore) Done(ctx context.Context, id int) (Item, error) {
	var item Item
	err := s.withTx(ctx, func(tx *sql.Tx) error {
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
		return Item{}, err
	}
	return item, nil
}

func (s *PostgresStore) Delete(ctx context.Context, id int) error {
	return s.withTx(ctx, func(tx *sql.Tx) error {
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
			return ErrNotFound
		}
		return nil
	})
}

func (s *PostgresStore) Stats(ctx context.Context) (Stats, error) {
	query := `
SELECT
  count(*)::int AS total,
  count(*) FILTER (WHERE status = 'done')::int AS done,
  count(*) FILTER (WHERE status = 'pending')::int AS pending
FROM todos`

	var stats Stats
	if err := s.db.QueryRowContext(ctx, query).Scan(&stats.Total, &stats.Done, &stats.Pending); err != nil {
		return Stats{}, fmt.Errorf("query todo stats: %w", err)
	}
	return stats, nil
}

func (s *PostgresStore) withTx(ctx context.Context, fn func(tx *sql.Tx) error) error {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{
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

func scanItem(row rowScanner) (Item, error) {
	var item Item
	var status string
	if err := row.Scan(&item.ID, &item.Title, &status, &item.CreatedAt, &item.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Item{}, err
		}
		return Item{}, fmt.Errorf("scan todo: %w", err)
	}
	item.Status = Status(status)
	return item, nil
}

func insertTodo(ctx context.Context, tx *sql.Tx, title string) (Item, error) {
	query := `
INSERT INTO todos (title, status)
VALUES ($1, 'pending')
RETURNING id, title, status, created_at, updated_at`

	item, err := scanItem(tx.QueryRowContext(ctx, query, title))
	if err != nil {
		return Item{}, err
	}
	return item, nil
}

func updateTodoTitle(ctx context.Context, tx *sql.Tx, id int, title string) (Item, error) {
	query := `
UPDATE todos
SET title = $2, updated_at = now()
WHERE id = $1
RETURNING id, title, status, created_at, updated_at`

	item, err := scanItem(tx.QueryRowContext(ctx, query, id, title))
	if errors.Is(err, sql.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	if err != nil {
		return Item{}, err
	}
	return item, nil
}

func markTodoDone(ctx context.Context, tx *sql.Tx, id int) (Item, error) {
	query := `
UPDATE todos
SET status = 'done', updated_at = now()
WHERE id = $1
RETURNING id, title, status, created_at, updated_at`

	item, err := scanItem(tx.QueryRowContext(ctx, query, id))
	if errors.Is(err, sql.ErrNoRows) {
		return Item{}, ErrNotFound
	}
	if err != nil {
		return Item{}, err
	}
	return item, nil
}

func ensureTodoExists(ctx context.Context, tx *sql.Tx, id int) error {
	var existingID int
	err := tx.QueryRowContext(ctx, `SELECT id FROM todos WHERE id = $1 FOR UPDATE`, id).Scan(&existingID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
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

这里最重要的是事务：

- `Add` 同时插入 Todo 和 `created` 事件。
- `Update` 同时更新标题和写入 `updated` 事件。
- `Done` 同时更新状态和写入 `done` 事件。
- `Delete` 同时写入 `deleted` 事件和删除 Todo。

如果事件写入失败，前面的 Todo 变更也会回滚。这就是事务带来的数据一致性。

`List` 这里没有使用 `WHERE ($1 = '' OR status = $1)` 这种写法，而是把“查询全部”和“按状态查询”拆成两条 SQL。这样更容易让 PostgreSQL 针对 `WHERE status = $1` 使用 `idx_todos_status`，也更适合教学中观察索引和执行计划。

### 6.16 更新应用组装层

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
	Config config.Config
	Logger *slog.Logger
	Todos  *todo.Service
	closer io.Closer
}

func New(cfg config.Config, logger *slog.Logger, repo todo.Repository, closer io.Closer) *App {
	if repo == nil {
		repo = todo.NewFileStore(cfg.DataPath)
	}
	return &App{
		Config: cfg,
		Logger: logger,
		Todos:  todo.NewService(repo, logger),
		closer: closer,
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

	handler := httpapi.NewRouter(a.Todos, a.Logger)
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

第 10 篇中 `app.New` 直接创建 `FileStore`。本篇把 Repository 从外部注入进来，应用层不再固定依赖文件存储。这样 main 函数可以根据配置选择文件存储或 PostgreSQL 存储。

同步更新应用集成测试。修改 `test/integration/app_test.go`：

```go title="test/integration/app_test.go"
package integration_test

import (
	"bytes"
	"context"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"cloud-native-todo-platform/internal/app"
	"cloud-native-todo-platform/internal/config"
	"cloud-native-todo-platform/internal/logger"
	"cloud-native-todo-platform/internal/todo"
)

type safeBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *safeBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *safeBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func TestAppRunStartsAndStopsHTTPServer(t *testing.T) {
	var logs safeBuffer
	cfg := config.Config{
		AppName:         "todo-api",
		Env:             "test",
		HTTPAddr:        "127.0.0.1:0",
		DataPath:        filepath.Join(t.TempDir(), "todos.json"),
		LogLevel:        "debug",
		ShutdownTimeout: time.Second,
	}

	repo := todo.NewFileStore(cfg.DataPath)
	todoApp := app.New(cfg, logger.New(&logs, cfg.LogLevel, cfg.Env), repo, nil)
	if _, err := todoApp.Todos.Create(context.Background(), todo.CreateRequest{Title: "write integration test"}); err != nil {
		t.Fatalf("create todo: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	errCh := make(chan error, 1)
	go func() {
		errCh <- todoApp.Run(ctx)
	}()

	deadline := time.After(time.Second)
	for !strings.Contains(logs.String(), "todo api server started") {
		select {
		case <-deadline:
			cancel()
			t.Fatalf("server did not start, logs = %q", logs.String())
		default:
			time.Sleep(10 * time.Millisecond)
		}
	}

	cancel()

	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("run app: %v", err)
		}
	case <-time.After(2 * time.Second):
		t.Fatal("server did not shut down")
	}

	out := logs.String()
	if !strings.Contains(out, "todo_total=1") {
		t.Fatalf("logs = %q", out)
	}
	if !strings.Contains(out, "todo api server shutting down") {
		t.Fatalf("logs = %q", out)
	}
}
```

### 6.17 更新启动入口

修改 `cmd/todo-api/main.go`：

```go title="cmd/todo-api/main.go"
package main

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"cloud-native-todo-platform/internal/app"
	"cloud-native-todo-platform/internal/config"
	"cloud-native-todo-platform/internal/db"
	"cloud-native-todo-platform/internal/logger"
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
	var closer io.Closer

	if strings.TrimSpace(cfg.DatabaseDSN) != "" {
		database, err := db.Open(ctx, cfg.DatabaseDSN)
		if err != nil {
			return err
		}
		repo = todo.NewPostgresStore(database)
		closer = database
		log.Info("postgres repository enabled")
	} else {
		log.Info("file repository enabled", "data_path", cfg.DataPath)
	}

	todoApp := app.New(cfg, log, repo, closer)
	defer func() {
		if err := todoApp.Close(); err != nil {
			log.Error("close app resources", "error", err)
		}
	}()

	return todoApp.Run(ctx)
}
```

关键点：

- 没有 `TODO_DATABASE_DSN` 时仍然使用文件存储，兼容前面章节。
- 有 `TODO_DATABASE_DSN` 时使用 PostgreSQL。
- 数据库连接池作为 `closer` 注入，应用退出时统一关闭。

### 6.18 编写数据库集成测试

数据库测试需要真实 PostgreSQL。为了让普通 `go test ./...` 不依赖本机数据库，本篇使用环境变量控制是否运行集成测试。

创建 `internal/todo/postgres_store_test.go`：

```go title="internal/todo/postgres_store_test.go"
package todo

import (
	"context"
	"database/sql"
	"os"
	"testing"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func TestPostgresStoreCRUD(t *testing.T) {
	dsn := os.Getenv("TODO_TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("set TODO_TEST_DATABASE_DSN to run postgres integration test")
	}
	requireDatabaseResetAllowed(t)

	ctx := context.Background()
	database, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open postgres: %v", err)
	}
	defer database.Close()

	resetPostgresSchema(t, ctx, database)

	store := NewPostgresStore(database)

	created, err := store.Add(ctx, "learn postgres")
	if err != nil {
		t.Fatalf("Add() error = %v", err)
	}
	if created.ID == 0 || created.Status != StatusPending {
		t.Fatalf("created = %+v", created)
	}

	list, err := store.List(ctx, StatusPending)
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("len(list) = %d", len(list))
	}

	updated, err := store.Update(ctx, created.ID, "learn database/sql")
	if err != nil {
		t.Fatalf("Update() error = %v", err)
	}
	if updated.Title != "learn database/sql" {
		t.Fatalf("updated title = %q", updated.Title)
	}

	done, err := store.Done(ctx, created.ID)
	if err != nil {
		t.Fatalf("Done() error = %v", err)
	}
	if done.Status != StatusDone {
		t.Fatalf("done status = %q", done.Status)
	}

	stats, err := store.Stats(ctx)
	if err != nil {
		t.Fatalf("Stats() error = %v", err)
	}
	if stats.Total != 1 || stats.Done != 1 || stats.Pending != 0 {
		t.Fatalf("stats = %+v", stats)
	}

	if err := store.Delete(ctx, created.ID); err != nil {
		t.Fatalf("Delete() error = %v", err)
	}

	if _, err := store.Get(ctx, created.ID); err == nil {
		t.Fatal("Get() error = nil")
	}
}

func TestPostgresStoreTransactionRollback(t *testing.T) {
	dsn := os.Getenv("TODO_TEST_DATABASE_DSN")
	if dsn == "" {
		t.Skip("set TODO_TEST_DATABASE_DSN to run postgres integration test")
	}
	requireDatabaseResetAllowed(t)

	ctx := context.Background()
	database, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatalf("open postgres: %v", err)
	}
	defer database.Close()

	resetPostgresSchema(t, ctx, database)

	store := NewPostgresStore(database)
	created, err := store.Add(ctx, "rollback demo")
	if err != nil {
		t.Fatalf("Add() error = %v", err)
	}

	_, err = database.ExecContext(ctx, `ALTER TABLE todo_events DROP CONSTRAINT todo_events_event_type_check`)
	if err != nil {
		t.Fatalf("drop event check constraint: %v", err)
	}
	_, err = database.ExecContext(ctx, `ALTER TABLE todo_events ADD CONSTRAINT todo_events_event_type_check CHECK (event_type IN ('created'))`)
	if err != nil {
		t.Fatalf("add stricter event check constraint: %v", err)
	}

	if _, err := store.Done(ctx, created.ID); err == nil {
		t.Fatal("Done() error = nil, want event insert failure")
	}

	got, err := store.Get(ctx, created.ID)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got.Status != StatusPending {
		t.Fatalf("status after rollback = %q, want %q", got.Status, StatusPending)
	}
}

func requireDatabaseResetAllowed(t *testing.T) {
	t.Helper()

	if os.Getenv("TODO_ALLOW_DATABASE_RESET") != "true" {
		t.Skip("set TODO_ALLOW_DATABASE_RESET=true to confirm this test may drop todo tables")
	}
}

func resetPostgresSchema(t *testing.T, ctx context.Context, database *sql.DB) {
	t.Helper()

	statements := []string{
		`DROP TABLE IF EXISTS schema_migrations`,
		`DROP TABLE IF EXISTS todo_events`,
		`DROP TABLE IF EXISTS todos`,
		`CREATE TABLE schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE TABLE todos (
			id BIGSERIAL PRIMARY KEY,
			title TEXT NOT NULL CHECK (length(trim(title)) > 0),
			status TEXT NOT NULL CHECK (status IN ('pending', 'done')),
			created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`CREATE INDEX idx_todos_status ON todos(status)`,
		`CREATE TABLE todo_events (
			id BIGSERIAL PRIMARY KEY,
			todo_id BIGINT REFERENCES todos(id) ON DELETE SET NULL,
			event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'done', 'deleted')),
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)`,
		`INSERT INTO schema_migrations (version) VALUES ('test_schema')`,
	}

	for _, statement := range statements {
		if _, err := database.ExecContext(ctx, statement); err != nil {
			t.Fatalf("exec schema statement %q: %v", statement, err)
		}
	}
}
```

运行普通测试：

=== "Linux / macOS / WSL2"

    ```bash
    go test ./...
    ```

=== "Windows PowerShell"

    ```powershell
    go test ./...
    ```

此时数据库测试会跳过。

运行 PostgreSQL 集成测试：

=== "Linux / macOS / WSL2"

    ```bash
    export TODO_TEST_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
    export TODO_ALLOW_DATABASE_RESET=true
    go test ./internal/todo -run TestPostgresStore -count=1 -v
    ```

=== "Windows PowerShell"

    ```powershell
    $env:TODO_TEST_DATABASE_DSN = "postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable"
    $env:TODO_ALLOW_DATABASE_RESET = "true"
    go test ./internal/todo -run TestPostgresStore -count=1 -v
    ```

预期看到：

```text
=== RUN   TestPostgresStoreCRUD
--- PASS: TestPostgresStoreCRUD
=== RUN   TestPostgresStoreTransactionRollback
--- PASS: TestPostgresStoreTransactionRollback
```

`TODO_ALLOW_DATABASE_RESET=true` 是一个安全确认开关。因为集成测试会重建 `todos`、`todo_events` 和 `schema_migrations`，如果没有这个开关，即使设置了 DSN，测试也会跳过，避免误删开发库或共享库。

### 6.19 更新验证脚本

修改 `Makefile`：

```makefile title="Makefile"
.PHONY: fmt test cover bench build verify db-up db-down db-migrate

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

db-up:
	docker compose up -d postgres

db-down:
	docker compose down

db-migrate:
	docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
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

这里没有把数据库集成测试放进默认验证脚本，是为了让没有 Docker 或 PostgreSQL 的环境也能跑基础验证。真实 CI 可以增加一个单独的数据库测试 job。

### 6.20 启动 API 并验证数据库持久化

确认数据库启动并已执行迁移后，启动 API：

=== "Linux / macOS / WSL2"

    ```bash
    export TODO_CONFIG_FILE=configs/local.example.json
    export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
    go run ./cmd/todo-api
    ```

=== "Windows PowerShell"

    ```powershell
    $env:TODO_CONFIG_FILE = "configs\local.example.json"
    $env:TODO_DATABASE_DSN = "postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable"
    go run ./cmd/todo-api
    ```

另开一个终端访问 API：

```bash
curl -s -X POST http://127.0.0.1:8080/api/v1/todos -H 'Content-Type: application/json' -d '{"title":"persist with PostgreSQL"}'
curl -s http://127.0.0.1:8080/api/v1/todos
curl -s -X POST http://127.0.0.1:8080/api/v1/todos/1/done
curl -s http://127.0.0.1:8080/readyz
```

直接在数据库中查看：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT id, title, status FROM todos ORDER BY id;"
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT todo_id, event_type FROM todo_events ORDER BY id;"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT id, title, status FROM todos ORDER BY id;"
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT todo_id, event_type FROM todo_events ORDER BY id;"
    ```

判断依据：

- API 创建的 Todo 能在 `todos` 表看到。
- 标记完成后，`status` 变成 `done`。
- `todo_events` 中能看到 `created` 和 `done` 事件。
- 停止 API 再重新启动，数据仍然存在。

### 6.21 清理步骤

停止 API 后清理环境：

=== "Linux / macOS / WSL2"

    ```bash
    unset TODO_CONFIG_FILE
    unset TODO_DATABASE_DSN
    unset TODO_TEST_DATABASE_DSN
    unset TODO_ALLOW_DATABASE_RESET
    docker compose down
    ```

=== "Windows PowerShell"

    ```powershell
    Remove-Item Env:TODO_CONFIG_FILE -ErrorAction SilentlyContinue
    Remove-Item Env:TODO_DATABASE_DSN -ErrorAction SilentlyContinue
    Remove-Item Env:TODO_TEST_DATABASE_DSN -ErrorAction SilentlyContinue
    Remove-Item Env:TODO_ALLOW_DATABASE_RESET -ErrorAction SilentlyContinue
    docker compose down
    ```

如果想连数据库数据卷也删除：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose down -v
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose down -v
    ```

`-v` 会删除数据库数据卷，本地实验可以使用，生产环境不要这样清理数据库。

## 7. 真实工作案例

某团队的 Todo 平台第一版使用本地文件存储，只有一个实例运行。后来业务接入 Web 前端和移动端，流量变大后遇到问题：

- 多个实例无法共享本地文件。
- 文件写入冲突导致数据丢失。
- 按状态筛选 Todo 越来越慢。
- 无法追踪谁在什么时候修改了 Todo。
- 新版本上线时，不同环境表结构难以保持一致。

团队改造方案：

- 架构师和后端一起设计 `todos` 和 `todo_events` 表。
- 后端编写迁移文件和 PostgreSQL Repository。
- 测试编写 API 回归用例和数据库集成测试。
- DevOps 在测试环境准备 PostgreSQL 实例和连接配置。
- SRE 增加数据库连接数、慢查询和错误率监控。
- 发布流程要求先执行迁移，再发布应用。

这类改造在真实公司非常常见。它的重点不是“把 SQL 写出来”这么简单，而是让数据模型、应用代码、测试、发布和运维形成闭环。

## 8. 常见错误

| 错误现象 | 常见原因 | 修复方向 |
|---|---|---|
| `connection refused` | PostgreSQL 容器没启动或端口不对 | 执行 `docker compose ps`，确认 `5432` 已监听 |
| `password authentication failed` | 用户名或密码错误 | 检查 `TODO_DATABASE_DSN` 和 `docker-compose.yml` |
| `database "todo_platform" does not exist` | 连接到了错误数据库或容器初始化失败 | 检查 `POSTGRES_DB` 和连接串 |
| `relation "todos" does not exist` | 没有执行迁移 | 执行 `psql -f /migrations/000001_create_todos.up.sql` |
| `pq: duplicate key` 或唯一约束错误 | 手动插入了冲突数据 | 检查主键、唯一索引和测试数据清理 |
| `invalid input value for status` | 写入了非法状态 | 只允许 `pending` 和 `done` |
| `context deadline exceeded` | 查询超时、锁等待、网络慢 | 查看慢 SQL、锁和数据库负载 |
| `too many connections` | 应用连接池过大或连接泄漏 | 调整连接池，检查是否频繁创建 `*sql.DB` |
| `unsupported driver name` | 没有导入 pgx stdlib | 确认存在 `_ "github.com/jackc/pgx/v5/stdlib"` |
| 集成测试被跳过 | 未设置 `TODO_TEST_DATABASE_DSN`，或未确认 `TODO_ALLOW_DATABASE_RESET=true` | 设置测试 DSN，并显式确认允许测试重建本地表 |

## 9. 排障方法

### 9.1 检查数据库容器

=== "Linux / macOS / WSL2"

    ```bash
    docker compose ps
    docker compose logs postgres
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose ps
    docker compose logs postgres
    ```

判断依据：

- `STATUS` 应该是 `running` 或 `healthy`。
- 日志中不应该反复出现初始化失败、权限失败或端口占用。

### 9.2 检查数据库连接

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT version();"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "SELECT version();"
    ```

判断依据：

- 能返回 PostgreSQL 版本，说明数据库可连接。
- 如果认证失败，检查用户、密码和数据库名。
- 如果连接失败，检查容器状态和端口映射。

### 9.3 检查表和迁移

=== "Linux / macOS / WSL2"

    ```bash
    docker compose exec postgres psql -U todo -d todo_platform -c "\dt"
    docker compose exec postgres psql -U todo -d todo_platform -c "\d todos"
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose exec postgres psql -U todo -d todo_platform -c "\dt"
    docker compose exec postgres psql -U todo -d todo_platform -c "\d todos"
    ```

判断依据：

- `\dt` 应看到 `todos` 和 `todo_events`。
- `\d todos` 应看到主键、检查约束和索引。
- 如果没有表，说明迁移未执行或连接到错误数据库。

### 9.4 检查应用是否启用 PostgreSQL

启动 API 后查看日志：

```text
level=INFO msg="postgres repository enabled"
```

如果看到：

```text
level=INFO msg="file repository enabled"
```

说明 `TODO_DATABASE_DSN` 没有生效。

排查：

=== "Linux / macOS / WSL2"

    ```bash
    echo "$TODO_DATABASE_DSN"
    ```

=== "Windows PowerShell"

    ```powershell
    $env:TODO_DATABASE_DSN
    ```

### 9.5 检查慢查询和执行计划

```bash
docker compose exec postgres psql -U todo -d todo_platform -c "EXPLAIN ANALYZE SELECT id, title, status FROM todos WHERE status = 'pending' ORDER BY id;"
```

判断依据：

- `Execution Time` 是实际执行耗时。
- `Seq Scan` 在小表中正常，在大表中可能需要关注。
- 如果扫描行数远大于返回行数，可能需要索引或改写 SQL。

### 9.6 检查锁等待

```bash
docker compose exec postgres psql -U todo -d todo_platform -c "SELECT pid, state, wait_event_type, wait_event, query FROM pg_stat_activity WHERE datname = 'todo_platform';"
```

判断依据：

- `wait_event_type = Lock` 表示可能在等锁。
- 长时间 `active` 的复杂 SQL 可能拖慢其他请求。
- `idle in transaction` 表示事务打开后没有及时提交或回滚，这是生产环境高风险状态。

### 9.7 检查连接池

```bash
docker compose exec postgres psql -U todo -d todo_platform -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'todo_platform';"
```

判断依据：

- 连接数持续增长，可能是应用反复创建 `*sql.DB` 或连接池配置不合理。
- Go 应用应在启动时创建一次连接池，而不是每个请求创建连接池。

## 10. 生产环境注意事项

### 10.1 密码和连接串不能硬编码

本篇为了本地实验，使用环境变量传入数据库连接串。生产环境也不要把 DSN、用户名和密码写进普通配置文件或 Git 仓库。

推荐方式：

- 本地开发使用 `.env` 或本地配置文件。
- CI 使用平台密钥管理。
- Kubernetes 使用 Secret。
- 日志中不要打印完整 DSN，避免泄漏密码。
- 非本地环境使用 `sslmode=require` 或 `sslmode=verify-full`，避免明文传输数据库凭据和数据。

数据库账号也要遵守最小权限原则。应用账号只需要访问业务表，不应该拥有 `DROP DATABASE`、创建超级用户等高危权限；迁移账号可以拥有建表、建索引权限，但最好和应用运行账号分开。

### 10.2 迁移必须纳入发布流程

生产发布不能靠工程师手动复制 SQL。

更稳妥的做法：

- 迁移文件进入代码审查。
- 测试环境先执行迁移。
- 发布前确认迁移是否可重复执行。
- 对高风险迁移准备回滚方案。
- 大表加字段、加索引要评估锁表和执行时间。

本篇的迁移文件适合本地教学。真实生产中可以使用 `golang-migrate`、Flyway、Liquibase 或平台内置迁移工具。

生产数据库还建议为迁移设置 `lock_timeout` 和 `statement_timeout`，避免一次高风险 DDL 长时间等待锁或占用数据库资源。大表加索引优先评估 `CREATE INDEX CONCURRENTLY`，并避开业务高峰。

### 10.3 数据库连接池要有上限

连接池过小会导致请求排队，过大会压垮数据库。

需要关注：

- `MaxOpenConns`。
- `MaxIdleConns`。
- 连接生命周期。
- API 副本数。
- 数据库最大连接数。

如果每个 Pod 允许 50 个连接，部署 20 个 Pod，就可能产生 1000 个数据库连接。生产中必须按整体容量计算。

### 10.4 事务要尽量短

事务中不要做这些事：

- 调用外部 HTTP 服务。
- 等待用户输入。
- 执行很慢的复杂计算。
- 长时间不提交也不回滚。

事务越长，持有锁的时间越长，越容易影响其他请求。

### 10.5 索引要服务真实查询

索引不是越多越好。

生产中加索引前应该确认：

- 这个查询是否频繁。
- 表数据量是否足够大。
- 查询过滤条件是否稳定。
- 写入成本是否可以接受。
- 是否需要组合索引。

用 `EXPLAIN ANALYZE` 看执行计划，而不是凭感觉加索引。

### 10.6 备份和恢复比备份本身更重要

只配置备份不够，还要定期演练恢复。

需要确认：

- 备份是否成功。
- 备份是否加密。
- 备份保留多久。
- 是否能恢复到指定时间点。
- 恢复耗时是否满足业务要求。

很多事故不是因为没有备份，而是因为从未验证过恢复。

### 10.7 Readiness 要检查数据库依赖

第 10 篇的 `/readyz` 检查文件路径。接入 PostgreSQL 后，`/readyz` 会通过 `Stats` 访问数据库。

如果数据库不可用，`/readyz` 应返回失败，让 Kubernetes 把 Pod 从流量入口摘除。

注意：

- readiness 失败通常不应该立刻重启容器。
- liveness 不要做过重的数据库检查。
- 数据库短暂抖动时，错误率告警比盲目重启更有价值。

## 11. 本章小项目

本章小项目是：**Todo Platform PostgreSQL 持久化**。

项目成果：

- `docker-compose.yml`：本地 PostgreSQL 实验环境。
- `migrations/000001_create_todos.up.sql`：创建 Todo 表、事件表和索引。
- `migrations/000001_create_todos.down.sql`：回滚迁移。
- `internal/db/db.go`：PostgreSQL 连接池初始化。
- `internal/config/config.go`：支持 `TODO_DATABASE_DSN`。
- `internal/todo/store.go`：context-aware Repository。
- `internal/todo/postgres_store.go`：PostgreSQL Repository。
- `internal/todo/postgres_store_test.go`：可选数据库集成测试。
- `cmd/todo-api/main.go`：按配置选择文件存储或 PostgreSQL 存储。

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

数据库验证：

=== "Linux / macOS / WSL2"

    ```bash
    docker compose up -d postgres
    docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
    export TODO_TEST_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
    export TODO_ALLOW_DATABASE_RESET=true
    go test ./internal/todo -run TestPostgresStore -count=1 -v
    ```

=== "Windows PowerShell"

    ```powershell
    docker compose up -d postgres
    docker compose exec -T postgres psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
    $env:TODO_TEST_DATABASE_DSN = "postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable"
    $env:TODO_ALLOW_DATABASE_RESET = "true"
    go test ./internal/todo -run TestPostgresStore -count=1 -v
    ```

### 能力验收标准

你可以用下面清单自检：

- 能解释为什么文件存储不适合生产 API。
- 能设计 `todos` 和 `todo_events` 表。
- 能解释主键、检查约束、外键和索引的作用。
- 能手写 Todo 的 `INSERT`、`SELECT`、`UPDATE`、`DELETE`。
- 能使用 `EXPLAIN` 初步判断 SQL 是否使用索引。
- 能解释 `database/sql` 的连接池语义。
- 能说明为什么数据库查询要使用 `context`。
- 能实现 PostgreSQL Repository。
- 能用事务保证 Todo 变更和事件写入一致。
- 能执行 up/down 迁移，并能查询 `schema_migrations` 确认迁移版本。
- 能安全运行数据库集成测试，并理解为什么需要 `TODO_ALLOW_DATABASE_RESET`。

### 作品集说明

完成本篇后，你的作品集可以新增一条：

```text
为 Go Todo Platform 接入 PostgreSQL，设计 todos/todo_events 表结构，编写数据库迁移，实现 database/sql + pgx Repository，并使用事务保证状态变更和事件记录一致。
```

这比“会写 SQL”更有说服力，因为它展示了数据库建模、Go 数据访问、事务和工程集成能力。

## 12. 本章练习题

### 基础题

1. `PRIMARY KEY` 和普通索引有什么区别？
2. 为什么 `status` 字段需要检查约束？
3. `TIMESTAMP` 和 `TIMESTAMPTZ` 有什么区别？
4. `database/sql` 中的 `*sql.DB` 是单个连接还是连接池？
5. 为什么生产环境不应该把数据库密码写进 Git 仓库？

### 实操题

1. 给 `todos` 表增加 `description TEXT` 字段，并编写新的迁移文件。
2. 给 `todos` 表增加 `priority` 字段，只允许 `low`、`medium`、`high`。
3. 增加 `GET /api/v1/todos?status=done` 的数据库查询验证。
4. 给 `PostgresStore` 增加按创建时间倒序查询的方法。
5. 给 `todo_events` 增加查询某个 Todo 事件历史的方法。

### 思考题

1. 如果 Todo 平台部署多个 API 副本，为什么 PostgreSQL 比本地文件更合适？
2. 如果 `Done` 中 Todo 更新成功但事件写入失败，用户会看到什么问题？
3. 什么时候应该使用 GORM，什么时候应该使用 sqlc？
4. 如果线上大表要新增索引，为什么不能随便在高峰期执行？
5. `/readyz` 访问数据库失败时，应该重启进程还是摘除流量？

## 13. 本章面试题

### 1. 关系型数据库和文件存储相比有什么优势？

关系型数据库提供结构化表、约束、索引、事务、并发控制、备份恢复和权限管理。文件存储适合简单单机数据，但在多实例、并发写入、复杂查询和生产运维方面能力不足。后端服务进入生产后，核心业务数据通常应该放在数据库中。

### 2. 什么是事务？为什么需要事务？

事务是一组数据库操作的执行边界，要么全部成功提交，要么全部失败回滚。它用于保证数据一致性。例如标记 Todo 完成时，如果既要更新状态又要写事件记录，就应该放在同一个事务里，避免只成功一半。

### 3. PostgreSQL 默认隔离级别是什么？

PostgreSQL 默认隔离级别是 `Read Committed`。它保证每条语句只能看到已经提交的数据。对于普通 CRUD 足够常用，但涉及库存、余额、配额等强一致场景时，需要结合锁、隔离级别和重试策略设计。

### 4. `*sql.DB` 为什么不应该每个请求创建一次？

`*sql.DB` 是连接池句柄，不是单个连接。每个请求创建一次会导致频繁建连、连接数失控和性能下降。正确做法是在应用启动时创建一次连接池，所有请求复用它，应用退出时关闭。

### 5. 如何判断 SQL 是否需要索引？

先看业务查询是否频繁、数据量是否足够大、过滤条件是否稳定，再用 `EXPLAIN` 或 `EXPLAIN ANALYZE` 查看执行计划。如果扫描行数远大于返回行数，且查询频繁，可能需要索引。索引会增加写入成本，所以不能盲目添加。

### 6. GORM、sqlc、`database/sql` 如何选择？

`database/sql` 控制力强，适合学习底层机制和核心路径。GORM 开发效率高，适合 CRUD 较多、业务变化快的场景。sqlc 基于手写 SQL 生成类型安全代码，适合 SQL 复杂且团队重视编译期检查的项目。选择哪种取决于团队能力、业务复杂度和长期维护成本。

### 7. 什么是数据库迁移？

数据库迁移是对表结构、索引、约束等数据库结构变化进行版本化管理。迁移文件让数据库结构可以被审查、复现、回滚和自动化执行。没有迁移管理，多个环境很容易出现结构不一致。

### 8. 为什么数据库查询要使用 context？

`context` 可以把 HTTP 请求超时、客户端断开、服务关闭等信号传递给数据库操作。如果查询不支持取消，请求已经失败后数据库仍可能继续执行 SQL，浪费连接和计算资源。

### 9. 什么是慢查询？如何排查？

慢查询是执行时间超过预期的 SQL。排查时可以先确认接口耗时，再查看数据库日志、`pg_stat_activity`、执行计划和索引情况。常见原因包括缺少索引、返回数据过多、锁等待、连接池耗尽和数据库资源不足。

### 10. 数据库生产上线前至少要检查什么？

至少要检查连接串和权限、迁移是否可执行、回滚方案、连接池配置、慢查询风险、索引设计、备份恢复、监控告警、数据安全和发布顺序。涉及大表变更时，还要评估锁表和执行时间。

## 14. 本章总结

本篇完成了 Todo Platform 从文件存储到 PostgreSQL 持久化的关键升级。

你学习了：

- PostgreSQL 表设计。
- SQL CRUD。
- 索引和执行计划入门。
- `database/sql` 连接池。
- `pgx` 驱动接入。
- Go Repository 分层。
- 事务和数据一致性。
- 数据库迁移和版本管理。
- PostgreSQL 集成测试。

本篇项目成果是：Todo API 可以把数据写入 PostgreSQL，并通过事务保持 Todo 状态和事件记录一致。

这标志着你已经从“会写 API”迈向“能写可持久化、可演进、可上线的后端服务”。

## 15. 下一章衔接

下一篇将进入 Redis、缓存与异步任务。

有了 PostgreSQL 后，Todo 平台已经能可靠保存核心数据。但真实后端系统还会遇到新的问题：

- 热点查询如何减少数据库压力？
- API 是否需要缓存 Todo 统计信息？
- 一些耗时任务能否异步执行？
- 如何处理缓存一致性？
- 如何用 Redis 支撑限流、缓存和任务队列？

第 12 篇会在本篇 PostgreSQL 持久化的基础上继续演进 Todo 平台，让它具备缓存和异步处理能力。
