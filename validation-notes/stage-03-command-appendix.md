# 阶段三验证命令附录

本附录整理阶段三验证时实际使用、可加入教材的命令。外网访问按要求优先设置代理；访问本机回环地址时补充 `NO_PROXY`，避免代理干扰 `127.0.0.1` 和 `localhost`。

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
docker version
docker compose version
docker buildx version
kind version
kubectl version --client
```

安装 Buildx：

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
apt-get install -y docker-buildx
```

## 第 15 篇：Docker 基础

拉取课程镜像：

```bash
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/postgres:18-alpine
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/redis:8.2-alpine
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/golang:1.26-bookworm
docker pull registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23
docker image ls
```

连续阶段验证时，避免删除阶段二保留容器，建议使用独立资源名前缀：

```bash
docker rm -f stage03-api stage03-postgres stage03-redis 2>/dev/null || true
docker network inspect stage03-net >/dev/null 2>&1 || docker network create stage03-net
docker volume create stage03-postgres-data
docker volume create stage03-redis-data
```

## 第 16 篇：Dockerfile 与镜像构建

构建镜像：

```bash
VERSION=v0.1.0
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
```

```bash
docker build \
  --progress=plain \
  -f api/Dockerfile \
  --build-arg VERSION="$VERSION" \
  --build-arg COMMIT="$COMMIT" \
  --build-arg BUILD_DATE="$BUILD_DATE" \
  -t todo-api:v0.1.0 .
```

如果构建容器内无法访问 `proxy.golang.org`，建议 Dockerfile 或构建参数显式设置：

```dockerfile
ENV GOPROXY=https://goproxy.cn,direct \
    GOSUMDB=off
```

检查镜像：

```bash
docker image inspect todo-api:v0.1.0 --format '{{.Config.User}} {{json .Config.Entrypoint}} {{json .Config.Cmd}}'
docker image inspect todo-api:v0.1.0 --format '{{json .Config.Labels}}'
docker history todo-api:v0.1.0
```

生成密码哈希并执行配置检查：

```bash
HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
docker run --rm \
  -e TODO_ENV=dev \
  -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
  -e "TODO_AUTH_USERS=admin=$HASH" \
  todo-api:v0.1.0 config-check
```

## 第 17 篇：Docker Compose

准备本地 `.env`：

```bash
cd deployments/docker-compose
cp .env.example .env
HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
printf "\nTODO_AUTH_USERS='admin=%s'\n" "$HASH" >> .env
grep '^TODO_AUTH_USERS=' .env
```

检查配置：

```bash
docker compose --env-file .env config
docker compose --env-file .env config --services
docker compose --env-file .env config | grep -E 'postgres:5432|redis:6379|TODO_AUTH_USERS'
```

启动和查看：

```bash
docker compose --env-file .env up -d
docker compose --env-file .env ps
docker compose --env-file .env ps -a
docker compose --env-file .env logs migrate
docker compose --env-file .env logs --tail 80 api
```

依赖检查：

```bash
docker compose --env-file .env exec -T postgres pg_isready -U todo -d todo_platform
docker compose --env-file .env exec -T redis redis-cli -a todo_redis_password ping
```

HTTP smoke test：

```bash
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/healthz
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/readyz
```

```bash
TOKEN=$(curl --noproxy 127.0.0.1,localhost -s \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"change-me-123"}' \
  http://127.0.0.1:18080/api/v2/auth/login | jq -r '.data.token')

curl --noproxy 127.0.0.1,localhost -i \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"compose smoke test"}' \
  http://127.0.0.1:18080/api/v2/todos
```

## 第 18 篇：容器运行原理

镜像和进程观察：

```bash
docker history todo-api:v0.1.0
docker image inspect todo-api:v0.1.0 --format 'User={{.Config.User}} Entrypoint={{json .Config.Entrypoint}} Cmd={{json .Config.Cmd}}'
docker run --rm registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 sh -c 'cat /etc/os-release; ps -o pid,ppid,comm'
```

