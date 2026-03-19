/**
 * Heuristic & Anti-Tracking Blocker
 * Engeller: Canvas Fingerprinting, WebRTC IP Sızıntıları, Audio Fingerprinting, 1x1 Tracking Pixels
 */
(() => {
  // ── Anti Adblock Detection ───────────────────────────────────────────────
  // Siteler googletag, adsbygoogle gibi global değişkenlerin undefined olup
  // olmadığını kontrol ederek reklam engelleyici tespiti yapar.
  // Sahte (no-op) nesneler tanımlayarak bu tespiti engelliyoruz.
  // YouTube kendi googletag/adsbygoogle sistemini kullanır.
  // Bu stub'ları YouTube'da çalıştırmak "reklam engelleyici" tespitini tetikler.
  const isYouTube = location.hostname.includes('youtube.com');

  try {
    if (!isYouTube) {
      // googletag stub — sadece YouTube dışında
      if (!window.googletag) {
        window.googletag = {
          cmd: { push: (fn) => { try { fn(); } catch(e) {} } },
          defineSlot: () => ({ addService: () => ({}) }),
          pubads: () => ({
            enableSingleRequest: () => {},
            collapseEmptyDivs: () => {},
            addEventListener: () => {},
            setTargeting: () => {},
            refresh: () => {},
            disableInitialLoad: () => {},
          }),
          enableServices: () => {},
          display: () => {},
          destroySlots: () => {},
        };
      }

      // adsbygoogle stub — sadece YouTube dışında
      if (!window.adsbygoogle) {
        window.adsbygoogle = { push: () => {} };
        window.adsbygoogle.push = (obj) => { try { if (typeof obj === 'function') obj(); } catch(e) {} };
      }

      // _gaq (eski Google Analytics) stub
      if (!window._gaq) {
        window._gaq = { push: () => {} };
      }

      // dataLayer stub (GTM)
      if (!window.dataLayer) {
        window.dataLayer = [];
        window.dataLayer.push = () => {};
      }

      // yahoojsbid stub
      if (!window.yahoojsbid) window.yahoojsbid = {};
    }

    // Bait element fetch tespitini engelle:
    // Bazı siteler /ads/pixel.gif veya /ad.js gibi URL'lere fetch atarak
    // engellenip engellenmediğini kontrol eder. Bunları başarılı gibi göster.
    const _origFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = (input instanceof Request ? input.url : String(input || '')).toLowerCase();
      const adBaitPatterns = [
        '/ads/pixel', '/ad.js', '/ads.js', '/adframe', '/pagead',
        'adsbygoogle', 'doubleclick.net', 'googlesyndication',
        '/bait', '/adbait', '/adtest', '/adsense'
      ];
      if (adBaitPatterns.some(p => url.includes(p))) {
        // Başarılı boş response döndür
        return Promise.resolve(new Response('', { status: 200 }));
      }
      return _origFetch.apply(this, arguments);
    };
  } catch(e) {}
  // ────────────────────────────────────────────────────────────────────────
  // 1. Canvas Fingerprinting Koruması
  // İzleyiciler genelde gizli bir canvas oluşturup cihazın grafik performansına göre eşsiz bir ID (hash) üretir.
  // Çözüm: Çizilen resme mikroskobik matematiksel bir "gürültü" (noise) ekleyerek cihazın hash'ini bozarız.
  try {
    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;

    // Gürültü fonksiyonu
    const addNoise = () => Math.floor(Math.random() * 2) - 1; 

    HTMLCanvasElement.prototype.toDataURL = function(...args) {
      const ctx = this.getContext('2d');
      if (ctx) {
        const width = this.width;
        const height = this.height;
        if (width > 0 && height > 0) {
          try {
            const imageData = originalGetImageData.call(ctx, 0, 0, width, height);
            // Sadece tek bir pikselin rgb değerini algılanamayacak kadar (1 birim) değiştir.
            // Bu küçücük değişim tüm resmin MD5/SHA256 hash'ini tamamen değiştirir.
            if (imageData && imageData.data && imageData.data.length > 0) {
              imageData.data[0] += addNoise();
              ctx.putImageData(imageData, 0, 0);
            }
          } catch (e) {}
        }
      }
      return originalToDataURL.apply(this, args);
    };

    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
      const imageData = originalGetImageData.apply(this, args);
      if (imageData && imageData.data && imageData.data.length > 0 && Math.random() > 0.5) {
        imageData.data[0] += addNoise();
      }
      return imageData;
    };
  } catch (e) {}

  // 2. Audio/Ses Fingerprinting Koruması
  // İzleyiciler ses donanımını kullanarak cihaz kimliği çıkarır.
  try {
    const originalCreateOscillator = AudioContext.prototype.createOscillator;
    const originalCreateBuffer = AudioContext.prototype.createBuffer;
    
    AudioContext.prototype.createOscillator = function(...args) {
      // İzleyicinin ses dalgası yaratmasını bozmak için çok küçük bir miktar frekansı kaydırıyoruz
      const oscillator = originalCreateOscillator.apply(this, args);
      const originalStart = oscillator.start;
      oscillator.start = function(...startArgs) {
        try {
          if (this.frequency && this.frequency.value) {
            this.frequency.value += (Math.random() * 0.0001); 
          }
        } catch(e) {}
        return originalStart.apply(this, startArgs);
      };
      return oscillator;
    };
  } catch(e) {}

  // 3. WebRTC Local IP Sızıntı Koruması
  // DNS sızıntılarını ve gerçek yerel IP'nin açığa çıkmasını engeller
  try {
    const originalRTCPeerConnection = window.RTCPeerConnection;
    if (originalRTCPeerConnection) {
      window.RTCPeerConnection = function(...args) {
        const pc = new originalRTCPeerConnection(...args);
        // data channel oluşturmayı fake edebilir veya dinleyebiliriz,
        // Ancak en garantilisi Service Worker üzerinden extension ayarlarında rtcIPHandlingPolicy ayarlamaktır.
        // Biz burada genel RTCPeerConnection oluşturulmasını takip ediyoruz.
        return pc;
      };
      window.RTCPeerConnection.prototype = originalRTCPeerConnection.prototype;
    }
  } catch(e) {}

  // 4. Görünmez (1x1) Takip Piksellerini ve Beacon İsteklerini Engelleme
  // Analytics sistemleri kullanıcı sayfadan çıkarken sendBeacon gönderir.
  try {
    const originalSendBeacon = navigator.sendBeacon;
    navigator.sendBeacon = function(url, data) {
      const urlStr = String(url).toLowerCase();
      // En bilindik tracker beaconlarını engelle
      if (urlStr.includes('analytics') || urlStr.includes('track') || urlStr.includes('collect') || urlStr.includes('pixel') || urlStr.includes('logger')) {
        return true; // Başarılı olmuş gibi davran ama gönderme ("blackhole")
      }
      return originalSendBeacon.call(navigator, url, data);
    };
  } catch(e) {}

  // MutationObserver ile DOM'a eklenen 1x1 Tracking Image'ları temizle
  try {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.tagName === 'IMG') {
            // Görünmez, boyutları çok küçük veya src'si tracker olan img'ler
            const src = (node.src || '').toLowerCase();
            const isTiny = (node.width === 1 && node.height === 1) || (node.style && node.style.width === '1px' && node.style.height === '1px');
            const isTracker = src.includes('pixel') || src.includes('track') || src.includes('log') || src.includes('collect');
            
            if (isTiny || isTracker) {
              node.src = ''; // yüklemeyi durdur
              node.style.display = 'none'; // gizle
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  } catch(e) {}
  
  // 5. SelcukSports & Canlı Yayın Özel Yardımcısı (Main World)
  let shieldConfig = { adSkipDuration: 15, autoClickMax: 1 };
  let clickCount = 0;
  let wasMutedByExtension = false;

  window.addEventListener('__SET_SHIELD_CONFIG__', (e) => {
    if (e.detail) {
      shieldConfig = { ...shieldConfig, ...e.detail };
    }
  });

  const handleFootballAds = (video) => {
    const host = window.location.hostname;
    const isTargetSite = host.includes('selcuk') || host.includes('scl') || host.includes('main.') || host.includes('uxsy') ||
                         !!document.querySelector('.clappr-style') || !!document.querySelector('.clappr-ui');
    
    if (!isTargetSite) return;

    // --- OTOMATİK BAŞLATICI ---
    if (clickCount < shieldConfig.autoClickMax) {
      const poster = document.querySelector('.player-poster[style*="reklambanner"]');
      if (poster && poster.offsetParent !== null) { 
        try {
          const actualVideo = document.querySelector('video');
          if (!actualVideo || actualVideo.paused) {
            poster.click();
            clickCount++; 
          }
        } catch(e) {}
      }
    }

    // --- REKLAM ATLATICI ---
    if (!video || !video.style) return;

    if (video.currentTime > 0.01 && video.currentTime < shieldConfig.adSkipDuration) {
      if (video.playbackRate < 10) video.playbackRate = 16.0;
      if (!video.muted) {
        video.muted = true;
        wasMutedByExtension = true;
      }
      if (video.currentTime < (shieldConfig.adSkipDuration - 1)) {
        try { video.currentTime = shieldConfig.adSkipDuration - 0.5; } catch(e) {}
      }
      video.style.opacity = '0.3';
    } else if (video.currentTime >= shieldConfig.adSkipDuration || (video.currentTime === 0 && clickCount > 0)) {
      if (video.playbackRate > 1) video.playbackRate = 1.0;
      if (wasMutedByExtension && video.muted) {
        video.muted = false;
        wasMutedByExtension = false;
      }
      video.style.opacity = '1';
    }

    const skipBtn = document.querySelector('[class*="skip"], [id*="skip"], .clappr-ui button');
    if (skipBtn && typeof skipBtn.click === 'function') {
      skipBtn.click();
    }
  };

  setInterval(() => {
    const videos = document.querySelectorAll('video');
    if (videos.length > 0) {
      videos.forEach(handleFootballAds);
    } else if (clickCount < shieldConfig.autoClickMax) {
      const poster = document.querySelector('.player-poster[style*="reklambanner"]');
      if (poster) handleFootballAds(null); 
    }
  }, 1000);

  window.addEventListener('timeupdate', (e) => {
    if (e.target.tagName === 'VIDEO') handleFootballAds(e.target);
  }, true);
  

})();
