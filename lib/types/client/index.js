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
import { SettingsPage } from "./SettingsPage.js";
import { en, NS, zh } from "./locales.js";
/** Required services: slots, locale, connection, settings transport. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope'];
/**
 * Client plugin body: register locale dictionaries and the settings page.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-interpreters: dictionaries');
    const spec = { namespace: NS };
    const scope = ctx.settingsScope.bind(spec);
    ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'dsh-interpreters',
        order: 50,
        label: () => ctx.locale.bind(NS)('nav'),
        locale: NS,
        inject: () => ({ scope }),
    }, SettingsPage));
}
