# 第 13 篇：Go 后端生产化能力

前面几篇已经让 Todo Platform 具备 Go 基础、并发、工程化、Web API、PostgreSQL 和 Redis 能力。本篇开始把它从“能跑的后端服务”升级为“更接近真实公司生产环境的 API 服务”。

生产化不是把代码写复杂，而是补齐真实交付必须回答的问题：谁能访问接口、请求如何追踪、错误能否安全返回、配置如何区分环境、服务如何启动、关闭、迁移和排障。

本篇特色项目是：**将 Todo 平台升级为生产风格 API 服务**。

## 1. 本章学习目标

学完本篇后，你应该能够：

- 理解 JWT 登录、签发、校验和过期时间的基本流程。
- 能使用 Argon2id 保存密码哈希，不在配置中保存明文密码。
- 能为 API 增加认证中间件，保护 Todo CRUD 业务接口。
- 能实现请求 ID、结构化访问日志和审计日志。
- 能统一处理参数校验、安全错误响应和敏感信息保护。
- 能设计 `dev`、`test`、`prod` 配置分层。
- 能设计 `serve`、`config-check`、`hash-password`、`migrate` 等运维命令。
- 能说明生产环境中 JWT、日志、配置和迁移的风险边界。

本篇完成后，Todo Platform 会具备认证、日志、配置分层、健康检查、优雅关闭和运维命令能力，为后续 Docker、Kubernetes 和 Operator 章节打基础。

## 2. 本章工作场景

真实公司里的后端服务通常不会直接把业务接口暴露给所有人访问。即使是内部系统，也需要身份认证、审计日志、配置隔离和运维入口。

一个常见需求是：

> Todo API 即将部署到测试环境。团队要求所有 Todo CRUD 接口必须登录后才能访问；每个请求必须带请求 ID，方便排查链路问题；错误响应不能泄露数据库、Redis、JWT 密钥等内部细节；配置要能区分开发、测试和生产环境；服务要提供配置检查、密码哈希生成和数据库迁移命令。

这一类能力不一定最显眼，却是面试和工作中判断后端工程成熟度的重要依据。

## 3. 前置知识

必须掌握：

- 第 10 篇的 HTTP Handler、中间件、统一响应和优雅关闭。
- 第 11 篇的 PostgreSQL 迁移和 Repository 分层。
- 第 12 篇的 Redis 缓存、限流和异步任务。
- Go 的 `context`、`slog`、错误处理和测试。

建议了解：

- HTTP Header、`Authorization: Bearer <token>`。
- 密码哈希和明文密码的区别。
- 多环境配置：开发、测试、生产。

版本和工具基线：

| 工具 | 本篇要求 | 说明 |
|---|---|---|
| Go | `1.24+` | 本篇代码按课程统一基线编写。使用更新 Go 版本时，`go mod tidy` 可能自动调整 `go.mod` 中的 `go` 或 `toolchain` 字段，以本地工具链输出为准。 |
| curl | 必需 | 用于手工验证登录和受保护接口。 |
| jq | 可选 | Linux、macOS、WSL2 中用于解析登录响应；本篇同时提供不依赖 `jq` 的验证方式。 |
| PostgreSQL / Redis | 可选 | 只有验证迁移、数据库持久化、Redis 限流和异步任务时才需要。 |

## 4. 核心概念

### 4.1 JWT 鉴权

JWT 是一种自包含 Token。登录成功后，服务端签发 Token，客户端后续请求在 Header 中携带：

```text
Authorization: Bearer <jwt-token>
```

服务端校验签名、过期时间、签发者和用户信息。校验通过后，请求才能进入业务 Handler。

JWT 常见优点：

- 服务端不一定需要保存会话。
- 适合 API Gateway、微服务和前后端分离。
- 可以携带用户 ID、用户名、角色等少量信息。

JWT 常见风险：

- 一旦泄露，在过期前可能被冒用。
- 不能存放密码、手机号、密钥等敏感信息。
- 签名密钥必须安全保存并支持轮换。
- Token 过期时间不能无限长。

本篇实现的是教学版 Access Token 鉴权链路：登录后签发短期 JWT，业务接口校验 `Authorization: Bearer <token>`。真实公司系统还需要继续设计 Refresh Token、Token 撤销、密钥轮换、权限模型和登录风控。

### 4.2 密码哈希

生产环境不能保存明文密码，也不应该使用普通 SHA256 直接保存密码。密码哈希需要慢、带盐、抗暴力破解。

本篇使用 Argon2id：

- 每个密码生成随机 salt。
- 同一个密码每次生成的哈希也不同。
- 校验时使用常量时间比较，减少时序侧信道风险。

### 4.3 请求 ID 与审计日志

请求 ID 用于把一次请求在日志、监控、网关和业务系统中串起来。常见 Header 是：

```text
X-Request-ID: 9f8c2f...
```

如果客户端没有传，服务端生成一个。日志中记录 `request_id` 后，排障时可以快速定位同一次请求。

审计日志关注“谁在什么时候做了什么”，通常记录：

- 用户名或用户 ID。
- 请求路径和方法。
- 请求 ID。
- 来源地址。
- 操作结果。

注意：审计日志不能记录密码、JWT 原文、数据库 DSN、Redis 密码等敏感信息。

### 4.4 配置分层

真实项目通常至少有三类环境：

| 环境 | 目标 | 配置特点 |
|---|---|---|
| `dev` | 本地开发 | 日志详细、数据量小、可使用本地文件或本地容器 |
| `test` | 测试验证 | 接近生产，但允许更短 TTL、更强调可观测 |
| `prod` | 生产运行 | 安全、稳定、最小暴露、密钥来自 Secret |

本篇支持两种方式：

- `TODO_CONFIG_FILE`：指定单个配置文件。
- `TODO_CONFIG_DIR` + `TODO_ENV`：读取 `base.json`，再叠加 `dev.json`、`test.json` 或 `prod.json`。

配置优先级为：默认值 < 配置文件 < 环境变量。这样本地开发可以把通用配置放在文件里，生产环境可以用环境变量覆盖密钥、数据库地址、Redis 密码等敏感项。

### 4.5 运维命令

后端服务不应该只有“启动 HTTP 服务”一个入口。常见命令包括：

```text
todo-api serve
todo-api config-check
todo-api hash-password <password>
todo-api migrate
```

这样 CI、部署脚本和运维人员可以在不启动完整服务的情况下检查配置、生成密码哈希或执行迁移。

## 5. 原理深入

### 5.1 生产风格请求链路

```mermaid
sequenceDiagram
    participant Client as HTTP Client
    participant API as Todo API
    participant Auth as Auth Middleware
    participant Audit as Audit Logger
    participant Service as Todo Service
    participant Repo as Repository

    Client->>API: POST /api/v1/auth/login
    API-->>Client: JWT Token
    Client->>API: POST /api/v1/todos with Bearer Token
    API->>API: request id middleware
    API->>Auth: verify JWT
    Auth-->>API: user context
    API->>Audit: write audit fields
    API->>Service: create todo
    Service->>Repo: persist data
    Repo-->>Service: item
    Service-->>API: item
    API-->>Client: safe JSON response
```

关键点：

- 登录接口公开，但业务接口需要认证。
- 请求 ID 在链路最前面生成。
- 鉴权通过后，用户信息放入 `context`。
- 审计日志从 `context` 中读取用户信息。
- 错误响应只返回安全的业务错误码和消息。

### 5.2 中间件顺序

推荐顺序：

```text
recover -> timeout -> request id -> access log -> rate limit -> auth -> audit -> handler
```

顺序很重要：

- `recover` 越靠前越好，避免 panic 直接打断请求。
- `timeout` 控制请求最长执行时间。
- `request id` 要尽早生成，后续日志都能带上。
- 限流通常在认证前或认证后都可以，本篇放在业务路由里。
- 审计日志应该在认证之后，否则不知道是谁操作。

### 5.3 安全响应

生产 API 不应该把内部错误直接返回给客户端。比如数据库错误：

```text
dial tcp 10.0.0.5:5432: connect: connection refused
```

客户端只应该看到：

```json
{"error":{"code":"internal_error","message":"internal server error"}}
```

详细错误写入服务端日志，由开发和运维排查。

## 6. 手把手实验

### 6.1 实验目标

本实验会完成：

- 增加 JWT 认证和 Argon2id 密码哈希。
- 增加登录接口 `/api/v1/auth/login`。
- 使用中间件保护 Todo CRUD 接口。
- 增加请求 ID、访问日志和审计日志。
- 增加配置分层和认证配置。
- 增加 `serve`、`config-check`、`hash-password`、`migrate` 命令。
- 验证登录、带 Token 创建 Todo、无 Token 被拒绝。

### 6.2 实验环境

需要：

- Go 1.24 或更新版本。
- 已完成第 12 篇代码。
- 可选：Docker Compose、PostgreSQL、Redis。

本篇新增依赖：

```text
github.com/golang-jwt/jwt/v5 v5.3.1
golang.org/x/crypto v0.41.0
```

