#!/usr/bin/env node
/**
 * docs/ için yerel önizleme sunucusu — bağımlılık yok.
 *
 *   node sunucu.mjs            # http://localhost:8000 adresinde yayınlar
 *   node sunucu.mjs --kontrol  # sunucuyu açar, 7 adresi ister, raporlar, kapanır
 *   PORT=9000 node sunucu.mjs
 *
 * GitHub Pages gibi davranır: /gizlilik → /gizlilik/ → /gizlilik/index.html.
 */

import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, dirname, extname, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

const KOK = join(dirname(fileURLToPath(import.meta.url)), 'docs')
const PORT = Number(process.env.PORT || 8000)

const TURLER = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '': 'text/plain; charset=utf-8',
}

const sunucu = createServer((istek, yanit) => {
  const yol = decodeURIComponent(new URL(istek.url, 'http://localhost').pathname)
  const guvenli = normalize(yol).replace(/^(\.\.[/\\])+/, '')
  let dosya = join(KOK, guvenli)

  if (existsSync(dosya) && statSync(dosya).isDirectory()) {
    if (!yol.endsWith('/')) {
      yanit.writeHead(301, { Location: yol + '/' }).end()
      return
    }
    dosya = join(dosya, 'index.html')
  } else if (!existsSync(dosya) && existsSync(dosya + '/index.html')) {
    yanit.writeHead(301, { Location: yol + '/' }).end()
    return
  }

  if (!existsSync(dosya) || !statSync(dosya).isFile()) {
    yanit.writeHead(404, { 'Content-Type': TURLER['.html'] })
      .end('<!doctype html><meta charset="utf-8"><p>404 — sayfa yok')
    return
  }
  yanit.writeHead(200, { 'Content-Type': TURLER[extname(dosya)] || TURLER[''] })
    .end(readFileSync(dosya))
})

const ADRESLER = ['/', '/gizlilik/', '/kosullar/', '/hesap-silme/',
  '/privacy/', '/terms/', '/delete-account/']

if (process.argv.includes('--kontrol')) {
  sunucu.listen(PORT, async () => {
    let hata = 0
    console.log(`docs/ → http://localhost:${PORT}\n`)
    for (const adres of ADRESLER) {
      const y = await fetch(`http://localhost:${PORT}${adres}`)
      const govde = await y.text()
      const baslik = (govde.match(/<title>(.*?)<\/title>/) || [, '—'])[1]
      const iyi = y.status === 200 && govde.includes('<!DOCTYPE html>')
      if (!iyi) hata++
      console.log(`  ${iyi ? '✓' : '✗'} ${adres.padEnd(17)} ${y.status}  `
        + `${String(govde.length).padStart(6)} bayt  ${baslik}`)
    }
    // yönlendirmesiz /gizlilik (uzantısız adres) da çalışmalı
    const y = await fetch(`http://localhost:${PORT}/gizlilik`, { redirect: 'manual' })
    const iyi = y.status === 301 && y.headers.get('location') === '/gizlilik/'
    if (!iyi) hata++
    console.log(`  ${iyi ? '✓' : '✗'} /gizlilik         ${y.status} → `
      + `${y.headers.get('location')}`)
    sunucu.close()
    process.exit(hata ? 1 : 0)
  })
} else {
  sunucu.listen(PORT, () => {
    console.log(`docs/ → http://localhost:${PORT}`)
    for (const adres of ADRESLER) console.log(`   http://localhost:${PORT}${adres}`)
  })
}
