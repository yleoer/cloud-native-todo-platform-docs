# 阶段一附录 A：基础环境作品集验收

阶段一的目标不是让你记住一堆命令，而是让你拥有一个可以继续开发、可以排障、可以协作、可以展示的基础工程环境。

完成本附录后，你应该能把前 6 篇的成果整理成一个可验证的作品集：`cloud-native-todo-platform` 仓库中包含目录规范、环境记录、Linux 实验、systemd 服务实验、网络排障实验、Git 协作规范和 Shell 自动化脚本。

## 1. 验收目标

本阶段最终验收关注 5 件事：

| 验收方向 | 你需要证明什么 |
|---|---|
| 环境可用 | Go、Git、Docker、kubectl、kind、Helm 等工具能运行 |
| Linux 基础 | 能管理目录、权限、文本、备份、软链接和环境变量 |
| 服务运行 | 能编译 Go HTTP 程序，并用进程或 systemd 管理 |
| 网络排障 | 能判断端口监听、DNS、HTTP 请求和访问链路问题 |
| 工程协作 | 能通过 Git 分支、PR 模板和 Shell 脚本组织工作 |

## 2. 最终作品集目录

建议在 `cloud-native-todo-platform` 仓库中形成以下结构：

```text linenums="0"
cloud-native-todo-platform/
├── README.md
├── Makefile                       # 建议：统一验收入口
├── go.mod
├── .gitignore
├── .gitattributes
├── .gitmessage
├── .env.example
├── .github/
│   ├── pull_request_template.md
│   └── workflows/
│       └── scripts-check.yml        # 可选：如果已启用脚本 CI
├── api/
│   └── cmd/
│       ├── todo-network-demo/
│       │   └── main.go
│       └── todo-process-demo/
│           └── main.go
├── cmd/
│   └── todo-dev-server/
│       └── main.go
├── deployments/
│   └── systemd/
│       └── todo-process-demo.service
├── docs/
│   ├── contributing/
│   │   └── git-workflow.md
│   ├── examples/
│   │   ├── basic.yaml
│   │   ├── multi-doc.yaml
│   │   └── anchors.yaml
│   ├── environment.md
│   └── stage-01-acceptance.md
├── labs/
│   └── linux-filesystem/
└── scripts/
    ├── check-env.sh
    ├── check-process-service.sh
    ├── versions.conf
    ├── dev.sh
    ├── check.sh
    └── clean.sh
```

如果你的目录和这里不完全一致，没有关系。验收重点是：能说明每个目录的职责，并且能通过命令证明关键文件可用。

## 3. 编写阶段验收文档

创建 `docs/stage-01-acceptance.md`：

````bash linenums="0"
mkdir -p docs

cat > docs/stage-01-acceptance.md <<'EOF'
# 阶段一验收记录

## 基础信息

- 操作系统：
- 终端环境：
- 项目路径：
- 验收日期：

## 工具版本

```text
go version:
git --version:
docker version:
kubectl version --client:
kind version:
helm version:
bash --version:
```

## 实验成果

- [ ] 第 1 篇：完成开发环境安装；确认已有 Kubernetes context，或创建临时 kind 集群后运行 YAML 客户端 dry-run；如果 Docker daemon 可用，再完成可选 kind smoke test。
- [ ] 第 2 篇：完成 Todo 平台 Linux 服务器目录结构。
- [ ] 第 3 篇：完成 Go HTTP 服务 systemd 托管实验。
- [ ] 第 4 篇：完成 Todo HTTP 服务网络访问链路排障。
- [ ] 第 5 篇：完成 Git 分支模型、提交规范和 PR 模板。
- [ ] 第 6 篇：完成 dev.sh、check.sh、clean.sh 自动化脚本。

## 关键验证输出

粘贴以下基础必过命令的关键输出：

- `git status --short --branch`
- `go build ./...`
- `bash -n scripts/*.sh`
- `./scripts/check.sh`
- `kubectl config current-context`
- `kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml`

如果你完成了第 1 篇的可选 kind smoke test，再补充以下增强输出：

- `kind get clusters`
- `kubectl get nodes`
- `kubectl get namespace todo-dev`
- `kubectl -n todo-dev get configmap todo-env`

## 排障复盘

记录至少 2 个你遇到并解决的问题：

1. 问题：
   - 现象：
   - 定位命令：
   - 根因：
   - 修复方法：

2. 问题：
   - 现象：
   - 定位命令：
   - 根因：
   - 修复方法：

## 后续改进

- [ ] 补充 Go 单元测试。
- [ ] 增加 Dockerfile。
- [ ] 增加 GitHub Actions。
- [ ] 增加 Kubernetes 部署 YAML。
EOF
````

这份文档是作品集入口之一。面试或复盘时，它能证明你不是只照抄命令，而是能记录环境、验证结果和排障过程。

## 4. 阶段一统一检查脚本

创建 `scripts/check-foundation.sh`：

