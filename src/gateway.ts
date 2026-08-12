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

import type { Context } from '@deepseek-ai/cordis'
import type { Settings } from '@deepseek-ai/dsh-settings'
import { GatewayService, Remote } from '@deepseek-ai/dsh-type-meta'
import {
  resolveConfig,
  type Config as ConfigType,
  type ResolvedConfig,
} from './config.js'
import {
  SETTINGS_NAMESPACE,
  type InterpretersSettingsBridge,
} from './settings.js'

/** Patch shape the `set` RPC accepts (every field optional, null = clear). */
export type InterpretersConfigPatch = Partial<ConfigType>

/** Wire view returned by both `get` and `set`: the fully-resolved config. */
export interface InterpretersConfigView {
  config: ResolvedConfig
}

/**
 * Host-side `interpreters` config gateway. typertGateway auto-discovers this
 * service via SRC marker scanning and claims the `/api/interpreters/get` and
 * `/api/interpreters/set` endpoints.
 */
export class InterpretersConfigGateway extends GatewayService {
  private readonly bridge: InterpretersSettingsBridge
  private settings: Settings | undefined

  constructor(ctx: Context, bridge: InterpretersSettingsBridge) {
    super(ctx, 'interpreters')
    this.bridge = bridge
    // Conditional sub-fiber: when the settings service is absent, `set()`
    // throws a clear error and `get()` degrades to the entry source.
    ctx.inject(['settings'], (sctx) => {
      this.settings = sctx.settings
      return () => { this.settings = undefined }
    })
  }

  /** Read the current resolved config (schema defaults → entry base → user layer). */
  @Remote('get')
  get(): InterpretersConfigView {
    return { config: resolveConfig(this.bridge.source()) }
  }

  /** Validate `patch` against the Config schema, then write the user layer. */
  @Remote('set')
  async set(patch: InterpretersConfigPatch): Promise<InterpretersConfigView> {
    if (Object.keys(patch).length === 0) return { config: resolveConfig(this.bridge.source()) }

    const settings = this.settings
    if (settings === undefined) {
      throw new Error('interpreters: settings service is unavailable — configuration cannot be written')
    }

    // JSON wire boundary: null is how third-party clients express "delete";
    // undefined never crosses JSON. Filter both, and constrain to the known
    // config keys so a malformed patch cannot inject arbitrary settings keys
    // (the settings service is non-strict and would otherwise store them).
    const allowed: ReadonlySet<string> = new Set(['pythonPath', 'nodePath', 'timeoutMs'])
    const normalized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(patch)) {
      if (!allowed.has(key)) continue
      if (value === null || value === undefined) continue
      // Light type guard: paths must be strings, timeout must be a finite number.
      if (key === 'timeoutMs') {
        if (typeof value !== 'number' || !Number.isFinite(value)) continue
      } else {
        if (typeof value !== 'string') continue
      }
      normalized[key] = value
    }
    if (Object.keys(normalized).length === 0) return { config: resolveConfig(this.bridge.source()) }

    await settings.update(SETTINGS_NAMESPACE, normalized)
    return { config: resolveConfig(this.bridge.source()) }
  }
}
