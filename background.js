// Background same as v3.9
const hostCertMap = new Map();

async function getConfiguredKeyword() {
  const { keyword = "zscaler" } = await browser.storage.local.get("keyword");
  return String(keyword || "zscaler").toLowerCase();
}

function normalizeDN(dn) {
  if (!dn) return "";
  if (typeof dn === "string") return dn;
  const parts = [];
  if (dn.commonName) parts.push(`CN=${dn.commonName}`);
  if (dn.organization) parts.push(`O=${Array.isArray(dn.organization) ? dn.organization.join(" + ") : dn.organization}`);
  if (dn.organizationalUnit) parts.push(`OU=${Array.isArray(dn.organizationalUnit) ? dn.organizationalUnit.join(" + ") : dn.organizationalUnit}`);
  if (dn.countryName) parts.push(`C=${dn.countryName}`);
  return parts.join(", ") || JSON.stringify(dn);
}

function certToSearchText(cert) {
  try {
    const subj = normalizeDN(cert.subject);
    const iss = normalizeDN(cert.issuer);
    return `${subj} ${iss}`.toLowerCase();
  } catch {
    try { return JSON.stringify(cert).toLowerCase(); } catch { return ""; }
  }
}

async function analyzeSecurityInfo(si, host, url, type) {
  const keyword = await getConfiguredKeyword();
  if (!si) return { isSecure: false, detected: false, keyword, details: { reason: "No TLS info" } };
  const { state, certificates = [], protocolVersion, cipherSuite } = si;
  const isSecure = state === "secure" || state === "weak";
  const detected = certificates.some((c) => certToSearchText(c).includes(keyword));
  const result = {
    host,
    isSecure,
    detected,
    keyword,
    details: {
      state,
      protocolVersion,
      cipherSuite,
      sourceUrl: url,
      sourceType: type,
      certChain: certificates.map((c) => ({
        subjectText: normalizeDN(c.subject),
        issuerText: normalizeDN(c.issuer),
        serialNumber: c.serialNumber,
        validity: c.validity
      }))
    }
  };
  hostCertMap.set(host, result);
  return result;
}

async function showBadgeForTab(tabId, host) {
  const info = hostCertMap.get(host);
  if (!info) {
    await browser.browserAction.setBadgeText({ tabId, text: "?" });
    await browser.browserAction.setBadgeBackgroundColor({ tabId, color: "#6b7280" });
    return;
  }
  const type = info.detected ? "warn" : (info.isSecure ? "ok" : "bad");
  const text = type === "ok" ? "OK" : type === "warn" ? "!" : "!";
  const color = type === "ok" ? "#22c55e" : type === "warn" ? "#d97706" : "#ef4444";
  await browser.browserAction.setBadgeText({ tabId, text });
  await browser.browserAction.setBadgeBackgroundColor({ tabId, color });
  await browser.browserAction.setTitle({ tabId, title: `${host}: ${type}` });
}

browser.webRequest.onHeadersReceived.addListener(
  async (details) => {
    if (!details.url.startsWith("https://")) return;
    const host = new URL(details.url).hostname;
    try {
      const si = await browser.webRequest.getSecurityInfo(details.requestId, {
        certificateChain: true,
        rawDER: false
      });
      if (!si) return;
      await analyzeSecurityInfo(si, host, details.url, details.type);
      const tabs = await browser.tabs.query({});
      for (const t of tabs) {
        try {
          const tHost = new URL(t.url).hostname;
          if (tHost === host) await showBadgeForTab(t.id, host);
        } catch {}
      }
    } catch (e) {
      console.warn("TLS Detector: error in getSecurityInfo", e);
    }
  },
  { urls: ["<all_urls>"], types: ["main_frame", "sub_frame", "xmlhttprequest", "script", "image", "stylesheet", "object", "other"] },
  ["blocking", "responseHeaders"]
);

browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url?.startsWith("https://")) {
    const host = new URL(tab.url).hostname;
    await showBadgeForTab(tabId, host);
  }
});

browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "getStatusForHost" && msg.host) {
    console.log("[TLS Detector] Popup requested data for host:", msg.host);
    sendResponse(hostCertMap.get(msg.host) || null);
    return true;
  }
});
