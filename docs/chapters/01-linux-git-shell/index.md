# 第 1 篇 Linux、Git 与 Shell 基础：搭建云原生学习工作站

## 1. 本章学习目标

学完本篇后，你应该能够独立准备一台适合学习 Go、Docker、Kubernetes 的 Ubuntu 工作站，并掌握后续课程必须用到的基础操作能力。

具体目标包括：

- 理解 Linux 目录结构，知道项目、配置、日志、二进制命令通常放在哪里。
- 熟练使用文件和目录操作命令，如 `ls`、`cd`、`mkdir`、`cp`、`mv`、`rm`、`find`。
- 理解 Linux 用户、用户组、文件权限、`chmod`、`chown` 的基本用法。
- 能查看和管理进程，理解 `ps`、`top`、`kill`、`systemctl` 的作用。
- 能使用 `curl`、`wget`、`ss`、`netstat`、`lsof` 排查网络访问和端口占用问题。
- 会使用 `tar`、`gzip` 处理常见压缩包。
- 掌握 `vim` 最基础的编辑、保存和退出操作。
- 理解环境变量和 `PATH`，知道为什么命令可以被系统找到。
- 能编写一个简单 Shell 脚本检查学习环境。
- 掌握 Git 初始化、提交、分支、合并和远程仓库的基础操作。
- 理解 SSH 登录、SSH Key、`known_hosts` 和远程 Git 认证的基本流程。
- 完成特色项目 **《搭建云原生学习工作站》**。

## 2. 本章工作场景

在真实公司里，Go 后端、DevOps、Kubernetes 运维和平台工程师每天都会接触 Linux 环境。

常见工作场景包括：

- 新入职后拿到一台云服务器，需要安装 Git、curl、vim、make、Docker、kubectl 等工具。
- 后端服务无法启动，需要查看日志目录、配置文件、文件权限和端口占用。
- CI/CD 机器执行脚本失败，需要判断是命令不存在、PATH 配错、权限不足，还是网络不可达。
- Kubernetes 节点出现 Pod 异常，需要登录节点查看进程、端口、磁盘、日志和服务状态。
- 使用 Git 拉取代码、创建分支、提交变更，并通过 SSH Key 访问 GitHub 或 GitLab。

本篇的目标不是把 Linux 学成系统管理员级别，而是建立一套够用、扎实、可迁移的基础能力。后续 Go 项目会放在本篇创建的目录结构下，Dockerfile、Compose、Kubernetes YAML、Helm Chart、Operator 代码也会逐步进入这个项目目录。

## 3. 前置知识

学习本篇前建议具备：

- 会打开终端。
- 知道命令行是通过输入命令与系统交互。
- 对文件、目录、程序、网络请求有基本概念。

不要求你已经熟悉 Linux，也不要求你会 Git 或 Shell。

推荐环境：

- Ubuntu 22.04 LTS 或 Ubuntu 24.04 LTS。
- 可以是真实云服务器、虚拟机、WSL2 Ubuntu，或本地 Linux 机器。
- 当前用户可以使用 `sudo`。
- 能访问常见软件源和 GitHub。如果网络受限，可以使用公司内网源或镜像源。

不同环境的注意点：

| 环境 | 推荐程度 | 注意事项 |
|---|---|---|
| 云服务器 | 推荐 | 最接近真实工作环境，需要注意安全组、防火墙和 SSH 登录方式 |
| 本地虚拟机 | 推荐 | 适合完整练习 systemd、SSH、网络端口和服务管理 |
| WSL2 Ubuntu | 可用 | 适合学习命令和开发，但 systemd、SSH、端口访问可能需要额外配置 |
| 裸机 Linux | 可用 | 操作前要确认不会影响自己的日常系统 |

判断当前系统的 init 进程：

```bash
ps -p 1 -o comm=
```

如果输出是 `systemd`，说明可以完整练习 `systemctl`。如果 WSL2 中不是 `systemd`，建议启用 WSL2 systemd，或者使用虚拟机/云服务器完成本篇 systemd 和 SSH 实验。

## 4. 核心概念

### 4.1 Linux 目录结构

Linux 的目录从根目录 `/` 开始，所有文件、设备、配置、程序都挂在这棵目录树下面。

常见目录：

| 目录 | 作用 | 工作中的例子 |
|---|---|---|
| `/home` | 普通用户主目录 | `/home/student/cloud-native-todo-platform` |
| `/root` | root 用户主目录 | root 用户临时维护脚本 |
| `/etc` | 系统和服务配置 | `/etc/ssh/sshd_config`、`/etc/systemd/system` |
| `/var` | 经常变化的数据 | `/var/log`、`/var/lib/docker` |
| `/usr/bin` | 系统命令 | `git`、`curl`、`vim` |
| `/usr/local/bin` | 用户或手动安装命令 | 自己安装的 `kubectl`、`kind` |
| `/tmp` | 临时文件 | 临时下载、测试文件 |
| `/opt` | 第三方软件 | 企业内部工具包 |

在本课程中，项目会放在用户主目录下：

```text
/home/cnstudent/cloud-native-todo-platform
```

这样做的原因是普通用户有写权限，不需要长期使用 root，后续 Git、Go、Docker、Kubernetes 实验也更安全。

### 4.2 文件和目录操作

常用命令：

```bash
pwd                         # 查看当前目录
ls -lah                     # 查看文件列表，包括隐藏文件和权限
cd /home/cnstudent          # 切换目录
mkdir -p demo/logs          # 创建多级目录
touch demo/app.log          # 创建空文件
cp demo/app.log demo/a.log  # 复制文件
mv demo/a.log demo/b.log    # 移动或重命名文件
rm demo/b.log               # 删除文件
find demo -name "*.log"     # 查找文件
```

这些命令背后的核心是：后端服务、日志、配置、脚本、部署文件都是普通文件。你能熟练操作文件，才有能力排查服务启动失败、配置路径错误、日志找不到等问题。

### 4.3 用户、用户组与权限

Linux 中每个文件都有所有者、所属组和权限。

执行：

```bash
ls -l
```

你会看到类似输出：

```text
-rw-r--r-- 1 cnstudent cnstudent 120 May 25 10:00 README.md
drwxr-xr-x 2 cnstudent cnstudent 4096 May 25 10:00 scripts
```

第一列含义：

- 第 1 个字符表示类型：`-` 是文件，`d` 是目录。
- 后面 9 个字符分三组：所有者、所属组、其他用户。
- `r` 表示读，`w` 表示写，`x` 表示执行或进入目录。

常见权限命令：

```bash
chmod +x scripts/check-workstation.sh
sudo chown -R cnstudent:cnstudent /home/cnstudent/cloud-native-todo-platform
```

