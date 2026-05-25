# 第 2 篇 Golang 语言基础：Go 命令行任务管理器

## 1. 本章学习目标

学完本篇后，你应该具备继续学习 Go Web API、Docker 容器化、Kubernetes Operator 开发所需的 Go 语言基础。

具体目标包括：

- 理解 Go 的语言特点：简洁、静态类型、编译型、内置并发、标准库强大。
- 能在 Ubuntu 上安装 Go，并配置 `PATH`。
- 理解 Go Modules、`package`、`import` 和模块路径。
- 掌握变量、常量、基础类型、函数、指针、结构体、方法、接口。
- 掌握 Go 的错误处理方式：`error`、`defer`、`panic`、`recover`。
- 熟练使用 `slice`、`map` 表达列表和键值数据。
- 初步掌握 `goroutine`、`channel`、`context`。
- 能使用标准库完成 JSON 编解码、文件读写、HTTP 客户端请求、日志输出、配置读取。
- 能使用 `go test` 编写并运行单元测试。
- 完成特色项目 **《Go 命令行任务管理器》**。

## 2. 本章工作场景

Go 在云原生领域非常常见。Docker、Kubernetes、containerd、Prometheus、Helm、Terraform、etcd、Kubebuilder、controller-runtime 等大量基础设施项目都使用 Go 编写。

真实工作中，Go 语言基础常用于：

- 编写后端 HTTP API 服务。
- 编写运维自动化 CLI 工具。
- 编写 Kubernetes Controller 和 Operator。
- 编写 CI/CD 辅助工具，例如镜像检查、配置生成、发布脚本。
- 编写日志采集、指标采集、任务调度、数据同步类服务。

本篇会先写一个命令行 Todo 工具。它虽然不是 Web 服务，但会用到后续开发中的核心能力：

- 数据建模：`struct`。
- 行为封装：`method`。
- 抽象依赖：`interface`。
- 错误处理：`error`。
- 数据持久化：JSON 文件读写。
- 并发基础：`goroutine`、`channel`、`context`。
- 工程质量：`go test`、`Makefile`。

后续章节会把这个 CLI 项目的任务模型演进为 Web API、数据库表、Docker 镜像、Kubernetes 应用和 Operator 管理对象。

## 3. 前置知识

学习本篇前建议已经完成第一篇：

- 能使用 Ubuntu 终端。
- 能使用 `cd`、`ls`、`mkdir`、`vim`、`chmod`。
- 能理解 `PATH` 环境变量。
- 能使用 Git 初始化仓库、提交代码、创建分支。
- 能运行 `make check`。

本篇默认项目根目录为：

```text
~/cloud-native-todo-platform
```

如果你的目录不同，请把命令中的路径替换成自己的项目路径。

## 4. 核心概念

### 4.1 Go 语言特点

Go 的设计目标是让工程团队更容易构建可靠的软件系统。

常见特点：

| 特点 | 说明 | 工作价值 |
|---|---|---|
| 静态类型 | 编译时检查类型错误 | 提前发现很多低级错误 |
| 编译型 | 编译成二进制文件运行 | 部署简单，适合容器化 |
| 语法简洁 | 关键字少，风格统一 | 团队协作成本低 |
| 标准库强大 | HTTP、JSON、测试、日志都内置 | 少依赖第三方库 |
| 内置并发 | `goroutine`、`channel` | 适合网络服务和控制器 |
| 工具链统一 | `go test`、`go fmt`、`go mod` | 工程化体验稳定 |

### 4.2 Go 安装与 PATH

安装 Go 后，系统需要能找到 `go` 命令。

检查：

```bash
go version
which go
```

如果提示 `go: command not found`，通常是 Go 没安装，或者 Go 的 `bin` 目录没有加入 `PATH`。

### 4.3 Go Modules

Go Modules 是 Go 的依赖管理机制。一个模块通常对应一个项目。

初始化模块：

```bash
go mod init github.com/yuanxuefeng/cloud-native-todo-platform/cli/todo-cli
```

生成文件：

```text
go.mod
```

`go.mod` 记录模块名、Go 版本和依赖。后续项目变复杂后，Go 会通过它管理第三方库。

### 4.4 package 与 import

Go 文件必须属于某个 `package`。

```go
package main
```

`main` 包表示这个程序可以编译成可执行文件。其他包通常用于组织业务代码。

引入标准库：

```go
import (
    "fmt"
    "time"
)
```

引入自己项目里的包：

```go
import "github.com/yuanxuefeng/cloud-native-todo-platform/cli/todo-cli/internal/todo"
```

本章会使用 `internal/todo` 目录。Go 对 `internal` 有特殊规则：只有 `internal` 父目录及其子目录中的代码可以导入它。也就是说，本项目里的 `cmd/todo` 可以导入 `internal/todo`，但项目外部代码不能直接导入。这个机制常用于保护内部实现，避免外部依赖还不稳定的包。

### 4.5 变量、常量与基础类型

变量可以改变：

```go
var name string = "todo"
count := 10
```

常量不能改变：

```go
const DefaultPriority = "normal"
```

常见基础类型：

| 类型 | 示例 | 用途 |
|---|---|---|
| `string` | `"learn go"` | 文本 |
| `int` | `100` | 整数 |
| `bool` | `true` | 判断 |
| `time.Time` | `time.Now()` | 时间 |

### 4.6 函数与指针

函数把一段逻辑封装成可复用单元：

```go
func nextID(tasks []Task) int {
    maxID := 0
    for _, task := range tasks {
        if task.ID > maxID {
            maxID = task.ID
        }
    }
    return maxID + 1
}
```

指针保存变量地址。需要修改原对象时经常使用指针：

```go
func (t *Task) Complete(now time.Time) {
    t.Status = StatusDone
    t.CompletedAt = &now
}
```

### 4.7 struct、method 与 interface

`struct` 用来描述数据结构：

```go
type Task struct {
    ID    int
    Title string
}
```

`method` 是绑定到某个类型上的函数：

```go
func (t Task) IsDone() bool {
    return t.Status == StatusDone
}
```

`interface` 描述行为，不关心具体实现：

```go
type Store interface {
    Load(ctx context.Context) ([]Task, error)
    Save(ctx context.Context, tasks []Task) error
}
```

后续 Operator 开发中，很多代码都会依赖接口抽象，例如 Kubernetes Client、Recorder、Scheme、Cache。

### 4.8 error、defer、panic、recover

Go 推荐显式返回错误：

```go
if err != nil {
    return err
}
```

