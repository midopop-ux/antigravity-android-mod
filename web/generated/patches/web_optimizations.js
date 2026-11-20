(function(){
/**
 * patches/web_optimizations/taps.js - kill the 300ms double-tap delay.
 */
'use strict';

function installTaps(doc) {
  try {
    var style = doc.createElement('style');
    style.setAttribute('data-agy', 'web-optimizations');
    style.textContent =
      'button,a,[role="button"],input,select,textarea{touch-action:manipulation;}';
    (doc.head || doc.documentElement).appendChild(style);
  } catch (e) {}
}

/**
 * patches/web_optimizations/viewport.js - keep --agy-vvh honest while the
 * soft keyboard opens.
 */
function installViewport(global, doc) {
  try {
    if (global.visualViewport) {
      global.visualViewport.addEventListener('resize', function () {
        var vv = global.visualViewport;
        if (vv && vv.height && doc.documentElement) {
          doc.documentElement.style.setProperty(
            '--agy-vvh', Math.round(vv.height) + 'px');
        }
      }, { passive: true });
    }
  } catch (e) {}
}

/**
 * patches/web_optimizations/gpu.js - GPU-accelerate scroll/animation surfaces
 * and isolate layout for lists.
 */
function installGpu(doc) {
  try {
    if (!doc.querySelector('style[data-agy="gpu-acceleration"]')) {
      var gpu = doc.createElement('style');
      gpu.setAttribute('data-agy', 'gpu-acceleration');
      // Promote ONLY the real scroll containers. Never inline <code>/<pre>:
      // per-element layers explode on Mali and saturate RenderThread.
      gpu.textContent =
        'main, [data-testid="chat-container"], .scrollable {' +
        ' transform: translateZ(0);' +
        ' -webkit-overflow-scrolling: touch; }' +
        '[role="listitem"], .message-row, .artifact-viewer {' +
        ' contain: layout style; }' +
        '*{ -webkit-tap-highlight-color: transparent; }';
      (doc.head || doc.documentElement).appendChild(gpu);
    }
  } catch (e) {}
}

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
      '/* Ensure all paragraphs and items isolate bidi flow */\n' +
      '.markdown p, .markdown li, .markdown h1, .markdown h2, .markdown h3, .markdown h4, .markdown h5, .markdown h6,\n' +
      '.markdown blockquote, .markdown td, .markdown th, article p, article li, .prose p, .prose li,\n' +
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
        var paras = ce.querySelectorAll('p, div');
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
        '.markdown p, .markdown li, .markdown h1, .markdown h2, .markdown h3, .markdown h4, .markdown h5, .markdown h6,\n' +
        '.markdown blockquote, .markdown td, .markdown th,\n' +
        'article p, article li, [role="article"] p, [role="article"] li,\n' +
        '.prose p, .prose li, [data-turn-content] p,\n' +
        '[contenteditable="true"] p,\n' +
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

/**
 * patches/web_optimizations/public-api.js - install and expose.
 */
var global = window;

if (global.__AG_WEB_OPTIMIZATIONS__) return;
global.__AG_WEB_OPTIMIZATIONS__ = true;

var doc = global.document;
if (!doc) return;

installTaps(doc);
installViewport(global, doc);
installGpu(doc);
installBidi(doc);

global.__agWebOptimizations = { installed: true };

/* Agent-state reconciliation for stale sidebar summaries.
 * The backend can leave CascadeTrajectorySummary.notFullyIdle=true even after
 * the actual agent state stream reports IDLE+fullyIdle=true.
 * Hydrate native-confirmed completion across Android Activity/WebView recreations.
 * The proof expires and is cleared on a genuine native RUNNING event.
 * Do not trust the stale UI RUNNING summary over native completion proof.
 */
(function(){
  var status = new Map(), listeners = new Set(), effective = new Map();
  var MAX = 128;
  function valid(id){ return typeof id === 'string' &&
    id.length > 0 && id.length <= 128 && /^[A-Za-z0-9_+:-]+$/.test(id); }
  window.__AGY_VERIFIED_AGENT_GET__ = function(id){
    if (!valid(id)) return false;
    if (status.get(id) === 1) return true;
    try { return window.Android?.wasAgentRecentlyFinished?.(window.__AG_NATIVE_BRIDGE_TOKEN__, id) === true; }
    catch (_) { return false; }
  };
  window.__AGY_VERIFIED_AGENT_SUBSCRIBE__ = function(fn){
    listeners.add(fn);
    return function(){ listeners.delete(fn); };
  };
  // Native completion can change the synchronous Android snapshot without a
  // UI agent-stream event in this window. Recheck mounted React subscribers
  // when this particular WebView returns; React skips unchanged snapshots.
  function recheck(){
    for(var cb of listeners) { try { cb(); } catch (_) {} }
  }
  window.addEventListener?.('agy:host-resume', recheck);
  window.addEventListener?.('pageshow', recheck);
  if(typeof document !== 'undefined') document.addEventListener?.('visibilitychange', function(){
    if(document.visibilityState === 'visible') recheck();
  });
  window.__AGY_VERIFIED_AGENT_OBSERVE__ = function(state){
    try {
      if(!state || !valid(state.conversationId)) return;
      var next;
      if (state.status === 1 && state.fullyIdle === true) next=1;
      else if(state.status === 2 || state.status === 4) next=2;
      else return;
      var id=state.conversationId, prev=status.get(id);
      if(prev !== next){
        status.delete(id);status.set(id,next);
        if(status.size > MAX) status.delete(status.keys().next().value);
      }
      // Native service may clear its finished proof after receiving the first
      // genuine RUNNING. Recheck even when WebView sends repeated RUNNING.
      var snapshot=window.__AGY_VERIFIED_AGENT_GET__(id), before=effective.get(id);
      effective.set(id,snapshot);
      if(effective.size > MAX) effective.delete(effective.keys().next().value);
      if(prev !== next || (before !== undefined && before !== snapshot)){
        for(var cb of listeners) { try { cb(); } catch (_) {} }
      }
      if(prev === next) return;
      if(next === 1){
        window.Android?.diagnosticEvent?.(window.__AG_NATIVE_BRIDGE_TOKEN__, 'reconcile_idle', 'id='+id.slice(-6).replace(/[^A-Za-z0-9]/g,'_'));
      }
    }catch(_){}
  };
})();

/**
 * Native task status bridge. Invoked from decoded StreamAgentStateUpdates,
 * and TrajectorySummaries for background list items.
 */
(function () {
  var knownRunning = new Set();

  function compactStage(state) {
    try {
      var steps = state.trajectorySlice && state.trajectorySlice.stepsInSlice;
      var last = steps && steps.length ? steps[steps.length - 1] : null;
      var step = last && last.step;
      var metadata = step && step.metadata;
      var value = metadata && (metadata.toolSummary || metadata.description);
      if (typeof value === 'string' && value.trim()) {
        return value.replace(/\s+/g, ' ').slice(0, 120);
      }
    } catch (_) {}
    return 'Agent is performing task';
  }

  window.__AGY_NOTIFY_SUMMARIES__ = function (updates) {
    try {
      var bridge = window.Android;
      if (!bridge) return;
      for (var pair of updates || []) {
        var id = pair[0], item = pair[1];
        if (typeof id !== 'string' || !item) continue;
        if (typeof item.summary === 'string' && typeof bridge.onConversationSummary === 'function') {
          bridge.onConversationSummary(window.__AG_NATIVE_BRIDGE_TOKEN__, id, item.summary);
        }
        // Authoritative sidebar completion detection:
        // Even when the user does not open the conversation or has the app in background,
        // TrajectorySummaries notifies whenever notFullyIdle toggles false!
        var isRunning = item.notFullyIdle === true || item.isRunning === true || item.status === 'CASCADE_RUN_STATUS_RUNNING';
        if (isRunning) {
          knownRunning.add(id);
          if (typeof bridge.onAgentState === 'function') {
            bridge.onAgentState(window.__AG_NATIVE_BRIDGE_TOKEN__, id, 2, false, "Working...");
          }
        } else if (knownRunning.has(id) && (item.notFullyIdle !== true || item.status === 'CASCADE_RUN_STATUS_IDLE' || item.status === 1)) {
          if (window.__AGY_RETRYING_CONVS__ && window.__AGY_RETRYING_CONVS__.has(id)) {
            return;
          }
          knownRunning.delete(id);
          if (typeof bridge.onAgentState === 'function') {
            bridge.onAgentState(window.__AG_NATIVE_BRIDGE_TOKEN__, id, 1, true, "");
          }
        }
      }
    } catch (_) {}
  };

  window.__AGY_NOTIFY_AGENT_STATE__ = function (state) {
    try {
      var bridge = window.Android;
      if (!bridge || typeof bridge.onAgentState !== 'function') return;
      if (!state || typeof state.conversationId !== 'string') return;
      // CascadeRunStatus.IDLE=1, RUNNING=2, BUSY=4.
      if (state.status !== 1 && state.status !== 2 && state.status !== 4) return;
      if (state.status === 2 || state.status === 4) {
        knownRunning.add(state.conversationId);
      } else if (state.status === 1 && state.fullyIdle === true) {
        if (window.__AGY_RETRYING_CONVS__ && window.__AGY_RETRYING_CONVS__.has(state.conversationId)) {
          bridge.onAgentState(
            window.__AG_NATIVE_BRIDGE_TOKEN__, state.conversationId, 2, false, "Reconnecting...");
          return;
        }
        knownRunning.delete(state.conversationId);
      }
      window.__AGY_DIAG_AGENT_OBSERVE__?.(state);
      window.__AGY_VERIFIED_AGENT_OBSERVE__?.(state);
      bridge.onAgentState(
        window.__AG_NATIVE_BRIDGE_TOKEN__, state.conversationId, state.status, state.fullyIdle === true, compactStage(state));
    } catch (_) {
      // Never interrupt core agent state updates because notifications failed.
    }
  };
})();


})();