`chmod` 修改权限，`chown` 修改所有者。脚本如果没有执行权限，会出现 `Permission denied`。目录如果归 root 所有，普通用户写入时也会失败。

### 4.4 进程管理

程序运行后就是进程。Go API 服务、PostgreSQL、Redis、Docker、kubelet 都是进程。

常用命令：

```bash
ps aux | grep ssh
top
kill <PID>
kill -9 <PID>
```

`kill` 默认发送终止信号，让进程自己退出；`kill -9` 是强制杀死进程，生产环境要谨慎使用，因为它不给程序清理资源的机会。

### 4.5 systemd 基础

`systemd` 是现代 Linux 上常见的服务管理系统。很多后台服务都由它管理，例如 SSH、Docker、containerd。

常用命令：

```bash
sudo systemctl status ssh
sudo systemctl start ssh
sudo systemctl stop ssh
sudo systemctl restart ssh
sudo systemctl enable ssh
```

`start` 是现在启动，`enable` 是开机自启。真实生产环境中，服务是否开机自动恢复是稳定性的一部分。

### 4.6 网络基础命令

后端服务和 Kubernetes 排障离不开网络命令。

```bash
ip addr                         # 查看网卡和 IP 地址
ip route                        # 查看路由表
ping -c 3 github.com            # 测试网络连通性，部分网络可能禁用 ICMP
getent hosts github.com         # 使用系统解析链路查看 DNS 结果
curl -I https://github.com       # 发起 HTTP 请求，只看响应头
wget https://example.com/file    # 下载文件
ss -lntp                         # 查看 TCP 监听端口和进程
netstat -lntp                    # 旧工具，很多系统需要 net-tools
lsof -i :22                      # 查看哪个进程占用了 22 端口
```

判断思路：

- `curl` 失败，先区分是 DNS、网络、TLS 还是服务本身问题。
- `ss` 看不到端口监听，说明服务可能没有启动或监听地址不对。
- `lsof` 能看到占用端口的进程，适合定位端口冲突。
- `ip route` 能帮助判断默认网关是否存在，很多“完全无法访问外网”的问题都和路由有关。

### 4.7 tar、gzip 与压缩包

Linux 上常见源码包、日志包、备份包经常是 `.tar.gz`。

```bash
tar -czf logs.tar.gz logs/      # 压缩 logs 目录
tar -tzf logs.tar.gz            # 查看压缩包内容
tar -xzf logs.tar.gz            # 解压
gzip app.log                    # 压缩单个文件
gunzip app.log.gz               # 解压单个 gzip 文件
```

`tar` 负责打包多个文件，`gzip` 负责压缩数据。`.tar.gz` 通常表示先打包再压缩。

### 4.8 vim 基础

`vim` 是服务器上最常见的文本编辑器之一。新手至少要会打开、编辑、保存、退出。

```bash
vim README.md
```

常用操作：

| 操作 | 按键 |
|---|---|
| 进入插入模式 | `i` |
| 退出插入模式 | `Esc` |
| 保存 | `:w` |
| 保存并退出 | `:wq` |
| 不保存退出 | `:q!` |
| 搜索 | `/keyword` |

### 4.9 环境变量与 PATH

环境变量是进程运行时可读取的一组键值。

查看环境变量：

```bash
env
echo $HOME
echo $PATH
```

`PATH` 决定系统去哪些目录寻找命令。例如你输入 `git`，系统会在 `PATH` 中列出的目录里查找名为 `git` 的可执行文件。

临时添加路径：

```bash
export PATH="$HOME/bin:$PATH"
```

永久添加路径：

```bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

后续安装 Go、kubectl、kind 时，经常会遇到命令安装好了但执行不了，很多时候就是 `PATH` 没配好。

### 4.10 Shell 脚本基础

Shell 脚本就是把一组命令组织成可重复执行的自动化流程。

基本结构：

```bash
#!/usr/bin/env bash
set -euo pipefail

echo "hello cloud native"
```

关键点：

- `#!/usr/bin/env bash` 指定用 Bash 运行脚本。
- `set -e` 遇到错误立即退出。
- `set -u` 使用未定义变量时报错。
- `set -o pipefail` 管道中任一命令失败都会让脚本失败。

### 4.11 Git 基础与分支

Git 用来管理代码版本。

常用命令：

```bash
git init
git status
git add .
git commit -m "init project"
git branch feature/setup-workstation
git switch feature/setup-workstation
git switch main
git merge feature/setup-workstation
```

分支的意义是让不同需求并行开发。真实团队里通常不会直接在 `main` 分支上改代码，而是在功能分支开发，通过 Pull Request 或 Merge Request 合并。

### 4.12 SSH 基础

SSH 常用于远程登录服务器，也用于 GitHub / GitLab 的免密认证。

核心文件：

| 文件 | 作用 |
|---|---|
| `~/.ssh/id_ed25519` | 私钥，只能自己保存 |
| `~/.ssh/id_ed25519.pub` | 公钥，可以放到服务器或 Git 平台 |
| `~/.ssh/authorized_keys` | 允许登录当前机器的公钥列表 |
| `~/.ssh/known_hosts` | 已信任的远程主机指纹 |

生成 SSH Key：

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

私钥绝不能提交到 Git 仓库，也不要发给别人。

## 5. 原理深入

### 5.1 Linux 命令是如何被执行的

当你输入：

```bash
git --version
```

Shell 会按这个流程处理：

1. 解析命令和参数。
2. 判断 `git` 是不是 Shell 内置命令。
3. 如果不是，就到 `PATH` 指定的目录中查找可执行文件。
4. 找到后启动新进程执行。
5. 命令结束后返回退出码。

退出码很重要：

- `0` 表示成功。
- 非 `0` 表示失败。

Shell 脚本、CI/CD 流水线和 Kubernetes 探针都会依赖退出码判断命令是否成功。

### 5.2 权限判断流程

当用户访问一个文件时，Linux 大致按以下逻辑判断权限：

1. 当前用户是否是文件所有者。
2. 如果不是，当前用户是否属于文件所属组。
3. 如果也不是，就按其他用户权限判断。
4. 对目录来说，`x` 权限表示能进入目录，`r` 权限表示能列出目录内容。

例如：

```text
drwxr-x--- 2 app app 4096 May 25 10:00 config
```

含义是：

- `app` 用户可以读、写、进入目录。
- `app` 组用户可以读和进入，但不能写。
- 其他用户没有权限。

### 5.3 systemd 如何管理服务

`systemd` 通过 unit 文件描述服务如何启动、停止、重启和开机自启。

一个服务通常包含：

