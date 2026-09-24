/**
 * InterpretersCard — the `plugins.row.config` card for the interpreters
 * configuration.
 *
 * Since 0.1.7 the contribution renders on the plugin's dedicated row detail
 * page, where the page draws its own title, icon, and breadcrumb and this
 * card is the page's only content — so the card is a flat always-open
 * surface with no card-level disclosure header (that fold-unfold chrome
 * was a shared-card-era artifact from when several plugins' cards stacked
 * in one settings tab). The three fields (pythonPath, nodePath, timeoutMs)
 * are staged through the card's controller; save commits them through the
 * `/interpreters/api/set` gateway channel, and the degraded (unavailable)
 * notice renders in place of the form, always visible.
 *
 * @module dsh-interpreters/client/InterpretersCard
 */
import type { ReactNode } from 'react';
import type { InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import { InterpretersCardController, type InterpretersCardState } from './store.ts';
import type { InterpretersKey } from './locales.ts';
/** Injected dependencies of {@link InterpretersCard} (slot `inject`). */
export interface InterpretersCardInjected {
    /** The card controller (loaded on mount, refreshed on pushed invalidations). */
    controller: InterpretersCardController;
    /** uSES subscription hook bound to the store. */
    useSnapshot: SnapshotSelectorHook<InterpretersCardState>;
}
/** Props the renderer binds for the card. */
export type InterpretersCardProps = PropsRuntime<'plugins.row.config'> & PropsLocale<'interpreters'> & InjectFace<InterpretersCardInjected>;
/**
 * Render the interpreters settings flat on the plugin's dedicated row detail
 * page: the page owns the title, icon, and breadcrumb; this card draws only
 * the always-open form (or the degraded notice).
 * @param props - slot-delivered injected dependencies and the synthesized t seat.
 * @returns the card.
 */
export declare function InterpretersCard(props: InterpretersCardProps): ReactNode;
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The interpreters card copy. */
        'interpreters': InterpretersKey;
    }
}
