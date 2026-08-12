/**
 * tools.spec.ts — unit tests for dsh-interpreters.
 *
 * Tests:
 *   - resolveConfig: defaults, overrides, invalid values
 *   - buildPythonDescription / buildNodeDescription: embed interpreter path
 *   - runCode: execute `node -` with simple code, verify stdout/exit_code
 *   - runCode: timeout kills the process
 *   - runCode: abort signal kills the process
 *   - registerTools: registers two tools, disposer unregisters them
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveConfig, type Config } from '../src/config.ts'
import {
  buildPythonDescription,
  buildNodeDescription,
  registerTools,
} from '../src/tools.ts'
import type { ResolvedConfig } from '../src/config.ts'
import { runCode } from '../src/runner.ts'

describe('resolveConfig', () => {
  it('uses defaults when config is empty', () => {
    const cfg = resolveConfig({} as Config)
    expect(cfg.pythonPath).toBe('python')
    expect(cfg.nodePath).toBe('node')
    expect(cfg.timeoutMs).toBe(30000)
  })

  it('uses provided values', () => {
    const cfg = resolveConfig({ pythonPath: '/usr/bin/python3', nodePath: '/usr/local/bin/node', timeoutMs: 5000 })
    expect(cfg.pythonPath).toBe('/usr/bin/python3')
    expect(cfg.nodePath).toBe('/usr/local/bin/node')
    expect(cfg.timeoutMs).toBe(5000)
  })

  it('falls back when values are invalid', () => {
    expect(resolveConfig({ pythonPath: '', nodePath: '' } as Config).pythonPath).toBe('python')
    expect(resolveConfig({ pythonPath: '', nodePath: '' } as Config).nodePath).toBe('node')
    expect(resolveConfig({ timeoutMs: -1 } as Config).timeoutMs).toBe(30000)
    expect(resolveConfig({ timeoutMs: 0 } as Config).timeoutMs).toBe(30000)
    expect(resolveConfig({ timeoutMs: NaN } as Config).timeoutMs).toBe(30000)
  })
})

describe('buildPythonDescription', () => {
  it('embeds the python path', () => {
    const cfg: ResolvedConfig = { pythonPath: '/usr/bin/python3', nodePath: 'node', timeoutMs: 30000 }
    const desc = buildPythonDescription(cfg)
    expect(desc).toContain('/usr/bin/python3')
    expect(desc).toContain('Python')
  })

  it('works with default path', () => {
    const cfg: ResolvedConfig = { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000 }
    const desc = buildPythonDescription(cfg)
    expect(desc).toContain('python')
  })
})

describe('buildNodeDescription', () => {
  it('embeds the node path', () => {
    const cfg: ResolvedConfig = { pythonPath: 'python', nodePath: '/usr/local/bin/node', timeoutMs: 30000 }
    const desc = buildNodeDescription(cfg)
    expect(desc).toContain('/usr/local/bin/node')
    expect(desc).toContain('Node.js')
  })
})

describe('runCode', () => {
  it('executes simple node code and returns stdout', async () => {
    const controller = new AbortController()
    const result = await runCode('node', 'console.log("hello world")', undefined, 10000, controller.signal)
    expect(result.ok).toBe(true)
    expect(result.exit_code).toBe(0)
    expect(result.stdout.trim()).toBe('hello world')
    expect(result.timed_out).toBe(false)
    expect(result.cancelled).toBe(false)
  })

  it('captures stderr', async () => {
    const controller = new AbortController()
    const result = await runCode('node', 'console.error("err msg")', undefined, 10000, controller.signal)
    expect(result.exit_code).toBe(0)
    expect(result.stderr.trim()).toBe('err msg')
  })

  it('returns non-zero exit code for syntax error', async () => {
    const controller = new AbortController()
    const result = await runCode('node', 'this is not valid javascript!!!', undefined, 10000, controller.signal)
    expect(result.ok).toBe(false)
    expect(result.exit_code).not.toBe(0)
    expect(result.stderr).length > 0
  })

  it('kills the process on timeout', async () => {
    const controller = new AbortController()
    const result = await runCode('node', 'setTimeout(() => {}, 60000)', undefined, 200, controller.signal)
    expect(result.timed_out).toBe(true)
    expect(result.ok).toBe(false)
  })

  it('kills the process on abort signal', async () => {
    const controller = new AbortController()
    const promise = runCode('node', 'setTimeout(() => {}, 60000)', undefined, 60000, controller.signal)
    setTimeout(() => controller.abort(), 100)
    const result = await promise
    expect(result.cancelled).toBe(true)
    expect(result.ok).toBe(false)
  })

  it('returns immediately if signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const result = await runCode('node', 'console.log("hello")', undefined, 10000, controller.signal)
    expect(result.cancelled).toBe(true)
    expect(result.duration_ms).toBe(0)
  })

  it('reports error for non-existent executable', async () => {
    const controller = new AbortController()
    const result = await runCode('nonexistent-interpreter-xyz', 'print(1)', undefined, 5000, controller.signal)
    expect(result.ok).toBe(false)
    expect(result.exit_code).toBe(-1)
    expect(result.stderr).length > 0
  })
})

describe('registerTools', () => {
  it('registers two tools and disposer unregisters them', () => {
    const registered: string[] = []
    const dispose = vi.fn()
    const ctx = {
      tools: {
        register: vi.fn((def: unknown) => {
          const d = def as { name: string }
          registered.push(d.name)
          return dispose
        }),
      },
    } as unknown as Parameters<typeof registerTools>[0]

    const cfg: ResolvedConfig = { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000 }
    const disposer = registerTools(ctx, cfg)

    expect(ctx.tools.register).toHaveBeenCalledTimes(2)
    expect(registered).toContain('run_python')
    expect(registered).toContain('run_node')

    disposer()
    expect(dispose).toHaveBeenCalledTimes(2)
  })

  it('descriptions contain interpreter paths', () => {
    const definitions: Array<{ name: string; description: string }> = []
    const ctx = {
      tools: {
        register: vi.fn((def: unknown) => {
          const d = def as { name: string; description: string }
          definitions.push(d)
          return () => {}
        }),
      },
    } as unknown as Parameters<typeof registerTools>[0]

    const cfg: ResolvedConfig = { pythonPath: '/opt/python3.12', nodePath: '/usr/bin/node', timeoutMs: 30000 }
    registerTools(ctx, cfg)

    const py = definitions.find((d) => d.name === 'run_python')
    const nd = definitions.find((d) => d.name === 'run_node')
    expect(py?.description).toContain('/opt/python3.12')
    expect(nd?.description).toContain('/usr/bin/node')
  })
})
