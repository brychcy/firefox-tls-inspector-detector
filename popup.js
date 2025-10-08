async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }

async function loadTLSInfo() {
  const tab = await getActiveTab();
  const host = new URL(tab.url).hostname;
  const info = await browser.runtime.sendMessage({ type: 'getStatusForHost', host });
  const statusDiv = document.getElementById('status');
  const metaDiv = document.getElementById('meta');
  const srcDiv = document.getElementById('src');
  const chainDiv = document.getElementById('chain');
  if (!info) {
    statusDiv.appendChild(el('<span class="pill bad">No data</span>'));
    metaDiv.textContent = 'No TLS info recorded yet for this host.';
    return;
  }
  const { isSecure, detected, keyword, details } = info;
  if (!isSecure) {
    statusDiv.appendChild(el('<span class="pill bad">Not secure</span>'));
    metaDiv.textContent = details.reason || 'HTTP or unavailable.';
  } else if (detected) {
    statusDiv.appendChild(el('<span class="pill warn">Match detected</span>'));
    metaDiv.textContent = `A certificate for ${host} contains "${keyword}".`;
  } else {
    statusDiv.appendChild(el('<span class="pill ok">No match</span>'));
    metaDiv.textContent = `TLS for ${host} is secure and no "${keyword}" markers were found.`;
  }
  srcDiv.textContent = `Source: ${details.sourceUrl} [${details.sourceType}] — ${details.protocolVersion || ''} ${details.cipherSuite || ''}`;
  const certs = details.certChain || [];
  certs.forEach((c, idx) => {
    chainDiv.appendChild(el(`<div class="cert"><div><b>Cert ${idx+1}</b></div><div class="mono">Subject: ${c.subjectText}</div><div class="mono">Issuer: ${c.issuerText}</div></div>`));
  });
  if (certs.length === 0) chainDiv.appendChild(el('<div class="mono">(No certificates returned)</div>'));
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadTLSInfo();
  document.getElementById('openSettings').addEventListener('click', () => {
    browser.runtime.openOptionsPage();
  });
});