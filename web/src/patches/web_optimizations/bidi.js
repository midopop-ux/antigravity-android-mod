/**
 * patches/web_optimizations/bidi.js - plaintext unicode-bidi support.
 */
function installBidi(doc) {
  try {
    if (!doc.querySelector('style[data-agy="bidi-fix"]')) {
      var bidiStyle = doc.createElement('style');
      bidiStyle.setAttribute('data-agy', 'bidi-fix');
      bidiStyle.textContent =
        '[role="listitem"] p, [role="listitem"] li, .message-row p, .message-row li, .markdown p, .markdown li, article p, article li {' +
        '  unicode-bidi: plaintext !important;' +
        '  text-align: start !important;' +
        '}' +
        '[role="listitem"] pre, .message-row pre, .markdown pre, code {' +
        '  unicode-bidi: isolate !important;' +
        '  direction: ltr !important;' +
        '  text-align: left !important;' +
        '}';
      (doc.head || doc.documentElement).appendChild(bidiStyle);
    }
  } catch (e) {}
}
