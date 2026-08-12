/**
 * gateway.ts — host-side RPC gateway exposing the `interpreters` config to
 * the browser through DSH's typertGateway `/api` dispatch.
 *
 * The DSH settings RPC domain (api-proxy) only serves allowlisted namespaces
 * to configuration clients, and `interpreters` is not on that allowlist (it is
 * a plugin-owned namespace, not a host-plane one). The gateway bypasses the
 * wire-layer allowlist by living in the host process: typertGateway's
 * `/api/<service>/<method>` dispatch calls `set()` in-process, where
 * `ctx.settings.update(ns, patch)` has no allowlist gate.
 *
 * Service name `'interpreters'` (constructor second arg) = settings namespace
 * = RPC path segment, so the wire endpoints are `/api/interpreters/get` and
 * `/api/interpreters/set`.
 *
 * @module dsh-interpreters/gateway
 */
import type { Context } from '@deepseek-ai/cordis';
import { GatewayService } from '@deepseek-ai/dsh-type-meta';
import { type Config as ConfigType, type ResolvedConfig } from './config.js';
import { type InterpretersSettingsBridge } from './settings.js';
/** Patch shape the `set` RPC accepts (every field optional, null = clear). */
export type InterpretersConfigPatch = Partial<ConfigType>;
/** Wire view returned by both `get` and `set`: the fully-resolved config. */
export interface InterpretersConfigView {
    config: ResolvedConfig;
}
/**
 * Host-side `interpreters` config gateway. typertGateway auto-discovers this
 * service via SRC marker scanning and claims the `/api/interpreters/get` and
 * `/api/interpreters/set` endpoints.
 */
export declare class InterpretersConfigGateway extends GatewayService {
    private readonly bridge;
    private settings;
    constructor(ctx: Context, bridge: InterpretersSettingsBridge);
    /** Read the current resolved config (schema defaults → entry base → user layer). */
    get(): InterpretersConfigView;
    /** Validate `patch` against the Config schema, then write the user layer. */
    set(patch: InterpretersConfigPatch): Promise<InterpretersConfigView>;
}
