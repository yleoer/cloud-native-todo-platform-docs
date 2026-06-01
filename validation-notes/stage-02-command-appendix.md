# 阶段二验证命令附录

本附录整理阶段二验证时实际使用、可加入教材的命令。外网访问按要求优先设置代理；访问本机回环地址时补充 `NO_PROXY`，避免代理干扰 `127.0.0.1` 和 `localhost`。

## 通用代理环境

```bash
export HTTP_PROXY=http://192.168.2.1:7890
export HTTPS_PROXY=http://192.168.2.1:7890
export ALL_PROXY=socks5://192.168.2.1:7890
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost
export GOPROXY=https://goproxy.cn,direct
```

## 工具基线

```bash
go version
docker version
docker compose version
jq --version
gcc --version
go env GOPROXY
go env CGO_ENABLED
```

安装 Docker Compose v2：

```bash
HTTP_PROXY=http://192.168.2.1:7890 \
HTTPS_PROXY=http://192.168.2.1:7890 \
ALL_PROXY=socks5://192.168.2.1:7890 \
DEBIAN_FRONTEND=noninteractive \
apt-get update
```

```bash
HTTP_PROXY=http://192.168.2.1:7890 \
HTTPS_PROXY=http://192.168.2.1:7890 \
ALL_PROXY=socks5://192.168.2.1:7890 \
DEBIAN_FRONTEND=noninteractive \
apt-get install -y docker-compose-v2
```

## 第 7 篇：Go CLI

```bash
go run ./cmd/todo-cli add "学习 Go 基础" add "完成 todo-cli" list done 1 update 2 "完成 Go module" list delete 1 list
go build -o bin/todo-cli ./cmd/todo-cli
./bin/todo-cli add "构建后的 CLI 可运行" list
```

## 第 8 篇：工程化、测试和覆盖率

```bash
go list -m
go fmt ./...
go vet ./...
go test ./...
go test ./... -cover
go test ./api/internal/service -bench . -benchmem
```

## 第 9 篇：net/http API v1

```bash
go fmt ./api/...
go test ./api/...
go test ./api/internal/handler/http -count=1
go build -o bin/todo-api ./api/cmd/todo-api
TODO_API_ADDR=127.0.0.1:18080 ./bin/todo-api config-check
```

API v1 本机验证：

```bash
TODO_API_ADDR=127.0.0.1:18080 ./bin/todo-api
```

```bash
curl --noproxy 127.0.0.1,localhost -s http://127.0.0.1:18080/healthz
curl --noproxy 127.0.0.1,localhost -s http://127.0.0.1:18080/readyz
curl --noproxy 127.0.0.1,localhost -s -X POST http://127.0.0.1:18080/api/v1/todos \
  -H 'Content-Type: application/json' \
  -d '{"title":"learn net/http"}'
curl --noproxy 127.0.0.1,localhost -s http://127.0.0.1:18080/api/v1/todos
```

## 第 10 篇：Gin API 和 OpenAPI

```bash
go get github.com/gin-gonic/gin@v1.12.0
go mod tidy
go fmt ./api/...
go test ./api/internal/handler/gin -count=1
go run ./api/cmd/todo-api openapi | sed -n '1,80p'
go run ./api/cmd/todo-api openapi | grep -E 'auth/login|bearerAuth|401'
```

## 第 11 篇：并发统计和负载工具

```bash
go test ./api/internal/service -count=1
go test -race ./api/internal/service
go build -o bin/todo-load ./api/cmd/todo-load
```

先启动 API，再执行负载命令：

```bash
go run ./api/cmd/todo-load \
  -addr http://127.0.0.1:18080 \
  -path /healthz \
  -requests 10 \
  -concurrency 2
```

验收时应检查输出中的 `failed=0`，不要只看退出码。

## 第 12 篇：PostgreSQL

按镜像源要求，验证工作区可将 Compose 镜像改为：

```yaml
image: docker.1ms.run/postgres:18-alpine
```

启动和检查 PostgreSQL：

```bash
docker compose config
docker compose up -d postgres
docker compose ps
docker compose exec postgres pg_isready -U todo -d todo_platform
```

