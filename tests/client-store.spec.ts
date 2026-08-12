/**
 * client-store.spec.ts — unit tests for the interpreters card store.
 *
 * @module dsh-interpreters/tests/client-store
 */

import { describe, it, expect, vi } from 'vitest'
import { InterpretersCardController } from '../src/client/store.ts'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'

/** RPC result shape (success or failure). */
type RpcResult =
  | { readonly ok: true; readonly value: unknown }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string; readonly details: object } }

/** Build a mock RPC caller with controllable `get` and `set` handlers. */
function rpcOf(overrides: {
  get?: () => Promise<RpcResult>
  set?: (patch: Record<string, unknown>) => Promise<RpcResult>
} = {}): ClientConnectionRpc {
  const defaultGet = async (): Promise<RpcResult> => ({
    ok: true,
    value: { config: { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000 } },
  })
  const defaultSet = async (patch: Record<string, unknown>): Promise<RpcResult> => ({
    ok: true,
    value: { config: { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000, ...patch } },
  })
  const get = overrides.get ?? defaultGet
  const set = overrides.set ?? defaultSet
  return {
    call: vi.fn(async (channel: string, endpoint: string, payload: unknown) => {
      if (channel !== '/api') throw new Error(`unexpected channel ${channel}`)
      if (endpoint === 'interpreters/get') return get()
      if (endpoint === 'interpreters/set') {
        const args = (payload as { args: { patch: Record<string, unknown> } }).args
        return set(args.patch)
      }
      throw new Error(`unexpected endpoint ${endpoint}`)
    }) as ClientConnectionRpc['call'],
  }
}

describe('InterpretersCardController', () => {
  it('loads the resolved config on construction', async () => {
    const controller = new InterpretersCardController(rpcOf())
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.status).toBe('ready')
    expect(state.available).toBe(true)
    expect(state.writable).toBe(true)
    expect(state.draft.pythonPath).toBe('python')
    expect(state.draft.nodePath).toBe('node')
    expect(state.draft.timeoutMs).toBe(30000)
  })

  it('falls back to unavailable when the read fails', async () => {
    const controller = new InterpretersCardController(rpcOf({
      get: async () => ({ ok: false, error: { code: 'internal', message: 'unreachable', details: {} } }),
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.available).toBe(false)
    expect(state.writable).toBe(false)
  })

  it('falls back to unavailable when the RPC throws', async () => {
    const controller = new InterpretersCardController(rpcOf({
      get: async () => { throw new Error('network') },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.available).toBe(false)
    expect(state.writable).toBe(false)
  })

  it('stages edits and reports dirty', async () => {
    const controller = new InterpretersCardController(rpcOf())
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.edit('pythonPath', '/usr/bin/python3')
    const state = controller.store.getSnapshot()
    expect(state.dirty).toBe(true)
    expect(state.draft.pythonPath).toBe('/usr/bin/python3')
  })

  it('save writes the staged patch and clears drafts', async () => {
    const set = vi.fn(async (patch: Record<string, unknown>) => ({
      ok: true,
      value: { config: { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000, ...patch } },
    }))
    const controller = new InterpretersCardController(rpcOf({ set }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.edit('pythonPath', '/opt/python3.12')
    controller.save()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(set).toHaveBeenCalledWith({ pythonPath: '/opt/python3.12' })
    const state = controller.store.getSnapshot()
    expect(state.dirty).toBe(false)
    expect(state.draft.pythonPath).toBe('/opt/python3.12')
    expect(state.applyState.kind).toBe('saved')
  })

  it('marks save failed when the write rejects', async () => {
    const controller = new InterpretersCardController(rpcOf({
      set: async () => ({ ok: false, error: { code: 'internal', message: 'rejected', details: {} } }),
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.edit('nodePath', '/usr/bin/node')
    controller.save()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.applyState.kind).toBe('error')
    if (state.applyState.kind === 'error') {
      expect(state.applyState.message).toBe('rejected')
    }
    expect(state.dirty).toBe(true)
  })

  it('marks save failed when the RPC throws', async () => {
    const controller = new InterpretersCardController(rpcOf({
      set: async () => { throw new Error('network') },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.edit('nodePath', '/usr/bin/node')
    controller.save()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.applyState.kind).toBe('error')
  })

  it('discard re-seeds from the host', async () => {
    const controller = new InterpretersCardController(rpcOf())
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.edit('timeoutMs', '5000')
    controller.discard()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.dirty).toBe(false)
    expect(state.draft.timeoutMs).toBe(30000)
  })

  it('notifies subscribers on snapshot changes', async () => {
    const controller = new InterpretersCardController(rpcOf())
    const listener = vi.fn()
    const unsubscribe = controller.store.subscribe(listener)
    controller.edit('pythonPath', '/x')
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('sets loaded after a successful load', async () => {
    const controller = new InterpretersCardController(rpcOf())
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.loaded).toBe(true)
  })

  it('does not set loaded when the read fails', async () => {
    const controller = new InterpretersCardController(rpcOf({
      get: async () => { throw new Error('network') },
    }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.loaded).toBe(false)
  })
})
