# 阶段一验证命令附录

本附录整理阶段一验证时实际使用、可加入教材的命令。外网访问按要求优先设置代理；访问本机回环地址时补充 `NO_PROXY`，避免代理干扰 `127.0.0.1` 和 `localhost`。

## 通用代理环境

```bash
export HTTP_PROXY=http://192.168.2.1:7890
export HTTPS_PROXY=http://192.168.2.1:7890
export ALL_PROXY=socks5://192.168.2.1:7890
export NO_PROXY=127.0.0.1,localhost
export no_proxy=127.0.0.1,localhost
```

## 第 1 篇：环境与 YAML

```bash
go version
git --version
docker --version
docker info --format '{{.ServerVersion}}'
kubectl version --client
kind version
helm version --template '{{.Version}}'
bash --version | head -n 1
```

```bash
go env GOPROXY
grep -n '^GO_PROXY_REQUIRED=https://goproxy.cn,direct$' scripts/versions.conf
./scripts/check-env.sh
```

```bash
kubectl config current-context 2>/dev/null || true
kubectl config get-contexts 2>/dev/null || true
kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml
```

如果无 kubeconfig 上下文导致 dry-run 访问 `localhost:8080` 失败，可先创建临时 kind 集群：

```bash
docker image inspect kindest/node:v1.35.0 --format '{{.Id}} {{json .RepoDigests}}'
kind create cluster --name todo-dev --image kindest/node:v1.35.0
kubectl config current-context
kubectl get nodes
kubectl apply -f docs/examples/multi-doc.yaml
kubectl get namespace todo-dev
kubectl -n todo-dev get configmap todo-env
kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml
kind delete cluster --name todo-dev
```

如果实机需要拉取镜像，优先验证镜像源形式：

```bash
docker pull docker.1ms.run/kindest/node:v1.35.0
docker tag docker.1ms.run/kindest/node:v1.35.0 kindest/node:v1.35.0
kind create cluster --name todo-dev --image kindest/node:v1.35.0
```

## 第 2 篇：文件系统

```bash
./scripts/check-server-layout.sh
```

```bash
stat -c '%a %n' \
  server/todo-platform/config/app.env \
  server/todo-platform/config/app.env.backup \
  server/todo-platform/logs/todo-api.log \
  server/todo-platform/logs \
  server/todo-platform/data \
  server/todo-platform/tmp \
  server/todo-platform/releases
```

```bash
readlink server/todo-platform/current
grep -n 'ERROR' server/todo-platform/logs/todo-api.log
find server/todo-platform -name '*.env' -print | sort
tar -tzf server/todo-platform-backup.tar.gz | sed -n '1,80p'
```

## 第 3 篇：进程与 systemd

```bash
go build -o bin/todo-process-demo ./api/cmd/todo-process-demo
ps -p 1 -o pid,comm,args
systemctl --version | head -n 1
```

```bash
sudo systemctl start todo-process-demo
systemctl is-active todo-process-demo
PID="$(systemctl show -p MainPID --value todo-process-demo)"
printf 'pid=%s\n' "$PID"
ps -p "$PID" -o pid,ppid,user,stat,%cpu,%mem,etime,cmd
sudo ss -lntp 'sport = :18080'
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/healthz
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/work
journalctl -u todo-process-demo -n 20 --no-pager
sudo systemctl stop todo-process-demo
```

检查脚本负例也应保留，避免“假通过”：

```bash
systemctl is-active todo-process-demo || true
./scripts/check-process-service.sh
echo "$?"
```

## 第 4 篇：网络排障

```bash
go build -o bin/todo-network-demo ./api/cmd/todo-network-demo
TODO_ADDR=127.0.0.1:18080 ./bin/todo-network-demo
```

另一个终端执行：

```bash
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/healthz
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/todos
curl --noproxy 127.0.0.1,localhost -i http://127.0.0.1:18080/debug/request
sudo ss -lntp 'sport = :18080'
getent hosts localhost
ip route
./scripts/check-network-demo.sh
```

抓包验证：

```bash
sudo tcpdump -i lo -nn 'tcp port 18080' -c 6
curl --noproxy 127.0.0.1,localhost -s http://127.0.0.1:18080/healthz >/dev/null
```

检查脚本负例：

```bash
./scripts/check-network-demo.sh
echo "$?"
```

## 第 5 篇：Git 协作

```bash
git status --short --branch
git branch --show-current
git log --oneline --decorate -n 5
git tag --list
git show --stat --summary --oneline v0.1.0
git remote -v
git config --local --get pull.ff || true
```

## 第 6 篇：Shell 自动化

```bash
bash -n scripts/*.sh
test -x scripts/dev.sh
test -x scripts/check.sh
test -x scripts/clean.sh
git diff --check
```

默认端口闭环：

```bash
./scripts/clean.sh --all
./scripts/dev.sh
./scripts/check.sh
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/healthz
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/todos
./scripts/clean.sh --all
```

自定义端口闭环：

```bash
TODO_PORT=18081 ./scripts/dev.sh
TODO_PORT=18081 ./scripts/check.sh
./scripts/clean.sh --all
```

代理环境下的安全写法：

```bash
HTTP_PROXY=http://192.168.2.1:7890 \
HTTPS_PROXY=http://192.168.2.1:7890 \
ALL_PROXY=socks5://192.168.2.1:7890 \
NO_PROXY=127.0.0.1,localhost \
no_proxy=127.0.0.1,localhost \
./scripts/dev.sh
```

## 阶段验收命令

```bash
go build ./...
bash -n scripts/*.sh
./scripts/check.sh
kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml
./scripts/check-foundation.sh
make check-foundation
```

如果验收依赖 Kubernetes discovery，先执行：

```bash
kind create cluster --name todo-dev --image kindest/node:v1.35.0
kubectl apply -f docs/examples/multi-doc.yaml
./scripts/check-foundation.sh
make check-foundation
kind delete cluster --name todo-dev
```

## 验证后清理

```bash
./scripts/clean.sh --all
sudo systemctl stop todo-process-demo || true
kind delete cluster --name todo-dev || true
kind get clusters || true
docker ps --format '{{.Names}} {{.Image}}' | rg 'todo-dev|kindest/node' || true
ps -ef | rg 'todo-(network-demo|dev-server|process-demo)' || true
```

## 文档仓库验证

```bash
mkdocs build --strict
python3 -m mkdocs build --strict
```

当前验证机结果：两条命令均因未安装 `mkdocs` 失败，需要安装依赖后复测。
