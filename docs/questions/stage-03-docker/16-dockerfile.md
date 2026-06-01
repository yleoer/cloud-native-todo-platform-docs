# 第 16 篇：Dockerfile 与镜像构建：练习题与面试题

> 本页由 [第 16 篇：Dockerfile 与镜像构建](../../chapters/stage-03-docker/16-dockerfile.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. Dockerfile 中 `RUN`、`ENTRYPOINT`、`CMD` 分别在什么时候生效？为什么不能把长期运行的服务写进 `RUN`？
2. 为什么本篇要先 `COPY go.mod go.sum ./`，再 `COPY . .`？这和构建缓存有什么关系？
3. `.dockerignore` 和 `.gitignore` 解决的问题有什么不同？为什么 `.gitignore` 不能替代 `.dockerignore`？
4. 为什么运行镜像不应该使用完整 `golang` 镜像？多阶段构建解决了什么问题？
5. 镜像标签和镜像 digest 有什么区别？为什么生产环境不能只依赖 `latest`？

### 实操题

1. 修改 Dockerfile，把 `TODO_ENV` 默认值从 `prod` 改为 `dev`，重新构建镜像并执行 `docker image inspect`。当你能在 `Config.Env` 中看到新默认值时，说明修改生效。完成后再改回 `prod`，避免把开发默认值带入后续章节。
2. 故意删除 `.dockerignore` 中的 `site/` 或 `tmp/`，创建一个大文件后重新构建，观察 `transferring context` 和镜像构建耗时变化。当你能解释为什么上下文变大时，说明你理解了 `.dockerignore` 的作用。
3. 把 `USER nonroot:nonroot` 临时删除后重新构建，执行 `docker image inspect todo-api:v0.1.0 --format '{{.Config.User}}'`。当输出为空或不是 `nonroot:nonroot` 时，说明你看到了默认用户风险。实验结束后必须恢复 `USER` 指令。

### 思考题

1. 如果安全扫描报告里出现一个 HIGH 漏洞，但业务必须今天上线，你会如何和开发、安全、SRE 一起评估是否阻塞发布？
2. 如果 CI 中 Docker build 经常因为下载 Go module 超时失败，你会从构建缓存、代理、私有 module、基础镜像和流水线拆分几个角度怎么优化？

## 面试题

### 面试题 1：什么是 Docker 多阶段构建？它解决了什么问题？

**一句话结论**：多阶段构建把编译环境和运行环境拆开，最终镜像只保留运行必需文件，从而减小体积、降低漏洞面并提升交付可控性。

**展开解释**：以 Go 服务为例，编译阶段需要 `golang` 镜像、module 缓存、测试工具和源码；运行阶段只需要编译后的二进制、配置文件和迁移脚本。Dockerfile 可以先在 builder 阶段执行 `go test` 和 `go build`，再在 runtime 阶段用 `COPY --from=builder` 复制产物。这样最终镜像不包含 Go 编译器和源码缓存，也更容易配合非 root、distroless 和漏洞扫描。

**深入追问**：多阶段构建不是越多阶段越好。要根据缓存命中、测试策略、构建速度和可读性拆分阶段。生产中还会结合 BuildKit cache mount、registry cache、SBOM、provenance 和多平台构建，把本地 Dockerfile 扩展成 CI/CD 构建链路。

### 面试题 2：`.dockerignore` 为什么重要？它和 `.gitignore` 有什么区别？

**一句话结论**：`.dockerignore` 控制发送给 Docker daemon 的构建上下文，`.gitignore` 控制 Git 是否跟踪文件，两者作用域不同，不能互相替代。

**展开解释**：Docker build 时，客户端会把构建上下文发送给 Docker daemon。即使某个文件没有提交到 Git，只要它在构建上下文里且没有被 `.dockerignore` 排除，就可能参与构建。`.env`、日志、大型临时文件、测试数据和旧二进制都可能拖慢构建或泄露敏感信息。因此 `.dockerignore` 是镜像构建安全和性能的一部分。

**深入追问**：在 monorepo 中，`.dockerignore` 的设计更重要。不同服务可能共享一个根上下文，错误排除会导致构建失败，排除不足会导致上下文巨大。团队可以用 `docker build --progress=plain`、BuildKit 输出和 CI 检查来监控上下文大小。

### 面试题 3：为什么容器要用非 root 用户运行？

**一句话结论**：非 root 运行能降低应用漏洞被利用后的权限范围，是容器生产安全基线的一部分。

**展开解释**：如果容器进程以 root 运行，攻击者拿到应用执行能力后，容器内文件修改、进程操作和潜在逃逸风险都会更高。非 root 不能解决所有安全问题，但能减少默认权限。配合只读文件系统、最小镜像、Capabilities 限制、Seccomp、AppArmor 和 Kubernetes SecurityContext，才能形成更完整的运行时防线。

**深入追问**：非 root 运行需要应用配合。例如日志不能写固定 root 目录，临时文件要写 `/tmp` 或挂载目录，监听低端口需要额外能力。镜像构建时还要处理文件属主和权限，避免运行时出现 `permission denied`。

### 面试题 4：`ENTRYPOINT` 和 `CMD` 怎么设计更适合后端服务？

**一句话结论**：通常用 `ENTRYPOINT` 固定应用二进制，用 `CMD` 提供默认子命令，这样既有默认服务启动方式，也能方便覆盖执行迁移、配置检查和工具命令。

**展开解释**：本篇使用 `ENTRYPOINT ["/app/todo-api"]` 和 `CMD ["serve"]`，默认运行 API 服务；执行 `docker run todo-api:v0.1.0 migrate` 时，Docker 会把 `migrate` 作为参数传给入口二进制。这样同一个镜像可以服务于启动、迁移、OpenAPI 输出、密码哈希和配置检查，减少“运行镜像”和“运维工具镜像”不一致的问题。

**深入追问**：如果入口脚本过于复杂，可能掩盖信号处理、退出码和日志问题。Go 服务应正确处理 SIGTERM 和优雅关闭；迁移命令应该明确失败退出码，避免 CI/CD 或 Kubernetes Job 误判成功。

### 面试题 5：镜像漏洞扫描发现 HIGH 漏洞时，你会怎么处理？

**一句话结论**：先定位漏洞来源和可利用性，再判断是否升级基础镜像或依赖、是否阻塞发布，并把处理决策记录到发布流程中。

**展开解释**：漏洞可能来自基础镜像 OS 包、Go module、间接依赖或扫描数据库误报。处理时要看严重等级、是否有修复版本、应用是否实际使用受影响功能、是否暴露攻击面，以及当前发布是否紧急。常见动作包括升级基础镜像、升级 Go 依赖、替换镜像、等待上游修复、增加临时缓解措施或阻塞发布。

**深入追问**：成熟团队会把扫描放进 CI/CD 门禁，并定义策略，例如 CRITICAL 阻塞、HIGH 需要安全审批、无修复版本需记录例外。还会生成 SBOM，保存镜像 digest 和扫描报告，确保上线后可以追踪和重建。