### 6.3 本篇目录结构

完成后新增或修改：

```text
cloud-native-todo-platform/
├── cmd/todo-api/main.go
├── configs/
│   ├── base.json
│   ├── dev.json
│   ├── test.json
│   └── prod.json
├── internal/
│   ├── app/app.go
│   ├── auth/
│   │   ├── auth.go
│   │   ├── password.go
│   │   └── auth_test.go
│   ├── config/config.go
│   └── httpapi/
│       ├── handlers.go
│       ├── middleware.go
│       ├── respond.go
│       ├── router.go
│       ├── router_auth_test.go
│       └── types.go
└── go.mod
```

### 6.4 更新 Go module

修改 `go.mod`：

```go title="go.mod"
module cloud-native-todo-platform

go 1.24

require (
	github.com/alicebob/miniredis/v2 v2.38.0
	github.com/go-chi/chi/v5 v5.3.0
	github.com/golang-jwt/jwt/v5 v5.3.1
	github.com/jackc/pgx/v5 v5.9.2
	github.com/redis/go-redis/v9 v9.19.0
	golang.org/x/crypto v0.41.0
)
```

执行：

=== "Linux / macOS / WSL2"

    ```bash
    go mod tidy
    ```

=== "Windows PowerShell"

    ```powershell
    go mod tidy
    ```

### 6.5 增加认证模块

创建 `internal/auth/password.go`：

```go title="internal/auth/password.go"
package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"strings"

	"golang.org/x/crypto/argon2"
)

const (
	passwordHashVersion = "argon2id$v=19$m=65536,t=3,p=2"
	argonMemory         = 64 * 1024
	argonTime           = 3
	argonThreads        = 2
	argonKeyLen         = 32
	saltLen             = 16
)

func HashPassword(password string) (string, error) {
	password = strings.TrimSpace(password)
	if len(password) < 8 {
		return "", fmt.Errorf("password must be at least 8 characters")
	}

	salt := make([]byte, saltLen)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate password salt: %w", err)
	}

	hash := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, argonKeyLen)
	return passwordHashVersion + "$" + base64.RawStdEncoding.EncodeToString(salt) + "$" + base64.RawStdEncoding.EncodeToString(hash), nil
}

func CheckPassword(encoded string, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 5 || parts[0] != "argon2id" || parts[1] != "v=19" || parts[2] != "m=65536,t=3,p=2" {
		return false
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil {
		return false
	}
	expected, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return false
	}

	actual := argon2.IDKey([]byte(password), salt, argonTime, argonMemory, argonThreads, uint32(len(expected)))
	return subtle.ConstantTimeCompare(actual, expected) == 1
}
```

创建 `internal/auth/auth.go`：

```go title="internal/auth/auth.go"
package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidToken       = errors.New("invalid token")
)

type User struct {
	ID       string
	Username string
	Role     string
}

type Service struct {
	issuer string
	secret []byte
	ttl    time.Duration
	users  map[string]userRecord
	now    func() time.Time
}

type userRecord struct {
	ID           string
	Username     string
	PasswordHash string
	Role         string
}

type Claims struct {
	UserID   string `json:"uid"`
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

type contextKey struct{}

func NewService(issuer string, secret string, ttl time.Duration, users map[string]string) (*Service, error) {
	issuer = strings.TrimSpace(issuer)
	if issuer == "" {
		issuer = "todo-api"
	}
	if len(secret) < 32 {
		return nil, fmt.Errorf("jwt secret must be at least 32 characters")
	}
	if ttl <= 0 {
		ttl = time.Hour
	}

	records := make(map[string]userRecord, len(users))
	for username, passwordHash := range users {
		username = strings.TrimSpace(username)
		passwordHash = strings.TrimSpace(passwordHash)
		if username == "" || passwordHash == "" {
			continue
		}
		records[username] = userRecord{
			ID:           username,
			Username:     username,
			PasswordHash: passwordHash,
			Role:         "user",
		}
	}
	if len(records) == 0 {
		return nil, fmt.Errorf("at least one auth user is required")
	}

	return &Service{
		issuer: issuer,
		secret: []byte(secret),
		ttl:    ttl,
		users:  records,
		now:    time.Now,
	}, nil
}

func (s *Service) Login(ctx context.Context, username, password string) (string, User, error) {
	username = strings.TrimSpace(username)
	record, ok := s.users[username]
	if !ok || !CheckPassword(record.PasswordHash, password) {
		return "", User{}, ErrInvalidCredentials
	}

	user := User{ID: record.ID, Username: record.Username, Role: record.Role}
	token, err := s.IssueToken(user)
	if err != nil {
		return "", User{}, err
	}
	return token, user, nil
}

func (s *Service) IssueToken(user User) (string, error) {
	now := s.now().UTC()
	claims := Claims{
		UserID:   user.ID,
		Username: user.Username,
		Role:     user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    s.issuer,
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	if err != nil {
		return "", fmt.Errorf("sign jwt: %w", err)
	}
	return signed, nil
}

func (s *Service) VerifyToken(tokenString string) (User, error) {
	tokenString = strings.TrimSpace(tokenString)
	if tokenString == "" {
		return User{}, ErrInvalidToken
	}

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("unexpected jwt signing method %s", token.Method.Alg())
		}
		return s.secret, nil
	}, jwt.WithIssuer(s.issuer))
	if err != nil || !token.Valid {
		return User{}, ErrInvalidToken
	}
	if claims.UserID == "" || claims.Username == "" {
		return User{}, ErrInvalidToken
	}
	return User{ID: claims.UserID, Username: claims.Username, Role: claims.Role}, nil
}

func (s *Service) TokenTTL() time.Duration {
	return s.ttl
}

func WithUser(ctx context.Context, user User) context.Context {
	return context.WithValue(ctx, contextKey{}, user)
}

func UserFromContext(ctx context.Context) (User, bool) {
	user, ok := ctx.Value(contextKey{}).(User)
	return user, ok
}
```

创建 `internal/auth/auth_test.go`：

```go title="internal/auth/auth_test.go"
package auth

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestHashAndCheckPassword(t *testing.T) {
	hash, err := HashPassword("correct-password")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	if !CheckPassword(hash, "correct-password") {
		t.Fatal("CheckPassword() = false, want true")
	}
	if CheckPassword(hash, "wrong-password") {
		t.Fatal("CheckPassword() = true, want false")
	}
}

func TestServiceLoginAndVerifyToken(t *testing.T) {
	hash, err := HashPassword("correct-password")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	service, err := NewService("todo-api", "0123456789abcdef0123456789abcdef", time.Hour, map[string]string{"admin": hash})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	service.now = func() time.Time { return time.Now().UTC() }

	token, user, err := service.Login(context.Background(), "admin", "correct-password")
	if err != nil {
		t.Fatalf("Login() error = %v", err)
	}
	if user.Username != "admin" || token == "" {
		t.Fatalf("Login() user = %+v token empty = %v", user, token == "")
	}

	verified, err := service.VerifyToken(token)
	if err != nil {
		t.Fatalf("VerifyToken() error = %v", err)
	}
	if verified.Username != "admin" {
		t.Fatalf("verified.Username = %q", verified.Username)
	}
}

func TestServiceRejectsInvalidCredentials(t *testing.T) {
	hash, err := HashPassword("correct-password")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	service, err := NewService("todo-api", "0123456789abcdef0123456789abcdef", time.Hour, map[string]string{"admin": hash})
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}

	_, _, err = service.Login(context.Background(), "admin", "wrong-password")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("Login() error = %v, want ErrInvalidCredentials", err)
	}
}
```

### 6.6 更新配置管理

修改 `internal/config/config.go`：

