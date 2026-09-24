/**
 * dsh-interpreters — browser half.
 *
 * Registers the `interpreters` card into the Plugins-page-declared
 * `plugins.row.config` slot (key
 * `@huanlin/dsh-plugin-interpreters#dsh-interpreters`). The card's store
 * reads/writes the `interpreters` config through the host gateway
 * `/interpreters/api/get|set` RPC channel, and keeps fresh on pushed
 * invalidations.
 *
 * Export discipline: the client half value-imports ONLY the frozen platform
 * module table (CLIENT_EXTERNALS); every other `@deepseek-ai/*` import is
 * type-only (erased at build) — values arrive via cordis injection
 * (`ctx.get('connection')`, slot inject faces).
 *
 * @module @huanlin/dsh-plugin-interpreters/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the client connection Context merge (ctx.connection) and
// the `connection/reset` event type (used for pushed invalidations).
import type {} from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the ui-renderer's Context merge (ctx.slots, the SlotRegistry
// the apply body registers through).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the `plugins.row.config` SlotMap entry (via the
// ui-plugin-manager contract) so this plugin's `slots.inject` matches the
// Plugins page's slot declaration. Cross-plugin collaboration goes through
// the service, never a value import (client bundle purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { bindSnapshotSelector } from './bindSnapshotSelector.ts'
import { InterpretersCard } from './InterpretersCard.tsx'
import { InterpretersCardController, refreshIfLoaded } from './store.ts'
import { en, NS, zh, type InterpretersKey } from './locales.ts'
import { dicts } from './dictionaries.ts'

export type { InterpretersCardInjected, InterpretersCardProps } from './InterpretersCard.tsx'
export type { InterpretersKey } from './locales.ts'
export type { InterpretersCardState, InterpretersCardController } from './store.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The interpreters card copy. */
    'interpreters': InterpretersKey
  }
}

/**
 * Composition row id: the `id` of the row in `cordis.patch.yml`, identical to
 * the host half's plugin `name` (`src/index.ts` exports
 * `name = 'dsh-interpreters'`) — the Plugins page keys a row's configuration
 * by exactly this id (`rowConfigKey(bundle, rowId)`), so the key below and
 * the patch row id must stay derived from this one constant.
 */
const ENTRY_ID = 'dsh-interpreters'

/** `plugins.row.config` key: the bundle's package name `#` the row id. */
const ROW_KEY = `@huanlin/dsh-plugin-interpreters#${ENTRY_ID}`

/** Required services (cordis fiber inject). The target slot is declared by
 *  ui-plugin-config's apply, whose activation order relative to this one is
 *  NOT constrained; registration depends on the slot through `slots.inject()`. */
export const inject = ['slots', 'locale', 'connection']

/**
 * Register the interpreters card once the Plugins page's row-config
 * declaration is on the ledger, wire its store to the connection, and keep
 * it fresh on every pushed invalidation.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-interpreters: dictionaries')

  // Opt-in third-language overrides through @huanlin/dsh-plugin-better-locale.
  // Activation-order-safe: ctx.get('betterLocale') is a non-reactive read, so
  // if better-locale activates after us, the initial read returns undefined.
  // We subscribe to ctx.locale — better-locale bumps its revision on activation
  // (persisted override) and on every override switch — and re-check on each bump.
  ctx.effect(() => {
    let dispose: (() => void) | undefined
    const sync = (): void => {
      dispose?.()
      dispose = undefined
      const store = ctx.get('betterLocale') as
        | { register(ns: string, dicts: Record<string, Record<string, string>>): () => void }
        | undefined
      if (store !== undefined) {
        dispose = store.register(NS, dicts)
      }
    }
    sync()
    const unsubscribe = ctx.locale.subscribe(sync)
    return () => {
      unsubscribe()
      dispose?.()
    }
  }, 'interpreters: better-locale override dicts')

  // The store reads/writes the interpreters config over the plugin's
  // self-hosted HTTP route (`/interpreters/api/get` + `/interpreters/api/set`).
  const controller = new InterpretersCardController()
  const useSnapshot = bindSnapshotSelector(controller.store)

  // Pushed invalidations converge the open surface without polling. The dsh
  // client Events vocabulary has no `settings/changed` host passthrough, so
  // convergence rides `connection/reset` — a
  // connection reset invalidates the whole client state. A burst of resets
  // coalesces into a single refetch via the microtask debounce, and
  // `refreshIfLoaded` keeps an unopened card idle.
  ctx.effect(() => {
    let pending = false
    const refresh = (): void => {
      if (pending) return
      pending = true
      queueMicrotask(() => {
        pending = false
        refreshIfLoaded(controller)
      })
    }
    const disposers = [ctx.on('connection/reset', refresh)]
    return () => { for (const dispose of disposers) dispose() }
  }, 'dsh-interpreters: pushed invalidations')

  // The card registers into the Plugins page's row-config slot, keyed by
  // `<bundle package>#<row id>` (the bundle's patch declares row
  // `dsh-interpreters` — ENTRY_ID, same as the host `name`). The rc.2
  // plugin-config slot is retired in rc.1. The inject face carries ONLY the
  // business surface (controller + useSnapshot); the typed `t` seat is
  // synthesized by the renderer from `locale: NS`.
  ctx.slots.inject('plugins.row.config', function* () {
    yield ctx.slots.register({
      name: 'plugins.row.config',
      key: ROW_KEY,
      locale: NS,
      inject: () => ({ controller, useSnapshot }),
    }, InterpretersCard)
  })
}
