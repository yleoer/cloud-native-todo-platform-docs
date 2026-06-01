# 第 35 篇：CRD 设计与实践：练习题与面试题

> 本页由 [第 35 篇：CRD 设计与实践](../../chapters/stage-06-platform-operator/35-crd-design.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

**基础题**

1. CRD 的 `metadata.name` 为什么必须是 `<plural>.<group>`？
2. `served: true` 和 `storage: true` 分别代表什么？
3. `status` subresource 启用后，主资源写入 status 为什么会被忽略？
4. `additionalPrinterColumns` 适合展示哪些字段？不适合展示哪些字段？
5. 为什么不能把所有配置都放进 `spec.values`？

**实操题**

1. 为 `TodoApp.spec.resources.profile` 增加 `xlarge` 会带来什么兼容性影响？先只修改本地文件，不要 apply。验收标准：能说明枚举扩展和 Controller 映射的关系。
2. 给 `TodoDatabase` 增加 `spec.backup.encryption.enabled` 字段。验收标准：字段类型为 boolean，默认值为 true 或 false，并能用 `kubectl explain` 查看。
3. 创建一个非法 `TodoCache`，把 `replicas` 设置为 5。验收标准：server-side dry-run 被 API server 拒绝。
4. 用 status subresource 给 `TodoDatabase` 写入 `Degraded` condition。验收标准：`kubectl describe tododatabase todo-postgres` 能看到对应状态。
5. 删除 `TodoApp.spec.ingress.host`，只保留 `ingress.enabled: true`。验收标准：能解释为什么 OpenAPI 的普通 required 不够用，以及 CEL 规则如何拦截这个输入。

**思考题**

1. 如果 `TodoDatabase.spec.version` 从字符串改成整数，会影响哪些已有用户和工具？
2. 如果 Controller 只看 `spec`，从不回写 `status.conditions`，SRE 排障会遇到什么问题？
3. 哪些校验适合放在 OpenAPI schema，哪些适合放在 CEL，哪些必须交给 validating admission webhook？

## 面试题

### 面试题 1：CRD 的 `served` 和 `storage` 有什么区别？

**一句话结论**：`served` 决定某个 API 版本是否对客户端可访问，`storage` 决定新写入对象以哪个版本存入后端存储。

**展开解释**：一个 CRD 可以同时 served 多个版本，但只能有一个 storage 版本。客户端可以请求任意 served 版本；API server 会根据 conversion 策略返回对应版本。修改 storage version 不会自动迁移已有对象。

**深入追问**：什么时候能删除旧版本？确认没有客户端依赖旧版本，并完成存储版本迁移，旧版本不再出现在 `status.storedVersions` 后，才能从 CRD 中移除。

### 面试题 2：OpenAPI schema 为什么对 Operator 很重要？

**一句话结论**：schema 把明显错误拦在 API server 写入阶段，减少 Controller 运行时分支和排障成本。

**展开解释**：类型、必填、枚举、正则、范围和默认值都可以在 schema 中表达。这样 GitOps 同步时就能发现错误，`kubectl explain` 也能生成字段文档。Controller 可以更专注于调谐合法输入。

**深入追问**：OpenAPI、CEL 和 webhook 怎么分工？类型、枚举、范围和简单字段结构优先放 OpenAPI；同一对象内的跨字段关系优先用 CEL；需要查其他资源、访问外部系统或做复杂业务判断时，再使用 validating admission webhook。

### 面试题 3：status subresource 解决了什么问题？

**一句话结论**：它把用户写 `spec` 和 Controller 写 `status` 的路径、权限和冲突边界分开。

**展开解释**：启用 status subresource 后，主资源的写入会忽略 status，Controller 必须通过 `/status` 更新状态。RBAC 可以单独授权 `todoapps/status`，避免普通用户伪造 Ready 状态。

**深入追问**：没有 status subresource 会怎样？Controller 和用户都更新同一个主对象，容易互相覆盖；权限也难以精细控制。

### 面试题 4：为什么 additional printer columns 是 API 设计的一部分？

**一句话结论**：因为 `kubectl get` 是 SRE 高频入口，列设计直接影响排障效率。

**展开解释**：好的 printer columns 会展示健康度、版本、规格、容量和关键端点。它们让人不用反复 `kubectl get -o yaml` 就能判断系统状态。列太多会降低可读性，列太少又缺乏运维价值。

**深入追问**：如果 Ready 列为空代表什么？可能是 Controller 尚未回写 status，也可能是 jsonPath 写错，或 condition 类型与列定义不一致。

### 面试题 5：CRD 版本升级时最容易犯什么错？

**一句话结论**：最容易把字段破坏性变更当成普通 YAML 修改，忽略已有 CR、GitOps 配置和 storage version。

**展开解释**：删除字段、改类型、收窄枚举、改变默认值都可能破坏已有用户。即使添加新版本，也要考虑 conversion、storedVersions、客户端兼容和回滚路径。

**深入追问**：如何安全废弃字段？先保留旧字段并标注 deprecated，在新字段可用后让 Controller 同时兼容两者，发布迁移文档，最后在新 API 版本中移除。