- `Unit`：服务描述和依赖。
- `Service`：启动命令、运行用户、重启策略。
- `Install`：是否加入开机启动目标。

后续 Docker、containerd、kubelet 都会以 systemd 服务形式运行。理解 `systemctl status`、`journalctl -u`，对排查 Docker 和 Kubernetes 节点问题非常关键。

还要注意一点：systemd 启动服务时不会自动读取你的 `~/.bashrc`。交互式终端里的 `PATH`、`HOME`、自定义环境变量，不一定会出现在 systemd 服务中。所以生产服务通常要在 unit 文件中显式写清楚 `User`、`WorkingDirectory`、`Environment` 和 `ExecStart`。

### 5.4 网络排查的基本链路

一次 HTTP 请求失败时，不要只盯着一个命令，应该按链路排查：

```text
域名能否解析
  -> 网络是否可达
  -> 目标端口是否监听
  -> 防火墙是否阻断
  -> 服务是否正常响应
  -> 应用日志是否报错
```

常用组合：

```bash
getent hosts github.com
ping -c 3 github.com
curl -Iv https://github.com
ss -lntp
lsof -i :8080
```

### 5.5 Git 分支的本质

Git 的提交是一个个快照，分支本质上是指向某个提交的指针。

当你在功能分支提交代码时，`main` 不会被影响。合并时，Git 会把功能分支的提交引入 `main`。如果两条分支改了同一段内容，就可能产生冲突，需要人工判断保留哪一部分。

### 5.6 SSH 登录的基本流程

SSH Key 登录大致流程：

1. 客户端持有私钥。
2. 服务端保存对应公钥。
3. 客户端发起连接。
4. 服务端要求客户端证明自己拥有私钥。
5. 验证通过后允许登录。

这个过程不会把私钥发给服务端。安全前提是私钥不泄露，权限不能过宽。

## 6. 手把手实验

### 6.1 实验目标

完成特色项目 **《搭建云原生学习工作站》**。

本实验会完成：

- 准备 Ubuntu 22.04 或 24.04。
- 创建普通用户 `cnstudent` 并配置 sudo 权限。
- 安装 Git、curl、wget、vim、make、net-tools、lsof、openssh-server。
- 启动并验证 SSH 服务。
- 配置 Git 用户信息。
- 创建 `Cloud Native Todo Platform` 后续项目目录结构。
- 编写 `check-workstation.sh` 环境检查脚本。
- 编写 `Makefile`，用 `make check` 统一执行环境检查。
- 初始化 Git 仓库并创建第一个分支。
- 可选配置远程 Git 仓库，为后续代码托管做准备。

### 6.2 实验环境

推荐环境：

```text
操作系统：Ubuntu 22.04 LTS 或 Ubuntu 24.04 LTS
当前用户：具备 sudo 权限
Shell：bash
网络：可以访问 Ubuntu 软件源
```

查看系统版本：

```bash
lsb_release -a
```

预期输出类似：

```text
Distributor ID: Ubuntu
Description:    Ubuntu 22.04.5 LTS
Release:        22.04
Codename:       jammy
```

或：

```text
Description:    Ubuntu 24.04 LTS
Release:        24.04
```

确认是否使用 systemd：

```bash
ps -p 1 -o comm=
```

预期输出：

```text
systemd
```

如果输出不是 `systemd`，说明当前环境可能是未启用 systemd 的 WSL2 或容器环境。本篇大多数 Linux、Git、Shell 命令仍可学习，但 `systemctl` 相关实验建议换到虚拟机、云服务器，或先启用 WSL2 systemd。

### 6.3 文件目录结构

实验完成后的目录结构：

```text
/home/cnstudent/cloud-native-todo-platform/
├── Makefile
├── README.md
├── api/
│   ├── cmd/
│   ├── internal/
│   ├── migrations/
│   └── tests/
├── cli/
├── deployments/
│   ├── docker-compose/
│   ├── helm/
│   ├── k8s-yaml/
│   └── kustomize/
│       ├── base/
│       └── overlays/
│           ├── dev/
│           ├── test/
│           └── prod/
├── docs/
├── observability/
│   ├── grafana/
│   ├── loki/
│   └── prometheus/
├── operator/
└── scripts/
    └── check-workstation.sh
```

### 6.4 创建普通用户并配置 sudo

如果你已经有普通用户并且能执行 `sudo`，可以跳过创建用户，只保留验证步骤。

创建用户：

```bash
sudo adduser cnstudent
```

这条命令会创建 `/home/cnstudent`，并提示设置密码。普通用户用于日常学习，避免长期使用 root。

加入 sudo 组：

```bash
sudo usermod -aG sudo cnstudent
```

`-aG` 表示追加到指定用户组。不要漏掉 `-a`，否则可能覆盖用户已有组。

切换用户：

```bash
su - cnstudent
```

验证 sudo：

```bash
sudo whoami
```

预期输出：

```text
root
```

这表示 `cnstudent` 可以临时以 root 权限执行管理命令。

### 6.5 安装基础工具

更新软件索引：

```bash
sudo apt update
```

安装工具：

```bash
sudo apt install -y git curl wget vim make net-tools lsof openssh-server ca-certificates tar gzip iproute2 iputils-ping procps
```

为什么安装这些工具：

- `git`：管理课程代码。
- `curl`、`wget`：测试 HTTP 请求和下载文件。
- `vim`：在服务器上编辑配置。
- `make`：后续统一构建命令。
- `net-tools`：提供 `netstat` 等旧工具，方便兼容学习。
- `lsof`：查看端口和文件被哪个进程占用。
- `openssh-server`：提供 SSH 登录能力。
- `ca-certificates`：访问 HTTPS 地址时验证证书。
- `tar`、`gzip`：处理压缩包。
- `iproute2`：提供 `ip`、`ss` 等现代网络工具。
- `iputils-ping`：提供 `ping`，用于基础连通性测试。
- `procps`：提供 `ps`、`top` 等进程查看工具。

验证安装：

```bash
git --version
curl --version
wget --version
vim --version | head -n 1
make --version | head -n 1
netstat --version
lsof -v 2>&1 | head -n 1
ip -Version
ping -V
ps --version | head -n 1
```

预期输出会显示各工具版本。

### 6.6 配置和验证 SSH

启动 SSH 服务：

```bash
sudo systemctl enable --now ssh
```

`--now` 表示立即启动，`enable` 表示开机自启。

查看服务状态：

```bash
sudo systemctl status ssh --no-pager
```

预期看到：

```text
Active: active (running)
```

查看 22 端口监听：

```bash
ss -lntp | grep ':22'
```

如果系统没有权限显示进程名，可以使用：

```bash
sudo ss -lntp | grep ':22'
```

预期输出类似：

