/* 乔不不斯官网双主题控制器：默认暗色，全站共享 dark / light */
(function () {
  'use strict';

  var STORAGE_KEY = 'qiaoboosi-theme';
  var root = document.documentElement;

  function isTheme(value) {
    return value === 'dark' || value === 'light';
  }

  function readUrlTheme() {
    try {
      var value = new URL(window.location.href).searchParams.get('theme');
      return isTheme(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function readStoredTheme() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return isTheme(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function defaultTheme() {
    return 'dark';
  }

  function themeButtonMarkup() {
    return '<span class="theme-toggle__track" aria-hidden="true"></span>' +
      '<span class="theme-toggle__label" data-theme-label>DARK</span>';
  }

  function createThemeButton(extraClass) {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle' + (extraClass ? ' ' + extraClass : '');
    button.setAttribute('data-theme-toggle', '');
    button.innerHTML = themeButtonMarkup();
    return button;
  }

  function ensureThemeControl() {
    if (document.querySelector('[data-theme-toggle]')) return;

    var navInner = document.querySelector('.site-nav .nav-inner');
    if (navInner) {
      var menuButton = navInner.querySelector('.nav-toggle');
      var actions = navInner.querySelector('.nav-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'nav-actions';
        if (menuButton) {
          navInner.insertBefore(actions, menuButton);
          actions.appendChild(menuButton);
        } else {
          navInner.appendChild(actions);
        }
      }
      actions.insertBefore(createThemeButton('theme-toggle--nav'), actions.firstChild);
      return;
    }

    document.body.appendChild(createThemeButton('global-theme-fab'));
  }

  function syncControls(theme) {
    var isLight = theme === 'light';

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(isLight));
      button.setAttribute('aria-label', isLight ? '切换到暗色模式' : '切换到亮色模式');
      button.setAttribute('title', isLight ? '切换到暗色模式' : '切换到亮色模式');

      var label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = isLight ? 'LIGHT' : 'DARK';
    });
  }

  function syncThemeColor(theme) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = theme === 'light' ? '#EEF2F0' : '#0B0D0F';
  }

  function syncLocalLinks(theme) {
    if (window.location.protocol !== 'file:') return;

    document.querySelectorAll('a[href]').forEach(function (link) {
      var raw = link.getAttribute('href');
      if (!raw || raw.charAt(0) === '#' || /^(?:https?:|mailto:|tel:|javascript:)/i.test(raw)) return;

      try {
        var target = new URL(raw, window.location.href);
        if (target.protocol !== 'file:' || !/\.html$/i.test(target.pathname)) return;
        target.searchParams.set('theme', theme);
        link.href = target.href;
      } catch (error) {}
    });
  }

  function syncLocalAddress(theme) {
    if (window.location.protocol !== 'file:' || !window.history.replaceState) return;
    try {
      var current = new URL(window.location.href);
      current.searchParams.set('theme', theme);
      window.history.replaceState(null, '', current.href);
    } catch (error) {}
  }

  function apply(theme, persist, source) {
    var next = isTheme(theme) ? theme : defaultTheme();
    root.dataset.theme = next;
    root.style.colorScheme = next;

    if (persist) {
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch (error) {}
    }

    syncThemeColor(next);
    if (document.body) {
      syncControls(next);
      syncLocalLinks(next);
      if (persist) syncLocalAddress(next);
    }

    window.dispatchEvent(new CustomEvent('qiaoboosi:themechange', {
      detail: { theme: next, source: source || (persist ? 'user' : 'system') }
    }));
    return next;
  }

  function toggle() {
    return apply(root.dataset.theme === 'light' ? 'dark' : 'light', true, 'user');
  }

  function reset() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    return apply(defaultTheme(), false, 'default');
  }

  var urlTheme = readUrlTheme();
  apply(urlTheme || readStoredTheme() || defaultTheme(), Boolean(urlTheme), urlTheme ? 'link' : 'initial');

  function mount() {
    ensureThemeControl();
    syncControls(root.dataset.theme);
    syncLocalLinks(root.dataset.theme);

    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      if (button.dataset.themeReady === 'true') return;
      button.dataset.themeReady = 'true';
      button.addEventListener('click', toggle);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY || !isTheme(event.newValue)) return;
    apply(event.newValue, false, 'storage');
  });

  window.QiaoboosiTheme = {
    get: function () { return root.dataset.theme; },
    set: function (theme) { return apply(theme, true, 'api'); },
    toggle: toggle,
    reset: reset
  };
})();
