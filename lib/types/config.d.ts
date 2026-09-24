/**
 * config.ts — composition-layer schema, resolved config shape, and resolver.
 *
 * The composition `Config` (cordis.patch.yml) is the first-boot seed; the
 * settings user layer composes on top of it at runtime. `resolveConfig`
 * normalises any combination of partial source values (composition, user
 * layer, or both) into a fully-populated {@link ResolvedConfig} the tool
 * registration and gateway can consume.
 *
 * @module dsh-interpreters/config
 */
import z from '@deepseek-ai/schemastery';
import type { Volatile } from '@deepseek-ai/cordis';
/** Composition + user-layer config shape (all fields optional at the boundary). */
export interface Config {
    pythonPath?: string;
    nodePath?: string;
    timeoutMs?: number;
}
/**
 * Volatile Cordis config the loader passes to `apply`. Each editable field is
 * a stable reference whose `.get()` returns the latest accepted value; the
 * profile-owned form enumerates exactly these fields (`.volatile()`).
 */
export interface InterpretersEntryConfig {
    pythonPath: Volatile<string>;
    nodePath: Volatile<string>;
    timeoutMs: Volatile<number>;
}
/** Fully-resolved config with fallbacks applied; what the tools and gateway serve. */
export interface ResolvedConfig {
    pythonPath: string;
    nodePath: string;
    timeoutMs: number;
}
/** Schemastery schema for the composition entry (live-editable via `.volatile()`). */
export declare const Config: z<InterpretersEntryConfig>;
/**
 * Resolve config with fallbacks for missing / invalid values.
 * @param config - raw config from cordis.yml or settings scope.
 * @returns a fully-populated {@link ResolvedConfig}.
 */
export declare function resolveConfig(config: Config): ResolvedConfig;
