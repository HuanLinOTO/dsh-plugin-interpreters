/**
 * locales.ts — i18n dictionaries for the interpreters settings page.
 *
 * @module dsh-interpreters/client/locales
 */

export const NS = 'interpreters' as const

export type InterpretersKey =
  | 'nav'
  | 'title'
  | 'pythonPath'
  | 'pythonHelp'
  | 'nodePath'
  | 'nodeHelp'
  | 'timeoutMs'
  | 'timeoutHelp'
  | 'loading'
  | 'readonly'

export const zh: Record<InterpretersKey, string> = {
  nav: '解释器',
  title: '解释器路径设置',
  pythonPath: 'Python 可执行文件路径',
  pythonHelp: '模型通过 run_python 工具调用此路径执行 Python 代码。留空则使用系统默认 python。',
  nodePath: 'Node.js 可执行文件路径',
  nodeHelp: '模型通过 run_node 工具调用此路径执行 Node.js 代码。留空则使用系统默认 node。',
  timeoutMs: '执行超时（毫秒）',
  timeoutHelp: '超过此时间后进程将被强制终止。',
  loading: '加载中…',
  readonly: '当前环境不支持修改设置，仅可查看。',
}

export const en: Record<InterpretersKey, string> = {
  nav: 'Interpreters',
  title: 'Interpreter Path Settings',
  pythonPath: 'Python executable path',
  pythonHelp: 'The model uses this path to execute Python code via the run_python tool. Leave empty to use the system default python.',
  nodePath: 'Node.js executable path',
  nodeHelp: 'The model uses this path to execute Node.js code via the run_node tool. Leave empty to use the system default node.',
  timeoutMs: 'Execution timeout (ms)',
  timeoutHelp: 'The process is killed after this duration.',
  loading: 'Loading…',
  readonly: 'Settings are read-only in this environment.',
}
