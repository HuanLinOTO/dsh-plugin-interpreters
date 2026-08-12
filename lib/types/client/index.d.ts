/**
 * dsh-interpreters — browser half.
 *
 * Registers one slot contribution: the `settings.section` page where users
 * configure Python and Node.js interpreter paths. The page reads/writes
 * through a {@link SettingsScope} bound to the `interpreters` namespace via
 * the `settingsScope` service; the host half persists to
 * `$DSH_HOME/settings.yaml` and re-registers the tools with updated
 * descriptions on every committed change.
 *
 * @module @dsh-external/dsh-interpreters/client
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type InterpretersKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The interpreters settings page copy. */
        'interpreters': InterpretersKey;
    }
}
/** Required services: slots, locale, connection, settings transport. */
export declare const inject: string[];
/**
 * Client plugin body: register locale dictionaries and the settings page.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
