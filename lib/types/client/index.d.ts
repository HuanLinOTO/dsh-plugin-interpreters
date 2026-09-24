/**
 * dsh-interpreters — browser half.
 *
 * Registers the `interpreters` card into the Plugins-page-declared
 * `plugins.row.config` slot (key
 * `@huanlin/dsh-plugin-interpreters#dsh-interpreters`). The card's store
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
import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type InterpretersKey } from './locales.ts';
export type { InterpretersCardInjected, InterpretersCardProps } from './InterpretersCard.tsx';
export type { InterpretersKey } from './locales.ts';
export type { InterpretersCardState, InterpretersCardController } from './store.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The interpreters card copy. */
        'interpreters': InterpretersKey;
    }
}
/** Required services (cordis fiber inject). The target slot is declared by
 *  ui-plugin-config's apply, whose activation order relative to this one is
 *  NOT constrained; registration depends on the slot through `slots.inject()`. */
export declare const inject: string[];
/**
 * Register the interpreters card once the Plugins page's row-config
 * declaration is on the ledger, wire its store to the connection, and keep
 * it fresh on every pushed invalidation.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
