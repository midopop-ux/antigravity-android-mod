/**
 * patches/web_optimizations/bidi.js - Comprehensive Bidirectional (Arabic/English) layout engine.
 *
 * Enforces the universal Arabic layout directive:
 * - If a sentence/paragraph/input line contains ANY Arabic character (even if it starts with English,
 *   numbers, or symbols), its layout direction MUST be right-to-left (RTL) and right-aligned.
 * - Direction is ONLY left-to-right (LTR) if the text contains ZERO Arabic characters (100% English/Latin/code).
 * - Code blocks, inline code, pre, terminal, and monospace elements are strictly isolated LTR.
 *
 * Applies universally across:
 * 1. User message display bubbles ([data-testid="user-input-step"] [data-quotable="true"]).
 * 2. Assistant responses (.markdown p, li, headings, blockquotes, tables, article p).
 * 3. Chat input editor (Lexical [contenteditable="true"], textareas, inputs) before sending.
 */
function installBidi(doc) {
  try {
    var win = doc.defaultView || (typeof window !== 'undefined' ? window : {});
    var ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u0870-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

    // 1. Inject Stylesheet
    var existing = doc.querySelector('style[data-agy="bidi-fix"]');
    if (existing) {
      existing.remove();
    }
    var bidiStyle = doc.createElement('style');
    bidiStyle.setAttribute('data-agy', 'bidi-fix');
    bidiStyle.textContent =
      '/* Monospace, code blocks, terminal strictly isolated LTR */\n' +
      '[role="listitem"] pre, .message-row pre, .markdown pre,\n' +
      'code, pre, .font-mono, [data-code-block="true"],\n' +
      '.token, .line-numbers, .prism-code,\n' +
      'pre *, code * {\n' +
      '  direction: ltr !important;\n' +
      '  text-align: left !important;\n' +
      '  unicode-bidi: isolate !important;\n' +
      '}\n' +
      '/* Global RTL enforcement when dir="rtl" is set */\n' +
      '[dir="rtl"] {\n' +
      '  direction: rtl !important;\n' +
      '  text-align: right !important;\n' +
      '}\n' +
      '[dir="ltr"] {\n' +
      '  direction: ltr !important;\n' +
      '  text-align: left !important;\n' +
      '}\n' +
      '/* Ensure all headings, paragraphs, and list items isolate bidi flow */\n' +
      'h1, h2, h3, h4, h5, h6, p, li, blockquote, dt, dd, th, td,\n' +
      '[data-testid="user-input-step"] [data-quotable="true"] > div {\n' +
      '  unicode-bidi: isolate !important;\n' +
      '}\n';
    (doc.head || doc.documentElement).appendChild(bidiStyle);

    function isCode(el) {
      if (!el || !el.closest) return false;
      return !!el.closest('pre, code, .font-mono, [data-code-block="true"], .prism-code, .token');
    }

    function applyBidi(el) {
      if (!el || el.nodeType !== 1) return;
      if (isCode(el)) {
        if (el.getAttribute('dir') !== 'ltr') el.setAttribute('dir', 'ltr');
        el.style.setProperty('direction', 'ltr', 'important');
        el.style.setProperty('text-align', 'left', 'important');
        return;
      }
      var text = el.textContent || '';
      if (!text.trim()) return;
      var hasAr = ARABIC_REGEX.test(text);
      var targetDir = hasAr ? 'rtl' : 'ltr';
      var targetAlign = hasAr ? 'right' : 'left';
      if (el.getAttribute('dir') !== targetDir) {
        el.setAttribute('dir', targetDir);
      }
      el.style.setProperty('direction', targetDir, 'important');
      el.style.setProperty('text-align', targetAlign, 'important');
      el.style.setProperty('unicode-bidi', 'isolate', 'important');
    }

    function applyInputBidi(target) {
      if (!target || target.nodeType !== 1) return;
      // Handle <textarea> and text <input>
      if (target.tagName === 'TEXTAREA' || (target.tagName === 'INPUT' && (!target.type || target.type === 'text' || target.type === 'search'))) {
        var val = target.value || '';
        var hasAr = ARABIC_REGEX.test(val);
        var dir = hasAr ? 'rtl' : 'ltr';
        var align = hasAr ? 'right' : 'left';
        if (target.getAttribute('dir') !== dir) target.setAttribute('dir', dir);
        target.style.setProperty('direction', dir, 'important');
        target.style.setProperty('text-align', align, 'important');
        return;
      }

      // Handle Lexical editor and contenteditable
      var ce = target.isContentEditable ? target : (target.closest && target.closest('[contenteditable="true"]'));
      if (ce) {
        // Process each block paragraph inside the editor
        var paras = ce.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6');
        var anyAr = false;
        if (paras.length > 0) {
          paras.forEach(function(p) {
            if (isCode(p)) return;
            var txt = p.textContent || '';
            if (!txt.trim()) return;
            var pHasAr = ARABIC_REGEX.test(txt);
            if (pHasAr) anyAr = true;
            var pDir = pHasAr ? 'rtl' : 'ltr';
            var pAlign = pHasAr ? 'right' : 'left';
            if (p.getAttribute('dir') !== pDir) p.setAttribute('dir', pDir);
            p.style.setProperty('direction', pDir, 'important');
            p.style.setProperty('text-align', pAlign, 'important');
            p.style.setProperty('unicode-bidi', 'isolate', 'important');
          });
        }
        // Also ensure editor container has coherent direction
        var fullText = ce.textContent || '';
        var fullHasAr = anyAr || ARABIC_REGEX.test(fullText);
        var ceDir = fullHasAr ? 'rtl' : 'ltr';
        var ceAlign = fullHasAr ? 'right' : 'left';
        if (ce.getAttribute('dir') !== ceDir) ce.setAttribute('dir', ceDir);
        ce.style.setProperty('direction', ceDir, 'important');
        ce.style.setProperty('text-align', ceAlign, 'important');
      }
    }

    // Attach event listeners for typing (immediate interactive feedback)
    ['input', 'keyup', 'change', 'compositionend', 'focus'].forEach(function(evtName) {
      doc.addEventListener(evtName, function(e) {
        applyInputBidi(e.target);
      }, true);
    });

    // 2. Live MutationObserver for Assistant Responses and Dynamic Content
    var scheduled = false;
    function scanAndApply() {
      scheduled = false;
      var elements = doc.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, li, blockquote, dt, dd, th, td,\n' +
        '[data-turn-content] *,\n' +
        '[contenteditable="true"] p, [contenteditable="true"] div,\n' +
        '[data-testid="user-input-step"] [data-quotable="true"] > div'
      );
      elements.forEach(function(el) {
        applyBidi(el);
      });

      var active = doc.activeElement;
      if (active) {
        applyInputBidi(active);
      }
    }

    var observer = new (win.MutationObserver || MutationObserver)(function(mutations) {
      if (scheduled) return;
      scheduled = true;
      if (win.requestAnimationFrame) {
        win.requestAnimationFrame(scanAndApply);
      } else {
        setTimeout(scanAndApply, 16);
      }
    });

    observer.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true,
      characterData: true
    });

    scanAndApply();
  } catch (e) {
    console.warn('[bidi] error installing bidirectional engine:', e);
  }
}
