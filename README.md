# firsatci.app — statik tanıtım ve hukuki metin sitesi

`docs/` altındaki HTML **elle düzenlenmez**; `build.mjs` üretir.

## Metin nereden geliyor?

Sayfaların metni bu repoda değil, mimari reposundadır:

| Kaynak (`~/firsatci-mimari/web/`) | Sayfa | Takma ad |
|---|---|---|
| `index.md` | `/` | — |
| `gizlilik.md` | `/gizlilik/` | `/privacy` |
| `kosullar.md` | `/kosullar/` | `/terms` |
| `hesap-silme.md` | `/hesap-silme/` | `/delete-account` |

Hukuki metinler (gizlilik, koşullar, hesap silme) **birebir** yayımlanır. Metni
değiştirmek gerekiyorsa kaynak Markdown değişir, sonra bu betik yeniden koşar.
Bu repoda hukuki metin düzenlenmez.

Metin içindeki `[DOLDURULACAK: …]`, `[TEKNİK: …]`, `[KARAR: …]`, `[AVUKAT: …]`,
`[MUHASEBECİ: …]`, `[ÜRÜN: …]` ve `[TO BE FILLED: …]` işaretleri **silinmez**;
sayfada sarı, kesik çerçeveli etiket olarak görünür (`.isaret`). Kaynaktaki HTML
yorumları (`<!-- … -->`) ise çıktıya hiç girmez.

## Derleme

```sh
node build.mjs          # veya: npm run build
```

Üçüncü parti bağımlılık yok — `package.json` içinde `dependencies` bilerek boş.
Kaynak dizin varsayılan olarak `~/firsatci-mimari/web`; değiştirmek için:

```sh
FIRSATCI_WEB_MD=/başka/dizin node build.mjs
```

Betik derlemenin sonunda dört kontrolü koşar ve herhangi biri başarısızsa
**1 ile çıkar**:

1. **Metin eşitliği** — her hukuki sayfa için, üretilen HTML'in `<article
   class="belge">` içindeki düz metni, kaynak Markdown'ın düz metniyle kelime
   kelime karşılaştırılır. İşaretler dâhildir; HTML yorumları hariçtir. Bandın,
   menünün ve içindekiler bölümünün metni `<article>` dışındadır, bu yüzden
   karşılaştırmaya girmez. Fark varsa ilk ayrılan kelime bildirilir.
2. **Yorum sızıntısı** — üretilen HTML'de `<!--` kalmadığı doğrulanır.
3. **Site içi bağlantılar** — her `href="/…"` hedefi ve `#çıpa` kimliği
   gerçekten üretilmiş mi diye bakılır (ör. `/kosullar/#5-ücretsiz-ve-premium`).
4. **Dar ekran** — her tablonun yatay kaydırma kutusunda olduğu, `viewport`
   etiketinin bulunduğu ve bölünemeyen en uzun belirtecin 375 px'e sığdığı
   ölçülür; `style.css`'te dar ekranı taşıracak sabit `width` / `min-width`
   aranır.

## Yerel önizleme

```sh
node sunucu.mjs             # http://localhost:8000  (veya: npm run onizleme)
node sunucu.mjs --kontrol   # 7 adresi ister, durum + boyut + başlık raporlar
```

`sunucu.mjs` GitHub Pages gibi davranır: `/gizlilik` → `/gizlilik/` →
`/gizlilik/index.html`.

## Bayraklar — `build.mjs` başı

| Bayrak | Bugün | Ne yapar |
|---|---|---|
| `TASLAK` | `true` | Hukuki sayfaların üstüne sabit (sticky) "Bu metin taslaktır ve henüz yürürlükte değildir." bandını koyar |
| `NOINDEX` | `= TASLAK` | Tüm sayfalara `<meta name="robots" content="noindex, nofollow">` koyar |

Yürürlüğe alırken tek satır yeter: `TASLAK = false` → bant da `noindex` de
kalkar. Sonra `node build.mjs` koşulur ve `docs/` işlenir.

## Yayın

GitHub Pages, `main` dalının `docs/` klasöründen yayımlar (ayarı koordinatör
açar). `docs/CNAME` içeriği `firsatci.app`; `docs/.nojekyll` Jekyll'i devre dışı
bırakır. DNS bağlantısı koordinatörün işidir.

`/gizlilik`, `/kosullar`, `/hesap-silme` ve `/privacy`, `/terms`,
`/delete-account` adresleri mağaza formlarına yazılacak — **kalıcıdır**,
yeniden adlandırılmaz.

## Bilerek yok

Analitik, çerez, dış izleme kodu, harici CDN, web yazı tipi, JavaScript —
hiçbiri yok. Gizlilik metni §11 "yalnız zorunlu çerez" diyor; site hiç çerez
kullanmıyor. Yazı tipi sistemden gelir.
