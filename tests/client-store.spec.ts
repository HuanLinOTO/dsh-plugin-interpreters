/**
 * client-store.spec.ts — unit tests for the interpreters card store.
 *
 * The store reaches the host through `fetch('/interpreters/api/get|set')`
 * (self-hosted HTTP route), not the typertGateway RPC dispatch. Tests mock
 * `globalThis.fetch` to control the responses.
 *
 * @module dsh-interpreters/tests/client-store
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { InterpretersCardController } from '../src/client/store.ts'

/** Build a mock fetch response with a JSON body. */
function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response
}

/** Build a mock fetch handler with controllable `get` and `set` responses. */
function fetchOf(overrides: {
  get?: () => Response | Promise<Response>
  set?: (patch: Record<string, unknown>) => Response | Promise<Response>
} = {}): ReturnType<typeof vi.fn> {
  const defaultGet = (): Response => jsonResponse({
    ok: true,
    value: { config: { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000 } },
  })
  const defaultSet = (patch: Record<string, unknown>): Response => jsonResponse({
    ok: true,
    value: { config: { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000, ...patch } },
  })
  const get = overrides.get ?? defaultGet
  const set = overrides.set ?? defaultSet
  return vi.fn(async (url: string, init: RequestInit) => {
    if (url === '/interpreters/api/get') return get()
    if (url === '/interpreters/api/set') {
      const body = JSON.parse(init.body as string) as { patch: Record<string, unknown> }
      return set(body.patch)
    }
    throw new Error(`unexpected fetch URL ${url}`)
  })
}

describe('InterpretersCardController', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('loads the resolved config on construction', async () => {
    globalThis.fetch = fetchOf() as never
    const controller = new InterpretersCardController()
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
    globalThis.fetch = fetchOf({
      get: () => jsonResponse({ ok: false, error: { code: 'internal', message: 'unreachable' } }, false),
    }) as never
    const controller = new InterpretersCardController()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.available).toBe(false)
    expect(state.writable).toBe(false)
  })

  it('falls back to unavailable when fetch throws', async () => {
    globalThis.fetch = fetchOf({
      get: () => { throw new Error('network') },
    }) as never
    const controller = new InterpretersCardController()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.available).toBe(false)
    expect(state.writable).toBe(false)
  })

  it('stages edits and reports dirty', async () => {
    globalThis.fetch = fetchOf() as never
    const controller = new InterpretersCardController()
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.edit('pythonPath', '/usr/bin/python3')
    const state = controller.store.getSnapshot()
    expect(state.dirty).toBe(true)
    expect(state.draft.pythonPath).toBe('/usr/bin/python3')
  })

  it('save writes the staged patch and clears drafts', async () => {
    const set = vi.fn(async (patch: Record<string, unknown>) => jsonResponse({
      ok: true,
      value: { config: { pythonPath: 'python', nodePath: 'node', timeoutMs: 30000, ...patch } },
    }))
    globalThis.fetch = fetchOf({ set }) as never
    const controller = new InterpretersCardController()
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
    globalThis.fetch = fetchOf({
      set: () => jsonResponse({ ok: false, error: { code: 'internal', message: 'rejected' } }, false),
    }) as never
    const controller = new InterpretersCardController()
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

  it('marks save failed when fetch throws', async () => {
    globalThis.fetch = fetchOf({
      set: () => { throw new Error('network') },
    }) as never
    const controller = new InterpretersCardController()
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.edit('nodePath', '/usr/bin/node')
    controller.save()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.applyState.kind).toBe('error')
  })

  it('discard re-seeds from the host', async () => {
    globalThis.fetch = fetchOf() as never
    const controller = new InterpretersCardController()
    await new Promise((resolve) => setTimeout(resolve, 0))
    controller.edit('timeoutMs', '5000')
    controller.discard()
    await new Promise((resolve) => setTimeout(resolve, 0))
    const state = controller.store.getSnapshot()
    expect(state.dirty).toBe(false)
    expect(state.draft.timeoutMs).toBe(30000)
  })

  it('notifies subscribers on snapshot changes', async () => {
    globalThis.fetch = fetchOf() as never
    const controller = new InterpretersCardController()
    const listener = vi.fn()
    const unsubscribe = controller.store.subscribe(listener)
    controller.edit('pythonPath', '/x')
    expect(listener).toHaveBeenCalled()
    unsubscribe()
  })

  it('sets loaded after a successful load', async () => {
    globalThis.fetch = fetchOf() as never
    const controller = new InterpretersCardController()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.loaded).toBe(true)
  })

  it('does not set loaded when the read fails', async () => {
    globalThis.fetch = fetchOf({
      get: () => { throw new Error('network') },
    }) as never
    const controller = new InterpretersCardController()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(controller.loaded).toBe(false)
  })
})
