async function getActiveTab() {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab;
}
function el(html){ const t=document.createElement('template'); t.innerHTML=html.trim(); return t.content.firstChild; }

async function loadTLSInfo() {
  const tab = await getActiveTab();
  const host = new URL(tab.url).hostname;
  const info = await browser.runtime.sendMessage({ type: 'getStatusForHost', host });
  const iconEl = document.getElementById('stateIcon');
  const titleEl = document.getElementById('titleText');
  const statusDiv = document.getElementById('status');
  const metaDiv = document.getElementById('meta');
  const srcDiv = document.getElementById('src');
  const chainDiv = document.getElementById('chain');
  function setIcon(path, title) {
    if (iconEl) iconEl.src = path;
    if (titleEl) titleEl.textContent = title || 'TLS Inspector';
  }
  const isHttpOnly = tab.url.startsWith('http://');
  if (!info) {
    if (isHttpOnly) {
      setIcon('icon-http.svg', 'Insecure HTTP');
      statusDiv.appendChild(el('<span class="pill bad">HTTP (no TLS)</span>'));
      metaDiv.textContent = 'This page is not using HTTPS.';
    } else {
      setIcon('icon-nocert.svg', 'No certificate data yet');
      statusDiv.appendChild(el('<span class="pill bad">No data</span>'));
      metaDiv.textContent = 'No TLS info recorded yet for this host.';
    }
    return;
  }
  const { isSecure, detected, keyword, details } = info;
  if (!isSecure) {
    setIcon('icon-http.svg', 'Insecure connection');
    statusDiv.appendChild(el('<span class="pill bad">Not secure</span>'));
    metaDiv.textContent = details.reason || 'HTTP or unavailable.';
  } else if (detected) {
    setIcon('icon-zscaler.svg', 'Keyword detected');
    statusDiv.appendChild(el('<span class="pill warn">Match detected</span>'));
    metaDiv.textContent = `A certificate for ${host} contains "${keyword}".`;
  } else if (!details.certChain || details.certChain.length === 0) {
    setIcon('icon-nocert.svg', 'No certificates returned');
    statusDiv.appendChild(el('<span class="pill bad">No certs</span>'));
    metaDiv.textContent = `No certificate chain was returned for ${host}.`;
  } else {
    setIcon('icon-default.svg', 'Secure (no match)');
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