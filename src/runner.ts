/**
 * runner.ts — subprocess execution for `run_python` / `run_node` tools.
 *
 * Spawns the interpreter with `-` (read code from stdin), writes the code
 * to stdin, and collects stdout/stderr with a 1 MB cap per stream.
 * Honours `AbortSignal` and a timeout — both kill the process and report
 * the outcome in the canonical result (C5: non-ideal states are values,
 * not thrown errors).
 *
 * @module dsh-interpreters/runner
 */

import { spawn } from 'node:child_process'

/** Maximum captured bytes per stream (stdout / stderr). */
const MAX_OUTPUT_BYTES = 1024 * 1024

export interface RunResult {
  ok: boolean
  exit_code: number
  stdout: string
  stderr: string
  duration_ms: number
  timed_out: boolean
  cancelled: boolean
}

/**
 * Execute `code` by piping it into `executable -` (stdin).
 *
 * @param executable - interpreter path (e.g. `python`, `node`, or an absolute path).
 * @param code - source code to pipe via stdin.
 * @param cwd - optional working directory.
 * @param timeoutMs - wall-clock budget; the process is killed with SIGKILL on expiry.
 * @param signal - caller-owned abort signal; aborting kills the process.
 * @returns a {@link RunResult} describing the outcome.
 */
export function runCode(
  executable: string,
  code: string,
  cwd: string | undefined,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<RunResult> {
  return new Promise<RunResult>((resolve) => {
    const start = Date.now()

    if (signal.aborted) {
      resolve({ ok: false, exit_code: -1, stdout: '', stderr: '', duration_ms: 0, timed_out: false, cancelled: true })
      return
    }

    let child: ReturnType<typeof spawn>
    try {
      child = spawn(executable, ['-'], { cwd, windowsHide: true })
    } catch (error: unknown) {
      resolve({
        ok: false,
        exit_code: -1,
        stdout: '',
        stderr: `Failed to spawn "${executable}": ${String(error)}`,
        duration_ms: Date.now() - start,
        timed_out: false,
        cancelled: false,
      })
      return
    }

    let stdout = ''
    let stderr = ''
    let stdoutCapped = false
    let stderrCapped = false
    let timedOut = false

    const append = (buf: Buffer, target: 'stdout' | 'stderr'): void => {
      const str = buf.toString('utf8')
      if (target === 'stdout') {
        if (stdout.length + str.length > MAX_OUTPUT_BYTES && !stdoutCapped) {
          stdout += str.slice(0, MAX_OUTPUT_BYTES - stdout.length)
          stdoutCapped = true
        } else if (!stdoutCapped) {
          stdout += str
        }
      } else {
        if (stderr.length + str.length > MAX_OUTPUT_BYTES && !stderrCapped) {
          stderr += str.slice(0, MAX_OUTPUT_BYTES - stderr.length)
          stderrCapped = true
        } else if (!stderrCapped) {
          stderr += str
        }
      }
    }

    child.stdout?.on('data', (d: Buffer) => append(d, 'stdout'))
    child.stderr?.on('data', (d: Buffer) => append(d, 'stderr'))

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    const onAbort = (): void => {
      clearTimeout(timer)
      child.kill('SIGKILL')
    }
    signal.addEventListener('abort', onAbort, { once: true })

    const finish = (exitCode: number | null): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      if (stdoutCapped) stdout += '\n[stdout truncated at 1 MB]'
      if (stderrCapped) stderr += '\n[stderr truncated at 1 MB]'
      resolve({
        ok: exitCode === 0 && !timedOut && !signal.aborted,
        exit_code: exitCode ?? -1,
        stdout,
        stderr,
        duration_ms: Date.now() - start,
        timed_out: timedOut,
        cancelled: signal.aborted,
      })
    }

    child.on('error', (error: Error) => {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      resolve({
        ok: false,
        exit_code: -1,
        stdout,
        stderr: stderr + (stderr !== '' ? '\n' : '') + String(error),
        duration_ms: Date.now() - start,
        timed_out: false,
        cancelled: signal.aborted,
      })
    })

    child.on('close', (code: number | null) => finish(code))

    child.stdin?.on('error', () => { /* EPIPE: child exited before reading all stdin */ })
    child.stdin?.write(code, 'utf8')
    child.stdin?.end()
  })
}
