export const MODERN_DASHBOARD = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Folder Share</title><link rel="stylesheet" href="/style.css"></head>
<body><main class="shell"><header class="hero"><div class="logo">FS</div><div><p class="eyebrow">LOCAL SECURE TRANSFERS</p><h1>Folder Share</h1><p class="muted">Send files directly from this computer with a temporary, passcode-protected link.</p></div><span class="status-dot">Dashboard online</span></header>
<section id="warning" class="alert" hidden></section>
<section class="card create-card"><div class="card-heading"><div><h2>New share</h2><p>Choose a folder and we will create a secure Cloudflare link.</p></div><span class="badge">24-hour default</span></div><form id="create"><div class="fields"><label class="field"><span>Folder</span><div class="input-group"><input id="folder" required placeholder="Choose a folder to share" autocomplete="off"><button class="button secondary" type="button" id="browse">Browse</button></div></label><label class="field expiry"><span>Expires after</span><select id="hours"><option value="24">24 hours</option><option value="1">1 hour</option><option value="6">6 hours</option><option value="72">3 days</option><option value="168">7 days</option></select></label></div><div class="form-actions"><p class="hint">Files stay on this computer. You can stop access at any time.</p><button class="button primary" id="create-button">Create secure share</button></div></form></section>
<section class="shares-section"><div class="section-heading"><div><h2>Active shares</h2><p class="muted">Live links and download activity.</p></div><span id="share-count" class="badge">0 active</span></div><div id="shares" class="share-list" aria-live="polite"><div class="empty"><b>No active shares</b><span>Create a secure share to get started.</span></div></div></section></main>
<dialog id="stop-dialog" class="dialog"><form method="dialog"><div class="dialog-icon">!</div><h2>Stop this share?</h2><p>The public link will stop working immediately. Any active downloads may be interrupted.</p><div class="dialog-actions"><button value="cancel" class="button secondary">Keep sharing</button><button value="confirm" class="button destructive" id="confirm-stop">Stop share</button></div></form></dialog><div id="toast" class="toast" role="status"></div><script type="module" src="/dashboard.js"></script></body></html>`;

// One runtime owns every dashboard interaction. Keeping it together prevents
// browser form fallback when independent helper scripts race to attach handlers.
export const DASHBOARD_RUNTIME_JS = `const $=selector=>document.querySelector(selector);const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));const human=value=>{let number=Number(value)||0;const units=['B','KB','MB','GB','TB'];let unit=0;while(number>=1000&&unit<units.length-1){number/=1000;unit++}return (unit===0?number.toFixed(0):number.toFixed(number>=100?0:1))+' '+units[unit]};let stoppingId=null;async function api(path,options){const response=await fetch(path,options);const data=await response.json().catch(()=>({}));if(!response.ok)throw Error(data.error||'Request failed');return data}function toast(message,kind='success'){const element=$('#toast');element.textContent=message;element.className='toast visible '+kind;clearTimeout(toast.timer);toast.timer=setTimeout(()=>element.className='toast',3600)}function transferMarkup(transfer){const state=transfer.status==='active'?'Downloading':transfer.status==='completed'?'Completed':'Cancelled';const speed=transfer.status==='active'?human(transfer.speed)+'/s':'-';return '<div class="transfer transfer-large"><div class="transfer-line"><div class="transfer-main"><span class="file-icon">FILE</span><div><b>'+escapeHtml(transfer.file)+'</b><small class="transfer-status '+transfer.status+'">'+state+'</small></div></div><strong class="transfer-speed">'+speed+'</strong></div><div class="transfer-details"><span>'+human(transfer.bytesSent)+' / '+human(transfer.size)+'</span><span>'+transfer.percent+'%</span></div><div class="progress progress-large"><i style="width:'+transfer.percent+'%"></i></div></div>'}function shareMarkup(share){const pending=!share.url;const link=pending?'<div class="link-box loading-link"><span class="spinner"></span><span>Creating Cloudflare link...</span></div>':'<div class="link-box"><code>'+escapeHtml(share.url)+'</code></div>';const copy=pending?'<button class="icon-button" disabled>Preparing link</button>':'<button class="icon-button" data-copy>Copy link + passcode</button>';const transfers=share.transfers.length?share.transfers.map(transferMarkup).join(''):'<div class="no-transfers">No downloads yet</div>';return '<article class="card share-card" data-share-id="'+share.id+'"><div class="share-top"><div class="share-title"><div class="folder-icon">FOLDER</div><div><h3>'+escapeHtml(share.name)+'</h3><p>Expires '+new Date(share.expiresAt).toLocaleString()+'</p></div></div><div class="share-actions">'+copy+'<button class="button destructive compact" data-stop>Stop share</button></div></div>'+link+'<div class="activity"><div class="activity-head"><b>Download activity</b><span>'+share.transfers.length+' transfer'+(share.transfers.length===1?'':'s')+'</span></div>'+transfers+'</div></article>'}function render(shares){$('#share-count').textContent=shares.length+' active';$('#shares').innerHTML=shares.length?shares.map(shareMarkup).join(''):'<div class="empty"><b>No active shares</b><span>Create a secure share to get started.</span></div>'}async function refresh(){render(await api('/api/shares'))}function setupTheme(){const root=document.documentElement;const key='folder-share-theme';const saved=localStorage.getItem(key);const set=dark=>{root.classList.toggle('dark',dark);button.textContent=dark?'Light mode':'Dark mode'};const button=document.createElement('button');button.className='theme-toggle';button.onclick=()=>{const dark=!root.classList.contains('dark');localStorage.setItem(key,dark?'dark':'light');set(dark)};$('.hero').append(button);set(saved?saved==='dark':matchMedia('(prefers-color-scheme: dark)').matches)}$('#browse').addEventListener('click',async event=>{event.preventDefault();const button=$('#browse');button.disabled=true;button.textContent='Opening...';try{const result=await api('/api/select-folder',{method:'POST'});if(result.folderPath)$('#folder').value=result.folderPath;else toast('No folder selected.')}catch(error){toast('Folder picker failed: '+error.message,'error')}finally{button.disabled=false;button.textContent='Browse'}});$('#create').addEventListener('submit',async event=>{event.preventDefault();const button=$('#create-button');button.disabled=true;button.textContent='Creating share...';try{const result=await api('/api/shares',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({folderPath:$('#folder').value,expiresInHours:Number($('#hours').value)})});await navigator.clipboard.writeText(result.share.url+'\\nPasscode: '+result.passcode);toast('Share ready. Link and passcode copied.');await refresh()}catch(error){toast(error.message,'error')}finally{button.disabled=false;button.textContent='Create secure share'}});$('#shares').addEventListener('click',async event=>{const button=event.target.closest('button');if(!button)return;const card=button.closest('.share-card');const id=card?.dataset.shareId;if(!id)return;if(button.hasAttribute('data-copy')){button.disabled=true;button.textContent='Copying...';try{const credentials=await api('/api/shares/'+id+'/credentials');await navigator.clipboard.writeText(credentials.url+'\\nPasscode: '+credentials.passcode);toast('Link and passcode copied.')}catch(error){toast(error.message,'error')}finally{button.disabled=false;button.textContent='Copy link + passcode'}}if(button.hasAttribute('data-stop')){stoppingId=id;$('#stop-dialog').showModal()}});$('#stop-dialog').addEventListener('close',async()=>{if($('#stop-dialog').returnValue!=='confirm'||!stoppingId)return;const id=stoppingId;stoppingId=null;const button=$('#confirm-stop');button.disabled=true;button.textContent='Stopping...';try{await api('/api/shares/'+id,{method:'DELETE'});toast('Share stopped.');await refresh()}catch(error){toast(error.message,'error')}finally{button.disabled=false;button.textContent='Stop share'}});(async()=>{setupTheme();try{const health=await api('/api/health');if(!health.cloudflared){const warning=$('#warning');warning.hidden=false;warning.innerHTML='<b>cloudflared is not installed.</b><span> Install it from <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" target="_blank" rel="noreferrer">Cloudflare downloads</a>, then restart the dashboard.</span>'}await refresh();const events=new EventSource('/api/events');events.onmessage=event=>render(JSON.parse(event.data));events.onerror=()=>toast('Live updates briefly disconnected; reconnecting...','error')}catch(error){toast(error.message,'error')}})();`;

export const TRANSFER_UI_STYLE = `
.transfer-large{display:block;padding:14px 0 16px}.transfer-line,.transfer-details{display:flex;align-items:center;justify-content:space-between;gap:16px}.transfer-speed{color:var(--foreground);font-size:13px;white-space:nowrap}.transfer-status{display:block;margin-top:3px}.transfer-status.completed{color:#16a34a}.transfer-status.cancelled{color:#ef4444}.transfer-details{margin:12px 0 7px;color:var(--muted);font-size:13px}.progress-large{width:100%;height:12px;border-radius:999px;background:#e2e8f0}.progress-large i{background:var(--primary);border-radius:inherit;transition:width .2s ease}:root.dark .progress-large{background:#1e293b}:root.dark .progress-large i{background:#f8fafc}@media(max-width:680px){.transfer-line{align-items:flex-start}.transfer-speed{padding-top:4px}}
`;

export const PUBLIC_RECIPIENT_JS = `
const root = document.querySelector('.recipient');
const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const bytes = value => {
  let number = Number(value) || 0;
  const units = ['B','KB','MB','GB','TB'];
  let unit = 0;
  while (number >= 1000 && unit < units.length - 1) { number /= 1000; unit++; }
  return (unit === 0 ? number.toFixed(0) : number.toFixed(number >= 100 ? 0 : 1)) + ' ' + units[unit];
};
const fileHref = path => '/s/' + SHARE.id + '/file/' + path.split('/').map(encodeURIComponent).join('/');
const zipHref = paths => '/s/' + SHARE.id + '/zip' + (paths ? '?paths=' + encodeURIComponent(JSON.stringify(paths)) : '');

function tree(items) {
  return '<ul class="file-tree">' + items.map(item => {
    if (item.type === 'directory') {
      return '<li class="folder-row"><input type="checkbox" class="row-check folder-check" aria-label="Select all in ' + escapeHtml(item.name) + '"><details open class="folder-details"><summary><span class="file-kind folder-kind">FOLDER</span><b>' + escapeHtml(item.name) + '</b></summary>' + tree(item.children) + '</details></li>';
    }
    const href = fileHref(item.path);
    return '<li class="file-row" data-path="' + escapeHtml(item.path) + '"><input type="checkbox" class="row-check" data-path="' + escapeHtml(item.path) + '"><span class="file-kind">FILE</span><a href="' + href + '">' + escapeHtml(item.name) + '</a><span class="file-size">' + bytes(item.size) + '</span><a class="file-download" href="' + href + '" title="Download ' + escapeHtml(item.name) + '" aria-label="Download ' + escapeHtml(item.name) + '">&darr;</a></li>';
  }).join('') + '</ul>';
}

function wireBrowser(hasFiles) {
  if (!hasFiles) return;
  document.querySelector('#download-all').addEventListener('click', () => {
    window.location.href = zipHref();
  });
  const panel = document.querySelector('#file-panel');
  const toggleBtn = document.querySelector('#select-toggle');
  const actions = document.querySelector('#select-actions');
  const countEl = document.querySelector('#select-count');
  const downloadBtn = document.querySelector('#download-selected');
  const selectAllBtn = document.querySelector('#select-all');
  let selecting = false;

  const fileChecks = () => Array.from(panel.querySelectorAll('input.row-check[data-path]'));

  function updateState() {
    const checks = fileChecks();
    const checked = checks.filter(c => c.checked);
    countEl.textContent = checked.length + ' selected';
    downloadBtn.disabled = checked.length === 0;
    panel.querySelectorAll('input.folder-check').forEach(folderCheck => {
      const details = folderCheck.closest('.folder-row').querySelector(':scope > .folder-details');
      const children = Array.from(details.querySelectorAll('input.row-check[data-path]'));
      const allChecked = children.length > 0 && children.every(c => c.checked);
      const someChecked = children.some(c => c.checked);
      folderCheck.checked = allChecked;
      folderCheck.indeterminate = !allChecked && someChecked;
    });
  }

  toggleBtn.addEventListener('click', () => {
    selecting = !selecting;
    panel.classList.toggle('selecting', selecting);
    actions.hidden = !selecting;
    toggleBtn.textContent = selecting ? 'Cancel' : 'Select files';
    if (!selecting) { fileChecks().forEach(c => c.checked = false); updateState(); }
  });

  selectAllBtn.addEventListener('click', () => {
    const checks = fileChecks();
    const allSelected = checks.length > 0 && checks.every(c => c.checked);
    checks.forEach(c => c.checked = !allSelected);
    updateState();
  });

  panel.addEventListener('change', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return;
    if (target.classList.contains('folder-check')) {
      const details = target.closest('.folder-row').querySelector(':scope > .folder-details');
      details.querySelectorAll('input.row-check[data-path]').forEach(c => c.checked = target.checked);
    }
    updateState();
  });

  downloadBtn.addEventListener('click', () => {
    const paths = fileChecks().filter(c => c.checked).map(c => c.dataset.path);
    if (!paths.length) return;
    // A single zipped download instead of one download per file: browsers
    // silently block all but the first of several automatic downloads fired
    // in a row, so looping per-file here used to drop files without any
    // visible error.
    window.location.href = zipHref(paths);
  });

  updateState();
}

