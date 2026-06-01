# 第 19 篇：OCI、containerd、runc 与 CRI：练习题与面试题

> 本页由 [第 19 篇：OCI、containerd、runc 与 CRI](../../chapters/stage-03-docker/19-oci-containerd-cri.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 9.1 基础题

1. 用一句话分别解释 OCI image-spec、runtime-spec 和 distribution-spec。
2. 为什么 Kubernetes 不应该依赖 Docker CLI 来启动 Pod？
3. `crictl ps` 和 `ctr -n k8s.io tasks ls` 分别看的是哪一层？
4. 为什么 `ctr containers ls` 可能为空，而 `ctr -n k8s.io containers ls` 能看到容器？
5. PodSandbox 和业务容器有什么区别？

### 9.2 实操题

1. 把 `runtime-probe.yaml` 中的镜像改成一个不存在的标签，例如 `alpine:not-exist`，观察 `kubectl describe pod` 和 `crictl pull` 的错误。记录后恢复为 `registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23`。
2. 删除 `CONTAINER_ID` 变量后重新通过 `crictl pods --name runtime-probe -q` 找回 `POD_ID`，再用 `crictl ps --pod "$POD_ID" -q` 找回容器 ID，并用 `ctr -n k8s.io tasks ls` 验证同一个 task。
3. 如果本地存在 `todo-api:v0.1.0`，执行 `kind load docker-image`，并分别用 `crictl images` 和 `ctr -n k8s.io images ls` 验证。

### 9.3 思考题

1. 生产节点上为什么不建议直接用 `ctr` 删除 Kubernetes 管理的 container 或 snapshot？如果节点磁盘满了，应该如何设计更安全的处置流程？
2. 如果一个团队同时使用 Docker Desktop、kind、containerd、CRI-O 和云厂商托管 Kubernetes，如何制定统一的镜像标签、digest、签名和运行时版本策略？

## 面试题

### 1. Docker、containerd、runc 和 kubelet 的关系是什么？

**一句话结论**：Docker 和 kubelet 都可以处在上层入口，containerd 负责运行时生命周期管理，runc 按 OCI runtime-spec 创建底层容器进程。

**展开解释**：Docker 面向开发者，提供构建、运行、日志、网络和 Compose 等体验；Kubernetes 节点上由 kubelet 管理 Pod，kubelet 通过 CRI 调用 containerd；containerd 拉取镜像、管理快照和 task，再通过 shim 调用 runc；runc 最终设置 namespace、cgroup、mount 等 Linux 能力。

**追问方向**：如果面试官问“Docker 被 Kubernetes 移除了吗”，要回答：Kubernetes 移除的是内置 dockershim 依赖，不是 OCI 镜像格式，也不是开发机 Docker 工具。

### 2. OCI image-spec 和 runtime-spec 有什么区别？

**一句话结论**：image-spec 描述镜像内容如何组织，runtime-spec 描述如何把 rootfs 和 `config.json` 启动成容器进程。

**展开解释**：image-spec 关注 manifest、config、layer、digest 和多架构 image index；runtime-spec 关注 OCI bundle、进程参数、rootfs、mount、namespace、cgroup、capabilities、seccomp 等运行配置。containerd 可以把镜像拉取和解包成 snapshot，再生成运行时需要的 OCI spec 交给 runc。

**追问方向**：可以继续说明 digest 为什么比 tag 更适合生产发布，以及第 16 篇 OCI Label 如何进入镜像 config。

### 3. `crictl` 和 `ctr` 有什么区别？

**一句话结论**：`crictl` 面向 CRI，用 Kubernetes 运行时语义看 Pod 和容器；`ctr` 面向 containerd，用底层对象语义看 container、task、image 和 snapshot。

**展开解释**：排查 Kubernetes 节点时，`crictl pods`、`crictl ps`、`crictl logs` 更贴近 kubelet 看到的状态；`ctr -n k8s.io containers ls`、`tasks ls` 更贴近 containerd 内部状态。`ctr` 不追求用户友好，也不等同 Docker CLI。

**追问方向**：如果 `ctr containers ls` 为空，要先检查 containerd namespace，Kubernetes 通常使用 `k8s.io`。

### 4. PodSandbox 是什么，为什么需要它？

**一句话结论**：PodSandbox 是 CRI 中表示 Pod 基础隔离环境的对象，通常先于业务容器创建。

**展开解释**：Pod 不是一个普通容器，而是一组共享网络和生命周期的容器。运行时需要先创建 Pod 的基础环境，例如 pause 容器持有网络 namespace，然后业务容器再加入这个环境。网络初始化、CNI 配置失败时，问题往往出现在 PodSandbox 阶段。

**追问方向**：可以讨论普通 Linux 容器运行时和沙箱运行时对 PodSandbox 的不同实现，例如轻量虚拟机运行时可能把 Sandbox 做成更强隔离边界。

### 5. 为什么生产发布建议使用镜像 digest？

**一句话结论**：digest 绑定内容，tag 只是可变引用；生产用 digest 更利于审计、回滚和供应链安全。

**展开解释**：同一个 tag 可能被重新推送，导致不同节点在不同时间拉到不同内容。digest 是镜像内容摘要，只要内容变化 digest 就变化。结合 SBOM、签名、漏洞扫描和 OCI Label，可以建立“源码 commit -> 镜像 digest -> 部署版本 -> 节点实际运行内容”的追踪链路。

**追问方向**：可以进一步讨论如何在 Kubernetes YAML、Helm values、GitOps 和 CI/CD 中记录 digest，并处理紧急漏洞修复和回滚。
