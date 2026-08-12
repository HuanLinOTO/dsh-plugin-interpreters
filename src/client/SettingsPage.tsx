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

import { useSyncExternalStore, type CSSProperties } from 'react'
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SettingsScope } from '@deepseek-ai/dsh-client-runtime/client'


/** Inject face: the reactive settings scope. */
export interface InterpretersSettingsInjected {
  readonly scope: SettingsScope<InterpretersSettings>
}

/** Shape persisted under the `interpreters` namespace. */
export interface InterpretersSettings {
  pythonPath: string
  nodePath: string
  timeoutMs: number
}

/** Full props: settings.section runtime share + locale seat + inject. */
type SettingsPageProps = PropsRuntime<'settings.section'> & PropsLocale<'interpreters'> & InterpretersSettingsInjected

/**
 * Render the interpreter path settings page.
 * @param props - settings.section runtime share + locale + inject.
 * @returns the page element.
 */
export function SettingsPage(props: SettingsPageProps) {
  const { t, scope } = props
  const snapshot = useSyncExternalStore(scope.subscribe, scope.getSnapshot)

  if (snapshot.status === 'loading') {
    return <div>{t('loading')}</div>
  }

  const value = snapshot.value
  const writable = snapshot.writable

  const pythonPath = value?.pythonPath ?? 'python'
  const nodePath = value?.nodePath ?? 'node'
  const timeoutMs = value?.timeoutMs ?? 30000

  const handleChange = (field: keyof InterpretersSettings, val: string): void => {
    if (!writable) return
    if (field === 'timeoutMs') {
      const n = Number.parseInt(val, 10)
      void scope.set('timeoutMs', Number.isFinite(n) && n > 0 ? n : 30000)
    } else {
      void scope.set(field, val)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h2>{t('title')}</h2>
      {!writable && <p>{t('readonly')}</p>}
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span>{t('pythonPath')}</span>
        <input
          type="text"
          value={pythonPath}
          disabled={!writable}
          onChange={(e) => handleChange('pythonPath', e.target.value)}
          placeholder="python"
          style={inputStyle(writable)}
        />
        <span style={helpStyle}>{t('pythonHelp')}</span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span>{t('nodePath')}</span>
        <input
          type="text"
          value={nodePath}
          disabled={!writable}
          onChange={(e) => handleChange('nodePath', e.target.value)}
          placeholder="node"
          style={inputStyle(writable)}
        />
        <span style={helpStyle}>{t('nodeHelp')}</span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <span>{t('timeoutMs')}</span>
        <input
          type="number"
          value={timeoutMs}
          disabled={!writable}
          onChange={(e) => handleChange('timeoutMs', e.target.value)}
          min={1000}
          step={1000}
          style={inputStyle(writable)}
        />
        <span style={helpStyle}>{t('timeoutHelp')}</span>
      </label>
    </div>
  )
}

function inputStyle(writable: boolean): CSSProperties {
  return {
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid var(--dsw-alias-border-l2, #d0d5dd)',
    background: writable ? 'var(--dsw-alias-bg-layer-1, #fff)' : 'var(--dsw-alias-bg-layer-2, #f5f5f5)',
    fontSize: '14px',
    color: 'var(--dsw-alias-text-primary, #1a1a1a)',
    outline: 'none',
  }
}

const helpStyle: CSSProperties = {
  fontSize: '12px',
  color: 'var(--dsw-alias-text-secondary, #666)',
}
