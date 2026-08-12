import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { useSyncExternalStore } from 'react';
/**
 * Render the interpreter path settings page.
 * @param props - settings.section runtime share + locale + inject.
 * @returns the page element.
 */
export function SettingsPage(props) {
    const { t, scope } = props;
    const snapshot = useSyncExternalStore(scope.subscribe, scope.getSnapshot);
    if (snapshot.status === 'loading') {
        return _jsx("div", { children: t('loading') });
    }
    const value = snapshot.value;
    const writable = snapshot.writable;
    const pythonPath = value?.pythonPath ?? 'python';
    const nodePath = value?.nodePath ?? 'node';
    const timeoutMs = value?.timeoutMs ?? 30000;
    const handleChange = (field, val) => {
        if (!writable)
            return;
        if (field === 'timeoutMs') {
            const n = Number.parseInt(val, 10);
            void scope.set('timeoutMs', Number.isFinite(n) && n > 0 ? n : 30000);
        }
        else {
            void scope.set(field, val);
        }
    };
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: '20px' }, children: [_jsx("h2", { children: t('title') }), !writable && _jsx("p", { children: t('readonly') }), _jsxs("label", { style: { display: 'flex', flexDirection: 'column', gap: '6px' }, children: [_jsx("span", { children: t('pythonPath') }), _jsx("input", { type: "text", value: pythonPath, disabled: !writable, onChange: (e) => handleChange('pythonPath', e.target.value), placeholder: "python", style: inputStyle(writable) }), _jsx("span", { style: helpStyle, children: t('pythonHelp') })] }), _jsxs("label", { style: { display: 'flex', flexDirection: 'column', gap: '6px' }, children: [_jsx("span", { children: t('nodePath') }), _jsx("input", { type: "text", value: nodePath, disabled: !writable, onChange: (e) => handleChange('nodePath', e.target.value), placeholder: "node", style: inputStyle(writable) }), _jsx("span", { style: helpStyle, children: t('nodeHelp') })] }), _jsxs("label", { style: { display: 'flex', flexDirection: 'column', gap: '6px' }, children: [_jsx("span", { children: t('timeoutMs') }), _jsx("input", { type: "number", value: timeoutMs, disabled: !writable, onChange: (e) => handleChange('timeoutMs', e.target.value), min: 1000, step: 1000, style: inputStyle(writable) }), _jsx("span", { style: helpStyle, children: t('timeoutHelp') })] })] }));
}
function inputStyle(writable) {
    return {
        padding: '8px 12px',
        borderRadius: '8px',
        border: '1px solid var(--dsw-alias-border-l2, #d0d5dd)',
        background: writable ? 'var(--dsw-alias-bg-layer-1, #fff)' : 'var(--dsw-alias-bg-layer-2, #f5f5f5)',
        fontSize: '14px',
        color: 'var(--dsw-alias-text-primary, #1a1a1a)',
        outline: 'none',
    };
}
const helpStyle = {
    fontSize: '12px',
    color: 'var(--dsw-alias-text-secondary, #666)',
};
