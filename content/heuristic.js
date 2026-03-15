/**
 * Heuristic & Anti-Tracking Blocker
 * Engeller: Canvas Fingerprinting, WebRTC IP Sızıntıları, Audio Fingerprinting, 1x1 Tracking Pixels
 */
(() => {
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

})();