`defer` 用于延迟执行清理动作：

```go
file, err := os.Open(path)
if err != nil {
    return err
}
defer file.Close()
```

`panic` 表示程序遇到无法继续的异常情况。业务代码不应该滥用 `panic`。`recover` 可以捕获 panic，常用于程序最外层兜底，避免输出难懂的崩溃信息。

### 4.9 slice 与 map

`slice` 表示可变长度列表：

```go
tasks := []Task{}
tasks = append(tasks, task)
```

`map` 表示键值映射：

```go
byStatus := map[Status]int{
    StatusPending: 0,
    StatusDone:    0,
}
```

### 4.10 goroutine、channel 与 context

`goroutine` 是 Go 的轻量级并发执行单元：

```go
go func() {
    // 并发执行
}()
```

`channel` 用于 goroutine 之间传递数据：

```go
resultCh := make(chan Stats, 1)
```

`context` 用于传递取消、超时和请求范围信息：

```go
ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
defer cancel()
```

后续 Web API 和 Kubernetes Controller 中，`context.Context` 会贯穿请求处理、数据库访问、Kubernetes API 调用。

### 4.11 JSON、文件、HTTP、日志与配置

Go 标准库已经内置大量工程能力：

| 能力 | 标准库 | 本章用法 |
|---|---|---|
| JSON | `encoding/json` | 保存 Todo 数据 |
| 文件读写 | `os` | 读写 JSON 文件 |
| HTTP 客户端 | `net/http` | 检查外部 URL |
| 日志 | `log/slog` | 输出结构化日志 |
| 配置 | `os.Getenv` | 从环境变量读取数据文件路径 |
| 测试 | `testing` | 编写单元测试 |

## 5. 原理深入

### 5.1 Go 程序从源码到运行

Go 程序运行流程：

```text
.go 源码
  -> go fmt 格式化
  -> go test 测试
  -> go build 编译
  -> 生成二进制文件
  -> 在 Linux / 容器 / Kubernetes 中运行
```

和脚本语言不同，Go 通常会编译成单个二进制文件，这也是它适合容器化和 Kubernetes 工具开发的重要原因。

### 5.2 Go Modules 如何解析依赖

当你执行：

```bash
go test ./...
```

Go 会：

1. 从当前目录向上查找 `go.mod`。
2. 确定当前模块路径。
3. 解析源码中的 `import`。
4. 编译当前包和依赖包。
5. 执行测试函数。

本章项目只使用标准库，所以不会下载第三方依赖。后续 Web API 会引入路由框架、数据库驱动、Redis 客户端等依赖。

### 5.3 值、指针与方法接收者

Go 调用函数时默认是值传递。结构体作为参数传入函数时，会复制一份值。

如果方法需要修改原对象，就使用指针接收者：

```go
func (t *Task) Complete(now time.Time)
```

如果方法只是读取对象，可以使用值接收者：

```go
func (t Task) IsDone() bool
```

真实项目中，服务对象、存储对象通常使用指针接收者，因为它们可能持有配置、连接、缓存或状态。

### 5.4 接口与依赖倒置

本章项目中，业务层依赖的是：

```go
type Store interface {
    Load(ctx context.Context) ([]Task, error)
    Save(ctx context.Context, tasks []Task) error
}
```

业务层不关心数据到底存到 JSON 文件、数据库，还是远程 API。后续把 JSON 文件替换为 PostgreSQL 时，只要实现同样的方法，业务层可以尽量少改。

这就是接口的价值：让高层业务逻辑不直接绑定底层实现。

### 5.5 错误处理与可维护性

Go 中错误是普通值：

```go
task, err := service.Complete(ctx, id)
if err != nil {
    return err
}
```

本章会定义：

```go
var ErrTaskNotFound = errors.New("task not found")
```

调用方可以使用：

```go
errors.Is(err, ErrTaskNotFound)
```

这样比只比较错误字符串更可靠。

### 5.6 并发不是越多越好

Go 让并发很容易，但生产环境中不能“为了并发而并发”。

本章用 `goroutine + channel + context` 实现统计任务状态，目的是让你理解基本模型。真实项目中，并发通常用于：

- 同时调用多个外部 API。
- 后台异步处理任务。
- 控制器同时处理多个 Kubernetes 资源事件。
- HTTP 服务同时处理大量请求。

并发代码一定要考虑超时、取消、错误返回和资源释放。

## 6. 手把手实验

### 6.1 实验目标

完成特色项目 **《Go 命令行任务管理器》**。

功能要求：

- 使用 Go 编写 CLI Todo 工具。
- 支持新增任务。
- 支持查看任务。
- 支持完成任务。
- 支持删除任务。
- 使用 JSON 文件持久化。
- 使用 `go test` 编写测试。
- 使用 `Makefile` 管理构建、测试和运行。

额外覆盖：

- 使用 `context` 控制命令执行。
- 使用 `goroutine` 和 `channel` 统计任务状态。
- 使用 `net/http` 编写 HTTP 客户端示例。
- 使用 `log/slog` 输出日志。
- 使用环境变量读取配置。

### 6.2 实验环境

推荐环境：

```text
操作系统：Ubuntu 22.04 或 Ubuntu 24.04
工作目录：~/cloud-native-todo-platform
Go：建议使用当前稳定版本
Shell：bash
```

检查当前目录：

```bash
cd ~/cloud-native-todo-platform
pwd
```

预期输出：

```text
/home/cnstudent/cloud-native-todo-platform
```

### 6.3 安装 Go

方式一：使用 Ubuntu 软件源，适合快速学习：

```bash
sudo apt update
sudo apt install -y golang-go
go version
```

本章代码使用了 `log/slog` 标准库，要求 Go 1.21 或更高版本。如果 `go version` 显示的版本低于 1.21，建议使用 Go 官方下载页提供的当前稳定版本。下面命令中的 `GO_VERSION` 需要替换为你在官方页面看到的版本号：

```bash
go version
```

合格示例：

```text
go version go1.22.5 linux/amd64
```

如果版本低于 `go1.21`，请先升级再继续。否则后面使用 `log/slog` 的代码会编译失败。

```bash
GO_VERSION=1.xx.x
curl -LO "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf "go${GO_VERSION}.linux-amd64.tar.gz"
echo 'export PATH=/usr/local/go/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
go version
```

为什么要配置 `PATH`：

- `go` 命令实际位于 `/usr/local/go/bin/go`。
- 加入 `PATH` 后，可以在任意目录直接执行 `go`。

### 6.4 文件目录结构

