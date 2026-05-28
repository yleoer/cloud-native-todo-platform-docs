# 第 18 篇：容器运行原理 [B]

> 本篇为新版课程计划占位文档。旧版容器原理课程已移入 `legacy/chapters/stage-03-docker/old-17-container-internals.md`，正式正文将后续按新版主线重写。

## 计划定位

理解容器不是虚拟机，掌握 Namespace、Cgroups、UnionFS 等底层机制。

## 计划章节

- 18.1 容器与虚拟机的本质区别
- 18.2 Linux Namespace：进程、网络、挂载隔离
- 18.3 Cgroups：CPU、内存、IO 资源限制
- 18.4 UnionFS 与镜像分层原理
- 18.5 手动模拟一个简化容器

## 特色项目

用 Linux 命令（unshare、nsenter、cgcreate）手动模拟容器隔离与资源限制。

## 能力验收标准

能解释容器隔离、资源限制、镜像分层和容器进程模型。
