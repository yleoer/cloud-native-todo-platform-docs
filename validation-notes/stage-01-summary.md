# 阶段一验证总结

- 验证阶段：阶段一 `docs/chapters/stage-01-foundation`
- 验证分支：`codex/revalidation-stage-01`
- 验证日期：2026-05-31
- 验证工作区：`/tmp/stage01-revalidation-qoPIiL`
- 课程项目来源：`/root/workspace/cloud-native-todo-platform`
- 网络策略：外网命令按要求附加 `HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`；本机回环访问补充 `NO_PROXY=127.0.0.1,localhost` 作为临时修正。

## 阶段结论

修改后通过。

阶段一核心产物可以在临时工作区中完成验证；阶段验收命令在创建 kind 集群后通过。原样执行时存在需要修正文档或脚本的风险点：无 kubeconfig 上下文时 `kubectl apply --dry-run=client --validate=false` 仍会访问 `localhost:8080` 并失败；部分检查脚本在失败场景下会返回 0；代理环境变量会干扰本机 `127.0.0.1` 健康检查。

文档仓库自身的 `mkdocs build --strict` 未能执行，原因是当前环境未安装 `mkdocs`。

## 已验证章节

1. `01-course-guide-env.md`
2. `02-linux-filesystem.md`
3. `03-linux-process.md`
4. `04-linux-network.md`
5. `05-git-basics.md`
6. `06-shell-scripting.md`
7. `stage-01-acceptance.md`
8. `stage-01-cheatsheet-troubleshooting.md`

## 按章节验证记录

### 第 1 篇：课程导学与开发环境准备

- 预期产物：工具链版本可用；`docs/examples/basic.yaml`、`multi-doc.yaml`、`anchors.yaml` 存在；`docs/environment.md`、`scripts/versions.conf`、`scripts/check-env.sh` 存在；可选 kind smoke test 能创建 `todo-dev` 集群并应用 YAML。
- 实际产物：Go 1.26.3、Git 2.43.0、Docker 29.1.3、kubectl v1.36.1、kind v0.31.0、Helm v4.2.0、Bash 5.2.21 均可用；`./scripts/check-env.sh` 通过；kind 使用本地 `kindest/node:v1.35.0` 创建集群后，`kubectl apply -f docs/examples/multi-doc.yaml` 创建 `todo-dev` Namespace 和 `todo-env` ConfigMap。
- 失败点：无 kubeconfig 上下文时，`kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml` 失败并访问 `http://localhost:8080/api?timeout=32s`。
- 临时修正：创建临时 kind 集群后重跑 dry-run 和真实 apply；验证完成后执行 `kind delete cluster --name todo-dev`。

### 第 2 篇：Linux 文件系统与命令基础

- 预期产物：`server/todo-platform` 目录结构、配置文件、日志、数据目录、发布目录、`current` 软链接、备份包和权限符合要求。
- 实际产物：`./scripts/check-server-layout.sh` 通过；`config`、`logs`、`data`、`releases` 为 `750`，`tmp` 为 `700`，`app.env`、`app.env.backup`、`todo-api.log` 为 `640`；`current -> releases/2026-05-27-001`；备份包包含预期目录和文件。
- 失败点：未发现阻塞性失败。
- 临时修正：无。

### 第 3 篇：Linux 进程、服务与软件管理

- 预期产物：`todo-process-demo` 可编译；systemd unit 可启动服务；服务监听 `127.0.0.1:18080`；`/healthz`、`/work` 可访问；PID、端口和 journal 可排查。
- 实际产物：`go build -o bin/todo-process-demo ./api/cmd/todo-process-demo` 通过；`sudo systemctl start todo-process-demo` 后服务 active，`MainPID=26385`，端口监听正常，`curl /healthz` 返回 `{"service":"todo-process-demo","status":"ok"}`，journal 有启动日志。
- 失败点：`scripts/check-process-service.sh` 在服务 inactive 且 `MainPID=0` 时仍输出 OK 并返回 0，不能作为可靠验收脚本。
- 临时修正：人工顺序执行 `systemctl is-active`、`systemctl show -p MainPID`、`ps`、`ss`、`curl`、`journalctl` 验证；验证后停止服务。

### 第 4 篇：Linux 网络基础与排障

- 预期产物：`todo-network-demo` 可编译运行；`/healthz`、`/todos`、`/debug/request` 可访问；`ss`、`getent`、`ip route`、`tcpdump` 可证明访问链路。
- 实际产物：`go build -o bin/todo-network-demo ./api/cmd/todo-network-demo` 通过；前台持有服务后，`curl -i` 三个接口均返回 HTTP 200；`ss` 显示 `127.0.0.1:18080` 监听；`tcpdump -i lo -nn 'tcp port 18080' -c 6` 捕获本机回环 TCP 握手和响应包。
- 失败点：`scripts/check-network-demo.sh` 在服务未启动时仍返回 0；带全局代理变量执行本机 `curl` 会出现 `Empty reply from server` 或连接失败。
- 临时修正：本机访问显式设置 `NO_PROXY=127.0.0.1,localhost`；使用前台会话持有服务，再从另一个命令执行 HTTP、端口和抓包验证。

