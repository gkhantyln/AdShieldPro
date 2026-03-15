# Privacy Policy — AdShield Pro

**Last updated:** March 15, 2026

## Overview

AdShield Pro is a browser extension designed to block ads, trackers, and malicious content. We are committed to protecting your privacy.

## Data Collection

**AdShield Pro does not collect, store, transmit, or share any personal data.**

- No browsing history is collected
- No personally identifiable information (PII) is collected
- No data is sent to any external server owned by the developer
- No analytics or telemetry is used

## Data Stored Locally

The following data is stored **only on your device** using `chrome.storage.local`:

- Extension settings and preferences (enabled/disabled state, pause timers)
- Custom blocking rules you create
- Whitelisted domains you add
- Ad blocking statistics (counts only, no URLs or personal data)
- Gemini AI API keys you optionally enter (stored locally, never transmitted to our servers)

## Remote Connections

AdShield Pro fetches a **JSON rule list** from a remote URL (GitHub) to keep ad-blocking rules up to date. This connection:

- Only downloads a list of URL patterns to block (no personal data is sent)
- Does not transmit any information about your browsing activity
- Does not include any executable code

If you use the optional AI Content Filter feature, your browser communicates directly with **Google's Gemini API** using the API key you provide. This communication is between your browser and Google — AdShield Pro does not proxy or store this data.

## Third-Party Services

- **Google Gemini API** (optional, only if you enable AI filtering): Subject to [Google's Privacy Policy](https://policies.google.com/privacy)
- **GitHub** (for rule list updates): Subject to [GitHub's Privacy Policy](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

## Permissions Justification

| Permission | Reason |
|---|---|
| `activeTab` | Apply blocking rules on the current tab |
| `alarms` | Schedule automatic rule list updates |
| `storage` | Save settings and rules locally on your device |
| `scripting` | Inject content scripts for cosmetic ad removal |
| `tabs` | Detect current tab URL for site-specific rules |
| `declarativeNetRequest` | Block ad/tracker network requests natively |
| `declarativeNetRequestFeedback` | Show blocking statistics to the user |
| `host_permissions (<all_urls>)` | Apply blocking rules across all websites |

## Children's Privacy

AdShield Pro does not knowingly collect any data from anyone, including children under 13.

## Changes to This Policy

If this policy changes, the updated version will be published at this URL with a new "Last updated" date.

## Contact

**Gökhan TAYLAN**
- GitHub: [github.com/gkhantyln](https://github.com/gkhantyln)
- Email: tylngkhn@gmail.com
