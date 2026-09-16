// Portal boot: signs the visitor in before the training app starts.
//
// 1. Hide the raw template immediately (support.js normally does this at boot).
// 2. Ask the API who is signed in. Not signed in → login.html. Password change
//    required → login.html?mode=change.
// 3. Expose the session, saved progress, course overrides and settings on
//    window.__PORTAL for the Component class inside index.html.
// 4. Swap any admin-replaced videos as the app renders them.
// 5. Load support.js, which boots the app.
(function () {
  'use strict';

  var style = document.createElement('style');
  style.textContent = 'x-dc{display:none!important}' +
    '#portal-splash{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#F7F9FC;z-index:99999;font-family:Manrope,-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#2B4863}' +
    '#portal-splash .card{max-width:420px;padding:28px 32px;text-align:center}' +
    '#portal-splash .dot{display:inline-block;width:10px;height:10px;border-radius:50%;background:#4B9BD7;margin:0 3px;animation:portalPulse 1.2s ease-in-out infinite}' +
    '#portal-splash .dot:nth-child(2){animation-delay:.15s}#portal-splash .dot:nth-child(3){animation-delay:.3s}' +
    '@keyframes portalPulse{0%,100%{opacity:.25;transform:translateY(0)}50%{opacity:1;transform:translateY(-4px)}}' +
    '#portal-splash h2{font-size:18px;margin:16px 0 8px;font-weight:700}#portal-splash p{font-size:14px;line-height:1.5;color:#4A525C;margin:0}' +
    '#portal-splash a{color:#2F6FA8}';
  document.head.appendChild(style);

  function splash(html) {
    var el = document.getElementById('portal-splash');
    if (!el) {
      el = document.createElement('div');
      el.id = 'portal-splash';
      (document.body || document.documentElement).appendChild(el);
    }
    el.innerHTML = '<div class="card">' + html + '</div>';
  }
  function removeSplash() {
    var el = document.getElementById('portal-splash');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function onReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  // Where to come back to after signing in (relative, so sub-folder installs work).
  var here = (location.pathname.split('/').pop() || 'index.html') + location.search + location.hash;
  var nextParam = 'next=' + encodeURIComponent(here);

  function go(url) { location.replace(url); }

  function installVideoOverrides(map) {
    var keys = Object.keys(map || {});
    if (!keys.length) return;
    function fix(v) {
      var s = v.getAttribute('src');
      if (!s) return;
      var decoded = s;
      try { decoded = decodeURIComponent(s); } catch (e) { /* keep raw */ }
      var repl = map[s] || map[decoded];
      if (repl && repl !== s) {
        v.setAttribute('src', repl);
        if (typeof v.load === 'function') { try { v.load(); } catch (e) { /* ignore */ } }
      }
    }
    function scan(node) {
      if (!node || node.nodeType !== 1) return;
      if (node.tagName === 'VIDEO') fix(node);
      if (node.querySelectorAll) {
        var vids = node.querySelectorAll('video[src]');
        for (var i = 0; i < vids.length; i++) fix(vids[i]);
      }
    }
    var mo = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'attributes') { if (m.target.tagName === 'VIDEO') fix(m.target); }
        else for (var j = 0; j < m.addedNodes.length; j++) scan(m.addedNodes[j]);
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    onReady(function () { scan(document.body); });
  }

  function loadApp() {
    var s = document.createElement('script');
    s.src = 'support.js';
    s.async = false;
    s.onload = function () {
      // support.js boots once React arrives from the CDN. Keep the splash up until
      // the app has mounted; if that takes far too long, say so instead of hanging.
      var started = Date.now();
      (function waitForRoot() {
        if (document.getElementById('dc-root')) { removeSplash(); return; }
        if (Date.now() - started > 25000) {
          showError('The training app is taking too long to load. Check your internet connection and refresh the page.');
          return;
        }
        setTimeout(waitForRoot, 50);
      })();
    };
    s.onerror = function () { showError('The app files could not be loaded. Please refresh the page.'); };
    document.head.appendChild(s);
  }

  function showError(msg) {
    splash('<h2>Something went wrong</h2><p>' + msg + '</p><p style="margin-top:14px"><a href="' + location.pathname + '">Try again</a> &middot; <a href="login.html">Sign in</a></p>');
  }

  onReady(function () { if (!window.__PORTAL) splash('<div><span class="dot"></span><span class="dot"></span><span class="dot"></span></div><h2>Loading your training</h2><p>One moment.</p>'); });

  fetch('api/auth.php?action=bootstrap', { credentials: 'same-origin', cache: 'no-store' })
    .then(function (r) {
      if (r.status === 401) { go('login.html?' + nextParam); return null; }
      if (!r.ok) throw new Error('The sign-in service returned an error (HTTP ' + r.status + ').');
      return r.json();
    })
    .then(function (data) {
      if (!data) return;
      if (!data.user) throw new Error('Unexpected response from the sign-in service.');
      if (data.user.must_change_password) { go('login.html?mode=change&' + nextParam); return; }
      if (Array.isArray(data.progress)) data.progress = {};
      data.overrides = data.overrides || {};
      if (Array.isArray(data.overrides.videos)) data.overrides.videos = {};
      if (Array.isArray(data.overrides.quizzes)) data.overrides.quizzes = {};
      window.__PORTAL = data;
      installVideoOverrides(data.overrides.videos);
      onReady(loadApp);
    })
    .catch(function (e) {
      onReady(function () {
        showError((e && e.message ? e.message : 'Could not reach the server.') +
          ' If this keeps happening, ask your administrator to check <code>api/auth.php?action=health</code>.');
      });
    });
})();
