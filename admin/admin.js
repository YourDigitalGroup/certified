/* Digital Certification — admin panel.
   Plain JavaScript, no build step. Talks to ../api/*.php. Hash-routed views:
   #/dashboard  #/users  #/users/:id  #/courses  #/courses/:id  #/settings  #/account
*/
(function () {
  'use strict';

  var API = '../api/';
  var LOGIN = '../login.html?next=' + encodeURIComponent('admin/');
  var ROLES = ['student', 'trainer', 'admin', 'superadmin'];
  var ROLE_LABEL = { student: 'Student', trainer: 'Trainer', admin: 'Admin', superadmin: 'Super admin' };
  var ROLE_HELP = {
    student: 'Takes the training. Courses unlock one at a time, in order.',
    trainer: 'Everything a student has, plus attendance: mark who has passed which course.',
    admin: 'Everything a trainer has, plus managing people and editing courses (quizzes and videos).',
    superadmin: 'Full control, including naming other super admins and site settings.',
  };

  // Session + caches
  var S = { me: null, csrf: null, impersonating: null, canImpersonate: false, settings: null, courses: null, sections: null, users: null, groups: null, courseCount: 43 };

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function attr(s) { return esc(s); }
  function initials(name) {
    var p = String(name || '').trim().split(/\s+/).filter(Boolean);
    return ((p[0] ? p[0][0] : '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
  }
  function fmtDate(iso, withTime) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    var opts = withTime ? { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } : { year: 'numeric', month: 'short', day: 'numeric' };
    return d.toLocaleString(undefined, opts);
  }
  function rank(role) { return ROLES.indexOf(role); }
  function can(minRole) { return S.me && rank(S.me.role) >= rank(minRole); }
  function assignableRoles() {
    if (!S.me) return [];
    if (S.me.role === 'superadmin') return ROLES.slice();
    if (S.me.role === 'admin') return ['student', 'trainer', 'admin'];
    return [];
  }
  function canManage(user) {
    if (!S.me) return false;
    if (S.me.role === 'superadmin') return true;
    if (S.me.role === 'admin') return rank(user.role) <= rank('admin');
    return false;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function debounce(fn, ms) { var t; return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); }; }
  function fmtBytes(n) { if (n < 1024) return n + ' B'; if (n < 1048576) return (n / 1024).toFixed(0) + ' KB'; return (n / 1048576).toFixed(1) + ' MB'; }
  function methodLabel(m) { return m === 'quiz' ? 'Quiz' : m === 'trainer' ? 'Marked by trainer' : m === 'import' ? 'Imported' : (m || ''); }
  function fileName(path) { return String(path || '').split('/').pop(); }

  function toast(msg, kind) {
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(function () { el.style.opacity = '0'; el.style.transition = 'opacity 300ms'; setTimeout(function () { el.remove(); }, 320); }, kind === 'err' ? 6000 : 3200);
  }

  // Modal: returns { el, close }. Content is HTML; caller binds handlers on el.
  function modal(opts) {
    var root = $('#modal-root');
    var bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = '<div class="modal' + (opts.wide ? ' wide' : '') + '" role="dialog" aria-modal="true">' +
      '<div class="m-h"><h2>' + esc(opts.title) + '</h2><button class="x" aria-label="Close">×</button></div>' +
      '<div class="m-b">' + (opts.body || '') + '</div>' +
      (opts.footer ? '<div class="m-f">' + opts.footer + '</div>' : '') + '</div>';
    root.appendChild(bg);
    function close() { bg.remove(); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    $('.x', bg).addEventListener('click', close);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg && !opts.sticky) close(); });
    $$('[data-close]', bg).forEach(function (b) { b.addEventListener('click', close); });
    var first = $('input:not([type=hidden]), select, textarea, button.primary', $('.m-b', bg));
    if (first) setTimeout(function () { first.focus(); }, 40);
    return { el: bg, close: close };
  }
  function confirmDialog(title, text, okLabel, danger) {
    return new Promise(function (resolve) {
      var m = modal({
        title: title,
        body: '<p style="margin:0;font-size:14px;line-height:1.55">' + text + '</p>',
        footer: '<button class="btn" data-close>Cancel</button><button class="btn ' + (danger ? 'danger' : 'primary') + '" id="cf-ok">' + esc(okLabel || 'Confirm') + '</button>',
      });
      $('#cf-ok', m.el).addEventListener('click', function () { m.close(); resolve(true); });
      $$('[data-close]', m.el).forEach(function (b) { b.addEventListener('click', function () { resolve(false); }); });
      $('.x', m.el).addEventListener('click', function () { resolve(false); });
    });
  }

  // API wrapper. GET when body is undefined; JSON POST otherwise. Rejects with Error(message).
  function api(path, body, rawOpts) {
    var opts = { credentials: 'same-origin', cache: 'no-store', headers: {} };
    if (rawOpts) { Object.keys(rawOpts).forEach(function (k) { opts[k] = rawOpts[k]; }); opts.headers = opts.headers || {}; }
    if (body !== undefined && !rawOpts) {
      opts.method = 'POST';
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (S.csrf && (opts.method || 'GET') !== 'GET') opts.headers['X-CSRF-Token'] = S.csrf;
    return fetch(API + path, opts).then(function (r) {
      return r.text().then(function (t) {
        var d;
        try { d = t ? JSON.parse(t) : {}; } catch (e) { d = { error: 'Unexpected server response (HTTP ' + r.status + ').' }; }
        if (r.status === 401) { location.replace(LOGIN); throw new Error('Signed out'); }
        if (!r.ok) { var err = new Error(d.error || ('Request failed (HTTP ' + r.status + ')')); err.data = d; err.status = r.status; throw err; }
        return d;
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Shell & routing
  // ---------------------------------------------------------------------------
  var ICONS = {
    dash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="8" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/><rect x="13" y="13" width="8" height="8" rx="2"/></svg>',
    users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><circle cx="17" cy="9" r="3"/><path d="M22 20v-1a4 4 0 0 0-3-3.9"/></svg>',
    courses: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M10 8l5 3-5 3z" fill="currentColor" stroke="none"/></svg>',
    settings: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    account: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  };

  function renderShell() {
    var me = S.me;
    var nav = [
      { h: '#/dashboard', l: 'Dashboard', i: 'dash' },
      { h: '#/users', l: 'People', i: 'users' },
      { h: '#/courses', l: 'Courses', i: 'courses' },
    ];
    if (can('superadmin')) nav.push({ h: '#/settings', l: 'Settings', i: 'settings' });
    nav.push({ h: '#/account', l: 'My account', i: 'account' });
    var banner = S.impersonating
      ? '<div class="impersonation-bar"><span>You are viewing the admin panel as <strong>' + esc(me.name) + '</strong> (' + esc(ROLE_LABEL[me.role] || me.role) + '). Anything you do counts for their account.</span><button class="btn sm" id="stop-impersonating">Return to my account (' + esc(S.impersonating.by) + ')</button></div>'
      : '';
    $('#app').innerHTML = banner +
      '<div class="shell">' +
        '<aside class="side">' +
          '<a class="brand" href="#/dashboard"><img src="../assets/logo-icon-white.svg" alt=""><div><div class="t">Digital Certification</div><div class="s">Admin panel</div></div></a>' +
          '<nav class="nav" id="nav">' + nav.map(function (n) { return '<a href="' + n.h + '" data-route="' + n.h + '"><span class="ico">' + ICONS[n.i] + '</span>' + n.l + '</a>'; }).join('') +
            '<div class="sep"></div><a href="../index.html"><span class="ico">↩</span>Back to training</a>' +
          '</nav>' +
          '<div class="me"><div class="av">' + esc(initials(me.name)) + '</div><div><div class="n">' + esc(me.name) + '</div><div class="r">' + esc(ROLE_LABEL[me.role] || me.role) + '</div></div><button id="signout" title="Sign out">Sign out</button></div>' +
        '</aside>' +
        '<main class="main" id="main"></main>' +
      '</div>';
    $('#signout').addEventListener('click', function () {
      api('auth.php?action=logout', {}).then(function () { location.replace('../login.html'); }, function () { location.replace('../login.html'); });
    });
    if ($('#stop-impersonating')) $('#stop-impersonating').addEventListener('click', function () {
      var uid = S.me.id;
      // Full reload (the query string changes so the browser never treats this as a hash-only change).
      api('auth.php?action=stop_impersonating', {}).then(function () { location.replace('index.html?r=' + Date.now() + '#/users/' + uid); }).catch(function (e) { toast(e.message, 'err'); });
    });
  }

  // "Sign in as": only a permitted super admin sees this. Confirms, switches the
  // session to the other person, and opens the portal as them.
  function impersonate(u) {
    confirmDialog('Sign in as ' + u.name,
      'You will see the portal exactly as <strong>' + esc(u.name) + '</strong> does, and anything you do (including passing quizzes) is recorded for their account. A bar at the bottom of the page lets you return to your own account.',
      'Sign in as ' + (u.first_name || u.name)).then(function (yes) {
      if (!yes) return;
      api('auth.php?action=impersonate', { user_id: u.id }).then(function () { location.href = '../index.html'; }).catch(function (e) { toast(e.message, 'err'); });
    });
  }

  function setActiveNav(hash) {
    $$('#nav a[data-route]').forEach(function (a) {
      var r = a.getAttribute('data-route');
      a.classList.toggle('active', hash === r || hash.indexOf(r + '/') === 0);
    });
  }

  // Each navigation gets a sequence number; a view whose data arrives after the
  // person has already moved on must not paint over the newer view.
  var routeSeq = 0;
  var setMainImpl = null;
  function route() {
    var hash = location.hash || '#/dashboard';
    var parts = hash.replace(/^#\/?/, '').split('/');
    var main = $('#main');
    var seq = ++routeSeq;
    setActiveNav('#/' + parts[0]);
    main.innerHTML = '<div class="loading"><span class="spin"></span></div>';
    setMainImpl = function (html) {
      if (seq !== routeSeq) return document.createElement('div'); // stale: render into a detached node
      $('#main').innerHTML = html;
      return $('#main');
    };
    var view;
    try {
      switch (parts[0]) {
        case 'users': view = parts[1] ? viewUser(decodeURIComponent(parts[1])) : viewUsers(); break;
        case 'courses': view = parts[1] ? viewCourse(decodeURIComponent(parts[1]), parts[2]) : viewCourses(); break;
        case 'settings': view = can('superadmin') ? viewSettings() : viewDashboard(); break;
        case 'account': view = viewAccount(); break;
        default: view = viewDashboard();
      }
    } catch (e) { view = Promise.reject(e); }
    Promise.resolve(view).catch(function (e) {
      if (seq !== routeSeq || (e && e.message === 'Signed out')) return;
      console.error(e);
      main.innerHTML = '<div class="card"><div class="notice err">' + esc(e.message || 'Something went wrong.') + '</div></div>';
    });
  }

  function setMain(html) { return setMainImpl ? setMainImpl(html) : $('#main'); }

  // ---------------------------------------------------------------------------
  // Data helpers
  // ---------------------------------------------------------------------------
  function loadCourses(force) {
    if (S.courses && !force) return Promise.resolve(S.courses);
    return api('courses.php?action=list').then(function (d) {
      S.courses = d.courses; S.sections = d.sections; S.totalUsers = d.total_users; S.courseCount = d.courses.length;
      return S.courses;
    });
  }
  function courseById(id) { return (S.courses || []).filter(function (c) { return c.id === id; })[0]; }
  function coursesBySection() {
    var out = [];
    (S.sections || []).forEach(function (name) {
      var list = (S.courses || []).filter(function (c) { return c.section === name; });
      if (list.length) out.push({ name: name, courses: list });
    });
    return out;
  }
  function loadUsers(params) {
    var q = new URLSearchParams(params || {}).toString();
    return api('users.php?action=list' + (q ? '&' + q : '')).then(function (d) {
      S.groups = d.groups; if (d.course_count) S.courseCount = d.course_count;
      return d.users;
    });
  }
  function groupOptions(selected, includeAll) {
    var opts = includeAll ? '<option value="">All groups</option>' : '<option value="">— none —</option>';
    (S.groups || []).forEach(function (g) {
      opts += '<option value="' + attr(g.group_name) + '"' + (g.group_name === selected ? ' selected' : '') + '>' + esc(g.group_name) + (includeAll ? ' (' + g.n + ')' : '') + '</option>';
    });
    return opts;
  }
  function roleBadge(role) { return '<span class="badge ' + esc(role) + '">' + esc(ROLE_LABEL[role] || role) + '</span>'; }
  function accessBadge(u) {
    if (!u.active) return '<span class="badge off">Deactivated</span>';
    if (!u.has_password) return '<span class="badge warn">No password yet</span>';
    if (u.must_change_password) return '<span class="badge info">Must change password</span>';
    return '<span class="badge ok">Password set</span>';
  }
  function progressBar(n, total) {
    var pct = total ? Math.round(100 * n / total) : 0;
    return '<span class="prog"><span class="bar"><div style="width:' + pct + '%"></div></span><span class="n">' + n + ' / ' + total + '</span></span>';
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  function viewDashboard() {
    return Promise.all([loadCourses(), api('completions.php?action=summary'), api('users.php?action=groups'), can('admin') ? api('settings.php?action=audit&limit=12') : Promise.resolve({ entries: [] })])
      .then(function (res) {
        var summary = res[1], groups = res[2].groups || [], audit = res[3].entries || [];
        var totalPasses = 0; Object.keys(summary.counts || {}).forEach(function (k) { totalPasses += summary.counts[k]; });
        var html = '<div class="page-head"><div><div class="eyebrow">Overview</div><h1>Welcome back, ' + esc(S.me.first_name || S.me.name) + '.</h1>' +
          '<p class="lede">' + esc(ROLE_HELP[S.me.role]) + '</p></div>' +
          '<div class="row wrap">' +
            (can('admin') ? '<button class="btn primary" id="d-add">+ Add a person</button><button class="btn" id="d-import">Import CSV</button>' : '') +
            '<a class="btn" href="#/courses">Take attendance</a>' +
          '</div></div>' +
          '<div class="tiles">' +
            '<div class="tile"><div class="k">People</div><div class="v">' + summary.users + '</div><div class="d"><a href="#/users">Manage the directory →</a></div></div>' +
            '<div class="tile"><div class="k">Groups</div><div class="v">' + groups.length + '</div><div class="d">' + esc(groups.slice(0, 3).map(function (g) { return g.group_name; }).join(', ')) + (groups.length > 3 ? '…' : '') + '</div></div>' +
            '<div class="tile"><div class="k">Courses</div><div class="v">' + S.courses.length + '</div><div class="d">' + S.courses.filter(function (c) { return c.quiz_edited_at || c.videos_replaced; }).length + ' customized</div></div>' +
            '<div class="tile"><div class="k">Passes recorded</div><div class="v">' + totalPasses + '</div><div class="d">across all people and courses</div></div>' +
          '</div>' +
          '<div class="grid-3-2">' +
            '<div class="card tight"><div class="card-head"><h2>Courses by pass count</h2><a class="btn sm" href="#/courses">All courses</a></div><div class="table-wrap"><table><thead><tr><th>Course</th><th>Section</th><th class="right">Passed</th></tr></thead><tbody>' +
              S.courses.slice().sort(function (a, b) { return (summary.counts[b.id] || 0) - (summary.counts[a.id] || 0) || a.order - b.order; }).slice(0, 10).map(function (c) {
                return '<tr class="click" data-href="#/courses/' + attr(c.id) + '"><td><strong>' + esc(c.title) + '</strong></td><td class="muted small">' + esc(c.section) + '</td><td class="right">' + progressBar(summary.counts[c.id] || 0, summary.users) + '</td></tr>';
              }).join('') + '</tbody></table></div></div>' +
            '<div class="card tight"><div class="card-head"><h2>Recent activity</h2></div>' +
              (audit.length ? '<div class="table-wrap"><table><tbody>' + audit.map(function (a) {
                return '<tr><td><div><strong>' + esc(a.who) + '</strong> <span class="muted">' + esc(a.action.replace(/\./g, ' · ').replace(/_/g, ' ')) + '</span></div><div class="sub">' + esc(a.target || '') + (a.detail && a.detail.length < 80 && !/^\{|^\[/.test(a.detail) ? ' — ' + esc(a.detail) : '') + '</div></td><td class="right muted small nowrap">' + esc(fmtDate(a.at, true)) + '</td></tr>';
              }).join('') + '</tbody></table></div>' : '<div class="empty">' + (can('admin') ? 'No activity yet.' : 'Activity is visible to admins.') + '</div>') +
            '</div>' +
          '</div>';
        var main = setMain(html);
        bindRowLinks(main);
        if ($('#d-add', main)) $('#d-add', main).addEventListener('click', function () { openUserForm(null); });
        if ($('#d-import', main)) $('#d-import', main).addEventListener('click', openImport);
      });
  }
  function bindRowLinks(root) {
    $$('tr[data-href]', root).forEach(function (tr) {
      tr.addEventListener('click', function (e) {
        if (e.target.closest('button, a, input, select, label')) return;
        location.hash = tr.getAttribute('data-href');
      });
    });
  }

  // ---------------------------------------------------------------------------
  // People list
  // ---------------------------------------------------------------------------
  var usersFilter = { q: '', group: '', role: '', stage: '', band: '', sort: 'name' };
  var STAGES = [
    { k: 'none', l: 'Not started' }, { k: 'progress', l: 'In progress' }, { k: 'process', l: 'Process complete' },
    { k: 'd101', l: 'Digital 101 complete' }, { k: 'certified', l: 'Fully certified' },
  ];
  var BANDS = [{ k: '0', l: '0%' }, { k: '1', l: '1–25%' }, { k: '2', l: '26–50%' }, { k: '3', l: '51–75%' }, { k: '4', l: '76–99%' }, { k: '5', l: '100%' }];
  // Stage = the furthest tier a person has fully completed, in the order the portal unlocks them.
  function stageOf(ids) {
    var done = {}; (ids || []).forEach(function (id) { done[id] = true; });
    var courses = S.courses || [];
    var n = courses.filter(function (c) { return done[c.id]; }).length;
    if (!n) return 'none';
    if (courses.length && n >= courses.length) return 'certified';
    var all = function (list) { return list.length > 0 && list.every(function (c) { return done[c.id]; }); };
    var process = courses.filter(function (c) { return c.sectionIndex === 0; });
    var d101 = courses.filter(function (c) { return c.sectionIndex === 1 || c.sectionIndex === 2; });
    if (all(process) && all(d101)) return 'd101';
    if (all(process)) return 'process';
    return 'progress';
  }
  function bandOf(n, total) {
    var pct = total ? Math.round(100 * n / total) : 0;
    return pct <= 0 ? '0' : pct <= 25 ? '1' : pct <= 50 ? '2' : pct <= 75 ? '3' : pct < 100 ? '4' : '5';
  }
  function stageBadge(k) {
    var cls = { none: 'off', progress: 'info', process: 'warn', d101: 'admin', certified: 'superadmin' }[k] || 'off';
    var st = STAGES.filter(function (s) { return s.k === k; })[0];
    return '<span class="badge ' + cls + '">' + esc(st ? st.l : k) + '</span>';
  }
  function applyClientFilters(users) {
    var total = (S.courses || []).length || S.courseCount;
    var list = users.filter(function (u) {
      if (usersFilter.stage && stageOf(u.completed_ids) !== usersFilter.stage) return false;
      if (usersFilter.band && bandOf(u.completed_count || 0, total) !== usersFilter.band) return false;
      return true;
    });
    var s = usersFilter.sort;
    var byName = function (a, b) { return (a.last_name || '').localeCompare(b.last_name || '') || a.name.localeCompare(b.name); };
    list.sort(function (a, b) {
      if (s === 'progress') return (b.completed_count || 0) - (a.completed_count || 0) || byName(a, b);
      if (s === 'progress_asc') return (a.completed_count || 0) - (b.completed_count || 0) || byName(a, b);
      if (s === 'login') return (b.last_login_at || '').localeCompare(a.last_login_at || '') || byName(a, b);
      if (s === 'group') return (a.group_name || '').localeCompare(b.group_name || '') || byName(a, b);
      if (s === 'newest') return (b.created_at || '').localeCompare(a.created_at || '') || byName(a, b);
      return byName(a, b);
    });
    return list;
  }
  function viewUsers() {
    if (S.me.role === 'trainer' && usersFilter.group === '' && !usersFilter._touched && S.me.group_name) usersFilter.group = S.me.group_name;
    return Promise.all([loadUsers({ q: usersFilter.q, group: usersFilter.group, role: usersFilter.role }), loadCourses()]).then(function (res) {
      var users = res[0];
      S.users = users;
      var sel = function (id, opts, val, firstLabel) {
        return '<select class="input" id="' + id + '"><option value="">' + firstLabel + '</option>' + opts.map(function (o) { return '<option value="' + o.k + '"' + (val === o.k ? ' selected' : '') + '>' + o.l + '</option>'; }).join('') + '</select>';
      };
      var sorts = [{ k: 'name', l: 'Sort: Name' }, { k: 'group', l: 'Sort: Group' }, { k: 'progress', l: 'Sort: Most progress' }, { k: 'progress_asc', l: 'Sort: Least progress' }, { k: 'login', l: 'Sort: Last sign-in' }, { k: 'newest', l: 'Sort: Newest' }];
      var html = '<div class="page-head"><div><div class="eyebrow">Directory</div><h1>People</h1><p class="lede">' +
        (can('admin') ? 'Add people one at a time or import a spreadsheet. Click a person to edit their details, access, and completed courses.' : 'Click a person to see and update the courses they have completed.') + '</p></div>' +
        '<div class="row wrap">' + (can('admin') ? '<button class="btn primary" id="u-add">+ Add a person</button><button class="btn" id="u-import">Import CSV</button><a class="btn" href="' + API + 'users.php?action=export">Export CSV</a>' : '') + '</div></div>' +
        '<div class="card tight">' +
          '<div class="toolbar" style="padding:14px 16px 0 16px;margin:0">' +
            '<div class="search">' + ICONS.search + '<input class="input" id="u-q" placeholder="Search name, email, group, phone" value="' + attr(usersFilter.q) + '"></div>' +
            '<select class="input" id="u-group">' + groupOptions(usersFilter.group, true) + '</select>' +
            '<select class="input" id="u-role"><option value="">All roles</option>' + ROLES.map(function (r) { return '<option value="' + r + '"' + (usersFilter.role === r ? ' selected' : '') + '>' + ROLE_LABEL[r] + '</option>'; }).join('') + '</select>' +
            sel('u-stage', STAGES, usersFilter.stage, 'All stages') +
            sel('u-band', BANDS, usersFilter.band, 'Any % complete') +
            '<select class="input" id="u-sort">' + sorts.map(function (o) { return '<option value="' + o.k + '"' + (usersFilter.sort === o.k ? ' selected' : '') + '>' + o.l + '</option>'; }).join('') + '</select>' +
            '<span class="muted small nowrap" id="u-count"></span>' +
          '</div>' +
          '<div class="table-wrap" style="margin-top:12px"></div>' +
        '</div>';
      var main = setMain(html);
      var wrap = $('.table-wrap', main), countEl = $('#u-count', main);
      function render() {
        if (!wrap || !wrap.isConnected) return;
        var shown = applyClientFilters(S.users || []);
        wrap.innerHTML = usersTable(shown);
        var n = (S.users || []).length;
        countEl.textContent = shown.length === n ? n + ' ' + (n === 1 ? 'person' : 'people') : shown.length + ' of ' + n + ' people';
        bindRowLinks(wrap);
      }
      render();
      var reload = debounce(function () {
        usersFilter._touched = true;
        loadUsers({ q: usersFilter.q, group: usersFilter.group, role: usersFilter.role }).then(function (list) {
          if (!wrap || !wrap.isConnected) return; // the person has navigated away
          S.users = list;
          render();
        }).catch(function (e) { toast(e.message, 'err'); });
      }, 200);
      $('#u-q', main).addEventListener('input', function (e) { usersFilter.q = e.target.value; reload(); });
      $('#u-group', main).addEventListener('change', function (e) { usersFilter.group = e.target.value; usersFilter._touched = true; reload(); });
      $('#u-role', main).addEventListener('change', function (e) { usersFilter.role = e.target.value; reload(); });
      $('#u-stage', main).addEventListener('change', function (e) { usersFilter.stage = e.target.value; render(); });
      $('#u-band', main).addEventListener('change', function (e) { usersFilter.band = e.target.value; render(); });
      $('#u-sort', main).addEventListener('change', function (e) { usersFilter.sort = e.target.value; render(); });
      if ($('#u-add', main)) $('#u-add', main).addEventListener('click', function () { openUserForm(null); });
      if ($('#u-import', main)) $('#u-import', main).addEventListener('click', openImport);
    });
  }
  function usersTable(users) {
    if (!users.length) return '<div class="empty"><strong>No people match.</strong>' + (can('admin') ? 'Adjust the filters, add someone, or import a CSV.' : 'Try a different group, stage, or search.') + '</div>';
    var total = (S.courses || []).length || S.courseCount;
    return '<table><thead><tr><th>Name</th><th>Group</th><th>Role</th><th>Stage</th><th>Progress</th><th>Access</th><th>Last sign-in</th></tr></thead><tbody>' +
      users.map(function (u) {
        return '<tr class="click" data-href="#/users/' + u.id + '">' +
          '<td><div class="row"><span class="avatar">' + esc(initials(u.name)) + '</span><div><div><strong>' + esc(u.name) + '</strong></div><div class="sub">' + esc(u.email) + (u.phone ? ' · ' + esc(u.phone) : '') + '</div></div></div></td>' +
          '<td>' + (u.group_name ? esc(u.group_name) : '<span class="muted">—</span>') + '</td>' +
          '<td>' + roleBadge(u.role) + '</td>' +
          '<td>' + stageBadge(stageOf(u.completed_ids)) + '</td>' +
          '<td>' + progressBar(u.completed_count || 0, total) + '</td>' +
          '<td>' + accessBadge(u) + '</td>' +
          '<td class="muted small nowrap">' + (u.last_login_at ? esc(fmtDate(u.last_login_at, true)) : 'Never') + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }

  // Add / edit person form (modal)
  function openUserForm(user) {
    var isNew = !user;
    var roles = assignableRoles();
    var body =
      '<div class="fields">' +
        '<div><label class="f">First name</label><input class="input" name="first_name" value="' + attr(user ? user.first_name : '') + '" autocomplete="off"></div>' +
        '<div><label class="f">Last name</label><input class="input" name="last_name" value="' + attr(user ? user.last_name : '') + '" autocomplete="off"></div>' +
        '<div class="span2"><label class="f">Email <span class="muted">(used to sign in)</span></label><input class="input" name="email" type="email" value="' + attr(user ? user.email : '') + '" autocomplete="off" required></div>' +
        '<div><label class="f">Group name</label><input class="input" name="group_name" list="group-list" value="' + attr(user ? user.group_name : '') + '" autocomplete="off" placeholder="e.g. KXYZ Radio"><datalist id="group-list">' + (S.groups || []).map(function (g) { return '<option value="' + attr(g.group_name) + '">'; }).join('') + '</datalist></div>' +
        '<div><label class="f">Phone</label><input class="input" name="phone" value="' + attr(user ? user.phone : '') + '" autocomplete="off"></div>' +
        '<div class="span2"><label class="f">Address</label><input class="input" name="address" value="' + attr(user ? user.address : '') + '" autocomplete="off" placeholder="Street address"></div>' +
        '<div><label class="f">City</label><input class="input" name="city" value="' + attr(user ? user.city : '') + '" autocomplete="off"></div>' +
        '<div class="row" style="gap:12px;align-items:flex-end"><div class="grow"><label class="f">State</label><input class="input" name="state" value="' + attr(user ? user.state : '') + '" autocomplete="off"></div><div style="width:120px"><label class="f">ZIP</label><input class="input" name="zip" value="' + attr(user ? user.zip : '') + '" autocomplete="off"></div></div>' +
        '<div class="span2"><label class="f">Role</label><select class="input" name="role">' + ROLES.map(function (r) {
          var allowed = roles.indexOf(r) >= 0 || (user && user.role === r);
          return '<option value="' + r + '"' + ((user ? user.role : 'student') === r ? ' selected' : '') + (allowed ? '' : ' disabled') + '>' + ROLE_LABEL[r] + '</option>';
        }).join('') + '</select><div class="hint" id="role-help">' + esc(ROLE_HELP[user ? user.role : 'student']) + '</div></div>' +
        (isNew ?
          '<div class="span2" style="border-top:1px solid var(--gray-100);padding-top:14px"><label class="f">Sign-in</label>' +
            '<label class="check"><input type="radio" name="pwmode" value="none" checked> No password yet — they sign in with just their email and create a password the first time</label><br>' +
            '<label class="check" style="margin-top:8px"><input type="radio" name="pwmode" value="set"> Set a password now</label>' +
            '<div id="pw-fields" class="hidden" style="margin-top:10px"><input class="input" name="password" type="text" placeholder="Temporary password (at least 8 characters)" autocomplete="new-password">' +
            '<label class="check" style="margin-top:8px"><input type="checkbox" name="require_change" checked> Ask them to choose a new password at first sign-in</label></div>' +
          '</div>' : '') +
        '<div class="span2"><label class="f">Notes <span class="muted">(only admins see this)</span></label><textarea class="input" name="notes">' + esc(user ? user.notes : '') + '</textarea></div>' +
      '</div><div class="notice err hidden mt" id="uf-err"></div>';
    var m = modal({ title: isNew ? 'Add a person' : 'Edit ' + user.name, body: body, sticky: true,
      footer: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="uf-save">' + (isNew ? 'Add person' : 'Save changes') + '</button>' });
    var form = $('.m-b', m.el);
    $('[name=role]', form).addEventListener('change', function (e) { $('#role-help', form).textContent = ROLE_HELP[e.target.value]; });
    if (isNew) $$('[name=pwmode]', form).forEach(function (r) { r.addEventListener('change', function () { $('#pw-fields', form).classList.toggle('hidden', $('[name=pwmode]:checked', form).value !== 'set'); }); });
    $('#uf-save', m.el).addEventListener('click', function () {
      var data = {};
      ['first_name', 'last_name', 'email', 'group_name', 'phone', 'address', 'city', 'state', 'zip', 'notes', 'role'].forEach(function (k) { data[k] = $('[name=' + k + ']', form).value.trim(); });
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return showErr('Enter a valid email address.');
      if (isNew) {
        if ($('[name=pwmode]:checked', form).value === 'set') {
          data.password = $('[name=password]', form).value;
          if (data.password.length < 8) return showErr('The password needs at least 8 characters.');
          data.require_change = $('[name=require_change]', form).checked;
        }
      } else data.id = user.id;
      var btn = $('#uf-save', m.el); btn.disabled = true;
      api('users.php?action=' + (isNew ? 'create' : 'update'), data).then(function (d) {
        m.close();
        toast(isNew ? d.user.name + ' added.' : 'Saved.', 'ok');
        if (isNew) location.hash = '#/users/' + d.user.id; else route();
      }).catch(function (e) { btn.disabled = false; showErr(e.message); });
    });
    function showErr(t) { var el = $('#uf-err', form); el.textContent = t; el.classList.remove('hidden'); }
  }

  // ---------------------------------------------------------------------------
  // CSV import
  // ---------------------------------------------------------------------------
  var FIELDS = [
    { k: 'first_name', l: 'First name', a: ['first', 'firstname', 'first name', 'fname', 'given name'] },
    { k: 'last_name', l: 'Last name', a: ['last', 'lastname', 'last name', 'lname', 'surname', 'family name'] },
    { k: 'email', l: 'Email', a: ['email', 'e-mail', 'email address', 'mail'] },
    { k: 'group_name', l: 'Group name', a: ['group', 'group name', 'groupname', 'company', 'station', 'organization', 'org', 'team'] },
    { k: 'phone', l: 'Phone', a: ['phone', 'telephone', 'mobile', 'cell', 'phone number'] },
    { k: 'address', l: 'Address', a: ['address', 'street', 'address 1', 'address1', 'street address'] },
    { k: 'city', l: 'City', a: ['city', 'town'] },
    { k: 'state', l: 'State', a: ['state', 'province', 'region'] },
    { k: 'zip', l: 'ZIP', a: ['zip', 'zipcode', 'zip code', 'postal', 'postal code', 'postcode'] },
    { k: 'role', l: 'Role', a: ['role', 'tier', 'level', 'type'] },
    { k: 'password', l: 'Password', a: ['password', 'pass', 'pwd', 'temporary password'] },
    { k: 'completed', l: 'Completed courses', a: ['completed', 'completed courses', 'courses', 'passed', 'completions'] },
    { k: 'name', l: 'Full name (split)', a: ['name', 'full name', 'fullname'] },
    { k: 'password_hash', l: 'Password hash (old site)', a: ['password_hash', 'password hash', 'user_pass', 'hash'] },
    { k: 'created_at', l: 'Registered date', a: ['created_at', 'registered', 'user_registered', 'created', 'joined', 'date registered'] },
    { k: 'last_login', l: 'Last sign-in', a: ['last_login', 'last login', 'last_login_at', 'last sign-in', 'last signin'] },
  ];
  function parseCSV(text) {
    var rows = [], row = [], cell = '', i = 0, q = false;
    text = String(text || '').replace(/^﻿/, '');
    var delim = (text.split('\n')[0] || '').indexOf('\t') >= 0 ? '\t' : (text.split('\n')[0] || '').indexOf(';') >= 0 && (text.split('\n')[0] || '').indexOf(',') < 0 ? ';' : ',';
    while (i < text.length) {
      var ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 2; continue; } q = false; i++; continue; }
        cell += ch; i++; continue;
      }
      if (ch === '"') { q = true; i++; continue; }
      if (ch === delim) { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += ch; i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
  }
  function normHeader(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function guessField(header) {
    var h = normHeader(header);
    if (!h) return '';
    for (var i = 0; i < FIELDS.length; i++) {
      if (normHeader(FIELDS[i].k) === h) return FIELDS[i].k;
      for (var j = 0; j < FIELDS[i].a.length; j++) if (normHeader(FIELDS[i].a[j]) === h) return FIELDS[i].k;
    }
    return '';
  }
  function templateCSV() {
    var head = ['first_name', 'last_name', 'email', 'group', 'phone', 'address', 'city', 'state', 'zip', 'role', 'password', 'completed'];
    var sample = ['Jane', 'Doe', 'jane@station.com', 'KXYZ Radio', '555-0100', '1 Main St', 'Sioux Falls', 'SD', '57104', 'student', '', 'p1|Getting Ready to Sell'];
    return head.join(',') + '\n' + sample.map(function (v) { return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',') + '\n';
  }
  function openImport() {
    var m = modal({ title: 'Import people from a spreadsheet', wide: true, sticky: true,
      body:
        '<div class="notice info mb">Export your list as CSV (Excel and Google Sheets both can). Include a header row. Columns can be in any order; you will confirm the mapping before anything is imported. ' +
        '<a href="#" id="imp-template">Download a template</a>.</div>' +
        '<div class="grid2">' +
          '<div><label class="f">Choose a file</label><div class="drop" id="imp-drop"><input type="file" id="imp-file" accept=".csv,.txt,.tsv,text/csv" style="display:none"><div>Drop a .csv here or <a href="#" id="imp-browse">browse</a></div></div></div>' +
          '<div><label class="f">…or paste rows</label><textarea class="input" id="imp-text" style="min-height:96px" placeholder="first_name,last_name,email,group\nJane,Doe,jane@station.com,KXYZ Radio"></textarea></div>' +
        '</div>' +
        '<div id="imp-map" class="mt hidden"></div>' +
        '<div id="imp-result" class="mt hidden"></div>',
      footer: '<div class="left row wrap"><label class="check"><input type="radio" name="imp-mode" value="upsert" checked> Update people who already exist (matched by email)</label><label class="check"><input type="radio" name="imp-mode" value="skip"> Skip people who already exist</label></div>' +
        '<button class="btn" data-close>Cancel</button><button class="btn primary" id="imp-go" disabled>Import</button>' });
    var el = m.el, rows = [], headers = [], mapping = [];
    $('#imp-template', el).addEventListener('click', function (e) {
      e.preventDefault();
      var blob = new Blob([templateCSV()], { type: 'text/csv' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'people-template.csv'; a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    });
    $('#imp-browse', el).addEventListener('click', function (e) { e.preventDefault(); $('#imp-file', el).click(); });
    $('#imp-file', el).addEventListener('change', function (e) { if (e.target.files[0]) readFile(e.target.files[0]); });
    var drop = $('#imp-drop', el);
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
    $('#imp-text', el).addEventListener('input', debounce(function (e) { if (e.target.value.trim()) analyze(e.target.value); }, 300));
    function readFile(f) { var r = new FileReader(); r.onload = function () { $('#imp-text', el).value = ''; analyze(String(r.result)); }; r.readAsText(f); }
    function analyze(text) {
      var parsed = parseCSV(text);
      if (parsed.length < 1) return;
      var first = parsed[0];
      var looksHeader = first.some(function (c) { return guessField(c) !== ''; }) && !first.some(function (c) { return /@/.test(c); });
      headers = looksHeader ? first : first.map(function (_, i) { return 'Column ' + (i + 1); });
      rows = looksHeader ? parsed.slice(1) : parsed;
      mapping = headers.map(function (h, i) {
        if (looksHeader) return guessField(h);
        var sample = (rows[0] || [])[i] || '';
        return /@/.test(sample) ? 'email' : '';
      });
      renderMap();
    }
    function renderMap() {
      var box = $('#imp-map', el);
      box.classList.remove('hidden');
      var opts = '<option value="">(ignore)</option>' + FIELDS.map(function (f) { return '<option value="' + f.k + '">' + f.l + '</option>'; }).join('');
      box.innerHTML = '<h3 class="mb">Match your columns · ' + rows.length + ' rows found</h3><div class="table-wrap list-scroll" style="max-height:300px"><table><thead><tr>' +
        headers.map(function (h, i) { return '<th><div class="small muted" style="text-transform:none;letter-spacing:0">' + esc(h) + '</div><select class="input sm imp-sel" data-i="' + i + '">' + opts + '</select></th>'; }).join('') +
        '</tr></thead><tbody>' + rows.slice(0, 6).map(function (r) { return '<tr>' + headers.map(function (_, i) { return '<td class="small">' + esc(r[i] || '') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
        (rows.length > 6 ? '<div class="hint">Showing the first 6 of ' + rows.length + ' rows.</div>' : '') +
        '<div class="hint">Role accepts student, trainer, admin or superadmin (anything else becomes student). "Completed courses" accepts course ids or titles separated by | ; or , — those are recorded as passed; add the date it was passed as <code>p1@2026-05-22</code>. "Password hash" carries a WordPress or bcrypt hash from a previous site so people keep their old password.</div>' +
        '<div class="notice err hidden mt" id="imp-err"></div>';
      $$('.imp-sel', box).forEach(function (s) { s.value = mapping[Number(s.getAttribute('data-i'))] || ''; s.addEventListener('change', function () { mapping[Number(s.getAttribute('data-i'))] = s.value; validate(); }); });
      validate();
    }
    function validate() {
      var ok = mapping.indexOf('email') >= 0 && rows.length > 0;
      $('#imp-go', el).disabled = !ok;
      var err = $('#imp-err', el);
      if (err) { err.classList.toggle('hidden', ok || !rows.length); err.textContent = 'Map one column to Email — that is how people are matched and how they sign in.'; }
    }
    $('#imp-go', el).addEventListener('click', function () {
      var payload = rows.map(function (r) {
        var o = {};
        mapping.forEach(function (k, i) {
          if (!k) return;
          var v = String(r[i] == null ? '' : r[i]).trim();
          if (k === 'name') { var p = v.split(/\s+/); if (!o.first_name) o.first_name = p.shift() || ''; if (!o.last_name) o.last_name = p.join(' '); return; }
          o[k] = v;
        });
        return o;
      }).filter(function (o) { return o.email; });
      var btn = $('#imp-go', el); btn.disabled = true; btn.textContent = 'Importing…';
      api('users.php?action=import', { rows: payload, mode: $('[name=imp-mode]:checked', el).value }).then(function (d) {
        var res = $('#imp-result', el); res.classList.remove('hidden');
        res.innerHTML = '<div class="notice ok"><strong>Done.</strong> ' + d.created + ' added · ' + d.updated + ' updated · ' + d.skipped + ' skipped' + (d.completions_added ? ' · ' + d.completions_added + ' course passes recorded' : '') + '.</div>' +
          (d.errors.length ? '<div class="notice warn mt"><strong>' + d.errors.length + ' row' + (d.errors.length === 1 ? '' : 's') + ' need attention:</strong><ul style="margin:6px 0 0;padding-left:18px">' + d.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>' : '');
        btn.textContent = 'Close'; btn.disabled = false; btn.onclick = function () { m.close(); route(); };
        $('#imp-map', el).classList.add('hidden');
      }).catch(function (e) { btn.disabled = false; btn.textContent = 'Import'; var err = $('#imp-err', el); if (err) { err.textContent = e.message; err.classList.remove('hidden'); } else toast(e.message, 'err'); });
    });
  }

  // ---------------------------------------------------------------------------
  // Person detail
  // ---------------------------------------------------------------------------
  function viewUser(id) {
    return Promise.all([api('users.php?action=get&id=' + encodeURIComponent(id)), loadCourses(), S.groups ? Promise.resolve() : api('users.php?action=groups').then(function (d) { S.groups = d.groups; })]).then(function (res) {
      var u = res[0].user, completions = res[0].completions;
      var done = {}; completions.forEach(function (c) { done[c.course_id] = c; });
      var manageable = canManage(u) && can('admin');
      var isSelf = u.id === S.me.id;
      var html = '<div class="crumbs"><a href="#/users">People</a> › ' + esc(u.name) + '</div>' +
        '<div class="page-head"><div class="row" style="gap:16px"><span class="avatar lg">' + esc(initials(u.name)) + '</span><div><h1>' + esc(u.name) + '</h1><div class="row wrap" style="margin-top:6px">' + roleBadge(u.role) + accessBadge(u) + '<span class="muted small">' + esc(u.email) + (u.group_name ? ' · ' + esc(u.group_name) : '') + '</span></div></div></div>' +
        '<div class="row wrap">' +
          (S.canImpersonate && !isSelf && u.active ? '<button class="btn dark" id="p-impersonate" title="See the portal as this person">Sign in as ' + esc(u.first_name || u.name) + '</button>' : '') +
          (manageable ? '<button class="btn" id="p-edit">Edit details</button>' : '') + '</div></div>' +
        '<div class="grid-2-3">' +
          '<div class="stack">' +
            '<div class="card"><div class="card-head"><h2>Details</h2></div><dl class="kv">' +
              '<dt>Email</dt><dd>' + esc(u.email) + '</dd>' +
              '<dt>Group</dt><dd>' + (u.group_name ? esc(u.group_name) : '<span class="muted">—</span>') + '</dd>' +
              '<dt>Phone</dt><dd>' + (u.phone ? esc(u.phone) : '<span class="muted">—</span>') + '</dd>' +
              '<dt>Address</dt><dd>' + ([u.address, [u.city, u.state].filter(Boolean).join(', '), u.zip].filter(Boolean).map(esc).join('<br>') || '<span class="muted">—</span>') + '</dd>' +
              '<dt>Added</dt><dd>' + esc(fmtDate(u.created_at)) + '</dd>' +
              '<dt>Last sign-in</dt><dd>' + (u.last_login_at ? esc(fmtDate(u.last_login_at, true)) : '<span class="muted">Never</span>') + '</dd>' +
              (can('admin') && u.notes ? '<dt>Notes</dt><dd style="white-space:pre-wrap">' + esc(u.notes) + '</dd>' : '') +
            '</dl></div>' +
            (manageable ? accessCard(u, isSelf) : '') +
          '</div>' +
          '<div class="card"><div class="card-head"><div><h2>Completed courses</h2><div class="muted small" id="m-count">' + completions.length + ' of ' + S.courses.length + ' complete</div></div>' +
            '<div class="row"><button class="btn sm" id="m-all">Select all</button><button class="btn sm" id="m-none">Clear all</button><button class="btn primary sm" id="m-save" disabled>Save changes</button></div></div>' +
            '<p class="muted small" style="margin:-4px 0 14px">Tick a course to record it as passed for ' + esc(u.first_name || u.name) + ' (for group sessions, use a course\'s Attendance tab to mark many people at once). Untick to remove a pass.</p>' +
            '<div class="matrix" id="matrix">' + coursesBySection().map(function (sec) {
              var n = sec.courses.filter(function (c) { return done[c.id]; }).length;
              return '<div class="sec"><div class="sec-h"><label class="check"><input type="checkbox" class="sec-all" data-sec="' + attr(sec.name) + '"' + (n === sec.courses.length ? ' checked' : '') + '> ' + esc(sec.name) + '</label><span class="cnt" data-sec-cnt="' + attr(sec.name) + '">' + n + ' / ' + sec.courses.length + '</span></div>' +
                sec.courses.map(function (c) {
                  var d = done[c.id];
                  return '<label class="m ' + (d ? 'done' : 'pending') + '" data-sec="' + attr(sec.name) + '"><input type="checkbox" class="cb m-cb" data-id="' + attr(c.id) + '"' + (d ? ' checked' : '') + '><span class="t">' + esc(c.title) + '</span>' +
                    '<span class="meta">' + (d ? esc(fmtDate(d.passed_at)) + ' · ' + esc(methodLabel(d.method)) + (d.score != null ? ' · ' + d.score + '/' + d.total : '') + (d.granted_by ? ' · by ' + esc(d.granted_by) : '') : '') + '</span></label>';
                }).join('') + '</div>';
            }).join('') + '</div></div>' +
        '</div>';
      var main = setMain(html);
      if ($('#p-edit', main)) $('#p-edit', main).addEventListener('click', function () { openUserForm(u); });
      if ($('#p-impersonate', main)) $('#p-impersonate', main).addEventListener('click', function () { impersonate(u); });
      bindAccessCard(main, u, isSelf);

      // Completion matrix
      var original = {}; Object.keys(done).forEach(function (k) { original[k] = true; });
      function current() { var o = {}; $$('.m-cb', main).forEach(function (cb) { if (cb.checked) o[cb.getAttribute('data-id')] = true; }); return o; }
      function refreshMatrix() {
        var cur = current(), changed = 0, total = 0;
        $$('.m-cb', main).forEach(function (cb) {
          var id = cb.getAttribute('data-id'), was = !!original[id], now = cb.checked;
          cb.closest('.m').classList.toggle('changed', was !== now);
          if (was !== now) changed++;
          if (now) total++;
        });
        $$('.sec-all', main).forEach(function (sa) {
          var sec = sa.getAttribute('data-sec');
          var cbs = $$('.m[data-sec="' + sec.replace(/"/g, '\\"') + '"] .m-cb', main);
          var n = cbs.filter(function (c) { return c.checked; }).length;
          sa.checked = n === cbs.length; sa.indeterminate = n > 0 && n < cbs.length;
          $('[data-sec-cnt="' + sec.replace(/"/g, '\\"') + '"]', main).textContent = n + ' / ' + cbs.length;
        });
        $('#m-count', main).textContent = total + ' of ' + S.courses.length + ' complete' + (changed ? ' · ' + changed + ' unsaved change' + (changed === 1 ? '' : 's') : '');
        $('#m-save', main).disabled = !changed;
        return cur;
      }
      $$('.m-cb', main).forEach(function (cb) { cb.addEventListener('change', refreshMatrix); });
      $$('.sec-all', main).forEach(function (sa) {
        sa.addEventListener('change', function () {
          var sec = sa.getAttribute('data-sec');
          $$('.m[data-sec="' + sec.replace(/"/g, '\\"') + '"] .m-cb', main).forEach(function (c) { c.checked = sa.checked; });
          refreshMatrix();
        });
      });
      $('#m-all', main).addEventListener('click', function () { $$('.m-cb', main).forEach(function (c) { c.checked = true; }); refreshMatrix(); });
      $('#m-none', main).addEventListener('click', function () { $$('.m-cb', main).forEach(function (c) { c.checked = false; }); refreshMatrix(); });
      $('#m-save', main).addEventListener('click', function () {
        var cur = current(), add = [], remove = [];
        S.courses.forEach(function (c) { if (cur[c.id] && !original[c.id]) add.push(c.id); if (!cur[c.id] && original[c.id]) remove.push(c.id); });
        var btn = $('#m-save', main); btn.disabled = true; btn.textContent = 'Saving…';
        var p = Promise.resolve();
        if (add.length) p = p.then(function () { return api('completions.php?action=set', { user_ids: [u.id], course_ids: add, passed: true }); });
        if (remove.length) p = p.then(function () { return api('completions.php?action=set', { user_ids: [u.id], course_ids: remove, passed: false }); });
        p.then(function () { toast('Completed courses updated.', 'ok'); route(); })
          .catch(function (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = 'Save changes'; });
      });
    });
  }
  function accessCard(u, isSelf) {
    var roles = assignableRoles();
    return '<div class="card"><div class="card-head"><h2>Access</h2></div>' +
      '<div class="stack">' +
        '<div><label class="f">Role</label><select class="input" id="a-role"' + (isSelf ? ' disabled' : '') + '>' + ROLES.map(function (r) {
          var allowed = roles.indexOf(r) >= 0;
          return '<option value="' + r + '"' + (u.role === r ? ' selected' : '') + (allowed ? '' : ' disabled') + '>' + ROLE_LABEL[r] + '</option>';
        }).join('') + '</select><div class="hint">' + (isSelf ? 'You cannot change your own role.' : esc(ROLE_HELP[u.role])) + '</div></div>' +
        '<div><label class="f">Password</label><div class="row wrap">' + accessBadge(u) +
          '<button class="btn sm" id="a-setpw">' + (u.has_password ? 'Set a new password' : 'Set a password') + '</button>' +
          (u.has_password && !isSelf ? '<button class="btn sm" id="a-clearpw">Remove password</button>' : '') +
        '</div><div class="hint">' + (u.has_password ? 'Removing the password lets them sign in with just their email and create a new one.' : 'They will create a password the first time they sign in with their email.') + '</div></div>' +
        (!isSelf ? '<div><label class="f">Account</label><div class="row wrap"><label class="check"><input type="checkbox" id="a-active"' + (u.active ? ' checked' : '') + '> Active (can sign in)</label><button class="btn danger sm" id="a-delete" style="margin-left:auto">Delete person</button></div></div>' : '') +
      '</div></div>';
  }
  function bindAccessCard(main, u, isSelf) {
    var roleSel = $('#a-role', main);
    if (!roleSel) return;
    roleSel.addEventListener('change', function () {
      var role = roleSel.value;
      var warn = role === 'superadmin' ? ' They will have full control, including the ability to remove your access.' : '';
      confirmDialog('Change role', 'Make <strong>' + esc(u.name) + '</strong> a <strong>' + esc(ROLE_LABEL[role]) + '</strong>?' + esc(warn), 'Change role', role === 'superadmin').then(function (yes) {
        if (!yes) { roleSel.value = u.role; return; }
        api('users.php?action=update', { id: u.id, role: role }).then(function () { toast('Role updated.', 'ok'); route(); }).catch(function (e) { toast(e.message, 'err'); roleSel.value = u.role; });
      });
    });
    $('#a-setpw', main).addEventListener('click', function () {
      var m = modal({ title: 'Set a password for ' + u.name, body:
        '<label class="f">New password</label><input class="input" id="sp-pw" type="text" autocomplete="new-password" placeholder="At least 8 characters"><div class="hint">Share it with them directly; it is not emailed.</div>' +
        '<label class="check mt"><input type="checkbox" id="sp-req" checked> Ask them to choose a new password at their next sign-in</label><div class="notice err hidden mt" id="sp-err"></div>',
        footer: '<button class="btn" data-close>Cancel</button><button class="btn primary" id="sp-ok">Save password</button>' });
      $('#sp-ok', m.el).addEventListener('click', function () {
        var pw = $('#sp-pw', m.el).value;
        if (pw.length < 8) { $('#sp-err', m.el).textContent = 'At least 8 characters.'; $('#sp-err', m.el).classList.remove('hidden'); return; }
        api('users.php?action=set_password', { id: u.id, password: pw, require_change: $('#sp-req', m.el).checked }).then(function () { m.close(); toast('Password set.', 'ok'); route(); })
          .catch(function (e) { $('#sp-err', m.el).textContent = e.message; $('#sp-err', m.el).classList.remove('hidden'); });
      });
    });
    if ($('#a-clearpw', main)) $('#a-clearpw', main).addEventListener('click', function () {
      confirmDialog('Remove password', 'Remove the password for <strong>' + esc(u.name) + '</strong>? They will sign in with just their email next time and create a new password.', 'Remove password').then(function (yes) {
        if (yes) api('users.php?action=set_password', { id: u.id, clear: true }).then(function () { toast('Password removed.', 'ok'); route(); }).catch(function (e) { toast(e.message, 'err'); });
      });
    });
    if ($('#a-active', main)) $('#a-active', main).addEventListener('change', function (e) {
      api('users.php?action=update', { id: u.id, active: e.target.checked }).then(function () { toast(e.target.checked ? 'Account activated.' : 'Account deactivated.', 'ok'); route(); }).catch(function (err) { toast(err.message, 'err'); e.target.checked = !e.target.checked; });
    });
    if ($('#a-delete', main)) $('#a-delete', main).addEventListener('click', function () {
      confirmDialog('Delete person', 'Permanently delete <strong>' + esc(u.name) + '</strong> (' + esc(u.email) + ') and all of their recorded progress? This cannot be undone.', 'Delete', true).then(function (yes) {
        if (yes) api('users.php?action=delete', { id: u.id }).then(function () { toast(u.name + ' deleted.', 'ok'); location.hash = '#/users'; }).catch(function (e) { toast(e.message, 'err'); });
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Courses list
  // ---------------------------------------------------------------------------
  function viewCourses() {
    return loadCourses(true).then(function () {
      var html = '<div class="page-head"><div><div class="eyebrow">Curriculum</div><h1>Courses</h1><p class="lede">' +
        (can('admin') ? 'Every block and module in the portal. Open a course to take attendance, edit its quiz, or replace its videos.' : 'Open a course to take attendance and mark who has passed.') + '</p></div></div>' +
        '<div class="card tight"><div class="table-wrap"><table><thead><tr><th>Course</th><th>Type</th><th>Videos</th><th>Quiz</th><th>Passed</th><th></th></tr></thead><tbody>' +
        coursesBySection().map(function (sec) {
          return '<tr class="section-row"><td colspan="6">' + esc(sec.name) + '</td></tr>' + sec.courses.map(function (c) {
            return '<tr class="click" data-href="#/courses/' + attr(c.id) + '">' +
              '<td><strong>' + esc(c.title) + '</strong><div class="sub mono">' + esc(c.id) + '</div></td>' +
              '<td>' + (c.type === 'video' ? '<span class="badge info">Video + quiz</span>' : '<span class="badge off">Interactive</span>') + '</td>' +
              '<td>' + c.video_count + (c.videos_replaced ? ' <span class="badge warn">' + c.videos_replaced + ' replaced</span>' : '') + '</td>' +
              '<td>' + c.question_count + ' questions' + (c.quiz_edited_at ? ' <span class="badge warn">edited</span>' : '') + '</td>' +
              '<td>' + progressBar(c.passed_count, S.totalUsers || 0) + '</td>' +
              '<td class="right nowrap"><a class="btn sm" href="#/courses/' + attr(c.id) + '">Attendance</a>' + (can('admin') ? ' <a class="btn sm ghost" href="#/courses/' + attr(c.id) + '/quiz">Edit</a>' : '') + '</td></tr>';
          }).join('');
        }).join('') + '</tbody></table></div></div>';
      bindRowLinks(setMain(html));
    });
  }

  // ---------------------------------------------------------------------------
  // Course detail: attendance / quiz / videos
  // ---------------------------------------------------------------------------
  function viewCourse(id, tab) {
    tab = tab || 'attendance';
    if (!can('admin') && tab !== 'attendance') tab = 'attendance';
    return Promise.all([api('courses.php?action=get&id=' + encodeURIComponent(id)), loadCourses()]).then(function (res) {
      var c = res[0].course;
      var html = '<div class="crumbs"><a href="#/courses">Courses</a> › ' + esc(c.section) + '</div>' +
        '<div class="page-head"><div><h1>' + esc(c.title) + '</h1><div class="row wrap" style="margin-top:6px">' +
          (c.type === 'video' ? '<span class="badge info">Video + quiz</span>' : '<span class="badge off">Interactive</span>') +
          '<span class="muted small">' + c.videos.length + ' video' + (c.videos.length === 1 ? '' : 's') + ' · ' + c.quiz.length + ' questions' + (c.quiz_edited ? ' (edited ' + esc(fmtDate(c.quiz_edited_at)) + ')' : '') + ' · <span class="mono">' + esc(c.id) + '</span></span></div></div></div>' +
        '<div class="tabs">' +
          '<button data-tab="attendance"' + (tab === 'attendance' ? ' class="active"' : '') + '>Attendance</button>' +
          (can('admin') ? '<button data-tab="quiz"' + (tab === 'quiz' ? ' class="active"' : '') + '>Quiz</button><button data-tab="videos"' + (tab === 'videos' ? ' class="active"' : '') + '>Videos</button>' : '') +
        '</div><div id="tab"></div>';
      var main = setMain(html);
      $$('.tabs button', main).forEach(function (b) { b.addEventListener('click', function () { location.hash = '#/courses/' + encodeURIComponent(c.id) + '/' + b.getAttribute('data-tab'); }); });
      if (tab === 'quiz') renderQuizTab(c, $('#tab', main));
      else if (tab === 'videos') renderVideosTab(c, $('#tab', main));
      else return renderAttendanceTab(c, $('#tab', main));
    });
  }

  // Attendance: pick people, mark them passed (or remove the pass).
  var attFilter = { q: '', group: null, status: '' };
  function renderAttendanceTab(c, box) {
    if (attFilter.group === null) attFilter.group = (S.me.role === 'trainer' && S.me.group_name) ? S.me.group_name : '';
    box.innerHTML = '<div class="loading"><span class="spin"></span></div>';
    return Promise.all([loadUsers({}), api('completions.php?action=for_course&course_id=' + encodeURIComponent(c.id))]).then(function (res) {
      var users = res[0], comps = {}; res[1].completions.forEach(function (x) { comps[x.user_id] = x; });
      var selected = {};
      function filtered() {
        var q = attFilter.q.toLowerCase();
        return users.filter(function (u) {
          if (attFilter.group && u.group_name !== attFilter.group) return false;
          if (attFilter.status === 'passed' && !comps[u.id]) return false;
          if (attFilter.status === 'open' && comps[u.id]) return false;
          if (q && (u.name + ' ' + u.email + ' ' + u.group_name).toLowerCase().indexOf(q) < 0) return false;
          return true;
        });
      }
      box.innerHTML =
        '<div class="card tight">' +
          '<div class="toolbar" style="padding:14px 16px 0;margin:0">' +
            '<div class="search">' + ICONS.search + '<input class="input" id="at-q" placeholder="Search people" value="' + attr(attFilter.q) + '"></div>' +
            '<select class="input" id="at-group">' + groupOptions(attFilter.group, true) + '</select>' +
            '<div class="pill-group" id="at-status"><button data-v=""' + (attFilter.status === '' ? ' class="active"' : '') + '>Everyone</button><button data-v="open"' + (attFilter.status === 'open' ? ' class="active"' : '') + '>Not yet passed</button><button data-v="passed"' + (attFilter.status === 'passed' ? ' class="active"' : '') + '>Passed</button></div>' +
          '</div>' +
          '<div class="table-wrap" style="margin-top:12px;max-height:60vh;overflow:auto" id="at-table"></div>' +
          '<div class="m-f" style="border-radius:0 0 16px 16px;position:sticky;bottom:0">' +
            '<div class="left row wrap"><strong id="at-sel">0 selected</strong><input class="input sm" id="at-note" placeholder="Optional note, e.g. “Group session Sept 16”" style="width:260px"></div>' +
            '<button class="btn danger" id="at-unmark" disabled>Remove pass</button><button class="btn primary" id="at-mark" disabled>Mark as passed</button>' +
          '</div>' +
        '</div>';
      function renderTable() {
        var list = filtered();
        var allSel = list.length > 0 && list.every(function (u) { return selected[u.id]; });
        $('#at-table', box).innerHTML = list.length ? '<table><thead><tr><th style="width:36px"><input type="checkbox" class="cb" id="at-all"' + (allSel ? ' checked' : '') + ' title="Select everyone shown"></th><th>Name</th><th>Group</th><th>Status</th></tr></thead><tbody>' +
          list.map(function (u) {
            var d = comps[u.id];
            return '<tr class="click' + (selected[u.id] ? ' selected' : '') + '" data-uid="' + u.id + '"><td><input type="checkbox" class="cb at-cb" data-uid="' + u.id + '"' + (selected[u.id] ? ' checked' : '') + '></td>' +
              '<td><div class="row"><span class="avatar">' + esc(initials(u.name)) + '</span><div><div><strong>' + esc(u.name) + '</strong> ' + (u.role !== 'student' ? roleBadge(u.role) : '') + '</div><div class="sub">' + esc(u.email) + '</div></div></div></td>' +
              '<td>' + esc(u.group_name || '—') + '</td>' +
              '<td>' + (d ? '<span class="badge ok">Passed</span> <span class="muted small">' + esc(fmtDate(d.passed_at)) + ' · ' + esc(methodLabel(d.method)) + (d.score != null ? ' · ' + d.score + '/' + d.total : '') + (d.granted_by ? ' · by ' + esc(d.granted_by) : '') + (d.note ? ' · “' + esc(d.note) + '”' : '') + '</span>' : '<span class="badge off">Not yet</span>') + '</td></tr>';
          }).join('') + '</tbody></table>' : '<div class="empty"><strong>Nobody matches.</strong>Change the group or search.</div>';
        $$('tr[data-uid]', box).forEach(function (tr) {
          tr.addEventListener('click', function (e) {
            if (e.target.tagName === 'INPUT') return;
            var id = Number(tr.getAttribute('data-uid')); selected[id] = !selected[id]; renderTable();
          });
        });
        $$('.at-cb', box).forEach(function (cb) { cb.addEventListener('change', function () { selected[Number(cb.getAttribute('data-uid'))] = cb.checked; renderTable(); }); });
        var all = $('#at-all', box);
        if (all) all.addEventListener('change', function () { list.forEach(function (u) { selected[u.id] = all.checked; }); renderTable(); });
        var n = Object.keys(selected).filter(function (k) { return selected[k]; }).length;
        $('#at-sel', box).textContent = n + ' selected';
        $('#at-mark', box).disabled = n === 0; $('#at-unmark', box).disabled = n === 0;
      }
      renderTable();
      $('#at-q', box).addEventListener('input', function (e) { attFilter.q = e.target.value; renderTable(); });
      $('#at-group', box).addEventListener('change', function (e) { attFilter.group = e.target.value; renderTable(); });
      $$('#at-status button', box).forEach(function (b) { b.addEventListener('click', function () { attFilter.status = b.getAttribute('data-v'); $$('#at-status button', box).forEach(function (x) { x.classList.toggle('active', x === b); }); renderTable(); }); });
      function apply(passed) {
        var ids = Object.keys(selected).filter(function (k) { return selected[k]; }).map(Number);
        if (!ids.length) return;
        var verb = passed ? 'Mark' : 'Remove the pass for';
        confirmDialog(passed ? 'Mark as passed' : 'Remove pass', verb + ' <strong>' + ids.length + ' ' + (ids.length === 1 ? 'person' : 'people') + '</strong> ' + (passed ? 'as having passed' : 'on') + ' <strong>' + esc(c.title) + '</strong>?', passed ? 'Mark passed' : 'Remove pass', !passed).then(function (yes) {
          if (!yes) return;
          api('completions.php?action=set', { user_ids: ids, course_ids: [c.id], passed: passed, note: $('#at-note', box).value.trim() }).then(function (d) {
            toast((passed ? 'Marked ' : 'Removed ') + d.changed + ' record' + (d.changed === 1 ? '' : 's') + '.', 'ok');
            selected = {}; S.courses = null;
            renderAttendanceTab(c, box);
          }).catch(function (e) { toast(e.message, 'err'); });
        });
      }
      $('#at-mark', box).addEventListener('click', function () { apply(true); });
      $('#at-unmark', box).addEventListener('click', function () { apply(false); });
    });
  }

  // Quiz editor
  function renderQuizTab(c, box) {
    var quiz = JSON.parse(JSON.stringify(c.quiz));
    var steps = c.steps && c.steps.length ? c.steps : [];
    var dirty = false;
    function stepLabel(i) { return steps[i] ? (i + 1) + '. ' + steps[i] : 'Section ' + (i + 1); }
    function render() {
      box.innerHTML =
        '<div class="row between wrap mb">' +
          '<div class="notice ' + (c.quiz_edited ? 'warn' : 'info') + '" style="flex:1 1 320px">' + (c.quiz_edited ? '<strong>This quiz has been edited.</strong> The portal shows your version instead of the original. ' : 'Edit the questions and answers people see at the end of this module. ') + 'Each question has one correct answer; the “section” tells the portal which part to rewatch when someone misses it.</div>' +
          '<div class="row"><button class="btn" id="q-reset"' + (c.quiz_edited ? '' : ' disabled') + '>Reset to original</button><button class="btn primary" id="q-save" disabled>Save quiz</button></div>' +
        '</div>' +
        '<div id="q-unsaved" class="unsaved hidden mb">You have unsaved changes.</div>' +
        '<div id="q-list">' + quiz.map(renderQ).join('') + '</div>' +
        '<div class="row"><button class="btn" id="q-add">+ Add a question</button><span class="muted small">' + quiz.length + ' question' + (quiz.length === 1 ? '' : 's') + '</span></div>' +
        '<div class="notice err hidden mt" id="q-err"></div>';
      bind();
    }
    function renderQ(q, i) {
      return '<div class="q" data-i="' + i + '"><div class="q-h"><span class="num">' + (i + 1) + '</span>' +
        '<select class="input sm q-section" style="width:auto;max-width:260px" title="Which section this question belongs to">' + (steps.length ? steps.map(function (_, si) { return '<option value="' + si + '"' + (q.section === si ? ' selected' : '') + '>' + esc(stepLabel(si)) + '</option>'; }).join('') : [0, 1, 2, 3, 4, 5, 6, 7].map(function (si) { return '<option value="' + si + '"' + (q.section === si ? ' selected' : '') + '>Section ' + (si + 1) + '</option>'; }).join('')) + '</select>' +
        '<span class="grow"></span><button class="btn icon xs q-up" title="Move up"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="btn icon xs q-down" title="Move down"' + (i === quiz.length - 1 ? ' disabled' : '') + '>↓</button><button class="btn icon xs q-del" title="Delete question">✕</button></div>' +
        '<input class="input q-text" placeholder="Question" value="' + attr(q.text) + '">' +
        '<div class="q-opts">' + q.options.map(function (o, oi) {
          return '<div class="opt' + (q.correct === oi ? ' correct' : '') + '"><input type="radio" name="correct-' + i + '" value="' + oi + '"' + (q.correct === oi ? ' checked' : '') + ' title="Correct answer"><input class="input sm q-opt" data-oi="' + oi + '" value="' + attr(o) + '" placeholder="Answer option ' + (oi + 1) + '"><button class="btn icon xs q-opt-del" data-oi="' + oi + '" title="Remove option"' + (q.options.length <= 2 ? ' disabled' : '') + '>✕</button></div>';
        }).join('') + '</div>' +
        '<div class="row mt" style="gap:12px;align-items:flex-start"><button class="btn xs q-opt-add"' + (q.options.length >= 6 ? ' disabled' : '') + '>+ Add option</button><span class="muted small">Select the radio next to the correct answer.</span></div>' +
        '<label class="f mt">Why (shown after answering)</label><textarea class="input q-why" style="min-height:52px" placeholder="Short explanation of the right answer">' + esc(q.why) + '</textarea></div>';
    }
    function markDirty() { dirty = true; $('#q-save', box).disabled = false; $('#q-unsaved', box).classList.remove('hidden'); }
    function bind() {
      $$('.q', box).forEach(function (card) {
        var i = Number(card.getAttribute('data-i')), q = quiz[i];
        $('.q-text', card).addEventListener('input', function (e) { q.text = e.target.value; markDirty(); });
        $('.q-why', card).addEventListener('input', function (e) { q.why = e.target.value; markDirty(); });
        $('.q-section', card).addEventListener('change', function (e) { q.section = Number(e.target.value); markDirty(); });
        $$('.q-opt', card).forEach(function (inp) { inp.addEventListener('input', function (e) { q.options[Number(inp.getAttribute('data-oi'))] = e.target.value; markDirty(); }); });
        $$('input[type=radio]', card).forEach(function (r) { r.addEventListener('change', function () { q.correct = Number(r.value); $$('.opt', card).forEach(function (o, oi) { o.classList.toggle('correct', oi === q.correct); }); markDirty(); }); });
        $$('.q-opt-del', card).forEach(function (b) { b.addEventListener('click', function () { var oi = Number(b.getAttribute('data-oi')); q.options.splice(oi, 1); if (q.correct >= q.options.length) q.correct = q.options.length - 1; else if (q.correct > oi) q.correct--; markDirty(); render(); }); });
        $('.q-opt-add', card).addEventListener('click', function () { q.options.push(''); markDirty(); render(); $$('.q-opt', $$('.q', box)[i]).pop().focus(); });
        $('.q-up', card).addEventListener('click', function () { quiz.splice(i - 1, 0, quiz.splice(i, 1)[0]); markDirty(); render(); });
        $('.q-down', card).addEventListener('click', function () { quiz.splice(i + 1, 0, quiz.splice(i, 1)[0]); markDirty(); render(); });
        $('.q-del', card).addEventListener('click', function () { quiz.splice(i, 1); markDirty(); render(); });
      });
      $('#q-add', box).addEventListener('click', function () { quiz.push({ section: 0, text: '', options: ['', '', '', ''], correct: 0, why: '' }); markDirty(); render(); var cards = $$('.q', box); cards[cards.length - 1].scrollIntoView({ behavior: 'smooth', block: 'center' }); $('.q-text', cards[cards.length - 1]).focus(); });
      $('#q-save', box).addEventListener('click', function () {
        var err = $('#q-err', box); err.classList.add('hidden');
        for (var i = 0; i < quiz.length; i++) {
          var q = quiz[i], opts = q.options.map(function (o) { return o.trim(); });
          if (!q.text.trim()) return showErr('Question ' + (i + 1) + ' needs text.');
          if (opts.filter(Boolean).length < 2) return showErr('Question ' + (i + 1) + ' needs at least two answer options.');
          if (opts.some(function (o) { return !o; })) return showErr('Question ' + (i + 1) + ' has an empty answer option — fill it in or remove it.');
          if (!(q.correct >= 0 && q.correct < opts.length)) return showErr('Question ' + (i + 1) + ' needs a correct answer selected.');
        }
        if (!quiz.length) return showErr('Add at least one question.');
        var btn = $('#q-save', box); btn.disabled = true; btn.textContent = 'Saving…';
        api('courses.php?action=save_quiz', { id: c.id, quiz: quiz }).then(function (d) {
          toast('Quiz saved. The portal now uses your version.', 'ok'); c.quiz = d.quiz; c.quiz_edited = true; c.quiz_edited_at = new Date().toISOString(); quiz = JSON.parse(JSON.stringify(d.quiz)); dirty = false; S.courses = null; render();
        }).catch(function (e) { btn.disabled = false; btn.textContent = 'Save quiz'; showErr(e.message); });
        function showErr(t) { err.textContent = t; err.classList.remove('hidden'); err.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      });
      $('#q-reset', box).addEventListener('click', function () {
        confirmDialog('Reset quiz', 'Discard your edited version and go back to the original questions for <strong>' + esc(c.title) + '</strong>?', 'Reset to original', true).then(function (yes) {
          if (!yes) return;
          api('courses.php?action=reset_quiz', { id: c.id }).then(function (d) { toast('Original quiz restored.', 'ok'); c.quiz = d.quiz; c.quiz_edited = false; quiz = JSON.parse(JSON.stringify(d.quiz)); dirty = false; S.courses = null; render(); }).catch(function (e) { toast(e.message, 'err'); });
        });
      });
    }
    render();
    window.onbeforeunload = function () { return dirty ? 'You have unsaved quiz changes.' : undefined; };
  }

  // Video slots with chunked replacement upload
  function renderVideosTab(c, box) {
    if (!c.videos.length) { box.innerHTML = '<div class="card"><div class="empty"><strong>This module has no video slots.</strong>It is built from interactive screens rather than video, so there is nothing to replace here. You can still edit its quiz.</div></div>'; return; }
    box.innerHTML = '<div class="notice info mb">Each slot below is a video the portal plays in this module, in order of appearance. Replace one and the portal serves your file instead — the original stays on the server so you can revert. Large files are uploaded in pieces, so this works even on hosts with small upload limits.</div>' +
      '<div class="card">' + c.videos.map(function (v, i) {
        var replaced = !!v.override;
        return '<div class="vslot" data-i="' + i + '">' +
          '<video controls preload="metadata" src="../' + attr(v.current) + '"></video>' +
          '<div><div class="row wrap"><span class="name">Video ' + (i + 1) + ' · ' + esc(fileName(v.src)) + '</span>' + (replaced ? '<span class="badge warn">Replaced</span>' : '<span class="badge off">Original</span>') + '</div>' +
            (replaced ? '<div class="small muted" style="margin-top:4px">Now playing <strong>' + esc(v.override.original_name) + '</strong> (' + fmtBytes(v.override.size) + ') · uploaded ' + esc(fmtDate(v.override.uploaded_at)) + (v.override.uploaded_by ? ' by ' + esc(v.override.uploaded_by) : '') + '</div>' : '') +
            (v.shared_with.length ? '<div class="small muted" style="margin-top:4px">Also used in: ' + v.shared_with.map(function (id) { var o = courseById(id); return esc(o ? o.title : id); }).join(', ') + ' — replacing it changes those too.</div>' : '') +
            '<div class="upl row wrap"><input type="file" class="v-file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.m4v,.mov" style="display:none"><button class="btn sm blue v-pick">Replace video…</button>' + (replaced ? '<button class="btn sm v-revert">Revert to original</button>' : '') + '<span class="small muted v-status"></span></div>' +
            '<div class="progress-bar hidden"><div></div></div>' +
          '</div></div>';
      }).join('') + '</div>';
    $$('.vslot', box).forEach(function (slot) {
      var i = Number(slot.getAttribute('data-i')), v = c.videos[i];
      var file = $('.v-file', slot), status = $('.v-status', slot), bar = $('.progress-bar', slot);
      $('.v-pick', slot).addEventListener('click', function () { file.click(); });
      file.addEventListener('change', function () { if (file.files[0]) upload(file.files[0]); });
      if ($('.v-revert', slot)) $('.v-revert', slot).addEventListener('click', function () {
        confirmDialog('Revert video', 'Go back to the original video for this slot? Your uploaded file will be deleted.', 'Revert', true).then(function (yes) {
          if (yes) api('courses.php?action=revert_video', { original: v.src }).then(function () { toast('Original video restored.', 'ok'); S.courses = null; route(); }).catch(function (e) { toast(e.message, 'err'); });
        });
      });
      function upload(f) {
        $$('button', slot).forEach(function (b) { b.disabled = true; });
        bar.classList.remove('hidden'); $('div', bar).style.width = '0%';
        status.textContent = 'Starting upload of ' + f.name + ' (' + fmtBytes(f.size) + ')…';
        api('upload.php?action=start', { filename: f.name, size: f.size, course_id: c.id, original: v.src }).then(function (st) {
          var chunk = st.chunk_size, total = Math.ceil(f.size / chunk), idx = 0;
          function next() {
            if (idx >= total) return finish();
            var blob = f.slice(idx * chunk, Math.min(f.size, (idx + 1) * chunk));
            return fetch(API + 'upload.php?action=chunk&upload_id=' + encodeURIComponent(st.upload_id) + '&index=' + idx, {
              method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': S.csrf }, body: blob,
            }).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || 'Upload failed'); return d; }); })
              .then(function () { idx++; $('div', bar).style.width = Math.round(100 * idx / total) + '%'; status.textContent = 'Uploading… ' + Math.round(100 * idx / total) + '%'; return next(); });
          }
          function finish() {
            status.textContent = 'Finishing…';
            return api('upload.php?action=finish', { upload_id: st.upload_id }).then(function () { toast('Video replaced.', 'ok'); S.courses = null; route(); });
          }
          return next();
        }).catch(function (e) {
          status.textContent = ''; bar.classList.add('hidden'); $$('button', slot).forEach(function (b) { b.disabled = false; }); file.value = '';
          toast(e.message, 'err');
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Settings (super admin) & My account
  // ---------------------------------------------------------------------------
  function viewSettings() {
    return Promise.all([api('settings.php?action=get'), api('auth.php?action=health')]).then(function (res) {
      var s = res[0].settings, h = res[1];
      var main = setMain('<div class="page-head"><div><div class="eyebrow">Super admin</div><h1>Settings</h1><p class="lede">Site-wide options. Only super admins can change these.</p></div></div>' +
        '<div class="grid2">' +
          '<div class="card"><div class="card-head"><h2>Certification</h2></div>' +
            '<label class="f">Pass mark (% of questions correct)</label><input class="input" id="s-threshold" type="number" min="50" max="100" step="5" value="' + attr(s.pass_threshold) + '" style="max-width:140px"><div class="hint">Applies to every quiz. 100 means every question must be right.</div>' +
            '<label class="f mt">Portal title</label><input class="input" id="s-title" value="' + attr(s.portal_title) + '">' +
            '<div class="row mt"><button class="btn primary" id="s-save">Save settings</button></div></div>' +
          '<div class="card"><div class="card-head"><h2>Host check</h2></div><dl class="kv">' +
            '<dt>PHP</dt><dd>' + esc(h.php) + '</dd><dt>SQLite</dt><dd>' + (h.sqlite ? '<span class="badge ok">Available</span>' : '<span class="badge danger">Missing</span>') + '</dd>' +
            '<dt>Database</dt><dd>' + (h.database ? '<span class="badge ok">OK</span>' : '<span class="badge danger">Error</span>') + '</dd>' +
            '<dt>data/ writable</dt><dd>' + (h.data_writable ? '<span class="badge ok">Yes</span>' : '<span class="badge danger">No</span>') + '</dd>' +
            '<dt>uploads/ writable</dt><dd>' + (h.uploads_writable ? '<span class="badge ok">Yes</span>' : '<span class="badge warn">No — video replacement will fail</span>') + '</dd>' +
            '<dt>Course manifest</dt><dd>' + (h.manifest ? '<span class="badge ok">Found</span>' : '<span class="badge danger">Missing</span>') + '</dd>' +
          '</dl><p class="hint mt">Roles: super admins are set per person under People → Access. Only super admins can grant or remove super admin.</p></div>' +
        '</div>');
      $('#s-save', main).addEventListener('click', function () {
        api('settings.php?action=save', { pass_threshold: Number($('#s-threshold', main).value), portal_title: $('#s-title', main).value }).then(function () { toast('Settings saved.', 'ok'); }).catch(function (e) { toast(e.message, 'err'); });
      });
    });
  }
  function viewAccount() {
    var me = S.me;
    var main = setMain('<div class="page-head"><div><div class="eyebrow">You</div><h1>My account</h1></div></div>' +
      '<div class="grid2">' +
        '<div class="card"><div class="card-head"><h2>Profile</h2></div><dl class="kv"><dt>Name</dt><dd>' + esc(me.name) + '</dd><dt>Email</dt><dd>' + esc(me.email) + '</dd><dt>Group</dt><dd>' + esc(me.group_name || '—') + '</dd><dt>Role</dt><dd>' + roleBadge(me.role) + '</dd></dl><p class="hint mt">' + esc(ROLE_HELP[me.role]) + '</p></div>' +
        '<div class="card"><div class="card-head"><h2>Change password</h2></div>' +
          '<label class="f">Current password</label><input class="input" id="pw-cur" type="password" autocomplete="current-password">' +
          '<label class="f mt">New password</label><input class="input" id="pw-new" type="password" autocomplete="new-password"><div class="hint">At least 8 characters.</div>' +
          '<label class="f mt">Confirm new password</label><input class="input" id="pw-cf" type="password" autocomplete="new-password">' +
          '<div class="notice err hidden mt" id="pw-err"></div><div class="row mt"><button class="btn primary" id="pw-save">Update password</button></div></div>' +
      '</div>');
    $('#pw-save', main).addEventListener('click', function () {
      var cur = $('#pw-cur', main).value, nw = $('#pw-new', main).value, cf = $('#pw-cf', main).value, err = $('#pw-err', main);
      err.classList.add('hidden');
      if (nw.length < 8) { err.textContent = 'At least 8 characters.'; err.classList.remove('hidden'); return; }
      if (nw !== cf) { err.textContent = 'The two passwords do not match.'; err.classList.remove('hidden'); return; }
      api('auth.php?action=change_password', { current_password: cur, new_password: nw }).then(function () { toast('Password updated.', 'ok'); $('#pw-cur', main).value = ''; $('#pw-new', main).value = ''; $('#pw-cf', main).value = ''; })
        .catch(function (e) { err.textContent = e.message; err.classList.remove('hidden'); });
    });
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  api('auth.php?action=me').then(function (d) {
    S.me = d.user; S.csrf = d.csrf; S.impersonating = d.impersonating || null; S.canImpersonate = !!d.can_impersonate;
    if (S.me.must_change_password && !S.impersonating) { location.replace('../login.html?mode=change&next=' + encodeURIComponent('admin/')); return; }
    if (!can('trainer')) { location.replace('../index.html'); return; }
    renderShell();
    window.addEventListener('hashchange', function () { window.onbeforeunload = null; route(); });
    route();
  }).catch(function (e) {
    if (e.message !== 'Signed out') $('#app').innerHTML = '<div class="card" style="max-width:520px;margin:80px auto"><div class="notice err">' + esc(e.message) + '</div><p class="mt"><a href="../login.html">Sign in</a></p></div>';
  });
})();
