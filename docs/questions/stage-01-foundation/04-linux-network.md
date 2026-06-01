# 第 4 篇：Linux 网络基础与排障：练习题与面试题

> 本页由 [第 4 篇：Linux 网络基础与排障](../../chapters/stage-01-foundation/04-linux-network.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. `127.0.0.1` 和 `0.0.0.0` 有什么区别？
2. 为什么 `ping` 成功不代表 HTTP 服务一定可用？
3. `Connection refused` 和 `Connection timed out` 的含义有什么不同？
4. `ss -lntp` 中的 `LISTEN` 表示什么？
5. `dig` 和 `getent hosts` 的结果为什么可能不同？

### 实操题

1. 将 Todo Demo 改为监听 `127.0.0.1:18081`，并用 `curl` 验证。当 `ss -lnt 'sport = :18081'` 能看到 `LISTEN`，说明操作成功。
2. 保持一个服务占用 `18080`，再次启动同端口服务，记录错误并找出 PID。当你能解释 `address already in use` 来自哪个进程时，说明操作成功。
3. 使用 `TODO_READY=false` 启动服务，观察 `/readyz` 返回的 HTTP 状态码。当 `curl -i` 显示 `503 Service Unavailable`，说明操作成功。

### 思考题

1. 如果服务在服务器本机访问正常，但从公司网络访问超时，你会按什么顺序排查？
2. Kubernetes 中 Pod 正常但 Service 不通时，本篇哪些命令和思路仍然适用？

## 面试题

### 1. TCP 和 HTTP 是什么关系？

**一句话结论**：TCP 负责可靠传输字节流，HTTP 定义应用层请求和响应格式。

**展开解释**：大多数 HTTP/1.1 和 HTTP/2 请求运行在 TCP 之上。TCP 连接成功只说明目标 IP 和端口可达，不代表业务正常；HTTP 状态码、响应头和响应体才能说明应用层结果。

**深入追问**：排障时如果 TCP 连接失败，优先看 DNS、路由、端口监听、防火墙；如果 TCP 成功但 HTTP 返回 500，再看应用日志和依赖状态。

### 2. 如何判断一个 Linux 服务是否监听了端口？

**一句话结论**：用 `ss -lntp` 或 `lsof` 查看目标端口是否处于 `LISTEN`。

**展开解释**：例如 `sudo ss -lntp 'sport = :18080'`。如果看到 `LISTEN`，说明有进程监听该 TCP 端口。还要关注监听地址：`127.0.0.1` 只接受本机访问，`0.0.0.0` 表示监听所有 IPv4 网卡。

**深入追问**：在 Kubernetes 中，对应要进入 Pod 或容器中检查应用是否监听 `containerPort`，再看 Service 的 `targetPort` 是否映射正确。

### 3. `Connection refused` 和 `Connection timed out` 怎么排查？

**一句话结论**：`refused` 优先查端口监听，`timed out` 优先查网络路径和防火墙。

**展开解释**：`Connection refused` 通常表示目标主机可达但端口没有监听；`Connection timed out` 常见于包被防火墙、安全组、路由或 ACL 丢弃。前者用 `ss`、`lsof` 查端口，后者用 `ip route`、防火墙命令和 `tcpdump` 查包是否到达。

**深入追问**：在云环境中还要检查安全组、NACL、负载均衡后端健康状态；在 Kubernetes 中还要检查 NetworkPolicy、Service Endpoints 和 Ingress Controller 日志。

### 4. DNS 排查时为什么不能只看 `dig`？

**一句话结论**：`dig` 查询 DNS 服务器，应用程序通常走系统解析流程，两者可能不一致。

**展开解释**：系统解析可能先读取 `/etc/hosts`，再查询 DNS，还可能受 NSS、缓存、容器 DNS 配置影响。因此排查应用解析问题时，应同时看 `getent hosts`、`/etc/hosts`、`dig` 或 `nslookup`。

**深入追问**：在 Kubernetes 中还要检查 CoreDNS、Pod 的 `/etc/resolv.conf`、Service 名称、Namespace 和 DNS search domain。

### 5. tcpdump 在生产环境中怎么安全使用？

**一句话结论**：抓包前要授权，抓包时要限制范围，抓包文件要按敏感数据处理。

**展开解释**：生产抓包应限制 host、port、协议、包数量和时间窗口，避免全量抓包。HTTP 明文包可能包含 Token、Cookie、用户数据；即使 HTTPS 看不到正文，也可能暴露 IP、端口、SNI 等元数据。

**深入追问**：抓包通常用于证明请求是否到达、响应是否发出、握手是否完成。它不能替代应用日志、指标和链路追踪，最好与这些证据一起使用。
