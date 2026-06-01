# 第 18 篇：容器运行原理：练习题与面试题

> 本页由 [第 18 篇：容器运行原理](../../chapters/stage-03-docker/18-container-internals.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. 容器和虚拟机最大的区别是什么？为什么容器启动通常更快？
2. namespace 和 cgroups 分别解决什么问题？
3. 为什么容器内看到 PID 1，而宿主机上同一个进程有另一个 PID？
4. rootfs、chroot、OverlayFS 三者分别解决什么问题？
5. 为什么生产环境不建议把业务数据写入容器可写层？

### 实操题

1. 使用 `unshare --uts` 修改新 namespace 中的 hostname，退出后验证宿主机 hostname 没有变化。当原 shell 中 `hostname` 仍为原值时，说明成功。
2. 使用 `docker run --rm --memory=64m --cpus=0.5 registry.cn-guangzhou.aliyuncs.com/yleoer/alpine:3.23 ...` 观察 `/proc/self/cgroup`，再用 `docker inspect` 查看 `HostConfig.Memory` 和 `HostConfig.NanoCpus`。当两处都能看到资源限制信息时，说明成功。
3. 修改 OverlayFS 合并视图中的 `app.txt`，确认只读层文件未变化、`upper/app.txt` 出现修改后的内容。当 lower 不变、upper 改变时，说明你理解了 copy-up。

### 思考题

1. 如果 Go 服务在 Kubernetes 中被 `OOMKilled`，但应用日志没有错误，你会从哪些层面排查？
2. 如果安全团队要求禁止 privileged 和 Docker socket 挂载，你会如何向业务团队解释这些配置的风险？

## 面试题

### 面试题 1：容器和虚拟机有什么区别？

**一句话结论**：虚拟机有独立 Guest OS 和内核，容器共享宿主机 Linux 内核，只是通过 namespace、cgroups 和 rootfs 等机制隔离进程。

**展开解释**：虚拟机通过 Hypervisor 虚拟硬件，在上面运行完整操作系统。容器不虚拟硬件，也不启动新内核，容器进程仍然是宿主机上的普通 Linux 进程。容器启动快、镜像小，但隔离边界依赖共享内核和运行时安全配置。

**深入追问**：如果面试官问安全边界，要说明容器不是强沙箱，生产环境还需要非 root、capabilities 收敛、seccomp、AppArmor / SELinux、镜像扫描、节点隔离和最小权限。

### 面试题 2：namespace 和 cgroups 分别解决什么问题？

**一句话结论**：namespace 解决“进程能看到什么”，cgroups 解决“进程能用多少资源”。

**展开解释**：PID namespace 让容器内有自己的进程树，Network namespace 让容器有自己的网卡和路由，Mount namespace 让容器看到自己的挂载点。cgroups 则限制 CPU、内存、IO、进程数量等资源，并提供统计信息。

**深入追问**：如果面试官问 Kubernetes limit 背后是什么，要说明 Pod 或容器的资源限制最终会由容器运行时写入节点上的 cgroup。

### 面试题 3：为什么容器主进程退出后容器会停止？

**一句话结论**：容器本质上围绕一个主进程运行，主进程通常是容器 namespace 内的 PID 1，PID 1 退出意味着容器生命周期结束。

**展开解释**：容器不是虚拟机，没有传统 init 系统维持整台机器状态。Docker 和运行时跟踪容器主进程，主进程退出后，容器就进入 exited 状态。这也是为什么容器镜像的 `ENTRYPOINT` / `CMD` 要直接运行前台服务。

**深入追问**：PID 1 还涉及信号处理和子进程回收。生产 Go 服务应正确处理 SIGTERM，保证滚动发布和节点排空时能优雅退出。

### 面试题 4：Docker `--memory` 和 Kubernetes memory limit 背后是什么？

**一句话结论**：它们最终都会落到 Linux cgroups 的内存控制上，限制进程组可使用的内存。

**展开解释**：在 cgroup v2 中，可以通过 `memory.max` 设置内存上限，通过 `memory.current` 查看当前使用，通过 `memory.events` 查看 OOM 等事件。超过限制时，内核可能直接 kill 进程，应用不一定有机会输出错误。

**深入追问**：排查 OOM 不能只看应用日志，还要看容器退出状态、Pod 事件、节点内存、应用指标、GC 指标和 cgroup 事件。

### 面试题 5：UnionFS / OverlayFS 与镜像分层有什么关系？

**一句话结论**：镜像层通常是只读层，容器运行时在其上叠加可写层，OverlayFS 把它们合并成容器看到的统一文件系统。

**展开解释**：lowerdir 表示只读镜像层，upperdir 表示容器可写层，merged 表示容器看到的视图。修改只读层文件时会 copy-up 到可写层，删除容器后可写层消失，但镜像层不变。

**深入追问**：这解释了为什么日志和业务数据不应长期写在容器层，也解释了 Dockerfile 中复制大文件、删除密钥、频繁改动依赖层会影响镜像体积和安全。

### 面试题 6：`nsenter` 在容器排障中有什么作用？

**一句话结论**：`nsenter` 可以从宿主机进入目标进程所在的 namespace，用于底层网络、进程和挂载排障。

**展开解释**：当容器镜像没有 shell 或缺少网络工具时，管理员可以通过宿主机找到容器主进程 PID，再用 `nsenter --target <pid> --net` 进入它的 Network namespace 查看网卡、路由和监听端口。

**深入追问**：`nsenter` 权限很高，生产环境使用必须受控和审计。Kubernetes 中更常用受控的 debug container、节点排障流程和审计系统。
