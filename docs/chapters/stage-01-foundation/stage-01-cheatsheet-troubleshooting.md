# 阶段一附录 B：命令速查与排障手册

本附录用于阶段一复习和实战排障。它不是替代前 6 篇正文，而是把高频命令、判断路径和安全边界整理成一张随手可查的工作台。

建议你在完成阶段一后，把本附录至少通读一遍，并在自己的 `cloud-native-todo-platform` 仓库中保留一份排障记录。

## 1. 使用原则

排障时不要从“猜命令”开始，而要从“问题在哪一层”开始。

| 层次 | 先问的问题 | 常用命令 |
|---|---|---|
| 环境 | 工具是否存在，版本是否正确 | `command -v`、`--version` |
| 文件 | 路径、权限、内容是否正确 | `pwd`、`ls -l`、`stat`、`cat`、`grep` |
| 进程 | 程序是否运行，PID 是多少 | `ps`、`pgrep`、`systemctl`、`journalctl` |
| 网络 | 端口是否监听，请求是否成功 | `ss`、`curl`、`dig`、`tcpdump` |
| 协作 | 分支、提交、远程状态是否正确 | `git status`、`git log`、`git branch` |
| 自动化 | 脚本是否返回正确退出码 | `bash -n`、`shellcheck`、`echo $?` |

## 2. 环境检查速查

```bash linenums="0"
command -v go git docker kubectl kind helm bash

go version
git --version
docker version
kubectl version --client
kind version
helm version
bash --version
```

如果某个命令不存在，先判断是“没有安装”还是“安装了但 PATH 没生效”：

```bash linenums="0"
echo "$PATH"
which go || true
ls -l /usr/local/go/bin/go 2>/dev/null || true
```

课程统一使用 Ubuntu 24.04。若系统版本不一致，先切换到课程指定环境再继续排障。

## 3. Linux 文件与权限速查

定位当前位置和目录内容：

```bash linenums="0"
pwd
ls -lah
find . -maxdepth 2 -type f | sort
```

查看权限和所有者：

```bash linenums="0"
ls -l path/to/file
ls -ld path/to/dir
stat path/to/file
whoami
id
```

安全修改权限：

```bash linenums="0"
chmod 755 scripts/dev.sh
chmod 640 config/app.env
```

!!! warning "不要用 chmod 777 解决生产问题"
    `chmod 777` 会让所有用户都能读、写、执行，容易造成敏感信息泄露和任意修改。正确做法是先确认运行用户、所属组、文件用途，再设置最小权限。

安全删除前先确认路径：

```bash linenums="0"
TARGET="labs/linux-filesystem/todo-server/tmp/restore-test"
pwd
echo "$TARGET"
test -n "$TARGET"
test -d "$TARGET"
rm -rf "$TARGET"
```

生产排障时，删除命令必须比查看命令晚出现。先 `ls`、`du`、`find`，再决定是否清理。

## 4. 文本查看与搜索速查

查看小文件：

```bash linenums="0"
cat config/app.env
```

查看大文件：

```bash linenums="0"
less var/log/todo-platform/todo-api.log
tail -n 100 var/log/todo-platform/todo-api.log
tail -f var/log/todo-platform/todo-api.log
```

搜索错误：

```bash linenums="0"
grep -n "ERROR" var/log/todo-platform/*.log
grep -Rni "TODO_HTTP_ADDR" .
```

查找最近修改过的文件：

```bash linenums="0"
find . -type f -mtime -1 -print
```

## 5. 进程与服务速查

查看进程：

```bash linenums="0"
ps aux | grep todo
pgrep -af todo
```

查看资源：

```bash linenums="0"
top
htop
free -h
df -h
du -sh var/log/todo-platform 2>/dev/null || true
```

查看 systemd 服务：

```bash linenums="0"
sudo systemctl status todo-process-demo --no-pager
sudo journalctl -u todo-process-demo -n 100 --no-pager
sudo systemctl restart todo-process-demo
```

查看端口归属：

```bash linenums="0"
sudo ss -lntp | grep 18080 || true
sudo lsof -iTCP:18080 -sTCP:LISTEN
```

!!! warning "不要把 kill -9 当作常规停止方式"
    优先使用 `systemctl stop` 或普通 `kill`，让程序收到 `SIGTERM` 并完成清理。`kill -9` 只适合模拟崩溃或处理无法正常退出的进程。

## 6. 网络排障速查

判断服务是否可访问：

```bash linenums="0"
curl -i http://127.0.0.1:18080/healthz
curl -v --max-time 3 http://127.0.0.1:18080/healthz
```

判断端口是否监听：

```bash linenums="0"
ss -lnt | grep 18080 || true
sudo ss -lntp 'sport = :18080'
```

判断 DNS：

```bash linenums="0"
getent hosts localhost
dig example.com
nslookup example.com
```

抓取本机请求：

```bash linenums="0"
sudo tcpdump -i lo -nn 'tcp port 18080' -c 10
```