```text
LISTEN 0 4096 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=...,fd=...))
```

本机测试 SSH：

```bash
ssh localhost
```

首次连接会提示确认主机指纹，输入 `yes`。随后会要求输入当前用户密码。这里测试的是“这台机器的 SSH 服务是否可用”，不是 GitHub/GitLab 的免密登录。

登录成功后执行：

```bash
exit
```

生成 SSH Key：

```bash
ssh-keygen -t ed25519 -C "cnstudent@example.com"
```

如果只是学习，可以一路回车使用默认路径。查看公钥：

```bash
cat ~/.ssh/id_ed25519.pub
```

这段公钥可以添加到 GitHub / GitLab 的 SSH Keys 中，用于后续拉取和推送代码。

保护私钥权限：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
chmod 644 ~/.ssh/id_ed25519.pub
```

如果你已经把公钥添加到了 GitHub，可以验证 Git SSH 认证：

```bash
ssh -T git@github.com
```

成功时通常会看到类似输出：

```text
Hi <username>! You've successfully authenticated, but GitHub does not provide shell access.
```

如果你使用 GitLab，可以验证：

```bash
ssh -T git@gitlab.com
```

如果还没有把公钥添加到 Git 平台，这一步可能返回 `Permission denied (publickey)`。这不是本机 SSH 服务失败，而是远程 Git 平台没有信任你的公钥。

### 6.7 配置 Git

设置 Git 用户信息：

```bash
git config --global user.name "Cloud Native Student"
git config --global user.email "cnstudent@example.com"
git config --global init.defaultBranch main
```

这些信息会写入提交记录。企业协作中，提交者信息用于代码审计和责任追踪。

查看配置：

```bash
git config --global --list
```

预期输出包含：

```text
user.name=Cloud Native Student
user.email=cnstudent@example.com
init.defaultbranch=main
```

### 6.8 创建项目目录结构

进入用户主目录：

```bash
cd ~
```

创建项目目录：

```bash
mkdir -p cloud-native-todo-platform/{api/{cmd,internal,migrations,tests},cli,scripts,deployments/{docker-compose,k8s-yaml,helm,kustomize/{base,overlays/{dev,test,prod}}},observability/{prometheus,grafana,loki},operator,docs}
```

这条命令使用 Bash 的花括号展开，一次创建多级目录。

进入项目：

```bash
cd ~/cloud-native-todo-platform
```

创建 README：

```bash
cat > README.md <<'EOF'
# Cloud Native Todo Platform

This repository is used to learn Go backend development, Docker, Kubernetes, CI/CD, observability, and Operator development.
EOF
```

这里用 `cat > file <<'EOF'` 是为了快速写入一个小文件。正式编辑复杂文件时可以使用 `vim`。

创建 `Makefile`：

```bash
cat > Makefile <<'EOF'
.PHONY: check tree

check:
	./scripts/check-workstation.sh

tree:
	find . -maxdepth 4 -type d | sort
EOF
```

`Makefile` 的作用是把常用命令收敛成稳定入口。后续课程会继续增加 `make test`、`make build`、`make docker-build`、`make deploy` 等目标。注意 `Makefile` 中命令前面必须是 Tab，不是普通空格。

查看目录：

```bash
find . -maxdepth 4 -type d | sort
```

### 6.9 编写环境检查脚本

创建脚本：

```bash
vim scripts/check-workstation.sh
```

按 `i` 进入插入模式，粘贴下面完整代码：

```bash
#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="${PROJECT_ROOT:-$HOME/cloud-native-todo-platform}"
CHECK_SUDO="${CHECK_SUDO:-1}"
REQUIRED_COMMANDS=(git curl wget vim make tar gzip ssh ss lsof ip ping getent ps)

info() {
  printf '[INFO] %s\n' "$1"
}

ok() {
  printf '[ OK ] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1" >&2
  exit 1
}

check_os() {
  info "checking operating system"

  if [[ ! -f /etc/os-release ]]; then
    fail "/etc/os-release not found"
  fi

  # shellcheck disable=SC1091
  source /etc/os-release

  if [[ "${ID:-}" != "ubuntu" ]]; then
    fail "expected Ubuntu, got ${PRETTY_NAME:-unknown}"
  fi

  case "${VERSION_ID:-}" in
    "22.04"|"24.04")
      ok "Ubuntu ${VERSION_ID} detected"
      ;;
    *)
      fail "expected Ubuntu 22.04 or 24.04, got ${VERSION_ID:-unknown}"
      ;;
  esac
}

check_sudo() {
  info "checking sudo permission"

  if [[ "$CHECK_SUDO" == "0" ]]; then
    ok "sudo check skipped by CHECK_SUDO=0"
    return
  fi

  if [[ "$(id -u)" == "0" ]]; then
    ok "current user is root"
    return
  fi

  if sudo -n true 2>/dev/null; then
    ok "current user can run sudo without password prompt"
    return
  fi

  if sudo -v; then
    ok "current user can run sudo"
  else
    fail "current user cannot run sudo"
  fi
}

is_systemd() {
  [[ "$(ps -p 1 -o comm=)" == "systemd" ]]
}

check_commands() {
  info "checking required commands"

  for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if command -v "$cmd" >/dev/null 2>&1; then
      ok "$cmd found at $(command -v "$cmd")"
    else
      fail "$cmd not found"
    fi
  done
}

check_ssh_service() {
  info "checking ssh service"

  if is_systemd; then
    if systemctl is-active --quiet ssh; then
      ok "ssh service is running"
    else
      fail "ssh service is not running"
    fi
  else
    info "systemd is not PID 1; skip systemctl check and verify port only"
  fi

  if ss -lnt | awk '{print $4}' | grep -Eq '(^|:|\])22$'; then
    ok "port 22 is listening"
  else
    fail "port 22 is not listening"
  fi
}

check_git_config() {
  info "checking git config"

  local name
  local email
  name="$(git config --global user.name || true)"
  email="$(git config --global user.email || true)"

  [[ -n "$name" ]] || fail "git user.name is empty"
  [[ -n "$email" ]] || fail "git user.email is empty"

  ok "git user.name=$name"
  ok "git user.email=$email"
}

