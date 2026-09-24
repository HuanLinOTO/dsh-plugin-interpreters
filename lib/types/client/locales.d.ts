/**
 * locales.ts — i18n dictionaries for the interpreters configuration card.
 *
 * Keys cover the flat always-open form on the plugin's dedicated row detail
 * page (title/intro + the three field labels and hints + the form chrome:
 * save/saving/discard/unsaved/saveFailed/readOnly) and the degraded-channel
 * notice (namespaceUnavailable/retry).
 *
 * @module dsh-interpreters/client/locales
 */
export declare const NS: "interpreters";
export type InterpretersKey = 'title' | 'intro' | 'pythonPath' | 'pythonHelp' | 'nodePath' | 'nodeHelp' | 'timeoutMs' | 'timeoutHelp' | 'save' | 'saving' | 'discard' | 'unsaved' | 'saveFailed' | 'readOnly' | 'namespaceUnavailable' | 'retry';
export declare const zh: Record<InterpretersKey, string>;
export declare const en: Record<InterpretersKey, string>;