```go title="internal/config/config.go"
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	defaultAppName           = "todo-api"
	defaultEnv               = "local"
	defaultHTTPAddr          = ":8080"
	defaultLogLevel          = "info"
	defaultShutdownTimeout   = 5 * time.Second
	defaultCacheTTL          = 30 * time.Second
	defaultRateLimitRequests = 60
	defaultRateLimitWindow   = time.Minute
	defaultJWTIssuer         = "todo-api"
	defaultJWTTTL            = time.Hour
	defaultMigrationsDir     = "migrations"
)

type Config struct {
	AppName           string
	Env               string
	HTTPAddr          string
	DataPath          string
	DatabaseDSN       string
	RedisAddr         string
	RedisPassword     string
	RedisDB           int
	CacheTTL          time.Duration
	RateLimitRequests int
	RateLimitWindow   time.Duration
	JWTIssuer         string
	JWTSecret         string
	JWTTTL            time.Duration
	AuthUsers         map[string]string
	MigrationsDir     string
	LogLevel          string
	ShutdownTimeout   time.Duration
	EnableDebug       bool
}

type fileConfig struct {
	AppName           string            `json:"app_name"`
	Env               string            `json:"env"`
	HTTPAddr          string            `json:"http_addr"`
	DataPath          string            `json:"data_path"`
	DatabaseDSN       string            `json:"database_dsn"`
	RedisAddr         string            `json:"redis_addr"`
	RedisPassword     string            `json:"redis_password"`
	RedisDB           *int              `json:"redis_db"`
	CacheTTL          string            `json:"cache_ttl"`
	RateLimitRequests *int              `json:"rate_limit_requests"`
	RateLimitWindow   string            `json:"rate_limit_window"`
	JWTIssuer         string            `json:"jwt_issuer"`
	JWTSecret         string            `json:"jwt_secret"`
	JWTTTL            string            `json:"jwt_ttl"`
	AuthUsers         map[string]string `json:"auth_users"`
	MigrationsDir     string            `json:"migrations_dir"`
	LogLevel          string            `json:"log_level"`
	ShutdownTimeout   string            `json:"shutdown_timeout"`
	EnableDebug       *bool             `json:"enable_debug"`
}

func Load() (Config, error) {
	cfg := defaultConfig()

	if path := strings.TrimSpace(os.Getenv("TODO_CONFIG_FILE")); path != "" {
		if err := applyConfigFile(&cfg, path); err != nil {
			return Config{}, err
		}
	} else if dir := strings.TrimSpace(os.Getenv("TODO_CONFIG_DIR")); dir != "" {
		if err := applyLayeredConfig(&cfg, dir); err != nil {
			return Config{}, err
		}
	}

	if err := applyEnv(&cfg); err != nil {
		return Config{}, err
	}
	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}
	return cfg, nil
}

func defaultConfig() Config {
	return Config{
		AppName:           defaultAppName,
		Env:               defaultEnv,
		HTTPAddr:          defaultHTTPAddr,
		DataPath:          defaultDataPath(),
		CacheTTL:          defaultCacheTTL,
		RateLimitRequests: defaultRateLimitRequests,
		RateLimitWindow:   defaultRateLimitWindow,
		JWTIssuer:         defaultJWTIssuer,
		JWTTTL:            defaultJWTTTL,
		AuthUsers:         map[string]string{},
		MigrationsDir:     defaultMigrationsDir,
		LogLevel:          defaultLogLevel,
		ShutdownTimeout:   defaultShutdownTimeout,
	}
}

func applyLayeredConfig(cfg *Config, dir string) error {
	env := strings.TrimSpace(os.Getenv("TODO_ENV"))
	if env == "" {
		env = cfg.Env
	}
	for _, name := range []string{"base.json", env + ".json"} {
		path := filepath.Join(dir, name)
		if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err := applyConfigFile(cfg, path); err != nil {
			return err
		}
	}
	return nil
}

func applyConfigFile(cfg *Config, path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read config file %s: %w", path, err)
	}

	var file fileConfig
	if err := json.Unmarshal(data, &file); err != nil {
		return fmt.Errorf("parse config file %s: %w", path, err)
	}

	if value := strings.TrimSpace(file.AppName); value != "" {
		cfg.AppName = value
	}
	if value := strings.TrimSpace(file.Env); value != "" {
		cfg.Env = value
	}
	if value := strings.TrimSpace(file.HTTPAddr); value != "" {
		cfg.HTTPAddr = value
	}
	if value := strings.TrimSpace(file.DataPath); value != "" {
		cfg.DataPath = value
	}
	if value := strings.TrimSpace(file.DatabaseDSN); value != "" {
		cfg.DatabaseDSN = value
	}
	if value := strings.TrimSpace(file.RedisAddr); value != "" {
		cfg.RedisAddr = value
	}
	if value := file.RedisPassword; value != "" {
		cfg.RedisPassword = value
	}
	if file.RedisDB != nil {
		cfg.RedisDB = *file.RedisDB
	}
	if value := strings.TrimSpace(file.CacheTTL); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse config file cache_ttl: %w", err)
		}
		cfg.CacheTTL = duration
	}
	if file.RateLimitRequests != nil {
		cfg.RateLimitRequests = *file.RateLimitRequests
	}
	if value := strings.TrimSpace(file.RateLimitWindow); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse config file rate_limit_window: %w", err)
		}
		cfg.RateLimitWindow = duration
	}
	if value := strings.TrimSpace(file.JWTIssuer); value != "" {
		cfg.JWTIssuer = value
	}
	if value := file.JWTSecret; value != "" {
		cfg.JWTSecret = value
	}
	if value := strings.TrimSpace(file.JWTTTL); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse config file jwt_ttl: %w", err)
		}
		cfg.JWTTTL = duration
	}
	if len(file.AuthUsers) > 0 {
		cfg.AuthUsers = file.AuthUsers
	}
	if value := strings.TrimSpace(file.MigrationsDir); value != "" {
		cfg.MigrationsDir = value
	}
	if value := strings.TrimSpace(file.LogLevel); value != "" {
		cfg.LogLevel = value
	}
	if value := strings.TrimSpace(file.ShutdownTimeout); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse config file shutdown_timeout: %w", err)
		}
		cfg.ShutdownTimeout = duration
	}
	if file.EnableDebug != nil {
		cfg.EnableDebug = *file.EnableDebug
	}
	return nil
}

func applyEnv(cfg *Config) error {
	if value := strings.TrimSpace(os.Getenv("TODO_APP_NAME")); value != "" {
		cfg.AppName = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_ENV")); value != "" {
		cfg.Env = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_HTTP_ADDR")); value != "" {
		cfg.HTTPAddr = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_LOG_LEVEL")); value != "" {
		cfg.LogLevel = value
	}
	if path := strings.TrimSpace(os.Getenv("TODO_API_DATA_PATH")); path != "" {
		cfg.DataPath = path
	}
	if value := strings.TrimSpace(os.Getenv("TODO_DATABASE_DSN")); value != "" {
		cfg.DatabaseDSN = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_REDIS_ADDR")); value != "" {
		cfg.RedisAddr = value
	}
	if value := os.Getenv("TODO_REDIS_PASSWORD"); value != "" {
		cfg.RedisPassword = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_REDIS_DB")); value != "" {
		db, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("parse TODO_REDIS_DB: %w", err)
		}
		cfg.RedisDB = db
	}
	if value := strings.TrimSpace(os.Getenv("TODO_CACHE_TTL")); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse TODO_CACHE_TTL: %w", err)
		}
		cfg.CacheTTL = duration
	}
	if value := strings.TrimSpace(os.Getenv("TODO_RATE_LIMIT_REQUESTS")); value != "" {
		limit, err := strconv.Atoi(value)
		if err != nil {
			return fmt.Errorf("parse TODO_RATE_LIMIT_REQUESTS: %w", err)
		}
		cfg.RateLimitRequests = limit
	}
	if value := strings.TrimSpace(os.Getenv("TODO_RATE_LIMIT_WINDOW")); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse TODO_RATE_LIMIT_WINDOW: %w", err)
		}
		cfg.RateLimitWindow = duration
	}
	if value := strings.TrimSpace(os.Getenv("TODO_JWT_ISSUER")); value != "" {
		cfg.JWTIssuer = value
	}
	if value := os.Getenv("TODO_JWT_SECRET"); value != "" {
		cfg.JWTSecret = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_JWT_TTL")); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse TODO_JWT_TTL: %w", err)
		}
		cfg.JWTTTL = duration
	}
	if value := strings.TrimSpace(os.Getenv("TODO_AUTH_USERS")); value != "" {
		users, err := parseAuthUsers(value)
		if err != nil {
			return err
		}
		cfg.AuthUsers = users
	}
	if value := strings.TrimSpace(os.Getenv("TODO_MIGRATIONS_DIR")); value != "" {
		cfg.MigrationsDir = value
	}
	if value := strings.TrimSpace(os.Getenv("TODO_SHUTDOWN_TIMEOUT")); value != "" {
		duration, err := time.ParseDuration(value)
		if err != nil {
			return fmt.Errorf("parse TODO_SHUTDOWN_TIMEOUT: %w", err)
		}
		cfg.ShutdownTimeout = duration
	}
	if value := strings.TrimSpace(os.Getenv("TODO_ENABLE_DEBUG")); value != "" {
		enabled, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("parse TODO_ENABLE_DEBUG: %w", err)
		}
		cfg.EnableDebug = enabled
	}
	return nil
}

func (c Config) Validate() error {
	if strings.TrimSpace(c.AppName) == "" {
		return errors.New("app name is required")
	}
	if strings.TrimSpace(c.Env) == "" {
		return errors.New("env is required")
	}
	if strings.TrimSpace(c.HTTPAddr) == "" {
		return errors.New("http addr is required")
	}
	if strings.TrimSpace(c.DataPath) == "" && strings.TrimSpace(c.DatabaseDSN) == "" {
		return errors.New("data path or database dsn is required")
	}
	if c.RedisDB < 0 {
		return errors.New("redis db must be greater than or equal to 0")
	}
	if c.CacheTTL <= 0 || c.RateLimitRequests <= 0 || c.RateLimitWindow <= 0 {
		return errors.New("cache and rate limit settings must be greater than 0")
	}
	if len(c.AuthUsers) > 0 && len(c.JWTSecret) < 32 {
		return errors.New("jwt secret must be at least 32 characters when auth is enabled")
	}
	if c.ShutdownTimeout <= 0 {
		return errors.New("shutdown timeout must be greater than 0")
	}
	switch strings.ToLower(strings.TrimSpace(c.LogLevel)) {
	case "debug", "info", "warn", "error":
		return nil
	default:
		return fmt.Errorf("unsupported log level %q", c.LogLevel)
	}
}

func defaultDataPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return filepath.Join(".todo-cli", "todos.json")
	}
	return filepath.Join(home, ".todo-cli", "todos.json")
}

func parseAuthUsers(value string) (map[string]string, error) {
	users := map[string]string{}
	for _, pair := range strings.Split(value, ",") {
		pair = strings.TrimSpace(pair)
		if pair == "" {
			continue
		}
		parts := strings.SplitN(pair, "=", 2)
		if len(parts) != 2 || strings.TrimSpace(parts[0]) == "" || strings.TrimSpace(parts[1]) == "" {
			return nil, fmt.Errorf("parse TODO_AUTH_USERS: want username=password_hash pairs")
		}
		users[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
	}
	return users, nil
}
```

