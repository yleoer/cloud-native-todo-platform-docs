# 第 3 篇：Linux 进程、服务与软件管理：练习题与面试题

> 本页由 [第 3 篇：Linux 进程、服务与软件管理](../../chapters/stage-01-foundation/03-linux-process.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. 程序和进程有什么区别？请用 `todo-process-demo` 举例。
2. PID 和 PPID 分别表示什么？为什么 systemd 常常是 PID 1？
3. `SIGTERM` 和 `SIGKILL` 有什么区别？为什么生产环境不建议优先使用 `kill -9`？
4. `systemctl status` 和 `journalctl -u` 分别解决什么问题？
5. `apt`、`dnf`、遗留 `yum` 分别常见于哪些发行版？

### 实操题

1. 使用 `ps` 和 `pgrep` 找到 `todo-process-demo` 的 PID。当 `ps -p "$PID"` 能显示进程信息时，说明操作成功。
2. 访问 `/work?ms=3000`，同时用 `top -p "$PID"` 观察 CPU 变化。当 `top` 中能看到该进程 CPU 短时升高时，说明操作成功。
3. 修改 `/etc/todo-platform/process-demo.env` 中的端口为 `18081` 并重启服务。当 `curl http://127.0.0.1:18081/healthz` 成功且 `ss` 显示 `18081` 监听时，说明操作成功。完成后把端口改回 `18080` 并再次重启服务，避免影响本篇验收脚本和下一篇网络实验。

### 思考题

1. 如果一个服务每隔几秒自动重启，你会如何判断是 systemd 配置问题还是程序自身崩溃？
2. 如果服务 CPU 很高但日志没有错误，你下一步会收集哪些证据？为什么？

## 面试题

### 1. Linux 中程序和进程有什么区别？

**一句话结论**：程序是磁盘上的可执行文件，进程是程序运行起来后的实例。

**展开解释**：进程有 PID、PPID、运行用户、环境变量、CPU、内存、文件描述符和信号处理等运行时状态。同一个程序可以启动多个进程。线上排障时，确认程序文件存在还不够，还要确认进程是否真的运行、状态是否正常、资源是否异常。

**深入追问**：如果服务由 systemd 管理，可以用 `systemctl show -p MainPID --value 服务名` 获取主进程 PID，再用 `ps -p PID -o pid,ppid,user,stat,%cpu,%mem,cmd` 查看运行状态。

### 2. 服务启动失败时你会怎么排查？

**一句话结论**：先看 systemd 状态和日志，再检查启动路径、权限、配置和端口。

**展开解释**：第一步执行 `systemctl status 服务名 --no-pager` 看 `Active` 状态、退出码和最近日志；第二步执行 `journalctl -u 服务名 -n 100 --no-pager` 看完整错误；随后检查 `ExecStart` 文件是否存在且可执行、配置文件是否可读、运行用户是否有权限、端口是否被占用。

**深入追问**：如果看到 `status=203/EXEC`，通常是二进制路径错误或不可执行；如果看到 `permission denied`，要检查 `User=`、目录权限和配置文件权限；如果看到 `address already in use`，要用 `ss` 或 `lsof` 查端口占用。

### 3. `SIGTERM` 和 `SIGKILL` 有什么区别？

**一句话结论**：`SIGTERM` 请求进程正常退出，`SIGKILL` 强制结束且进程无法处理。

**展开解释**：服务收到 `SIGTERM` 后可以关闭监听、处理未完成请求、释放资源和写入日志；`SIGKILL` 会立即终止进程，无法执行清理逻辑。生产环境优先使用 `systemctl stop` 或 `kill -TERM`，只有进程无响应时才考虑 `kill -KILL`。

**深入追问**：Kubernetes 删除 Pod 时也会先发送终止信号，并等待 `terminationGracePeriodSeconds`，这和 systemd 的 `TimeoutStopSec` 思想类似。

### 4. systemd service unit 中 `ExecStart`、`User`、`Restart` 分别有什么作用？

**一句话结论**：`ExecStart` 定义启动命令，`User` 定义运行身份，`Restart` 定义异常退出后的恢复策略。

**展开解释**：`ExecStart` 应使用绝对路径，避免依赖当前目录和 PATH；`User` 用来让服务以低权限用户运行，减少安全风险；`Restart=on-failure` 可以在程序崩溃时自动拉起服务，提高可用性。

**深入追问**：这三个字段在 Kubernetes 中分别能对应到容器 `command/args`、`securityContext.runAsUser` 和 Deployment 控制器的自动恢复能力。

### 5. 如何定位端口被哪个进程占用？

**一句话结论**：用 `ss` 或 `lsof` 找到监听端口的 PID，再用 `ps` 判断进程身份。

**展开解释**：常用命令是 `sudo ss -lntp | grep 18080` 或 `sudo lsof -iTCP:18080 -sTCP:LISTEN`。找到 PID 后，用 `ps -p PID -o pid,user,cmd` 查看进程属于哪个用户、启动命令是什么。

**深入追问**：不要看到端口占用就直接 kill。生产环境要先判断该进程是否属于其他业务、是否有流量、是否能平滑迁移，必要时走变更流程。
