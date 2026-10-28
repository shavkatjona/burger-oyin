# 🍔 Burger yigʻ

Yuqoridan tushayotgan masalliqlarni tarelkaga tutib, buyurtma boʻyicha burger yigʻadigan quvnoq brauzer oʻyini.
Server kerak emas — oddiy HTML, CSS va JavaScript. Kompyuterda ham, telefonda ham ishlaydi.

## Qanday oʻynaladi

- Yuqoridan masalliqlar tushadi: 🍞 non, 🥩 kotlet, 🧀 pishloq, 🥬 salat, 🍅 pomidor va baʼzan 🌶️ qalampir.
- Chap burchakdagi **buyurtma kartasi** qaysi masalliq qaysi tartibda kerakligini koʻrsatadi. Keyingi kerakli masalliq sariq rangda ajratilgan, tarelka yonida ham kichik belgi bilan koʻrsatiladi.
- Toʻgʻri masalliq ushlansa burger oʻsadi (**+10 ochko**).
- Burger toʻliq yigʻilsa — **bonus** (har bir qatlam uchun +10) va yangi, biroz uzunroq buyurtma.
- Notoʻgʻri masalliq yoki qalampir ushlansa — **bitta jon kamayadi**. Jonlar 3 ta.
- Oʻyin **60 soniya** davom etadi (yoki jonlar tugaguncha). Vaqt oʻtgan sari masalliqlar tezroq tushadi.
- Tutilmagan masalliq uchun jarima yoʻq.
- **Eng yaxshi natija** brauzerda (`localStorage`) saqlanadi.

## Boshqaruv

| Qurilma     | Boshqaruv                                    |
|-------------|----------------------------------------------|
| Sichqoncha  | Tarelka kursor ortidan yuradi                |
| Klaviatura  | `←` `→` (yoki `A` `D`) — surish, `P` / `Esc` — pauza, `Enter` — boshlash |
| Telefon     | Ekranning istalgan joyida barmoqni suring    |

Boshqa oynaga oʻtilganda oʻyin avtomatik pauzaga tushadi. 🔊 tugmasi bilan ovozni oʻchirish mumkin.

## Fayllar

```
public/
  index.html   – sahifa, boshlash/pauza/natija ekranlari
  style.css    – dizayn (telefon uchun moslashuvchan)
  game.js      – oʻyin mantigʻi va canvas chizish
netlify.toml   – Netlify sozlamasi (publish = "public")
```

Tashqi kutubxona, rasm yoki shrift yoʻq — masalliqlar emoji, burger qatlamlari esa canvas'da oddiy shakllar bilan chiziladi.

## Kompyuterda ishga tushirish

`public/index.html` faylini brauzerda ochish kifoya. Yoki kichik lokal server bilan:

```bash
python3 -m http.server 8000 --directory public
```

Soʻng brauzerda <http://localhost:8000> manzilini oching.

## Netlify'ga joylash

**1-usul — GitHub orqali (tavsiya etiladi):**

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**.
2. Ushbu repozitoriyni tanlang.
3. Build sozlamalari `netlify.toml` dan avtomatik olinadi (build buyrugʻi yoʻq, publish papkasi — `public`). **Deploy** tugmasini bosing.

Har safar `main` tarmogʻiga push qilinganda sayt avtomatik yangilanadi.

**2-usul — sudrab tashlash:** [app.netlify.com/drop](https://app.netlify.com/drop) sahifasiga `public` papkasini sudrab tashlang.

**3-usul — Netlify CLI:**

```bash
npx netlify-cli deploy --prod --dir public
```

## Sinov rejimi

Manzil oxiriga `?debug` qoʻshilsa (masalan, `http://localhost:8000/?debug`), oʻyin holati brauzer konsolida `window.__burger` orqali koʻrinadi — avtomatik testlar uchun qulay.
