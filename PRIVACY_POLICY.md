# Privacy Policy — AdShield Pro

**Last updated:** March 17, 2026
**Effective date:** March 17, 2026
**Extension ID:** eibnkbhhjiogbffbbfjpamabjmlchmbd
**Developer:** Gökhan TAYLAN — tylngkhn@gmail.com

---

## 1. Introduction

AdShield Pro ("the Extension") is a browser extension that blocks advertisements, trackers, and malicious content. This Privacy Policy describes in full detail what data is collected, how it is stored, how long it is retained, whether it is shared, and what rights you have as a user.

We are committed to full transparency. **The developer of AdShield Pro has no access to your data at any time.**

---

## 2. Summary (Plain Language)

| Question | Answer |
|----------|--------|
| Do we collect your browsing history? | **No** |
| Do we collect personal information? | **No** |
| Do we send data to our servers? | **No — we have no servers** |
| Is your Gemini API key sent to us? | **No — it never leaves your device/browser** |
| Do we sell or share your data? | **No** |
| Do we use analytics or tracking? | **No** |

---

## 3. Data We Collect and Store

### 3.1 Data We Do NOT Collect

AdShield Pro does **not** collect, transmit, log, or share any of the following:

- Browsing history or visited URLs
- Personally identifiable information (PII) of any kind
- IP addresses or geolocation data
- Device identifiers or hardware fingerprints
- Keystrokes, form inputs, or passwords
- Analytics, telemetry, or crash reports

**The developer operates no servers and receives no data from users.**

### 3.2 Data Stored Locally (`chrome.storage.local`)

The following data is stored exclusively on your device and is never transmitted to the developer or any third party:

| Data | Purpose | Accessible by developer? |
|------|---------|--------------------------|
| Extension on/off state | Remember your preference | **No** |
| Pause timer | Remember pause duration | **No** |
| Custom blocking rules | Apply your personal CSS rules | **No** |
| Whitelisted domains | Skip blocking on chosen sites | **No** |
| Ad blocking statistics (counts only, no URLs) | Display stats in the popup | **No** |
| YouTube ad-skip settings | Customize YouTube behavior | **No** |
| Cloud rule version & last update timestamp | Track rule freshness | **No** |
| AI usage statistics (token count, blocked count) | Display AI stats in popup | **No** |

### 3.3 Data Stored in Sync Storage (`chrome.storage.sync`)

The following data is stored in `chrome.storage.sync`, which is managed by Chrome/Google and may be synchronized across your signed-in Chrome devices:

| Data | Purpose | Accessible by developer? |
|------|---------|--------------------------|
| AI feature enabled/disabled state | Sync your AI preference across devices | **No** |
| Gemini API key(s) you enter | Authenticate with Google Gemini API | **No** |

**Important note about your Gemini API key:**

