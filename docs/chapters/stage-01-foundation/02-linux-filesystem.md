# 第 2 篇：Linux 文件系统与命令基础

第 1 篇已经完成课程仓库、工具链和基础 YAML 准备。从本篇开始，我们把注意力放到后端开发和云原生排障每天都会碰到的 Linux 基础能力：目录、文件、权限、文本处理、压缩、软链接和环境变量。

Go 服务运行在 Linux 之上，无论是物理服务器、虚拟机、Docker 容器还是 Kubernetes Pod。配置读不到、日志写不进去、脚本找不到文件、挂载目录权限异常、Pod 启动失败，很多时候不是框架问题，而是路径、权限和文件操作没有处理清楚。

本篇对应 5 个章节主题：

- 2.1 Linux 目录结构与路径规则
- 2.2 文件与目录操作命令
- 2.3 用户、用户组与文件权限
- 2.4 文本查看、搜索与处理命令
- 2.5 压缩、解压、软链接与环境变量

本篇特色项目是：**搭建 Todo 平台服务器目录结构，创建日志、配置、数据目录并设置权限**。

你会在 Ubuntu 24.04 的 `cloud-native-todo-platform` 仓库中创建一个安全的本地模拟目录 `server/todo-platform`。它对应真实服务器上的 `/opt/todo-platform`、`/etc/todo-platform`、`/var/log/todo-platform`、`/var/lib/todo-platform` 等目录，但不要求你真的写系统目录，因此适合新手反复练习。

## 1. 本章学习目标

学完本篇后，你应该能独立完成 Linux 服务器上最常见的文件、目录、权限和文本处理任务，并能把这些能力迁移到后续 Go、Docker、Kubernetes 和排障场景中。

### 1.1 知识目标

- 能解释 Linux 文件系统从 `/` 开始的树形结构，以及 `/etc`、`/var`、`/opt`、`/home`、`/tmp` 等目录的典型职责。
- 能区分绝对路径、相对路径、当前目录、上级目录、用户主目录和软链接路径。
- 能解释用户、用户组、所有者、权限位、可执行权限和最小权限原则。
- 能说明日志、配置、数据、发布版本为什么应该分目录管理。
- 能描述环境变量如何影响程序运行，以及它和配置文件的边界。

### 1.2 技能目标

- 能熟练使用 `pwd`、`ls`、`cd`、`mkdir`、`touch`、`cp`、`mv`、`rm` 完成目录和文件操作。
- 能使用 `cat`、`less`、`head`、`tail`、`grep`、`find` 查看、搜索和定位文本内容。
- 能使用 `chmod`、`chown`、`id`、`stat` 检查和调整文件权限。
- 能使用 `tar` 完成目录压缩、备份和解压。
- 能使用 `ln -s` 创建软链接，并解释它在版本发布和回滚中的作用。
- 能为 Todo 平台创建服务器目录结构，并运行脚本验证目录、文件、权限和软链接是否正确。

## 2. 本章工作场景与真实案例

### 2.1 技术痛点

真实工作中，很多故障表面看起来像应用问题，根因却是 Linux 文件系统基础：

- Go 服务启动时报 `open config/app.env: no such file or directory`，原因是启动目录和配置路径不一致。
- 应用日志没有落盘，原因是进程用户没有写入日志目录的权限。
- 发布脚本回滚失败，原因是版本目录和 `current` 软链接没有设计清楚。
- CI 中脚本能在开发机跑，到了 Linux runner 失败，原因是路径大小写、换行符或执行权限不同。
- Kubernetes 挂载 ConfigMap、Secret、PVC 后应用读不到文件，原因是路径覆盖、文件权限或用户 ID 不匹配。

如果不会定位路径、检查权限、搜索日志和安全删除文件，后续 Docker、Kubernetes、Helm、CI/CD 的排障都会很吃力。

### 2.2 团队协作场景

一个生产风格后端项目通常会有明确的目录职责：

- 后端开发负责说明应用需要哪些配置文件、日志目录和数据目录。
- DevOps 负责把目录结构写进部署脚本、镜像、Compose 或 Kubernetes YAML。
- 测试同学负责记录复现问题时需要收集哪些日志和配置。
- SRE 负责在线上排查权限、磁盘、日志、备份和回滚问题。
- 安全团队会关注配置权限、密钥文件是否过宽、日志中是否泄露敏感信息。

本篇不是让你背命令清单，而是让你围绕 Todo 平台服务器目录结构，练习真实团队都能看懂、能审查、能复用的文件组织方式。

### 2.3 Todo 平台模拟案例

> Todo 平台准备部署到一台测试服务器。你需要先规划一套模拟服务器目录结构，分别存放配置、日志、数据、临时文件、发布版本、当前版本软链接和备份文件，并用脚本验证路径和权限是否符合约定。

