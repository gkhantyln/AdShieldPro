(() => {
  function select(selector, root = document) {
    return root.querySelector(selector);
  }

  function selectAll(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function hideElements(selectors) {
    for (const selector of selectors) {
      for (const el of selectAll(selector)) {
        if (el && el.style && el.style.display !== 'none') {
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
        }
      }
    }
  }

  function tryClick(el) {
    if (!el) return false;
    try { el.click(); return true; } catch (_) { return false; }
  }

  function skipVideoAd() {
    const skipButtons = [
      '.ytp-ad-skip-button',
      '.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-container button',
      'button.ytp-skip-ad-button',
      'button.ytp-ad-skip-button'
    ];
    for (const selector of skipButtons) {
      const btn = select(selector);
      if (btn && tryClick(btn)) return true;
    }
    return false;
  }

  function isAdPlaying() {
    if (document.querySelector('.ad-showing')) return true;
    if (document.querySelector('.ytp-ad-player-overlay')) return true;
    if (document.querySelector('.ytp-ad-text, .ytp-ad-message-container')) return true;
    return false;
  }

  let wasAutomuted = false;

  function handleAdPlayback() {
    const video = select('video');
    if (!video) return;
    if (!Number.isFinite(video.duration) || video.duration <= 0) return;

    const ad = isAdPlaying();

    if (ad) {
      if (!video.muted) {
        video.muted = true;
        wasAutomuted = true;
      }
      video.style.setProperty('opacity', '0', 'important');
      video.playbackRate = 16;

      const skipped = skipVideoAd();
      if (!skipped) {
        try {
          if (video.currentTime < video.duration - 0.5) {
            video.currentTime = video.duration - 0.5;
          }
        } catch (_) {}
      }
    } else {
      if (video.playbackRate !== 1) video.playbackRate = 1;
      if (video.style.opacity === '0') video.style.removeProperty('opacity');
      if (wasAutomuted) {
        video.muted = false;
        wasAutomuted = false;
      }
    }
  }

  function removeAdOverlays() {
    const adSelectors = [
      '#player-ads',
      '.video-ads',
      '.ytp-ad-image-overlay',
      '.ytp-ad-overlay-slot',
      '.ytd-promoted-sparkles-web-renderer',
      'ytd-display-ad-renderer',
      'ytd-action-companion-ad-renderer',
      'ytd-in-feed-ad-layout-renderer',
      'ytd-ad-slot-renderer',
      '.ytp-ad-module',
      '.ytp-paid-content-overlay',
      '#masthead-ad'
    ];

    const isVideoPage = window.location.pathname.includes('/watch');
    if (isVideoPage) {
      adSelectors.push(
        'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-macro-markers-description-chapters"] .ad-container'
      );
    }
    hideElements(adSelectors);
  }

  let scheduled = false;
  function scheduleTick() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; tick(); });
  }

  function tick() {
    removeAdOverlays();
    skipVideoAd();
    handleAdPlayback();
  }

  function start() {
    const isVideoPage = window.location.pathname.includes('/watch');
    const isChannelPage = window.location.pathname.includes('/channel/') || window.location.pathname.includes('/@');
    if (isChannelPage) return;

    if (isVideoPage) {
      const videoContainer = select('#movie_player') || select('ytd-player') || document.body;
      if (videoContainer) {
        let mutScheduled = false;
        const observer = new MutationObserver((mutations) => {
          if (mutScheduled) return;
          const hasAdChanges = mutations.some(m => {
            const t = m.target;
            return t && t.classList && (
              t.classList.contains('ad-showing') ||
              t.classList.contains('ytp-ad-player-overlay') ||
              t.classList.contains('video-ads') ||
              t.id === 'player-ads'
            );
          });
          if (hasAdChanges) {
            mutScheduled = true;
            requestAnimationFrame(() => { mutScheduled = false; tick(); });
          }
        });
        observer.observe(videoContainer, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
      }

      // Add event listeners instead of setInterval for better performance
      document.addEventListener('timeupdate', (e) => {
          if (e.target.tagName === 'VIDEO' && isAdPlaying()) tick();
      }, true);
      
      document.addEventListener('play', (e) => {
          if (e.target.tagName === 'VIDEO') tick();
      }, true);
    }

    // İlk taramayı yap
    scheduleTick();

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleTick();
    });
  }

  try { start(); } catch(e) {}
})();