观察 Compose API 容器：

```bash
cd deployments/docker-compose
TODO_API_CONTAINER=$(docker compose --env-file .env ps -q api)
docker inspect "$TODO_API_CONTAINER" --format 'Pid={{.State.Pid}} Status={{.State.Status}} Cgroup={{.HostConfig.CgroupnsMode}}'
PID=$(docker inspect "$TODO_API_CONTAINER" --format '{{.State.Pid}}')
ls -l /proc/$PID/ns
cat /proc/$PID/cgroup
```

环境自检：

```bash
uname -a
stat -fc %T /sys/fs/cgroup
test -f /sys/fs/cgroup/cgroup.controllers && cat /sys/fs/cgroup/cgroup.controllers || true
command -v unshare
command -v nsenter
command -v findmnt
command -v ip
grep -qw overlay /proc/filesystems && echo overlay:ok || echo overlay:unsupported
```

高权限实验建议只在个人 VM 中执行：

```bash
sudo unshare --uts --pid --mount --fork --mount-proc sh -c 'hostname stage03-ns && hostname && ps -o pid,ppid,comm'
```

## 第 19 篇：OCI、containerd、runc 与 CRI

复用已有 kind 集群：

```bash
kind get clusters
kubectl get nodes -o wide
```

导入 Todo API 镜像：

```bash
kind load docker-image todo-api:v0.1.0 --name todo-dev
```

进入节点观察 CRI 和 containerd：

```bash
NODE=$(docker ps --filter name=todo-dev-control-plane --format '{{.Names}}' | head -n 1)
docker exec "$NODE" crictl ps -a
docker exec "$NODE" crictl images
docker exec "$NODE" crictl images | grep todo-api
docker exec "$NODE" crictl pods
docker exec "$NODE" ctr -n k8s.io images ls | grep todo-api
docker exec "$NODE" ctr -n k8s.io tasks ls
```

如果新建独立运行时集群：

```bash
kind create cluster --name todo-runtime --image kindest/node:v1.35.0
kind load docker-image todo-api:v0.1.0 --name todo-runtime
kubectl --context kind-todo-runtime get nodes -o wide
NODE=$(docker ps --filter name=todo-runtime-control-plane --format '{{.Names}}' | head -n 1)
docker exec "$NODE" crictl images | grep todo-api
docker exec "$NODE" ctr -n k8s.io images ls | grep todo-api
```

## 阶段三验收命令

```bash
docker version
docker compose version
docker buildx version
docker build -f api/Dockerfile -t todo-api:v0.1.0 .
docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'
```

```bash
HASH=$(docker run --rm todo-api:v0.1.0 hash-password "change-me-123")
docker run --rm \
  -e TODO_ENV=dev \
  -e TODO_JWT_SECRET=0123456789abcdef0123456789abcdef \
  -e "TODO_AUTH_USERS=admin=$HASH" \
  todo-api:v0.1.0 config-check
```

```bash
cd deployments/docker-compose
test -f .env
docker compose --env-file .env config
docker compose --env-file .env up -d
docker compose --env-file .env ps
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/healthz
docker compose --env-file .env logs --tail 80 api
```

```bash
docker history todo-api:v0.1.0
docker inspect todo-api:v0.1.0
docker network inspect todo-platform_todo-net
docker volume ls --filter name=todo-platform
docker run --rm registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 sh -c 'cat /etc/os-release; ps -o pid,ppid,comm'
```

```bash
kind load docker-image todo-api:v0.1.0 --name todo-dev
NODE=$(docker ps --filter name=todo-dev-control-plane --format '{{.Names}}' | head -n 1)
docker exec "$NODE" crictl ps
docker exec "$NODE" crictl images
docker exec "$NODE" crictl pods
docker exec "$NODE" ctr -n k8s.io images ls
```