### 6.7 增加配置文件分层

创建 `configs/base.json`：

```json title="configs/base.json"
{
  "app_name": "todo-api",
  "http_addr": ":8080",
  "data_path": ".todo-cli/todos.json",
  "cache_ttl": "30s",
  "rate_limit_requests": 60,
  "rate_limit_window": "1m",
  "jwt_issuer": "todo-api",
  "jwt_ttl": "1h",
  "migrations_dir": "migrations",
  "shutdown_timeout": "5s"
}
```

创建 `configs/dev.json`：

```json title="configs/dev.json"
{
  "env": "dev",
  "log_level": "debug",
  "enable_debug": true
}
```

创建 `configs/test.json`：

```json title="configs/test.json"
{
  "env": "test",
  "http_addr": "127.0.0.1:18080",
  "log_level": "info",
  "cache_ttl": "5s",
  "rate_limit_requests": 100
}
```

创建 `configs/prod.json`：

```json title="configs/prod.json"
{
  "env": "prod",
  "http_addr": ":8080",
  "log_level": "info",
  "enable_debug": false
}
```

生产环境不要把 `jwt_secret`、`auth_users`、数据库密码、Redis 密码写进 Git。它们应该来自环境变量、Kubernetes Secret 或密钥管理系统。

本篇默认 `dev.json` 不配置 `database_dsn` 和 `redis_addr`，这样新手可以先用文件存储启动服务。需要验证 PostgreSQL 或 Redis 时，再通过环境变量开启：

```bash
export TODO_DATABASE_DSN='postgres://todo:todo_password@127.0.0.1:5432/todo_platform?sslmode=disable'
export TODO_REDIS_ADDR='127.0.0.1:6379'
export TODO_REDIS_PASSWORD='todo_redis_password'
```

常用配置项可以这样理解：

| 配置项 | 环境变量 | 是否敏感 | 生产建议 |
|---|---|---|---|
| `env` | `TODO_ENV` | 否 | ConfigMap 或普通环境变量 |
| `http_addr` | `TODO_HTTP_ADDR` | 否 | ConfigMap 或普通环境变量 |
| `log_level` | `TODO_LOG_LEVEL` | 否 | ConfigMap 或普通环境变量 |
| `jwt_secret` | `TODO_JWT_SECRET` | 是 | Secret 或密钥管理系统 |
| `auth_users` | `TODO_AUTH_USERS` | 是 | Secret 或密钥管理系统 |
| `database_dsn` | `TODO_DATABASE_DSN` | 是 | Secret |
| `redis_addr` | `TODO_REDIS_ADDR` | 否 | ConfigMap 或服务发现 |
| `redis_password` | `TODO_REDIS_PASSWORD` | 是 | Secret |
| `migrations_dir` | `TODO_MIGRATIONS_DIR` | 否 | 镜像内目录或只读挂载 |

### 6.8 更新 HTTP 类型、错误响应和登录 Handler

修改 `internal/httpapi/types.go`：

```go title="internal/httpapi/types.go"
package httpapi

import (
	"cloud-native-todo-platform/internal/auth"
	"cloud-native-todo-platform/internal/todo"
)

type response struct {
	Data any `json:"data,omitempty"`
}

type errorResponse struct {
	Error apiError `json:"error"`
}

type apiError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type createTodoRequest struct {
	Title string `json:"title"`
}

type updateTodoRequest struct {
	Title string `json:"title"`
}

type loginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResponse struct {
	Token     string       `json:"token"`
	TokenType string       `json:"token_type"`
	ExpiresIn int64       `json:"expires_in"`
	User      userResponse `json:"user"`
}

type userResponse struct {
	ID       string `json:"id"`
	Username string `json:"username"`
	Role     string `json:"role"`
}

type todoResponse struct {
	ID        int         `json:"id"`
	Title     string      `json:"title"`
	Status    todo.Status `json:"status"`
	CreatedAt string      `json:"created_at"`
	UpdatedAt string      `json:"updated_at"`
}

type listTodosResponse struct {
	Items []todoResponse `json:"items"`
}

type healthResponse struct {
	Status string `json:"status"`
}

type readinessResponse struct {
	Status string     `json:"status"`
	Stats  todo.Stats `json:"stats"`
}

func newTodoResponse(item todo.Item) todoResponse {
	return todoResponse{
		ID:        item.ID,
		Title:     item.Title,
		Status:    item.Status,
		CreatedAt: item.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt: item.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}

func newUserResponse(user auth.User) userResponse {
	return userResponse{
		ID:       user.ID,
		Username: user.Username,
		Role:     user.Role,
	}
}
```

修改 `internal/httpapi/respond.go`：

```go title="internal/httpapi/respond.go"
package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"cloud-native-todo-platform/internal/auth"
	"cloud-native-todo-platform/internal/todo"
)

const (
	errorCodeInvalidRequest       = "invalid_request"
	errorCodeUnsupportedMediaType = "unsupported_media_type"
	errorCodeRequestTooLarge      = "request_body_too_large"
	errorCodeUnauthorized         = "unauthorized"
	errorCodeNotFound             = "not_found"
	errorCodeInternal             = "internal_error"
)

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if payload == nil {
		return
	}
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		slog.Default().Error("encode json response", "error", err)
	}
}

func writeData(w http.ResponseWriter, status int, data any) {
	writeJSON(w, status, response{Data: data})
}

func writeError(w http.ResponseWriter, status int, code string, message string) {
	writeJSON(w, status, errorResponse{
		Error: apiError{
			Code:    code,
			Message: message,
		},
	})
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidCredentials):
		writeError(w, http.StatusUnauthorized, errorCodeUnauthorized, "invalid username or password")
	case errors.Is(err, todo.ErrEmptyTitle):
		writeError(w, http.StatusBadRequest, errorCodeInvalidRequest, "title is required")
	case errors.Is(err, todo.ErrNotFound):
		writeError(w, http.StatusNotFound, errorCodeNotFound, "todo not found")
	default:
		writeError(w, http.StatusInternalServerError, errorCodeInternal, "internal server error")
	}
}
```

`writeServiceError` 不把内部错误原文暴露给客户端，避免泄露数据库地址、Redis 密码或堆栈信息。

### 6.9 更新中间件和路由

修改 `internal/httpapi/middleware.go`：

