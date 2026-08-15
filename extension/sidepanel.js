const $ = (id) => document.getElementById(id);
let current = { tab: null, job: null };
let contextKey = '';
function send(action, payload = {}) {
  return chrome.runtime.sendMessage({ action, ...payload });
}
function setStatus(text, kind = '') {
  $('action-status').textContent = text;
  $('action-status').className = `status ${kind}`;
}
function escapeText(value) { return value == null ? '' : String(value); }
function escapeHtml(value) {
  return escapeText(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
async function refresh() {
  const [config, context, native] = await Promise.all([
    send('get_config'), send('get_active_context'), send('native_status')
  ]);
  current = context || { tab: null, job: { detected: false } };
  const key = `${current.tab?.url || ''}|${current.job?.title || ''}`;
  const changed = key !== contextKey;
  contextKey = key;
  const authenticated = Boolean(config?.token);
  $('session-status').textContent = authenticated
    ? 'Session status: signed in' : 'Session status: sign in required';
  $('auth-card').classList.toggle('hidden', authenticated);
  $('sign-out').classList.toggle('hidden', !authenticated);
  const bridge = native?.status === 'connected' ? 'connected'
    : native?.status === 'not_installed' ? 'not installed' : 'disconnected';
  $('bridge-status').textContent = `Desktop bridge: ${bridge}`;
  const job = current.job || {};
  $('job-title').textContent = job.detected
    ? escapeText(job.title || 'Untitled role') : 'No supported job detected';
  $('job-company').textContent = job.detected
    ? escapeText(job.company || 'Company not detected') : '';
  $('job-meta').textContent = job.detected
    ? [job.location, job.platform].filter(Boolean).join(' / ') : '';
  $('page-link').textContent = current.tab?.url || '';
  $('page-link').href = current.tab?.url || '#';
  $('no-job').classList.toggle('hidden', !job.detected);
  $('actions').classList.toggle('hidden', !job.detected || !authenticated);
  if (changed) {
    $('analysis').classList.add('hidden');
    $('approval-check').checked = false;
    $('fill').disabled = true;
    setStatus('');
  }
}
async function run(action, payload) {
  setStatus('Working...');
  const result = await send(action, payload);
  setStatus(result?.success ? (result.message || 'Done.')
    : (result?.error || 'Action failed.'), result?.success ? 'ok' : 'error');
  return result;
}
$('refresh').addEventListener('click', () => void refresh());
$('sign-in').addEventListener('click', async () => {
  const result = await send('sign_in_pkce', { provider: 'google' });
  if (!result?.success) setStatus(result?.error || 'Secure sign-in failed.', 'error');
  await refresh();
});
$('sign-out').addEventListener('click', async () => {
  await send('sign_out');
  await refresh();
});
$('open-app').addEventListener('click', () =>
  void send('open_tayari', { path: '/desktop' }));
$('save-job').addEventListener('click', () =>
  void run('save_job', { job: current.job }));
$('queue').addEventListener('click', () =>
  void run('queue_for_review', { job: current.job, platform: current.job.platform }));
$('analyze').addEventListener('click', async () => {
  const result = await run('quick_ats', { job_description: current.job.description || '' });
  if (!result?.success) return;
  const fit = result.result || {};
  $('analysis').classList.remove('hidden');
  $('score').textContent = fit.overall_score == null ? '' : `${fit.overall_score}/100`;
  $('summary').textContent = fit.summary || 'No summary returned.';
  $('matched').innerHTML = (fit.matched_keywords || []).slice(0, 8)
    .map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None returned</li>';
  $('missing').innerHTML = (fit.missing_keywords || []).slice(0, 8)
    .map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None returned</li>';
});
$('approval-check').addEventListener('change', (event) => {
  $('fill').disabled = !event.target.checked;
});
$('fill').addEventListener('click', async () => {
  if (!$('approval-check').checked || !current.tab?.id) return;
  const result = await run('approved_autofill', { tabId: current.tab.id, approved: true });
  if (result?.success) $('approval-check').checked = false;
  $('fill').disabled = true;
});
void refresh();
setInterval(() => void refresh(), 4000);