check_project_dirs() {
  info "checking project directories"

  local dirs=(
    "$PROJECT_ROOT/api"
    "$PROJECT_ROOT/cli"
    "$PROJECT_ROOT/scripts"
    "$PROJECT_ROOT/deployments/docker-compose"
    "$PROJECT_ROOT/deployments/k8s-yaml"
    "$PROJECT_ROOT/deployments/helm"
    "$PROJECT_ROOT/deployments/kustomize/base"
    "$PROJECT_ROOT/deployments/kustomize/overlays/dev"
    "$PROJECT_ROOT/deployments/kustomize/overlays/test"
    "$PROJECT_ROOT/deployments/kustomize/overlays/prod"
    "$PROJECT_ROOT/observability/prometheus"
    "$PROJECT_ROOT/observability/grafana"
    "$PROJECT_ROOT/observability/loki"
    "$PROJECT_ROOT/operator"
    "$PROJECT_ROOT/docs"
  )

  for dir in "${dirs[@]}"; do
    if [[ -d "$dir" ]]; then
      ok "directory exists: $dir"
    else
      fail "directory missing: $dir"
    fi
  done
}

check_path() {
  info "checking PATH"

  if [[ ":$PATH:" == *":$HOME/bin:"* ]]; then
    ok "\$HOME/bin is in PATH"
  else
    info "\$HOME/bin is not in PATH; this is acceptable now, but useful later"
  fi
}

main() {
  check_os
  check_sudo
  check_commands
  check_ssh_service
  check_git_config
  check_project_dirs
  check_path
  ok "cloud native workstation check passed"
}

main "$@"
```

保存退出：

```text
Esc
:wq
```

给脚本执行权限：

```bash
chmod +x scripts/check-workstation.sh
```

执行脚本：

```bash
./scripts/check-workstation.sh
```

也可以通过 `make` 执行：

```bash
make check
```

预期输出类似：

```text
[INFO] checking operating system
[ OK ] Ubuntu 22.04 detected
[INFO] checking sudo permission
[ OK ] current user can run sudo
[INFO] checking required commands
[ OK ] git found at /usr/bin/git
[ OK ] curl found at /usr/bin/curl
[ OK ] wget found at /usr/bin/wget
...
[ OK ] cloud native workstation check passed
```

### 6.10 初始化 Git 仓库并创建分支

初始化仓库：

```bash
git init
```

查看状态：

```bash
git status
```

创建 `.gitignore`：

```bash
cat > .gitignore <<'EOF'
.env
*.log
*.tar.gz
tmp/
dist/
bin/
coverage.out
EOF
```

提交代码：

```bash
git add .
git commit -m "init cloud native todo platform workspace"
```

创建功能分支：

```bash
git switch -c feature/workstation-check
```

修改 README：

```bash
printf '\n## Workstation\n\nRun scripts/check-workstation.sh before starting the course.\n' >> README.md
```

提交分支变更：

```bash
git add README.md
git commit -m "docs: add workstation check instruction"
```

切回 main 并合并：

```bash
git switch main
git merge feature/workstation-check
```

查看提交历史：

```bash
git log --oneline --graph --decorate --all
```

如果你已经在 GitHub 或 GitLab 创建了远程仓库，可以记录远程地址：

```bash
git remote add origin git@github.com:<your-name>/cloud-native-todo-platform.git
git remote -v
```

`<your-name>` 要替换成你的真实用户名或组织名。远程仓库还没创建时不要急着执行 `git push`，否则会得到仓库不存在或无权限的错误。

远程仓库已经准备好并且 SSH Key 验证通过后，可以推送：

```bash
git push -u origin main
```

`-u` 会把本地 `main` 和远程 `origin/main` 建立跟踪关系，后续可以直接使用 `git push`。

### 6.11 systemd 小实验

创建一个一次性服务，用来理解 systemd 如何运行命令：

```bash
sudo vim /etc/systemd/system/workstation-check.service
```

写入：

```ini
[Unit]
Description=Cloud Native Workstation Check
After=network.target

[Service]
Type=oneshot
User=cnstudent
Environment=PROJECT_ROOT=/home/cnstudent/cloud-native-todo-platform
Environment=CHECK_SUDO=0
WorkingDirectory=/home/cnstudent/cloud-native-todo-platform
ExecStart=/home/cnstudent/cloud-native-todo-platform/scripts/check-workstation.sh

