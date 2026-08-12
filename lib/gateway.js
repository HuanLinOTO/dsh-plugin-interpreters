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
var __runInitializers = (this && this.__runInitializers) || function (thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
};
var __esDecorate = (this && this.__esDecorate) || function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access) context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0) continue;
            if (result === null || typeof result !== "object") throw new TypeError("Object expected");
            if (_ = accept(result.get)) descriptor.get = _;
            if (_ = accept(result.set)) descriptor.set = _;
            if (_ = accept(result.init)) initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field") initializers.unshift(_);
            else descriptor[key] = _;
        }
    }
    if (target) Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
};
import { GatewayService, Remote } from '@deepseek-ai/dsh-type-meta';
import { resolveConfig, } from './config.js';
import { SETTINGS_NAMESPACE, } from './settings.js';
/**
 * Host-side `interpreters` config gateway. typertGateway auto-discovers this
 * service via SRC marker scanning and claims the `/api/interpreters/get` and
 * `/api/interpreters/set` endpoints.
 */
let InterpretersConfigGateway = (() => {
    let _classSuper = GatewayService;
    let _instanceExtraInitializers = [];
    let _get_decorators;
    let _set_decorators;
    return class InterpretersConfigGateway extends _classSuper {
        static {
            const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
            _get_decorators = [Remote('get')];
            _set_decorators = [Remote('set')];
            __esDecorate(this, null, _get_decorators, { kind: "method", name: "get", static: false, private: false, access: { has: obj => "get" in obj, get: obj => obj.get }, metadata: _metadata }, null, _instanceExtraInitializers);
            __esDecorate(this, null, _set_decorators, { kind: "method", name: "set", static: false, private: false, access: { has: obj => "set" in obj, get: obj => obj.set }, metadata: _metadata }, null, _instanceExtraInitializers);
            if (_metadata) Object.defineProperty(this, Symbol.metadata, { enumerable: true, configurable: true, writable: true, value: _metadata });
        }
        bridge = __runInitializers(this, _instanceExtraInitializers);
        settings;
        constructor(ctx, bridge) {
            super(ctx, 'interpreters');
            this.bridge = bridge;
            // Conditional sub-fiber: when the settings service is absent, `set()`
            // throws a clear error and `get()` degrades to the entry source.
            ctx.inject(['settings'], (sctx) => {
                this.settings = sctx.settings;
                return () => { this.settings = undefined; };
            });
        }
        /** Read the current resolved config (schema defaults → entry base → user layer). */
        get() {
            return { config: resolveConfig(this.bridge.source()) };
        }
        /** Validate `patch` against the Config schema, then write the user layer. */
        async set(patch) {
            if (Object.keys(patch).length === 0)
                return { config: resolveConfig(this.bridge.source()) };
            const settings = this.settings;
            if (settings === undefined) {
                throw new Error('interpreters: settings service is unavailable — configuration cannot be written');
            }
            // JSON wire boundary: null is how third-party clients express "delete";
            // undefined never crosses JSON. Filter both, and constrain to the known
            // config keys so a malformed patch cannot inject arbitrary settings keys
            // (the settings service is non-strict and would otherwise store them).
            const allowed = new Set(['pythonPath', 'nodePath', 'timeoutMs']);
            const normalized = {};
            for (const [key, value] of Object.entries(patch)) {
                if (!allowed.has(key))
                    continue;
                if (value === null || value === undefined)
                    continue;
                // Light type guard: paths must be strings, timeout must be a finite number.
                if (key === 'timeoutMs') {
                    if (typeof value !== 'number' || !Number.isFinite(value))
                        continue;
                }
                else {
                    if (typeof value !== 'string')
                        continue;
                }
                normalized[key] = value;
            }
            if (Object.keys(normalized).length === 0)
                return { config: resolveConfig(this.bridge.source()) };
            await settings.update(SETTINGS_NAMESPACE, normalized);
            return { config: resolveConfig(this.bridge.source()) };
        }
    };
})();
export { InterpretersConfigGateway };
