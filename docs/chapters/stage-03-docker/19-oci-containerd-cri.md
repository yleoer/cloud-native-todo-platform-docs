# 第 19 篇：OCI、containerd、runc 与 CRI [B]

> 本篇为新版课程计划占位文档。旧版容器运行时课程已移入 `legacy/chapters/stage-03-docker/old-18-container-runtime.md`，正式正文将后续按新版主线重写。

## 计划定位

理解 Kubernetes 底层如何调用容器运行时，理清 Docker、containerd、runc 的关系。

## 计划章节

- 19.1 OCI 规范与镜像格式（image-spec、runtime-spec）
- 19.2 runc 与低层容器运行
- 19.3 containerd、shim 与容器生命周期
- 19.4 CRI、crictl 与 Kubernetes 运行时接口
- 19.5 Docker、containerd、nerdctl、cri-o 的关系与演进

## 特色项目

使用 `nerdctl` 和 `crictl` 观察 Todo 平台容器运行状态，对比 Docker 命令与 nerdctl 命令的对应关系。

## 能力验收标准

能说明 Docker、containerd、runc、CRI、Kubernetes 之间的调用关系，能用 crictl 排查容器运行时问题。