fetch('/s/' + SHARE.id + '/tree')
  .then(response => { if (!response.ok) throw Error(); return response.json(); })
  .then(items => {
    root.innerHTML = '<section class="recipient-browser"><header class="recipient-browser-head"><div><p class="eyebrow">SIGNAL &middot; SECURE TRANSFER</p><h1>' + escapeHtml(SHARE.name) + '</h1><p>Choose a file to download from this shared folder.</p></div><span class="recipient-ready">Access granted</span></header>' +
      (items.length ? '<div class="file-toolbar"><button type="button" class="button primary compact" id="download-all">Download all (.zip)</button><div class="file-toolbar-group"><button type="button" class="button secondary compact" id="select-toggle">Select files</button><div class="file-toolbar-actions" id="select-actions" hidden><span id="select-count" class="muted">0 selected</span><button type="button" class="button secondary compact" id="select-all">Select all</button><button type="button" class="button primary compact" id="download-selected" disabled>Download selected (.zip)</button></div></div></div>' : '') +
      '<div class="file-panel" id="file-panel">' + (items.length ? tree(items) : '<div class="empty">This folder is empty.</div>') + '</div></section>';
    wireBrowser(items.length > 0);
  })
  .catch(() => {
    root.innerHTML = '<section class="recipient-card"><h1>Share unavailable</h1><p class="recipient-copy">This share may have expired or been stopped by its sender.</p></section>';
  });
