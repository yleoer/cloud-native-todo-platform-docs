# 第 16 篇：Dockerfile 与镜像构建 [C]

> 本篇为新版课程计划占位文档。旧版 Dockerfile 课程已移入 `legacy/chapters/stage-03-docker/old-15-dockerfile.md`，正式正文将后续按新版主线重写。

## 计划定位

掌握生产级 Dockerfile 编写、镜像优化、安全实践和调试工具。

## 计划章节

- 16.1 Dockerfile 指令详解
- 16.2 Go 服务多阶段构建
- 16.3 镜像缓存、构建上下文与 `.dockerignore`
- 16.4 非 root 用户、最小镜像与安全扫描
- 16.5 镜像版本、标签和推送仓库
- 16.6 镜像调试与优化工具（dive 分析镜像层、hadolint 检查 Dockerfile、trivy 漏洞扫描）

## 特色项目

为 Todo 平台构建安全、小体积、可发布的 Go 服务镜像。

## 能力验收标准

能写出生产可用 Dockerfile，能使用工具分析和优化镜像体积与安全性。