```go title="internal/httpapi/middleware.go"
package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"time"

	"cloud-native-todo-platform/internal/auth"
)

type RateLimiter interface {
	Allow(ctx context.Context, identity string) (bool, error)
}

type Authenticator interface {
	Login(ctx context.Context, username, password string) (string, auth.User, error)
	VerifyToken(token string) (auth.User, error)
	TokenTTL() time.Duration
}

type requestIDKey struct{}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (r *statusRecorder) WriteHeader(status int) {
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := strings.TrimSpace(r.Header.Get("X-Request-ID"))
		if id == "" {
			id = newRequestID()
		}
		w.Header().Set("X-Request-ID", id)
		ctx := context.WithValue(r.Context(), requestIDKey{}, id)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(recorder, r)
			logger.Info(
				"http request",
				"request_id", RequestIDFromContext(r.Context()),
				"method", r.Method,
				"path", r.URL.Path,
				"status", recorder.status,
				"duration_ms", time.Since(start).Milliseconds(),
			)
		})
	}
}

func auditLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			recorder := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
			next.ServeHTTP(recorder, r)
			user, _ := auth.UserFromContext(r.Context())
			logger.Info(
				"audit api access",
				"request_id", RequestIDFromContext(r.Context()),
				"user", user.Username,
				"method", r.Method,
				"path", r.URL.Path,
				"status", recorder.status,
				"remote_addr", r.RemoteAddr,
			)
		})
	}
}

func authenticate(authenticator Authenticator, logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := strings.TrimSpace(r.Header.Get("Authorization"))
			if !strings.HasPrefix(header, "Bearer ") {
				writeError(w, http.StatusUnauthorized, errorCodeUnauthorized, "missing bearer token")
				return
			}
			user, err := authenticator.VerifyToken(strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")))
			if err != nil {
				logger.Warn("reject invalid token", "request_id", RequestIDFromContext(r.Context()), "error", err)
				writeError(w, http.StatusUnauthorized, errorCodeUnauthorized, "invalid token")
				return
			}
			next.ServeHTTP(w, r.WithContext(auth.WithUser(r.Context(), user)))
		})
	}
}

func rateLimit(limiter RateLimiter, logger *slog.Logger) func(http.Handler) http.Handler {
	if logger == nil {
		logger = slog.Default()
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			identity := clientIdentity(r)
			allowed, err := limiter.Allow(r.Context(), identity)
			if err != nil {
				logger.Error("rate limiter failed", "identity", identity, "error", err)
				writeError(w, http.StatusServiceUnavailable, "rate_limiter_unavailable", "rate limiter unavailable")
				return
			}
			if !allowed {
				writeError(w, http.StatusTooManyRequests, "rate_limited", "too many requests")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func RequestIDFromContext(ctx context.Context) string {
	value, _ := ctx.Value(requestIDKey{}).(string)
	return value
}

func newRequestID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(b[:])
}

func clientIdentity(r *http.Request) string {
	if forwardedFor := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwardedFor != "" {
		parts := strings.Split(forwardedFor, ",")
		return strings.TrimSpace(parts[0])
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	return r.RemoteAddr
}
```

修改 `internal/httpapi/router.go`：

```go title="internal/httpapi/router.go"
package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"cloud-native-todo-platform/internal/todo"
)

type Server struct {
	todos         *todo.Service
	authenticator Authenticator
	logger        *slog.Logger
}

type RouterOption func(*routerOptions)

type routerOptions struct {
	limiter       RateLimiter
	authenticator Authenticator
}

func WithRateLimiter(limiter RateLimiter) RouterOption {
	return func(options *routerOptions) { options.limiter = limiter }
}

func WithAuthenticator(authenticator Authenticator) RouterOption {
	return func(options *routerOptions) { options.authenticator = authenticator }
}

func NewRouter(todos *todo.Service, logger *slog.Logger, options ...RouterOption) http.Handler {
	cfg := routerOptions{}
	for _, option := range options {
		if option != nil {
			option(&cfg)
		}
	}

	server := &Server{todos: todos, authenticator: cfg.authenticator, logger: logger}

	r := chi.NewRouter()
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(10 * time.Second))
	r.Use(requestID)
	r.Use(requestLogger(logger))

	r.Get("/healthz", server.healthz)
	r.Get("/readyz", server.readyz)

	r.Route("/api/v1", func(r chi.Router) {
		if cfg.authenticator != nil {
			r.Post("/auth/login", server.login)
		}

		r.Group(func(r chi.Router) {
			if cfg.limiter != nil {
				r.Use(rateLimit(cfg.limiter, logger))
			}
			if cfg.authenticator != nil {
				r.Use(authenticate(cfg.authenticator, logger))
				r.Use(auditLogger(logger))
			}
			r.Get("/todos", server.listTodos)
			r.Post("/todos", server.createTodo)
			r.Get("/todos/{id}", server.getTodo)
			r.Put("/todos/{id}", server.updateTodo)
			r.Post("/todos/{id}/done", server.doneTodo)
			r.Delete("/todos/{id}", server.deleteTodo)
		})
	})

	r.NotFound(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, errorCodeNotFound, "route not found")
	})
	r.MethodNotAllowed(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusMethodNotAllowed, errorCodeInvalidRequest, "method not allowed")
	})
	return r
}
```

创建 `internal/httpapi/router_auth_test.go`，验证认证中间件真正保护了业务接口：

```go title="internal/httpapi/router_auth_test.go"
package httpapi

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"cloud-native-todo-platform/internal/auth"
	"cloud-native-todo-platform/internal/todo"
)

func newAuthenticatedTestRouter(t *testing.T) http.Handler {
	t.Helper()

	store := todo.NewFileStore(t.TempDir() + "/todos.json")
	store.Now = func() time.Time {
		return time.Date(2026, 5, 26, 10, 0, 0, 0, time.UTC)
	}
	logger := slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))
	service := todo.NewService(store, logger)

	hash, err := auth.HashPassword("correct-password")
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}
	authenticator, err := auth.NewService(
		"todo-api",
		"0123456789abcdef0123456789abcdef",
		time.Hour,
		map[string]string{"admin": hash},
	)
	if err != nil {
		t.Fatalf("NewService() error = %v", err)
	}
	return NewRouter(service, logger, WithAuthenticator(authenticator))
}

func TestProtectedTodosRequireToken(t *testing.T) {
	router := newAuthenticatedTestRouter(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/todos", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d, body = %s", rec.Code, http.StatusUnauthorized, rec.Body.String())
	}
}

func TestLoginAndCreateTodoWithToken(t *testing.T) {
	router := newAuthenticatedTestRouter(t)

	loginBody := strings.NewReader(`{"username":"admin","password":"correct-password"}`)
	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", loginBody)
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)
	if loginRec.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRec.Code, loginRec.Body.String())
	}

	var loginResp struct {
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	if err := json.Unmarshal(loginRec.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if loginResp.Data.Token == "" {
		t.Fatal("login token is empty")
	}

	createBody := strings.NewReader(`{"title":"production style api"}`)
	createReq := httptest.NewRequest(http.MethodPost, "/api/v1/todos", createBody)
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Header.Set("Authorization", "Bearer "+loginResp.Data.Token)
	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("create status = %d, body = %s", createRec.Code, createRec.Body.String())
	}
	if !strings.Contains(createRec.Body.String(), `"title":"production style api"`) {
		t.Fatalf("create body = %s", createRec.Body.String())
	}
}
```

修改 `internal/httpapi/handlers.go`，新增 `login` Handler，其余 Todo Handler 保持第 12 篇逻辑：

```go title="internal/httpapi/handlers.go"
package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"cloud-native-todo-platform/internal/todo"
)

const maxRequestBodyBytes = 1 << 20

func (s *Server) healthz(w http.ResponseWriter, r *http.Request) {
	writeData(w, http.StatusOK, healthResponse{Status: "ok"})
}

func (s *Server) readyz(w http.ResponseWriter, r *http.Request) {
	stats, err := s.todos.Stats(r.Context())
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeData(w, http.StatusOK, readinessResponse{Status: "ready", Stats: stats})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if s.authenticator == nil {
		writeError(w, http.StatusNotFound, errorCodeNotFound, "route not found")
		return
	}
	var req loginRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	token, user, err := s.authenticator.Login(r.Context(), req.Username, req.Password)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeData(w, http.StatusOK, loginResponse{
		Token:     token,
		TokenType: "Bearer",
		ExpiresIn: int64(s.authenticator.TokenTTL().Seconds()),
		User:      newUserResponse(user),
	})
}

func (s *Server) listTodos(w http.ResponseWriter, r *http.Request) {
	status, ok := parseStatus(w, r)
	if !ok {
		return
	}
	items, err := s.todos.List(r.Context(), todo.ListRequest{Status: status})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	result := make([]todoResponse, 0, len(items))
	for _, item := range items {
		result = append(result, newTodoResponse(item))
	}
	writeData(w, http.StatusOK, listTodosResponse{Items: result})
}

func (s *Server) createTodo(w http.ResponseWriter, r *http.Request) {
	var req createTodoRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	item, err := s.todos.Create(r.Context(), todo.CreateRequest{Title: req.Title})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeData(w, http.StatusCreated, newTodoResponse(item))
}

func (s *Server) getTodo(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	item, err := s.todos.Get(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeData(w, http.StatusOK, newTodoResponse(item))
}

func (s *Server) updateTodo(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	var req updateTodoRequest
	if !decodeJSON(w, r, &req) {
		return
	}
	item, err := s.todos.Update(r.Context(), id, todo.UpdateRequest{Title: req.Title})
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeData(w, http.StatusOK, newTodoResponse(item))
}

func (s *Server) doneTodo(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	item, err := s.todos.Done(r.Context(), id)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	writeData(w, http.StatusOK, newTodoResponse(item))
}

func (s *Server) deleteTodo(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	if err := s.todos.Delete(r.Context(), id); err != nil {
		writeServiceError(w, err)
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	defer r.Body.Close()
	mediaType, _, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || !strings.EqualFold(mediaType, "application/json") {
		writeError(w, http.StatusUnsupportedMediaType, errorCodeUnsupportedMediaType, "content type must be application/json")
		return false
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			writeError(w, http.StatusRequestEntityTooLarge, errorCodeRequestTooLarge, "request body is too large")
			return false
		}
		writeError(w, http.StatusBadRequest, errorCodeInvalidRequest, "request body is invalid")
		return false
	}
	if err := decoder.Decode(&struct{}{}); err == nil {
		writeError(w, http.StatusBadRequest, errorCodeInvalidRequest, "request body must contain only one JSON object")
		return false
	} else if !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, errorCodeInvalidRequest, "request body is invalid")
		return false
	}
	return true
}

func parseID(w http.ResponseWriter, r *http.Request) (int, bool) {
	raw := chi.URLParam(r, "id")
	id, err := strconv.Atoi(raw)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, errorCodeInvalidRequest, "id must be a positive integer")
		return 0, false
	}
	return id, true
}

func parseStatus(w http.ResponseWriter, r *http.Request) (todo.Status, bool) {
	raw := strings.TrimSpace(r.URL.Query().Get("status"))
	if raw == "" {
		return "", true
	}
	status := todo.Status(raw)
	switch status {
	case todo.StatusPending, todo.StatusDone:
		return status, true
	default:
		writeError(w, http.StatusBadRequest, errorCodeInvalidRequest, "status must be pending or done")
		return "", false
	}
}
```