- Your API key is stored in `chrome.storage.sync`, which is a browser-managed storage area controlled entirely by Google Chrome.
- The developer of AdShield Pro has **zero access** to `chrome.storage.sync` data. It is never transmitted to, read by, or stored on any server owned by the developer.
- The key is used exclusively to make direct API calls from your browser to Google's Gemini API. AdShield Pro does not proxy, intercept, log, or forward this key.
- If you are signed into Chrome, Google may sync this storage across your devices as part of Chrome's built-in sync feature. This sync is governed by [Google's Privacy Policy](https://policies.google.com/privacy), not by AdShield Pro.
- You can remove your API key at any time from the extension's Settings tab.

---

## 4. How Data Is Processed

### 4.1 Ad Blocking (Core Feature)

AdShield Pro uses Chrome's built-in `declarativeNetRequest` API to block network requests. This API operates entirely within the browser — no request data is sent to the developer. The extension matches URLs against locally stored and remotely fetched rule lists without transmitting any browsing data externally.

### 4.2 Remote Rule List Updates

AdShield Pro periodically fetches a JSON rule list from GitHub to keep blocking rules current. During this fetch:

- Only a static list of URL patterns is downloaded
- No personal data, browsing history, or user identifiers are transmitted
- No executable code is downloaded or run
- The connection is one-way: download only

### 4.3 Optional AI Content Filter (Google Gemini API)

The AI Content Filter is an **optional feature** that is **disabled by default**. It is only active if you explicitly enable it and provide your own Gemini API key.

When enabled:

- Your browser sends page text snippets **directly** to Google's Gemini API using the API key you provided
- AdShield Pro does **not** act as a proxy or intermediary — the request goes directly from your browser to Google
- The developer of AdShield Pro **cannot see, intercept, or store** any part of this communication
- The API key is stored locally in `chrome.storage.sync` and is never transmitted to the developer
- You can disable this feature or remove your API key at any time

This feature's data processing is governed by [Google's Privacy Policy](https://policies.google.com/privacy).

---

## 5. Legal Basis for Processing

AdShield Pro processes data stored on your device solely to deliver the extension's core functionality. No personal data is collected or processed by the developer.

For optional features involving third-party services (Google Gemini API), processing is based on your explicit consent, which you provide by entering your API key and enabling the feature. You may withdraw consent at any time by disabling the feature or removing your key.

---

## 6. Data Retention

| Data | Retention Period |
|------|-----------------|
| Local settings and rules | Until you uninstall the extension or clear it manually |
| Sync storage (AI key, AI enabled state) | Until you remove it from the extension settings or clear Chrome sync data |
| Developer-held data | None — the developer holds no user data |

---

## 7. Data Sharing and Third Parties

AdShield Pro does **not** sell, rent, trade, or share user data with any third party.

The extension interacts with the following external services solely at your direction:

| Service | Interaction | Data Sent | Governed By |
|---------|-------------|-----------|-------------|
| Google Gemini API | Optional AI content analysis (only if you enable it and provide a key) | Page text snippets sent directly from your browser | [Google Privacy Policy](https://policies.google.com/privacy) |
| GitHub | Downloading ad-blocking rule list updates | No user data sent | [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) |

---

## 8. Permissions Justification

Chrome requires the following permissions, each with a specific and necessary purpose:

| Permission | Why It Is Required |
|---|---|
| `activeTab` | Apply blocking rules on the currently active tab |
| `alarms` | Schedule periodic rule list updates in the background |
| `storage` | Save your settings, custom rules, and statistics locally |
| `scripting` | Inject content scripts to remove cosmetic ad elements from pages |
| `tabs` | Read the current tab URL to apply site-specific rules |
| `declarativeNetRequest` | Block ad and tracker network requests natively via Chrome's built-in API |
| `declarativeNetRequestFeedback` | Display blocking statistics to you in the popup |
| `host_permissions (<all_urls>)` | Apply blocking rules across all websites you visit |

No permission is used for data collection or surveillance.

---

## 9. Your Rights

Depending on your jurisdiction (including GDPR, CCPA, and similar laws), you may have the following rights:

- **Right to Access:** Request information about data held about you
- **Right to Erasure:** Request deletion of your data
- **Right to Rectification:** Request correction of inaccurate data
- **Right to Object:** Object to certain types of processing
- **Right to Data Portability:** Request a copy of your data in a portable format
- **Right to Withdraw Consent:** Withdraw consent for optional features at any time

Since AdShield Pro does not collect or store any personal data on external servers, these rights are primarily exercised directly on your device:

- **To delete all extension data:** Uninstall the extension or use Chrome's "Clear data" option for the extension
- **To remove your Gemini API key:** Open the extension popup → Settings → AI Filter → remove your key
- **To disable AI processing:** Toggle off the AI Content Filter in Settings

For any privacy-related inquiries, contact: **tylngkhn@gmail.com**

---

## 10. Children's Privacy

AdShield Pro does not knowingly collect any data from anyone, including children under the age of 13 (or the applicable age of digital consent in your jurisdiction). The extension collects no personal data from any user of any age.

---

## 11. Security

- All extension data is stored using Chrome's built-in storage APIs (`chrome.storage.local` and `chrome.storage.sync`), which are sandboxed and inaccessible to other extensions or websites
- The developer operates no servers, databases, or infrastructure that stores user data
- There is no risk of a developer-side data breach because no user data is ever transmitted to the developer
- Your Gemini API key is stored in Chrome's sync storage and is only transmitted directly to Google's API endpoints over HTTPS

---

## 12. Changes to This Policy

If this Privacy Policy is updated, the revised version will be published at the same URL with an updated "Last updated" date. For significant changes, we will update the extension version notes. Continued use of the extension after changes constitutes acceptance of the updated policy.

---

## 13. Contact

For questions, concerns, or privacy-related requests:

**Gökhan TAYLAN**
- Email: tylngkhn@gmail.com
- GitHub: [github.com/gkhantyln](https://github.com/gkhantyln)
- Extension ID: eibnkbhhjiogbffbbfjpamabjmlchmbd