!!! warning "抓包可能包含敏感信息"
    `tcpdump -A` 可能显示 HTTP Header、Cookie、Token 和请求体。生产环境抓包前必须明确范围、权限、脱敏和保存位置。

常见网络现象：

| 现象 | 优先判断 | 常用命令 |
|---|---|---|
| `Connection refused` | 目标端口没有监听或服务拒绝 | `ss -lntp`、`systemctl status` |
| `Connection timed out` | 包没回来，可能是防火墙、路由、安全组 | `ip route`、`tcpdump`、防火墙命令 |
| 本机能访问，远程不能访问 | 服务可能只监听 `127.0.0.1` | `ss -lntp` |
| 域名失败，IP 成功 | DNS 或 hosts 问题 | `dig`、`getent hosts` |
| HTTP 502 | 上游服务或代理后端异常 | 服务日志、健康检查、端口监听 |

## 7. Git 协作速查

查看状态：

```bash linenums="0"
git status --short --branch
git log --oneline --decorate -n 10
git branch --show-current
```

创建分支：

```bash linenums="0"
git switch main
git pull --ff-only
git switch -c docs/stage-01-foundation-portfolio
```

提交：

```bash linenums="0"
git add .
git diff --check
git commit -m "docs: update foundation stage" -m "Refs #3"
```

推送：

```bash linenums="0"
git push -u origin docs/stage-01-foundation-portfolio
```

处理冲突：

```bash linenums="0"
git status
git diff
# 编辑冲突文件，删除 <<<<<<< ======= >>>>>>> 标记
git add path/to/file
git rebase --continue
```

!!! warning "公共分支不要强推"
    个人功能分支 rebase 后可以谨慎使用 `git push --force-with-lease`。不要对 `main`、共享 release 分支或他人协作分支强推。

## 8. Shell 脚本速查

脚本基本结构：

```bash linenums="0"
#!/usr/bin/env bash
set -Eeuo pipefail

main() {
  echo "hello"
}

main "$@"
```

检查语法：

```bash linenums="0"
bash -n scripts/*.sh
shellcheck scripts/*.sh
```

检查退出码：

```bash linenums="0"
./scripts/check.sh
echo "$?"
```

安全写法：

| 风险 | 不推荐 | 推荐 |
|---|---|---|
| 变量拆分 | `rm $file` | `rm "$file"` |
| 空路径删除 | `rm -rf "$target"` | 先校验 `[[ -n "$target" ]]` 和路径前缀 |
| 命令注入 | `eval "$cmd"` | 使用数组或明确参数 |
| 日志泄密 | `set -x` 打印所有变量 | 敏感命令关闭调试输出 |
| 错误被吞 | 不检查退出码 | 使用 `set -Eeuo pipefail` 和明确 `exit` |

## 9. 阶段一排障流程

遇到问题时，按这个顺序收集信息：

```bash linenums="0"
echo "==> where am I"
pwd
git status --short --branch

echo "==> tools"
command -v go git docker kubectl kind helm bash

echo "==> versions"
go version || true
git --version || true
docker version || true
kubectl version --client || true
kind version || true
helm version || true

echo "==> process and ports"
ps aux | grep todo || true
ss -lnt | grep -E '18080|30080' || true

echo "==> scripts"
bash -n scripts/*.sh 2>/dev/null || true
```

然后用一句话写出当前判断：

```text linenums="0"
现象：
已确认：
尚未确认：
下一步：
```

这比“把所有输出贴给别人”更像真实工作。好的排障记录应该让同事快速知道你已经排除了哪些方向。

## 10. 生产环境红线

阶段一虽然是基础课程，但这些红线从第一天就要建立：

- 不提交密钥、Token、数据库密码、kubeconfig。
- 不用 `chmod 777` 解决权限问题。
- 不在不确定路径执行 `rm -rf`。
- 不把 `kill -9` 当作常规停止方式。
- 不在生产机器上无范围执行高成本 `find /` 或全盘 `grep`。
- 不在生产环境随意监听 `0.0.0.0` 暴露管理端口。
- 不在含敏感信息的请求上随意使用 `tcpdump -A`。
- 不绕过 PR、Review、CI 直接合并到 `main`。
- 不让脚本默认操作生产 kube-context。

## 11. 面试复盘题

完成阶段一后，可以用下面这些问题自测：

1. 你会如何从零准备一台云原生开发机？
2. Linux 中 `/etc`、`/var`、`/opt`、`/home` 的职责分别是什么？
3. 服务启动失败时，你会如何从文件、权限、进程、日志四个方向排查？
4. `127.0.0.1` 和 `0.0.0.0` 有什么区别？
5. `Connection refused` 和 `Connection timed out` 的排查路径有什么不同？
6. 为什么团队必须通过 PR 合并代码？
7. `merge` 和 `rebase` 分别适合什么场景？
8. Shell 脚本为什么要关注退出码？
9. 如何防止清理脚本误删文件？
10. 阶段一作品集如何证明你具备真实工作能力？

如果这些问题你能结合自己的实验输出回答出来，阶段一就不仅是“学过”，而是已经转化成可展示的工作能力。
