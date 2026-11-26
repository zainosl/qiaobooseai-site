/* 乔不不斯双主题控制器：dark / light / system */
(function () {
  'use strict';

  var STORAGE_KEY = 'qiaoboosi-theme';
  var root = document.documentElement;
  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function isTheme(value) {
    return value === 'dark' || value === 'light';
  }

  function readStoredTheme() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return isTheme(value) ? value : null;
    } catch (error) {
      return null;
    }
  }

  function systemTheme() {
    return media.matches ? 'dark' : 'light';
  }

  function resolvedTheme() {
    return readStoredTheme() || systemTheme();
  }

  function syncControls(theme) {
    var isLight = theme === 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(isLight));
      button.setAttribute('aria-label', isLight ? '切换到暗色模式' : '切换到亮色模式');
      var label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = isLight ? '切换暗色' : '切换亮色';
    });
  }

  function apply(theme, persist) {
    var next = isTheme(theme) ? theme : systemTheme();
    root.dataset.theme = next;
    root.style.colorScheme = next;

    if (persist) {
      try { window.localStorage.setItem(STORAGE_KEY, next); } catch (error) {}
    }

    if (document.body) syncControls(next);
    window.dispatchEvent(new CustomEvent('qiaoboosi:themechange', {
      detail: { theme: next, source: persist ? 'user' : 'system' }
    }));
    return next;
  }

  function toggle() {
    return apply(root.dataset.theme === 'light' ? 'dark' : 'light', true);
  }

  function reset() {
    try { window.localStorage.removeItem(STORAGE_KEY); } catch (error) {}
    return apply(systemTheme(), false);
  }

  /* Apply synchronously when this script is loaded in <head>, preventing a theme flash. */
  apply(resolvedTheme(), false);

  function mount() {
    syncControls(root.dataset.theme);
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

  media.addEventListener('change', function () {
    if (!readStoredTheme()) apply(systemTheme(), false);
  });

  window.QiaoboosiTheme = {
    get: function () { return root.dataset.theme; },
    set: function (theme) { return apply(theme, true); },
    toggle: toggle,
    reset: reset
  };
})();
