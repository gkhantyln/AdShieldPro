/**
 * AI-Powered Semantic Content Filter (Gemini 2.5 Flash)
 * Analyzes news and article chunks for clickbait or undisclosed sponsored content.
 */
(() => {
  let isAiEnabled = false;

  // Initial Check
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
    if (response && response.success && response.aiEnabled && response.aiKeys && response.aiKeys.length > 0) {
      isAiEnabled = true;
      initAIFilter();
    }
  });

  // Listen for background state changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && ('aiEnabled' in changes || 'aiKeys' in changes)) {
      isAiEnabled = changes.aiEnabled ? changes.aiEnabled.newValue : isAiEnabled;
      const keys = changes.aiKeys ? changes.aiKeys.newValue : [];
      if (isAiEnabled && keys && keys.length > 0) {
          initAIFilter();
      } else {
          isAiEnabled = false;
      }
    }
  });

  const processedElements = new WeakSet();

  function blockElement(element, tag) {
    if (!element || processedElements.has(element)) return;

    // Create an overlay instead of direct deletion to show it's "AI Blocked"
    const overlay = document.createElement('div');
    overlay.style.cssText = `
       padding: 10px;
       margin: 10px 0;
       background: rgba(139, 92, 246, 0.1);
       border: 1px dashed rgba(139, 92, 246, 0.4);
       border-radius: 8px;
       color: #8b5cf6;
       font-family: sans-serif;
       font-size: 13px;
       font-weight: bold;
       text-align: center;
       cursor: pointer;
    `;
    overlay.innerText = `🤖 İçerik AI tarafından gizlendi (${tag})`;
    
    // Original element backup and hide
    const originalDisplay = element.style.display;
    element.style.display = 'none';
    
    // Toggle view on click
    overlay.onclick = () => {
      if (element.style.display === 'none') {
        element.style.display = originalDisplay;
        overlay.innerText = '🤖 AI: Orijinal içerik gösteriliyor (Gizle)';
        overlay.style.background = 'transparent';
      } else {
        element.style.display = 'none';
        overlay.innerText = `🤖 İçerik AI tarafından gizlendi (${tag})`;
        overlay.style.background = 'rgba(139, 92, 246, 0.1)';
      }
    };

    if (element.parentNode) {
       element.parentNode.insertBefore(overlay, element);
    }
    processedElements.add(element);
  }

  async function checkWithAI(element, text) {
    if (!text || text.length < 20 || !isAiEnabled) return;
    
    processedElements.add(element); // Mark as in-progress or processed to prevent double fetch

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'CHECK_AI_CONTENT', text: text }, resolve);
      });

      if (response && response.success && response.isClickbait) {
        blockElement(element, 'Clickbait / Sponsorlu');
      }
    } catch (e) {
      console.error("AI Check failed", e);
    }
  }

  function debounce(fn, ms) {
      let timer;
      return function(...args) {
          clearTimeout(timer);
          timer = setTimeout(() => fn.apply(this, args), ms);
      };
  }

  function scanDOM() {
    if (!isAiEnabled) return;

    // Hedef: Genelde haber başlıkları, özetler veya sponsorlu makaleler
    // h2, h3 veya büyük text bloklarını (haber widgetları vb.) analiz et
    const elements = document.querySelectorAll('article, .post, .article, .news-item, .card, 	.widget, h2, h3, a[href*="http"], div[class*="native"], div[class*="sponsor"]');
    
    for (const el of elements) {
      if (processedElements.has(el)) continue;

      // Extract text content and clean it
      const text = (el.innerText || '').trim();
      
      // Too short to judge or too long (skip full huge article text, focus on headers/excerpts)
      if (text.length < 30 || text.length > 500) {
        processedElements.add(el); 
        continue;
      }

      // Check with AI async
      checkWithAI(el, text);
    }
  }

  const debouncedScan = debounce(scanDOM, 1000);

  function initAIFilter() {
    scanDOM();
    const observer = new MutationObserver((mutations) => {
        let shouldScan = false;
        for (const mut of mutations) {
            if (mut.addedNodes.length > 0) {
                shouldScan = true;
                break;
            }
        }
        if (shouldScan) debouncedScan();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
  }

})();
