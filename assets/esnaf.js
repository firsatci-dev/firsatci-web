/* firsatci.app/esnaf/<kod> — kodu adres yolundan okur, SUNUCUYA SORMAZ.
   Çerez, depolama, analitik, ağ isteği yok. build.mjs bu dosyayı 404.html'e gömer. */

var ESNAF_KOD_BICIMI = /^[A-Za-z2-9]{8}$/
var ESNAF_ALFABE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** null: yol /esnaf ile başlamıyor · '': /esnaf var ama okunabilir kod yok · 'ABCD2345' */
function esnafKodCikar (yol) {
  var parcalar = String(yol).split('/')
  if (parcalar[1] === undefined || parcalar[1].toLowerCase() !== 'esnaf') return null
  var ham = parcalar[2] || ''
  try { ham = decodeURIComponent(ham) } catch (e) { return '' }
  ham = ham.replace(/[\s-]+/g, '')
  if (!ESNAF_KOD_BICIMI.test(ham)) return ''
  var kod = ham.toUpperCase()
  for (var i = 0; i < kod.length; i++) {
    if (ESNAF_ALFABE.indexOf(kod.charAt(i)) === -1) return ''
  }
  return kod
}

function esnafPanoyaYaz (doc, nav, metin, bitti) {
  if (nav && nav.clipboard && typeof nav.clipboard.writeText === 'function') {
    nav.clipboard.writeText(metin).then(function () { bitti(true) }, function () { bitti(esnafEskiKopya(doc, metin)) })
    return
  }
  bitti(esnafEskiKopya(doc, metin))
}

function esnafEskiKopya (doc, metin) {
  try {
    var alan = doc.createElement('textarea')
    alan.value = metin
    alan.setAttribute('readonly', '')
    alan.style.position = 'fixed'
    alan.style.opacity = '0'
    doc.body.appendChild(alan)
    alan.select()
    var tamam = doc.execCommand('copy')
    doc.body.removeChild(alan)
    return !!tamam
  } catch (e) {
    return false
  }
}

function esnafSayfaKur (doc, konum, nav) {
  var kod = esnafKodCikar(konum.pathname)
  if (kod === null) return

  doc.getElementById('yok').hidden = true
  doc.getElementById('esnaf').hidden = false
  doc.title = 'Fırsatçı — Dükkânım'

  if (!kod) {
    doc.getElementById('kod-okunmadi').hidden = false
    return
  }

  doc.getElementById('kod-kutu').hidden = false
  doc.getElementById('kod').textContent = kod
  var durum = doc.getElementById('kopya-durum')
  doc.getElementById('kopyala').addEventListener('click', function () {
    esnafPanoyaYaz(doc, nav, kod, function (tamam) {
      durum.textContent = tamam
        ? 'Kod kopyalandı.'
        : 'Kopyalanamadı. Kodu basılı tutup seçerek kopyalayabilirsin.'
    })
  })
}

if (typeof document !== 'undefined') esnafSayfaKur(document, location, navigator)
