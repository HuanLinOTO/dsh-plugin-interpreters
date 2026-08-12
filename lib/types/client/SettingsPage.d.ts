/**
 * SettingsPage — the `interpreters` settings section.
 *
 * Two text inputs (pythonPath, nodePath) and one number input (timeoutMs).
 * Reads and writes through a {@link SettingsScope} bound to the `interpreters`
 * namespace; writes are debounced by the scope controller and persist to
 * `$DSH_HOME/settings.yaml`.
 *
 * @module dsh-interpreters/client/SettingsPage
 */
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client';
/** Inject face: the reactive settings scope. */
export interface InterpretersSettingsInjected {
    readonly scope: SettingsScope<InterpretersSettings>;
}
/** Shape persisted under the `interpreters` namespace. */
export interface InterpretersSettings {
    pythonPath: string;
    nodePath: string;
    timeoutMs: number;
}
/** Full props: settings.section runtime share + locale seat + inject. */
type SettingsPageProps = PropsRuntime<'settings.section'> & PropsLocale<'interpreters'> & InterpretersSettingsInjected;
/**
 * Render the interpreter path settings page.
 * @param props - settings.section runtime share + locale + inject.
 * @returns the page element.
 */
export declare function SettingsPage(props: SettingsPageProps): import("react").JSX.Element;
export {};
