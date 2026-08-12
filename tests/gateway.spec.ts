/**
 * gateway.spec.ts — unit tests for the interpreters config gateway.
 *
 * Tests:
 *   - get(): returns the resolved config from the bridge source
 *   - set(): throws when the settings service is unavailable
 *   - set(): writes the filtered patch to settings.update and returns updated config
 *   - set(): filters unknown keys, null, undefined, and mistyped values
 *   - set(): no-op patch returns current config without calling settings.update
 *
 * @module dsh-interpreters/tests/gateway
 */

import { describe, it, expect, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { InterpretersConfigGateway } from '../src/gateway.ts'
import type { InterpretersSettingsBridge } from '../src/settings.ts'
import type { Config } from '../src/config.ts'

/** Build a mock bridge with a controllable source. */
function bridgeOf(source: Config): InterpretersSettingsBridge {
  return {
    source: () => source,
    onChange: () => {},
  }
}

/** Construct a gateway with a real cordis Context (no settings service mounted). */
function gatewayWithoutSettings(bridge: InterpretersSettingsBridge): InterpretersConfigGateway {
  const ctx = new Context()
  return new InterpretersConfigGateway(ctx, bridge)
}

describe('InterpretersConfigGateway.get', () => {
  it('returns the resolved config from the bridge source', () => {
    const gateway = gatewayWithoutSettings(bridgeOf({ pythonPath: '/usr/bin/python3', nodePath: 'node', timeoutMs: 5000 }))
    const result = gateway.get()
    expect(result.config).toEqual({ pythonPath: '/usr/bin/python3', nodePath: 'node', timeoutMs: 5000 })
  })

  it('applies fallbacks for missing values', () => {
    const gateway = gatewayWithoutSettings(bridgeOf({}))
    const result = gateway.get()
    expect(result.config).toEqual({ pythonPath: 'python', nodePath: 'node', timeoutMs: 30000 })
  })

  it('applies fallbacks for invalid values', () => {
    const gateway = gatewayWithoutSettings(bridgeOf({ pythonPath: '', nodePath: '', timeoutMs: -1 }))
    const result = gateway.get()
    expect(result.config).toEqual({ pythonPath: 'python', nodePath: 'node', timeoutMs: 30000 })
  })
})

describe('InterpretersConfigGateway.set', () => {
  it('throws when the settings service is unavailable', async () => {
    const gateway = gatewayWithoutSettings(bridgeOf({}))
    await expect(gateway.set({ pythonPath: '/x' })).rejects.toThrow('settings service is unavailable')
  })

  it('returns current config without writing when patch is empty', async () => {
    const update = vi.fn(async () => {})
    const gateway = await gatewayWithSettings(bridgeOf({ pythonPath: 'python' }), update)
    const result = await gateway.set({})
    expect(update).not.toHaveBeenCalled()
    expect(result.config.pythonPath).toBe('python')
  })

  it('writes a valid patch and returns the updated config', async () => {
    let source: Config = { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000 }
    const update = vi.fn(async (_ns: string, patch: Record<string, unknown>) => {
      source = { ...source, ...patch }
    })
    const gateway = await gatewayWithSettings({ source: () => source, onChange: () => {} }, update)
    const result = await gateway.set({ pythonPath: '/opt/python3.12', timeoutMs: 5000 })
    expect(update).toHaveBeenCalledWith('interpreters', { pythonPath: '/opt/python3.12', timeoutMs: 5000 })
    expect(result.config.pythonPath).toBe('/opt/python3.12')
    expect(result.config.timeoutMs).toBe(5000)
  })

  it('filters unknown keys from the patch', async () => {
    const update = vi.fn(async () => {})
    const gateway = await gatewayWithSettings(bridgeOf({}), update)
    await gateway.set({ pythonPath: '/x', unknownField: 'malicious' } as never)
    expect(update).toHaveBeenCalledWith('interpreters', { pythonPath: '/x' })
  })

  it('filters null and undefined values from the patch', async () => {
    const update = vi.fn(async () => {})
    const gateway = await gatewayWithSettings(bridgeOf({}), update)
    await gateway.set({ pythonPath: '/x', nodePath: null, timeoutMs: undefined } as never)
    expect(update).toHaveBeenCalledWith('interpreters', { pythonPath: '/x' })
  })

  it('filters mistyped values from the patch', async () => {
    const update = vi.fn(async () => {})
    const gateway = await gatewayWithSettings(bridgeOf({}), update)
    // pythonPath must be a string; timeoutMs must be a finite number.
    await gateway.set({ pythonPath: 123, timeoutMs: 'not-a-number' } as never)
    expect(update).not.toHaveBeenCalled()
  })

  it('returns current config without writing when all fields are filtered out', async () => {
    const update = vi.fn(async () => {})
    const gateway = await gatewayWithSettings(bridgeOf({ pythonPath: 'python' }), update)
    const result = await gateway.set({ unknownField: 'x' } as never)
    expect(update).not.toHaveBeenCalled()
    expect(result.config.pythonPath).toBe('python')
  })
})

/**
 * Construct a gateway with a mock settings service mounted on the context.
 * @param bridge - the settings bridge.
 * @param update - the mock `settings.update` implementation.
 * @returns the gateway (with `this.settings` populated by the inject callback).
 */
async function gatewayWithSettings(
  bridge: InterpretersSettingsBridge,
  update: (ns: string, patch: Record<string, unknown>) => Promise<void>,
): Promise<InterpretersConfigGateway> {
  const ctx = new Context()
  const mockSettings = {
    update: vi.fn(update),
  }
  ctx.provide('settings', mockSettings)
  const gateway = new InterpretersConfigGateway(ctx, bridge)
  // Cordis `ctx.inject` callbacks fire on the microtask queue after the
  // service registry settles; wait one tick before returning so
  // `this.settings` is populated.
  await new Promise((resolve) => setTimeout(resolve, 0))
  return gateway
}
