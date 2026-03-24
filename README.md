<div align="center">

# 🛡️ AdShield Pro v2.3
### The Ultimate Ad Blocking Experience

<img alt="image.png" data-hpc="true" src="https://github.com/gkhantyln/AdShieldPro/blob/main/image.png" style="max-width: 100%;">

[![Version](https://img.shields.io/badge/version-2.3-blue.svg?style=for-the-badge)](https://github.com/gkhantyln/AdShieldPro)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4.svg?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](http://makeapullrequest.com)

[**Install Now**](#installation) • [**Features**](#key-features) • [**Contributing**](#contributing)

---
</div>

## 🚀 Overview

**AdShield Pro** is not just another ad blocker. It is a high-performance, intelligent content filtering engine designed to reclaim your browsing experience. Built with a focus on speed, privacy, and user control, AdShield Pro eliminates intrusive ads, trackers, and annoyances across the web, including YouTube.

## ✨ Key Features

- **⚽ Live Stream Pro:** Entegre "Nükleer" video atlatıcı sayesinde SelcukSports gibi canlı yayın sitelerindeki zorunlu reklamları 1 saniyenin altına indirir.
- **⚡ Instant Cosmetic Block:** Sayfa yüklenirken oluşan "reklam parlamasını" engellemek için kuralları `document_start` seviyesinde anında uygular.
- **🖱️ Smart Auto-Play:** Yayın sitelerindeki reklam banner'larını ve play butonlarını otomatik algılayıp tıklar.
- **🛡️ Heuristic Anti-Tracking:** Canvas/Audio Fingerprinting, WebRTC leak ve 1x1 tracking pixel'leri engeller.
- **🧠 AI-Powered Content Filter:** Google Generative AI ile clickbait ve gizli reklam içeriklerini semantik olarak analiz eder.
- **☁️ Filter List Engine:** ABP/uBlock formatındaki filtre listelerini otomatik parse edip Chrome'un native DNR API'sine yükler. 8 saatte bir otomatik güncellenir.
- **🇹🇷 Türkiye Desteği:** AdGuard Turkish Filter varsayılan olarak aktif. Türk sitelerdeki reklamları özel olarak hedefler.
- **🎯 Smart Element Picker:** Sayfadan herhangi bir elementi tıklayarak kalıcı olarak kaldır.
- **📺 YouTube Ad Defense:** Pre-roll ve mid-roll reklamları engeller, 16x hız atlama fallback dahil.
- **🔒 Privacy First:** Veri toplanmaz. Tarama geçmişiniz cihazınızda kalır.
- **👨‍👩‍👧 Ebeveyn Kontrolü:** 100.000+ alan adı içeren yetişkin içerik veritabanı. Aktif edildiğinde engellenen sitelere erişim otomatik olarak `blocked.html` sayfasına yönlendirilir.
- **🚫 Manuel Site Engelleme:** Wildcard pattern desteğiyle istediğiniz siteleri engelleyin. `site.com`, `*.site.com` veya `*.site.*` formatlarını destekler. Engellenen sitelere girmeden önce sayfa içeriği görünmez.

## ☁️ Filtre Listeleri

Ayarlar sekmesindeki **Bulut Listeleri** bölümünden yönetilir.

### Varsayılan Açık
| Liste | Açıklama |
|-------|----------|
| AdGuard Turkish Filter 🇹🇷 | Türkçe sitelerdeki reklamları hedefler |

### Mevcut Listeler (Manuel Açılabilir)
| Liste | Açıklama |
|-------|----------|
| EasyList | Genel reklam engelleme (İngilizce ağırlıklı) |
| EasyList (No Adult) | Yetişkin içerik kuralları hariç EasyList |
| EasyList (No Element Hiding) | Sadece network kuralları |
| EasyPrivacy | Tracker ve analitik engelleme |
| EasyPrivacy (No International) | Uluslararası domain kuralları hariç |
| EasyList Cookie List | Cookie banner engelleme |
| Fanboy's Annoyance List | Rahatsız edici içerik engelleme |
| Fanboy's Social Blocking List | Sosyal medya widget engelleme |
| Adblock Warning Removal | Anti-adblock uyarılarını engeller |
| Dandelion Sprout's Nordic Filters | İskandinav siteleri için |
| Turk Adlist (TR) 🇹🇷 | Topluluk tabanlı Türkiye listesi |

> ⚠️ **Önemli:** Chrome MV3, dynamic rules için **5.000 kural limiti** uygular. Aynı anda en fazla **2–3 liste** açmanız önerilir. Liste değiştirdikten sonra **"Güncelle" butonuna basmanız** gerekir.

### Özel Liste Ekleme
Ayarlar → Bulut Listeleri → "Özel Liste Ekle" bölümüne herhangi bir ABP/uBlock formatındaki `.txt` liste URL'si eklenebilir.

## 🆕 v2.3 Değişiklikleri

- **Çoklu Cihaz Sync:** Özel kurallar, whitelist, engellenen siteler ve ayarlar artık `chrome.storage.sync` üzerinden tüm Chrome cihazlarınıza otomatik senkronize edilir.
- **Ebeveyn Kontrolü:** 100.000+ domainlik yetişkin içerik listesi entegrasyonu. `webNavigation.onBeforeNavigate` ile sayfa yüklenmeden anında engelleme.
- **Manuel Site Engelleme:** Wildcard pattern desteği (`site.com`, `*.site.com`, `*.site.*`). Engelleme `webNavigation` ile anlık, içerik hiç görünmez.
- **Engel Sayfası (blocked.html):** Yeniden tasarlandı. Domain adı, tarih ve saat bilgisi gösterilir. CSP uyumlu harici JS dosyasına taşındı.
- **webNavigation Permission:** Daha hızlı ve güvenilir engelleme için `webNavigation` izni eklendi.
- **Pattern Bilgilendirmesi:** Popup'ta kullanıcıya wildcard kullanımı açıklandı.

## 🔄 Çoklu Cihaz Senkronizasyonu

Chrome hesabınıza giriş yaptığınız tüm cihazlarda ayarlarınız otomatik olarak senkronize edilir.

| Veri | Sync | Açıklama |
|------|------|----------|
| Açma/Kapama durumu | ✅ | Bir cihazda kapattığınızda diğerlerinde de kapanır |
| Whitelist (Muaf siteler) | ✅ | Eklediğiniz muaf siteler tüm cihazlarda geçerli |
| Özel CSS kuralları | ✅ | Element picker ile oluşturulan kurallar senkronize edilir |
| Manuel engellenen siteler | ✅ | Site engelleme listesi tüm cihazlarda aktif |
| Dil tercihi | ✅ | TR/EN seçimi tüm cihazlara yansır |
| AI anahtarları & modeller | ✅ | Gemini API key'leri cihazlar arası paylaşılır |
| İstatistikler | ❌ | Cihaza özel, senkronize edilmez |
| Bulut liste cache | ❌ | Cihaza özel, her cihaz kendi listesini indirir |
| Ebeveyn listesi cache | ❌ | Cihaza özel, her cihaz kendi listesini indirir |

> **Not:** `chrome.storage.sync` limiti toplam ~100KB'dır. Çok fazla özel kural eklenirse büyük kurallar otomatik olarak parçalara bölünerek saklanır.

## 👨‍👩‍👧 Ebeveyn Kontrolü & Site Engelleme

### Yetişkin İçerik Filtresi
Ayarlar sekmesinden tek tıkla aktif edilir. İlk açılışta liste indirilir (~birkaç saniye). 24 saatte bir otomatik güncellenir.

### Manuel Site Engelleme
| Pattern | Eşleşir |
|---------|---------|
| `site.com` | site.com ve tüm subdomainleri (www, tr, m…) |
| `*.site.com` | Sadece subdomainler (tr.site.com, m.site.com) |
| `*.site.*` | Her uzantıda engelle (.net, .org, .co.uk…) |

Engellenen siteye gidildiğinde sayfa içeriği görünmeden `blocked.html` sayfasına yönlendirilir. Google'a yönlendirme seçeneği de mevcuttur.



### For Developers (Load Unpacked)

1. Clone this repository:
   ```bash
   git clone https://github.com/gkhantyln/AdShieldPro.git
   ```
2. Open **Chrome** and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked**.
5. Select the `AdShieldPro` directory.

## 🔧 Technical Details

- **Manifest V3:** Chrome extension standartlarıyla tam uyumlu.
- **Declarative Net Request:** Native browser API ile sayfa içeriğine dokunmadan engelleme.
- **ABP Filter Parser:** `||domain^` formatındaki kuralları runtime'da DNR formatına parse eder. Cosmetic (`##`), snippet ve whitelist (`@@`) kuralları atlanır.
- **Dynamic Content Scripting:** Eklenti durumuna göre script'ler dinamik olarak register/unregister edilir.
- **Heuristic Obfuscation:** `HTMLCanvasElement` ve `AudioContext` prototype'larını override ederek fingerprinting algoritmalarını bozar.
- **Semantic Text Analytics:** `chrome.runtime.sendMessage` üzerinden Google Generative AI endpoint'ini sorgular. HTTP 429 durumunda otomatik key rotasyonu yapar.
- **Anti-Adblock Bypass:** `googletag`, `adsbygoogle`, `dataLayer` stub nesneleri ile adblock detector'ları yanıltır.
- **MutationObserver:** Dinamik yüklenen reklamları ve 1x1 tracking pixel'leri yakalar.

## 📊 Rakip Karşılaştırması

| Özellik | AdShield Pro | uBlock Origin | AdBlock Plus | AdGuard | Ghostery |
|---------|-------------|---------------|--------------|---------|---------|
| YouTube Reklam Engelleme | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| YouTube Skip + Hızlandırma | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐ | ⭐ |
| Anti-Adblock Bypass | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| Canvas Fingerprint Koruması | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Audio Fingerprint Koruması | ⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐ | ⭐⭐⭐ |
| WebRTC IP Sızıntı Koruması | ⭐⭐⭐⭐ | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| Sosyal Medya Tracker Engelleme | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| AI Clickbait Filtresi | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐ | ⭐ |
| Ebeveyn Kontrolü | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐⭐⭐⭐ | ⭐ |
| Manuel Site Engelleme | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐ |
| Element Picker | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐ |
| Bulut Liste Desteği (ABP) | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| Türkçe Filtre Listesi | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| Canlı Yayın / Futbol Desteği | ⭐⭐⭐⭐⭐ | ⭐ | ⭐ | ⭐ | ⭐ |
| Çoklu Cihaz Sync | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Beacon / 1x1 Pixel Engelleme | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Sayfa Bazlı Gerçek Zamanlı Sayaç | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Manifest V3 Uyumluluğu | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Açık Kaynak | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

> ⭐⭐⭐⭐⭐ Mükemmel &nbsp;|&nbsp; ⭐⭐⭐⭐ İyi &nbsp;|&nbsp; ⭐⭐⭐ Orta &nbsp;|&nbsp; ⭐⭐ Zayıf &nbsp;|&nbsp; ⭐ Yok / Desteklenmiyor

## 🤝 Contributing

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

## 👤 Author

**Gökhan TAYLAN**

- 📷 Instagram: [@ayzvisionstudio](http://instagram.com/ayzvisionstudio)
- 💼 LinkedIn: [gkhantyln](https://www.linkedin.com/in/gkhantyln/)
- 📧 Email: [tylngkhn@gmail.com](mailto:tylngkhn@gmail.com)
- ✈️ Telegram: [@llcoder](https://t.me/llcoder)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---
<div align="center">
  <sub>Built with ❤️ by Gökhan TAYLAN</sub>
</div>