这个案例把 Linux 文件系统从“命令练习”变成“服务部署前的目录治理”：每个目录都要能解释用途、权限和故障影响。
## 3. 核心概念

### 3.1 Linux 目录结构与路径规则

Linux 文件系统是一棵从 `/` 开始的树。所有目录、文件、设备、挂载点都在这棵树里。

```mermaid
flowchart TB
    Root["/ 根目录"]
    Root --> Etc["/etc<br/>系统与应用配置"]
    Root --> Var["/var<br/>日志、缓存、运行时数据"]
    Root --> Opt["/opt<br/>业务应用或第三方软件"]
    Root --> Home["/home<br/>普通用户目录"]
    Root --> Tmp["/tmp<br/>临时文件"]
    Root --> Usr["/usr<br/>系统程序和共享资源"]

    Opt --> App["/opt/todo-platform<br/>Todo 应用程序"]
    Etc --> Config["/etc/todo-platform<br/>Todo 配置"]
    Var --> Logs["/var/log/todo-platform<br/>Todo 日志"]
    Var --> Data["/var/lib/todo-platform<br/>Todo 数据"]

    classDef root fill:#e0f2fe,stroke:#0284c7,color:#0f172a
    classDef system fill:#fef3c7,stroke:#d97706,color:#0f172a
    classDef app fill:#dcfce7,stroke:#16a34a,color:#0f172a
    class Root root
    class Etc,Var,Opt,Home,Tmp,Usr system
    class App,Config,Logs,Data app
```

常见目录含义如下：

| 目录 | 常见用途 | Todo 平台类比 |
|---|---|---|
| `/` | 根目录，所有路径的起点 | 整台服务器的文件系统入口 |
| `/home` | 普通用户的主目录 | 开发者自己的工作区 |
| `/etc` | 配置文件 | `app.env`、日志配置 |
| `/var` | 经常变化的数据 | 日志、PID 文件、运行时数据 |
| `/var/log` | 日志文件 | `todo-api.log`、`error.log` |
| `/var/lib` | 应用持久化数据 | 上传文件、缓存数据、SQLite 测试数据 |
| `/opt` | 业务或第三方应用 | Todo API 可执行文件和发布版本 |
| `/tmp` | 临时文件 | 临时测试文件，不保存重要数据 |
| `/usr/bin` | 常用可执行命令 | `ls`、`grep`、`find` 等命令所在位置 |

真实生产环境中，不建议把程序、配置、日志和数据都塞进一个目录。分开管理后，权限、备份、清理和排障边界会更清楚。

### 3.2 绝对路径与相对路径

路径是定位文件和目录的方式。

绝对路径从 `/` 开始：

```text linenums="0"
/home/dev/workspace/cloud-native-todo-platform
/etc/todo-platform/app.env
/var/log/todo-platform/todo-api.log
```

相对路径从当前目录开始：

```text linenums="0"
docs/environment.md
../cloud-native-todo-platform
./scripts/check-env.sh
```

几个特殊路径符号要记牢：

| 符号 | 含义 | 示例 |
|---|---|---|
| `/` | 根目录 | `cd /` |
| `.` | 当前目录 | `./scripts/check-env.sh` |
| `..` | 上一级目录 | `cd ..` |
| `~` | 当前用户主目录 | `cd ~/workspace` |
| `-` | 上一次所在目录 | `cd -` |

操作文件前，先确认当前位置：

```bash linenums="0"
pwd
```

示例输出：

```text linenums="0"
/home/dev/workspace/cloud-native-todo-platform
```

任何删除、移动、压缩操作前，都应该先确认自己在正确目录。这个习惯比多背十个命令更重要。

### 3.3 文件与目录操作命令

Linux 常用文件操作可以分成五类：

```mermaid
flowchart LR
    Locate["定位<br/>pwd / ls / cd"] --> Create["创建<br/>mkdir / touch"]
    Create --> Copy["复制<br/>cp"]
    Copy --> Move["移动与重命名<br/>mv"]
    Move --> Delete["删除<br/>rm"]
    Delete --> Verify["验证<br/>ls / find / stat"]

    classDef step fill:#f8fafc,stroke:#64748b,color:#0f172a
    classDef danger fill:#fee2e2,stroke:#dc2626,color:#0f172a
    class Locate,Create,Copy,Move,Verify step
    class Delete danger
```

常用命令说明：

| 命令 | 作用 | 示例 |
|---|---|---|
| `pwd` | 显示当前目录 | `pwd` |
| `ls` | 查看目录内容 | `ls -lah` |
| `cd` | 切换目录 | `cd ~/workspace` |
| `mkdir` | 创建目录 | `mkdir -p logs/api` |
| `touch` | 创建空文件或更新时间 | `touch logs/todo-api.log` |
| `cp` | 复制文件或目录 | `cp app.env app.env.bak` |
| `mv` | 移动或重命名 | `mv old.log todo-api.log` |
| `rm` | 删除文件或目录 | `rm old.log` |

