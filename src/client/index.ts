/**
 * dsh-interpreters — browser half.
 *
 * Registers the `interpreters` card into the shell-declared
 * `settings.plugin.item` slot (the plugin-config settings page — id
 * `dsh-interpreters`, order 50, after the upstream bash / agent-loop /
 * web-search cards). The card's store reads/writes the `interpreters` config
 * through the host gateway `/api/interpreters/get|set` RPC channel, and keeps
 * fresh on pushed invalidations.
 *
 * Export discipline: the client half value-imports ONLY the frozen platform
 * module table (CLIENT_EXTERNALS); every other `@deepseek-ai/*` import is
 * type-only (erased at build) — values arrive via cordis injection
 * (`ctx.get('connection')`, slot inject faces).
 *
 * @module @huanlin/dsh-plugin-interpreters/client
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the client connection Context merge (ctx.connection) and
// the `connection/reset` event type (used for pushed invalidations).
import type {} from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the `settings.plugin.item` SlotMap entry so this plugin's
// `slots.inject` matches the section's slot declaration. Cross-plugin
// collaboration goes through the service, never a value import (client bundle
// purity gate).
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'
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

/** Required services (cordis fiber inject). The target slot is declared by
 *  ui-plugin-config's apply, whose activation order relative to this one is
 *  NOT constrained; registration depends on the slot through `slots.inject()`. */
export const inject = ['slots', 'locale', 'connection']

/**
 * Register the interpreters card once the `settings.plugin.item` declaration
 * is on the ledger, wire its store to the connection, and keep it fresh on
 * every pushed invalidation.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-interpreters: dictionaries')

  // Opt-in third-language overrides through @huanlin/dsh-plugin-better-locale:
  // when installed it publishes `ctx.betterLocale` (the override store) and
  // patches LocaleRuntime.lookup to consult it. `ctx.get` is a non-reactive
  // read of an optional service, so an absent plugin is a plain no-op.
  const betterLocale = ctx.get('betterLocale') as
    | { register(ns: string, dicts: Record<string, Record<string, string>>): () => void }
    | undefined
  if (betterLocale) {
    ctx.effect(
      () => betterLocale.register(NS, dicts),
      'interpreters: better-locale override dicts',
    )
  }

  // The store reads/writes the interpreters config over the plugin's
  // self-hosted HTTP route (`/interpreters/api/get` + `/interpreters/api/set`).
  const controller = new InterpretersCardController()
  const useSnapshot = bindSnapshotSelector(controller.store)

  // Pushed invalidations converge the open surface without polling. The dsh
  // snapshot removed the `settings/changed` host passthrough from the client
  // runtime Events vocabulary, so convergence rides `connection/reset` — a
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

  // The card registers into the plugin-config page's card slot with the
  // upstream card shape — generator + `yield`, `locale: NS`, and an inject
  // face carrying ONLY the business surface (controller + useSnapshot). The
  // typed `t` seat is synthesized by the renderer from `locale: NS`.
  ctx.slots.inject('settings.plugin.item', function* () {
    yield ctx.slots.register({
      name: 'settings.plugin.item',
      key: NS,
      locale: NS,
      inject: () => ({ controller, useSnapshot }),
    }, InterpretersCard)
  })
}
