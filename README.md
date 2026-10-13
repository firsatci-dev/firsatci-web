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

Betik derlemenin sonunda beş kontrolü koşar ve herhangi biri başarısızsa
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
5. **Esnaf sayfası** — `404.html` `noindex`; hiçbir sayfadan `/esnaf` bağlantısı yok; site haritası
   yok; betikte çerez/depolama/ağ çağrısı yok; `.well-known` dosyaları geçerli JSON ve beklenen değerde.

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

## `/esnaf/<kod>` — işletme davet sayfası ve uygulama bağlantısı

Spec: D29 §3.7. `docs/404.html` (kaynak: `assets/esnaf.js` + `build.mjs`) hem bu sayfadır hem
sitenin 404 sayfası.

- **Neden 404.html:** kod rastgele ve sınırsız, yol önceden üretilemez; GitHub Pages yeniden yazma
  yapmaz, bilinmeyen her yola `404.html` verir. Betik adres yolundan kodu okur
  (`/esnaf/ABCD2345`, `/esnaf/abcd-2345/` …); `/esnaf` ile başlamayan yolda sade "Sayfa bulunamadı"
  görünür. Bedeli: sayfa HTTP **404** durumuyla gelir (tarayıcı sorunsuz çizer; zaten `noindex`).
  Durum kodu 200 isteniyorsa Pages önüne bir yeniden yazma katmanı (Cloudflare vb.) gerekir.
- Kod sunucuya **sorulmaz**; geçerli/geçersiz demez. Biçim (8 karakter, `ABCDEFGHJKMNPQRSTUVWXYZ23456789`)
  yalnız istemcide denetlenir; okunamayan kod aynı sayfayı kod kutusuz gösterir.
- `noindex, nofollow` **koşulsuz** (`NOINDEX`/`TASLAK` bayrağından bağımsız — site yayına açılsa da kalır).
  `robots.txt` bilerek yok: `Disallow`, tarayıcıyı `noindex` etiketini görmekten alıkoyar. Sayfa ana
  sayfadan, menüden ve (zaten üretilmeyen) site haritasından bağlantısızdır; `build.mjs` bunu ölçer.
- Mağaza bağlantıları `index.md` "İndir" listesinden gelir: gerçek `[…](https://…)` bağlantısı yazılınca
  düğme bağlantı olur, yoksa "Yakında".
- **Doğrulama dosyaları** (`docs/.well-known/`, `build.mjs` üretir; değerler `build.mjs` başında):
  `apple-app-site-association` (uzantısız; `8AH2DMGQJG.com.firsatci.app.ios`, yalnız `/esnaf/*`) ve
  `assetlinks.json` (`com.firsatci299`, Play App Signing sertifikasının SHA-256'sı). Nokta ile başlayan
  klasör Pages'te yalnız `docs/.nojekyll` varken yayımlanır (build onu zaten yazar).
- Yayın sonrası ölçüm: `curl -sI https://firsatci.app/.well-known/apple-app-site-association`
  (200, yönlendirme yok, içerik tipi) ve `.../assetlinks.json`.
- Test: `npm test` (`test/esnaf.test.mjs` — yol ayrıştırma, kopyalama, DOM kurulumu).

## Bilerek yok

Analitik, çerez, dış izleme kodu, harici CDN, web yazı tipi — hiçbiri yok. JavaScript yalnız
`404.html` içindeki küçük `esnaf.js` (depolama ve ağ çağrısı yok; `build.mjs` bunu da denetler). Gizlilik metni §11 "yalnız zorunlu çerez" diyor; site hiç çerez
kullanmıyor. Yazı tipi sistemden gelir.