`rm` 是高风险命令。学习阶段也要建立习惯：先 `pwd` 和 `ls`，再删除；删除目录时明确路径，避免在错误目录执行递归删除。

### 3.4 用户、用户组与文件权限

Linux 文件权限围绕三个角色展开：

- 所有者 user：文件属于哪个用户。
- 所属组 group：文件属于哪个用户组。
- 其他人 others：既不是所有者，也不在所属组中的用户。

每类角色有三种权限：

| 权限 | 含义 | 对文件 | 对目录 |
|---|---|---|---|
| `r` | read 读取 | 读取文件内容 | 列出目录内容 |
| `w` | write 写入 | 修改文件内容 | 创建、删除、重命名目录中的文件 |
| `x` | execute 执行 | 执行脚本或二进制 | 进入目录、访问目录内路径 |

查看权限：

```bash linenums="0"
ls -l server/todo-platform/config/app.env
```

示例输出：

```text linenums="0"
-rw-r----- 1 dev dev 128 May 27 10:00 app.env
```

第一段 `-rw-r-----` 可以这样读：

| 位置 | 含义 |
|---|---|
| `-` | 普通文件，目录会显示为 `d` |
| `rw-` | 所有者可读可写 |
| `r--` | 所属组可读 |
| `---` | 其他人无权限 |

数字权限常见写法：

| 数字 | 权限 | 常见用途 |
|---|---|---|
| `600` | 所有者读写 | 私钥、敏感配置 |
| `640` | 所有者读写，组可读 | 应用配置 |
| `700` | 所有者完全控制 | 私有目录 |
| `750` | 所有者完全控制，组可读可进入 | 服务目录 |
| `755` | 所有人可读可执行，只有所有者可写 | 普通脚本、发布目录 |
| `777` | 所有人可读写执行 | 生产环境应避免 |

### 3.5 文本查看、搜索与处理

服务器排障时，日志和配置往往比代码更先被打开。常见文本命令如下：

| 场景 | 命令 | 示例 |
|---|---|---|
| 查看小文件 | `cat` | `cat config/app.env` |
| 分页查看大文件 | `less` | `less logs/todo-api.log` |
| 看前几行 | `head` | `head -n 20 logs/todo-api.log` |
| 看最后几行 | `tail` | `tail -n 50 logs/todo-api.log` |
| 实时跟踪日志 | `tail -f` | `tail -f logs/todo-api.log` |
| 搜索关键字 | `grep` | `grep "ERROR" logs/todo-api.log` |
| 忽略大小写 | `grep -i` | `grep -i "timeout" logs/todo-api.log` |
| 显示行号 | `grep -n` | `grep -n "request_id" logs/todo-api.log` |
| 查找文件 | `find` | `find . -name "*.env"` |

一个常见排障路径是：

```bash linenums="0"
tail -n 100 server/todo-platform/logs/todo-api.log
grep -n "ERROR" server/todo-platform/logs/todo-api.log
find server/todo-platform \( -name "*.env" -o -name "*.log" \) -print
```

后续学习 Docker 和 Kubernetes 时，虽然日志可能来自 `docker logs` 或 `kubectl logs`，但定位思路依然是文本查看、关键字搜索和上下文分析。

### 3.6 压缩、软链接与环境变量

`tar` 常用于打包、备份、迁移目录：

```bash linenums="0"
tar -czf todo-server-backup.tar.gz server/todo-platform
tar -tzf todo-server-backup.tar.gz | head
tar -xzf todo-server-backup.tar.gz -C /tmp
```

常用参数：

| 参数 | 含义 |
|---|---|
| `-c` | create，创建归档 |
| `-z` | 使用 gzip 压缩 |
| `-x` | extract，解压 |
| `-t` | list，列出归档内容 |
| `-f` | 指定归档文件名 |

软链接像一个可替换的入口：

```text linenums="0"
server/todo-platform/current -> releases/2026-05-27-001
```

发布新版本时，可以创建新的 `releases/<版本>` 目录，再把 `current` 指向新版本。回滚时只要把 `current` 指回旧版本。这种方式比覆盖原目录更可控。

`readlink` 命令可以查看软链接指向的目标路径：

```bash linenums="0"
readlink server/todo-platform/current
```

环境变量是传递运行参数的一种方式：

```bash linenums="0"
export TODO_ENV=dev
printenv TODO_ENV
```

环境变量适合放运行环境、端口、配置路径等参数。敏感信息不要随意写入命令历史和日志，生产环境应使用受控的 Secret 管理方式。

## 4. 原理深入

### 4.1 Shell 如何解析路径

当你执行下面命令时：

```bash linenums="0"
cat server/todo-platform/config/app.env
```