[Install]
WantedBy=multi-user.target
```

关键字段解释：

- `Description`：服务说明。
- `After=network.target`：网络目标启动后再运行。
- `Type=oneshot`：执行一次命令后退出，适合检查脚本。
- `User=cnstudent`：用普通用户运行服务，更接近生产环境的最小权限实践。
- `Environment=PROJECT_ROOT=...`：显式告诉脚本项目目录在哪里。systemd 服务默认不会读取你的 `~/.bashrc`，运行用户不同时 `$HOME` 也可能不同，所以这里不能依赖交互式终端中的环境变量。
- `Environment=CHECK_SUDO=0`：跳过 sudo 交互检查。systemd 是非交互环境，不能像终端那样输入 sudo 密码。
- `WorkingDirectory`：服务执行时所在目录。
- `ExecStart`：真正执行的命令。
- `WantedBy=multi-user.target`：允许服务加入正常多用户启动目标。

重新加载 systemd 配置：

```bash
sudo systemctl daemon-reload
```

手动运行服务：

```bash
sudo systemctl start workstation-check
```

查看状态：

```bash
sudo systemctl status workstation-check --no-pager
```

查看日志：

```bash
sudo journalctl -u workstation-check --no-pager
```

预期能看到环境检查脚本输出。

### 6.12 tar 和 gzip 验证

打包脚本和文档：

```bash
tar -czf workstation-backup.tar.gz README.md scripts docs
```

查看压缩包内容：

```bash
tar -tzf workstation-backup.tar.gz
```

解压到临时目录验证：

```bash
mkdir -p /tmp/workstation-backup-test
tar -xzf workstation-backup.tar.gz -C /tmp/workstation-backup-test
find /tmp/workstation-backup-test -maxdepth 2 -type f | sort
```

### 6.13 网络命令验证

查看本机 IP：

```bash
ip addr
```

重点看：

- `lo` 是本地回环网卡，常见地址是 `127.0.0.1`。
- `eth0`、`ens33`、`enp0s3` 等通常是真实网卡或虚拟网卡。
- `inet` 后面的地址是 IPv4 地址。

查看默认路由：

```bash
ip route
```

预期能看到类似：

```text
default via 172.20.0.1 dev eth0
```

`default` 表示默认出口。如果没有默认路由，访问外网通常会失败。

测试 DNS 解析：

```bash
getent hosts github.com
```

预期输出会包含 GitHub 对应的 IP。`getent hosts` 使用系统配置的解析链路，比只看某个 DNS 工具更接近日常程序的解析方式。

测试基础连通性：

```bash
ping -c 3 github.com
```

如果公司网络或云安全策略禁用了 ICMP，`ping` 可能失败；此时继续用 `curl` 测试 HTTPS。如果 `ping` 失败但 `curl` 成功，通常说明 HTTP 访问可用。

测试 HTTPS：

```bash
curl -I https://github.com
```

`-I` 表示只请求响应头，不下载完整页面。预期能看到 `HTTP/2 200`、`HTTP/1.1 200` 或重定向状态码。

下载测试：

```bash
wget -O /tmp/github.html https://github.com
```

`-O` 指定保存路径，避免下载到当前项目目录，保持仓库干净。

查看 SSH 端口：

```bash
ss -lntp | grep ':22' || sudo ss -lntp | grep ':22'
netstat -lntp 2>/dev/null | grep ':22' || sudo netstat -lntp | grep ':22'
lsof -i :22 || sudo lsof -i :22
```

这些命令用于从不同角度证明：SSH 服务启动了，22 端口正在监听，并且能定位到对应进程。

### 6.14 验证方法

最终执行：

```bash
cd ~/cloud-native-todo-platform
./scripts/check-workstation.sh
make check
git status
git branch
sudo systemctl status ssh --no-pager
ss -lntp | grep ':22' || sudo ss -lntp | grep ':22'
ip route
```

合格标准：

- 检查脚本最终输出 `cloud native workstation check passed`。
- `make check` 可以正常调用检查脚本。
- `git status` 显示工作区干净。
- 当前至少有 `main` 分支。
- SSH 服务处于 `active (running)`。
- 22 端口处于监听状态。
- 项目目录结构完整。
- `ip route` 中存在默认路由，或者你能解释当前实验环境为什么不需要外网默认路由。

### 6.15 清理步骤

如果你只是练习 systemd，可以清理测试服务：

```bash
sudo systemctl stop workstation-check || true
sudo systemctl disable workstation-check || true
sudo rm -f /etc/systemd/system/workstation-check.service
sudo systemctl daemon-reload
```

清理压缩包和临时目录：

```bash
rm -f ~/cloud-native-todo-platform/workstation-backup.tar.gz
rm -rf /tmp/workstation-backup-test
rm -f /tmp/github.html
```

不建议删除 `cloud-native-todo-platform` 项目目录，因为后续课程会继续使用。

## 7. 真实工作案例

一家团队准备把旧的后端服务迁移到 Kubernetes。你作为新加入的后端工程师或 DevOps 工程师，通常会先做这些事情：

1. 登录公司分配的 Ubuntu 开发机。
2. 检查用户是否有 sudo 权限。
3. 安装 Git、curl、vim、make、Docker、kubectl 等工具。
4. 配置 SSH Key，从 GitLab 拉取代码。
5. 执行项目提供的 `make setup` 或 `scripts/check-env.sh`。
6. 发现服务启动失败，通过 `ss`、`lsof` 定位端口冲突。
7. 发现脚本无法执行，通过 `chmod +x` 修复权限。
8. 发现服务无法访问，通过 `curl` 判断是网络问题还是应用问题。
9. 发现后台服务没启动，通过 `systemctl status` 和 `journalctl` 查看原因。

这些能力看起来基础，但它们是后续所有工程能力的地基。不会排查 Linux 基础问题，写再多 Kubernetes YAML 也很容易卡住。

## 8. 常见错误

| 错误现象 | 常见原因 | 修复方式 |
|---|---|---|
| `Permission denied` | 脚本没有执行权限，或目录归 root 所有 | `chmod +x script.sh`，必要时 `chown` |
| `command not found` | 工具未安装，或 PATH 没配置 | `apt install` 安装工具，检查 `echo $PATH` |
| `sudo: command not found` | 最小系统未安装 sudo | 用 root 安装 `sudo` 并配置用户 |
| `user is not in the sudoers file` | 用户没有 sudo 权限 | root 执行 `usermod -aG sudo 用户名` |
| `Address already in use` | 端口被其他进程占用 | `lsof -i :端口` 找到进程并处理 |
| `ssh: connect to host localhost port 22: Connection refused` | SSH 服务未启动或未安装 | 安装 `openssh-server`，启动 `ssh` 服务 |
| Git 提交失败提示 unknown author | 未配置 Git 用户信息 | 设置 `git config --global user.name/user.email` |
| `fatal: not a git repository` | 当前目录不是 Git 仓库 | 进入正确目录或执行 `git init` |
| vim 退出不了 | 不熟悉 vim 模式 | 按 `Esc` 后输入 `:q!` 或 `:wq` |
| SSH 私钥权限过宽 | 私钥文件可被其他用户读取 | `chmod 600 ~/.ssh/id_ed25519` |
| `System has not been booted with systemd` | WSL2 或容器环境没有使用 systemd 作为 PID 1 | 使用虚拟机/云服务器，或启用 WSL2 systemd |
| `Permission denied (publickey)` | Git 平台没有配置你的公钥，或 SSH 使用了错误私钥 | 上传公钥，检查 `ssh -T git@github.com` |
| `REMOTE HOST IDENTIFICATION HAS CHANGED` | 远程主机指纹变化，或 `known_hosts` 中记录不一致 | 确认不是中间人风险后清理对应 known_hosts 记录 |
| `make: *** missing separator` | Makefile 命令行用了空格而不是 Tab | 把目标下面的命令缩进改成 Tab |

## 9. 排障方法

### 9.1 命令不存在

现象：

```text
git: command not found
```

排查：

```bash
command -v git
echo $PATH
dpkg -l | grep '^ii' | grep git
```

判断：

- `command -v git` 没输出，说明当前 PATH 找不到。
- `dpkg` 没看到 git，说明没有安装。

修复：

```bash
sudo apt update
sudo apt install -y git
```

### 9.2 脚本无法执行

现象：

```text
bash: ./scripts/check-workstation.sh: Permission denied
```

排查：

```bash
ls -l scripts/check-workstation.sh
```

如果看到：

```text
-rw-r--r--
```

说明没有执行权限。

修复：

```bash
chmod +x scripts/check-workstation.sh
```

### 9.3 目录无法写入

现象：

```text
Permission denied
```

排查：

```bash
pwd
ls -ld .
id
```

判断：

- `ls -ld .` 查看目录所有者。
- `id` 查看当前用户和用户组。

修复：

```bash
sudo chown -R "$USER:$USER" ~/cloud-native-todo-platform
```

### 9.4 端口被占用

现象：

```text
listen tcp :8080: bind: address already in use
```

排查：

```bash
ss -lntp | grep ':8080' || sudo ss -lntp | grep ':8080'
lsof -i :8080 || sudo lsof -i :8080
```

判断：

- 如果能看到进程名和 PID，说明端口已被占用。

修复：

```bash
kill <PID>
```

如果进程无法正常退出，再考虑：

```bash
kill -9 <PID>
```

生产环境不要轻易 `kill -9`，先确认进程作用和影响范围。

### 9.5 SSH 服务异常

排查：

```bash
sudo systemctl status ssh --no-pager
sudo journalctl -u ssh --no-pager -n 100
sudo ss -lntp | grep ':22'
```

判断：

- `inactive` 表示服务没启动。
- `failed` 表示服务启动失败。
- 没有 22 端口监听，说明 sshd 没有正常对外提供服务。

修复：

```bash
sudo apt install -y openssh-server
sudo systemctl enable --now ssh
sudo systemctl restart ssh
```

如果报错：

```text
System has not been booted with systemd as init system
```

先确认 PID 1：

```bash
ps -p 1 -o comm=
```

如果不是 `systemd`，说明当前环境不能直接练习 `systemctl`。WSL2 可以启用 systemd，容器环境则通常不适合练习 systemd 服务管理。

### 9.6 SSH Key 或 Git 远程认证失败

现象：

```text
Permission denied (publickey).
```

排查：

```bash
ls -l ~/.ssh
ssh -vT git@github.com
git remote -v
```

判断：

- `~/.ssh/id_ed25519.pub` 是否已经添加到 GitHub/GitLab。
- 私钥权限是否是 `600`。
- `git remote -v` 是否使用了 SSH 地址，而不是 HTTPS 地址。
- `ssh -vT` 中是否显示尝试使用了你的私钥。

修复：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

把公钥内容添加到 GitHub/GitLab 后，再执行：

```bash
ssh -T git@github.com
```

### 9.7 网络访问失败

排查顺序：

```bash
ip addr
ip route
getent hosts github.com
ping -c 3 github.com
curl -Iv https://github.com
```

判断：

- `ip addr` 没有有效地址，先检查网卡或虚拟机网络。
- `ip route` 没有 `default`，通常无法访问外网。
- `getent hosts` 没输出，可能是 DNS 问题。
- `ping` 失败但 `curl` 成功，可能只是 ICMP 被禁。
- `curl -Iv` 可以看到 TLS、HTTP 状态码和连接过程。

修复方向：

- 检查云服务器安全组、虚拟机 NAT、公司代理或 DNS 配置。
- 如果使用代理，需要为终端配置 `http_proxy`、`https_proxy`。
- 如果只有 GitHub 失败，考虑使用公司允许的镜像源或内部 Git 平台。

### 9.8 Git 分支混乱

排查：

```bash
git status
git branch
git log --oneline --graph --decorate --all
```

判断：

- `git status` 看当前分支和未提交文件。
- `git branch` 看本地分支。
- `git log --graph` 看提交关系。

修复思路：

- 未提交的工作先 `git add` + `git commit`，或用 `git stash` 暂存。
- 不确定时先不要使用 `reset --hard`，避免丢失代码。

## 10. 生产环境注意事项

- 不要长期使用 root 用户开发和运行服务。生产服务应使用最小权限用户。
- 不要把私钥、密码、Token、`.env` 文件提交到 Git 仓库。
- 不要随意 `chmod 777`。它虽然能快速绕过权限问题，但会带来安全风险。
- 不要在生产环境直接 `kill -9` 关键进程，先确认服务角色、流量影响和重启策略。
- 修改 systemd 服务后必须执行 `sudo systemctl daemon-reload`。
- systemd 服务不要依赖 `~/.bashrc` 中的环境变量，生产配置应通过 unit 文件、配置文件或 Secret 管理。
- 开放 SSH 端口时要配合防火墙、安全组、强密码或密钥登录策略。
- 生产服务器应限制 SSH root 登录，优先使用普通用户 + sudo。
- 脚本中要使用 `set -euo pipefail` 提前暴露错误，避免失败后继续执行危险操作。
- 日志和备份压缩包要注意磁盘占用，避免 `/var` 或根分区被写满。
- 在团队协作中，Git 提交信息要清晰，分支要短生命周期，敏感信息要通过 Secret 管理。
- 团队项目应把常用动作收敛到 `Makefile` 或脚本中，减少“每个人手动敲一套命令”的环境漂移。

## 11. 本章小项目

本章小项目：**搭建云原生学习工作站**

交付物：

- 一台 Ubuntu 22.04 或 24.04 机器。
- 普通用户 `cnstudent`，具备 sudo 权限。
- 已安装 Git、curl、wget、vim、make、net-tools、lsof、openssh-server、tar、gzip、iproute2、iputils-ping、procps。
- SSH 服务已启动，22 端口可监听。
- 已生成 SSH Key。
- 已配置 Git 用户信息。
- 已创建 `~/cloud-native-todo-platform` 目录结构。
- 已编写并能成功运行 `scripts/check-workstation.sh`。
- 已编写 `Makefile`，并能通过 `make check` 执行环境检查。
- 已初始化 Git 仓库，并完成至少两次提交和一次分支合并。
- 可选：已绑定远程 Git 仓库，并能通过 SSH 推送代码。

验收命令：

```bash
cd ~/cloud-native-todo-platform
./scripts/check-workstation.sh
make check
git log --oneline --graph --decorate --all
sudo systemctl status ssh --no-pager
ip route
```

能力验收标准：

| 能力项 | 验收标准 |
|---|---|
| Linux 目录 | 能解释项目目录每个一级目录的用途 |
| 权限 | 能解释 `chmod +x` 和 `chown` 的使用场景 |
| 进程与服务 | 能用 `ps`、`systemctl`、`journalctl` 判断服务状态 |
| 网络 | 能用 `ip route`、`curl`、`ss`、`lsof` 判断连通性和端口占用 |
| Shell | 能读懂并运行 `scripts/check-workstation.sh` |
| Makefile | 能通过 `make check` 调用检查脚本 |
| Git | 能完成初始化、提交、分支、合并和远程地址查看 |
| SSH | 能说明公钥、私钥、`known_hosts` 的作用 |

## 12. 本章练习题

### 基础题

1. `/etc`、`/var`、`/home`、`/usr/local/bin` 分别通常存放什么？
2. `chmod +x script.sh` 的作用是什么？
3. `chown -R user:group dir` 中 `-R` 表示什么？
4. `PATH` 的作用是什么？
5. `ss -lntp` 中 `l`、`n`、`t`、`p` 分别大致表示什么？
6. SSH 公钥和私钥有什么区别？
7. Git 分支解决了什么问题？
8. `ps -p 1 -o comm=` 可以帮助你判断什么？
9. 为什么 systemd 服务不能默认依赖 `~/.bashrc`？
10. `Makefile` 中命令前为什么必须使用 Tab？

### 实操题

1. 在 `~/cloud-native-todo-platform` 下创建 `tmp/logs` 目录，并创建 `app.log`。
2. 将 `app.log` 压缩成 `app.log.gz`，再解压回来。
3. 编写一个脚本 `scripts/hello.sh`，输出当前用户名、当前目录和当前时间。
4. 使用 `curl -I https://github.com` 查看响应头。
5. 使用 `ss` 或 `lsof` 查看 SSH 的 22 端口监听情况。
6. 创建 Git 分支 `feature/linux-practice`，修改 README 后提交并合并回 `main`。
7. 使用 `vim` 打开 README，新增一行学习记录并保存退出。
8. 使用 `ip addr`、`ip route`、`getent hosts github.com` 判断网络状态。
9. 执行 `make check`，确认它能调用环境检查脚本。
10. 如果你有 GitHub/GitLab 账号，把公钥添加到平台后执行 `ssh -T git@github.com` 或 `ssh -T git@gitlab.com`。

