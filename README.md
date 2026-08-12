# dsh-interpreters

DSH 插件：暴露 `run_python` 和 `run_node` 两个模型可调用工具，通过 stdin 执行代码并返回 stdout/stderr/exit code。提供设置页面让用户配置 Python 和 Node.js 解释器的可执行文件路径，工具描述中会告知模型解释器位置。

## 架构

- **工具**：`run_python` / `run_node`，通过 `spawn(executable, ['-'])` 执行代码，代码经 stdin 传入（无命令行长度限制）
- **设置持久化**：通过 `ctx.settings` 命名空间 `interpreters` 持久化到 `$DSH_HOME/settings.yaml`
- **动态 description**：工具的 `description` 在注册时根据配置计算，包含解释器路径；设置变更时自动重新注册
- **客户端 bundle**：设置页面通过 `settings.section` slot 注册，使用 `ctx.settingsScope` 读写配置

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
├── index.ts              # Host 入口：name, inject, Config, apply
├── tools.ts              # registerTools: 注册 run_python + run_node
├── runner.ts             # runCode: spawn + stdin + stdout/stderr 收集
└── client/
    ├── index.ts          # Client 入口：slots.inject('settings.section')
    ├── SettingsPage.tsx  # 设置页面：python/node 路径 + 超时
    └── locales.ts        # i18n (zh + en)
```

## 运行

### 本地安装

```sh
dsh plugin --profile web add "link:D:/Projects/deepseek-harness/dsh-interpreters"
```

### 配置

默认配置（`cordis.patch.yml`）：

```yaml
pythonPath: 'python'    # Python 可执行文件路径
nodePath: 'node'        # Node.js 可执行文件路径
timeoutMs: 30000        # 执行超时（毫秒）
```

运行时通过设置页面修改，持久化到 `$DSH_HOME/settings.yaml`。

## 检查

```sh
pnpm run typecheck && pnpm test && pnpm run build
```

验证 `lib/` 产物：
- `lib/index.js` — host bundle（ESM）
- `lib/client.js` — client bundle（CJS，`window.__ModuleLoader__.load` 包裹）
- `lib/types/` — TypeScript 声明文件
- `cordis.patch.yml` — bundle 配置层
