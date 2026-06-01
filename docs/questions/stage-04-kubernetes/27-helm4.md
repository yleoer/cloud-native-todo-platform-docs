# 第 27 篇：Helm 4 包管理：练习题与面试题

> 本页由 [第 27 篇：Helm 4 包管理](../../chapters/stage-04-kubernetes/27-helm4.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 9.1 基础题

1. 用一句话解释 Chart 和 Release 的区别。
2. `Chart.yaml` 中 `version` 和 `appVersion` 分别应该什么时候变化？
3. 为什么 `templates/_helpers.tpl` 里的模板名称建议以 Chart 名称作为前缀？
4. 为什么 production values 不应该直接保存真实数据库密码或 JWT Secret？
5. `helm rollback todo-platform 1` 为什么会创建新的 revision？

### 9.2 实操题

1. 把 `hpa.enabled` 改为 `true`，执行 `helm upgrade`，验证 HPA 对象是否出现；如果集群没有 metrics-server，观察 HPA 指标为空时的提示。
2. 把 `cache.enabled` 改为 `true`，执行 `helm upgrade`，验证本地 subchart 生成的 ConfigMap 是否出现。
3. 给 Chart 增加 `values-test.yaml`，设置 `replicaCount: 1`、`config.env: test` 和 `config.release: chapter-27-test`；再故意把 `replicaCount` 写成字符串，观察 `values.schema.json` 拦截错误，修复后用 `helm template` 验证输出。

### 9.3 思考题

1. Helm 和 Kustomize 都能管理多环境配置。为什么本课程先讲 Helm，再讲 Kustomize？
2. 如果一次 Helm upgrade 同时修改了镜像版本、数据库迁移 Job 和 Secret 名称，回滚时可能有哪些 Kubernetes 之外的风险？

## 面试题

### 面试题 1：Helm Chart 和普通 Kubernetes YAML 的核心区别是什么？

**一句话结论**：普通 YAML 描述一组固定对象，Helm Chart 描述一个可参数化、可版本化、可安装和可回滚的 Kubernetes 应用包。

**展开解释**：Chart 通过 `Chart.yaml` 描述包元数据，通过 `values.yaml` 暴露参数，通过 `templates/` 渲染 Kubernetes 对象。安装后 Helm 会创建 release 记录，后续 upgrade 和 rollback 都基于 release 历史执行。

**深入追问**：Helm 不会替你理解业务状态。它能回滚 Deployment、Service、ConfigMap 等对象，但不能自动回滚数据库数据或外部系统变更。

### 面试题 2：`version` 和 `appVersion` 有什么区别？

**一句话结论**：`version` 是 Chart 包版本，`appVersion` 是应用版本。

**展开解释**：修改模板、values 默认值、依赖或 Chart 行为时，应提升 `version`。应用镜像从 `v0.1.0` 升到 `v0.1.1` 时，可以同步更新 `appVersion`。两者可以相同，也可以不同，但语义不能混。

**深入追问**：如果只改了 Deployment 模板的安全上下文，镜像没变，也要提升 Chart `version`，否则使用者无法区分两个包的行为差异。

### 面试题 3：Helm values 的覆盖顺序是什么？

**一句话结论**：Chart 默认 values 最低，多个 `-f` 文件按从左到右覆盖，命令行 `--set` 通常优先级最高。

**展开解释**：团队通常把稳定默认值放在 `values.yaml`，把环境差异放在 `values-dev.yaml` 或 `values-prod.yaml`，把本地敏感值放在不提交的 `values.local.yaml`。后面的文件覆盖前面的同名字段。

**深入追问**：`--set` 适合临时覆盖少量简单值；复杂结构、字符串数字、长文本或敏感值更适合 values 文件、`--set-string`、`--set-file` 或外部 Secret 管理系统。

### 面试题 4：为什么 Helm rollback 不等于万能回滚？

**一句话结论**：Helm rollback 只重新应用历史 revision 的 Kubernetes Manifest 和 values，不回滚集群外部状态。

**展开解释**：Deployment、Service、ConfigMap 这类对象可以随 manifest 回退，但数据库迁移、PVC 数据、外部 DNS、第三方 API 配置和消息队列状态不会自动回到过去。

**深入追问**：生产发布中，数据库迁移应尽量向前兼容；危险迁移需要备份、演练、灰度和独立回滚方案，不能只依赖 `helm rollback`。

### 面试题 5：Chart 依赖、OCI registry 和 Helm 4 迁移要点分别是什么？

**一句话结论**：Chart 依赖解决复用和组合问题，OCI registry 解决 Chart 包分发和权限管理问题，Helm 4 迁移重点关注 CLI 标志、server-side dry-run、等待策略、registry 登录格式和 digest 安装。

**展开解释**：父 Chart 可以通过 `dependencies` 引用 subchart，并用 `Chart.lock` 锁定版本。打包后的 `.tgz` 可以放在传统 Helm repository，也可以推送到 OCI registry，和容器镜像使用相似的仓库权限、tag 和 digest 机制。Helm 4 推荐用 `--rollback-on-failure` 表达失败回滚，`--dry-run=server` 明确要求连接 API Server，`--wait=watcher` 使用新的等待策略，`helm registry login` 只写 registry 域名；Chart 本身仍可继续使用 `apiVersion: v2`。

**深入追问**：依赖必须固定版本，不要让生产发布依赖“最新版本”。OCI 安装时如果能使用 digest，可以进一步减少同名 tag 被替换的风险。迁移生产流水线时，不能只替换命令名；还要验证 release 历史、Secret 暴露、依赖构建、OCI 凭证和准入控制行为，确保 CI 与真实集群策略一致。