创建项目目录：

```bash
mkdir -p cli/todo-cli/{cmd/todo,internal/todo}
cd cli/todo-cli
```

最终目录结构：

```text
cli/todo-cli/
├── Makefile
├── go.mod
├── cmd/
│   └── todo/
│       └── main.go
└── internal/
    └── todo/
        ├── config.go
        ├── httpcheck.go
        ├── service.go
        ├── store.go
        ├── store_test.go
        └── task.go
```

### 6.5 初始化 Go Module

执行：

```bash
go mod init github.com/yuanxuefeng/cloud-native-todo-platform/cli/todo-cli
```

生成的 `go.mod` 内容类似：

```go
module github.com/yuanxuefeng/cloud-native-todo-platform/cli/todo-cli

go 1.22
```

`go` 后面的版本可能和你的本地工具链不同，这是正常的。

### 6.6 编写任务模型

创建文件：

```bash
vim internal/todo/task.go
```

完整代码：

```go
package todo

import "time"

type Status string

const (
	StatusPending Status = "pending"
	StatusDone    Status = "done"
)

const DefaultPriority = "normal"

type Task struct {
	ID          int        `json:"id"`
	Title       string     `json:"title"`
	Status      Status     `json:"status"`
	Priority    string     `json:"priority"`
	CreatedAt   time.Time  `json:"created_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

func (t Task) IsDone() bool {
	return t.Status == StatusDone
}

func (t *Task) Complete(now time.Time) {
	t.Status = StatusDone
	t.CompletedAt = &now
}
```

关键点：

- `Task` 是结构体，用来描述任务。
- JSON tag 让字段保存为 `id`、`title` 这类 JSON 字段名。
- `IsDone` 是值接收者，因为只读取数据。
- `Complete` 是指针接收者，因为要修改任务状态。

### 6.7 编写配置读取

创建文件：

```bash
vim internal/todo/config.go
```

完整代码：

```go
package todo

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	DataFile string
	LogLevel slog.Level
}

func LoadConfig() (Config, error) {
	dataFile := os.Getenv("TODO_DATA_FILE")
	if dataFile == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return Config{}, fmt.Errorf("get user home dir: %w", err)
		}
		dataFile = filepath.Join(home, ".cloud-native-todo", "tasks.json")
	}

	logLevel, err := parseLogLevel(os.Getenv("TODO_LOG_LEVEL"))
	if err != nil {
		return Config{}, err
	}

	return Config{
		DataFile: dataFile,
		LogLevel: logLevel,
	}, nil
}

func parseLogLevel(value string) (slog.Level, error) {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "", "info":
		return slog.LevelInfo, nil
	case "debug":
		return slog.LevelDebug, nil
	case "warn", "warning":
		return slog.LevelWarn, nil
	case "error":
		return slog.LevelError, nil
	default:
		return slog.LevelInfo, fmt.Errorf("unsupported TODO_LOG_LEVEL %q, expected debug, info, warn or error", value)
	}
}
```

关键点：

- `TODO_DATA_FILE` 可以覆盖默认数据文件路径。
- 默认数据文件放在用户主目录，避免写入系统目录。
- `TODO_LOG_LEVEL` 支持 `debug`、`info`、`warn`、`error`，并会真正控制 `slog` 输出级别。
- `fmt.Errorf("...: %w", err)` 用于包装错误，方便上层追踪原因。

### 6.8 编写 JSON 文件存储

创建文件：

```bash
vim internal/todo/store.go
```

完整代码：

```go
package todo

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

var ErrTaskNotFound = errors.New("task not found")

type Store interface {
	Load(ctx context.Context) ([]Task, error)
	Save(ctx context.Context, tasks []Task) error
}

type FileStore struct {
	path string
}

type taskFile struct {
	Tasks []Task `json:"tasks"`
}

func NewFileStore(path string) *FileStore {
	return &FileStore{path: path}
}

func (s *FileStore) Load(ctx context.Context) ([]Task, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	file, err := os.Open(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return []Task{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("open task file: %w", err)
	}
	defer file.Close()

	var data taskFile
	if err := json.NewDecoder(file).Decode(&data); err != nil {
		return nil, fmt.Errorf("decode task file: %w", err)
	}
	if data.Tasks == nil {
		return []Task{}, nil
	}

	return data.Tasks, nil
}

func (s *FileStore) Save(ctx context.Context, tasks []Task) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(s.path), 0o755); err != nil {
		return fmt.Errorf("create task data dir: %w", err)
	}

	data := taskFile{Tasks: tasks}
	payload, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("encode task file: %w", err)
	}

	if err := os.WriteFile(s.path, payload, 0o600); err != nil {
		return fmt.Errorf("write task file: %w", err)
	}

	return nil
}
```

关键点：

- `Store` 是接口，业务层只依赖接口。
- `FileStore` 是 JSON 文件实现。
- `Load` 中使用 `defer file.Close()` 确保文件关闭。
- `Save` 使用 `json.MarshalIndent` 生成便于阅读的 JSON。
- 数据文件权限使用 `0600`，避免其他用户读取你的本地数据。

!!! warning "教学版文件写入的边界"

    当前 `Save` 直接使用 `os.WriteFile` 写入 JSON 文件，适合学习项目。真实生产工具更推荐“写临时文件 -> fsync -> rename 覆盖”的原子写入方式，避免程序中断时把 JSON 文件写坏。后续进入数据库章节后，我们会把本地 JSON 文件替换为 PostgreSQL。

### 6.9 编写业务服务

创建文件：

```bash
vim internal/todo/service.go
```

完整代码：

```go
package todo

import (
	"context"
	"fmt"
	"strings"
	"time"
)

type Service struct {
	store Store
}

type Stats struct {
	Total    int            `json:"total"`
	ByStatus map[Status]int `json:"by_status"`
}

func NewService(store Store) *Service {
	return &Service{store: store}
}

func (s *Service) Add(ctx context.Context, title string, priority string) (Task, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return Task{}, fmt.Errorf("task title cannot be empty")
	}

	if priority == "" {
		priority = DefaultPriority
	}

	tasks, err := s.store.Load(ctx)
	if err != nil {
		return Task{}, err
	}

	task := Task{
		ID:        nextID(tasks),
		Title:     title,
		Status:    StatusPending,
		Priority:  priority,
		CreatedAt: time.Now(),
	}

	tasks = append(tasks, task)
	if err := s.store.Save(ctx, tasks); err != nil {
		return Task{}, err
	}

	return task, nil
}