### 6.10 更新应用组装和启动命令

修改 `internal/app/app.go`：

```go title="internal/app/app.go"
package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"time"

	"cloud-native-todo-platform/internal/config"
	"cloud-native-todo-platform/internal/httpapi"
	"cloud-native-todo-platform/internal/todo"
)

type App struct {
	Config        config.Config
	Logger        *slog.Logger
	Todos         *todo.Service
	closer        io.Closer
	limiter       httpapi.RateLimiter
	authenticator httpapi.Authenticator
}

type Option func(*App)

func WithRateLimiter(limiter httpapi.RateLimiter) Option {
	return func(app *App) { app.limiter = limiter }
}

func WithAuthenticator(authenticator httpapi.Authenticator) Option {
	return func(app *App) { app.authenticator = authenticator }
}

func New(cfg config.Config, logger *slog.Logger, repo todo.Repository, closer io.Closer, options ...Option) *App {
	if repo == nil {
		repo = todo.NewFileStore(cfg.DataPath)
	}
	app := &App{Config: cfg, Logger: logger, Todos: todo.NewService(repo, logger), closer: closer}
	for _, option := range options {
		if option != nil {
			option(app)
		}
	}
	return app
}

func (a *App) Close() error {
	if a.closer == nil {
		return nil
	}
	return a.closer.Close()
}

func (a *App) Run(ctx context.Context) error {
	if a.Logger == nil {
		a.Logger = slog.Default()
	}
	stats, err := a.Todos.Stats(ctx)
	if err != nil {
		return fmt.Errorf("load todo stats during app startup: %w", err)
	}

	routerOptions := []httpapi.RouterOption{}
	if a.limiter != nil {
		routerOptions = append(routerOptions, httpapi.WithRateLimiter(a.limiter))
	}
	if a.authenticator != nil {
		routerOptions = append(routerOptions, httpapi.WithAuthenticator(a.authenticator))
	}

	handler := httpapi.NewRouter(a.Todos, a.Logger, routerOptions...)
	server := &http.Server{Addr: a.Config.HTTPAddr, Handler: handler, ReadHeaderTimeout: 5 * time.Second}
	listener, err := net.Listen("tcp", a.Config.HTTPAddr)
	if err != nil {
		return fmt.Errorf("listen http addr %s: %w", a.Config.HTTPAddr, err)
	}

	errCh := make(chan error, 1)
	go func() {
		a.Logger.Info("todo api server started", "app", a.Config.AppName, "env", a.Config.Env, "http_addr", listener.Addr().String(), "todo_total", stats.Total)
		if err := server.Serve(listener); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
			return
		}
		errCh <- nil
	}()

	select {
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), a.Config.ShutdownTimeout)
		defer cancel()
		a.Logger.Info("todo api server shutting down", "timeout", a.Config.ShutdownTimeout.String())
		if err := server.Shutdown(shutdownCtx); err != nil {
			return fmt.Errorf("shutdown http server: %w", err)
		}
		return <-errCh
	case err := <-errCh:
		if err != nil {
			return fmt.Errorf("run http server: %w", err)
		}
		return nil
	}
}
```

修改 `cmd/todo-api/main.go`：

```go title="cmd/todo-api/main.go"
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"cloud-native-todo-platform/internal/app"
	"cloud-native-todo-platform/internal/auth"
	"cloud-native-todo-platform/internal/cache"
	"cloud-native-todo-platform/internal/config"
	"cloud-native-todo-platform/internal/db"
	"cloud-native-todo-platform/internal/httpapi"
	"cloud-native-todo-platform/internal/logger"
	"cloud-native-todo-platform/internal/ratelimit"
	"cloud-native-todo-platform/internal/tasks"
	"cloud-native-todo-platform/internal/todo"
)

func main() {
	if err := run(context.Background(), os.Stdout, os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}
}

func run(parent context.Context, stdout io.Writer, args []string) error {
	command := "serve"
	if len(args) > 0 {
		command = args[0]
	}
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	log := logger.New(stdout, cfg.LogLevel, cfg.Env)

	switch command {
	case "serve":
		return serve(parent, stdout, cfg, log)
	case "config-check":
		fmt.Fprintf(stdout, "config ok: env=%s http_addr=%s data_path=%s auth_users=%d\n", cfg.Env, cfg.HTTPAddr, cfg.DataPath, len(cfg.AuthUsers))
		return nil
	case "hash-password":
		if len(args) < 2 {
			return fmt.Errorf("usage: todo-api hash-password <password>")
		}
		hash, err := auth.HashPassword(args[1])
		if err != nil {
			return err
		}
		fmt.Fprintln(stdout, hash)
		return nil
	case "migrate":
		return migrate(parent, cfg, stdout)
	default:
		return fmt.Errorf("unknown command %q", command)
	}
}

func serve(parent context.Context, stdout io.Writer, cfg config.Config, log *slog.Logger) error {
	ctx, stop := signal.NotifyContext(parent, os.Interrupt, syscall.SIGTERM)
	defer stop()

	repo := todo.Repository(todo.NewFileStore(cfg.DataPath))
	closers := make([]io.Closer, 0)

	if strings.TrimSpace(cfg.DatabaseDSN) != "" {
		database, err := db.Open(ctx, cfg.DatabaseDSN)
		if err != nil {
			return err
		}
		repo = todo.NewPostgresStore(database)
		closers = append(closers, database)
		log.Info("postgres repository enabled")
	} else {
		log.Info("file repository enabled", "data_path", cfg.DataPath)
	}

	var limiter httpapi.RateLimiter
	if strings.TrimSpace(cfg.RedisAddr) != "" {
		redisClient, err := cache.Open(ctx, cache.Options{Addr: cfg.RedisAddr, Password: cfg.RedisPassword, DB: cfg.RedisDB})
		if err != nil {
			return err
		}
		closers = append(closers, redisClient)
		queue := tasks.NewQueue(redisClient, "todo:tasks:stats", log)
		repo = todo.NewCachedRepository(repo, redisClient, log, cfg.CacheTTL, queue)
		limiter = ratelimit.NewRedisLimiter(redisClient, cfg.RateLimitRequests, cfg.RateLimitWindow, "todo:ratelimit")
		workerService := todo.NewService(repo, log)
		go func() {
			if err := queue.Run(ctx, tasks.RefreshStatsHandler(workerService, log)); err != nil {
				log.Error("redis task worker stopped", "error", err)
			}
		}()
	}

	options := []app.Option{}
	if limiter != nil {
		options = append(options, app.WithRateLimiter(limiter))
	}
	if len(cfg.AuthUsers) > 0 {
		authenticator, err := auth.NewService(cfg.JWTIssuer, cfg.JWTSecret, cfg.JWTTTL, cfg.AuthUsers)
		if err != nil {
			return err
		}
		options = append(options, app.WithAuthenticator(authenticator))
		log.Info("jwt authentication enabled", "issuer", cfg.JWTIssuer, "users", len(cfg.AuthUsers))
	}

	todoApp := app.New(cfg, log, repo, closeAll(closers...), options...)
	defer func() {
		if err := todoApp.Close(); err != nil {
			log.Error("close app resources", "error", err)
		}
	}()
	return todoApp.Run(ctx)
}

func migrate(ctx context.Context, cfg config.Config, stdout io.Writer) error {
	if strings.TrimSpace(cfg.DatabaseDSN) == "" {
		return fmt.Errorf("TODO_DATABASE_DSN is required for migrate")
	}
	database, err := db.Open(ctx, cfg.DatabaseDSN)
	if err != nil {
		return err
	}
	defer database.Close()

	path := filepath.Join(cfg.MigrationsDir, "000001_create_todos.up.sql")
	query, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("read migration %s: %w", path, err)
	}
	if _, err := database.ExecContext(ctx, string(query)); err != nil {
		return fmt.Errorf("apply migration %s: %w", path, err)
	}
	if err := verifyMigration(ctx, database); err != nil {
		return err
	}
	fmt.Fprintf(stdout, "migration applied: %s\n", path)
	return nil
}

func verifyMigration(ctx context.Context, database *sql.DB) error {
	var version string
	if err := database.QueryRowContext(ctx, "SELECT version FROM schema_migrations WHERE version = $1", "000001_create_todos").Scan(&version); err != nil {
		return fmt.Errorf("verify migration: %w", err)
	}
	return nil
}

type closeFunc func() error

func (f closeFunc) Close() error { return f() }

func closeAll(closers ...io.Closer) io.Closer {
	if len(closers) == 0 {
		return nil
	}
	return closeFunc(func() error {
		var result error
		for _, closer := range closers {
			if closer == nil {
				continue
			}
			if err := closer.Close(); err != nil {
				result = errors.Join(result, err)
			}
		}
		return result
	})
}
```

