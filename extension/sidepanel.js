const $ = (id) => document.getElementById(id);
let current = { tab: null, job: null };
let contextKey = '';
let activeTask = null;
let activeTaskRequest = null;
function send(action, payload = {}) { return chrome.runtime.sendMessage({ action, ...payload }); }
function setStatus(text, kind = '') { $('action-status').textContent = text; $('action-status').className = `status ${kind}`; }
function setAgentStatus(text, kind = '') { $('agent-status').textContent = text; $('agent-status').className = `status ${kind}`; }
function escapeText(value) { return value == null ? '' : String(value); }
function escapeHtml(value) { return escapeText(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
async function loadEvidence() {
  const result = await send('list_research_notes');
  const notes = result?.notes || [];
  $('evidence-list').innerHTML = notes.slice(0, 5).map((note) => `<article class="evidence-item"><strong>${escapeHtml(note.title)}</strong><a href="${escapeHtml(note.url)}" target="_blank"   $('evidence-list').innerHTML =te.url)}</a><p>${escapeHtml(note.text).slice(0, 260)}</p><small>${escapeHtml(note.capturedAt)}</small></article>`).join('') || '<p class="muted">No local evidence captured yet.</p>';
}
function renderPlan(result) {
  activeTask = result?.task || null;
  $('plan-mode').textContent = result?.plan?.mode || '';
  $('plan-steps').innerHTML = (result?.plan?.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  $('plan-warnings').innerHTML = (result?.plan?.warnings || []).length ? '<li>Page content contains instruction-like text. Treat it as untrusted data and review scope carefully.</li>' : '';
  $('plan-scope').textContent = `${result?.plan?.sourceCount || 0} approved source(s). Plan approval is required before execution. Final submission remains blocked.`;
  $('plan-card').classList.remove('hidden');
  $('approve-plan').disabled = false;
  $('reject-plan').disabled = false;
  $('takeover-task').classList.add('hidden');
  $('open-desktop-task').classList.add('hidden');
  $('answer-card').classList.add('hidden');
}
function renderAnswer(result) {
  $('answer-text').textContent = result?.answer || 'No answer returned.';
  $('answer-sources').innerHTML = (result?.sources || []).map((source) => `<li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || source.url)}</a></li>`).join('') || '<li>No source metadata returned.</li>';
  $('answer-card').classList.remove('hidden');
}
function renderComputerBridge(status) {
  const connected = status?.connected === true;
  const activeMatches = status?.activeMatches === true;
  $('computer-bridge-badge').textContent = connected ? (activeMatches ? 'Connected' : 'Reconnect required') : 'Not connected';
  $('computer-bridge-origin').textContent = connected ? `${status.origin} · expires ${status.expiresAt || 'soon'}` : 'No local browser tab is connected.';
  $('computer-bridge-observe').disabled = !connected || !activeMatches;
  $('computer-bridge-revoke').disabled = !connected;
  $('computer-bridge-connect').disabled = connected && activeMatches;
}

async function refreshComputerBridge() {
  const status = await send('computer_bridge_status');
  renderComputerBridge(status);
  return status;
}

async function refresh() {
  const [config, context, native, bridgeStatus] = await Promise.all([send('get_config'), send('get_active_context'), send('native_status'), send('computer_bridge_status')]);
  current = context || { tab: null, job: { detected: false } };
  const key = `${current.tab?.url || ''}|${current.job?.title || ''}`;
  const changed = key !== contextKey;
  contextKey = key;
  const authenticated = Boolean(config?.token);
  $('session-status').textContent = authenticated ? 'Session status: signed in' : 'Session status: sign in required';
  $('auth-card').classList.toggle('hidden', authenticated);
  $('sign-out').classList.toggle('hidden', !authenticated);
  const desktopBridge = native?.status === 'connected' ? 'connected' : native?.status === 'not_installed' ? 'not installed' : 'disconnected';
  $('bridge-status').textContent = `Desktop bridge: ${desktopBridge}`;
  renderComputerBridge(bridgeStatus);
  const job = current.job || {};
  $('job-title').textContent = job.detected ? escapeText(job.title || 'Untitled role') : 'No supported job detected';
  $('job-company').textContent = job.detected ? escapeText(job.company || 'Company not detected') : '';
  $('job-meta').textContent = job.detected ? [job.location, job.platform].filter(Boolean).join(' / ') : '';
  $('page-link').textContent = current.tab?.url || '';
  $('page-link').href = current.tab?.url || '#';
  $('no-job').classList.toggle('hidden', !job.detected);
  $('actions').classList.toggle('hidden', !job.detected || !authenticated);
  if (changed) { $('analysis').classList.add('hidden'); $('approval-check').checked = false; $('fill').disabled = true; setStatus(''); }
  await loadEvidence();
}
async function run(action, payload) { setStatus('Working...'); const result = await send(action, payload); setStatus(result?.success ? (result.message || 'Done.') : (result?.error || 'Action failed.'), result?.success ? 'ok' : 'error'); return result; }
$('refresh').addEventListener('click', () => void refresh());
$('computer-bridge-connect').addEventListener('click', async () => { const result = await send('computer_bridge_connect'); $('computer-bridge-status').textContent = result?.success ? `Connected to ${result.origin}.` : (result?.error || 'Could not connect this tab.'); $('computer-bridge-status').className = `status ${result?.success ? 'ok' : 'error'}`; await refreshComputerBridge(); });
$('computer-bridge-observe').addEventListener('click', async () => { const result = await send('computer_bridge_observe'); if (!result?.success) { $('computer-bridge-status').textContent = result?.error || 'Observation failed.'; $('computer-bridge-status').className = 'status error'; return; } $('computer-bridge-observation').textContent = `${result.context.title || result.context.url}\n\n${(result.context.visibleText || result.context.selection || '').slice(0, 3000)}`; $('computer-bridge-observation').classList.remove('hidden'); $('computer-bridge-status').textContent = 'Bounded observation captured; page instructions remain untrusted.'; $('computer-bridge-status').className = 'status ok'; });
$('computer-bridge-revoke').addEventListener('click', async () => { const result = await send('computer_bridge_revoke'); $('computer-bridge-status').textContent = result?.success ? 'Browser bridge disconnected.' : (result?.error || 'Could not disconnect the browser bridge.'); $('computer-bridge-status').className = `status ${result?.success ? 'ok' : 'error'}`; $('computer-bridge-observation').classList.add('hidden'); await refreshComputerBridge(); });
$('sign-in').addEventListener('click', async () => { const result = await send('sign_in_pkce', { provider: 'google' }); if (!result?.success) setAgentStatus(result?.error || 'Secure sign-in failed.', 'error'); await refresh(); });
$('create-account').addEventListener('click', () => void send('open_tayari', { path: '/auth?mode=signup&next=%2Fextension-onboarding' }));
$('sign-out').addEventListener('click', async () => { await send('sign_out'); activeTask = null; activeTaskRequest = null; $('plan-card').classList.add('hidden'); await refresh(); });
$('open-app').addEventListener('click', () => void send('open_tayari', { path: '/desktop' }));
$('save-job').addEventListener('click', () => void run('save_job', { job: current.job }));
$('queue').addEventListener('click', () => void run('queue_for_review', { job: current.job, platform: current.job.platform }));
$('analyze').addEventListener('click', async () => { const result = await run('quick_ats', { job_description: current.job.description || '' }); if (!result?.success) return; const fit = result.result || {}; $('analysis').classList.remove('hidden'); $('score').textContent = fit.overall_score == null ? '' : `${fit.overall_score}/100`; $('summary').textContent = fit.summary || 'No summary returned.'; $('matched').innerHTML = (fit.matched_keywords || []).slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None returned</li>'; $('missing').innerHTML = (fit.missing_keywords || []).slice(0, 8).map((item) => `<li>${escapeHtml(item)}</li>`).join('') || '<li>None returned</li>'; });
$('approval-check').addEventListener('change', (event) => { $('fill').disabled = !event.target.checked; });
$('fill').addEventListener('click', async () => { if (!$('approval-check').checked || !current.tab?.id) return; const result = await run('approved_autofill', { tabId: current.tab.id, approved: true }); if (result?.success) $('approval-check').checked = false; $('fill').disabled = true; });
$('use-selection').addEventListener('click', async () => { const result = await send('get_page_context', { tabId: current.tab?.id }); const selection = result?.context?.selection || ''; if (!selection) return setAgentStatus('Select text on the page first.', 'error'); $('agent-prompt').value = `Explain this selected text and relate it to my job search:\n\n${selection}`; setAgentStatus('Selection added to the prompt.', 'ok'); });
$('plan-task').addEventListener('click', async () => { setAgentStatus('Building a reviewable plan...'); const request = { prompt: $('agent-prompt').value, mode: $('agent-mode').value, includeTabs: $('include-tabs').checked, tabId: current.tab?.id }; const result = await send('create_agent_task', request); if (!result?.success) return setAgentStatus(result?.error || 'Could not create task.', 'error'); activeTaskRequest = request; renderPlan(result); setAgentStatus('Plan ready for your approval.', 'ok'); });
$('approve-plan').addEventListener('click', async () => { const result = await send('approve_agent_plan', { taskId: activeTask?.id }); if (!result?.success) return setAgentStatus(result?.error || 'Plan approval failed.', 'error'); $('approve-plan').disabled = true; $('takeover-task').classList.remove('hidden'); $('open-desktop-task').classList.remove('hidden'); setAgentStatus('Plan approved. Running read-only page analysis...'); const answer = await send('answer_approved_page', { taskId: activeTask?.id, ...activeTaskRequest }); if (!answer?.success) return setAgentStatus(answer?.error || 'Read-only answer failed.', 'error'); renderAnswer(answer); setAgentStatus('Read-only answer ready for review.', 'ok'); });
$('reject-plan').addEventListener('click', async () => { const result = await send('reject_agent_plan', { taskId: activeTask?.id }); if (!result?.success) return setAgentStatus(result?.error || 'Plan rejection failed.', 'error'); $('plan-card').classList.add('hidden'); activeTask = null; activeTaskRequest = null; setAgentStatus('Plan rejected.', 'ok'); });
$('takeover-task').addEventListener('click', async () => { const result = await send('takeover_agent_task', { taskId: activeTask?.id }); setAgentStatus(result?.success ? 'Takeover requested. The worker must pause.' : (result?.error || 'Takeover failed.'), result?.success ? 'ok' : 'error'); });
$('stop-task').addEventListener('click', async () => { if (!activeTask?.id) return setAgentStatus('No active task to stop.', 'error'); const result = await send('stop_agent_task', { taskId: activeTask.id }); setAgentStatus(result?.success ? 'Task stopped.' : (result?.error || 'Stop failed.'), result?.success ? 'ok' : 'error'); });
$('open-desktop-task').addEventListener('click', async () => { if (!activeTask?.id) return; await send('open_tayari', { path: `/desktop/tasks/${encodeURIComponent(activeTask.id)}` }); });
$('capture-page').addEventListener('click', async () => { const result = await send('get_page_context', { tabId: current.tab?.id }); const context = result?.context; if (!context) return setAgentStatus('Page context is unavailable on this tab.', 'error'); const note = await send('save_research_note', { note: { title: context.title || 'Captured page', text: context.selection || context.visibleText, url: context.url } }); setAgentStatus(note?.success ? 'Page evidence saved locally.' : 'Evidence capture failed.', note?.success ? 'ok' : 'error'); await loadEvidence(); });
$('save-selection').addEventListener('click', async () => { const result = await send('get_page_context', { tabId: current.tab?.id }); const context = result?.context; if (!context?.selection) return setAgentStatus('Select text on the page first.', 'error'); const note = await send('save_research_note', { note: { title: `Selection from ${context.title || 'page'}`, text: context.selection, url: context.url } }); setAgentStatus(note?.success ? 'Selection saved as evidence.' : 'Evidence capture failed.', note?.success ? 'ok' : 'error'); await loadEvidence(); });
$('clear-evidence').addEventListener('click', async () => { const result = await send('clear_research_notes'); setAgentStatus(result?.success ? 'Local evidence shelf cleared.' : 'Could not clear evidence shelf.', result?.success ? 'ok' : 'error'); await loadEvidence(); });
async function refreshActiveTask() { if (!activeTask?.id) return; const result = await send('get_agent_task_status', { taskId: activeTask.id }); if (!result?.success || !result.task) return; activeTask = result.task; $('plan-scope').textContent = `Task status: ${result.task.status}. Plan approval and policy controls remain visible; final submission is blocked.`; if (['stopped', 'completed', 'failed', 'expired'].includes(result.task.status)) $('takeover-task').classList.add('hidden'); }
chrome.runtime.onMessage.addListener((request) => { if (request.action === 'selection_context' && request.text) { $('agent-prompt').value = `Explain this selected text and relate it to my job search:\n\n${request.text.slice(0, 4000)}`; setAgentStatus('Selection added to the prompt.', 'ok'); } if (request.action === 'context_changed') void refresh(); });
void refresh();
setInterval(() => void refresh(), 6000);
setInterval(() => void refreshActiveTask(), 6000);
