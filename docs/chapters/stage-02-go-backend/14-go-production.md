# 第 14 篇：Go 后端生产化能力 [C]

> 本篇为新版课程计划占位文档。旧版生产化课程已移入 `legacy/chapters/stage-02-go-backend/old-13-go-production.md`，正式正文将后续按新版主线重写。

## 计划定位

补齐真实公司后端服务需要的认证、安全、配置、日志、性能分析和运行能力。

## 计划章节

- 14.1 JWT 鉴权与用户登录
- 14.2 中间件链路、请求 ID 与审计日志
- 14.3 参数校验、安全响应与敏感信息保护
- 14.4 配置分层：dev、test、prod
- 14.5 CORS、Rate Limiting 与安全 Header
- 14.6 服务启动、优雅关闭与运维命令设计
- 14.7 Go pprof 性能分析入门（CPU profile、heap profile、goroutine profile）

## 特色项目

将 Todo 平台升级为 Todo API v5 生产风格 API 服务。

## 能力验收标准

能实现认证、日志、配置分层、健康检查、优雅关闭和基础性能分析。