`;

/*
  Recipient surface - the public /s/<id> page your recipient opens through the
  tunnel. Self-contained SIGNAL theme scoped to .recipient-body so it never
  depends on a dark-mode toggle being present on <html>.
*/
export const RECIPIENT_UI_STYLE = `
.recipient-body{--background:#14110d;--card:#1d1913;--foreground:#f3ece0;--muted:#a89a83;--border:#332b1f;--input:#3a3123;--primary:#ff7a29;--signal-glow:#ffab52;--online:#64dfa2;position:relative;display:grid;min-height:100vh;place-items:center;padding:24px;color:var(--foreground);font-family:"Hanken Grotesk",ui-sans-serif,system-ui,sans-serif;background:radial-gradient(760px 520px at 50% -170px,color-mix(in oklab,var(--primary) 20%,transparent) 0%,transparent 60%),var(--background)}
.recipient-body::before{content:"";position:fixed;inset:0;z-index:0;pointer-events:none;opacity:.05;mix-blend-mode:overlay;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
.recipient-body h1{font-family:"Bricolage Grotesque",ui-sans-serif,system-ui,sans-serif;letter-spacing:-.02em}
.recipient-body .eyebrow{margin:0;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:700;letter-spacing:.24em;color:var(--primary)}
.recipient{position:relative;z-index:1;width:min(720px,100%);margin:0}
.recipient-card,.recipient-browser{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:0 30px 80px -40px #000,0 1px 0 0 #ffffff08 inset}
.recipient-card{max-width:460px;margin:auto;padding:36px}
.recipient-icon{display:grid;place-items:center;width:48px;height:48px;margin-bottom:22px;border-radius:14px;background:linear-gradient(145deg,var(--signal-glow),var(--primary));color:#17120c;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:13px;font-weight:800;box-shadow:0 12px 30px -8px color-mix(in oklab,var(--primary) 65%,transparent)}
.recipient-card h1,.recipient-browser h1{margin:6px 0 12px;font-size:26px;font-weight:700}
.recipient-copy{margin:0 0 26px;color:var(--muted);font-size:14px;line-height:1.6}
.recipient .field>span{display:block;margin-bottom:8px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.recipient-body input{width:100%;height:46px;padding:0 14px;background:#0f0d09;color:var(--foreground);border:1px solid var(--input);border-radius:10px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:14px;letter-spacing:.06em;outline:none;transition:border-color .15s,box-shadow .15s}
.recipient-body input::placeholder{color:#6f6353;letter-spacing:.12em}
.recipient-body input:focus{border-color:color-mix(in oklab,var(--primary) 70%,transparent);box-shadow:0 0 0 3px color-mix(in oklab,var(--primary) 22%,transparent)}
.recipient-body .button.primary,.recipient-submit{width:100%;margin-top:10px;height:48px;border:0;border-radius:10px;background:linear-gradient(180deg,var(--signal-glow),var(--primary));color:#17120c;font-family:inherit;font-weight:700;font-size:15px;cursor:pointer;box-shadow:0 12px 34px -10px color-mix(in oklab,var(--primary) 70%,transparent),0 1px 0 0 #ffffff44 inset;transition:filter .15s,transform .05s}
.recipient-body .button.primary:hover{filter:brightness(1.06)}
.recipient-body .button.primary:active{transform:translateY(1px)}
.recipient-body .secondary,.recipient-body .icon-button{background:var(--card);border-color:var(--border);color:var(--foreground)}
.recipient-body .secondary:hover,.recipient-body .icon-button:hover{background:#241f16}
.recipient-body .button.primary.compact,.recipient-body .primary.compact{width:auto;margin-top:0}
.recipient-error{margin:-6px 0 12px;color:#ff8a7a;font-size:13px;font-weight:600}
.recipient-note{margin:20px 0 0;color:var(--muted);font-size:12px;text-align:center}
.recipient-browser{overflow:hidden}
.recipient-browser-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;padding:30px;border-bottom:1px solid var(--border)}
.recipient-browser-head p{margin:0;color:var(--muted);font-size:14px}
.recipient-ready{display:inline-flex;align-items:center;gap:7px;border:1px solid color-mix(in oklab,var(--online) 35%,transparent);background:color-mix(in oklab,var(--online) 12%,transparent);color:var(--online);padding:6px 12px;border-radius:999px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:11px;font-weight:700;letter-spacing:.03em;white-space:nowrap}
.recipient-ready::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--online);box-shadow:0 0 8px var(--online)}
.file-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid var(--border)}
.file-toolbar-group{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.file-toolbar-actions{display:flex;align-items:center;gap:10px}
.file-toolbar-actions[hidden]{display:none}
.file-panel{padding:14px 16px 22px;max-height:62vh;overflow:auto}
.file-tree{margin:0;padding-left:0;list-style:none}
.file-tree .file-tree{margin-left:16px;padding-left:8px;border-left:1px solid var(--border)}
.recipient-body input.row-check{display:none;flex:none;width:16px;height:16px;padding:0;background:none;border:1px solid var(--input);border-radius:4px;accent-color:var(--primary);cursor:pointer}
.file-panel.selecting .row-check{display:inline-block}
.folder-row{display:flex;align-items:flex-start;gap:10px}
.folder-row .folder-details{flex:1;min-width:0}
.folder-row .row-check{margin-top:14px}
.file-row{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:10px;transition:background .12s}
.file-row:hover{background:#241f16}
.file-row a{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--foreground);font-size:14px;text-decoration:none;transition:color .12s}
.file-row:hover a{color:var(--signal-glow)}
.file-size{margin-left:auto;color:var(--muted);font-family:"JetBrains Mono",ui-monospace,monospace;font-size:12px;white-space:nowrap}
.file-row a.file-download{flex:none;min-width:26px;width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;margin-left:4px;border-radius:6px;color:var(--primary);text-decoration:none;font-weight:800;opacity:.55;transition:opacity .12s,background .12s}
.file-download:hover,.file-download:focus-visible{opacity:1;background:color-mix(in oklab,var(--primary) 16%,transparent)}
.file-kind{display:grid;place-items:center;min-width:40px;height:26px;background:#2a2318;color:#c9a678;border:1px solid var(--border);border-radius:6px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:8px;font-weight:800;letter-spacing:.08em}
.folder-kind{background:color-mix(in oklab,var(--primary) 14%,transparent);color:var(--signal-glow);border-color:color-mix(in oklab,var(--primary) 25%,transparent)}
details>summary{display:flex;align-items:center;gap:12px;padding:11px 12px;border-radius:10px;cursor:pointer;list-style:none;font-size:14px;font-weight:600;transition:background .12s}
details>summary:hover{background:#241f16}
details>summary::-webkit-details-marker{display:none}
.recipient .empty{padding:34px;text-align:center;color:var(--muted);font-size:14px}
@media(max-width:600px){.recipient-card{padding:26px}.recipient-browser-head{padding:22px;flex-direction:column}.file-panel{padding:10px}.file-toolbar{flex-direction:column;align-items:stretch}.file-toolbar-actions{flex-wrap:wrap}}
`;

export const UI_OVERRIDES = `
.hero{position:relative}.theme-toggle{margin-left:auto;height:36px;padding:0 11px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--foreground);font-weight:700;font-size:12px;cursor:pointer}.share-actions{align-items:center;flex-wrap:nowrap}.share-actions .icon-button,.share-actions .button{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center}.loading-link{min-height:42px}.link-box.loading-link{overflow:visible}
:root[data-theme="dark"]{--background:#0b1120;--card:#111827;--foreground:#e5e7eb;--muted:#94a3b8;--border:#293548;--primary:#60a5fa;--danger:#f87171;background:var(--background)}:root[data-theme="dark"] body{background:radial-gradient(circle at top right,#172554 0,transparent 32%),var(--background)}:root[data-theme="dark"] input,:root[data-theme="dark"] select,:root[data-theme="dark"] .secondary,:root[data-theme="dark"] .icon-button,:root[data-theme="dark"] .theme-toggle{background:#0f172a;color:var(--foreground);border-color:#334155}:root[data-theme="dark"] .badge,:root[data-theme="dark"] .link-box,:root[data-theme="dark"] .file-icon{background:#0f172a;color:#cbd5e1;border-color:#334155}:root[data-theme="dark"] .folder-icon{background:#172554}:root[data-theme="dark"] .link-box code{color:#bfdbfe}:root[data-theme="dark"] .empty{background:#111827;border-color:#334155}:root[data-theme="dark"] .transfer{border-color:#1e293b}:root[data-theme="dark"] .dialog{background:#111827;color:var(--foreground);border-color:#334155}:root[data-theme="dark"] .dialog-icon{background:#3f1d26}:root[data-theme="dark"] .primary{background:#3b82f6}:root[data-theme="dark"] .destructive{background:#dc2626}
@media(max-width:680px){.theme-toggle{margin-left:0}.share-actions{align-items:stretch}.share-actions .icon-button,.share-actions .button{width:100%}}
`;

// shadcn/ui's default neutral palette, applied through a `.dark` class and
// respecting the OS preference until the sender explicitly chooses a theme.
export const SHADCN_THEME_STYLE = `
:root{--background:#ffffff;--foreground:#020817;--card:#ffffff;--muted:#64748b;--border:#e2e8f0;--primary:#020817;--danger:#ef4444}
:root.dark{--background:#020817;--foreground:#f8fafc;--card:#020817;--muted:#94a3b8;--border:#1e293b;--primary:#f8fafc;--danger:#ef4444;background:var(--background)}
:root.dark body{background:var(--background)}:root.dark .logo{background:#f8fafc;color:#020817;box-shadow:none}:root.dark .primary{background:#f8fafc;color:#020817}:root.dark input,:root.dark select,:root.dark .secondary,:root.dark .icon-button,:root.dark .theme-toggle{background:#020817;color:#f8fafc;border-color:#334155}:root.dark .badge,:root.dark .link-box,:root.dark .file-icon{background:#0f172a;color:#cbd5e1;border-color:#334155}:root.dark .folder-icon{background:#172554}:root.dark .link-box code{color:#cbd5e1}:root.dark .empty{background:#020817;border-color:#334155}:root.dark .transfer{border-color:#1e293b}:root.dark .dialog{background:#020817;color:#f8fafc;border-color:#334155}:root.dark .dialog-icon{background:#3f1d26}:root.dark .alert{background:#1c1917;border-color:#78350f;color:#fdba74}
`;

export const MODERN_STYLE = `:root{--background:#f8fafc;--card:#fff;--foreground:#0f172a;--muted:#64748b;--border:#e2e8f0;--primary:#2563eb;--danger:#dc2626;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--foreground);background:var(--background)}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at top right,#e0e7ff 0,transparent 30%),var(--background)}button,input,select{font:inherit}.shell{max-width:1060px;margin:0 auto;padding:54px 24px 80px}.hero{display:flex;align-items:center;gap:16px;margin-bottom:30px}.logo{display:grid;place-items:center;width:46px;height:46px;border-radius:12px;background:#1d4ed8;color:#fff;font-size:13px;font-weight:800;box-shadow:0 8px 16px #1d4ed833}.hero h1{margin:2px 0 4px;font-size:30px;letter-spacing:-.7px}.hero p{margin:0}.eyebrow{font-size:11px;letter-spacing:.12em;color:var(--primary);font-weight:800}.muted,.hint{color:var(--muted);font-size:14px}.status-dot{margin-left:auto;border:1px solid #bbf7d0;background:#f0fdf4;color:#15803d;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700}.card{background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:0 1px 2px #0f172a08}.create-card{padding:24px}.card-heading,.section-heading,.share-top,.form-actions,.activity-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.card-heading h2,.section-heading h2{margin:0 0 5px;font-size:18px}.card-heading p,.section-heading p{margin:0}.badge{border:1px solid var(--border);background:#f8fafc;color:#475569;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:700;white-space:nowrap}.fields{display:grid;grid-template-columns:1fr 180px;gap:16px;margin:25px 0 16px}.field>span{display:block;font-size:14px;font-weight:700;margin-bottom:7px}.input-group{display:flex;gap:8px}input,select{width:100%;height:40px;border:1px solid #cbd5e1;border-radius:7px;padding:0 11px;background:#fff;color:var(--foreground);outline:none}input:focus,select:focus{border-color:#2563eb;box-shadow:0 0 0 3px #2563eb1c}.button,.icon-button{border:1px solid transparent;border-radius:7px;height:40px;padding:0 14px;font-weight:700;cursor:pointer;transition:.15s}.button:disabled,.icon-button:disabled{opacity:.55;cursor:not-allowed}.primary{background:var(--primary);color:#fff}.secondary,.icon-button{background:#fff;border-color:#cbd5e1;color:#334155}.destructive{background:var(--danger);color:#fff}.compact{height:34px}.form-actions{border-top:1px solid var(--border);padding-top:16px}.form-actions p{margin:0}.shares-section{margin-top:34px}.section-heading{margin-bottom:14px}.share-list{display:grid;gap:14px}.share-card{padding:20px}.share-title{display:flex;align-items:center;gap:12px}.folder-icon,.file-icon{display:grid;place-items:center;background:#eff6ff;color:#2563eb;border-radius:7px;font-size:9px;font-weight:900}.folder-icon{width:38px;height:38px}.share-title h3{margin:0;font-size:16px}.share-title p{margin:4px 0 0;color:var(--muted);font-size:13px}.share-actions{display:flex;gap:8px}.link-box{margin:18px 0;background:#f8fafc;border:1px solid var(--border);border-radius:7px;padding:10px 12px;overflow:auto}.link-box code{font-size:12px;color:#334155}.loading-link{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:13px}.spinner{width:15px;height:15px;border:2px solid #cbd5e1;border-top-color:var(--primary);border-radius:50%;animation:spin .75s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.activity{border-top:1px solid var(--border);padding-top:15px}.activity-head{font-size:13px;margin-bottom:9px}.activity-head span{color:var(--muted);font-size:12px}.transfer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0;border-top:1px solid #f1f5f9}.transfer-main{display:flex;align-items:center;gap:9px;min-width:0}.file-icon{min-width:31px;height:31px;background:#f1f5f9;color:#64748b}.transfer b{display:block;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:430px}.transfer small{color:var(--muted);font-size:12px}.transfer-meta{width:130px;text-align:right;color:var(--muted);font-size:12px}.progress{height:5px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-top:5px}.progress i{display:block;height:100%;background:#2563eb}.no-transfers,.empty{color:var(--muted);font-size:13px}.empty{padding:36px;text-align:center;border:1px dashed #cbd5e1;border-radius:12px;background:#fff;display:grid;gap:5px}.empty b{color:#334155}.alert{display:flex;gap:8px;padding:13px 15px;margin-bottom:18px;border:1px solid #fed7aa;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:14px}.alert[hidden]{display:none}.alert a{color:inherit;font-weight:700}.dialog{width:min(420px,calc(100% - 32px));border:1px solid var(--border);border-radius:12px;padding:24px;box-shadow:0 20px 50px #0f172a33}.dialog::backdrop{background:#0f172a66}.dialog h2{margin:13px 0 8px;font-size:19px}.dialog p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}.dialog-icon{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:#fef2f2;color:var(--danger);font-weight:900}.dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:22px}.toast{position:fixed;right:20px;bottom:20px;max-width:360px;transform:translateY(120px);opacity:0;background:#0f172a;color:white;border-radius:8px;padding:12px 15px;font-size:14px;transition:.2s;box-shadow:0 10px 25px #0f172a33}.toast.visible{transform:translateY(0);opacity:1}.toast.error{background:#b91c1c}@media(max-width:680px){.shell{padding:28px 16px}.hero{align-items:flex-start}.status-dot{display:none}.fields{grid-template-columns:1fr}.form-actions,.share-top,.transfer{align-items:flex-start;flex-direction:column}.form-actions .button{width:100%}.share-actions{width:100%}.share-actions>*{flex:1}.transfer-meta{width:100%;text-align:left}.transfer b{max-width:260px}}`;
