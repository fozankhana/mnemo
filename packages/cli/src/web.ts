/** The Mnemo dashboard: a self-contained single-page app (no build, no deps). */
export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Mnemo — your memory, your rules</title>
<style>
  :root {
    --bg: #0e1117; --panel: #161b22; --panel2: #1c2230; --border: #2b3340;
    --text: #e6edf3; --muted: #8b949e; --accent: #6ea8fe; --accent2: #58c39a;
    --danger: #f0726a; --warn: #e3b341; --radius: 10px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
    font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  a { color: var(--accent); }
  header { padding: 22px 28px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .logo { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .logo span { color: var(--accent); }
  .tagline { color: var(--muted); font-size: 13px; }
  .chips { margin-left: auto; display: flex; gap: 10px; flex-wrap: wrap; }
  .chip { background: var(--panel); border: 1px solid var(--border); border-radius: 999px;
    padding: 5px 12px; font-size: 12px; color: var(--muted); }
  .chip b { color: var(--text); }
  nav { display: flex; gap: 4px; padding: 0 24px; border-bottom: 1px solid var(--border); }
  nav button { background: none; border: none; color: var(--muted); padding: 14px 16px;
    cursor: pointer; font-size: 14px; border-bottom: 2px solid transparent; }
  nav button.active { color: var(--text); border-bottom-color: var(--accent); }
  main { padding: 24px 28px; max-width: 1000px; }
  .panel { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius);
    padding: 18px; margin-bottom: 18px; }
  h2 { font-size: 15px; margin: 0 0 14px; }
  h3 { font-size: 13px; color: var(--muted); margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  input, textarea, select { background: var(--panel2); border: 1px solid var(--border); color: var(--text);
    border-radius: 8px; padding: 9px 11px; font: inherit; width: 100%; }
  textarea { min-height: 64px; resize: vertical; }
  .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .row > * { flex: 1; }
  button.btn { background: var(--accent); color: #06122b; border: none; border-radius: 8px;
    padding: 9px 14px; font-weight: 600; cursor: pointer; flex: 0 0 auto; }
  button.btn.ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
  button.btn.danger { background: transparent; color: var(--danger); border: 1px solid var(--border); }
  .mem { border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; margin-bottom: 10px; background: var(--panel2); }
  .mem .meta { color: var(--muted); font-size: 12px; margin-top: 6px; display: flex; gap: 10px; align-items: center; }
  .scope { background: #243049; color: var(--accent); border-radius: 6px; padding: 2px 8px; font-size: 12px; }
  .score { color: var(--accent2); }
  .client { border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin-bottom: 12px; background: var(--panel2); }
  .client .head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .pill { font-size: 11px; border-radius: 999px; padding: 3px 9px; }
  .pill.active { background: #133a2b; color: var(--accent2); }
  .pill.pending { background: #3a3413; color: var(--warn); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); vertical-align: top; }
  th { color: var(--muted); font-weight: 600; }
  td.deny { color: var(--danger); }
  td.allow { color: var(--accent2); }
  .muted { color: var(--muted); }
  pre { background: var(--panel2); border: 1px solid var(--border); border-radius: 8px; padding: 14px;
    overflow: auto; font-size: 12.5px; }
  .hidden { display: none; }
  .grant-row { display: flex; align-items: center; gap: 8px; font-size: 13px; margin-bottom: 6px; }
  label.cb { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; color: var(--muted); }
  label.cb input { width: auto; }
  .small { font-size: 12px; }
</style>
</head>
<body>
<header>
  <div>
    <div class="logo">Mnemo<span>.</span></div>
    <div class="tagline">Your memory. Your rules. Shared across every AI tool — with consent and a full audit trail.</div>
  </div>
  <div class="chips" id="chips"></div>
</header>
<nav>
  <button data-tab="memories" class="active">Memories</button>
  <button data-tab="consent">Clients &amp; Consent</button>
  <button data-tab="audit">Audit Log</button>
  <button data-tab="connect">Connect a Tool</button>
  <button data-tab="export">Export</button>
</nav>
<main>
  <section id="tab-memories">
    <div class="panel">
      <h2>Search your memory</h2>
      <div class="row">
        <input id="q" placeholder="Search across all scopes (semantic)..." />
        <button class="btn" onclick="doSearch()">Search</button>
        <button class="btn ghost" onclick="loadMemories()">Show all</button>
      </div>
    </div>
    <div class="panel">
      <h2>Add a memory</h2>
      <textarea id="newContent" placeholder="A durable fact to remember, e.g. 'I prefer TypeScript and pnpm for new projects.'"></textarea>
      <div class="row" style="margin-top:10px">
        <input id="newScope" placeholder="scope (default: general)" />
        <button class="btn" onclick="addMemory()">Save</button>
      </div>
    </div>
    <div id="memList"></div>
  </section>

  <section id="tab-consent" class="hidden">
    <div class="panel small muted">
      Default-deny: a tool can read or write <b>nothing</b> until you grant it a scope here.
      Use scope <code>*</code> to grant all scopes at once. Revoking is instant and logged.
    </div>
    <div id="clientList"></div>
  </section>

  <section id="tab-audit" class="hidden">
    <div class="panel">
      <div class="row"><h2 style="flex:1">Every access, logged</h2>
        <button class="btn ghost" onclick="loadAudit()">Refresh</button></div>
      <table><thead><tr><th>Time</th><th>Client</th><th>Action</th><th>Scope</th><th>Result</th><th>Detail</th></tr></thead>
      <tbody id="auditBody"></tbody></table>
    </div>
  </section>

  <section id="tab-connect" class="hidden">
    <div class="panel">
      <h2>Connect an AI tool over MCP</h2>
      <p class="small muted">Generate a config block, then paste it into your tool. Each tool gets its own
        client id so you can grant scopes per-tool and see exactly what each one did.</p>
      <div class="row">
        <input id="cfgClient" value="claude-desktop" placeholder="client id" />
        <input id="cfgLabel" value="Claude Desktop" placeholder="label" />
        <label class="cb"><input type="checkbox" id="cfgLocal" checked /> local build</label>
        <button class="btn" onclick="loadConfig()">Generate</button>
      </div>
      <pre id="cfgOut" style="margin-top:14px">…</pre>
      <button class="btn ghost" onclick="copyCfg()">Copy</button>
      <h3 style="margin-top:18px">Where to paste</h3>
      <ul class="small muted">
        <li><b>Claude Desktop</b>: <code>claude_desktop_config.json</code> (Settings → Developer → Edit Config)</li>
        <li><b>Cursor</b>: <code>~/.cursor/mcp.json</code></li>
      </ul>
      <p class="small muted">After connecting, the tool appears under <b>Clients &amp; Consent</b> as <i>pending</i>. Grant it scopes and it can start remembering.</p>
    </div>
  </section>

  <section id="tab-export" class="hidden">
    <div class="panel">
      <h2>Own your data</h2>
      <p class="small muted">Everything Mnemo knows lives in one local SQLite file. Export the full vault —
        memories, scopes, grants, clients and the audit log — as JSON anytime.</p>
      <a class="btn" href="/api/export" download>Download full export (JSON)</a>
    </div>
  </section>
</main>
<script>
  function esc(s){ return String(s==null?"":s).replace(/[&<>"']/g, function(c){
    return ({"&":"&amp;","<":"&lt;",">":"&gt;","\\"":"&quot;","'":"&#39;"})[c]; }); }
  function api(path, opts){ return fetch(path, opts).then(function(r){ return r.json(); }); }
  function fmt(ms){ if(!ms) return ""; var d=new Date(Number(ms)); return d.toLocaleString(); }

  function show(tab){
    var tabs=["memories","consent","audit","connect","export"];
    tabs.forEach(function(t){ document.getElementById("tab-"+t).classList.toggle("hidden", t!==tab); });
    document.querySelectorAll("nav button").forEach(function(b){ b.classList.toggle("active", b.dataset.tab===tab); });
    if(tab==="memories") loadMemories();
    if(tab==="consent") loadClients();
    if(tab==="audit") loadAudit();
    if(tab==="connect") loadConfig();
  }
  document.querySelectorAll("nav button").forEach(function(b){ b.onclick=function(){ show(b.dataset.tab); }; });

  function loadStats(){
    api("/api/stats").then(function(s){
      document.getElementById("chips").innerHTML =
        chip("memories", s.memories)+chip("scopes", s.scopes)+
        chip("clients", s.clients)+chip("pending", s.pendingClients)+
        chip("audit events", s.auditEntries)+chip("embeddings", s.embeddingProvider);
    });
  }
  function chip(k,v){ return '<span class="chip">'+esc(k)+' <b>'+esc(v)+'</b></span>'; }

  function renderMems(list){
    var el=document.getElementById("memList");
    if(!list.length){ el.innerHTML='<div class="panel muted">No memories yet.</div>'; return; }
    el.innerHTML=list.map(function(m){
      var score = (m.score!=null) ? ' · <span class="score">relevance '+m.score.toFixed(2)+'</span>' : '';
      return '<div class="mem"><div>'+esc(m.content)+'</div><div class="meta">'+
        '<span class="scope">'+esc(m.scope)+'</span>'+
        '<span>'+esc(m.sourceClient||"?")+'</span>'+
        '<span>'+fmt(m.createdAt)+'</span>'+score+
        '<span style="flex:1"></span>'+
        '<button class="btn danger small" onclick="delMem(\\''+esc(m.id)+'\\')">Delete</button>'+
        '</div></div>';
    }).join("");
  }
  function loadMemories(){ api("/api/memories").then(renderMems); }
  function doSearch(){ var q=document.getElementById("q").value;
    if(!q.trim()){ loadMemories(); return; }
    api("/api/search?q="+encodeURIComponent(q)).then(renderMems); }
  function addMemory(){
    var content=document.getElementById("newContent").value;
    var scope=document.getElementById("newScope").value;
    api("/api/memories",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({content:content, scope:scope||undefined})}).then(function(){
      document.getElementById("newContent").value=""; loadMemories(); loadStats(); });
  }
  function delMem(id){ api("/api/memories?id="+encodeURIComponent(id),{method:"DELETE"})
    .then(function(){ loadMemories(); loadStats(); }); }

  function loadClients(){
    Promise.all([api("/api/clients"), api("/api/grants"), api("/api/scopes")]).then(function(r){
      var clients=r[0], grants=r[1], scopes=r[2];
      var el=document.getElementById("clientList");
      if(!clients.length){ el.innerHTML='<div class="panel muted">No tools have connected yet. See <b>Connect a Tool</b>.</div>'; return; }
      el.innerHTML=clients.map(function(c){
        var mine=grants.filter(function(g){ return g.clientId===c.id && g.revokedAt==null; });
        var grantRows=mine.length? mine.map(function(g){
          return '<div class="grant-row"><span class="scope">'+esc(g.scope)+'</span>'+
            '<span class="muted small">'+(g.canRead?"read ":"")+(g.canWrite?"write":"")+'</span>'+
            '<span style="flex:1"></span>'+
            '<button class="btn danger small" onclick="revoke(\\''+esc(c.id)+'\\',\\''+esc(g.scope)+'\\')">Revoke</button></div>';
        }).join("") : '<div class="muted small">No active grants — this tool can do nothing.</div>';
        return '<div class="client"><div class="head"><b>'+esc(c.label||c.id)+'</b>'+
          '<span class="muted small">'+esc(c.id)+'</span>'+
          '<span class="pill '+c.status+'">'+c.status+'</span>'+
          '<span style="flex:1"></span><span class="muted small">last seen '+fmt(c.lastSeen)+'</span></div>'+
          grantRows+
          '<div class="grant-row" style="margin-top:10px">'+
            '<input id="sc_'+esc(c.id)+'" placeholder="scope (or *)" style="flex:1" list="scopeOpts" />'+
            '<label class="cb"><input type="checkbox" id="rd_'+esc(c.id)+'" checked> read</label>'+
            '<label class="cb"><input type="checkbox" id="wr_'+esc(c.id)+'"> write</label>'+
            '<button class="btn small" onclick="grant(\\''+esc(c.id)+'\\')">Grant</button>'+
          '</div></div>';
      }).join("")+
      '<datalist id="scopeOpts">'+scopes.map(function(s){ return '<option value="'+esc(s.name)+'">'; }).join("")+'</datalist>';
    });
  }
  function grant(id){
    var scope=document.getElementById("sc_"+id).value.trim(); if(!scope) return;
    var canRead=document.getElementById("rd_"+id).checked;
    var canWrite=document.getElementById("wr_"+id).checked;
    api("/api/grants",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({clientId:id,scope:scope,canRead:canRead,canWrite:canWrite})})
      .then(function(){ loadClients(); loadStats(); });
  }
  function revoke(id,scope){
    api("/api/revoke",{method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({clientId:id,scope:scope})}).then(function(){ loadClients(); loadStats(); });
  }

  function loadAudit(){
    api("/api/audit?limit=200").then(function(rows){
      document.getElementById("auditBody").innerHTML=rows.map(function(a){
        var cls=a.allowed?"allow":"deny"; var word=a.allowed?"allowed":"DENIED";
        return '<tr><td class="muted">'+fmt(a.ts)+'</td><td>'+esc(a.clientId||"")+'</td>'+
          '<td>'+esc(a.action)+'</td><td>'+esc(a.scope||"")+'</td>'+
          '<td class="'+cls+'">'+word+'</td><td class="muted">'+esc(a.detail||"")+'</td></tr>';
      }).join("");
    });
  }

  function loadConfig(){
    var client=document.getElementById("cfgClient").value||"claude-desktop";
    var label=document.getElementById("cfgLabel").value||"Claude Desktop";
    var local=document.getElementById("cfgLocal").checked?"1":"0";
    api("/api/config?client="+encodeURIComponent(client)+"&label="+encodeURIComponent(label)+"&local="+local)
      .then(function(r){ document.getElementById("cfgOut").textContent=r.snippet; });
  }
  function copyCfg(){ navigator.clipboard.writeText(document.getElementById("cfgOut").textContent); }

  loadStats(); loadMemories();
</script>
</body>
</html>`;
