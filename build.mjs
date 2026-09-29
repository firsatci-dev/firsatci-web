#!/usr/bin/env node
/**
 * firsatci.app statik site derleyicisi.
 *
 * ~/firsatci-mimari/web/*.md dosyalarını okur ve docs/ altına GitHub Pages'in
 * yayımlayacağı statik HTML üretir. HTML elle düzenlenmez: metin değişince bu
 * betik yeniden koşar.
 *
 *   node build.mjs
 *   FIRSATCI_WEB_MD=/başka/dizin node build.mjs
 *
 * Üçüncü parti bağımlılık yoktur; yalnız Node'un kendi kütüphanesi kullanılır.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'

// ═══════════════════════════════════════════════════════════════════════════
// BAYRAKLAR — koordinatör yürürlüğe alırken burayı değiştirir
// ═══════════════════════════════════════════════════════════════════════════

/** Hukuki sayfaların üstündeki "Bu metin taslaktır" bandını gösterir.
 *  Yürürlüğe alırken false yap → bant kalkar, noindex de kalkar. */
export const TASLAK = true

/** Tüm sayfalara <meta name="robots" content="noindex"> koyar.
 *  Görev tanımı gereği TASLAK ile aynı bayrağa bağlı. */
export const NOINDEX = TASLAK

// ═══════════════════════════════════════════════════════════════════════════
// YOLLAR
// ═══════════════════════════════════════════════════════════════════════════

const KOK = dirname(fileURLToPath(import.meta.url))
const CIKTI = join(KOK, 'docs')
const VARLIK = join(KOK, 'assets')
const KAYNAK = resolve((process.env.FIRSATCI_WEB_MD || join(homedir(), 'firsatci-mimari/web'))
  .replace(/^~(?=$|\/)/, homedir()))

const ALAN_ADI = 'firsatci.app'
const KOK_ADRES = `https://${ALAN_ADI}`
const DESTEK = 'support@firsatci.app'

/** kaynak: Markdown dosyası · yol: site yolu ('' = kök) · hukuki: taslak bandı
 *  + birebir metin kontrolü */
const SAYFALAR = [
  {
    kaynak: 'index.md', yol: '', menu: 'Fırsatçı', hukuki: false,
    baslik: 'Fırsatçı — kartlarına uyan kampanyaları tek yerde gör',
    aciklama: 'Fırsatçı, bankaların ve mağazaların kampanyalarını toplar; sahip olduğun '
      + 'kartlara göre sana uyanları gösterir.',
  },
  {
    kaynak: 'gizlilik.md', yol: 'gizlilik', menu: 'Gizlilik', hukuki: true,
    baslik: 'Gizlilik Politikası ve KVKK Aydınlatma Metni — Fırsatçı',
    aciklama: "Fırsatçı'nın kişisel verileri nasıl işlediğini anlatan KVKK aydınlatma metni.",
  },
  {
    kaynak: 'kosullar.md', yol: 'kosullar', menu: 'Koşullar', hukuki: true,
    baslik: 'Kullanım Koşulları — Fırsatçı',
    aciklama: 'Fırsatçı uygulaması, Chrome eklentisi ve firsatci.app sitesinin kullanım koşulları.',
  },
  {
    kaynak: 'hesap-silme.md', yol: 'hesap-silme', menu: 'Hesap Silme', hukuki: true,
    baslik: 'Hesap Silme — Fırsatçı',
    aciklama: 'Fırsatçı hesabını ve kişisel verilerini nasıl sileceğin.',
  },
]

/** /privacy → /gizlilik/ gibi kalıcı takma adlar (mağaza formlarına yazılacak). */
const YONLENDIRMELER = { privacy: 'gizlilik', terms: 'kosullar', 'delete-account': 'hesap-silme' }

