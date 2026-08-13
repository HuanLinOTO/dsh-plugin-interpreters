#!/usr/bin/env node
/**
 * Client bundle build for dsh-interpreters (mirror of dsh-advisor's
 * scripts/build-client.mjs): emits the closure-factory CJS artifact the dsh
 * web loader consumes —
 * `window.__ModuleLoader__.load({ id: '@huanlin/dsh-plugin-interpreters', factory: (require) => {
 *   return module.exports; } })`. Externals resolve through the loader module
 * table — the frozen `CLIENT_EXTERNALS` (platform seed entries + the
 * documented `@deepseek-ai/dsh-client-runtime/client` exemption); everything
 * else inlines. The web shell's ClientModuleHostService serves the artifact at
 * `/plugins/@huanlin/dsh-plugin-interpreters/client.js` and executes it as a
 * CLASSIC <script>, so the emitted text must contain NO `import.meta` and no
 * top-level ESM statements (either is a parse-time SyntaxError).
 *
 * A purity gate (esbuild onResolve) rejects any non-external, non-inline-safe
 * `@deepseek-ai/*` VALUE import — type-only imports are erased by esbuild's
 * TS loader before resolution and never reach the gate; cross-plugin
 * collaboration goes through cordis services. The in-script contract
 * assertions then re-check the artifact (requires ? CLIENT_EXTERNALS, no
 * `import.meta`, no ESM statements).
 *
 * CSS Modules are inlined (mirror of the dsh tsdown preset's
 * dsh-css-modules-inline): `*.module.css` side-effect imports compile through
 * lightningcss ([hash]_[local], minified) and emit a guarded `<style
 * data-plugin>` injection stub into the bundle.
 */

import { build } from 'esbuild'
import { transform } from 'lightningcss'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const ID = '@huanlin/dsh-plugin-interpreters'
const ENTRY = 'src/client/index.ts'
const OUT_FILE = 'lib/client.js'

/** Loader module table: platform seed entries plus the documented runtime/client exemption. */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-web-react',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-settings-plugins',
  '@deepseek-ai/dsh-client-ui-settings-plugins/client',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-locale/client',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
]

/** Virtual-id wrapper keeping module CSS away from esbuild's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'
/** Namespace esbuild requires on non-file paths returned from onResolve. */
const CSS_NAMESPACE = 'dsh-css-modules'

