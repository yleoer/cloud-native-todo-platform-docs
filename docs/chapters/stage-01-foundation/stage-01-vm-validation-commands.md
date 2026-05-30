# 阶段一附录 C：虚拟机验证命令清单

本附录记录阶段一在 Ubuntu 24.04 虚拟机中完整验收时用到的命令，供以后教学、助教复盘和学员自查使用。

它不是新的实验正文，而是一份可按顺序执行的验证清单。执行前请先确认你在自己的练习仓库中操作，例如 `/tmp/stage01-cloud-native-todo-platform` 或 `~/workspace/cloud-native-todo-platform`，不要在生产目录中直接复制清理命令。

## 1. 基础信息确认

```bash
cat /etc/os-release
uname -a
whoami
id
pwd
date
```

确认常用命令是否存在：

```bash
command -v go git docker kubectl kind helm bash curl ss dig journalctl systemctl
```

如果是在虚拟机里使用宿主机代理，并且宿主机代理端口是 `7890`，先确认虚拟机能访问宿主机地址。下面以 `192.168.2.1` 为例，实际教学时应替换为你的宿主机网关或代理监听地址。

```bash
curl -I --max-time 5 http://192.168.2.1:7890 || true
```

## 2. 工具链版本验证

```bash
go version
git --version
docker version
kubectl version --client
kind version
helm version
bash --version
```

阶段一验证时使用的基线示例：

```text
Go: go1.26.x
Docker: 29.x
kubectl: v1.36.x
kind: v0.31.x
Helm: v4.x
```

如果版本不一致，先按第 1 篇重新对齐工具链，再继续后续验证。

## 3. Docker 代理配置

如果 GitHub、Docker Hub 或 kind 节点镜像下载慢，可以给 Docker daemon 配置宿主机代理。这里仍以宿主机代理 `192.168.2.1:7890` 为例。

```bash
sudo mkdir -p /etc/systemd/system/docker.service.d

sudo tee /etc/systemd/system/docker.service.d/http-proxy.conf >/dev/null <<'EOF'
[Service]
Environment="HTTP_PROXY=http://192.168.2.1:7890"
Environment="HTTPS_PROXY=http://192.168.2.1:7890"
Environment="NO_PROXY=localhost,127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,*.local"
EOF

sudo systemctl daemon-reload
sudo systemctl restart docker
systemctl show --property=Environment docker
docker info
```

如果后续不再需要代理，可以删除这个 drop-in 文件并重启 Docker：

```bash
sudo rm -f /etc/systemd/system/docker.service.d/http-proxy.conf
sudo systemctl daemon-reload
sudo systemctl restart docker
```

## 4. 文档仓库验证

在课程文档仓库中执行：

```bash
cd /root/cloud-native-todo-platform-docs
.venv/bin/mkdocs build
.venv/bin/mkdocs build --strict
```

如果本机没有现成虚拟环境，可以按仓库 README 安装依赖后再执行。阶段一文档修改后，`mkdocs build --strict` 是必须通过的本地验证。

## 5. 临时练习仓库准备

建议教学验收时使用临时目录，避免污染学员已有工程。

```bash
WORKDIR=/tmp/stage01-cloud-native-todo-platform
mkdir -p "$WORKDIR"
cd "$WORKDIR"
git init
git status --short --branch
```

如果需要重新开始，先确认变量指向的是临时目录，再删除：

```bash
echo "$WORKDIR"
test "$WORKDIR" = "/tmp/stage01-cloud-native-todo-platform"
rm -rf "$WORKDIR"
```

## 6. 第 1 篇环境与 YAML 验证

```bash
cd "$WORKDIR"
test -f scripts/versions.conf
test -x scripts/check-env.sh
./scripts/check-env.sh
```

验证 YAML 前，先确认当前 kube context。课程实测中，`kubectl v1.36` 执行 `apply --dry-run=client` 时仍可能在没有可用 API server 的情况下尝试访问 `localhost:8080`。

```bash
kubectl config current-context
kubectl config get-contexts
kind get clusters
```

如果已经创建 kind 集群，再执行：

```bash
kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml
```

如果没有集群，先完成第 12 节的 kind smoke test，再回到这里执行 YAML 验证。

## 7. 第 2 篇文件系统实验验证