```bash linenums="0"
mkdir -p scripts

cat > scripts/check-foundation.sh <<'EOF'
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATUS=0

ok() {
  printf '[ok] %s\n' "$*"
}

fail() {
  printf '[fail] %s\n' "$*" >&2
  STATUS=1
}

check_command() {
  local name="$1"
  if command -v "$name" >/dev/null 2>&1; then
    ok "command found: $name"
  else
    fail "command not found: $name"
  fi
}

check_file() {
  local path="$1"
  if [[ -f "$ROOT_DIR/$path" ]]; then
    ok "file exists: $path"
  else
    fail "file missing: $path"
  fi
}

check_optional_file() {
  local path="$1"
  if [[ -f "$ROOT_DIR/$path" ]]; then
    ok "optional file exists: $path"
  else
    printf '[warn] optional file missing: %s\n' "$path"
  fi
}

main() {
  cd "$ROOT_DIR"

  echo '==> required commands'
  for cmd in go git docker kubectl kind helm bash; do
    check_command "$cmd"
  done

  echo '==> project files'
  check_file README.md
  check_file .gitignore
  check_file .github/pull_request_template.md
  check_file docs/environment.md
  check_file docs/examples/multi-doc.yaml
  check_optional_file docs/stage-01-acceptance.md

  echo '==> scripts'
  check_file scripts/check-env.sh
  check_file scripts/dev.sh
  check_file scripts/check.sh
  check_file scripts/clean.sh

  if compgen -G "scripts/*.sh" >/dev/null; then
    bash -n scripts/*.sh || fail "bash syntax check failed"
  else
    fail "no shell scripts found under scripts/"
  fi

  echo '==> git state'
  git status --short --branch || fail "git status failed"

  echo '==> go packages'
  if [[ -f go.mod ]]; then
    go build ./... || fail "go build failed"
  else
    printf '[warn] go.mod not found, skip go build\n'
  fi

  echo '==> yaml manifests'
  if [[ -f docs/examples/multi-doc.yaml ]]; then
    if kubectl config current-context >/dev/null 2>&1; then
      kubectl apply --dry-run=client --validate=false -f docs/examples/multi-doc.yaml \
        || fail "kubectl yaml dry-run failed"
    else
      printf '[warn] no kubernetes context, skip kubectl dry-run; create a temporary kind cluster before final acceptance\n'
    fi
  else
    fail "file missing: docs/examples/multi-doc.yaml"
  fi

  if [[ "$STATUS" -eq 0 ]]; then
    ok "stage 01 foundation checks passed"
  else
    fail "stage 01 foundation checks failed"
  fi

  exit "$STATUS"
}

main "$@"
EOF

chmod +x scripts/check-foundation.sh
```

运行：

```bash linenums="0"
./scripts/check-foundation.sh
```

如果暂时没有完成某个可选实验，脚本会输出 `warn`，但缺少基础命令、基础文件或 Shell 语法错误应视为必须修复的问题。

## 5. Makefile 统一入口

如果仓库已有 `Makefile`，追加以下目标；如果还没有，可以先创建一个最小版本：

```makefile linenums="0"
.PHONY: check-foundation

check-foundation:
	./scripts/check-foundation.sh
```

运行：

```bash linenums="0"
make check-foundation
```

企业项目中，统一入口比“文档里散落很多命令”更可靠。后续可以把 `make check-foundation` 接入 CI，让阶段一验收变成可重复执行的质量门禁。

## 6. 作品集 README 建议

在项目 `README.md` 中增加阶段一成果说明：

````markdown linenums="0"
## Stage 01 Foundation

This repository has completed the foundation stage:

- Development environment: Go, Git, Docker, kubectl, kind, Helm
- Linux filesystem lab: config, logs, data, permissions, backups
- Linux process lab: Go HTTP service managed by systemd
- Linux networking lab: local HTTP service and troubleshooting workflow
- Git workflow: branch model, commit template, PR template
- Shell automation: dev.sh, check.sh, clean.sh

Verification:

```bash
make check-foundation
```
````

这段说明可以直接帮助别人理解你的阶段一成果。面试时，它也是一个很好的开场材料。

## 7. 三个 Go 服务的差异

阶段一里出现了 3 个 Go HTTP 服务，它们不是重复造轮子，而是在训练 3 种不同工作场景：

| 服务 | 所在章节 | 运行方式 | 配置变量 | 主要训练目标 |
|---|---|---|---|---|
| `todo-process-demo` | 第 3 篇 | 安装到 `/opt/todo-platform/bin`，由 systemd 托管 | `TODO_HTTP_ADDR`、`TODO_PID_FILE` | 理解进程、PID、信号、日志、systemd unit 和服务重启 |
| `todo-network-demo` | 第 4 篇 | 前台运行，方便多终端观察 | `TODO_ADDR` | 理解监听地址、HTTP 请求、DNS、端口和 `tcpdump` 抓包 |
| `todo-dev-server` | 第 6 篇 | 由 `dev.sh` 生成并用 `nohup &` 后台运行 | `.env` 中的 `TODO_HOST`、`TODO_PORT`，脚本内部合成为 `TODO_ADDR` | 理解本地开发入口、PID 文件、健康检查、清理脚本和 CI 脚本检查 |

