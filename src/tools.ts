/**
 * tools.ts — `run_python` and `run_node` model-facing tools.
 *
 * Conventions (per plugin-development-guide.md §3):
 *   C4 — execute returns a canonical JSON value; render is a separate pure projection.
 *   C5 — timeout and cancellation are non-ideal business outcomes, represented in
 *        the value (timed_out / cancelled) rather than thrown.
 *   C6 — exec.signal is forwarded to the subprocess via runCode().
 *   C10 — no UI-specific formats in the canonical value.
 *
 * The tool `description` is computed from the resolved config at registration
 * time so the model sees the interpreter path. Settings changes dispose the
 * old registration and re-register with the fresh description (host index.ts).
 *
 * @module dsh-interpreters/tools
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolRunContext } from '@deepseek-ai/dsh-tools'
import { runCode, type RunResult } from './runner.js'

export interface ResolvedConfig {
  pythonPath: string
  nodePath: string
  timeoutMs: number
}

export interface RunCodeArgs {
  code: string
  cwd?: string
}

/**
 * Build the model-visible description for `run_python`, embedding the
 * configured interpreter path so the model knows exactly which executable
 * will be invoked.
 */
export function buildPythonDescription(cfg: ResolvedConfig): string {
  return 'Execute Python code and return stdout, stderr, and exit code. '
    + 'Code is passed via stdin (`' + cfg.pythonPath + ' -`), so there is no '
    + 'command-line length limit. '
    + 'The Python interpreter is located at: ' + cfg.pythonPath + '\n'
    + 'Use the optional `cwd` parameter to set the working directory.'
}

/**
 * Build the model-visible description for `run_node`, embedding the
 * configured interpreter path.
 */
export function buildNodeDescription(cfg: ResolvedConfig): string {
  return 'Execute Node.js code and return stdout, stderr, and exit code. '
    + 'Code is passed via stdin (`' + cfg.nodePath + ' -`), so there is no '
    + 'command-line length limit. '
    + 'The Node.js interpreter is located at: ' + cfg.nodePath + '\n'
    + 'Use the optional `cwd` parameter to set the working directory.'
}

function textRender(fn: (value: RunResult) => string) {
  return (_args: unknown, value: unknown) => [{ type: 'text' as const, text: fn(value as RunResult) }]
}

export function renderRunCodeOutput(value: RunResult): string {
  const lines: string[] = []
  lines.push(`Exit code: ${value.exit_code} (${value.duration_ms}ms)`)
  if (value.timed_out) lines.push('Process was killed after exceeding the timeout.')
  if (value.cancelled) lines.push('Process was cancelled by an abort signal.')
  if (value.stdout) lines.push(`--- stdout ---\n${value.stdout}`)
  if (value.stderr) lines.push(`--- stderr ---\n${value.stderr}`)
  return lines.join('\n')
}

const parametersSchema = {
  code: { type: 'string' as const, required: true as const, description: 'The code to execute.' },
  cwd: { type: 'string' as const, description: 'Optional working directory for the process.' },
}

const outputSchema = {
  type: 'object' as const,
  additionalProperties: false as const,
  properties: {
    ok: { type: 'boolean' as const, required: true as const, description: 'True if the process exited with code 0.' },
    exit_code: { type: 'integer' as const, required: true as const, description: 'Process exit code (-1 if the process failed to start).' },
    stdout: { type: 'string' as const, required: true as const, description: 'Captured stdout output.' },
    stderr: { type: 'string' as const, required: true as const, description: 'Captured stderr output.' },
    duration_ms: { type: 'integer' as const, required: true as const, description: 'Wall-clock execution time in milliseconds.' },
    timed_out: { type: 'boolean' as const, required: true as const, description: 'True if the process was killed due to timeout.' },
    cancelled: { type: 'boolean' as const, required: true as const, description: 'True if the process was killed due to an abort signal.' },
  },
}

/**
 * Register `run_python` and `run_node` tools with descriptions that embed
 * the interpreter paths from `cfg`. Returns a disposer that unregisters
 * both tools — call it before re-registering with a fresh config.
 */
export function registerTools(ctx: Context, cfg: ResolvedConfig): () => void {
  const disposers: Array<() => void> = []

  disposers.push(ctx.tools.register(defineTool({
    name: 'run_python',
    description: buildPythonDescription(cfg),
    parameters: parametersSchema,
    output: {
      schema: outputSchema,
      render: textRender(renderRunCodeOutput),
    },
    execute: async (args: unknown, exec: ToolRunContext): Promise<RunResult> => {
      const a = args as RunCodeArgs
      return runCode(cfg.pythonPath, a.code, a.cwd, cfg.timeoutMs, exec.signal)
    },
  })))

  disposers.push(ctx.tools.register(defineTool({
    name: 'run_node',
    description: buildNodeDescription(cfg),
    parameters: parametersSchema,
    output: {
      schema: outputSchema,
      render: textRender(renderRunCodeOutput),
    },
    execute: async (args: unknown, exec: ToolRunContext): Promise<RunResult> => {
      const a = args as RunCodeArgs
      return runCode(cfg.nodePath, a.code, a.cwd, cfg.timeoutMs, exec.signal)
    },
  })))

  return () => { for (const dispose of disposers) dispose() }
}