```bash
cd "$WORKDIR"
test -d server/todo-platform
test -f server/todo-platform/config/app.env
test -L server/todo-platform/current
test -x scripts/check-server-layout.sh
./scripts/check-server-layout.sh
```

辅助排查命令：

```bash
find server/todo-platform -maxdepth 3 -print | sort
stat server/todo-platform/config/app.env
readlink server/todo-platform/current
```

## 8. 第 3 篇进程与 systemd 验证

```bash
cd "$WORKDIR"
go build ./...
```

如果已经按正文安装 systemd demo：

```bash
sudo systemctl daemon-reload
sudo systemctl start todo-process-demo
systemctl status todo-process-demo --no-pager
curl -fsS http://127.0.0.1:18080/healthz
ss -ltnp | grep ':18080' || true
journalctl -u todo-process-demo -n 50 --no-pager
```

验证结束后清理实验服务，避免占用端口：

```bash
sudo systemctl stop todo-process-demo || true
sudo systemctl disable todo-process-demo || true
sudo rm -f /etc/systemd/system/todo-process-demo.service
sudo systemctl daemon-reload
```

## 9. 第 4 篇网络实验验证

```bash
cd "$WORKDIR"
go build -o bin/todo-network-demo ./api/cmd/todo-network-demo
```

在终端一启动服务：

```bash
TODO_ADDR=127.0.0.1:18080 ./bin/todo-network-demo
```

在终端二执行验证：

```bash
curl -fsS http://127.0.0.1:18080/healthz
curl -fsS http://localhost:18080/healthz
curl -fsS http://127.0.0.1:18080/readyz
curl -fsS http://127.0.0.1:18080/todos
ss -ltnp | grep ':18080' || true
dig localhost
```

如果正文中提供了网络报告或检查脚本：

```bash
test -f docs/network-report.md
test -x scripts/check-network-demo.sh
./scripts/check-network-demo.sh
```

## 10. 第 5 篇 Git 工作流验证

```bash
cd "$WORKDIR"
git status --short --branch
git branch --show-current
git log --oneline --decorate -5
git remote -v
```

冲突、stash、rebase、tag 和本地远程仓库实验完成后，用下面命令检查关键状态：

```bash
git status --short
git stash list
git tag --list
git log --oneline --graph --decorate --all -12
git grep -n -E '<<<<<<<|=======|>>>>>>>' -- . ':!docs/chapters/stage-01-foundation/05-git-basics.md' || true
```

## 11. 第 6 篇 Shell 自动化验证

```bash
cd "$WORKDIR"
bash -n scripts/*.sh
shellcheck scripts/*.sh
./scripts/dev.sh
./scripts/check.sh
./scripts/clean.sh --all
```

如果 `./scripts/check.sh` 失败，先看失败的是语法检查、ShellCheck、Go 构建、健康检查还是清理步骤，再回到对应章节修复。

## 12. kind smoke test

先加载版本锁：

```bash
cd "$WORKDIR"
source scripts/versions.conf
printf '%s\n' "$KIND_NODE_IMAGE"
```

创建本地集群：

```bash
kind create cluster --name todo-dev --image "$KIND_NODE_IMAGE"
kind get clusters
kubectl config current-context
kubectl get nodes
```

验证基础资源：

```bash
kubectl create namespace todo-dev --dry-run=client -o yaml | kubectl apply -f -
kubectl get namespace todo-dev
kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml
```

确认 kind 实际使用的镜像：

```bash
docker inspect todo-dev-control-plane --format '{{.Config.Image}} {{.Image}}'
```

清理集群：

```bash
kind delete cluster --name todo-dev
kind get clusters
```

## 13. 收尾检查

```bash
cd "$WORKDIR"
git status --short --branch
go build ./...
bash -n scripts/*.sh
```

确认端口和临时服务没有遗留：

```bash
ss -ltnp | grep ':18080' || true
systemctl status todo-process-demo --no-pager || true
kind get clusters
```

如果曾创建专门的实验用户或用户组，应在确认没有服务依赖后再清理：

```bash
getent passwd todo || true
getent group todo || true
```

清理用户、目录、systemd unit 这类命令有破坏性，教学时应先让学员解释当前路径、服务状态和清理影响，再执行。
