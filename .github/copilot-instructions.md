# 🧩 Project: TLS Inspector Detector (Firefox Extension)

## Overview
A Firefox WebExtension that detects whether a configured keyword (e.g. **Zscaler**) appears in the TLS certificate chain of any HTTPS connection.  
Useful for identifying if TLS interception, middleboxes, or custom enterprise CAs are active.

---

## Core Behavior
- Monitors **all HTTPS requests** via the `webRequest` API.  
- Retrieves TLS data using `browser.webRequest.getSecurityInfo()` (certificate chain, protocol, cipher).  
- Caches the latest analysis **per host** in memory (`hostCertMap`).  
- Updates the **toolbar badge** automatically to reflect the current tab’s host:
  - ✅ **Green (OK):** secure, no keyword found  
  - ⚠️ **Orange (!):** keyword detected in cert chain  
  - ❌ **Red (!):** insecure connection or error  
- Clicking the toolbar icon opens a **popup** showing:
  - Keyword detection status  
  - Source URL, request type, TLS version, cipher suite  
  - Complete certificate chain (Subject + Issuer)

---

## Popup Features
- Displays cached info instantly — no reload or rescan required.  
- Includes a **⚙ Settings** button to open the options page via `browser.runtime.openOptionsPage()`.  
- Designed for compact readability with monospace details for certificate fields.

---

## Options Page
- Allows the user to set the **keyword** searched for in certificate subjects or issuers.  
- Saves configuration in `browser.storage.local`.  
- Defaults to `"zscaler"`.

---

## Technical Notes
- Built with **Manifest V2** for Firefox 143+.  
- Uses `webRequest.onHeadersReceived` across all types (`main_frame`, `script`, `image`, `xmlhttprequest`, etc.).  
- Responds to popup queries asynchronously (`sendResponse` + `return true`).  
- TLS and certificate data are held in memory only — never persisted beyond the browser session.

---

## ⚙ Why Manifest V3 Cannot Be Used
Manifest V3 replaces the persistent background page with an **ephemeral `background.service_worker`**, which:

1. **Cannot stay alive continuously.**  
   - Service workers shut down shortly after handling an event, making it impossible to maintain a long-lived TLS state cache (`hostCertMap`) or respond to asynchronous events like `getSecurityInfo()` reliably.

2. **Has limited API access.**  
   - The `browser.webRequest.getSecurityInfo()` API is **not available** from service workers in Firefox.  
   - Even if it were, the lifecycle constraints of MV3 would make it unreliable for per-host TLS monitoring.

3. **Removes synchronous `webRequest` blocking mode.**  
   - MV3 enforces `declarativeNetRequest`, which cannot inspect TLS metadata or certificate chains.

Because this extension requires **continuous HTTPS monitoring**, **stateful caching**, and **direct TLS certificate inspection**,  
**Manifest V2 is mandatory** — `background.scripts` with `persistent: true` is the only working configuration.

---

## 🧪 Experimental MV3 Discussion

Although Manifest V3 cannot currently replace this extension’s functionality, in theory a partial adaptation could be attempted:

### Possible MV3 Structure
```json
{
  "manifest_version": 3,
  "background": { "service_worker": "background.js" },
  "permissions": ["webRequest", "webRequestBlocking", "storage"],
  "host_permissions": ["<all_urls>"]
}
```

### Potential Workaround
- Store per-host TLS results in `browser.storage.local` instead of an in-memory `Map`.  
- On popup open, the service worker could cold-start, read `storage.local`, and rehydrate the TLS info for that host.  

### Limitations
| Limitation | Impact |
|-------------|---------|
| `getSecurityInfo()` unavailable in MV3 service workers | 🚫 Cannot read TLS details |
| Worker termination after each event | ⚠️ Loses in-memory cache |
| No persistent state between events | ⚠️ Slow popup load |
| No `webRequest` blocking control | ⚠️ Less reliable sequencing |
| No real-time badge updates | ⚠️ Laggy or inconsistent UI |

**Conclusion:**  
Even with persistent storage, MV3 cannot provide continuous, real-time TLS inspection due to lack of API support and the service worker lifecycle model.  
Until `background.service_worker` gains persistent eventing and TLS access, **Manifest V2 remains the only viable option**.

---

## 🧑‍💻 Development Setup

1. **Clone or extract the repository.**  
   Ensure all extension files are in one folder (e.g., `tls-inspector-detector/`).

2. **Open Firefox and navigate to:**  
   ```
   about:debugging#/runtime/this-firefox
   ```

3. Click **“Load Temporary Add-on…”** and select the folder containing `manifest.json`.

4. The TLS Inspector Detector icon will appear in your toolbar.  
   - Click it while visiting an HTTPS page to see TLS details.  
   - Open **Settings (⚙)** in the popup to adjust the keyword.

5. To debug:
   - Click **Inspect** under the loaded extension to open the background console.  
   - Logs such as `[TLS Detector] Popup requested data for host:` will appear there.

6. For development iteration, simply re-load the add-on from the same page.

---

## File Overview
| File | Purpose |
|------|----------|
| `manifest.json` | Declares permissions, background script, and popup configuration. |
| `background.js` | Core logic for intercepting HTTPS requests, analyzing TLS, and updating badges. |
| `popup.html` / `popup.js` | Displays per-host TLS info and provides a Settings button. |
| `options.html` / `options.js` | User configuration page for defining the keyword. |