func (s *Service) List(ctx context.Context) ([]Task, error) {
	return s.store.Load(ctx)
}

func (s *Service) Complete(ctx context.Context, id int) (Task, error) {
	tasks, err := s.store.Load(ctx)
	if err != nil {
		return Task{}, err
	}

	for i := range tasks {
		if tasks[i].ID == id {
			tasks[i].Complete(time.Now())
			if err := s.store.Save(ctx, tasks); err != nil {
				return Task{}, err
			}
			return tasks[i], nil
		}
	}

	return Task{}, ErrTaskNotFound
}

func (s *Service) Delete(ctx context.Context, id int) error {
	tasks, err := s.store.Load(ctx)
	if err != nil {
		return err
	}

	next := make([]Task, 0, len(tasks))
	found := false
	for _, task := range tasks {
		if task.ID == id {
			found = true
			continue
		}
		next = append(next, task)
	}

	if !found {
		return ErrTaskNotFound
	}

	return s.store.Save(ctx, next)
}

func (s *Service) Stats(ctx context.Context) (Stats, error) {
	tasks, err := s.store.Load(ctx)
	if err != nil {
		return Stats{}, err
	}

	resultCh := make(chan Stats, 1)

	go func() {
		stats := Stats{
			Total: len(tasks),
			ByStatus: map[Status]int{
				StatusPending: 0,
				StatusDone:    0,
			},
		}
		for _, task := range tasks {
			stats.ByStatus[task.Status]++
		}
		resultCh <- stats
	}()

	select {
	case <-ctx.Done():
		return Stats{}, ctx.Err()
	case stats := <-resultCh:
		return stats, nil
	}
}

func nextID(tasks []Task) int {
	maxID := 0
	for _, task := range tasks {
		if task.ID > maxID {
			maxID = task.ID
		}
	}
	return maxID + 1
}
```

关键点：

- `Service` 用来承载业务逻辑。
- `Add`、`Complete`、`Delete` 都先读文件，再保存变更。
- `Delete` 使用新的 slice 保存未删除任务。
- `Stats` 使用 goroutine 和 channel 演示并发结果回传。
- `context` 用于取消统计逻辑或上游请求。

### 6.10 编写 HTTP 客户端示例

创建文件：

```bash
vim internal/todo/httpcheck.go
```

完整代码：

```go
package todo

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

func CheckURL(ctx context.Context, url string) (int, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, fmt.Errorf("create request: %w", err)
	}

	client := http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	return resp.StatusCode, nil
}
```

这个函数不是 Todo 核心功能，但它展示了 Go 后端和 Operator 中非常常见的模式：

- 用 `context` 控制请求生命周期。
- 用 `http.Client` 发请求。
- 用 `defer resp.Body.Close()` 释放资源。
- 用 `error` 返回失败原因。

### 6.11 编写 CLI 入口

创建文件：

```bash
vim cmd/todo/main.go
```

完整代码：

```go
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/yuanxuefeng/cloud-native-todo-platform/cli/todo-cli/internal/todo"
)

func main() {
	cfg, err := todo.LoadConfig()
	logger := newLogger(slog.LevelInfo)
	if err != nil {
		logger.Error("load config failed", "error", err)
		os.Exit(1)
	}

	logger = newLogger(cfg.LogLevel)

	if err := safeRun(context.Background(), os.Args[1:], cfg, logger); err != nil {
		logger.Error("command failed", "error", err)
		os.Exit(1)
	}
}

func newLogger(level slog.Level) *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: level,
	}))
}

func safeRun(ctx context.Context, args []string, cfg todo.Config, logger *slog.Logger) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("panic recovered: %v", r)
		}
	}()

	return run(ctx, args, cfg, logger)
}

func run(ctx context.Context, args []string, cfg todo.Config, logger *slog.Logger) error {
	store := todo.NewFileStore(cfg.DataFile)
	service := todo.NewService(store)

	if len(args) == 0 {
		printUsage()
		return nil
	}

	logger.Info("start command", "command", args[0], "data_file", cfg.DataFile)

	switch args[0] {
	case "add":
		return runAdd(ctx, args[1:], service)
	case "list":
		return runList(ctx, service)
	case "done":
		return runDone(ctx, args[1:], service)
	case "delete":
		return runDelete(ctx, args[1:], service)
	case "stats":
		return runStats(ctx, service)
	case "check-http":
		return runCheckHTTP(ctx, args[1:])
	case "panic-demo":
		panic("this panic is used to demonstrate recover")
	case "help", "-h", "--help":
		printUsage()
		return nil
	default:
		return fmt.Errorf("unknown command: %s", args[0])
	}
}

func runAdd(ctx context.Context, args []string, service *todo.Service) error {
	fs := flag.NewFlagSet("add", flag.ContinueOnError)
	priority := fs.String("priority", todo.DefaultPriority, "task priority")
	if err := fs.Parse(args); err != nil {
		return err
	}

	title := strings.Join(fs.Args(), " ")
	task, err := service.Add(ctx, title, *priority)
	if err != nil {
		return err
	}

	fmt.Printf("created task #%d: %s\n", task.ID, task.Title)
	return nil
}

func runList(ctx context.Context, service *todo.Service) error {
	tasks, err := service.List(ctx)
	if err != nil {
		return err
	}

	if len(tasks) == 0 {
		fmt.Println("no tasks")
		return nil
	}

	for _, task := range tasks {
		done := " "
		if task.IsDone() {
			done = "x"
		}
		fmt.Printf("[%s] #%d %s priority=%s status=%s\n", done, task.ID, task.Title, task.Priority, task.Status)
	}
	return nil
}

func runDone(ctx context.Context, args []string, service *todo.Service) error {
	id, err := parseID(args)
	if err != nil {
		return err
	}

	task, err := service.Complete(ctx, id)
	if errors.Is(err, todo.ErrTaskNotFound) {
		return fmt.Errorf("task #%d not found", id)
	}
	if err != nil {
		return err
	}

	fmt.Printf("completed task #%d: %s\n", task.ID, task.Title)
	return nil
}

func runDelete(ctx context.Context, args []string, service *todo.Service) error {
	id, err := parseID(args)
	if err != nil {
		return err
	}

	if err := service.Delete(ctx, id); errors.Is(err, todo.ErrTaskNotFound) {
		return fmt.Errorf("task #%d not found", id)
	} else if err != nil {
		return err
	}

	fmt.Printf("deleted task #%d\n", id)
	return nil
}

