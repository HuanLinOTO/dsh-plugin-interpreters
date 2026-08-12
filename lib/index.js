import z from "schemastery";
import { settingsNamespace } from "@deepseek-ai/dsh-settings";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { spawn } from "node:child_process";
//#region src/runner.ts
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
/** Maximum captured bytes per stream (stdout / stderr). */
const MAX_OUTPUT_BYTES = 1048576;
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
function runCode(executable, code, cwd, timeoutMs, signal) {
	return new Promise((resolve) => {
		const start = Date.now();
		if (signal.aborted) {
			resolve({
				ok: false,
				exit_code: -1,
				stdout: "",
				stderr: "",
				duration_ms: 0,
				timed_out: false,
				cancelled: true
			});
			return;
		}
		let child;
		try {
			child = spawn(executable, ["-"], {
				cwd,
				windowsHide: true
			});
		} catch (error) {
			resolve({
				ok: false,
				exit_code: -1,
				stdout: "",
				stderr: `Failed to spawn "${executable}": ${String(error)}`,
				duration_ms: Date.now() - start,
				timed_out: false,
				cancelled: false
			});
			return;
		}
		let stdout = "";
		let stderr = "";
		let stdoutCapped = false;
		let stderrCapped = false;
		let timedOut = false;
		const append = (buf, target) => {
			const str = buf.toString("utf8");
			if (target === "stdout") {
				if (stdout.length + str.length > MAX_OUTPUT_BYTES && !stdoutCapped) {
					stdout += str.slice(0, MAX_OUTPUT_BYTES - stdout.length);
					stdoutCapped = true;
				} else if (!stdoutCapped) stdout += str;
			} else if (stderr.length + str.length > MAX_OUTPUT_BYTES && !stderrCapped) {
				stderr += str.slice(0, MAX_OUTPUT_BYTES - stderr.length);
				stderrCapped = true;
			} else if (!stderrCapped) stderr += str;
		};
		child.stdout?.on("data", (d) => append(d, "stdout"));
		child.stderr?.on("data", (d) => append(d, "stderr"));
		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGKILL");
		}, timeoutMs);
		const onAbort = () => {
			clearTimeout(timer);
			child.kill("SIGKILL");
		};
		signal.addEventListener("abort", onAbort, { once: true });
		const finish = (exitCode) => {
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			if (stdoutCapped) stdout += "\n[stdout truncated at 1 MB]";
			if (stderrCapped) stderr += "\n[stderr truncated at 1 MB]";
			resolve({
				ok: exitCode === 0 && !timedOut && !signal.aborted,
				exit_code: exitCode ?? -1,
				stdout,
				stderr,
				duration_ms: Date.now() - start,
				timed_out: timedOut,
				cancelled: signal.aborted
			});
		};
		child.on("error", (error) => {
			clearTimeout(timer);
			signal.removeEventListener("abort", onAbort);
			resolve({
				ok: false,
				exit_code: -1,
				stdout,
				stderr: stderr + (stderr !== "" ? "\n" : "") + String(error),
				duration_ms: Date.now() - start,
				timed_out: false,
				cancelled: signal.aborted
			});
		});
		child.on("close", (code) => finish(code));
		child.stdin?.on("error", () => {});
		child.stdin?.write(code, "utf8");
		child.stdin?.end();
	});
}
//#endregion
//#region src/tools.ts
/**
* Build the model-visible description for `run_python`, embedding the
* configured interpreter path so the model knows exactly which executable
* will be invoked.
*/
function buildPythonDescription(cfg) {
	return "Execute Python code and return stdout, stderr, and exit code. Code is passed via stdin (`" + cfg.pythonPath + " -`), so there is no command-line length limit. The Python interpreter is located at: " + cfg.pythonPath + "\nUse the optional `cwd` parameter to set the working directory.";
}
/**
* Build the model-visible description for `run_node`, embedding the
* configured interpreter path.
*/
function buildNodeDescription(cfg) {
	return "Execute Node.js code and return stdout, stderr, and exit code. Code is passed via stdin (`" + cfg.nodePath + " -`), so there is no command-line length limit. The Node.js interpreter is located at: " + cfg.nodePath + "\nUse the optional `cwd` parameter to set the working directory.";
}
function textRender(fn) {
	return (_args, value) => [{
		type: "text",
		text: fn(value)
	}];
}
function renderRunCodeOutput(value) {
	const lines = [];
	lines.push(`Exit code: ${value.exit_code} (${value.duration_ms}ms)`);
	if (value.timed_out) lines.push("Process was killed after exceeding the timeout.");
	if (value.cancelled) lines.push("Process was cancelled by an abort signal.");
	if (value.stdout) lines.push(`--- stdout ---\n${value.stdout}`);
	if (value.stderr) lines.push(`--- stderr ---\n${value.stderr}`);
	return lines.join("\n");
}
const parametersSchema = {
	code: {
		type: "string",
		required: true,
		description: "The code to execute."
	},
	cwd: {
		type: "string",
		description: "Optional working directory for the process."
	}
};
const outputSchema = {
	type: "object",
	additionalProperties: false,
	properties: {
		ok: {
			type: "boolean",
			required: true,
			description: "True if the process exited with code 0."
		},
		exit_code: {
			type: "integer",
			required: true,
			description: "Process exit code (-1 if the process failed to start)."
		},
		stdout: {
			type: "string",
			required: true,
			description: "Captured stdout output."
		},
		stderr: {
			type: "string",
			required: true,
			description: "Captured stderr output."
		},
		duration_ms: {
			type: "integer",
			required: true,
			description: "Wall-clock execution time in milliseconds."
		},
		timed_out: {
			type: "boolean",
			required: true,
			description: "True if the process was killed due to timeout."
		},
		cancelled: {
			type: "boolean",
			required: true,
			description: "True if the process was killed due to an abort signal."
		}
	}
};
/**
* Register `run_python` and `run_node` tools with descriptions that embed
* the interpreter paths from `cfg`. Returns a disposer that unregisters
* both tools — call it before re-registering with a fresh config.
*/
function registerTools(ctx, cfg) {
	const disposers = [];
	disposers.push(ctx.tools.register(defineTool({
		name: "run_python",
		description: buildPythonDescription(cfg),
		parameters: parametersSchema,
		output: {
			schema: outputSchema,
			render: textRender(renderRunCodeOutput)
		},
		execute: async (args, exec) => {
			const a = args;
			return runCode(cfg.pythonPath, a.code, a.cwd, cfg.timeoutMs, exec.signal);
		}
	})));
	disposers.push(ctx.tools.register(defineTool({
		name: "run_node",
		description: buildNodeDescription(cfg),
		parameters: parametersSchema,
		output: {
			schema: outputSchema,
			render: textRender(renderRunCodeOutput)
		},
		execute: async (args, exec) => {
			const a = args;
			return runCode(cfg.nodePath, a.code, a.cwd, cfg.timeoutMs, exec.signal);
		}
	})));
	return () => {
		for (const dispose of disposers) dispose();
	};
}
//#endregion
//#region src/index.ts
const name = "dsh-interpreters";
const inject = ["tools"];
/** Settings namespace under which interpreter paths persist. */
const SETTINGS_NAMESPACE = settingsNamespace("interpreters");
const Config = z.object({
	pythonPath: z.string().default("python").description("Path to the Python interpreter executable."),
	nodePath: z.string().default("node").description("Path to the Node.js interpreter executable."),
	timeoutMs: z.number().default(3e4).description("Maximum execution time in milliseconds before the process is killed.")
});
/** Schemastery schema for the `interpreters` settings namespace. */
const SettingsSchema = z.object({
	pythonPath: z.string().default("python"),
	nodePath: z.string().default("node"),
	timeoutMs: z.number().default(3e4)
});
/**
* Resolve config with fallbacks for missing / invalid values.
* @param config - raw config from cordis.yml or settings scope.
* @returns a fully-populated {@link ResolvedConfig}.
*/
function resolveConfig(config) {
	return {
		pythonPath: typeof config.pythonPath === "string" && config.pythonPath !== "" ? config.pythonPath : "python",
		nodePath: typeof config.nodePath === "string" && config.nodePath !== "" ? config.nodePath : "node",
		timeoutMs: typeof config.timeoutMs === "number" && config.timeoutMs > 0 ? config.timeoutMs : 3e4
	};
}
/**
* Plugin body: register tools with the composition config, then swap to
* settings-resolved config when the settings service is available.
* @param ctx - host context carrying `tools`.
* @param config - resolved composition config (seed).
*/
function apply(ctx, config = {}) {
	let disposeTools = registerTools(ctx, resolveConfig(config));
	ctx.inject(["settings"], (sctx) => {
		const scope = sctx.settings.register(SETTINGS_NAMESPACE, SettingsSchema, { base: config });
		const reRegister = (cfg) => {
			disposeTools?.();
			disposeTools = registerTools(ctx, cfg);
		};
		reRegister(resolveConfig(scope.get()));
		scope.watch(() => {
			reRegister(resolveConfig(scope.get()));
		});
	});
	ctx.effect(() => () => {
		disposeTools?.();
	}, "dsh-interpreters: cleanup");
}
//#endregion
export { Config, SETTINGS_NAMESPACE, apply, inject, name, resolveConfig };
