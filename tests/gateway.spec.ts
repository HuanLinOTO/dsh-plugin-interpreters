/**
 * gateway.spec.ts — unit tests for the interpreters HTTP gateway.
 *
 * Tests:
 *   - extractPatch: filters unknown keys, null, undefined, and mistyped values
 *   - extractPatch: accepts valid patches with correct types
 *   - handleSet: throws when the settings service is unavailable
 *   - handleSet: writes the filtered patch to settings.update and returns updated config
 *   - handleSet: no-op patch returns current config without calling settings.update
 *   - handleSet: all-filtered patch returns current config without calling settings.update
 *
 * @module dsh-interpreters/tests/gateway
 */

import { describe, it, expect, vi } from 'vitest'
import { extractPatch, handleSet } from '../src/gateway.ts'
import type { InterpretersSettingsBridge } from '../src/settings.ts'
import type { Config } from '../src/config.ts'

/** Build a mock bridge with a controllable source. */
function bridgeOf(source: Config): InterpretersSettingsBridge {
  return {
    source: () => source,
    onChange: () => {},
  }
}

/** Build a mock settings service with a controllable update. */
function settingsWith(update: (ns: string, patch: Record<string, unknown>) => Promise<void>): unknown {
  return { update: vi.fn(update) }
}

describe('extractPatch', () => {
  it('accepts a valid patch with correct types', () => {
    const patch = extractPatch({ patch: { pythonPath: '/usr/bin/python3', nodePath: 'node', timeoutMs: 5000 } })
    expect(patch).toEqual({ pythonPath: '/usr/bin/python3', nodePath: 'node', timeoutMs: 5000 })
  })

  it('filters unknown keys from the patch', () => {
    const patch = extractPatch({ patch: { pythonPath: '/x', unknownField: 'malicious' } })
    expect(patch).toEqual({ pythonPath: '/x' })
  })

  it('filters null and undefined values from the patch', () => {
    const patch = extractPatch({ patch: { pythonPath: '/x', nodePath: null, timeoutMs: undefined } })
    expect(patch).toEqual({ pythonPath: '/x' })
  })

  it('filters mistyped values from the patch', () => {
    const patch = extractPatch({ patch: { pythonPath: 123, timeoutMs: 'not-a-number' } })
    expect(patch).toEqual({})
  })

  it('returns empty when body is not an object', () => {
    expect(extractPatch(null)).toEqual({})
    expect(extractPatch('string')).toEqual({})
    expect(extractPatch(42)).toEqual({})
    expect(extractPatch(undefined)).toEqual({})
  })

  it('returns empty when body has no patch field', () => {
    expect(extractPatch({})).toEqual({})
    expect(extractPatch({ other: 'value' })).toEqual({})
  })

  it('returns empty when patch is not an object', () => {
    expect(extractPatch({ patch: 'string' })).toEqual({})
    expect(extractPatch({ patch: 42 })).toEqual({})
    expect(extractPatch({ patch: null })).toEqual({})
  })
})

describe('handleSet', () => {
  it('throws when the settings service is unavailable', async () => {
    const bridge = bridgeOf({})
    await expect(handleSet({ patch: { pythonPath: '/x' } }, undefined, bridge))
      .rejects.toThrow('settings service is unavailable')
  })

  it('returns current config without writing when patch is empty', async () => {
    const update = vi.fn(async () => {})
    const settings = settingsWith(update)
    const bridge = bridgeOf({ pythonPath: 'python' })
    const result = await handleSet({ patch: {} }, settings as never, bridge)
    expect(update).not.toHaveBeenCalled()
    expect(result.config.pythonPath).toBe('python')
  })

  it('writes a valid patch and returns the updated config', async () => {
    let source: Config = { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000 }
    const update = vi.fn(async (_ns: string, patch: Record<string, unknown>) => {
      source = { ...source, ...patch }
    })
    const settings = settingsWith(update)
    const bridge: InterpretersSettingsBridge = { source: () => source, onChange: () => {} }
    const result = await handleSet({ patch: { pythonPath: '/opt/python3.12', timeoutMs: 5000 } }, settings as never, bridge)
    expect(update).toHaveBeenCalledWith('interpreters', { pythonPath: '/opt/python3.12', timeoutMs: 5000 })
    expect(result.config.pythonPath).toBe('/opt/python3.12')
    expect(result.config.timeoutMs).toBe(5000)
  })

  it('filters unknown keys before writing', async () => {
    const update = vi.fn(async () => {})
    const settings = settingsWith(update)
    const bridge = bridgeOf({})
    await handleSet({ patch: { pythonPath: '/x', unknownField: 'malicious' } }, settings as never, bridge)
    expect(update).toHaveBeenCalledWith('interpreters', { pythonPath: '/x' })
  })

  it('returns current config without writing when all fields are filtered out', async () => {
    const update = vi.fn(async () => {})
    const settings = settingsWith(update)
    const bridge = bridgeOf({ pythonPath: 'python' })
    const result = await handleSet({ patch: { unknownField: 'x' } }, settings as never, bridge)
    expect(update).not.toHaveBeenCalled()
    expect(result.config.pythonPath).toBe('python')
  })

  it('returns current config without writing when patch contains only mistyped values', async () => {
    const update = vi.fn(async () => {})
    const settings = settingsWith(update)
    const bridge = bridgeOf({})
    await handleSet({ patch: { pythonPath: 123, timeoutMs: 'bad' } }, settings as never, bridge)
    expect(update).not.toHaveBeenCalled()
  })
})
