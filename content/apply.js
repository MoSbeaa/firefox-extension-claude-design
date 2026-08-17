/*
 * Content script: keeps a single <style> element in sync with the saved
 * settings, and keeps it wedged at the end of <head> so it outranks the
 * site's own stylesheets on specificity ties.
 */
(function () {
  'use strict';

  var api = typeof browser !== 'undefined' ? browser : chrome;
  var KEY = window.ClaudeSkin.STORAGE_KEY;
  var STYLE_ID = 'claude-skin-tweaks';
  var ROOT_CLASS = 'cst-on';

  var styleEl = null;
  var currentCss = '';
  var observedHead = null;

  function ensureStyle() {
    if (styleEl && styleEl.isConnected) return styleEl;

    styleEl = document.getElementById(STYLE_ID);
    if (styleEl) return styleEl;

    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = currentCss;
    (document.head || document.documentElement).appendChild(styleEl);
    return styleEl;
  }

  function render(settings) {
    currentCss = window.ClaudeSkin.buildCss(settings);
    // Called this early only when the document has no root element yet;
    // boot() re-applies whatever we computed as soon as one exists.
    if (!document.documentElement) return;

    var el = ensureStyle();
    if (el.textContent !== currentCss) el.textContent = currentCss;
    document.documentElement.classList.toggle(ROOT_CLASS, !!currentCss);
  }

  function load() {
    function done(data) {
      render(data && data[KEY]);
    }
    // Firefox's storage API returns a promise; Chrome's older builds only
    // accept a callback and throw when it is missing.
    var stored;
    try {
      stored = api.storage.local.get(KEY);
    } catch (error) {
      api.storage.local.get(KEY, done);
      return;
    }
    if (stored && typeof stored.then === 'function') stored.then(done);
    else api.storage.local.get(KEY, done);
  }

  api.storage.onChanged.addListener(function (changes, area) {
    if (area !== 'local') return;
    if (changes[KEY]) render(changes[KEY].newValue);
  });

  // The app rewrites <head> as it hydrates and on client-side navigation,
  // which can drop our node or push another stylesheet after it. Watch only
  // <head> and <html> directly — a subtree observer would fire on every
  // streamed token.
  var headObserver = new MutationObserver(reinstate);
  var rootObserver = new MutationObserver(reinstate);

  function reinstate() {
    if (!document.documentElement) return;

    if (!styleEl || !styleEl.isConnected) {
      styleEl = null;
      ensureStyle();
      styleEl.textContent = currentCss;
    } else if (document.head && (styleEl.parentNode !== document.head || document.head.lastElementChild !== styleEl)) {
      document.head.appendChild(styleEl);
    }

    document.documentElement.classList.toggle(ROOT_CLASS, !!currentCss);

    if (document.head && observedHead !== document.head) {
      observedHead = document.head;
      headObserver.disconnect();
      headObserver.observe(document.head, { childList: true });
    }
  }

  function boot() {
    if (!document.documentElement) return false;
    rootObserver.observe(document.documentElement, { childList: true });
    load();
    reinstate();
    document.addEventListener('DOMContentLoaded', reinstate, { once: true });
    return true;
  }

  if (!boot()) {
    // Injected before the parser produced <html> — wait for it.
    var docObserver = new MutationObserver(function () {
      if (boot()) docObserver.disconnect();
    });
    docObserver.observe(document, { childList: true });
  }
})();
