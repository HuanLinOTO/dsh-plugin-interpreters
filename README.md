<p align="center">
  <a href="https://dshfind.com/zh/plugins/huanlinoto/dsh-plugin-interpreters"><img src="https://dshfind.com/api/card/huanlinoto/dsh-plugin-interpreters?lang=zh" alt="dsh-plugin-interpreters card"></a>
</p>

# dsh-interpreters

[![npm version](https://img.shields.io/npm/v/@huanlin/dsh-plugin-interpreters)](https://www.npmjs.com/package/@huanlin/dsh-plugin-interpreters)

DSH 插件：暴露 `run_python` 和 `run_node` 两个模型可调用工具，通过 stdin 执行代码并返回 stdout/stderr/exit code。在设置页「插件配置」分区提供配置卡片，让用户设置 Python 和 Node.js 解释器的可执行文件路径，工具描述中会告知模型解释器位置。

## 架构

- **工具**：`run_python` / `run_node`，通过 `spawn(executable, ['-'])` 执行代码，代码经 stdin 传入（无命令行长度限制）
- **设置持久化**：配置来自插件 bundle 的 `cordis.patch.yml` 行配置（行 id `dsh-interpreters`），运行时改动写入 profile 的 `cordis.patch.yml`；三个字段都标了 `.volatile()`，Loader 直接提交新引用值，不重新挂载插件
- **动态 description**：工具只注册一次，执行时读取当前 volatile 引用，路径改动对下一次运行立即生效
- **配置暴露**：DSH 的 settings RPC 域只向配置客户端提供白名单命名空间，插件因此在 host 上自行注册 `/interpreters/api` 前缀路由，在进程内调 `ctx.settings.update(ns, patch)`。`ns` 必须是该插件在 profile 里的**行 id** `dsh-interpreters`（不是包名，也不是短名），否则每次保存都会失败并返回 `No configurable plugin entry`
- **客户端 bundle**：配置卡片注册进插件页的 `plugins.row.config` 槽（key `@huanlin/dsh-plugin-interpreters#dsh-interpreters`），用 `fetch('/interpreters/api/get'|'set')` 读写；`connection/reset` 事件触发卡片重载

## 开发

```sh
pnpm install          # 安装依赖（link: 指向 ~/.dsh/source/current/）
pnpm run typecheck    # tsc --noEmit
pnpm test             # vitest run
pnpm run build        # tsdown + tsc（生成 lib/index.js, lib/client.js, lib/types/*.d.ts）
```

### 目录结构

```
src/
├── index.ts              # Host 入口：name, inject, apply（实例化 bridge + gateway + 工具注册）
├── config.ts             # Config schema (schemastery), ResolvedConfig, resolveConfig
├── settings.ts           # installInterpretersSettings: 声明 auto:false 页面策略，返回 bridge (source())
├── gateway.ts            # registerHttpGateway: /interpreters/api 前缀路由（get/set）
├── tools.ts              # registerTools: 注册 run_python + run_node
├── runner.ts             # runCode: spawn + stdin + stdout/stderr 收集
└── client/
    ├── index.ts          # Client 入口：slots.inject('settings.plugin.item') + connection/reset
    ├── store.ts          # 卡片响应式 store（fetch /interpreters/api/get|set）
    ├── InterpretersCard.tsx  # 配置卡片组件
    └── locales.ts        # i18n (zh + en)
```

## 运行

### 本地安装

```sh
# 从 npm 安装（推荐）：
dsh plugin --profile web add @huanlin/dsh-plugin-interpreters

# 本地开发（热更新）：
dsh plugin --profile web add "link:D:/Projects/deepseek-harness/dsh-interpreters"
```

### 配置

默认配置（`cordis.patch.yml`）：

```yaml
pythonPath: 'python'    # Python 可执行文件路径
nodePath: 'node'        # Node.js 可执行文件路径
timeoutMs: 30000        # 执行超时（毫秒）
```

运行时通过插件页 `dsh-interpreters` 行的配置卡片修改，持久化到 profile `cordis.patch.yml` 中该行的 `config`。

## 检查

```sh
pnpm run typecheck && pnpm test && pnpm run build
```

验证 `lib/` 产物：
- `lib/index.js` — host 入口（ESM，tsc 产物；`@deepseek-ai/*` 与 `@deepseek-ai/schemastery` 保持外部引用）
- `lib/client.js` — client bundle（CJS，`window.__ModuleLoader__.load` 包裹，external: `react`）
- `lib/types/` — TypeScript 声明文件
- `cordis.patch.yml` — bundle 配置层