### 思考题

1. 为什么生产环境不建议直接使用 root 用户运行应用？
2. 为什么脚本中建议使用 `set -euo pipefail`？
3. 如果 CI/CD 流水线里提示 `kubectl: command not found`，你会怎么排查？
4. 如果服务启动时报端口冲突，你会如何判断是否可以杀掉占用端口的进程？
5. 为什么私钥不能提交到 Git 仓库？
6. 为什么同一个脚本在终端里能运行，在 systemd 里可能失败？
7. 如果 `ping github.com` 失败但 `curl -I https://github.com` 成功，你会如何解释？

## 13. 本章面试题

### 1. Linux 中普通用户如何临时执行管理员命令？

参考答案：

普通用户可以通过 `sudo` 临时以管理员权限执行命令，前提是该用户在 sudoers 配置中，常见做法是加入 `sudo` 用户组。这样比长期使用 root 更安全，因为操作会被记录，也能减少误操作范围。

### 2. `chmod` 和 `chown` 有什么区别？

参考答案：

`chmod` 修改文件或目录的权限，例如读、写、执行权限。`chown` 修改文件或目录的所有者和所属组。脚本不能运行时可能需要 `chmod +x`；目录归 root 导致普通用户不能写入时，可能需要 `chown` 修复所有者。