### 第 5 篇：Git 基础与团队协作

- 预期产物：Git 协作文件、分支、提交、远程、tag 和 PR 模板可验证。
- 实际产物：临时仓库处于 `docs/issue-5-git-workflow` 分支；本地远程为 `/tmp/stage01-git-remote.git`；存在 tag `v0.1.0`；`.gitignore`、`.gitattributes`、`.gitmessage`、`.github/pull_request_template.md`、`docs/contributing/git-workflow.md` 存在。
- 失败点：临时验证副本继承了源项目的未提交变更，`git status --short --branch` 非干净状态；这影响“从零复现”体验，但不是课程正文产物缺失。
- 临时修正：按文件存在性、提交历史、tag 和本地远程验证协作产物；未对源仓库或课程文档做清理。

### 第 6 篇：Shell 脚本与自动化基础

- 预期产物：`dev.sh`、`check.sh`、`clean.sh` 可执行；`bash -n` 通过；默认端口和自定义端口都能完成启动、健康检查和清理。
- 实际产物：`bash -n scripts/*.sh` 通过；`git diff --check` 通过；顺序执行 `clean.sh --all`、`dev.sh`、`check.sh`、`curl /healthz`、`curl /todos`、`clean.sh --all` 通过；`TODO_PORT=18081` 的启动和检查通过。
- 失败点：把外网代理变量直接传给本机健康检查时，`dev.sh` 内部 `curl` 会失败；依赖顺序的脚本不能并行执行。
- 临时修正：外网代理变量保留，同时补充 `NO_PROXY=127.0.0.1,localhost no_proxy=127.0.0.1,localhost`；依赖链使用严格顺序执行。

### 阶段一验收文档

- 预期产物：`go build ./...`、`bash -n scripts/*.sh`、`./scripts/check.sh`、`kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml`、`./scripts/check-foundation.sh`、`make check-foundation` 可验证。
- 实际产物：创建 kind 集群后，`go build ./...`、`bash -n scripts/*.sh`、`./scripts/check-foundation.sh`、`make check-foundation`、`kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml` 均通过；`kubectl get namespace todo-dev` 和 `kubectl -n todo-dev get configmap todo-env` 通过。
- 失败点：不创建集群时，`kubectl apply --dry-run=client --validate=false` 失败；`./scripts/check.sh` 必须先启动 dev 服务，并在代理环境中补 `NO_PROXY`。
- 临时修正：创建临时 kind 集群并设置回环 `NO_PROXY`。

## 已验证产物

- 工具链：Go、Git、Docker、kubectl、kind、Helm、Bash。
- YAML 示例：`docs/examples/basic.yaml`、`docs/examples/multi-doc.yaml`、`docs/examples/anchors.yaml`。
- 环境记录：`docs/environment.md`、`scripts/versions.conf`、`scripts/check-env.sh`。
- 文件系统实验：`server/todo-platform`、权限、日志、软链接、备份包。
- systemd 实验：`todo-process-demo` 二进制、unit、环境文件、端口、健康检查、journal。
- 网络实验：`todo-network-demo`、HTTP 接口、DNS/路由、`tcpdump` 抓包。
- Git 实验：分支、提交、tag、PR 模板、Git 工作流文档。
- Shell 自动化：`dev.sh`、`check.sh`、`clean.sh` 默认端口和自定义端口闭环。
- 阶段验收：`check-foundation.sh`、`make check-foundation`。

## 失败项分类

### P0

无。

### P1

- `docs/chapters/stage-01-foundation/01-course-guide-env.md:653` 和 `docs/chapters/stage-01-foundation/stage-01-acceptance.md:240`：文档说明 `kubectl apply --dry-run=client --validate=false` 在无集群时可做客户端检查，但本机 kubectl v1.36.1 仍访问 API discovery，导致 `localhost:8080` 连接失败。
- `docs/chapters/stage-01-foundation/03-linux-process.md:724`：实际仓库中的 `scripts/check-process-service.sh` 会在服务 inactive 时返回 0，验收可信度不足。
- `docs/chapters/stage-01-foundation/04-linux-network.md:618`：实际仓库中的 `scripts/check-network-demo.sh` 会在 HTTP 失败时返回 0，验收可信度不足。

### P2

