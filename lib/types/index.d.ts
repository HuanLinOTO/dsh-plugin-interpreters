/**
 * index.ts — dsh-interpreters host plugin entry.
 *
 * Registers two model-facing tools (`run_python`, `run_node`) whose
 * descriptions embed the configured interpreter paths. The paths are
 * persisted through the settings seam under the `interpreters` namespace
 * in `$DSH_HOME/settings.yaml`; runtime edits dispose and re-register the
 * tools so the model immediately sees the updated path.
 *
 * Architecture:
 *   - Composition `Config` (cordis.yml) is the first-boot seed.
 *   - `ctx.settings` namespace `interpreters` is the user-editable layer;
 *     `scope.watch()` triggers re-registration on every committed change.
 *   - Headless assemblies without a settings provider fall back to the
 *     composition config (no persistence, no live reload).
 *
 * @module @dsh-external/dsh-interpreters
 */
import type { Context } from '@deepseek-ai/cordis';
import z from 'schemastery';
import { type ResolvedConfig } from './tools.js';
export declare const name = "dsh-interpreters";
export declare const inject: string[];
/** Settings namespace under which interpreter paths persist. */
export declare const SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export interface Config {
    pythonPath?: string;
    nodePath?: string;
    timeoutMs?: number;
}
export declare const Config: z<Config>;
/**
 * Resolve config with fallbacks for missing / invalid values.
 * @param config - raw config from cordis.yml or settings scope.
 * @returns a fully-populated {@link ResolvedConfig}.
 */
export declare function resolveConfig(config: Config): ResolvedConfig;
/**
 * Plugin body: register tools with the composition config, then swap to
 * settings-resolved config when the settings service is available.
 * @param ctx - host context carrying `tools`.
 * @param config - resolved composition config (seed).
 */
export declare function apply(ctx: Context, config?: Config): void;