/** Kaynak Markdown'daki göreli bağlantıların site karşılığı. */
const MD_HEDEF = {
  'index.md': '/',
  'gizlilik.md': '/gizlilik/',
  'kosullar.md': '/kosullar/',
  'hesap-silme.md': '/hesap-silme/',
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKDOWN → HTML (bu dört belgenin kullandığı sözdizimi kadarı)
// ═══════════════════════════════════════════════════════════════════════════

const YORUM = /<!--[\s\S]*?-->/g

/** Metindeki "henüz kesinleşmedi" işaretleri. SİLİNMEZ — görünür kalır. */
const ISARET_TURLERI = ['DOLDURULACAK', 'TO BE FILLED', 'TEKNİK', 'KARAR',
  'AVUKAT', 'MUHASEBECİ', 'ÜRÜN']
const TUR = ISARET_TURLERI.join('|')
const ISARET = new RegExp(
  `\\[{1,2}\\s*(?:${TUR})(?:\\s*/\\s*(?:${TUR}))*(?:\\s*:[^\\[\\]]*)?\\]{1,2}`, 'g')

const BAG = /\[([^[\]]+)\]\(([^()\s]+)\)/g
const KALIN = /\*\*([^*]+)\*\*/g
const EPOSTA = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g
const TABLO_AYIRAC = /^\s*\|[\s:|-]+\|\s*$/
const BASLIK = /^(#{1,6})\s+(.*)$/
const MADDE = /^\s*-\s+/
const CIZGI = /^\s*-{3,}\s*$/

/**
 * Kaynak metinlerde listeden sonra boş satır bırakılmadan devam eden satırlar var.
 * CommonMark bunların tümünü son maddenin "tembel devamı" sayar; oysa kaynakta iki
 * ayrı durum bulunuyor:
 *
 *   - ...zararın giderilmesini talep etme      → "haklarına sahipsin." GERÇEKTEN
 *     haklarına sahipsin. (gizlilik §6)          maddenin cümlesinin devamı
 *
 *   - App Store: Ayarlar → ... → İptal Et      → "Silinmiş bir hesaba..." AYRI
 *     Silinmiş bir hesaba... (hesap-silme)       bir paragraf
 *
 * Ayırt edici işaret: devam eden cümle küçük harfle başlar, yeni paragraf
 * başlamaz. Küçük harfle başlamıyorsa liste kapanır ve satır paragraf olur.
 * (Her iki yorumda da düz metin aynı kalır — bu yalnız paragraf bölünmesidir.)
 */
const DEVAM = /^\p{Ll}/u

const kacir = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const kacirNitelik = (s) => kacir(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function hucreler (satir) {
  let s = satir.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split('|').map((p) => p.trim())
}

/**
 * Markdown metnini blok listesine ayırır.
 * Blok türleri: {t:'h',sev,metin} {t:'p',metin} {t:'ul',ogeler}
 *               {t:'table',basliklar,satirlar} {t:'hr'}
 */
function bloklar (metin) {
  const satirlar = metin.replace(YORUM, '').split('\n')
  const cikti = []
  const kesici = (s) => BASLIK.test(s) || CIZGI.test(s) || s.trimStart().startsWith('|')
  let i = 0
  const n = satirlar.length

  while (i < n) {
    const satir = satirlar[i]
    if (!satir.trim()) { i++; continue }

    const m = satir.match(BASLIK)
    if (m) { cikti.push({ t: 'h', sev: m[1].length, metin: m[2].trim() }); i++; continue }

    if (CIZGI.test(satir)) { cikti.push({ t: 'hr' }); i++; continue }

    if (satir.trimStart().startsWith('|') && i + 1 < n && TABLO_AYIRAC.test(satirlar[i + 1])) {
      const basliklar = hucreler(satir)
      i += 2
      const satirlarTablo = []
      while (i < n && satirlar[i].trimStart().startsWith('|')) {
        satirlarTablo.push(hucreler(satirlar[i]))
        i++
      }
      cikti.push({ t: 'table', basliklar, satirlar: satirlarTablo })
      continue
    }

    if (MADDE.test(satir)) {
      const ogeler = []
      while (i < n && satirlar[i].trim()) {
        const s = satirlar[i]
        if (MADDE.test(s)) {
          ogeler.push(s.replace(MADDE, '').trimEnd())
        } else if (kesici(s) || !DEVAM.test(s.trim())) {
          break
        } else {
          ogeler[ogeler.length - 1] += ' ' + s.trim()
        }
        i++
      }
      cikti.push({ t: 'ul', ogeler })
      continue
    }

    const parca = []
    while (i < n && satirlar[i].trim()) {
      if (kesici(satirlar[i]) || MADDE.test(satirlar[i])) break
      parca.push(satirlar[i].trim())
      i++
    }
    if (parca.length) cikti.push({ t: 'p', metin: parca.join(' ') })
    else i++ // güvenlik ağı: hiçbir kural tutmadıysa sonsuz döngüye girme
  }
  return cikti
}

/** gizlilik.md#x → /gizlilik/#x */
function bagDonustur (hedef) {
  const [ad, ...capaParca] = hedef.split('#')
  if (Object.hasOwn(MD_HEDEF, ad)) {
    return MD_HEDEF[ad] + (capaParca.length ? '#' + capaParca.join('#') : '')
  }
  return hedef
}

function isaretKutusu (ham) {
  const tur = ham.replace(/^\[+\s*/, '').split(/[:\]/]/)[0].trim()
  return `<span class="isaret" data-tur="${kacirNitelik(tur)}"`
    + ` title="Henüz kesinleşmedi">${ham}</span>`
}

/** Satır içi Markdown → HTML. Önce kaçış, sonra biçimlendirme.
 *  İşaretler iç not olduğu için içeriğine dokunulmaz (bağlantıya çevrilmez):
 *  önce yer tutucuya alınır, en sonda geri konur. */
function satirIci (metin) {
  const kutular = []
  let s = kacir(metin)
  s = s.replace(ISARET, (m) => {
    kutular.push(isaretKutusu(m))
    return ` ${kutular.length - 1} `
  })
  s = s.replace(BAG, (_, yazi, hedef) =>
    `<a href="${kacirNitelik(bagDonustur(hedef))}">`
    + `${yazi.replace(KALIN, '<strong>$1</strong>')}</a>`)
  s = s.replace(KALIN, '<strong>$1</strong>')
  s = s.replace(EPOSTA, (m) => `<a href="mailto:${m}">${m}</a>`)
  return s.replace(/ (\d+) /g, (_, i) => kutular[Number(i)])
}

/** Başlıktan GitHub uyumlu çıpa üretir. */
function capa (metin) {
  return metin
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function tabloHtml (basliklar, satirlar) {
  const bas = basliklar.map((c) => `<th scope="col">${satirIci(c)}</th>`).join('')
  const govde = satirlar
    .map((r) => '<tr>' + r.map((c) => `<td>${satirIci(c)}</td>`).join('') + '</tr>')
    .join('')
  // Dar ekranda tablo yatay kaydırılabilir kutu içinde kalır (sayfa kaymaz).
  return '<div class="tablo-kutu" tabindex="0" role="group"'
    + ' aria-label="Tablo, yatay kaydırılabilir">'
    + `<table><thead><tr>${bas}</tr></thead><tbody>${govde}</tbody></table>`
    + '</div>'
}

function bloklarHtml (bl) {
  return bl.map((b) => {
    if (b.t === 'h') return `<h${b.sev} id="${capa(b.metin)}">${satirIci(b.metin)}</h${b.sev}>`
    if (b.t === 'p') return `<p>${satirIci(b.metin)}</p>`
    if (b.t === 'ul') return '<ul>' + b.ogeler.map((o) => `<li>${satirIci(o)}</li>`).join('') + '</ul>'
    if (b.t === 'table') return tabloHtml(b.basliklar, b.satirlar)
    return '<hr>'
  }).join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// SAYFA İSKELETİ
// ═══════════════════════════════════════════════════════════════════════════

function menuHtml (etkin) {
  return '<ul>' + SAYFALAR.map((s) => {
    const adres = '/' + (s.yol ? s.yol + '/' : '')
    const simdi = s.yol === etkin ? ' aria-current="page"' : ''
    return `<li><a href="${adres}"${simdi}>${kacir(s.menu)}</a></li>`
  }).join('') + '</ul>'
}

function belge (sayfa, govde) {
  const adres = KOK_ADRES + '/' + (sayfa.yol ? sayfa.yol + '/' : '')
  const robots = NOINDEX ? '\n  <meta name="robots" content="noindex, nofollow">' : ''
  const bant = (TASLAK && sayfa.hukuki)
    ? '<p class="taslak-bandi" role="note">'
      + 'Bu metin taslaktır ve henüz yürürlükte değildir.</p>\n'
    : ''
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${kacir(sayfa.baslik)}</title>
  <meta name="description" content="${kacirNitelik(sayfa.aciklama)}">${robots}
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${adres}">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
${bant}<a class="atla" href="#icerik">İçeriğe atla</a>
<header class="ust">
  <nav aria-label="Ana menü">
${menuHtml(sayfa.yol)}
  </nav>
</header>
<main id="icerik">
${govde}
</main>
<footer class="alt">
  <p><a href="mailto:${DESTEK}">${DESTEK}</a> · © 2026 Fırsatçı.</p>
</footer>
</body>
</html>
`
}

function icindekiler (bl) {
  const ogeler = bl.filter((b) => b.t === 'h' && b.sev === 2)
    .map((b) => `<li><a href="#${capa(b.metin)}">${satirIci(b.metin)}</a></li>`)
  if (!ogeler.length) return ''
  // Etiket <h2> değil <p>: içindekiler sayfa <h1>'inden önce geliyor, başlık
  // sıralamasını bozmasın.
  return '<nav class="icindekiler" aria-labelledby="ic-baslik">'
    + '<p id="ic-baslik">İçindekiler</p>'
    + `<ol>${ogeler.join('')}</ol></nav>`
}

/** Hukuki sayfa gövdesi. <article class="belge"> YALNIZ kaynak metni taşır;
 *  içindekiler ve taslak bandı dışında kalır — metin eşitlik kontrolü bunu ölçer. */
function hukukiHtml (bl) {
  return icindekiler(bl) + '\n<article class="belge">\n' + bloklarHtml(bl) + '\n</article>'
}

// ═══════════════════════════════════════════════════════════════════════════
// TANITIM SAYFASI — aynı kaynaktan, sayfa düzenine oturtularak
// ═══════════════════════════════════════════════════════════════════════════

const KART_OGE = /^\*\*(.+?)\*\*\s*[—–-]\s*(.*)$/
const anahtar = (s) => s.replace(/İ/g, 'I').replace(/ı/g, 'i').trim().toLowerCase()
const OZELLIK_BASLIK = new Set(['neler yapabilirsin?', 'what you can do'])
const INDIR_BASLIK = new Set(['indir', 'download'])

function kartHtml (ogeler, sev) {
  return '<ul class="kartlar">' + ogeler.map((o) => {
    const m = o.match(KART_OGE)
    return m
      ? `<li><h${sev}>${satirIci(m[1])}</h${sev}><p>${satirIci(m[2])}</p></li>`
      : `<li><p>${satirIci(o)}</p></li>`
  }).join('') + '</ul>'
}

/** Mağaza düğmeleri — bağlantı YOK, "yakında". İşaretler görünür kalır. */
function magazaHtml (ogeler) {
  return '<ul class="magazalar">' + ogeler.map((o) => {
    let ad = o.replace(new RegExp(`^\\[+\\s*(?:${TUR})\\s*:\\s*`), '')
    ad = ad.replace(/\s*(?:bağlantısı|link)\s*\]+\s*$/, '').trim() || o
    return '<li><span class="magaza" aria-disabled="true">'
      + `<span class="magaza-ad">${kacir(ad)}</span>`
      + '<span class="magaza-not">Yakında</span></span>'
      + `${satirIci(o)}</li>`
  }).join('') + '</ul>'
}

function tanitimHtml (bl) {
  const parcalar = ['<div class="tanitim">']
  let bolum = ''
  let kaydir = 0 // yatay çizgiden sonraki (İngilizce) bölümde başlıkları bir kademe indir
  let sonSeviye = 1 // kart başlıkları bir alt kademeye oturur
  for (const b of bl) {
    if (b.t === 'hr') { kaydir = 1; parcalar.push('<hr class="dil-ayraci">'); continue }
    if (b.t === 'h') {
      if (b.sev === 2) bolum = anahtar(b.metin)
      const sev = Math.min(6, b.sev + kaydir)
      sonSeviye = sev
      parcalar.push(`<h${sev} id="${capa(b.metin)}">${satirIci(b.metin)}</h${sev}>`)
      continue
    }
    if (b.t === 'p') {
      const sinif = /^\*\*[^*]+\*\*$/.test(b.metin) ? ' class="slogan"' : ''
      parcalar.push(`<p${sinif}>${satirIci(b.metin)}</p>`)
      continue
    }
    if (b.t === 'ul') {
      if (OZELLIK_BASLIK.has(bolum)) parcalar.push(kartHtml(b.ogeler, Math.min(6, sonSeviye + 1)))
      else if (INDIR_BASLIK.has(bolum)) parcalar.push(magazaHtml(b.ogeler))
      else parcalar.push('<ul>' + b.ogeler.map((o) => `<li>${satirIci(o)}</li>`).join('') + '</ul>')
      continue
    }
    if (b.t === 'table') parcalar.push(tabloHtml(b.basliklar, b.satirlar))
  }
  parcalar.push('</div>')
  return parcalar.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// YÖNLENDİRME SAYFALARI (meta-refresh)
// ═══════════════════════════════════════════════════════════════════════════

function yonlendirmeHtml (hedef, baslik) {
  const adres = `/${hedef}/`
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${kacir(baslik)} — Fırsatçı</title>
  <meta http-equiv="refresh" content="0; url=${adres}">
  <meta name="robots" content="noindex, nofollow">
  <meta name="color-scheme" content="light dark">
  <link rel="canonical" href="${KOK_ADRES}${adres}">
  <link rel="stylesheet" href="/style.css">
</head>
<body>
<main id="icerik">
  <div class="tanitim">
    <p>Yönlendiriliyorsun… <a href="${adres}">${kacir(baslik)}</a></p>
  </div>
</main>
</body>
</html>
`
}

// ═══════════════════════════════════════════════════════════════════════════
// KONTROL 1 — hukuki metinlerin düz metni kaynakla birebir aynı mı?
// ═══════════════════════════════════════════════════════════════════════════

const VARLIKLAR = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" }

function kelimeler (metin) {
  const t = metin.normalize('NFC').replace(/ /g, ' ').trim()
  return t ? t.split(/\s+/) : []
}

const BELGE_GOVDE = /<article class="belge">([\s\S]*?)<\/article>/

/** Satır içi etiketler kelimeyi bölmez: <a>/<span>/<strong> kaldırılırken yerine
 *  boşluk KONMAZ (ör. "<a>x@y.z</a>'e" → "x@y.z'e"). Blok etiketler boşluk bırakır. */
const SATIR_ICI_ETIKET = /^\/?(?:a|span|strong|em|b|i|small|code|abbr|sub|sup)$/i

function etiketsiz (parca) {
  return parca
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/g, ' ')
    .replace(/<\/?([a-zA-Z][\w-]*)[^>]*>/g, (_, ad) => (SATIR_ICI_ETIKET.test(ad) ? '' : ' '))
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;|&lt;|&gt;|&quot;|&#39;/g, (m) => VARLIKLAR[m])
}

function htmlDuzMetin (sayfaHtml) {
  const m = sayfaHtml.match(BELGE_GOVDE)
  return kelimeler(etiketsiz(m ? m[1] : sayfaHtml))
}

/** Kaynak Markdown'ın düz metni — HTML üreticisinden bağımsız, satır satır. */
function mdDuzMetin (kaynak) {
  const cikti = []
  for (const satir of kaynak.replace(YORUM, '').split('\n')) {
    let s = satir.trim()
    if (!s || TABLO_AYIRAC.test(s) || CIZGI.test(s)) continue
    s = s.replace(BASLIK, '$2').replace(MADDE, '')
    if (s.startsWith('|')) s = hucreler(s).join(' ')
    s = s.replace(BAG, '$1').replace(/\*\*/g, '')
    cikti.push(s)
  }
  return kelimeler(cikti.join(' '))
}

function metinKontrolu (ad, kaynak, uretilen) {
  const a = mdDuzMetin(kaynak)
  const b = htmlDuzMetin(uretilen)
  const ortak = Math.min(a.length, b.length)
  for (let i = 0; i < ortak; i++) {
    if (a[i] !== b[i]) {
      return [`${ad}: ${i}. kelimede ayrılıyor — kaynak `
        + `${JSON.stringify(a.slice(i, i + 8).join(' '))} ≠ html `
        + `${JSON.stringify(b.slice(i, i + 8).join(' '))}`]
    }
  }
  if (a.length !== b.length) {
    const fazla = a.length > b.length ? a.slice(ortak) : b.slice(ortak)
    const yan = a.length > b.length ? 'kaynakta' : "HTML'de"
    return [`${ad}: kelime sayısı farklı (${a.length} ≠ ${b.length}); `
      + `${yan} fazla: ${JSON.stringify(fazla.slice(0, 12).join(' '))}`]
  }
  return []
}

// ═══════════════════════════════════════════════════════════════════════════
// KONTROL 2 — dar ekran (375 px) taşma riski
// ═══════════════════════════════════════════════════════════════════════════

const EKRAN = 375        // px — ölçüm genişliği (iPhone SE / en dar yaygın telefon)
const KENAR = 16         // px — .belge / .tanitim yan boşluğu (style.css ile aynı)
const KARAKTER_PX = 8.0  // px — 16 px sistem yazı tipinde ortalama karakter genişliği
const KULLANILABILIR = EKRAN - 2 * KENAR

function mobilKontrolu (ad, sayfaHtml) {
  const hatalar = []
  const tablo = (sayfaHtml.match(/<table[ >]/g) || []).length
  const kutulu = (sayfaHtml.match(/<div class="tablo-kutu"[^>]*>\s*<table/g) || []).length
  if (tablo !== kutulu) {
    hatalar.push(`${ad}: ${tablo - kutulu} tablo kaydırma kutusunun dışında`)
  }
  if (!sayfaHtml.includes('name="viewport"')) hatalar.push(`${ad}: viewport meta etiketi yok`)

  const enUzun = kelimeler(etiketsiz(sayfaHtml))
    .reduce((en, k) => Math.max(en, [...k].length), 0)
  if (enUzun * KARAKTER_PX > KULLANILABILIR) {
    hatalar.push(`${ad}: bölünemeyen en uzun belirteç ${enUzun} karakter `
      + `(~${Math.round(enUzun * KARAKTER_PX)} px > ${KULLANILABILIR} px)`)
  }
  return { hatalar, enUzun }
}

// ═══════════════════════════════════════════════════════════════════════════
// KONTROL 3 — site içi bağlantılar ve çıpalar gerçekten var mı?
// ═══════════════════════════════════════════════════════════════════════════

function bagKontrolu (sayfalar) {
  const hatalar = []
  const idler = new Map(sayfalar.map((s) => [
    s.adres,
    new Set([...s.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])),
  ]))
  for (const s of sayfalar) {
    for (const m of s.html.matchAll(/\shref="(\/[^"]*)"/g)) {
      const [yol, capaAdi] = m[1].split('#')
      if (!idler.has(yol)) {
        if (yol === '/style.css') continue
        hatalar.push(`${s.adres}: kırık bağlantı → ${m[1]}`)
        continue
      }
      if (capaAdi && !idler.get(yol).has(capaAdi)) {
        hatalar.push(`${s.adres}: ${yol} sayfasında "#${capaAdi}" çıpası yok`)
      }
    }
  }
  return hatalar
}

function cssKontrolu (css) {
  const hatalar = []
  for (const m of css.matchAll(/(?<!max-)(?<!min-)\bwidth\s*:\s*(\d+)px/g)) {
    if (Number(m[1]) > KULLANILABILIR) {
      hatalar.push(`style.css: sabit genişlik ${m[0]} — dar ekranı taşırır`)
    }
  }
  for (const m of css.matchAll(/\bmin-width\s*:\s*(\d+)px/g)) {
    // Medya sorgusu koşulundaki min-width serbest; kural gövdesindeki taşırır.
    const oncekiMedya = css.lastIndexOf('@media', m.index)
    const medyaGovde = oncekiMedya === -1 ? -1 : css.indexOf('{', oncekiMedya)
    const medyaKosulu = oncekiMedya !== -1 && m.index < medyaGovde
    if (!medyaKosulu && Number(m[1]) > KULLANILABILIR) {
      hatalar.push(`style.css: ${m[0]} — dar ekranı taşırır`)
    }
  }
  return hatalar
}

// ═══════════════════════════════════════════════════════════════════════════
// DERLEME
// ═══════════════════════════════════════════════════════════════════════════

function yaz (yol, icerik) {
  mkdirSync(dirname(yol), { recursive: true })
  writeFileSync(yol, icerik, 'utf8')
}

function derle () {
  if (!existsSync(KAYNAK) || !statSync(KAYNAK).isDirectory()) {
    console.error(`HATA: kaynak dizin yok: ${KAYNAK}`)
    console.error('      FIRSATCI_WEB_MD ile başka bir dizin gösterebilirsin.')
    return 2
  }

  const css = readFileSync(join(VARLIK, 'style.css'), 'utf8')
  rmSync(CIKTI, { recursive: true, force: true })
  mkdirSync(CIKTI, { recursive: true })

  const hatalar = []
  const uretilen = []
  const olcumler = []
  const sayfalar = [] // bağlantı/çıpa kontrolü için

  for (const sayfa of SAYFALAR) {
    const kaynakYolu = join(KAYNAK, sayfa.kaynak)
    if (!existsSync(kaynakYolu)) { hatalar.push(`kaynak yok: ${kaynakYolu}`); continue }
    const metin = readFileSync(kaynakYolu, 'utf8')
    const bl = bloklar(metin)
    const govde = sayfa.hukuki ? hukukiHtml(bl) : tanitimHtml(bl)
    const sayfaHtml = belge(sayfa, govde)

    const goreli = (sayfa.yol ? sayfa.yol + '/' : '') + 'index.html'
    yaz(join(CIKTI, goreli), sayfaHtml)
    uretilen.push(`docs/${goreli}   ←  ${sayfa.kaynak}   →  /${sayfa.yol ? sayfa.yol + '/' : ''}`)
    sayfalar.push({ adres: '/' + (sayfa.yol ? sayfa.yol + '/' : ''), html: sayfaHtml })

    if (sayfaHtml.includes('<!--')) hatalar.push(`${sayfa.kaynak}: HTML yorumu çıktıya sızmış`)
    if (sayfa.hukuki) hatalar.push(...metinKontrolu(sayfa.kaynak, metin, sayfaHtml))
    const { hatalar: mh, enUzun } = mobilKontrolu(sayfa.kaynak, sayfaHtml)
    hatalar.push(...mh)
    olcumler.push([goreli, enUzun])
  }

  for (const [takma, hedef] of Object.entries(YONLENDIRMELER)) {
    const sayfa = SAYFALAR.find((s) => s.yol === hedef)
    const html = yonlendirmeHtml(hedef, sayfa.menu)
    yaz(join(CIKTI, takma, 'index.html'), html)
    uretilen.push(`docs/${takma}/index.html   ←  yönlendirme   →  /${hedef}/`)
    sayfalar.push({ adres: `/${takma}/`, html })
  }

  yaz(join(CIKTI, 'style.css'), css)
  yaz(join(CIKTI, 'CNAME'), ALAN_ADI + '\n')
  yaz(join(CIKTI, '.nojekyll'), '')
  hatalar.push(...cssKontrolu(css))
  hatalar.push(...bagKontrolu(sayfalar))

  // ── rapor ────────────────────────────────────────────────────────────────
  console.log(`kaynak : ${KAYNAK}`)
  console.log(`çıktı  : ${CIKTI}`)
  console.log(`bayrak : TASLAK=${TASLAK}  NOINDEX=${NOINDEX}`)
  console.log('')
  for (const satir of uretilen) console.log('  +', satir)
  console.log('  + docs/style.css   + docs/CNAME   + docs/.nojekyll')
  console.log('')
  const hukukiSayi = SAYFALAR.filter((s) => s.hukuki).length
  console.log(`metin eşitliği : ${hukukiSayi} hukuki sayfanın <article class="belge"> düz metni`)
  console.log('                 kaynak Markdown ile kelime kelime karşılaştırıldı (işaretler')
  console.log('                 dâhil, HTML yorumları hariç)')
  const bagSayi = sayfalar.reduce(
    (t, s) => t + [...s.html.matchAll(/\shref="\/[^"]*"/g)].length, 0)
  console.log(`bağlantılar    : ${bagSayi} site içi bağlantı ve çıpa hedefi doğrulandı`)
  console.log(`mobil (${EKRAN} px) : kullanılabilir genişlik ${KULLANILABILIR} px; `
    + 'bölünemeyen en uzun belirteç →')
  for (const [ad, uzunluk] of olcumler) {
    console.log(`                 ${ad.padEnd(24)} ${String(uzunluk).padStart(3)} karakter`
      + ` ≈ ${String(Math.round(uzunluk * KARAKTER_PX)).padStart(3)} px`)
  }
  console.log('')

  if (hatalar.length) {
    console.error('KONTROL BAŞARISIZ:')
    for (const hata of hatalar) console.error('  ✗', hata)
    return 1
  }
  console.log('Kontroller temiz.')
  return 0
}

process.exit(derle())