Shell 和系统会按当前目录解析相对路径：

```mermaid
flowchart LR
    A["当前工作目录<br/>pwd"] --> B["拼接相对路径<br/>server/todo-platform/config/app.env"]
    B --> C["内核查找目录项"]
    C --> D{"路径存在?"}
    D -- 是 --> E["检查权限"]
    D -- 否 --> F["No such file or directory"]
    E --> G{"有读取权限?"}
    G -- 是 --> H["打开并读取文件"]
    G -- 否 --> I["Permission denied"]
```

这解释了两个最常见错误：路径不存在和权限不足。排障时不要急着改代码，先确认 `pwd`、`ls`、`stat` 三件事。

### 4.2 权限判断流程

Linux 判断权限时，会先看当前进程用户是谁，再判断它与文件所有者、所属组的关系。

```mermaid
flowchart TB
    A["进程访问文件"] --> B["读取进程 UID/GID"]
    B --> C{"UID 是文件所有者?"}
    C -- 是 --> D["使用 user 权限位"]
    C -- 否 --> E{"GID 在文件所属组中?"}
    E -- 是 --> F["使用 group 权限位"]
    E -- 否 --> G["使用 others 权限位"]
    D --> H{"权限满足操作?"}
    F --> H
    G --> H
    H -- 是 --> I["允许访问"]
    H -- 否 --> J["Permission denied"]
```

对目录来说，`x` 权限非常关键。没有目录执行权限，即使文件本身可读，也可能无法进入目录或访问目录中的文件。

### 4.3 软链接发布为什么适合回滚

假设有两个发布版本：

```text linenums="0"
releases/
├── 2026-05-27-001/
└── 2026-05-27-002/
current -> releases/2026-05-27-001
```

发布新版本时：

```bash linenums="0"
ln -sfn releases/2026-05-27-002 server/todo-platform/current
```

如果新版本异常，回滚只需要：

```bash linenums="0"
ln -sfn releases/2026-05-27-001 server/todo-platform/current
```

软链接切换本身很快，发布脚本也容易审查。后续学习 CI/CD 和 Kubernetes 滚动发布时，这种“保留旧版本、快速切换入口”的思想还会反复出现。

### 4.4 环境变量如何传给程序

环境变量属于进程运行环境的一部分。父进程设置环境变量后，启动子进程时会把环境变量传递给它。

```mermaid
flowchart LR
    Shell["Shell<br/>export TODO_ENV=dev"] --> Process["todo-api 进程"]
    Process --> Read["读取 TODO_ENV"]
    Read --> Config["选择 dev 配置"]
```

这也是为什么你在一个终端里 `export TODO_ENV=dev`，另一个终端里不一定能看到。环境变量不是全局数据库，它跟进程树有关。

## 5. 手把手实验

预计耗时：60 分钟（动手操作约 40 分钟）。

### 5.1 实验目标

本实验会完成：**在课程仓库中搭建 Todo 平台服务器目录结构，写入配置、日志、数据目录，设置基础权限，并用脚本验证目录是否符合约定**。

最终交付物包括：

- `server/todo-platform/` 本地模拟服务器目录。
- `server/todo-platform/config/app.env` 配置文件。
- `server/todo-platform/config/app.env.backup` 配置备份文件。
- `server/todo-platform/logs/todo-api.log` 示例日志。
- `server/todo-platform/data/` 数据目录。
- `server/todo-platform/releases/2026-05-27-001/` 发布版本目录。
- `server/todo-platform/current` 当前版本软链接。
- `scripts/check-server-layout.sh` 目录和权限检查脚本。
- `server/todo-platform-backup.tar.gz` 备份包。

说明：本篇是 Linux 文件系统与命令基础，不编写 Kubernetes YAML。YAML 已在第 1 篇建立基础，后续 Kubernetes 配置、挂载和权限会在第 20 篇以后系统展开。

### 5.2 实验环境

建议在第 1 篇创建的仓库中执行：

```bash linenums="0"
cd ~/workspace/cloud-native-todo-platform
```

课程示例只按 Ubuntu 24.04 编写。执行实验前用 `pwd` 确认仓库位于 `~/workspace/cloud-native-todo-platform`，不要在临时目录或系统目录中练习删除、权限和软链接命令。

### 5.3 文件目录结构

实验完成后的目标结构如下：

```text linenums="0"
cloud-native-todo-platform/
├── scripts/
│   └── check-server-layout.sh
└── server/
    ├── todo-platform/
    │   ├── config/
    │   │   ├── app.env
    │   │   └── app.env.backup
    │   ├── current -> releases/2026-05-27-001
    │   ├── data/
    │   │   └── .keep
    │   ├── logs/
    │   │   └── todo-api.log
    │   ├── releases/
    │   │   └── 2026-05-27-001/
    │   │       └── README.md
    │   └── tmp/
    └── todo-platform-backup.tar.gz
```