### 6.11 运行验证

生成本地密码哈希：

=== "Linux / macOS / WSL2"

    ```bash
    TODO_CONFIG_DIR=configs TODO_ENV=dev go run ./cmd/todo-api hash-password "change-me-123"
    ```

=== "Windows PowerShell"

    ```powershell
    $env:TODO_CONFIG_DIR = "configs"
    $env:TODO_ENV = "dev"
    go run ./cmd/todo-api hash-password "change-me-123"
    ```

把输出保存到环境变量：

=== "Linux / macOS / WSL2"

    ```bash
    export TODO_JWT_SECRET=0123456789abcdef0123456789abcdef
    export TODO_AUTH_USERS='admin=<上一步输出的哈希>'
    export TODO_CONFIG_DIR=configs
    export TODO_ENV=dev
    go run ./cmd/todo-api config-check
    go run ./cmd/todo-api serve
    ```

=== "Windows PowerShell"

    ```powershell
    $env:TODO_JWT_SECRET = '0123456789abcdef0123456789abcdef'
    $env:TODO_AUTH_USERS = 'admin=<上一步输出的哈希>'
    $env:TODO_CONFIG_DIR = 'configs'
    $env:TODO_ENV = 'dev'
    go run ./cmd/todo-api config-check
    go run ./cmd/todo-api serve
    ```

`TODO_AUTH_USERS` 中的 Argon2id 哈希包含 `$`。Linux、macOS、WSL2 和 PowerShell 都建议使用单引号保存这个环境变量，避免 shell 把 `$argon2id`、`$v` 等片段当成变量展开。

另开终端登录并访问接口：

=== "Linux / macOS / WSL2"

    如果已经安装 `jq`，可以直接解析 Token：

    ```bash
    TOKEN=$(curl -s -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:8080/api/v1/auth/login | jq -r '.data.token')

    curl -s -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"title":"production style api"}' \
      http://127.0.0.1:8080/api/v1/todos
    ```

    如果没有安装 `jq`，先打印登录响应，再手动复制 `data.token` 字段：

    ```bash
    curl -s -H "Content-Type: application/json" \
      -d '{"username":"admin","password":"change-me-123"}' \
      http://127.0.0.1:8080/api/v1/auth/login

    TOKEN='<复制 data.token 字段>'
    curl -s -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"title":"production style api"}' \
      http://127.0.0.1:8080/api/v1/todos
    ```

=== "Windows PowerShell"

    ```powershell
    $login = curl.exe -s -H "Content-Type: application/json" -d "{\"username\":\"admin\",\"password\":\"change-me-123\"}" http://127.0.0.1:8080/api/v1/auth/login | ConvertFrom-Json
    $token = $login.data.token
    curl.exe -s -H "Authorization: Bearer $token" -H "Content-Type: application/json" -d "{\"title\":\"production style api\"}" http://127.0.0.1:8080/api/v1/todos
    ```

验证无 Token 被拒绝：

=== "Linux / macOS / WSL2"

    ```bash
    curl -i http://127.0.0.1:8080/api/v1/todos
    ```

=== "Windows PowerShell"

    ```powershell
    curl.exe -i http://127.0.0.1:8080/api/v1/todos
    ```

预期返回 `401 Unauthorized`。

### 6.12 清理步骤

=== "Linux / macOS / WSL2"

    ```bash
    unset TODO_CONFIG_DIR TODO_ENV TODO_JWT_SECRET TODO_AUTH_USERS
    ```

=== "Windows PowerShell"

    ```powershell
    Remove-Item Env:TODO_CONFIG_DIR -ErrorAction SilentlyContinue
    Remove-Item Env:TODO_ENV -ErrorAction SilentlyContinue
    Remove-Item Env:TODO_JWT_SECRET -ErrorAction SilentlyContinue
    Remove-Item Env:TODO_AUTH_USERS -ErrorAction SilentlyContinue
    ```

## 7. 真实工作案例

某团队把 Todo API 部署到测试环境后，测试同学发现任何人都能创建和删除 Todo。团队补齐了登录接口、JWT 鉴权、审计日志和配置分层。

职责边界通常是：

- 后端开发：实现登录、鉴权、错误响应和审计字段。
- 测试：验证无 Token、错误 Token、过期 Token 和正常 Token。
- 运维：把 JWT Secret、用户哈希、数据库密码注入环境变量或 Secret。
- 架构师：决定 Token TTL、密钥轮换、权限模型和审计保留周期。

上线后，排障时可以通过 `request_id` 找到完整请求日志；安全事件发生时，可以从审计日志判断哪个用户访问了哪个接口。

## 8. 常见错误

| 错误现象 | 常见原因 | 修复方向 |
|---|---|---|
| 登录一直 401 | 密码哈希不是由 `hash-password` 生成 | 重新生成哈希并更新 `TODO_AUTH_USERS` |
| PowerShell 登录一直 401 | `TODO_AUTH_USERS` 使用双引号，Argon2id 哈希中的 `$` 被当成变量展开 | 使用单引号设置 `$env:TODO_AUTH_USERS` |
| 业务接口 401 | 没有传 `Authorization: Bearer` | 检查 Header |
| `jwt secret must be at least 32 characters` | JWT Secret 太短 | 使用更长随机密钥 |
| 日志找不到请求 | 没有记录 `request_id` | 确认中间件顺序 |
| 生产配置误用 dev | `TODO_ENV` 或 `TODO_CONFIG_DIR` 设置错误 | 执行 `config-check` |
| 迁移失败 | 数据库 DSN 错误或迁移目录错误 | 检查 `TODO_DATABASE_DSN` 和 `TODO_MIGRATIONS_DIR` |
| 错误响应泄露内部信息 | 直接把 `err.Error()` 返回给客户端 | 使用统一错误码 |

## 9. 排障方法

### 9.1 检查配置加载

```bash
go run ./cmd/todo-api config-check
```

重点看：

- `env` 是否符合预期。
- `http_addr` 是否正确。
- `auth_users` 是否大于 0。

### 9.2 检查登录

```bash
curl -i -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"change-me-123"}' \
  http://127.0.0.1:8080/api/v1/auth/login
```

如果返回 401，不要打印密码或哈希到日志。先确认用户名、密码哈希和 JWT Secret。

### 9.3 检查请求 ID

```bash
curl -i -H "X-Request-ID: demo-request-1" http://127.0.0.1:8080/healthz
```

响应 Header 应该包含同一个 `X-Request-ID`，日志也应该记录 `request_id=demo-request-1`。

### 9.4 检查受保护接口

无 Token：

```bash
curl -i http://127.0.0.1:8080/api/v1/todos
```

有 Token：

```bash
curl -i -H "Authorization: Bearer <token>" http://127.0.0.1:8080/api/v1/todos
```

前者应该是 `401`，后者应该根据业务返回 `200` 或其他业务结果。

### 9.5 检查迁移

```bash
go run ./cmd/todo-api migrate
```

如果失败，按顺序检查：

- `TODO_DATABASE_DSN` 是否设置。
- PostgreSQL 是否可连接。
- `migrations/000001_create_todos.up.sql` 是否存在。
- 当前数据库用户是否有建表权限。

## 10. 生产环境注意事项

### 10.1 JWT Secret 必须安全保存

JWT Secret 不能提交到 Git。生产环境应使用 Kubernetes Secret、云厂商 Secret Manager 或 CI/CD 密钥注入。

Secret 还需要轮换策略。轮换期间可以短暂支持新旧两个 Secret，等旧 Token 过期后移除旧 Secret。

### 10.2 Token TTL 不要过长

访问 Token 过期时间越长，泄露后的风险越大。常见做法是：

- Access Token 较短，例如 15 分钟到 2 小时。
- Refresh Token 另行设计，并具备撤销能力。
- 管理后台和高危操作可以要求重新认证。

本篇只实现 Access Token，不实现 Refresh Token。

### 10.3 审计日志不能记录敏感信息

不要记录：

- 明文密码。
- JWT 原文。
- `jwt_secret`。
- 数据库 DSN 中的密码。
- Redis 密码。

审计日志应该记录“谁、何时、从哪里、访问了什么”，而不是记录请求体里的所有内容。

