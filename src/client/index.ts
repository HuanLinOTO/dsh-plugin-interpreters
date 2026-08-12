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

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { SettingsScopeSpec } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the client connection Context merge (ctx.connection).
import type {} from '@deepseek-ai/dsh-client-connection/client'
// Type-only: pulls the shell's SlotMap merge for settings.section.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { SettingsPage, type InterpretersSettings } from './SettingsPage.tsx'
import { en, NS, zh, type InterpretersKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The interpreters settings page copy. */
    'interpreters': InterpretersKey
  }
}

/** Required services: slots, locale, connection, settings transport. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope']

/**
 * Client plugin body: register locale dictionaries and the settings page.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-interpreters: dictionaries')

  const spec: SettingsScopeSpec<InterpretersSettings> = { namespace: NS }
  const scope = ctx.settingsScope.bind<InterpretersSettings>(spec)

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-interpreters',
    order: 50,
    label: () => ctx.locale.bind(NS)('nav'),
    locale: NS,
    inject: () => ({ scope }),
  }, SettingsPage))
}
