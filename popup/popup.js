/*
 * Popup logic. The popup owns no styling state of its own: it edits a plain
 * settings object, writes it to storage.local, and the content script reacts.
 */
(function () {
  'use strict';

  var api = typeof browser !== 'undefined' ? browser : chrome;
  var S = window.ClaudeSkin;
  var KEY = S.STORAGE_KEY;

  var state = S.clone(S.DEFAULTS);
  var saveTimer = null;
  var statusTimer = null;

  // Placeholder swatches shown when an optional colour is left on "Auto".
  var COLOR_FALLBACKS = {
    surfaceColor: '#1f1e24',
    textColor: '#e8e6e1',
    accentColor: '#c96442'
  };

  var els = {
    status: document.getElementById('status'),
    generated: document.getElementById('generated'),
    settingsJson: document.getElementById('settingsJson'),
    imageFile: document.getElementById('imageFile'),
    imageHint: document.getElementById('imageHint'),
    siteStatus: document.getElementById('siteStatus')
  };

  function inputs() {
    return Array.prototype.slice.call(document.querySelectorAll('[data-setting]'));
  }

  // ------------------------------------------------------------ storage
  // Firefox's storage API returns promises, Chrome's older builds only take
  // callbacks — support both without assuming which one we got.
  function promisify(method, arg) {
    return new Promise(function (resolve, reject) {
      var maybePromise;
      try {
        maybePromise = api.storage.local[method](arg);
      } catch (error) {
        api.storage.local[method](arg, resolve);
        return;
      }
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve, reject);
      } else {
        api.storage.local[method](arg, resolve);
      }
    });
  }

  function storageGet() {
    return promisify('get', KEY);
  }

  function storageSet(value) {
    var payload = {};
    payload[KEY] = value;
    return promisify('set', payload);
  }

  function flash(message, isError) {
    els.status.textContent = message;
    els.status.classList.toggle('is-error', !!isError);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(function () {
      els.status.textContent = '';
      els.status.classList.remove('is-error');
    }, 2200);
  }

  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      storageSet(state).then(
        function () {
          flash('Saved');
        },
        function (error) {
          flash(String(error && error.message ? error.message : error), true);
        }
      );
    }, 120);
    els.generated.value = S.buildCss(state) || '/* nothing to apply */';
  }

  // -------------------------------------------------------------- forms
  function populateSelect(select, options) {
    options.forEach(function (option) {
      var node = document.createElement('option');
      node.value = option.value;
      node.textContent = option.label;
      select.appendChild(node);
    });
  }

  function formatOutput(key, value) {
    switch (key) {
      case 'fontScale':
      case 'surfaceOpacity':
      case 'bgImageDim':
        return value + '%';
      case 'gradientAngle':
        return value + '°';
      case 'bgImageBlur':
        return value + 'px';
      case 'letterSpacing':
        return (value > 0 ? '+' : '') + Number(value).toFixed(1) + 'px';
      case 'lineHeight':
        return Number(value) === 0 ? 'default' : Number(value).toFixed(2);
      case 'fontWeight':
        return Number(value) === 0 ? 'default' : String(value);
      case 'chatWidth':
      case 'codeFontSize':
      case 'turnGap':
        return Number(value) === 0 ? 'default' : value + 'px';
      default:
        return String(value);
    }
  }

  function syncOutputs() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-output-for]'), function (output) {
      var key = output.getAttribute('data-output-for');
      output.textContent = formatOutput(key, state[key]);
    });
  }

  function syncConditionals() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-when-bg]'), function (group) {
      group.classList.toggle('is-active', group.getAttribute('data-when-bg') === state.bgMode);
    });
    var customFont = document.querySelector('[data-when-font="custom"]');
    customFont.style.display = state.fontFamily === 'custom' ? '' : 'none';
    var customCode = document.querySelector('[data-when-code-font="custom"]');
    customCode.style.display = state.codeFontFamily === 'custom' ? '' : 'none';
  }

  function fill() {
    inputs().forEach(function (el) {
      var key = el.getAttribute('data-setting');
      var value = state[key];
      if (el.type === 'checkbox') {
        el.checked = !!value;
      } else if (el.hasAttribute('data-optional-color')) {
        // A colour input cannot hold "no value", so an unset colour shows a
        // dimmed placeholder swatch instead.
        el.value = value || COLOR_FALLBACKS[key] || '#808080';
        el.classList.toggle('is-auto', !value);
      } else {
        el.value = value;
      }
    });
    syncOutputs();
    syncConditionals();
    els.generated.value = S.buildCss(state) || '/* nothing to apply */';
  }

  function readInput(el) {
    var key = el.getAttribute('data-setting');
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'range' || el.type === 'number') return parseFloat(el.value);
    return el.value;
  }

  function onInput(event) {
    var el = event.target;
    if (!el.hasAttribute || !el.hasAttribute('data-setting')) return;
    var key = el.getAttribute('data-setting');
    if (el.hasAttribute('data-optional-color')) el.classList.remove('is-auto');
    state[key] = readInput(el);
    syncOutputs();
    syncConditionals();
    save();
  }

  document.addEventListener('input', onInput);
  document.addEventListener('change', onInput);

  // ------------------------------------------------------------- chrome
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
    tab.addEventListener('click', function () {
      var name = tab.getAttribute('data-tab');
      Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (other) {
        other.classList.toggle('is-active', other === tab);
      });
      Array.prototype.forEach.call(document.querySelectorAll('.panel'), function (panel) {
        panel.classList.toggle('is-active', panel.getAttribute('data-panel') === name);
      });
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-preset]'), function (button) {
    button.addEventListener('click', function () {
      state = S.applyPreset(state, button.getAttribute('data-preset'));
      state.enabled = true;
      fill();
      save();
      flash(S.PRESETS[button.getAttribute('data-preset')].label + ' applied');
    });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-clear-color]'), function (button) {
    button.addEventListener('click', function () {
      state[button.getAttribute('data-clear-color')] = '';
      fill();
      save();
    });
  });

  document.getElementById('resetBtn').addEventListener('click', function () {
    state = S.clone(S.DEFAULTS);
    fill();
    save();
    flash('Reset to defaults');
  });

  // ----------------------------------------------------- image picking
  document.getElementById('pickImage').addEventListener('click', function () {
    els.imageFile.click();
  });

  document.getElementById('clearImage').addEventListener('click', function () {
    state.bgImage = '';
    els.imageFile.value = '';
    fill();
    save();
  });

  els.imageFile.addEventListener('change', function () {
    var file = els.imageFile.files && els.imageFile.files[0];
    if (!file) return;
    var maxBytes = 3 * 1024 * 1024;
    if (file.size > maxBytes) {
      flash('Image is over 3 MB — pick a smaller one', true);
      els.imageFile.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      state.bgImage = String(reader.result);
      state.bgMode = 'image';
      fill();
      save();
      els.imageHint.textContent = file.name + ' (' + Math.round(file.size / 1024) + ' KB) embedded.';
    };
    reader.onerror = function () {
      flash('Could not read that file', true);
    };
    reader.readAsDataURL(file);
  });

  // -------------------------------------------------- export / import
  document.getElementById('exportBtn').addEventListener('click', function () {
    var json = JSON.stringify(state, null, 2);
    els.settingsJson.value = json;
    els.settingsJson.select();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(
        function () {
          flash('Copied to clipboard');
        },
        function () {
          flash('Shown below — copy manually');
        }
      );
    } else {
      flash('Shown below — copy manually');
    }
  });

  document.getElementById('importBtn').addEventListener('click', function () {
    var text = els.settingsJson.value.trim();
    if (!text) {
      flash('Paste a configuration first', true);
      return;
    }
    try {
      state = S.withDefaults(JSON.parse(text));
      fill();
      save();
      flash('Configuration applied');
    } catch (error) {
      flash('That is not valid JSON', true);
    }
  });

  // ---------------------------------------------------------- start up
  populateSelect(document.getElementById('fontFamily'), S.FONT_STACKS);
  populateSelect(document.getElementById('codeFontFamily'), S.CODE_FONT_STACKS);

  storageGet().then(function (data) {
    state = S.withDefaults(data && data[KEY]);
    if (state.bgImage.indexOf('data:') === 0) {
      els.imageHint.textContent = 'An embedded image is in use.';
    }
    fill();
  });

  // Let the user know when the popup was opened somewhere the styling
  // does not apply — otherwise "nothing happened" looks like a bug.
  function reportTab(tabs) {
    var url = tabs && tabs[0] && tabs[0].url ? tabs[0].url : '';
    var onSite = /^https?:\/\/([a-z0-9-]+\.)*claude\.(ai|com)\//i.test(url);
    els.siteStatus.textContent = onSite ? 'Styling this tab' : 'Open claude.ai to see changes';
  }

  var tabQuery = { active: true, currentWindow: true };
  try {
    var query = api.tabs.query(tabQuery);
    if (query && typeof query.then === 'function') query.then(reportTab, function () {});
    else api.tabs.query(tabQuery, reportTab);
  } catch (error) {
    try {
      api.tabs.query(tabQuery, reportTab);
    } catch (ignored) {
      /* no tabs access — the header label just stays generic */
    }
  }
})();