### 10.4 配置要有最小权限

生产配置应满足：

- 默认关闭 debug。
- 日志级别不低于 `info`。
- 密钥从外部注入。
- 数据库用户只具备必要权限。
- 迁移权限和应用运行权限可以拆开。

### 10.5 运维命令要可重复执行

`config-check`、`migrate` 这类命令应该幂等、可重复执行、输出明确。CI/CD 可以先执行 `config-check`，再执行 `migrate`，最后启动 `serve`。

本篇 `migrate` 是教学版实现，只执行第 11 篇已有的 `000001_create_todos.up.sql` 并查询 `schema_migrations` 确认版本。真实生产迁移至少还要考虑：

| 能力 | 教学版 `migrate` | 生产级迁移 |
|---|---|---|
| 多版本迁移 | 只处理一个文件 | 按版本顺序扫描并执行多个迁移 |
| 版本记录 | 依赖 SQL 文件写入 `schema_migrations` | 迁移器统一记录版本、耗时、执行状态 |
| 事务 | 依赖 SQL 自身 | 每个迁移尽量事务化，无法事务化的 DDL 要单独评审 |
| 并发控制 | 未实现锁 | 部署时加数据库锁或流水线互斥，避免多实例同时迁移 |
| 回滚 | 手动执行 down 文件 | 有明确回滚策略、备份策略和变更窗口 |

因此，本篇命令适合课程项目和本地验证。生产项目建议使用成熟迁移工具或团队统一迁移平台，并把迁移权限和应用运行权限拆开。

### 10.6 本地配置到 Kubernetes 的映射

后续进入 Docker 和 Kubernetes 后，本篇配置会自然迁移为容器环境变量、ConfigMap 和 Secret：

| 本地配置 | 容器 / Kubernetes 形态 | 原因 |
|---|---|---|
| `TODO_ENV`、`TODO_HTTP_ADDR`、`TODO_LOG_LEVEL` | ConfigMap 或普通环境变量 | 非敏感运行参数，可以随环境变化 |
| `TODO_JWT_SECRET` | Secret | 认证签名密钥，泄露后可伪造 Token |
| `TODO_AUTH_USERS` | Secret | 包含密码哈希，仍属于敏感认证数据 |
| `TODO_DATABASE_DSN` | Secret | DSN 常包含数据库用户名、密码和内网地址 |
| `TODO_REDIS_PASSWORD` | Secret | Redis 访问凭据 |
| `TODO_MIGRATIONS_DIR` | 镜像内目录或 ConfigMap 挂载 | 迁移文件应随应用版本管理 |

这个映射关系会在后续 Docker Compose、Kubernetes Deployment、ConfigMap、Secret 和 Job 章节中继续使用。

## 11. 本章小项目

本章小项目是：**Todo Platform 生产风格 API 服务**。

项目成果：

- `internal/auth`：JWT 认证和密码哈希。
- `internal/httpapi`：登录接口、鉴权中间件、请求 ID 和审计日志。
- `internal/config`：配置文件分层和认证配置。
- `cmd/todo-api`：`serve`、`config-check`、`hash-password`、`migrate` 命令。
- `configs`：`base`、`dev`、`test`、`prod` 配置样例。

### 验收命令

```bash
go mod tidy
go fmt ./...
go test ./...
go test ./... -cover
go build ./cmd/todo-api
go run ./cmd/todo-api config-check
go run ./cmd/todo-api hash-password "change-me-123"
```

### 能力验收标准

- 能生成密码哈希，而不是保存明文密码。
- 能登录并获取 JWT。
- 无 Token 访问 Todo CRUD 会返回 401。
- 带 Token 可以访问 Todo CRUD。
- 日志中包含请求 ID。
- 审计日志中包含用户、路径、方法和响应状态码。
- 能使用 `TODO_CONFIG_DIR` 和 `TODO_ENV` 切换配置。
- 能执行 `config-check`、`hash-password`、`migrate`、`serve`。
- 能解释生产环境 JWT Secret、Token TTL、审计日志、迁移命令和配置注入风险。

## 12. 本章练习题

### 基础题

1. JWT 的 Header、Payload、Signature 分别有什么作用？
2. 为什么不能把密码明文写进配置文件？
3. `X-Request-ID` 在排障中有什么价值？
4. 为什么错误响应不能直接返回 `err.Error()`？
5. `dev`、`test`、`prod` 配置应有哪些差异？

### 实操题

1. 把 JWT TTL 改成 `15m`，重新登录并观察 `expires_in`。
2. 给审计日志增加 `user_id` 字段，并确认不会记录 JWT 原文。
3. 为 `/api/v1/auth/login` 增加登录失败日志，但不要打印密码。
4. 使用 `TODO_CONFIG_DIR=configs TODO_ENV=test` 启动服务。
5. 为 `migrate` 增加 `migrate-status` 命令。

### 思考题

1. JWT 泄露后应该如何降低影响？
2. 登录失败次数是否应该接入 Redis 限流？
3. 审计日志应该保存多久？
4. 应用运行数据库账号和迁移数据库账号是否应该分开？
5. 如果生产配置缺少 JWT Secret，服务应该启动失败还是降级运行？

## 13. 本章面试题

### 1. JWT 鉴权流程是什么？

参考答案：

用户登录成功后服务端签发 JWT，客户端后续请求携带 `Authorization: Bearer <token>`。服务端校验签名、签发者、过期时间和用户声明，校验通过后把用户信息放入请求上下文，再进入业务 Handler。

### 2. 为什么密码要使用 Argon2id、bcrypt 这类算法？

参考答案：

密码哈希需要带盐、计算成本可控且抗暴力破解。普通 SHA256 太快，攻击者可以大规模撞库。Argon2id 和 bcrypt 更适合密码存储。本篇使用 Argon2id，并用常量时间比较校验结果。

### 3. 请求 ID 有什么作用？

参考答案：

请求 ID 用于把同一次请求在网关、应用、数据库日志、审计日志和监控中串起来。排障时可以通过一个 ID 找到完整链路，而不是只靠时间范围模糊搜索。

### 4. 如何避免错误响应泄露敏感信息？

参考答案：

客户端只返回稳定错误码和安全消息，例如 `internal_error`。内部错误详情写入服务端日志。不要把数据库 DSN、Redis 密码、JWT Secret、堆栈、SQL 原文直接返回给客户端。

### 5. 生产配置如何管理？

参考答案：

通用配置可以放配置文件，敏感配置应由环境变量、Kubernetes Secret 或密钥管理系统注入。配置应按环境分层，启动前执行配置检查。生产环境应默认关闭 debug，限制日志敏感字段。

### 6. 服务启动和迁移命令如何设计？

参考答案：

服务入口可以设计为多命令：`config-check` 检查配置，`migrate` 执行数据库迁移，`serve` 启动 HTTP 服务，`hash-password` 生成用户密码哈希。命令应幂等、输出清晰，便于 CI/CD 和运维脚本调用。

### 7. Access Token、Refresh Token 和 Token 撤销如何设计？

参考答案：

Access Token 应该短期有效，用于访问 API。Refresh Token 生命周期更长，必须可撤销、可轮换，并存储在服务端或可信存储中。用户修改密码、退出登录、账号禁用或发现泄露时，应能撤销 Refresh Token，并尽量缩短已签发 Access Token 的剩余风险窗口。

### 8. 为什么生产环境中迁移权限和应用运行权限最好拆开？

参考答案：

迁移账号需要建表、改表、建索引等 DDL 权限，应用运行账号通常只需要读写业务表。拆开后，即使应用被攻击，攻击者也更难直接修改数据库结构。部署流水线或 Kubernetes Job 可以使用迁移账号，正常 API Pod 使用权限更小的运行账号。

## 14. 本章总结

本篇把 Todo Platform 升级为更接近生产环境的 API 服务：

- 增加 JWT 登录和认证中间件。
- 使用 Argon2id 保存密码哈希。
- 给请求链路增加请求 ID、访问日志和审计日志。
- 扩展配置分层，支持 `dev`、`test`、`prod`。
- 增加 `serve`、`config-check`、`hash-password`、`migrate` 运维命令。
- 补充安全响应、敏感信息保护和生产注意事项。

到这里，阶段二已经完成了 Go 后端开发的主线能力：语言基础、并发、工程化、Web API、数据库、Redis 和生产化。

## 15. 下一章衔接

下一阶段会进入 Docker 容器技术。第 13 篇的成果会直接影响后续容器化：

- `serve` 会成为容器默认启动命令。
- `config-check` 可用于 CI 或启动前检查。
- `migrate` 可用于部署流水线或 Kubernetes Job。
- `dev/test/prod` 配置会演进为 Compose 环境变量和 Kubernetes ConfigMap / Secret。
- JWT Secret、数据库密码、Redis 密码会进入容器和 Kubernetes 的密钥管理体系。

后续我们会把 Todo API、PostgreSQL、Redis 一起容器化，并逐步部署到 Kubernetes。