创建完成后用 `tree` 验证：

```bash linenums="0"
tree -a -L 4 server scripts
```

### 5.4 执行命令

先确认你在课程仓库根目录：

```bash linenums="0"
pwd
ls
```

预期能看到 `README.md`、`docs/`、`scripts/` 等目录或文件。

创建目录：

```bash linenums="0"
mkdir -p server/todo-platform/{config,logs,data,tmp,releases/2026-05-27-001}
mkdir -p scripts
```

写入配置文件：

将下面内容写入 `server/todo-platform/config/app.env`：

```text title="server/todo-platform/config/app.env"
TODO_ENV=dev
TODO_HTTP_ADDR=127.0.0.1:8080
TODO_CONFIG_DIR=server/todo-platform/config
TODO_LOG_DIR=server/todo-platform/logs
TODO_DATA_DIR=server/todo-platform/data
```

写入示例日志：

将下面内容写入 `server/todo-platform/logs/todo-api.log`：

```text title="server/todo-platform/logs/todo-api.log"
2026-05-27T09:00:00+08:00 INFO todo-api started env=dev addr=127.0.0.1:8080
2026-05-27T09:00:05+08:00 INFO request_id=req-001 method=GET path=/healthz status=200
2026-05-27T09:00:10+08:00 ERROR request_id=req-002 method=GET path=/todos status=500 error="database not configured"
```

写入版本说明和数据目录占位文件：

将下面内容写入 `server/todo-platform/releases/2026-05-27-001/README.md`：

```markdown title="server/todo-platform/releases/2026-05-27-001/README.md"
# Todo Platform Release 2026-05-27-001

This directory simulates an application release package.
```

继续执行：

```bash linenums="0"
touch server/todo-platform/data/.keep
```

创建当前版本软链接：

```bash linenums="0"
ln -sfn releases/2026-05-27-001 server/todo-platform/current
```

设置权限：

```bash linenums="0"
chmod 750 server/todo-platform/{config,logs,data,releases}
chmod 700 server/todo-platform/tmp
chmod 640 server/todo-platform/config/app.env
chmod 640 server/todo-platform/logs/todo-api.log
```

练习复制、重命名和删除。这里先复制配置文件，再把备份文件重命名为更清晰的 `.backup` 后缀：

```bash linenums="0"
cp server/todo-platform/config/app.env server/todo-platform/config/app.env.bak
mv server/todo-platform/config/app.env.bak server/todo-platform/config/app.env.backup
chmod 640 server/todo-platform/config/app.env.backup
```

练习查看用户、用户组和权限。`id` 让你知道当前终端用户是谁，`stat` 用来确认文件权限和所有者：

```bash linenums="0"
id
stat server/todo-platform/config/app.env
ls -ld server/todo-platform/{config,logs,data,tmp,releases}
```

`chown` 用来修改文件所有者，真实服务器通常由管理员或部署脚本执行。本实验目录已经属于当前用户，默认不需要执行 `chown`。如果你曾经误用 `sudo` 创建了 root 拥有的实验文件，可以用下面命令把目录恢复给当前用户：

```bash linenums="0"
# 可选，仅当实验目录的所有者异常时执行
sudo chown -R "$(id -un):$(id -gn)" server/todo-platform
```

练习安全删除。先创建一个明确的临时文件，再删除它；不要对不确定的路径执行 `rm -rf`：

```bash linenums="0"
touch server/todo-platform/tmp/delete-me.txt
ls -l server/todo-platform/tmp/delete-me.txt
rm server/todo-platform/tmp/delete-me.txt
```

写入检查脚本：

将下面内容写入 `scripts/check-server-layout.sh`，并确认文件使用 LF 换行：

