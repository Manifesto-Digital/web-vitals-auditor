
const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbymD2oQN-MIpAJeSMSQZgO-_8abtxhEKJn2E6W5gVNrJLk7dDXymcStpUp2HQTOgmaN/exec';

const form           = document.getElementById('auditForm');
const urlInput       = document.getElementById('urlInput');
const clientInput    = document.getElementById('clientInput');
const greenToggle    = document.getElementById('greenToggle');
const submitBtn      = document.getElementById('submitBtn');
const btnText        = document.getElementById('btnText');
const statusLoading  = document.getElementById('statusLoading');
const statusSuccess  = document.getElementById('statusSuccess');
const statusError    = document.getElementById('statusError');
const loadingDetail  = document.getElementById('loadingDetail');
const successDetail  = document.getElementById('successDetail');
const errorDetail    = document.getElementById('errorDetail');
const historySection = document.getElementById('historySection');
const historyList    = document.getElementById('historyList');

let greenHosted = false;
let sessionHistory = [];

console.log(clientInput)

// ── Validation ───────────────────────────────────────────────────────────
function isValidUrl(str) {
  try {
    const u = new URL(str);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch { return false; }
}

function checkReady() {
  submitBtn.disabled = !(isValidUrl(urlInput.value.trim()) && clientInput.value);
}

clientInput.addEventListener('input', checkReady);

urlInput.addEventListener('input', () => {
  urlInput.classList.remove('invalid');
  checkReady();
});

urlInput.addEventListener('blur', () => {
  if (urlInput.value && !isValidUrl(urlInput.value.trim())) {
    urlInput.classList.add('invalid');
  }
});

// ── Green toggle ─────────────────────────────────────────────────────────
function toggleGreen() {
  greenHosted = !greenHosted;
  greenToggle.classList.toggle('on', greenHosted);
  greenToggle.setAttribute('aria-checked', String(greenHosted));
}

greenToggle.addEventListener('click', toggleGreen);
greenToggle.addEventListener('keydown', e => {
  if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleGreen(); }
});

// ── Status helpers ───────────────────────────────────────────────────────
function hideAllStatus() {
  statusLoading.style.display = 'none';
  statusSuccess.style.display = 'none';
  statusError.style.display   = 'none';
}

// ── Submit ───────────────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const rawUrl = urlInput.value.trim();
  const client = clientInput.value.trim() || 'One-off request';

  if (!isValidUrl(rawUrl)) {
    urlInput.classList.add('invalid');
    urlInput.focus();
    return;
  }

  let domain;
  try { domain = new URL(rawUrl).hostname.replace(/^www\./, ''); }
  catch { domain = rawUrl; }

  // Payload shaped to match what your existing n8n "Prep Prompt" node expects
  const payload = {
    type:                'triggerAudit',
    url:                 rawUrl,
    domain:              domain,
    client:              client,
    squad:               'One off report',
    greenHosted:         greenHosted,
    batchId:             'one-off-' + Date.now(),
    siteIndex:           0,
    googleSheetRowIndex: null,
    email:               null,
    batchMetadata:       null
  };

  submitBtn.disabled = true;
  btnText.textContent = 'Sending…';
  hideAllStatus();
  loadingDetail.textContent = `Running audit for ${domain} — hang tight.`;
  statusLoading.style.display = 'flex';

  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    hideAllStatus();

    if (res.ok) {
      successDetail.textContent = `Audit queued for ${domain}. The report will land in a separate 'One off reports' folder in Google Drive within a couple of minutes.`;
      statusSuccess.style.display = 'flex';
      addToHistory(rawUrl, greenHosted);
      // Reset form
      urlInput.value    = '';
      clientInput.value = '';
      if (greenHosted) toggleGreen();
    } else {
      const body = await res.text().catch(() => '');
      errorDetail.textContent = `Webhook returned ${res.status}. ${body ? body.slice(0, 140) : 'No details available.'}`;
      statusError.style.display = 'flex';
    }

  } catch (err) {
    hideAllStatus();
    errorDetail.textContent = `Could not reach the webhook (${err.message}). Check your network and try again.`;
    statusError.style.display = 'flex';
  } finally {
    submitBtn.disabled = false;
    btnText.textContent = 'Run health check';
    checkReady();
  }
});
