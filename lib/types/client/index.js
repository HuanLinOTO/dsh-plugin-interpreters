/**
 * dsh-interpreters — browser half.
 *
 * Registers the `interpreters` card into the Plugins-page-declared
 * `plugins.row.config` slot (key
 * `@huanlin/dsh-plugin-interpreters#interpreters`). The card's store
 * reads/writes the `interpreters` config through the host gateway
 * `/interpreters/api/get|set` RPC channel, and keeps fresh on pushed
 * invalidations.
 *
 * Export discipline: the client half value-imports ONLY the frozen platform
 * module table (CLIENT_EXTERNALS); every other `@deepseek-ai/*` import is
 * type-only (erased at build) — values arrive via cordis injection
 * (`ctx.get('connection')`, slot inject faces).
 *
 * @module @huanlin/dsh-plugin-interpreters/client
 */
import { bindSnapshotSelector } from "./bindSnapshotSelector.js";
import { InterpretersCard } from "./InterpretersCard.js";
import { InterpretersCardController, refreshIfLoaded } from "./store.js";
import { en, NS, zh } from "./locales.js";
import { dicts } from "./dictionaries.js";
/** Required services (cordis fiber inject). The target slot is declared by
 *  ui-plugin-config's apply, whose activation order relative to this one is
 *  NOT constrained; registration depends on the slot through `slots.inject()`. */
export const inject = ['slots', 'locale', 'connection'];
/**
 * Register the interpreters card once the Plugins page's row-config
 * declaration is on the ledger, wire its store to the connection, and keep
 * it fresh on every pushed invalidation.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-interpreters: dictionaries');
    // Opt-in third-language overrides through @huanlin/dsh-plugin-better-locale.
    // Activation-order-safe: ctx.get('betterLocale') is a non-reactive read, so
    // if better-locale activates after us, the initial read returns undefined.
    // We subscribe to ctx.locale — better-locale bumps its revision on activation
    // (persisted override) and on every override switch — and re-check on each bump.
    ctx.effect(() => {
        let dispose;
        const sync = () => {
            dispose?.();
            dispose = undefined;
            const store = ctx.get('betterLocale');
            if (store !== undefined) {
                dispose = store.register(NS, dicts);
            }
        };
        sync();
        const unsubscribe = ctx.locale.subscribe(sync);
        return () => {
            unsubscribe();
            dispose?.();
        };
    }, 'interpreters: better-locale override dicts');
    // The store reads/writes the interpreters config over the plugin's
    // self-hosted HTTP route (`/interpreters/api/get` + `/interpreters/api/set`).
    const controller = new InterpretersCardController();
    const useSnapshot = bindSnapshotSelector(controller.store);
    // Pushed invalidations converge the open surface without polling. The dsh
    // client Events vocabulary has no `settings/changed` host passthrough, so
    // convergence rides `connection/reset` — a
    // connection reset invalidates the whole client state. A burst of resets
    // coalesces into a single refetch via the microtask debounce, and
    // `refreshIfLoaded` keeps an unopened card idle.
    ctx.effect(() => {
        let pending = false;
        const refresh = () => {
            if (pending)
                return;
            pending = true;
            queueMicrotask(() => {
                pending = false;
                refreshIfLoaded(controller);
            });
        };
        const disposers = [ctx.on('connection/reset', refresh)];
        return () => { for (const dispose of disposers)
            dispose(); };
    }, 'dsh-interpreters: pushed invalidations');
    // The card registers into the Plugins page's row-config slot, keyed by
    // `<bundle package>#<row id>` (the bundle's patch declares row
    // `interpreters`). The rc.2 plugin-config slot is retired in rc.1. The inject
    // face carries ONLY the business surface (controller + useSnapshot); the
    // typed `t` seat is synthesized by the renderer from `locale: NS`.
    ctx.slots.inject('plugins.row.config', function* () {
        yield ctx.slots.register({
            name: 'plugins.row.config',
            key: '@huanlin/dsh-plugin-interpreters#interpreters',
            locale: NS,
            inject: () => ({ controller, useSnapshot }),
        }, InterpretersCard);
    });
}
