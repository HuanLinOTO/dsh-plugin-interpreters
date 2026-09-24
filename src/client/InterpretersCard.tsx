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

import type { ReactNode } from 'react'
import type { InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import {
  InterpretersCardController,
  formatFieldNumber,
  formatFieldText,
  type InterpretersCardState,
} from './store.ts'
import type { InterpretersKey } from './locales.ts'
import styles from './InterpretersCard.module.css'

/** Injected dependencies of {@link InterpretersCard} (slot `inject`). */
export interface InterpretersCardInjected {
  /** The card controller (loaded on mount, refreshed on pushed invalidations). */
  controller: InterpretersCardController
  /** uSES subscription hook bound to the store. */
  useSnapshot: SnapshotSelectorHook<InterpretersCardState>
}

/** Props the renderer binds for the card. */
export type InterpretersCardProps =
  PropsRuntime<'plugins.row.config'>
  & PropsLocale<'interpreters'>
  & InjectFace<InterpretersCardInjected>

/**
 * Render the interpreters settings flat on the plugin's dedicated row detail
 * page: the page owns the title, icon, and breadcrumb; this card draws only
 * the always-open form (or the degraded notice).
 * @param props - slot-delivered injected dependencies and the synthesized t seat.
 * @returns the card.
 */
export function InterpretersCard(props: InterpretersCardProps): ReactNode {
  const { view, controller, useSnapshot, t } = props
  const state = useSnapshot(snapshot => snapshot)

  // Load-on-mount: the plugin page mounts the card lazily when the user opens
  // the row's configuration, so the first mount triggers the first gateway load.
  if (state.status === 'idle') void controller.load()

  // The row detail page uses `summary` only when the package description is
  // absent; render a one-liner there and the interactive form otherwise.
  if (view === 'summary') return t('intro')

  const degraded = state.status === 'ready' && !state.available

  let body: ReactNode
  if (degraded) {
    // The gateway channel is down or the namespace is not served to this
    // client — render the explicit notice and never offer Save.
    body = (
      <div className={styles.body}>
        <p className={styles.notice} role="status">{t('namespaceUnavailable')}</p>
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.discard}
            onClick={() => { void controller.load() }}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    )
  } else if (state.status === 'ready') {
    const { draft, writable, applyState } = state
    const saving = applyState.kind === 'saving'
    const busy = !writable || saving
    const saveDisabled = !state.dirty || saving || !writable
    const discardDisabled = !state.dirty || saving
    const errorText = applyState.kind === 'error' ? applyState.message : undefined
    body = (
      <div className={styles.body}>
        {!writable ? <p className={styles.readOnly} role="status">{t('readOnly')}</p> : null}
        {applyState.kind === 'saved' ? <p className={styles.savedNotice} role="status">{t('save')}</p> : null}
        <div className={styles.form}>
          <Field
            id="plugin-config-interpreters-python"
            label={t('pythonPath')}
            hint={t('pythonHelp')}
            text={formatFieldText(draft.pythonPath)}
            disabled={busy}
            onEdit={(text) => { controller.edit('pythonPath', text) }}
          />
          <Field
            id="plugin-config-interpreters-node"
            label={t('nodePath')}
            hint={t('nodeHelp')}
            text={formatFieldText(draft.nodePath)}
            disabled={busy}
            onEdit={(text) => { controller.edit('nodePath', text) }}
          />
          <Field
            id="plugin-config-interpreters-timeout"
            label={t('timeoutMs')}
            hint={t('timeoutHelp')}
            text={formatFieldNumber(draft.timeoutMs)}
            numeric
            disabled={busy}
            onEdit={(text) => { controller.edit('timeoutMs', text) }}
          />
        </div>
        <div className={styles.footer}>
          {errorText === undefined ? null : <p className={styles.failed} role="status">{errorText}</p>}
          <button
            type="button"
            className={styles.discard}
            disabled={discardDisabled}
            onClick={() => { controller.discard() }}
          >
            {t('discard')}
          </button>
          <button
            type="button"
            className={styles.save}
            disabled={saveDisabled}
            onClick={() => { controller.save() }}
          >
            {t(saving ? 'saving' : 'save')}
          </button>
        </div>
      </div>
    )
  } else {
    // Loading (or the idle→loading transition): keep the box mounted so the
    // page does not reflow when the fields arrive.
    body = <div className={styles.body} />
  }

  return <section className={styles.card}>{body}</section>
}

/** One staged field control (text or numeric). */
function Field(props: {
  id: string
  label: string
  hint: string
  numeric?: boolean
  text: string
  disabled: boolean
  onEdit: (text: string) => void
}): ReactNode {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel} htmlFor={props.id}>{props.label}</label>
      <input
        id={props.id}
        className={styles.input}
        type={props.numeric ? 'number' : 'text'}
        {...props.numeric ? { inputMode: 'numeric' as const } : {}}
        value={props.text}
        disabled={props.disabled}
        onChange={(event) => { props.onEdit(event.target.value) }}
      />
      <p className={styles.hint}>{props.hint}</p>
    </div>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The interpreters card copy. */
    'interpreters': InterpretersKey
  }
}