```bash title="scripts/check-server-layout.sh"
#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE_DIR="$ROOT_DIR/server/todo-platform"
FAILURES=0

ok() {
  printf '[OK] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
}

fail() {
  printf '[FAIL] %s\n' "$1"
  FAILURES=$((FAILURES + 1))
}

file_mode() {
  local path="$1"
  local mode
  mode="$(stat -c '%a' "$path")"
  printf '%s\n' "$mode" | sed 's/^0*//; s/^$/0/'
}

require_dir() {
  local path="$1"
  if [[ -d "$path" ]]; then
    ok "directory exists: ${path#$ROOT_DIR/}"
  else
    fail "directory missing: ${path#$ROOT_DIR/}"
  fi
}

require_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    ok "file exists: ${path#$ROOT_DIR/}"
  else
    fail "file missing: ${path#$ROOT_DIR/}"
  fi
}

require_mode() {
  local path="$1"
  local expected="$2"
  if [[ ! -e "$path" ]]; then
    fail "cannot check mode, path missing: ${path#$ROOT_DIR/}"
    return
  fi

  local actual
  actual="$(file_mode "$path")"
  if [[ "$actual" == "$expected" ]]; then
    ok "mode ${expected}: ${path#$ROOT_DIR/}"
  else
    fail "mode expected ${expected}, got ${actual}: ${path#$ROOT_DIR/}"
  fi
}

require_symlink_target() {
  local path="$1"
  local expected="$2"
  if [[ ! -L "$path" ]]; then
    fail "symlink missing: ${path#$ROOT_DIR/}"
    return
  fi

  local actual
  actual="$(readlink "$path")"
  if [[ "$actual" == "$expected" ]]; then
    ok "symlink target ${expected}: ${path#$ROOT_DIR/}"
  else
    fail "symlink target expected ${expected}, got ${actual}: ${path#$ROOT_DIR/}"
  fi
}

main() {
  require_dir "$BASE_DIR"
  require_dir "$BASE_DIR/config"
  require_dir "$BASE_DIR/logs"
  require_dir "$BASE_DIR/data"
  require_dir "$BASE_DIR/tmp"
  require_dir "$BASE_DIR/releases/2026-05-27-001"

  require_file "$BASE_DIR/config/app.env"
  require_file "$BASE_DIR/config/app.env.backup"
  require_file "$BASE_DIR/logs/todo-api.log"
  require_file "$BASE_DIR/data/.keep"
  require_file "$BASE_DIR/releases/2026-05-27-001/README.md"

  require_mode "$BASE_DIR/config" "750"
  require_mode "$BASE_DIR/logs" "750"
  require_mode "$BASE_DIR/data" "750"
  require_mode "$BASE_DIR/releases" "750"
  require_mode "$BASE_DIR/config/app.env" "640"
  require_mode "$BASE_DIR/config/app.env.backup" "640"
  require_mode "$BASE_DIR/logs/todo-api.log" "640"
  require_mode "$BASE_DIR/tmp" "700"
  require_symlink_target "$BASE_DIR/current" "releases/2026-05-27-001"

  if grep -q 'TODO_ENV=dev' "$BASE_DIR/config/app.env"; then
    ok "app.env contains TODO_ENV=dev"
  else
    fail "app.env does not contain TODO_ENV=dev"
  fi

  if grep -q 'ERROR' "$BASE_DIR/logs/todo-api.log"; then
    ok "sample log contains ERROR line for grep practice"
  else
    warn "sample log does not contain ERROR line"
  fi

  if [[ "$FAILURES" -gt 0 ]]; then
    printf '\nServer layout check failed: %s issue(s).\n' "$FAILURES"
    exit 1
  fi

  printf '\nServer layout check completed.\n'
}

main "$@"
```

保存后赋予执行权限：

```bash linenums="0"
chmod +x scripts/check-server-layout.sh
```

练习查看和搜索：

```bash linenums="0"
cat server/todo-platform/config/app.env
less server/todo-platform/logs/todo-api.log
tail -n 2 server/todo-platform/logs/todo-api.log
grep -n "ERROR" server/todo-platform/logs/todo-api.log
find server/todo-platform \( -name "*.env" -o -name "*.log" \) -print
ls -l server/todo-platform/current
```

使用 `less` 查看日志时，按 `q` 退出。

创建备份包：

```bash linenums="0"
tar -czf server/todo-platform-backup.tar.gz server/todo-platform
tar -tzf server/todo-platform-backup.tar.gz | head
```

运行检查脚本：

```bash linenums="0"
./scripts/check-server-layout.sh
```

### 5.5 预期输出

查看软链接时，预期类似：

```text linenums="0"
current -> releases/2026-05-27-001
```

搜索错误日志时，预期类似：

```text linenums="0"
3:2026-05-27T09:00:10+08:00 ERROR request_id=req-002 method=GET path=/todos status=500 error="database not configured"
```

检查脚本预期输出：

```text linenums="0"
[OK] directory exists: server/todo-platform
[OK] directory exists: server/todo-platform/config
[OK] directory exists: server/todo-platform/logs
[OK] directory exists: server/todo-platform/data
[OK] directory exists: server/todo-platform/tmp
[OK] directory exists: server/todo-platform/releases/2026-05-27-001
[OK] file exists: server/todo-platform/config/app.env
[OK] file exists: server/todo-platform/config/app.env.backup
[OK] file exists: server/todo-platform/logs/todo-api.log
[OK] file exists: server/todo-platform/data/.keep
[OK] file exists: server/todo-platform/releases/2026-05-27-001/README.md
[OK] mode 750: server/todo-platform/config
[OK] mode 750: server/todo-platform/logs
[OK] mode 750: server/todo-platform/data
[OK] mode 750: server/todo-platform/releases
[OK] mode 640: server/todo-platform/config/app.env
[OK] mode 640: server/todo-platform/config/app.env.backup
[OK] mode 640: server/todo-platform/logs/todo-api.log
[OK] mode 700: server/todo-platform/tmp
[OK] symlink target releases/2026-05-27-001: server/todo-platform/current
[OK] app.env contains TODO_ENV=dev
[OK] sample log contains ERROR line for grep practice

Server layout check completed.
```

