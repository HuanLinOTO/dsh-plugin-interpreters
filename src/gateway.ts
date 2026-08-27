/**
 * gateway.ts — host-side HTTP gateway exposing the `interpreters` config to
 * the browser through a self-hosted `/interpreters/api` route.
 *
 * The DSH typertGateway `/api` RPC dispatch was the original channel
 * (TypertRemoteService + @Remote), but the host's SRC discovery
 * (ctx.reflect.props enumeration) is not claiming plugin-owned service
 * endpoints on the current dsh snapshot. The self-hosted HTTP route
 * mirrors the better-sidebar pattern: `ctx.webServer.register` claims a
 * prefix route, the handler reads/writes the settings seam in-process
 * (no wire-layer allowlist gate), and the browser reaches it through
 * `fetch('/interpreters/api/<method>')`.
 *
 * Route shape:
 *   POST /interpreters/api/get  → { ok: true, value: { config: ResolvedConfig } }
 *   POST /interpreters/api/set  body: { patch: Partial<Config> }
 *                                → { ok: true, value: { config: ResolvedConfig } }
 * Errors carry { ok: false, error: { code, message } }.
 *
 * @module dsh-interpreters/gateway
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { SettingsProvider } from '@deepseek-ai/dsh-settings'
import {
  resolveConfig,
  type Config as ConfigType,
  type ResolvedConfig,
} from './config.js'
import {
  SETTINGS_NAMESPACE,
  type InterpretersSettingsBridge,
} from './settings.js'

/** HTTP route prefix owning every interpreters API request. */
const API_PREFIX = '/interpreters/api'

/** Config keys the `set` endpoint accepts (allow-list; unknown keys are dropped). */
const ALLOWED_KEYS: ReadonlySet<string> = new Set(['pythonPath', 'nodePath', 'timeoutMs'])

/** Wire view returned by both `get` and `set`: the fully-resolved config. */
export interface InterpretersConfigView {
  config: ResolvedConfig
}

/** Patch shape the `set` endpoint accepts (every field optional, null = clear). */
export type InterpretersConfigPatch = Partial<ConfigType>

/** Standard JSON response envelope. */
interface ApiEnvelope<T> {
  ok: boolean
  value?: T
  error?: { code: string; message: string }
}

/**
 * Register the `/interpreters/api` HTTP route on the host's web server.
 *
 * The route reads/writes the `interpreters` settings namespace in-process
 * through the bridge + `ctx.settings`. The settings service is optional:
 * when absent, `get` degrades to the entry source and `set` returns a
 * clear error.
 * @param ctx - host context carrying `webServer`.
 * @param bridge - the settings bridge the route reads through.
 */
export function registerHttpGateway(ctx: Context, bridge: InterpretersSettingsBridge): void {
  let settings: SettingsProvider | undefined
  ctx.inject(['settings'], (sctx) => {
    settings = sctx.settings
    return () => { settings = undefined }
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: API_PREFIX,
    handler: async (req: IncomingMessage, res: ServerResponse) => {
      if (req.method !== 'POST') {
        writeJson(res, 405, envelopeError('method-not-allowed', 'POST only'))
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://dsh.internal').pathname
      const method = pathname.startsWith(`${API_PREFIX}/`)
        ? pathname.slice(`${API_PREFIX}/`.length)
        : undefined
      if (method === undefined || method.includes('/')) {
        writeJson(res, 404, envelopeError('not-found', 'unknown interpreters API method'))
        return
      }
      try {
        const body = await readJsonBody(req)
        if (method === 'get') {
          const config = resolveConfig(bridge.source())
          writeJson(res, 200, envelopeOk({ config }))
        } else if (method === 'set') {
          const result = await handleSet(body, settings, bridge)
          writeJson(res, 200, envelopeOk(result))
        } else {
          writeJson(res, 404, envelopeError('not-found', `unknown interpreters API method "${method}"`))
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        writeJson(res, 500, envelopeError('internal', message))
      }
    },
  }), 'dsh-interpreters: /interpreters/api routes')
}

/**
 * Handle the `set` method: validate the patch, write the user layer, return
 * the new resolved config.
 * @param body - the parsed JSON body from the request.
 * @param settings - the live settings service (undefined when unavailable).
 * @param bridge - the settings bridge for reading the source.
 * @returns the new resolved config view.
 * @throws when the settings service is unavailable.
 */
export async function handleSet(
  body: unknown,
  settings: SettingsProvider | undefined,
  bridge: InterpretersSettingsBridge,
): Promise<InterpretersConfigView> {
  const patch = extractPatch(body)
  if (Object.keys(patch).length === 0) {
    return { config: resolveConfig(bridge.source()) }
  }
  if (settings === undefined) {
    throw new Error('interpreters: settings service is unavailable — configuration cannot be written')
  }
  await settings.update(SETTINGS_NAMESPACE, patch)
  return { config: resolveConfig(bridge.source()) }
}

/**
 * Extract and validate the patch from the request body.
 *
 * JSON wire boundary: null = "delete" (filtered), undefined never crosses
 * JSON. Unknown keys are dropped (the settings service is non-strict and
 * would otherwise store them). Light type guards constrain paths to
 * strings and timeout to a finite number.
 * @param body - the parsed JSON body.
 * @returns the normalized patch (only known, well-typed keys).
 */
export function extractPatch(body: unknown): Record<string, unknown> {
  if (!isObject(body)) return {}
  const raw = Reflect.get(body, 'patch')
  if (!isObject(raw)) return {}
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!ALLOWED_KEYS.has(key)) continue
    if (value === null || value === undefined) continue
    if (key === 'timeoutMs') {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue
    } else {
      if (typeof value !== 'string') continue
    }
    normalized[key] = value
  }
  return normalized
}

/** Read and parse a JSON body from a node:http request. */
async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text === '') return {}
  return JSON.parse(text) as unknown
}

/** Write a JSON response envelope. */
function writeJson(res: ServerResponse, status: number, body: ApiEnvelope<unknown>): void {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(json)
}

/** Build a success envelope. */
function envelopeOk<T>(value: T): ApiEnvelope<T> {
  return { ok: true, value }
}

/** Build an error envelope. */
function envelopeError(code: string, message: string): ApiEnvelope<never> {
  return { ok: false, error: { code, message } }
}

/** Narrow unknown to a non-null object. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
