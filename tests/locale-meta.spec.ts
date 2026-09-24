/**
 * locale-meta.spec.ts — guards the Plugins-page localization resources.
 *
 * dsh reads `locale/<lang>.json` through the package's `exports` (en.json is
 * the anchor; every language file in the directory must be exported) and
 * renders `meta.title` / `meta.description` on the Plugins page, which rejects
 * blank strings.
 *
 * Tests:
 *   - locale/ ships en.json (the anchor; without it localization is skipped)
 *   - every locale/*.json parses and declares non-blank meta.title/description
 *   - package.json exports ./locale/*.json and ships locale/ via files
 *
 * @module dsh-interpreters/tests/locale-meta
 */

import { readdirSync, readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const localeDir = new URL('../locale/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  exports: Record<string, string>
  files: string[]
}

function readMeta(file: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(new URL(file, localeDir), 'utf8'))
  expect(parsed, `${file}: root`).toBeTypeOf('object')
  const meta = (parsed as Record<string, unknown>).meta
  expect(meta, `${file}: meta`).toBeTypeOf('object')
  return meta as Record<string, unknown>
}

describe('locale meta', () => {
  it('ships en.json as the localization anchor', () => {
    expect(readdirSync(localeDir)).toContain('en.json')
  })

  it('declares non-blank meta.title and meta.description per language', () => {
    for (const file of readdirSync(localeDir)) {
      if (!file.endsWith('.json')) continue
      const meta = readMeta(file)
      for (const field of ['title', 'description'] as const) {
        expect(meta[field], `${file}: meta.${field}`).toBeTypeOf('string')
        expect(String(meta[field]).trim(), `${file}: meta.${field}`).not.toBe('')
      }
    }
  })

  it('exports locale/*.json and ships locale/ in files', () => {
    expect(manifest.exports['./locale/*.json']).toBe('./locale/*.json')
    expect(manifest.files).toContain('locale/')
  })
})
