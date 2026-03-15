<div align="center">

# 🛡️ AdShield Pro v2.0
### The Ultimate Ad Blocking Experience

<img alt="image.png" data-hpc="true" src="https://github.com/gkhantyln/AdShieldPro/blob/main/image.png" style="max-width: 100%;">

[![Version](https://img.shields.io/badge/version-2.0%20Pro-blue.svg?style=for-the-badge)](https://github.com/gkhantyln/AdShieldPro)
[![License](https://img.shields.io/badge/license-MIT-green.svg?style=for-the-badge)](LICENSE)
[![Chrome](https://img.shields.io/badge/Chrome-Extension-4285F4.svg?style=for-the-badge&logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](http://makeapullrequest.com)

[**Install Now**](#installation) • [**Features**](#key-features) • [**Contributing**](#contributing)

---
</div>

## 🚀 Overview

**AdShield Pro** is not just another ad blocker. It is a high-performance, intelligent content filtering engine designed to reclaim your browsing experience. Built with a focus on speed, privacy, and user control, AdShield Pro eliminates intrusive ads, trackers, and annoyances across the web, including YouTube.

Say goodbye to distractions and hello to a cleaner, faster, and safer internet.

## ✨ Key Features

- **⚡ Zero-Footprint Performance:** The extension injects memory-friendly filtering scripts dynamically and instantly unloads them when turned OFF. Employs hardware-accelerated (`requestAnimationFrame`) algorithms instead of heavy loops (`setInterval`) to ensure CPU/RAM usage stays near zero.
- **🚫 Advanced Ad Blocking:** Automatically blocks banners, pop-ups, video ads, and trackers.
- **🛡️ Heuristic Anti-Tracking (New!):** Next-gen privacy shield blocks Canvas/Audio Fingerprinting, intercepts WebRTC leaks, and neutralizes invisible 1x1 tracking pixels and outbound beacon requests.
- **🧠 AI-Powered Content Filter (New!):** Integrates with Google's Generative AI to semantically analyze text segments (news, articles) and automatically collapse clickbait or undisclosed "Sponsored" content. Includes a dynamic model fetcher (letting users pick from `gemini-1.5-pro` to `gemini-2.5-flash`) and a multi-API-key fallback system.
- **🎯 Smart Element Picker (Upgraded!):** Point and click to remove ANY element permanently. Features an intelligent hierarchical DOM traversing selector that analyzes parent nodes and siblings (`nth-of-type`) to create unbreakable CSS rules, actively avoiding dynamic or randomized framework classes.
- **📺 YouTube Ad Defense:** Enjoy uninterrupted video streaming without pre-roll or mid-roll ads. Stops ads right at the network level.
- **📊 Real-time Statistics:** Visualize how many ads and trackers have been blocked daily and per site.
- **🏆 Gamification & Insights:** See exactly how much mobile data you've saved and how many hours of loading time you've reclaimed, calculating industry-standard weights dynamically on the dashboard.
- **🌑 Dark Mode UI:** A beautiful, modern, and eye-friendly dark interface.
- **🔒 Privacy First:** No data collection. Your browsing history stays on your device.

## 🛠️ Installation

### For Developers (Load Unpacked)

1.  Clone this repository:
    ```bash
    git clone https://github.com/gkhantyln/AdShieldPro.git
    ```
2.  Open **Chrome** and navigate to `chrome://extensions/`.
3.  Enable **Developer mode** (toggle in the top right corner).
4.  Click **Load unpacked**.
5.  Select the `AdShieldPro` directory.
6.  Enjoy a cleaner web! 🎉


## 🔧 Technical Details

- **Manifest V3:** Fully compliant with the latest Chrome extension standards for better security and performance.
- **Declarative Net Request:** Uses the native browser API for efficient blocking without inspecting page content unnecessarily.
- **Dynamic Content Scripting:** Injector, blocker, and picker JS files are dynamically registered and unregistered on-the-fly depending on the extension's functional state.
- **Heuristic Obfuscation Model:** Overrides deep browser components like `HTMLCanvasElement` and `AudioContext` prototypes by adding mathematical noise to disrupt digital fingerprinting algorithms.
- **Semantic Text Analytics:** Debounced chunked-processing via `chrome.runtime.sendMessage` securely queries Google's Generative AI endpoint. Utilizes array fallback logic to bypass `HTTP 429` (Rate-limit) issues without blocking the main UI thread.
- **MutationObserver:** Intelligently monitors DOM changes to catch ads that load dynamically after the page renders, as well as invisible 1x1 pixels.

## 🤝 Contributing

We love open source! Contributions are welcome.

1.  Fork the repository.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

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
