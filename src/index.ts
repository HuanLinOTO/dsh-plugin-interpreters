/**
 * index.ts — dsh-interpreters host plugin entry.
 *
 * Registers two model-facing tools (`run_python`, `run_node`) whose
 * descriptions embed the configured interpreter paths. The paths persist
 * through the settings seam under the `interpreters` namespace in
 * `$DSH_HOME/settings.yaml`; runtime edits dispose and re-register the tools
 * so the model immediately sees the updated path. The browser reaches the
 * same namespace through a `GatewayService` RPC (the DSH settings RPC domain
 * only serves allowlisted namespaces to configuration clients, so this plugin
 * exposes `/api/interpreters/get|set` through the host's typertGateway
 * instead, which bypasses the wire-layer allowlist by calling the settings
 * seam in-process).
 *
 * Architecture:
 *   - `installInterpretersSettings` registers the namespace and exposes a
 *     `source()` thunk + `onChange()` subscription.
 *   - `InterpretersConfigGateway` claims `/api/interpreters/get|set` and
 *     reads/writes through the bridge + `ctx.settings` in-process.
 *   - The tool registration is re-run on every `bridge.onChange` notification
 *     so the model-visible description tracks the live interpreter path.
 *   - Headless assemblies without a settings provider fall back to the
 *     composition config (no persistence, no live reload, gateway `set()`
 *     throws a clear "settings service unavailable" error).
 *
 * @module @dsh-external/dsh-interpreters
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-tools'
import { type Config, resolveConfig } from './config.js'
import { InterpretersConfigGateway } from './gateway.js'
import { installInterpretersSettings } from './settings.js'
import { registerTools } from './tools.js'

export { Config, resolveConfig, type ResolvedConfig } from './config.js'
export { InterpretersConfigGateway, type InterpretersConfigPatch, type InterpretersConfigView } from './gateway.js'
export { SETTINGS_NAMESPACE, type InterpretersSettingsBridge } from './settings.js'

export const name = 'dsh-interpreters'
export const inject = ['tools']

/**
 * Plugin body: register tools with the composition config, then swap to
 * settings-resolved config when the settings service mounts, and expose the
 * config through a `/api/interpreters/get|set` gateway.
 * @param ctx - host context carrying `tools`.
 * @param config - resolved composition config (seed).
 */
export function apply(ctx: Context, config: Config = {} as Config): void {
  ctx.logger('dsh-interpreters').info('apply() called, config=', JSON.stringify(config))
  const bridge = installInterpretersSettings(ctx, config)

  let disposeTools = registerTools(ctx, resolveConfig(bridge.source()))

  // Live re-register on every committed settings change so the model-visible
  // tool description tracks the live interpreter path.
  bridge.onChange(() => {
    disposeTools?.()
    disposeTools = registerTools(ctx, resolveConfig(bridge.source()))
  })

  // Register the gateway; typertGateway SRC discovery claims `/api/interpreters/*`.
  // Multi-fiber dedupe: cordis Service construction throws `"has been registered"`
  // when a second fiber of this plugin tries to claim the same service key.
  try {
    new InterpretersConfigGateway(ctx, bridge)
    ctx.logger('dsh-interpreters').info('gateway registered successfully')
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('has been registered')) throw error
    ctx.logger('dsh-interpreters').debug('gateway already registered — multi-fiber dedupe')
  }

  ctx.effect(() => () => { disposeTools?.() }, 'dsh-interpreters: cleanup')
}
