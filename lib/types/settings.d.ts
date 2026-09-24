/**
 * settings.ts — host-side bridge between the `interpreters` config and the
 * plugin's other halves (tool registration + RPC gateway).
 *
 * dsh 0.1.7-rc.1 moved plugin configuration into the profile-owned Cordis
 * `Config`: the fields are marked `.volatile()` (see `config.ts`), so the
 * loader commits live references without remounting. The namespace-registration API
 * is gone; a plugin only declares the presentation policy for its own page.
 *
 * The bridge exposes a `source()` thunk the gateway and tool registration read
 * in-process. Each call reads the current volatile reference, so the tool's
 * execution and the gateway always see the latest accepted value. The value
 * persists in the active profile's `cordis.patch.yml` under the entry's
 * `config` (the entry id is the composition row id declared in
 * `cordis.patch.yml`).
 *
 * @module dsh-interpreters/settings
 */
import type { Context } from '@deepseek-ai/cordis';
import { type InterpretersEntryConfig, type ResolvedConfig } from './config.js';
/** The composition row id: the settings namespace / profile entry id. */
export declare const SETTINGS_NAMESPACE: "interpreters";
/** Read face the gateway and tool re-registration consume. */
export interface InterpretersSettingsBridge {
    /** The current resolved config from the entry's volatile references. */
    source(): ResolvedConfig;
}
/**
 * Declare the plugin's settings presentation policy and return the bridge.
 *
 * `auto: false` suppresses a schema-generated page: this plugin ships its own
 * form through the `plugins.row.config` slot on the Plugins page.
 * @param ctx - host context.
 * @param config - the entry's volatile Cordis config.
 * @returns the bridge the gateway and tool registration consume.
 */
export declare function installInterpretersSettings(ctx: Context, config: InterpretersEntryConfig): InterpretersSettingsBridge;
