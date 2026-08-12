/**
 * settings.ts — host-side bridge between the `interpreters` settings namespace
 * and the plugin's other halves (tool registration + RPC gateway).
 *
 * The composition `Config` (cordis.patch.yml) is the first-boot seed; once the
 * `ctx.settings` service mounts, the user-editable layer takes over and live
 * re-registration follows every committed change. Headless assemblies without
 * a settings provider fall back to the composition config (no persistence, no
 * live reload).
 *
 * The bridge pattern mirrors `dsh-advisor/src/settings.ts`: a `source()` thunk
 * the gateway reads in-process, plus an `onChange()` subscription the host
 * entry uses to re-register the tools. This avoids any wire-layer allowlist
 * (the DSH settings RPC domain only serves a fixed namespace set to browser
 * configuration clients; the gateway bypasses it through `/api`).
 *
 * @module dsh-interpreters/settings
 */

import type { Context } from '@deepseek-ai/cordis'
import { settingsNamespace, type SettingsScope } from '@deepseek-ai/dsh-settings'
import { Config, type Config as ConfigType } from './config.js'

/** Settings namespace under which interpreter paths persist. */
export const SETTINGS_NAMESPACE = settingsNamespace('interpreters')

/**
 * Mirror of the dsh-settings internal `isUnloading` guard. The cordis const
 * enum for fiber state is erased at compile time, so the literal states are
 * matched numerically: 4 = DISPOSED, 5 = UNLOADING.
 */
function isUnloading(ctx: Context): boolean {
  const state = (ctx as unknown as { fiber?: { state?: number } }).fiber?.state
  return state === 4 || state === 5
}

/** Read face the gateway and tool re-registration consume. */
export interface InterpretersSettingsBridge {
  /** The current resolved config (composition seed while settings is absent). */
  source(): ConfigType
  /** Observe committed changes to the resolved config. */
  onChange(callback: () => void): void
}

/**
 * Install the `interpreters` settings namespace and return the bridge.
 *
 * The settings service is reached through `ctx.inject(['settings'], ...)` so a
 * composition without a settings provider still loads the plugin (entry-source
 * fallback, no persistence). Multi-fiber dedupe is handled by catching the
 * `"already registered"` rejection — host composition may mount several
 * concurrent fibers of this plugin, and only the first registration owns the
 * namespace.
 * @param ctx - host context.
 * @param entry - composition-layer config (cordis.patch.yml seed).
 * @returns the bridge the gateway and tool re-registration consume.
 */
export function installInterpretersSettings(ctx: Context, entry: ConfigType): InterpretersSettingsBridge {
  const listeners = new Set<() => void>()
  let source = (): ConfigType => entry
  const notify = (): void => {
    for (const listener of [...listeners]) listener()
  }

  ctx.inject(['settings'], (sctx) => {
    let scope: SettingsScope<ConfigType> | undefined
    try {
      scope = sctx.settings.register(SETTINGS_NAMESPACE, Config, { base: entry as never })
    } catch (error) {
      // Multi-fiber dedupe: the first registration owns the namespace; later
      // fibers stay on the entry source and emit no notifications of their own.
      if (!(error instanceof Error) || !error.message.includes('already registered')) throw error
      ctx.logger('dsh-interpreters').debug('settings namespace already registered — entry-source fallback')
      return
    }
    source = () => scope!.get()
    sctx.effect(() => () => {
      if (isUnloading(ctx)) return
      source = () => entry
      notify()
    })
    notify()
    scope.watch(() => {
      if (isUnloading(ctx)) return
      notify()
    })
  })

  return {
    source: () => source(),
    onChange: (cb) => { listeners.add(cb) },
  }
}
