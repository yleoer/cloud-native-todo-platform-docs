# 第 17 篇：Docker Compose 本地编排：练习题与面试题

> 本页由 [第 17 篇：Docker Compose 本地编排](../../chapters/stage-03-docker/17-docker-compose.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. Compose 文件中 `services`、`networks`、`volumes` 分别描述什么？请结合本篇的 `postgres`、`redis`、`api` 举例。
2. 为什么 API 容器访问数据库时应该使用 `postgres:5432`，而不是 `127.0.0.1:15432`？
3. `.env` 文件和 `environment` 字段有什么区别？为什么 `.env` 不应该提交？
4. `docker compose down` 和 `docker compose down -v` 有什么区别？哪一个会删除 PostgreSQL 数据？
5. `migrate` 服务为什么适合设计成一次性任务，而不是和 API 主进程写在一起？

### 实操题

1. 把 `.env` 中 `TODO_HTTP_PORT` 改为 `18081`，重新执行 `docker compose --env-file .env up -d --force-recreate`，验证 `http://127.0.0.1:18081/readyz` 可访问。实验结束后改回 `18080`。
2. 故意把 `TODO_DATABASE_DSN` 中的 `postgres:5432` 改成 `127.0.0.1:5432`，重建 API 并观察日志中的连接错误。记录错误后恢复正确配置。
3. 执行 `docker compose --env-file .env down` 后重新 `up -d`，确认 Todo 数据是否仍在；再执行 `down -v` 清空数据，观察 PostgreSQL 表和数据变化。

### 思考题

1. 如果要在 CI 中复用本篇 Compose 文件，你会保留 Traefik 吗？哪些服务可以复用，哪些配置应该覆盖？
2. 本篇使用 Docker socket 让 Traefik 自动发现服务。生产环境中你会如何降低这类权限风险？可以结合后续第 26 篇安全上下文和第 41 篇 Operator 权限最小化一起思考。

## 面试题

### 面试题 1：Docker Compose 解决什么问题？它和 Dockerfile、`docker run` 的关系是什么？

**一句话结论**：Dockerfile 定义镜像怎么构建，`docker run` 启动单个容器，Docker Compose 用声明式 YAML 管理一组容器如何一起运行。

**展开解释**：第 16 篇的 Dockerfile 产出 `todo-api:v0.1.0`。如果只用 `docker run`，启动 PostgreSQL、Redis、迁移和 API 需要多条命令，并且网络、端口、数据卷和环境变量容易不一致。Compose 把这些参数集中到 `compose.yaml` 中，让本地开发环境可以复现、审查和版本管理。

**追问方向**：Compose 能替代 Kubernetes 吗？回答时要说明 Compose 适合本地开发和轻量联调，生产环境通常需要 Kubernetes 提供调度、自愈、扩缩容、准入控制、滚动发布和资源管理。

### 面试题 2：Compose 中容器之间为什么使用服务名访问？

**一句话结论**：同一 Compose 网络内，服务名会被 Docker DNS 解析到对应容器，因此容器之间应使用服务名和容器内部端口通信。

**展开解释**：宿主机访问 PostgreSQL 用 `127.0.0.1:15432`，这是端口映射；API 容器访问 PostgreSQL 用 `postgres:5432`，这是容器网络内访问。容器内的 `127.0.0.1` 只指向容器自己，不会指向宿主机或其他服务。

**追问方向**：如果容器 IP 变化会怎样？回答时要说明服务名比容器 IP 稳定，容器重建后 IP 可能变化，但 Compose 网络中的服务名仍可解析到当前容器。

### 面试题 3：`.env` 和 `environment` 有什么区别？

**一句话结论**：`.env` 主要给 Compose 文件做变量插值，`environment` 才是设置容器内部环境变量。

**展开解释**：`.env` 中的 `POSTGRES_PORT=15432` 可以替换 `ports` 中的 `${POSTGRES_PORT:-15432}`，但它不一定自动进入容器。Todo API 真正需要读取的 `TODO_DATABASE_DSN`、`TODO_REDIS_ADDR`、`TODO_JWT_SECRET`、`TODO_AUTH_USERS` 应明确写在 `environment` 中。

**追问方向**：为什么 `.env` 不能提交？回答时要说明 `.env` 可能包含真实密码、JWT Secret、管理员密码哈希和个人端口设置，应提交 `.env.example`，真实值由本地或密钥系统注入。

### 面试题 4：`depends_on` 和 `healthcheck` 分别解决什么问题？

**一句话结论**：`depends_on` 描述服务启动依赖，`healthcheck` 判断服务是否真的可用，两者结合才能处理基础启动顺序。

**展开解释**：容器进程启动不代表数据库已经接受连接。PostgreSQL 需要 `pg_isready` 判断健康，Redis 需要 `redis-cli ping` 判断健康。`migrate` 等待 PostgreSQL healthy，API 等待 PostgreSQL、Redis healthy 和 migrate 成功完成，可以避免常见的启动竞态。

**追问方向**：这能保证生产依赖永远可用吗？回答时要说明不能。`depends_on` 只影响启动阶段，运行期间依赖故障仍需要应用重试、健康探针、监控告警和编排平台自愈。

### 面试题 5：为什么本篇把数据库迁移设计成独立 `migrate` 服务？

**一句话结论**：迁移是一次性运维任务，和长期运行的 API 主进程职责不同，独立服务更容易控制顺序、观察日志和迁移到 Kubernetes Job。

**展开解释**：`migrate` 使用同一个 `todo-api:v0.1.0` 镜像，但覆盖命令为 `migrate`。它等待 PostgreSQL healthy 后执行，成功后退出。API 依赖 `service_completed_successfully`，只有迁移成功才启动。这样能避免 API 启动后才发现表不存在。

**追问方向**：如果多个副本同时执行迁移怎么办？回答时要说明本地 Compose 只有一个 `migrate` 服务；生产环境要使用 Job、迁移锁、幂等迁移和发布流程约束，避免多个实例并发修改 schema。