func runStats(ctx context.Context, service *todo.Service) error {
	ctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	stats, err := service.Stats(ctx)
	if err != nil {
		return err
	}

	fmt.Printf("total=%d pending=%d done=%d\n", stats.Total, stats.ByStatus[todo.StatusPending], stats.ByStatus[todo.StatusDone])
	return nil
}

func runCheckHTTP(ctx context.Context, args []string) error {
	fs := flag.NewFlagSet("check-http", flag.ContinueOnError)
	url := fs.String("url", "https://example.com", "url to check")
	if err := fs.Parse(args); err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	statusCode, err := todo.CheckURL(ctx, *url)
	if err != nil {
		return err
	}

	fmt.Printf("url=%s status=%d\n", *url, statusCode)
	return nil
}

func parseID(args []string) (int, error) {
	if len(args) != 1 {
		return 0, fmt.Errorf("expected task id")
	}

	id, err := strconv.Atoi(args[0])
	if err != nil {
		return 0, fmt.Errorf("invalid task id %q: %w", args[0], err)
	}
	if id <= 0 {
		return 0, fmt.Errorf("task id must be positive")
	}

	return id, nil
}

func printUsage() {
	fmt.Println(`Cloud Native Todo CLI

Usage:
  todo add [--priority normal|high] <title>
  todo list
  todo done <id>
  todo delete <id>
  todo stats
  todo check-http --url https://example.com

Environment:
  TODO_DATA_FILE   path to JSON data file
  TODO_LOG_LEVEL   debug, info, warn or error; default info`)
}
```

关键点：

- `main` 负责读取配置、组装日志和处理退出码。
- `newLogger` 使用 `TODO_LOG_LEVEL` 控制 `slog` 输出级别。
- `safeRun` 用 `recover` 把 panic 转为普通错误。
- `logger.Info` 记录命令名和数据文件路径，让日志配置有真实用途。
- 每个子命令拆成独立函数，便于维护。
- `flag` 用于解析命令行参数。
- `slog` 用于输出结构化日志。

### 6.12 编写单元测试

创建文件：

```bash
vim internal/todo/store_test.go
```

完整代码：

```go
package todo

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
)

func TestServiceAddCompleteDelete(t *testing.T) {
	ctx := context.Background()
	dataFile := filepath.Join(t.TempDir(), "tasks.json")
	store := NewFileStore(dataFile)
	service := NewService(store)

	task, err := service.Add(ctx, "learn go", "high")
	if err != nil {
		t.Fatalf("add task: %v", err)
	}
	if task.ID != 1 {
		t.Fatalf("expected id 1, got %d", task.ID)
	}
	if task.Status != StatusPending {
		t.Fatalf("expected pending status, got %s", task.Status)
	}

	tasks, err := service.List(ctx)
	if err != nil {
		t.Fatalf("list tasks: %v", err)
	}
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}

	doneTask, err := service.Complete(ctx, task.ID)
	if err != nil {
		t.Fatalf("complete task: %v", err)
	}
	if !doneTask.IsDone() {
		t.Fatalf("expected task done")
	}

	stats, err := service.Stats(ctx)
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if stats.Total != 1 || stats.ByStatus[StatusDone] != 1 {
		t.Fatalf("unexpected stats: %+v", stats)
	}

	if err := service.Delete(ctx, task.ID); err != nil {
		t.Fatalf("delete task: %v", err)
	}

	tasks, err = service.List(ctx)
	if err != nil {
		t.Fatalf("list tasks after delete: %v", err)
	}
	if len(tasks) != 0 {
		t.Fatalf("expected 0 tasks, got %d", len(tasks))
	}
}

func TestCompleteMissingTask(t *testing.T) {
	ctx := context.Background()
	store := NewFileStore(filepath.Join(t.TempDir(), "tasks.json"))
	service := NewService(store)

	_, err := service.Complete(ctx, 404)
	if !errors.Is(err, ErrTaskNotFound) {
		t.Fatalf("expected ErrTaskNotFound, got %v", err)
	}
}

func TestStatsContextCanceled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	store := NewFileStore(filepath.Join(t.TempDir(), "tasks.json"))
	service := NewService(store)

	_, err := service.Stats(ctx)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestLoadConfig(t *testing.T) {
	dataFile := filepath.Join(t.TempDir(), "tasks.json")
	t.Setenv("TODO_DATA_FILE", dataFile)
	t.Setenv("TODO_LOG_LEVEL", "debug")

	cfg, err := LoadConfig()
	if err != nil {
		t.Fatalf("load config: %v", err)
	}
	if cfg.DataFile != dataFile {
		t.Fatalf("expected data file %s, got %s", dataFile, cfg.DataFile)
	}
	if cfg.LogLevel != slog.LevelDebug {
		t.Fatalf("expected debug log level, got %v", cfg.LogLevel)
	}
}

func TestLoadConfigInvalidLogLevel(t *testing.T) {
	t.Setenv("TODO_DATA_FILE", filepath.Join(t.TempDir(), "tasks.json"))
	t.Setenv("TODO_LOG_LEVEL", "trace")

	_, err := LoadConfig()
	if err == nil {
		t.Fatalf("expected error")
	}
}

func TestCheckURL(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusAccepted)
	}))
	defer server.Close()

	statusCode, err := CheckURL(context.Background(), server.URL)
	if err != nil {
		t.Fatalf("check url: %v", err)
	}
	if statusCode != http.StatusAccepted {
		t.Fatalf("expected status %d, got %d", http.StatusAccepted, statusCode)
	}
}
```

关键点：

- `t.TempDir()` 为每个测试创建临时目录，测试结束自动清理。
- `t.Setenv()` 为测试设置环境变量，测试结束会自动恢复。
- `httptest.NewServer` 创建本地 HTTP 服务，不依赖公网。
- 测试覆盖新增、查看、完成、统计、删除、context 取消、配置读取和 HTTP 客户端。

### 6.13 编写 Makefile

创建文件：

```bash
vim Makefile
```

完整内容：

```makefile
.PHONY: fmt test build run clean

APP_NAME := todo

fmt:
	go fmt ./...

test:
	go test ./...

build:
	mkdir -p bin
	go build -o bin/$(APP_NAME) ./cmd/todo

run:
	go run ./cmd/todo

clean:
	rm -rf bin
```

注意：`Makefile` 中命令前面必须是 Tab，不是空格。

更新项目根目录 `.gitignore`，避免提交构建产物和测试缓存：

```bash
cd ~/cloud-native-todo-platform
cat >> .gitignore <<'EOF'