第 3 篇用 systemd，是为了接近长期运行服务的生产管理方式；第 4 篇前台运行，是为了让日志、端口和抓包现象都直接可见；第 6 篇使用 `nohup &`，是为了本地开发的一键启动体验。环境变量命名也随场景变化：`TODO_HTTP_ADDR` 强调 HTTP 服务地址，`TODO_ADDR` 强调网络监听地址，`TODO_HOST`/`TODO_PORT` 则更适合 `.env` 中拆开配置。

代码层面也有取舍：第 3 篇更接近长期服务，强调信号处理和 systemd 配合；第 4 篇强调监听地址、访问日志和抓包观察；第 6 篇的服务由脚本自动生成，只保留开发自检需要的最小接口，但仍保留 `ReadHeaderTimeout` 这类基础 HTTP 安全设置。

## 8. 阶段综合练习：从零复现

在进入阶段二前，建议做一次可选但很有价值的综合练习：打开一个新终端，或者重新克隆一份仓库，只依赖 `README.md`、`docs/stage-01-acceptance.md` 和 `scripts/` 目录，从零复现阶段一成果。

验收路径建议如下：

```bash linenums="0"
git status --short --branch
go env GOPROXY
grep -n '^GO_PROXY_REQUIRED=https://goproxy.cn,direct$' scripts/versions.conf
./scripts/check-env.sh
go build ./...
bash -n scripts/*.sh
./scripts/check.sh
./scripts/check-foundation.sh
```

如果是在全新的 Ubuntu 24.04 环境中复现，先按第 1 篇 §5.3 完成 apt 源、Docker Engine 源、Go proxy 和核心工具安装；国内网络环境下，建议把 `apt update`、`go env GOPROXY`、`docker info` 的关键输出也写入验收记录。如果使用公司内部源或制品库，记录公司源地址即可，不必强行改成公共镜像。

如果 Docker daemon 可用，再补做第 1 篇的 kind smoke test。这个练习的目的不是多跑几条命令，而是验证你的文档和脚本是否足够自包含：换一个终端、换一台机器、换一个同学，也能把阶段一成果跑起来。

## 9. 出版级能力验收

完成阶段一后，你应该能够独立通过以下验收：

| 能力 | 验收方式 |
|---|---|
| 环境准备 | 能在新机器上说明并安装 Go、Git、Docker、kubectl、kind、Helm |
| Linux 文件 | 能创建 Todo 平台目录结构，并设置合理权限 |
| 进程服务 | 能定位进程、端口、日志，并用 systemd 管理服务 |
| 网络排障 | 能区分 DNS、端口监听、HTTP 状态码和防火墙问题 |
| Git 协作 | 能按 Issue -> Branch -> Commit -> PR -> Review 的流程工作 |
| Shell 自动化 | 能编写可重复执行、可失败、可排障的脚本 |
| 安全意识 | 能解释为什么不能提交密钥、不能乱用 `chmod 777`、不能无确认执行 `rm -rf` |
| 作品集表达 | 能用 README 和验收文档说明自己做了什么、如何验证、遇到什么问题 |

## 10. 常见验收失败

| 现象 | 常见原因 | 处理方式 |
|---|---|---|
| `docker version` 失败 | Docker Engine 未安装、未启动，或当前用户无权限访问 Docker daemon | 执行 `sudo systemctl status docker`，必要时启动 Docker 并检查 `docker` 用户组 |
| `kubectl apply --dry-run=client` 失败 | YAML 格式错误或文件路径不对 | 检查缩进、冒号、文件位置 |
| `kubectl get nodes` 失败 | 这是增强验收；可能没有集群或 kubeconfig 上下文错误 | 执行 `kind get clusters`、`kubectl config get-contexts`，或仅保留基础 dry-run 验收 |
| `bash -n scripts/*.sh` 失败 | Shell 脚本语法错误 | 根据行号修复，再运行 ShellCheck |
| `go build ./...` 失败 | Go 模块未初始化或代码未完成 | 执行 `go mod tidy`，检查包路径 |
| PR 模板仍有占位符 | 创建 PR 前没有替换模板内容 | 补充 Summary、Changes、Verification、Risk |
| 清理脚本误删风险高 | 没有限制删除路径 | 使用 `safe_rm_dir`，并在删除前打印目标路径 |

## 11. 下一阶段衔接

阶段一完成后，项目已经具备后续开发所需的基本地基。进入 Go 阶段前，建议确认：

- `go build ./...` 至少能执行；单元测试会在阶段二逐步补充。
- `scripts/check-foundation.sh` 能运行。
- `README.md` 能说明项目目标和阶段一成果。
- `.gitignore` 已排除日志、构建产物、密钥和本地缓存。
- 你能向别人解释一次服务启动、一次 HTTP 请求和一次 PR 合并的基本过程。

下一阶段会从 Go 基础开始，把这个仓库从“工具链作品集”推进到“可运行的 Todo 业务项目”。