### 5.6 验证方法

集中执行下面命令：

```bash linenums="0"
test -d server/todo-platform/config
test -d server/todo-platform/logs
test -d server/todo-platform/data
test -L server/todo-platform/current
test -f server/todo-platform/config/app.env
test -f server/todo-platform/config/app.env.backup
test -f server/todo-platform/logs/todo-api.log
test -f server/todo-platform/data/.keep
test -x scripts/check-server-layout.sh
readlink server/todo-platform/current
find server/todo-platform \( -name "*.env" -o -name "*.log" \) -print
./scripts/check-server-layout.sh
tar -tzf server/todo-platform-backup.tar.gz | head
```

判断标准：

- 配置、日志、数据、临时目录和发布版本目录都存在。
- `current` 是软链接，并指向 `releases/2026-05-27-001`。
- `config`、`logs`、`data`、`releases` 目录权限为 `750`。
- `app.env` 和 `todo-api.log` 权限为 `640`。
- `app.env.backup` 由 `cp` 和 `mv` 练习生成，权限为 `640`。
- `tmp` 目录权限为 `700`。
- 检查脚本输出 `Server layout check completed.`。
- 备份包能列出内容。

### 5.7 清理步骤

如果你只想清理备份包：

```bash linenums="0"
rm -f server/todo-platform-backup.tar.gz
```

如果你想重做整个实验，请先确认当前位置：

```bash linenums="0"
pwd
ls server
```

确认你在 `cloud-native-todo-platform` 仓库后，再删除实验目录：

```bash linenums="0"
rm -rf server/todo-platform
rm -f server/todo-platform-backup.tar.gz
rm -f scripts/check-server-layout.sh
```

如果准备继续学习第 3 篇，不建议清理 `server/todo-platform`，因为后续会继续使用日志、配置和脚本思路。

## 6. 常见错误与排障

### 错误 1：`No such file or directory`

- **现象**：

  ```text linenums="0"
  cat: server/todo-platform/config/app.env: No such file or directory
  ```

- **原因**：当前目录不对，或者前面的目录创建、文件写入步骤没有完成。

- **排查**：

  ```bash linenums="0"
  pwd
  ls -lah
  find . -path "*app.env" -print
  ```

  `pwd` 用来确认你是否在课程仓库根目录；`find` 用来确认文件是否被写到了别的位置。

- **修复**：回到仓库根目录，再重新创建目录和配置文件。

  ```bash linenums="0"
  cd ~/workspace/cloud-native-todo-platform
  mkdir -p server/todo-platform/config
  ```

- **预防**：每次执行批量文件操作前，先运行 `pwd` 和 `ls`。

### 错误 2：`Permission denied`

- **现象**：

  ```text linenums="0"
  bash: ./scripts/check-server-layout.sh: Permission denied
  ```

- **原因**：脚本没有执行权限，或者目录缺少进入权限。

- **排查**：

  ```bash linenums="0"
  ls -l scripts/check-server-layout.sh
  stat scripts/check-server-layout.sh
  ```

  如果权限中没有 `x`，脚本不能直接执行。

- **修复**：

  ```bash linenums="0"
  chmod +x scripts/check-server-layout.sh
  ./scripts/check-server-layout.sh
  ```

- **预防**：创建脚本后立即执行 `chmod +x`，并把检查命令写进后续自动化脚本。

### 错误 3：`grep` 没有输出

- **现象**：

  ```bash linenums="0"
  grep -n "ERROR" server/todo-platform/logs/todo-api.log
  ```

  命令没有任何输出。

- **原因**：文件中没有匹配关键字，或者大小写不一致。`grep` 没有匹配时退出码为 1，不一定代表命令坏了。

- **排查**：

  ```bash linenums="0"
  wc -l server/todo-platform/logs/todo-api.log
  cat server/todo-platform/logs/todo-api.log
  grep -ni "error" server/todo-platform/logs/todo-api.log
  ```

- **修复**：确认日志内容正确，必要时使用 `grep -i` 忽略大小写。

- **预防**：排障时先确认文件是否有内容，再搜索关键字。

### 错误 4：软链接失效

- **现象**：

  ```text linenums="0"
  ls: cannot access 'server/todo-platform/current': No such file or directory
  ```

  或者 `current` 存在，但指向的版本目录不存在。

- **原因**：创建软链接时目标路径写错，或者目标版本目录被删除。

- **排查**：

  ```bash linenums="0"
  ls -l server/todo-platform/current
  readlink server/todo-platform/current
  ls -lah server/todo-platform/releases
  ```

