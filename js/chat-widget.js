/*
 * Ask Bhavethra — AI chat widget
 * Self-contained: injects its own styles and markup, no dependencies.
 * The backend endpoint is set via the data-endpoint attribute on the
 * <script> tag that loads this file. No secrets live in this file.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var ENDPOINT = (script && script.getAttribute('data-endpoint')) || '';
  if (!ENDPOINT) {
    console.warn('[chat-widget] Missing data-endpoint attribute; widget disabled.');
    return;
  }

  var MAX_HISTORY = 12; // messages sent to the API per request
  var history = [];
  var busy = false;

  /* ---------- styles ---------- */
  var css = [
    '#bb-chat-btn{position:fixed;right:1.5rem;bottom:1.5rem;z-index:9999;width:56px;height:56px;',
    'border-radius:50%;border:none;cursor:pointer;background:var(--accent,#4a90d9);color:#fff;',
    'box-shadow:0 4px 16px rgba(0,0,0,.18);display:flex;align-items:center;justify-content:center;',
    'transition:transform .15s ease,box-shadow .15s ease}',
    '#bb-chat-btn:hover{transform:translateY(-2px);box-shadow:0 6px 20px rgba(0,0,0,.22)}',
    '#bb-chat-panel{position:fixed;right:1.5rem;bottom:5.5rem;z-index:9999;width:min(370px,calc(100vw - 2rem));',
    'height:min(520px,calc(100vh - 8rem));background:var(--bg,#fff);border:1px solid var(--border,#e0e0e0);',
    'border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.16);display:none;flex-direction:column;',
    'overflow:hidden;font-family:var(--sans,"Quicksand",sans-serif)}',
    '#bb-chat-panel.open{display:flex}',
    '#bb-chat-head{padding:.9rem 1.1rem;border-bottom:1px solid var(--border,#e0e0e0);',
    'display:flex;align-items:center;justify-content:space-between;background:var(--sidebar-bg,#f5f5f5)}',
    '#bb-chat-head strong{font-size:.72rem;letter-spacing:.18em;text-transform:uppercase;',
    'color:var(--text,#2c2c2c);font-weight:600}',
    '#bb-chat-close{border:none;background:none;cursor:pointer;font-size:1.1rem;line-height:1;',
    'color:var(--muted,#666);padding:.2rem}',
    '#bb-chat-msgs{flex:1;overflow-y:auto;padding:1rem;display:flex;flex-direction:column;gap:.6rem}',
    '.bb-msg{max-width:85%;padding:.55rem .8rem;border-radius:12px;font-size:.85rem;line-height:1.5;',
    'white-space:pre-wrap;word-wrap:break-word}',
    '.bb-msg.user{align-self:flex-end;background:var(--accent,#4a90d9);color:#fff;border-bottom-right-radius:4px}',
    '.bb-msg.bot{align-self:flex-start;background:var(--sidebar-bg,#f5f5f5);color:var(--text,#2c2c2c);',
    'border-bottom-left-radius:4px}',
    '.bb-msg.error{align-self:flex-start;background:#fdecea;color:#a94442}',
    '.bb-typing{align-self:flex-start;color:var(--muted,#666);font-size:.8rem;padding:.2rem .4rem}',
    '#bb-chat-form{display:flex;gap:.5rem;padding:.8rem;border-top:1px solid var(--border,#e0e0e0)}',
    '#bb-chat-input{flex:1;border:1px solid var(--border,#e0e0e0);border-radius:999px;',
    'padding:.55rem .9rem;font-size:.85rem;font-family:inherit;outline:none;color:var(--text,#2c2c2c)}',
    '#bb-chat-input:focus{border-color:var(--accent,#4a90d9)}',
    '#bb-chat-send{border:none;border-radius:50%;width:38px;height:38px;cursor:pointer;',
    'background:var(--accent,#4a90d9);color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '#bb-chat-send:disabled{opacity:.5;cursor:default}',
    '@media (max-width:480px){#bb-chat-panel{right:.5rem;left:.5rem;width:auto}}'
  ].join('');

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  /* ---------- markup ---------- */
  var chatIcon =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
  var sendIcon =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';

  var btn = document.createElement('button');
  btn.id = 'bb-chat-btn';
  btn.type = 'button';
  btn.setAttribute('aria-label', 'Chat with Bhavethra’s AI assistant');
  btn.innerHTML = chatIcon;

  var panel = document.createElement('div');
  panel.id = 'bb-chat-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'AI assistant chat');
  panel.innerHTML =
    '<div id="bb-chat-head"><strong>Ask about Bhavethra</strong>' +
    '<button id="bb-chat-close" type="button" aria-label="Close chat">✕</button></div>' +
    '<div id="bb-chat-msgs"></div>' +
    '<form id="bb-chat-form"><input id="bb-chat-input" type="text" autocomplete="off" ' +
    'placeholder="Ask about her skills, projects…" maxlength="500">' +
    '<button id="bb-chat-send" type="submit" aria-label="Send">' + sendIcon + '</button></form>';

  document.body.appendChild(btn);
  document.body.appendChild(panel);

  var msgs = panel.querySelector('#bb-chat-msgs');
  var form = panel.querySelector('#bb-chat-form');
  var input = panel.querySelector('#bb-chat-input');
  var send = panel.querySelector('#bb-chat-send');
  var greeted = false;

  /* ---------- helpers ---------- */
  function addMsg(kind, text) {
    var el = document.createElement('div');
    el.className = 'bb-msg ' + kind;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  function toggle(open) {
    var willOpen = open !== undefined ? open : !panel.classList.contains('open');
    panel.classList.toggle('open', willOpen);
    if (willOpen) {
      if (!greeted) {
        greeted = true;
        addMsg('bot', "Hi! I'm Bhavethra's AI assistant. Ask me anything about her skills, projects, or experience \u{1F44B}");
      }
      input.focus();
    }
  }

  btn.addEventListener('click', function () { toggle(); });
  panel.querySelector('#bb-chat-close').addEventListener('click', function () { toggle(false); });

  /* ---------- send + stream ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var q = input.value.trim();
    if (!q || busy) return;

    input.value = '';
    addMsg('user', q);
    history.push({ role: 'user', content: q });
    if (history.length > MAX_HISTORY) history = history.slice(-MAX_HISTORY);
    // API requires the first message to be from the user
    while (history.length && history[0].role !== 'user') history.shift();

    busy = true;
    send.disabled = true;
    var typing = document.createElement('div');
    typing.className = 'bb-typing';
    typing.textContent = 'thinking…';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;

    var botEl = null;
    var answer = '';

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history })
    })
      .then(function (resp) {
        if (!resp.ok) {
          return resp.json().catch(function () { return {}; }).then(function (data) {
            throw new Error(data.error || 'Request failed (' + resp.status + ')');
          });
        }
        var reader = resp.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function pump() {
          return reader.read().then(function (result) {
            if (result.done) return;
            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line in buffer
            lines.forEach(function (line) {
              if (line.indexOf('data: ') !== 0) return;
              var payload = line.slice(6);
              if (payload === '[DONE]') return;
              var data;
              try { data = JSON.parse(payload); } catch (err) { return; }
              if (data.error) throw new Error(data.error);
              if (data.text) {
                if (typing.parentNode) typing.remove();
                if (!botEl) botEl = addMsg('bot', '');
                answer += data.text;
                botEl.textContent = answer;
                msgs.scrollTop = msgs.scrollHeight;
              }
            });
            return pump();
          });
        }
        return pump();
      })
      .then(function () {
        if (answer) history.push({ role: 'assistant', content: answer });
      })
      .catch(function (err) {
        if (typing.parentNode) typing.remove();
        addMsg('error', err.message || 'Something went wrong. Please try again.');
      })
      .then(function () {
        if (typing.parentNode) typing.remove();
        busy = false;
        send.disabled = false;
        input.focus();
      });
  });
})();
