window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-interpreters",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/SettingsPage.tsx
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
		/**
		* Render the interpreter path settings page.
		* @param props - settings.section runtime share + locale + inject.
		* @returns the page element.
		*/
		function SettingsPage(props) {
			const { t, scope } = props;
			const snapshot = (0, react.useSyncExternalStore)(scope.subscribe, scope.getSnapshot);
			if (snapshot.status === "loading") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: t("loading") });
			const value = snapshot.value;
			const writable = snapshot.writable;
			const pythonPath = value?.pythonPath ?? "python";
			const nodePath = value?.nodePath ?? "node";
			const timeoutMs = value?.timeoutMs ?? 3e4;
			const handleChange = (field, val) => {
				if (!writable) return;
				if (field === "timeoutMs") {
					const n = Number.parseInt(val, 10);
					scope.set("timeoutMs", Number.isFinite(n) && n > 0 ? n : 3e4);
				} else scope.set(field, val);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: "20px"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", { children: t("title") }),
					!writable && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", { children: t("readonly") }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "6px"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("pythonPath") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: pythonPath,
								disabled: !writable,
								onChange: (e) => handleChange("pythonPath", e.target.value),
								placeholder: "python",
								style: inputStyle(writable)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: helpStyle,
								children: t("pythonHelp")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "6px"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("nodePath") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "text",
								value: nodePath,
								disabled: !writable,
								onChange: (e) => handleChange("nodePath", e.target.value),
								placeholder: "node",
								style: inputStyle(writable)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: helpStyle,
								children: t("nodeHelp")
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							display: "flex",
							flexDirection: "column",
							gap: "6px"
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("timeoutMs") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								type: "number",
								value: timeoutMs,
								disabled: !writable,
								onChange: (e) => handleChange("timeoutMs", e.target.value),
								min: 1e3,
								step: 1e3,
								style: inputStyle(writable)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: helpStyle,
								children: t("timeoutHelp")
							})
						]
					})
				]
			});
		}
		function inputStyle(writable) {
			return {
				padding: "8px 12px",
				borderRadius: "8px",
				border: "1px solid var(--dsw-alias-border-l2, #d0d5dd)",
				background: writable ? "var(--dsw-alias-bg-layer-1, #fff)" : "var(--dsw-alias-bg-layer-2, #f5f5f5)",
				fontSize: "14px",
				color: "var(--dsw-alias-text-primary, #1a1a1a)",
				outline: "none"
			};
		}
		const helpStyle = {
			fontSize: "12px",
			color: "var(--dsw-alias-text-secondary, #666)"
		};
		//#endregion
		//#region src/client/locales.ts
		/**
		* locales.ts — i18n dictionaries for the interpreters settings page.
		*
		* @module dsh-interpreters/client/locales
		*/
		const NS = "interpreters";
		const zh = {
			nav: "解释器",
			title: "解释器路径设置",
			pythonPath: "Python 可执行文件路径",
			pythonHelp: "模型通过 run_python 工具调用此路径执行 Python 代码。留空则使用系统默认 python。",
			nodePath: "Node.js 可执行文件路径",
			nodeHelp: "模型通过 run_node 工具调用此路径执行 Node.js 代码。留空则使用系统默认 node。",
			timeoutMs: "执行超时（毫秒）",
			timeoutHelp: "超过此时间后进程将被强制终止。",
			loading: "加载中…",
			readonly: "当前环境不支持修改设置，仅可查看。"
		};
		const en = {
			nav: "Interpreters",
			title: "Interpreter Path Settings",
			pythonPath: "Python executable path",
			pythonHelp: "The model uses this path to execute Python code via the run_python tool. Leave empty to use the system default python.",
			nodePath: "Node.js executable path",
			nodeHelp: "The model uses this path to execute Node.js code via the run_node tool. Leave empty to use the system default node.",
			timeoutMs: "Execution timeout (ms)",
			timeoutHelp: "The process is killed after this duration.",
			loading: "Loading…",
			readonly: "Settings are read-only in this environment."
		};
		//#endregion
		//#region src/client/index.ts
		/** Required services: slots, locale, connection, settings transport. */
		const inject = [
			"slots",
			"locale",
			"connection",
			"remote",
			"settingsScope"
		];
		/**
		* Client plugin body: register locale dictionaries and the settings page.
		* @param ctx - client root context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "dsh-interpreters: dictionaries");
			const spec = { namespace: NS };
			const scope = ctx.settingsScope.bind(spec);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-interpreters",
				order: 50,
				label: () => ctx.locale.bind(NS)("nav"),
				locale: NS,
				inject: () => ({ scope })
			}, SettingsPage));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map