- **修复**：

  ```bash linenums="0"
  mkdir -p server/todo-platform/releases/2026-05-27-001
  ln -sfn releases/2026-05-27-001 server/todo-platform/current
  ```

- **预防**：发布脚本里先检查目标版本目录存在，再切换 `current`。

### 错误 5：脚本换行或执行目录异常

- **现象**：

  ```text linenums="0"
  ./scripts/check-server-layout.sh: line 2: $'\r': command not found
  ```

  或者你在错误目录中运行脚本，导致文件找不到：

  ```text linenums="0"
  [FAIL] directory missing: server/todo-platform/config
  [FAIL] file missing: server/todo-platform/config/app.env
  ```

- **原因**：前一种现象通常是脚本使用了 CRLF 换行符，Ubuntu Bash 期望 LF 换行。后一种现象通常是当前目录不是课程仓库根目录，脚本无法找到本篇创建的 `server/todo-platform` 结构。

- **排查**：

  ```bash linenums="0"
  pwd
  file scripts/check-server-layout.sh
  ls -ld server/todo-platform/config
  stat server/todo-platform/config/app.env
  ```

  如果 `file` 输出包含 `CRLF line terminators`，说明换行符不符合 Ubuntu Bash 习惯。如果 `pwd` 不是 `~/workspace/cloud-native-todo-platform`，先切回仓库根目录。

- **修复**：

  ```bash linenums="0"
  sed -i 's/\r$//' scripts/check-server-layout.sh
  chmod +x scripts/check-server-layout.sh
  ```

  如果是目录错误，切回课程仓库后重新执行实验：

  ```bash linenums="0"
  cd ~/workspace/cloud-native-todo-platform
  ./scripts/check-server-layout.sh
  ```

- **预防**：涉及 `chmod`、软链接、Shell 脚本和 Linux 权限的实验，都在 Ubuntu 24.04 的课程仓库根目录中执行。

## 7. 生产环境注意事项

1. **不要在生产环境滥用 `777`。**
   `chmod 777` 看似能快速解决权限问题，实际是把读、写、执行权限交给所有用户。配置、密钥、日志、数据目录都应遵守最小权限原则。服务需要什么权限，就只给什么权限。

2. **配置、日志、数据和程序要分离。**
   程序发布目录适合只读，配置目录适合受控变更，日志目录需要可写和轮转，数据目录需要备份策略。如果全部放在一个目录，备份、清理、权限审计和故障定位都会变得混乱。

3. **删除和覆盖操作必须可审查。**
   生产脚本中不要写模糊的 `rm -rf *`。删除前应打印目标路径，必要时要求显式确认。发布时优先使用新版本目录加软链接切换，而不是直接覆盖旧版本。

4. **日志文件需要轮转和敏感信息治理。**
   日志目录如果不做轮转，可能把磁盘打满；日志中如果写入 Token、密码、身份证号等敏感信息，会变成安全风险。后续生产化章节会继续引入结构化日志和日志采集。

5. **环境变量适合运行参数，不适合无边界地堆配置。**
   环境变量很方便，但也容易被进程列表、调试输出或日志泄露。生产环境中的密码、证书和 Token 应使用 Secret 管理，并控制谁能读取。

## 8. 练习题与面试题

本章练习题和面试题已拆分到独立页面，完成正文学习后再进入题库练习与复盘。

[查看本章练习题与面试题](../../questions/stage-01-foundation/02-linux-filesystem.md)

## 9. 本章总结

本篇系统训练了 Linux 文件系统与命令基础。你理解了目录树、路径规则、文件操作、权限位、文本查看、搜索、压缩、软链接和环境变量这些核心概念，也知道它们为什么会影响后端服务、容器和 Kubernetes 工作负载。

项目成果上，你为 `Cloud Native Todo Platform` 创建了 `server/todo-platform` 模拟服务器目录，包含配置、日志、数据、临时目录、发布版本目录、当前版本软链接和备份包，并编写了 `scripts/check-server-layout.sh` 做自动化验收。这些产出会在后续 Linux 进程、Shell 自动化、Go 服务、Docker 和 Kubernetes 章节继续演进。

能力价值上，本篇训练的是“能在服务器上稳稳操作”的基本功。真正的工程能力不是记住某个命令，而是知道操作前如何确认路径，出错后如何查看证据，修改权限时如何控制风险，发布目录如何支持回滚。这些习惯会直接影响你未来排查线上问题的速度和安全边界。

## 10. 下一章衔接

下一篇进入 **Linux 进程、服务与软件管理**。

本篇已经准备好了 Todo 平台的配置、日志、数据和发布目录。下一篇会在这些目录基础上学习进程、PID、前台/后台任务、软件安装、systemd 服务管理和日志查看，理解一个程序在 Linux 上如何真正运行起来。
