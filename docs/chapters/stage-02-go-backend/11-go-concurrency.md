# 第 11 篇：Go 并发编程 [C]

> 本篇为新版课程计划占位文档。正式正文将按 `docs/course-design/00-chapter-writing-standard.md` 重写，不沿用旧课程内容。

## 计划定位

以 HTTP 服务的并发请求处理为场景，掌握 goroutine、channel、context 和同步原语。

## 计划章节

- 11.1 goroutine 与并发执行：HTTP Server 的每请求一个 goroutine
- 11.2 channel 通信模型（无缓冲/有缓冲/select 多路复用）
- 11.3 context 超时、取消与 HTTP 请求链路传递
- 11.4 sync 包：Mutex、RWMutex、WaitGroup、Once
- 11.5 并发安全、竞态检测（`go test -race`）与限流思想
- 11.6 HTTP Server 中的并发模式实战（优雅关闭、连接池、worker pool）

## 特色项目

开发并发 Todo 统计任务执行器，支持超时取消、并发数控制；对 Todo API 做并发压测并分析竞态问题。

## 能力验收标准

能正确使用 goroutine、channel、context，能避免常见并发泄漏和数据竞争，能对 HTTP 服务做并发压测。