执行迁移和查看表：

```bash
docker compose exec -T postgres \
  psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
docker compose exec postgres psql -U todo -d todo_platform -c "\dt"
docker compose exec postgres psql -U todo -d todo_platform -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
```

运行数据库集成测试：

```bash
export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
export TODO_TEST_DATABASE_DSN="$TODO_DATABASE_DSN"
export TODO_ALLOW_DATABASE_RESET=true
go test ./api/internal/repository -run Postgres -count=1
```

## 第 13 篇：Redis

按镜像源要求，验证工作区可将 Compose 镜像改为：

```yaml
image: docker.1ms.run/redis:8.2-alpine
```

启动和检查 Redis：

```bash
docker compose up -d postgres redis
docker compose ps
docker compose exec redis redis-cli -a todo_redis_password ping
```

带 Redis 运行测试：

```bash
export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
export TODO_TEST_DATABASE_DSN="$TODO_DATABASE_DSN"
export TODO_ALLOW_DATABASE_RESET=true
export TODO_REDIS_ADDR='127.0.0.1:6379'
export TODO_REDIS_PASSWORD='todo_redis_password'
go test ./...
```

## 第 14 篇：生产化能力

生成密码哈希并设置配置：

```bash
HASH=$(TODO_CONFIG_DIR=configs TODO_ENV=dev go run ./api/cmd/todo-api hash-password "change-me-123")
echo "$HASH"
export TODO_CONFIG_DIR=configs
export TODO_ENV=dev
export TODO_JWT_SECRET=0123456789abcdef0123456789abcdef
export TODO_AUTH_USERS="admin=$HASH"
export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
export TODO_REDIS_ADDR='127.0.0.1:6379'
export TODO_REDIS_PASSWORD='todo_redis_password'
```

检查配置、格式化、测试和构建：

```bash
go run ./api/cmd/todo-api config-check
go fmt ./api/...
go test ./api/...
go build -o bin/todo-api ./api/cmd/todo-api
```

启动服务：

```bash
./bin/todo-api serve
```

API smoke test：

```bash
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/healthz
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/api/v2/todos
```

```bash
TOKEN=$(curl --noproxy 127.0.0.1,localhost -s \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me-123"}' \
  http://127.0.0.1:18080/api/v2/auth/login | jq -r '.data.token')
echo "$TOKEN"
```

```bash
curl --noproxy 127.0.0.1,localhost -i \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"stage 02 acceptance"}' \
  http://127.0.0.1:18080/api/v2/todos
```

检查 OpenAPI 和安全 Header：

```bash
curl --noproxy 127.0.0.1,localhost -s http://127.0.0.1:18080/openapi.yaml | grep -E 'auth/login|bearerAuth|401'
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/healthz
```

## 阶段二最小验收路径

```bash
go mod tidy
go fmt ./...
go test ./...
go test -race ./api/internal/service ./api/internal/handler/gin ./api/internal/handler/http
go build ./api/cmd/todo-api ./api/cmd/todo-load
go run ./api/cmd/todo-api openapi
```

## 阶段二完整验收路径

```bash
docker compose up -d postgres redis
docker compose ps
docker compose exec -T postgres \
  psql -U todo -d todo_platform -f /migrations/000001_create_todos.up.sql
```

```bash
export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
export TODO_TEST_DATABASE_DSN="$TODO_DATABASE_DSN"
export TODO_ALLOW_DATABASE_RESET=true
export TODO_REDIS_ADDR='127.0.0.1:6379'
export TODO_REDIS_PASSWORD='todo_redis_password'
go test ./...
go run ./api/cmd/todo-api openapi
```

## 环境保留检查

阶段结束后只记录，不清理：

```bash
kind get clusters
kubectl --context kind-todo-dev get nodes
docker compose ps
docker ps --format '{{.Names}} {{.Image}} {{.Status}} {{.Ports}}'
docker volume ls | grep cloud-native-todo-platform-stage02
```

避免在连续阶段验证中执行：

```bash
docker compose down
docker compose down -v
kind delete cluster --name todo-dev
```
