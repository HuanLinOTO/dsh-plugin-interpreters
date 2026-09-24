/**
 * index.ts — dsh-interpreters host plugin entry.
 *
 * Registers two model-facing tools (`run_python`, `run_node`) whose
 * descriptions embed the configured interpreter paths. The paths persist
 * through the settings seam under the `interpreters` namespace in
 * `$DSH_HOME/settings.yaml`; runtime edits dispose and re-register the tools
 * so the model immediately sees the updated path. The browser reaches the
 * same namespace through a self-hosted `/interpreters/api` HTTP route
 * (the DSH settings RPC domain only serves allowlisted namespaces to
 * configuration clients, so this plugin exposes its own route through
 * `ctx.webServer.register`, bypassing the wire-layer allowlist by calling
 * the settings seam in-process).
 *
 * Architecture:
 *   - `installInterpretersSettings` registers the namespace and exposes a
 *     `source()` thunk + `onChange()` subscription.
 *   - `registerHttpGateway` claims `/interpreters/api/get|set` and
 *     reads/writes through the bridge + `ctx.settings` in-process.
 *   - The tool registration is re-run on every `bridge.onChange` notification
 *     so the model-visible description tracks the live interpreter path.
 *   - Headless assemblies without a settings provider fall back to the
 *     composition config (no persistence, no live reload, the `set`
 *     endpoint returns a clear "settings service unavailable" error).
 *
 * @module @huanlin/dsh-plugin-interpreters
 */
import { registerHttpGateway } from './gateway.js';
import { installInterpretersSettings } from './settings.js';
import { registerTools } from './tools.js';
export { Config, resolveConfig } from './config.js';
export { registerHttpGateway } from './gateway.js';
export { SETTINGS_NAMESPACE } from './settings.js';
export const name = 'dsh-interpreters';
export const inject = ['tools', 'webServer'];
/**
 * Plugin body: register the tools against the live config, then expose the
 * config through a `/interpreters/api/get|set` HTTP route.
 *
 * The tools are registered once, reading the entry's volatile config at
 * execution time, so a live path edit reaches the next run without a remount.
 * `Write` edits go through `ctx.settings.update(entryId, patch)`, persisting in
 * the active profile's `cordis.patch.yml`.
 * @param ctx - host context carrying `tools` and `webServer`.
 * @param config - the entry's volatile Cordis config.
 */
export function apply(ctx, config = {}) {
    ctx.logger('dsh-interpreters').info('apply() called');
    const bridge = installInterpretersSettings(ctx, config);
    const disposeTools = registerTools(ctx, () => bridge.source());
    // Register the HTTP gateway; the /interpreters/api route claims get/set.
    registerHttpGateway(ctx, bridge);
    ctx.logger('dsh-interpreters').info('http gateway registered at /interpreters/api');
    ctx.effect(() => () => { disposeTools?.(); }, 'dsh-interpreters: cleanup');
}