# Go build and test artifacts
cli/todo-cli/bin/
*.test
coverage.out
EOF
cd cli/todo-cli
```

为什么要这样做：

- `bin/todo` 是本地构建产物，不应该提交到 Git。
- `coverage.out` 是测试覆盖率输出，也属于本地生成文件。
- Git 仓库应保存源码和配置，而不是保存每个人机器上生成的二进制文件。

### 6.14 格式化、测试、构建

格式化：

```bash
make fmt
```

运行测试：

```bash
make test
```

预期输出类似：

```text
ok  	github.com/yuanxuefeng/cloud-native-todo-platform/cli/todo-cli/internal/todo	0.005s
```

构建：

```bash
make build
```

查看二进制文件：

```bash
ls -lh bin/todo
```

运行帮助：

```bash
./bin/todo help
```

### 6.15 功能验证

为了避免污染默认数据文件，本实验使用临时数据文件：

```bash
export TODO_DATA_FILE=/tmp/cloud-native-todo-tasks.json
rm -f "$TODO_DATA_FILE"
```

新增任务：

```bash
./bin/todo add --priority high "learn go basics"
```

预期输出：

```text
created task #1: learn go basics
```

查看任务：

```bash
./bin/todo list
```

预期输出：

```text
[ ] #1 learn go basics priority=high status=pending
```

完成任务：

```bash
./bin/todo done 1
```

预期输出：

```text
completed task #1: learn go basics
```

查看统计：

```bash
./bin/todo stats
```

预期输出：

```text
total=1 pending=0 done=1
```

查看 JSON 文件：

```bash
cat "$TODO_DATA_FILE"
```

预期能看到：

```json
{
  "tasks": [
    {
      "id": 1,
      "title": "learn go basics",
      "status": "done",
      "priority": "high",
      "created_at": "2026-05-25T10:00:00Z",
      "completed_at": "2026-05-25T10:01:00Z"
    }
  ]
}
```

时间会以你的实际执行时间为准。

删除任务：

```bash
./bin/todo delete 1
```

预期输出：

```text
deleted task #1
```

HTTP 客户端验证：

```bash
./bin/todo check-http --url https://example.com
```

预期输出类似：

```text
url=https://example.com status=200
```

panic / recover 验证：

!!! warning "panic-demo 只用于理解 recover"

    `panic-demo` 是教学命令，用来观察 `panic` 如何被 `recover` 捕获。真实业务错误应返回 `error`，不要用 `panic` 表示“任务不存在”“参数错误”这类可预期问题。

```bash
./bin/todo panic-demo
```

预期输出中会包含：

```text
panic recovered
```

### 6.16 验证方法

最终执行：

```bash
go version
go env GOPATH
go env GOMOD
make fmt
make test
make build
TODO_DATA_FILE=/tmp/cloud-native-todo-tasks.json ./bin/todo add "verify cli"
TODO_DATA_FILE=/tmp/cloud-native-todo-tasks.json ./bin/todo list
```

合格标准：

- `go version` 能正常输出版本。
- `go env GOMOD` 指向当前项目的 `go.mod`。
- `make test` 全部通过。
- `make build` 能生成 `bin/todo`。
- CLI 能新增、查看、完成、删除任务。
- JSON 文件能保存任务数据。

### 6.17 清理步骤

清理构建产物：

```bash
make clean
```

清理实验数据：

```bash
rm -f /tmp/cloud-native-todo-tasks.json
```

如果你使用官方 tarball 下载了安装包，也可以清理：

```bash
rm -f go*.linux-amd64.tar.gz
```

不要删除 `cli/todo-cli`，后续课程会继续复用这个项目。

## 7. 真实工作案例

假设公司内部有一个 Kubernetes 平台团队，需要开发一个小工具，用于在 CI/CD 流水线里检查发布任务状态。

这个工具通常会包含：

- CLI 参数解析。
- 从环境变量读取配置。
- 通过 HTTP 调用平台 API。
- 把结果以 JSON 保存或输出。
- 在异常时返回非 0 退出码。
- 使用单元测试保证基础行为稳定。
- 使用 Makefile 统一构建和测试。

本章 Todo CLI 的结构已经接近这种真实工具：

- `cmd/todo/main.go` 是程序入口。
- `internal/todo` 是业务包。
- `Store` 接口隔离数据存储。
- JSON 文件可以替换为数据库。
- `CheckURL` 可以扩展为调用真实平台 API。
- `go test ./...` 可以进入 CI/CD 流水线。

后续写 Operator 时，你也会看到类似结构：

```text
cmd/
internal/
api/
controllers/
```

所以本章不是孤立语法练习，而是在为后续云原生工程结构打底。

## 8. 常见错误

| 错误现象 | 常见原因 | 修复方式 |
|---|---|---|
| `go: command not found` | Go 未安装或 PATH 未配置 | 安装 Go，检查 `echo $PATH` |
| `undefined: slog` 或 `package log/slog is not in std` | Go 版本低于 1.21 | 升级 Go 后重新构建 |
| `go: cannot find main module` | 当前目录没有 `go.mod` | 进入项目目录或执行 `go mod init` |
| `package xxx is not in std` | import 路径写错 | 检查模块路径和包路径 |
| `use of internal package ... not allowed` | 从 `internal` 目录允许范围之外导入包 | 调整目录结构或导入位置 |
| `undefined: xxx` | 函数、类型或变量名写错，或没有导出 | 检查拼写和大小写 |
| `imported and not used` | 引入了未使用的包 | 删除未使用 import |
| `declared and not used` | 声明变量但未使用 | 使用变量或删除变量 |
| JSON 文件解析失败 | 文件内容不是合法 JSON | 删除错误文件或修复 JSON 格式 |
| `permission denied` | 数据文件目录无写权限 | 修改数据文件路径或修复权限 |
| `make: *** missing separator` | Makefile 命令前用了空格 | 改成 Tab |
| 测试污染真实数据 | 测试用了用户主目录数据文件 | 使用 `t.TempDir()` |
| `unsupported TODO_LOG_LEVEL` | 环境变量值不在允许范围内 | 使用 `debug`、`info`、`warn`、`error` |

## 9. 排障方法

### 9.1 Go 命令不存在

排查：

```bash
command -v go
echo $PATH
go version
```

判断：

- `command -v go` 没输出，说明系统找不到 Go。
- `go version` 失败，说明 Go 未安装或 PATH 错误。

修复：

```bash
echo 'export PATH=/usr/local/go/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
go version
```

如果 Go 版本低于 1.21，也需要升级。否则 `log/slog` 无法使用：

```bash
go version
```

判断依据：

- `go1.20` 或更低：不满足本章代码要求。
- `go1.21` 或更高：可以继续。

### 9.2 Go Module 位置错误

现象：

```text
go: cannot find main module
```

排查：

```bash
pwd
find .. -name go.mod
go env GOMOD
```

修复：

```bash
cd ~/cloud-native-todo-platform/cli/todo-cli
go env GOMOD
```

如果确实没有 `go.mod`：

```bash
go mod init github.com/yuanxuefeng/cloud-native-todo-platform/cli/todo-cli
```

### 9.3 import 路径错误

现象：

```text
package github.com/.../internal/todo is not in std
```

排查：

```bash
cat go.mod
grep -R "internal/todo" -n .
```

判断：

- `go.mod` 中的 module 路径必须和 `import` 前缀一致。

修复方式：

- 要么修改 `go.mod` module 路径。
- 要么修改 `main.go` 中的 import 路径。

如果出现：

```text
use of internal package ... not allowed
```

说明你从 `internal` 允许范围之外导入了包。修复方式是把调用代码放到 `internal` 父目录树内部，或者把需要对外复用的包移出 `internal`。

### 9.4 JSON 文件损坏

现象：

```text
decode task file: invalid character ...
```

排查：

```bash
echo "$TODO_DATA_FILE"
cat "$TODO_DATA_FILE"
python3 -m json.tool "$TODO_DATA_FILE"
```

修复：

```bash
cp "$TODO_DATA_FILE" "$TODO_DATA_FILE.bak"
rm -f "$TODO_DATA_FILE"
```

重新执行：

```bash
./bin/todo add "recover json file"
```

### 9.5 单元测试失败

排查：

```bash
go test -v ./...
```

判断：

- `-v` 会显示每个测试函数。
- 如果只有某个测试失败，先定位测试名。
- 如果编译失败，先修复类型、import、语法问题。

常用修复：

```bash
go fmt ./...
go test ./...
```

### 9.6 HTTP 请求失败

排查：

```bash
./bin/todo check-http --url https://example.com
curl -I https://example.com
```

判断：

- CLI 和 `curl` 都失败，可能是网络、DNS、代理或证书问题。
- `curl` 成功但 CLI 失败，检查 Go 代码中的 URL、超时和错误输出。

### 9.7 日志级别配置错误

现象：

```text
unsupported TODO_LOG_LEVEL "trace"
```

排查：

```bash
echo "$TODO_LOG_LEVEL"
TODO_LOG_LEVEL=debug ./bin/todo list
TODO_LOG_LEVEL=info ./bin/todo list
```

修复：

```bash
export TODO_LOG_LEVEL=info
```

本章只支持：

```text
debug, info, warn, error
```

## 10. 生产环境注意事项

- 不要把重要数据只保存在单个本地 JSON 文件中。生产系统应使用数据库或可靠存储。
- 本章 JSON 写入是教学实现，生产工具应考虑临时文件 + rename 的原子写入，避免中断导致文件损坏。
- 多个 CLI 进程同时写同一个 JSON 文件可能互相覆盖，生产环境应使用文件锁、数据库事务或集中式服务。
- 不要吞掉错误。Go 中每个 `err` 都应该被处理或明确说明为什么忽略。
- 不要滥用 `panic`。业务错误应返回 `error`。
- 使用 `context` 控制外部请求、数据库查询和 Kubernetes API 调用的超时。
- 文件权限要谨慎，包含敏感信息的文件不应设置为 `0777`。
- CLI 工具应使用明确的退出码，方便 CI/CD 判断成功或失败。
- 日志不要输出密码、Token、私钥等敏感信息。
- 日志级别应该可配置，但默认不要输出过多 debug 信息，避免泄露内部细节。
- 单元测试不应依赖真实用户目录、真实数据库或公网服务。
- Makefile 应保持简单、可读、可重复执行。
- Go 代码提交前应执行 `go fmt ./...` 和 `go test ./...`。

## 11. 本章小项目

本章小项目：**Go 命令行任务管理器**

交付物：

- `cli/todo-cli/go.mod`
- `cli/todo-cli/Makefile`
- `cli/todo-cli/cmd/todo/main.go`
- `cli/todo-cli/internal/todo/task.go`
- `cli/todo-cli/internal/todo/config.go`
- `cli/todo-cli/internal/todo/store.go`
- `cli/todo-cli/internal/todo/service.go`
- `cli/todo-cli/internal/todo/httpcheck.go`
- `cli/todo-cli/internal/todo/store_test.go`

验收命令：

```bash
cd ~/cloud-native-todo-platform/cli/todo-cli
make fmt
make test
make build
TODO_DATA_FILE=/tmp/cloud-native-todo-tasks.json ./bin/todo add "chapter 2 done"
TODO_DATA_FILE=/tmp/cloud-native-todo-tasks.json ./bin/todo list
TODO_DATA_FILE=/tmp/cloud-native-todo-tasks.json ./bin/todo done 1
TODO_DATA_FILE=/tmp/cloud-native-todo-tasks.json ./bin/todo stats
TODO_DATA_FILE=/tmp/cloud-native-todo-tasks.json ./bin/todo delete 1
```

能力验收标准：

| 能力项 | 验收标准 |
|---|---|
| Go 工具链 | 能安装 Go，执行 `go version`、`go test`、`go build` |
| Go 版本 | 能确认 Go 版本不低于 1.21 |
| Go Modules | 能解释 `go.mod` 的作用 |
| 基础语法 | 能使用变量、常量、函数、指针、struct、method |
| 抽象能力 | 能通过 interface 隔离存储实现 |
| 错误处理 | 能使用 `error`、`errors.Is`、`defer`、`recover` |
| 数据结构 | 能使用 slice 和 map 管理任务列表和统计 |
| 并发基础 | 能解释 goroutine、channel、context 在 `Stats` 中的作用 |
| 文件与 JSON | 能把任务保存到 JSON 文件并重新读取 |
| HTTP 客户端 | 能用 Go 发起带 context 的 HTTP 请求 |
| 日志配置 | 能通过 `TODO_LOG_LEVEL` 控制日志级别 |
| 测试 | 能编写并运行单元测试 |
| Makefile | 能用 `make fmt/test/build` 管理项目 |

## 12. 本章练习题

### 基础题

1. Go 为什么适合云原生基础设施开发？
2. `go.mod` 的作用是什么？
3. `package main` 和普通 package 有什么区别？
4. `var`、`:=`、`const` 分别用于什么场景？
5. 指针接收者和值接收者有什么区别？
6. Go 为什么推荐显式返回 `error`？
7. `defer` 常用于哪些场景？
8. slice 和 array 有什么区别？
9. map 的 key 有什么要求？
10. context 的主要作用是什么？
11. Go 的 `internal` 目录有什么导入限制？
12. 为什么本章要求 Go 1.21 或更高版本？

### 实操题

1. 给 `todo add` 增加 `--priority low|normal|high` 校验。
2. 给 `todo list` 增加只显示未完成任务的参数 `--pending`。
3. 给任务增加 `UpdatedAt` 字段。
4. 给 `Delete` 编写一个单独的测试函数。
5. 使用 `TODO_DATA_FILE` 指向不同文件，验证多份数据互不影响。
6. 把 `check-http` 默认 URL 改成你自己的文档站地址。
7. 执行 `go test -cover ./...` 查看测试覆盖率。
8. 给 `Service.Stats` 增加一个 context canceled 的测试。
9. 设置 `TODO_LOG_LEVEL=debug`，观察 CLI 日志输出。
10. 把 `cli/todo-cli/bin/` 加入项目根目录 `.gitignore`，避免提交二进制文件。

### 思考题

1. 为什么本章使用接口 `Store`，而不是在 `Service` 里直接读写文件？
2. 如果后续把 JSON 文件换成 PostgreSQL，需要改哪些代码？
3. `panic-demo` 为什么只能作为演示，不应该作为业务错误处理方式？
4. 为什么 HTTP 请求要设置 timeout 或 context？
5. 如果多个 CLI 进程同时写同一个 JSON 文件，可能出现什么问题？

## 13. 本章面试题

### 1. Go 的主要特点是什么？

参考答案：

Go 是静态类型、编译型语言，语法简洁，标准库强大，内置 goroutine 和 channel 支持并发，工具链统一。它适合构建后端服务、CLI 工具和云原生基础设施。

### 2. Go Module 解决了什么问题？

参考答案：

Go Module 用于管理模块路径、Go 版本和依赖版本。它让项目不再依赖 GOPATH 目录结构，方便团队协作、版本锁定和可重复构建。

### 3. Go 中 interface 的价值是什么？

参考答案：

interface 描述行为而不是具体实现。业务代码依赖 interface，可以降低和具体实现的耦合，方便测试和替换实现。例如本章 `Service` 依赖 `Store` 接口，后续可以把 JSON 文件存储替换成数据库存储。

### 4. Go 如何处理错误？

参考答案：

Go 通常通过返回 `error` 显式处理错误。调用方检查 `err != nil` 并决定返回、包装或处理。对于可识别的错误，可以定义哨兵错误并使用 `errors.Is` 判断。

### 5. defer 的执行时机是什么？

参考答案：

`defer` 会在当前函数返回前执行，常用于关闭文件、释放锁、取消 context 等清理动作。多个 defer 会按后进先出的顺序执行。

### 6. panic 和 recover 应该怎么使用？

参考答案：

`panic` 表示程序遇到无法继续执行的异常情况，不应该用于普通业务错误。`recover` 只能在 defer 中捕获 panic，常用于程序入口或中间件兜底，避免程序直接崩溃并输出不可控信息。

### 7. goroutine 和 channel 的关系是什么？

参考答案：

goroutine 是并发执行单元，channel 是 goroutine 之间通信的通道。goroutine 负责执行任务，channel 用于传递结果、信号或控制流程。

### 8. context 常用于什么场景？

参考答案：

context 常用于传递取消信号、超时时间和请求范围数据。Web API、数据库访问、HTTP 请求、Kubernetes Client 调用都会使用 context，防止请求无限阻塞或资源泄漏。

### 9. JSON tag 的作用是什么？

参考答案：

JSON tag 用于控制结构体字段和 JSON 字段之间的映射。例如 `ID int json:"id"` 会把 Go 字段 `ID` 编码为 JSON 字段 `id`。`omitempty` 可以在字段为空时省略。

### 10. 如何编写 Go 单元测试？

参考答案：

测试文件以 `_test.go` 结尾，测试函数以 `Test` 开头，并接收 `*testing.T`。运行 `go test ./...` 可以执行当前模块下所有测试。测试中应尽量使用临时目录、httptest 等隔离环境，避免依赖真实外部服务。

### 11. Go 的 internal 目录有什么作用？

参考答案：

`internal` 是 Go 的特殊目录。只有 `internal` 父目录及其子目录中的代码可以导入其中的包，项目外部不能直接导入。它常用于放置内部实现，避免外部项目依赖不稳定的内部代码。

### 12. 为什么生产工具写文件时要考虑原子写入？

参考答案：

如果程序直接覆盖目标文件，写入过程中断可能导致文件只写了一半。更稳妥的做法是先写入临时文件，确认写入成功后再用 rename 替换原文件。这样可以降低配置、状态文件损坏的风险。

### 13. Go 版本过低会造成什么问题？

参考答案：

Go 标准库和语法会随版本演进。例如本章使用的 `log/slog` 从 Go 1.21 开始提供，如果本地 Go 版本低于 1.21，代码会编译失败。因此项目应在文档、CI 和 `go.mod` 中明确最低版本要求。

## 14. 本章总结

本篇完成了 Go 语言基础和第一个 Go 项目。

你已经学习了：

- Go 语言特点和安装方式。
- Go Modules、package、import。
- 变量、常量、基础类型、函数、指针。
- struct、method、interface。
- error、defer、panic、recover。
- slice、map。
- goroutine、channel、context。
- JSON 编解码和文件读写。
- HTTP 客户端、日志和配置读取。
- Go 单元测试和 Makefile。

本篇项目成果是 `cli/todo-cli`。它是后续 Todo Web API 的原型：任务模型、业务服务、存储接口、测试方式都会继续演进。

## 15. 下一章衔接

下一篇将进入 **Go Web API 开发**。

本篇成果会继续复用：

- `Task` 会成为 API 的核心资源模型。
- `Service` 会被 HTTP Handler 调用。
- `Store` 接口会从 JSON 文件逐步演进到 PostgreSQL。
- `context` 会贯穿 HTTP 请求生命周期。
- `go test` 和 `Makefile` 会进入 CI/CD 流水线。

从下一篇开始，我们会把命令行 Todo 工具升级为真正的 RESTful Todo API，为后续 Docker 容器化和 Kubernetes 部署做准备。
