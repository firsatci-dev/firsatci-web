import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const KOK = join(dirname(fileURLToPath(import.meta.url)), '..')
const SATIR = 'google.com, pub-9907183381623414, DIRECT, f08c47fec0942fa0'

test('docs/app-ads.txt tam olarak tek satır + satır sonu', () => {
  assert.equal(readFileSync(join(KOK, 'docs', 'app-ads.txt'), 'utf8'), SATIR + '\n')
})

test('build.mjs aynı satırı üretir (docs/ elle düzenlenmez)', () => {
  const kaynak = readFileSync(join(KOK, 'build.mjs'), 'utf8')
  assert.ok(kaynak.includes(`const APP_ADS_SATIRI = '${SATIR}'`))
})

test('sunucu.mjs .txt dosyasını text/plain sunar', () => {
  const kaynak = readFileSync(join(KOK, 'sunucu.mjs'), 'utf8')
  assert.match(kaynak, /'\.txt': 'text\/plain; charset=utf-8'/)
})
