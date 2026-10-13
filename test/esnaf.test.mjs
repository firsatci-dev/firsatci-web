import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const BETIK = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'esnaf.js'), 'utf8')

/** Betiği boş bir bağlamda yükler (document tanımsız → otomatik kurulum çalışmaz). */
const yukle = () => {
  const baglam = {}
  runInNewContext(BETIK, baglam)
  return baglam
}

function sahteBelge () {
  const ogeler = {}
  for (const id of ['yok', 'esnaf', 'kod-kutu', 'kod', 'kod-okunmadi', 'kopyala', 'kopya-durum']) {
    ogeler[id] = {
      id,
      hidden: ['esnaf', 'kod-kutu', 'kod-okunmadi'].includes(id),
      textContent: '',
      tuklar: {},
      addEventListener (ad, f) { this.tuklar[ad] = f },
    }
  }
  const eklenen = []
  return {
    ogeler,
    eklenen,
    title: 'Sayfa bulunamadı — Fırsatçı',
    body: {
      appendChild: (e) => eklenen.push(e),
      removeChild: (e) => eklenen.splice(eklenen.indexOf(e), 1),
    },
    getElementById: (id) => ogeler[id],
    createElement: () => ({ style: {}, setAttribute () {}, select () {} }),
    execCommand: () => true,
  }
}

test('esnafKodCikar: geçerli yollar kodu büyük harfle verir', () => {
  const { esnafKodCikar } = yukle()
  for (const yol of [
    '/esnaf/K7M2PQ4X', '/esnaf/K7M2PQ4X/', '/esnaf/k7m2pq4x', '/esnaf/k7m2-pq4x',
    '/esnaf/K7M2%20PQ4X', '/Esnaf/K7M2PQ4X', '/esnaf/K7M2PQ4X/fazla',
  ]) assert.equal(esnafKodCikar(yol), 'K7M2PQ4X', yol)
})

test('esnafKodCikar: /esnaf altında okunamayan kod → boş metin (sayfa yine esnaf sayfası)', () => {
  const { esnafKodCikar } = yukle()
  for (const yol of [
    '/esnaf', '/esnaf/', '/esnaf/K7M2PQ4', '/esnaf/K7M2PQ4XX', '/esnaf/K7M2PQ40', // 0 alfabede yok
    '/esnaf/K7M2PQ4I', '/esnaf/K7M2PQ4L', '/esnaf/K7M2PQ4O', '/esnaf/K7M2PQ4!', '/esnaf/%E0%A4%A',
    '/esnaf/ßßßßßßßß', '/esnaf/İİİİİİİİ', '/esnaf/<script>',
  ]) assert.equal(esnafKodCikar(yol), '', yol)
})

test('esnafKodCikar: /esnaf dışı yollar → null', () => {
  const { esnafKodCikar } = yukle()
  for (const yol of ['/', '/gizlilik/', '/esnafx/K7M2PQ4X', '/baska/esnaf/K7M2PQ4X', '']) {
    assert.equal(esnafKodCikar(yol), null, yol)
  }
})

test('esnafSayfaKur: geçerli kod görünür, düğme panoya aynı kodu yazar', async () => {
  const { esnafSayfaKur } = yukle()
  const d = sahteBelge()
  const yazilan = []
  esnafSayfaKur(d, { pathname: '/esnaf/k7m2-pq4x' }, {
    clipboard: { writeText: (m) => { yazilan.push(m); return Promise.resolve() } },
  })
  assert.equal(d.ogeler.yok.hidden, true)
  assert.equal(d.ogeler.esnaf.hidden, false)
  assert.equal(d.ogeler['kod-kutu'].hidden, false)
  assert.equal(d.ogeler['kod-okunmadi'].hidden, true)
  assert.equal(d.ogeler.kod.textContent, 'K7M2PQ4X')
  assert.equal(d.title, 'Fırsatçı — Dükkânım')
  d.ogeler.kopyala.tuklar.click()
  await new Promise((r) => setImmediate(r))
  assert.deepEqual(yazilan, ['K7M2PQ4X'])
  assert.equal(d.ogeler['kopya-durum'].textContent, 'Kod kopyalandı.')
})

test('esnafSayfaKur: pano reddederse eski kopya yolu; o da olmazsa dürüst hata metni', async () => {
  const { esnafSayfaKur } = yukle()
  const d = sahteBelge()
  esnafSayfaKur(d, { pathname: '/esnaf/K7M2PQ4X' }, {
    clipboard: { writeText: () => Promise.reject(new Error('izin yok')) },
  })
  d.ogeler.kopyala.tuklar.click()
  await new Promise((r) => setImmediate(r))
  assert.equal(d.ogeler['kopya-durum'].textContent, 'Kod kopyalandı.')

  const d2 = sahteBelge()
  d2.execCommand = () => false
  esnafSayfaKur(d2, { pathname: '/esnaf/K7M2PQ4X' }, {})
  d2.ogeler.kopyala.tuklar.click()
  assert.match(d2.ogeler['kopya-durum'].textContent, /^Kopyalanamadı/)
  assert.equal(d2.eklenen.length, 0, 'geçici alan temizlenmeli')
})

test('esnafSayfaKur: okunamayan kod aynı sayfayı gösterir, kod kutusu yok', () => {
  const { esnafSayfaKur } = yukle()
  const d = sahteBelge()
  esnafSayfaKur(d, { pathname: '/esnaf/HATALI' }, {})
  assert.equal(d.ogeler.esnaf.hidden, false)
  assert.equal(d.ogeler['kod-kutu'].hidden, true)
  assert.equal(d.ogeler['kod-okunmadi'].hidden, false)
})

test('esnafSayfaKur: /esnaf dışı yolda "Sayfa bulunamadı" kalır', () => {
  const { esnafSayfaKur } = yukle()
  const d = sahteBelge()
  esnafSayfaKur(d, { pathname: '/olmayan' }, {})
  assert.equal(d.ogeler.yok.hidden, false)
  assert.equal(d.ogeler.esnaf.hidden, true)
  assert.equal(d.title, 'Sayfa bulunamadı — Fırsatçı')
})
