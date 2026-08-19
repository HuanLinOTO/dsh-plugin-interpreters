/**
 * InterpretersCard — the `settings.plugin.item` card for the interpreters
 * configuration.
 *
 * Self-drawn chrome replicating the upstream `PluginCard` contract: the
 * upstream client value face exports no reusable card component, so this
 * card draws its own collapsible `<li>` with the same header button (name
 * over description, dirty pill, rotating chevron, aria) and divided body
 * (readOnly notice, form fields, footer with failed/saved message +
 * Discard/Save). Three fields (pythonPath, nodePath, timeoutMs) are staged
 * through the card's controller; save commits them through the
 * `/api/interpreters/set` gateway channel.
 *
 * @module dsh-interpreters/client/InterpretersCard
 */

import { useState, type ReactNode } from 'react'
import { IconChevronDownOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
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
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'interpreters'>
  & InjectFace<InterpretersCardInjected>

/**
 * Render the interpreters card inside the plugin-config section, replicating
 * the upstream PluginCard chrome.
 * @param props - slot-delivered injected dependencies and the synthesized t seat.
 * @returns the card.
 */
export function InterpretersCard(props: InterpretersCardProps): ReactNode {
  const { controller, useSnapshot, t } = props
  const state = useSnapshot(snapshot => snapshot)

  // Load-on-mount: the plugin-config page mounts the card lazily when the
  // user opens the settings panel, so the first mount triggers the first
  // gateway load.
  if (state.status === 'idle') void controller.load()

  // Disclosure is card-local USER state (upstream rationale): the healthy
  // card starts collapsed and opens on the header click only. The degraded
  // (unavailable) card renders its notice body ALWAYS visible, so `open` is
  // DERIVED from the current snapshot.
  const [userOpen, setUserOpen] = useState(false)
  const degraded = state.status === 'ready' && !state.available
  const open = userOpen || degraded

  const title = t('title')
  const header = (
    <button
      type="button"
      className={styles.header}
      aria-expanded={open}
      aria-label={`${t(open ? 'collapse' : 'expand')}: ${title}`}
      // While degraded the derived open is forced true, so the click must be
      // a no-op — toggling userOpen would silently latch it and pre-open the
      // recovered form.
      onClick={() => { if (!degraded) setUserOpen(!userOpen) }}
    >
      <span className={styles.headText}>
        <span className={styles.name}>{title}</span>
        <span className={styles.description}>{t('intro')}</span>
      </span>
      {state.dirty ? <span className={styles.pending}>{t('unsaved')}</span> : null}
      <IconChevronDownOutline14
        className={open ? `${styles.chevron} ${styles.chevronOpen}` : styles.chevron}
      />
    </button>
  )

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
    // Loading (or the idle→loading transition): the header alone — an open
    // card shows an empty body.
    body = <div className={styles.body} />
  }

  return (
    <li className={open ? `${styles.card} ${styles.cardOpen}` : styles.card}>
      {header}
      {open ? body : null}
    </li>
  )
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