- `docs/chapters/stage-01-foundation/01-course-guide-env.md:751`：`KIND_NODE_IMAGE` 使用 `registry.cn-guangzhou.aliyuncs.com/yleoer/node`，与本次要求的 Docker registry mirror `https://docker.1ms.run` 不一致；本次临时使用本地已缓存 `kindest/node:v1.35.0`，未额外拉取。
- `docs/chapters/stage-01-foundation/06-shell-scripting.md:648`、`docs/chapters/stage-01-foundation/06-shell-scripting.md:800`：代理环境下本机回环 `curl` 建议显式设置 `NO_PROXY=127.0.0.1,localhost`。
- 文档仓库本地验证：`mkdocs build --strict` 和 `python3 -m mkdocs build --strict` 均因未安装 `mkdocs` 无法执行。

## 网络/镜像源问题

- 外网访问命令按要求附加代理变量。
- 本机 `127.0.0.1` / `localhost` 访问不应走代理；临时修正为同时设置 `NO_PROXY` 和 `no_proxy`。
- kind 节点镜像使用本地已有 `kindest/node:v1.35.0`，未触发拉取。当前本地镜像 digest 为 `kindest/node@sha256:4613778f3cfcd10e615029370f5786704559103cf27bef934597ba562b269661`，与文档中阿里云镜像预期 digest 不一致。
- 如果实机需要拉取 kind 镜像，建议优先验证 `docker.1ms.run/kindest/node:v1.35.0` 或课程统一镜像仓库，并更新文档中的镜像说明。

## 需要修改的课程文档位置

- `docs/chapters/stage-01-foundation/01-course-guide-env.md:653`：调整 `kubectl apply --dry-run=client --validate=false` 的无集群预期，说明 v1.36.1 仍可能需要 API discovery；可提供 `kind` 集群或其他纯客户端 YAML 解析方式作为替代。
- `docs/chapters/stage-01-foundation/stage-01-acceptance.md:240`：`check-foundation.sh` 中的 kubectl dry-run 应说明依赖可用 kubeconfig 上下文，或改成先创建 kind 集群后执行。
- `docs/chapters/stage-01-foundation/01-course-guide-env.md:751`：更新 `KIND_NODE_IMAGE` 镜像来源说明，使其符合 `docker.1ms.run` 优先策略，或明确课程推荐镜像仓库和 digest。
- `docs/chapters/stage-01-foundation/03-linux-process.md:724`：同步实际 `scripts/check-process-service.sh`，确保检查 service active、PID 非 0、PID 文件一致、curl 成功、端口监听和 journal 命中；失败时返回非 0。
- `docs/chapters/stage-01-foundation/04-linux-network.md:618`：同步实际 `scripts/check-network-demo.sh`，确保任一 HTTP、端口、DNS、路由检查失败时最终返回非 0。
- `docs/chapters/stage-01-foundation/06-shell-scripting.md:648` 和 `docs/chapters/stage-01-foundation/06-shell-scripting.md:800`：补充代理环境下本机回环检查需要 `NO_PROXY` 的说明。

## 需要实机复测的命令

```bash
HTTP_PROXY=http://192.168.2.1:7890 \
HTTPS_PROXY=http://192.168.2.1:7890 \
ALL_PROXY=socks5://192.168.2.1:7890 \
NO_PROXY=127.0.0.1,localhost \
no_proxy=127.0.0.1,localhost \
./scripts/dev.sh
```

```bash
HTTP_PROXY=http://192.168.2.1:7890 \
HTTPS_PROXY=http://192.168.2.1:7890 \
ALL_PROXY=socks5://192.168.2.1:7890 \
NO_PROXY=127.0.0.1,localhost \
no_proxy=127.0.0.1,localhost \
./scripts/check.sh
```

```bash
kind create cluster --name todo-dev --image kindest/node:v1.35.0
kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml
kubectl apply -f docs/examples/multi-doc.yaml
kubectl get namespace todo-dev
kubectl -n todo-dev get configmap todo-env
kind delete cluster --name todo-dev
```

```bash
systemctl is-active todo-process-demo
PID="$(systemctl show -p MainPID --value todo-process-demo)"
ps -p "$PID" -o pid,ppid,user,stat,%cpu,%mem,etime,cmd
sudo ss -lntp 'sport = :18080'
curl --noproxy 127.0.0.1,localhost -fsS http://127.0.0.1:18080/healthz
```

## 可加入教材附录的命令清单

详见 `validation-notes/stage-01-command-appendix.md`。

## 验证后清理状态

- `kind get clusters`：无集群。
- `docker ps`：无 kind 临时容器。
- `todo-process-demo`：inactive。
- `todo-network-demo` / `todo-dev-server`：无残留进程。

## 文档仓库验证

- `mkdocs build --strict`：失败，`mkdocs: command not found`。
- `python3 -m mkdocs build --strict`：失败，`No module named mkdocs`。
