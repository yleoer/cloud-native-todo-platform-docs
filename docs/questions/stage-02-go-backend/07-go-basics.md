# 第 7 篇：Go 语言基础：练习题与面试题

> 本页由 [第 7 篇：Go 语言基础](../../chapters/stage-02-go-backend/07-go-basics.md) 拆分而来，便于课程正文保持聚焦。

## 练习题

### 基础题

1. `package main` 和普通业务包有什么区别？
2. 为什么 `MemoryStore.Add` 使用指针接收者，而 `Item.Status` 可以使用值接收者？
3. 切片和 map 分别适合表达什么数据？本篇为什么两个都用到了？
4. `Repository` interface 的作用是什么？如果只有一个实现，为什么仍然可以保留这个边界？
5. 为什么本篇分开执行两次 `go run` 后数据不会保留？

### 实操题

1. 给 `todo-cli` 增加 `count` 命令，输出当前 Todo 总数。当 `go run ./cmd/todo-cli add "a" add "b" count` 输出 `2` 时，说明操作成功。
2. 给 `list` 输出增加完成数量统计，例如最后一行输出 `summary: 1 done, 2 pending`。当完成一个 Todo 后统计数字变化正确，说明操作成功。
3. 修改 `parseID`，让 ID 为 `0` 或负数时报错信息包含 `id must be positive`。当 `go run ./cmd/todo-cli done 0` 返回该错误时，说明操作成功。

### 思考题

1. 如果团队准备让 `todo-cli` 的数据跨进程保留，你会选择 JSON 文件、SQLite 还是 PostgreSQL？请说明你会如何权衡复杂度和可靠性。
2. 如果后续 HTTP API 和 CLI 都要复用 Todo 业务逻辑，你会把输入校验放在 `cmd/todo-cli`、HTTP Handler，还是 `internal/todo`？为什么？

## 面试题

### 1. Go 的 package、module 和 import path 是什么关系？

**一句话结论**：module 是项目级依赖边界，package 是代码组织单元，import path 是其他代码引用某个 package 的路径。

**展开解释**：`go.mod` 中的 `module cloud-native-todo-platform` 定义了当前项目根路径；`internal/todo` 是一个 package；在 `cmd/todo-cli/main.go` 中通过 `import "cloud-native-todo-platform/internal/todo"` 引入它。module path 和目录路径拼起来，形成包的 import path。理解这层关系后，遇到 `package ... is not in std` 这类错误时，就能回到 `go.mod` 和 import 路径检查。

**深入追问**：如果是公开 GitHub module，module path 通常会写成 `github.com/<org>/<repo>`。如果改 module path，所有内部 import 都要同步更新。企业私有仓库还要配合 `GOPRIVATE` 和私有代理。

### 2. Go 中什么时候使用指针接收者？

**一句话结论**：当方法需要修改原对象，或对象较大不希望复制时，使用指针接收者。

**展开解释**：本篇 `MemoryStore.Add`、`Done`、`Update`、`Delete` 都要修改 `items` 或 `nextID`，所以使用 `*MemoryStore`。而 `Item.Status()` 只读取字段，不修改对象，用值接收者更简单。指针接收者不是高级写法，也不是默认选择，它应该服务于语义。

**深入追问**：如果同一个类型既有指针接收者又有值接收者，要注意方法集。接口匹配时，`T` 和 `*T` 的方法集不同。真实项目里通常会保持同一类型的方法接收者风格一致，减少误解。

### 3. interface 应该定义在哪里？

**一句话结论**：interface 通常定义在调用方需要的能力边界上，而不是机械地为每个实现都提前定义接口。

**展开解释**：本篇 `Repository` 描述 CLI 和后续服务层需要的 Todo 存储能力：新增、列表、完成、修改、删除。现在实现是 `MemoryStore`，未来可以替换成文件或数据库。如果调用方只依赖 `Repository`，替换实现时改动就更小。但如果一个接口只有一个实现、也没有测试或替换需求，过早抽象会增加阅读成本。

**深入追问**：Go 的接口是隐式实现，不需要 `implements` 关键字。本篇的 `var _ Repository = (*MemoryStore)(nil)` 是编译期断言，用来确认 `MemoryStore` 满足接口，常见于重要边界。

### 4. Go 为什么显式返回 `error`，而不是默认使用异常？

**一句话结论**：Go 倾向把可预期失败作为普通返回值处理，让调用方明确决定如何恢复、包装或终止。

**展开解释**：CLI 中标题为空、ID 不存在、ID 不是数字，都是可预期失败。函数返回 `error` 后，入口层可以统一打印错误并返回非零退出码。`fmt.Errorf("%w")` 可以包装上下文，同时保留原始错误，便于 `errors.Is` 判断根因。

**深入追问**：Go 也有 `panic`，但它更适合不可恢复的程序错误，例如违反内部不变量。业务输入错误、网络失败、数据库超时都应该优先用 `error` 返回。

### 5. 内存存储、文件存储和数据库存储有什么差异？

**一句话结论**：内存存储最简单但进程退出即丢失；文件存储可持久化但并发和查询能力有限；数据库适合生产数据的一致性、查询和事务需求。

**展开解释**：本篇选择内存存储，是为了聚焦 Go 语言基础。文件存储会引入路径、权限、JSON 编解码、并发写入、文件锁和原子替换；数据库会引入连接池、事务、迁移和 SQL。学习顺序上，先用内存理解对象和行为，再逐步引入持久化复杂度，学习曲线更平滑。

**深入追问**：如果后续要把 `MemoryStore` 换成 PostgreSQL，只要新的实现满足 `Repository` 接口，上层 CLI 或服务层就可以尽量少改。这正是接口边界的价值。