### 3. 如何排查端口被占用？

参考答案：

可以使用 `ss -lntp | grep :8080` 或 `lsof -i :8080` 查看端口监听情况和占用进程。确认 PID 和进程用途后，再决定停止服务、换端口或杀进程。生产环境不能只看到端口占用就直接 `kill -9`，需要确认影响范围。

### 4. systemd 的 `start` 和 `enable` 有什么区别？

参考答案：

`systemctl start service` 是立即启动服务，只影响当前运行状态。`systemctl enable service` 是配置开机自启，不一定立即启动。常见组合是 `systemctl enable --now service`，表示开机自启并立刻启动。

### 5. 环境变量 PATH 的作用是什么？

参考答案：

`PATH` 是 Shell 查找可执行命令的目录列表。输入 `git` 时，系统会在 PATH 指定的目录中查找名为 `git` 的可执行文件。命令已安装但提示 `command not found`，可能是没有安装，也可能是安装目录没有加入 PATH。

### 6. Git 分支的作用是什么？

参考答案：

Git 分支允许开发者在不影响主线代码的情况下开发功能、修复缺陷或实验方案。完成后通过合并进入主分支。团队中通常基于分支配合 Pull Request 做代码评审和集成。

### 7. SSH Key 登录为什么比密码登录更适合工程协作？

参考答案：

SSH Key 使用公私钥认证，私钥不离开本机，公钥可以放到服务器或 Git 平台。它适合自动化脚本、CI/CD 和 Git 远程操作，也避免频繁输入密码。但前提是私钥要妥善保存，并设置合理文件权限。

### 8. `curl` 和 `wget` 常见区别是什么？

参考答案：

`curl` 更适合调试 HTTP 请求，能方便指定方法、请求头、请求体和查看响应细节。`wget` 更偏向文件下载，适合递归下载或保存文件。工作中调试 API 常用 `curl`，下载安装包常用 `wget`。

### 9. 如何查看 systemd 服务失败的原因？

参考答案：

先用 `systemctl status 服务名 --no-pager` 查看服务当前状态、退出码和最近日志，再用 `journalctl -u 服务名 --no-pager -n 100` 查看更完整的日志。如果修改了 unit 文件，需要执行 `systemctl daemon-reload` 后再重启服务。

### 10. 为什么脚本在终端能运行，在 systemd 中可能失败？

参考答案：

终端通常加载了 `~/.bashrc`，包含用户自己的 `PATH` 和环境变量。systemd 服务默认不会加载这些文件，运行用户、工作目录和环境变量也可能不同。因此生产服务应显式配置 `User`、`WorkingDirectory`、`Environment` 和完整的 `ExecStart` 路径。

### 11. `Permission denied (publickey)` 应该如何排查？

参考答案：

先确认公钥是否添加到 GitHub/GitLab，再检查私钥权限是否为 `600`，然后用 `ssh -vT git@github.com` 查看 SSH 实际尝试了哪些密钥。还要检查 `git remote -v` 是否使用 SSH 地址。如果远程地址是 HTTPS，SSH Key 不会参与认证。

## 14. 本章总结

本篇完成了云原生学习工作站的基础搭建。

你已经掌握：

- Linux 目录结构和文件操作。
- 用户、用户组、权限、`chmod`、`chown`。
- 进程管理和 systemd 服务管理。
- 常用网络排查命令：`ip`、`ping`、`getent`、`curl`、`wget`、`ss`、`netstat`、`lsof`。
- 压缩工具：`tar`、`gzip`。
- `vim` 基础操作。
- 环境变量与 `PATH`。
- Shell 脚本基础。
- Makefile 基础入口。
- Git 初始化、提交、分支和合并。
- SSH 基础配置。

本篇项目成果是一个可继续演进的 `cloud-native-todo-platform` 仓库。后续 Go CLI、Go Web API、Docker、Kubernetes、Helm、CI/CD、Operator 都会在这个目录中继续生长。

## 15. 下一章衔接

下一篇将进入 **Go 语言基础与 Todo CLI 开发**。

本篇创建的工作站会继续作为开发环境使用：

- `Git` 用来管理 Go 代码提交。
- `Shell` 脚本会逐步扩展成项目构建、测试、启动入口。
- `PATH` 知识会用于安装和配置 Go 工具链。
- `Linux` 文件和权限能力会帮助你理解 Go 程序编译后的二进制文件如何运行。
- `cloud-native-todo-platform/cli` 会成为第一个 Go 小项目目录。

从下一篇开始，我们会用 Go 写出第一个可运行的 Todo 命令行程序，把本篇搭好的工作站真正用起来。