const result = await build({
  entryPoints: [ENTRY],
  outfile: OUT_FILE,
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  // Automatic JSX runtime: emits `require("react/jsx-runtime")` instead of
  // a free `React.createElement` global the loader module table does not
  // provide.
  jsx: 'automatic',
  // Externals resolve through the loader module table (the injected require).
  external: [...CLIENT_EXTERNALS],
  // zustand-style deps read process.env.NODE_ENV and probe import.meta.env.MODE;
  // the loader executes the bundle as a classic script where a literal
  // `import.meta` is a SyntaxError. Defining the full `import.meta.env` object
  // erases every reference.
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env.MODE': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    'import.meta.env': JSON.stringify({ MODE: process.env.NODE_ENV ?? 'production' }),
  },
  // Closure-factory handoff: `module`/`exports` are declared inside the
  // factory body; the factory returns that surface to the loader.
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(ID)}, factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
  plugins: [{
    // Bundle purity gate: platform seed entries stay external, and every
    // other @deepseek-ai value import is a build error — a cross-plugin
    // value import either inlines a duplicate runtime instance or requires
    // a specifier the frozen module table cannot answer.
    name: 'dsh-client-bundle-purity',
    setup(build) {
      build.onResolve({ filter: /^@deepseek-ai\// }, (args) => {
        if (CLIENT_EXTERNALS.includes(args.path)) return undefined
        throw new Error(
          `client bundle purity: "${args.path}" is not a platform module (CLIENT_EXTERNALS) — `
          + 'cross-plugin value imports are forbidden; collaborate through cordis services (type-only imports are erased and never reach this gate)',
        )
      })
    },
  }, {
    // CSS Modules inline injection (dsh tsdown.client.ts dsh-css-modules-inline
    // mirror): side-effect `*.module.css` imports compile through lightningcss
    // ([hash]_[local], minified) and the module exports the hashed class map.
    // The emitted stub injects one guarded `<style data-plugin>` per module
    // file at factory execution; the web shell's loader cleans up plugin-owned
    // tags by `style[data-plugin=<id>]` + per-module `data-plugin-css`.
    name: 'dsh-css-modules-inline',
    setup(build) {
      build.onResolve({ filter: /\.module\.css$/ }, (args) => {
        return { path: CSS_VIRTUAL_PREFIX + join(args.resolveDir, args.path) + CSS_VIRTUAL_SUFFIX, namespace: CSS_NAMESPACE }
      })
      build.onLoad({ filter: /^\0dsh-css:/, namespace: CSS_NAMESPACE }, (args) => {
        const fileId = args.path.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
        const source = readFileSync(fileId)
        const { code, exports: cssExports } = transform({
          filename: fileId,
          code: source,
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        })
        const classMap = {}
        // Deterministic emit: sort the export entries by local name so the
        // class-map JSON literal's key order is byte-stable across builds.
        for (const [local, exp] of Object.entries(cssExports ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) classMap[local] = exp.name
        // One <style data-plugin> per module file; idempotent under re-evaluation.
        const tagId = `${ID}/${basename(fileId)}`
        const contents = [
          `const css = ${JSON.stringify(code.toString())};`,
          `const tagId = ${JSON.stringify(tagId)};`,
          `if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css=' + JSON.stringify(tagId) + ']') === null) {`,
          `  const tag = document.createElement('style');`,
          `  tag.dataset.plugin = ${JSON.stringify(ID)};`,
          `  tag.dataset.pluginCss = tagId;`,
          `  tag.textContent = css;`,
          `  document.head.appendChild(tag);`,
          `}`,
          `export default ${JSON.stringify(classMap)};`,
        ].join('\n')
        return { loader: 'js', contents, watchFiles: [fileId] }
      })
    },
  }],
})

if (result.errors.length > 0) {
  throw new Error(`client bundle build failed:\n${result.errors.map((e) => e.text).join('\n')}`)
}

// Inline bundle-contract assertions: the emitted text must carry the
// closure-factory load handoff, must not VALUE-import `@deepseek-ai/*`
// outside the frozen externals table, and must contain NO `import.meta` /
// ESM statements — the web loader executes this file as a classic <script>.
// Strip esbuild's virtual CSS-module comment (carries a NUL byte + absolute
// machine path) before the assertions.
const bundleText = readFileSync(OUT_FILE, 'utf8')
  .replace(/^\/\/ dsh-css-modules:\x00[^\n]*\n/gm, '')
writeFileSync(OUT_FILE, bundleText)
if (!bundleText.includes('window.__ModuleLoader__.load(') || !bundleText.includes(JSON.stringify(ID))) {
  throw new Error('client bundle contract: the closure-factory load handoff with the plugin id is missing')
}
for (const match of bundleText.matchAll(/require\(\s*["'](@deepseek-ai\/[^"']+)["']\s*\)/g)) {
  const specifier = match[1]
  if (!CLIENT_EXTERNALS.includes(specifier)) {
    throw new Error(`client bundle contract: "${specifier}" VALUE import survived the purity gate`)
  }
}
if (bundleText.includes('import.meta') || /(^|\n)\s*(import|export)\s/.test(bundleText)) {
  throw new Error('client bundle contract: emitted bundle contains import.meta / ESM statements — the classic-script loader would fail to parse it')
}
if (bundleText.includes('\u0000')) {
  throw new Error('client bundle contract: emitted bundle contains a NUL byte — esbuild virtual-module comment not stripped')
}

console.log(`build-client: ${ENTRY} -> ${OUT_FILE} (closure-factory CJS)`)
