/**
 * store.ts — the interpreters card's staged form over the
 * `/api/interpreters/get|set` RPC gateway.
 *
 * The DSH settings RPC domain only serves allowlisted namespaces to
 * configuration clients, so this store reads and writes the `interpreters`
 * namespace through the host's typertGateway dispatch
 * (`connection.rpc.call('/api', 'interpreters/get'|'set', { args: {...} })`)
 * instead of a settingsScope. State publishes through a `SnapshotStore` so the
 * card binds a selector hook via `bindSnapshotSelector`; the store tracks load
 * status, the staged draft, and the apply lifecycle (idle/saving/saved/error).
 *
 * @module dsh-interpreters/client/store
 */

import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-runtime/client'

/** The persisted shape of the `interpreters` namespace. */
export interface InterpretersSettings {
  pythonPath?: string
  nodePath?: string
  timeoutMs?: number
}

/** Apply lifecycle states (mirrors advisor-store's ApplyState shape). */
export type ApplyState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string }

/** Card state published through the snapshot store. */
export interface InterpretersCardState {
  /** 'idle' before the first load fires; 'loading' while in flight; 'ready' once seeded. */
  status: 'idle' | 'loading' | 'ready'
  /** False until the first successful load gates `connection/reset` refreshes. */
  loaded: boolean
  /** False while the namespace is not served to this client; the card renders the unavailable notice. */
  available: boolean
  /** Whether the Host document accepts writes. */
  writable: boolean
  /** Staged draft (last-known host config + local edits). */
  draft: InterpretersSettings
  /** Whether the form holds edits that a save would write. */
  dirty: boolean
  /** Apply lifecycle. */
  applyState: ApplyState
}

/** Initial empty state. */
function initialState(): InterpretersCardState {
  return {
    status: 'idle',
    loaded: false,
    available: false,
    writable: false,
    draft: {},
    dirty: false,
    applyState: { kind: 'idle' },
  }
}

/** Wire view returned by `/api/interpreters/get|set`. */
interface InterpretersConfigView {
  config: InterpretersSettings
}

/** A number field renders empty when the section carries none. */
function formatNumber(value: unknown): string {
  return typeof value === 'number' ? String(value) : ''
}

/** A text field renders the empty string when absent. */
function formatText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * The card's staged form over the interpreters settings.
 *
 * The store publishes through a `SnapshotStore` because slot components read
 * through a snapshot selector; both the gateway read and the local drafts
 * change underneath, and every projection is rebuilt from the two together.
 */
export class InterpretersCardController {
  readonly store: SnapshotStore<InterpretersCardState>
  /** True after the first successful load; gates `connection/reset` refreshes. */
  loaded = false
  private generation = 0
  private staged = new Map<keyof InterpretersSettings, string>()

  /**
   * @param rpc - the connection's generic RPC caller.
   */
  constructor(private readonly rpc: ClientConnectionRpc) {
    this.store = createSnapshotStore<InterpretersCardState>(initialState())
    void this.load()
  }

  /**
   * Read the resolved config from the Host gateway and publish it.
   * @returns settlement after the read.
   */
  async load(): Promise<void> {
    const gen = ++this.generation
    this.store.update((s) => { s.status = 'loading' })

    let config: InterpretersSettings | undefined
    try {
      const result = await this.rpc.call('/api', 'interpreters/get', { args: {} })
      if (result.ok) {
        config = (result.value as InterpretersConfigView).config
      }
    } catch {
      // Channel unreachable: leave the card unavailable; not a hard error.
    }
    if (gen !== this.generation) return

    if (config === undefined) {
      this.store.update((s) => {
        s.status = 'ready'
        s.available = false
        s.writable = false
      })
      return
    }
    this.loaded = true
    this.staged.clear()
    this.store.update((s) => {
      s.status = 'ready'
      s.available = true
      s.writable = true
      s.draft = { ...config }
      s.dirty = false
      s.applyState = { kind: 'idle' }
    })
  }

  /** Stage draft text for one field. */
  edit(field: keyof InterpretersSettings, text: string): void {
    this.staged.set(field, text)
    this.store.update((s) => {
      s.draft = { ...s.draft, [field]: text }
      s.dirty = true
      s.applyState = { kind: 'idle' }
    })
  }

  /** Drop every staged edit. */
  discard(): void {
    if (this.staged.size === 0) {
      this.store.update((s) => { s.applyState = { kind: 'idle' } })
      return
    }
    this.staged.clear()
    // Re-seed draft from the last-known host config (drop local edits).
    void this.load()
  }

  /** Write every staged edit, then re-seed from what the Host accepted. */
  save(): void {
    void this.doSave()
  }

  private async doSave(): Promise<void> {
    const gen = ++this.generation
    const patch = this.patchOf()
    if (Object.keys(patch).length === 0) {
      this.staged.clear()
      this.store.update((s) => { s.dirty = false; s.applyState = { kind: 'idle' } })
      return
    }
    this.store.update((s) => { s.applyState = { kind: 'saving' } })
    try {
      const result = await this.rpc.call('/api', 'interpreters/set', { args: { patch } })
      if (gen !== this.generation) return
      if (!result.ok) {
        this.store.update((s) => { s.applyState = { kind: 'error', message: result.error.message } })
        return
      }
      const next = (result.value as InterpretersConfigView).config
      this.staged.clear()
      this.store.update((s) => {
        s.draft = { ...next }
        s.dirty = false
        s.applyState = { kind: 'saved' }
      })
    } catch (error) {
      if (gen !== this.generation) return
      this.store.update((s) => {
        s.applyState = { kind: 'error', message: error instanceof Error ? error.message : String(error) }
      })
    }
  }

  /** The staged edits as one patch (only changed fields). */
  private patchOf(): Record<string, unknown> {
    const patch: Record<string, unknown> = {}
    for (const [field, text] of this.staged) {
      const value = parseField(field, text)
      if (value === undefined) continue
      patch[field] = value
    }
    return patch
  }
}

/** Parse one field's draft text into a stored value; the empty string clears. */
function parseField(field: keyof InterpretersSettings, text: string): unknown | undefined {
  const trimmed = text.trim()
  if (trimmed === '') return ''
  if (field === 'timeoutMs') {
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return trimmed
}

/** Refresh the store only after its first load (background invalidation gate). */
export function refreshIfLoaded(controller: InterpretersCardController): void {
  if (controller.loaded) void controller.load()
}

/** Format helpers exposed for the card component. */
export const formatFieldText = formatText
export const formatFieldNumber = formatNumber
