package com.agy.ui.webview;

import android.util.Log;
import android.webkit.WebView;

/** WebView resume/timer/memory lifecycle, kept out of the activity. */
public final class WebViewLifecycle {

    private static final String TAG = "WebViewHost";

    private WebViewLifecycle() {
    }

    /** Resume the page and tell it the host is back in front. */
    public static void resume(WebView webView) {
        if (webView == null) {
            return;
        }
        try {
            webView.onResume();
            webView.resumeTimers();
            webView.evaluateJavascript(
                    "(function(){ try { window.dispatchEvent(new CustomEvent('agy:host-resume')); } catch(e){} })();",
                    null);
        } catch (Exception e) {
            Log.w(TAG, "failed to resume webView", e);
        }
    }

    /**
     * Pauses page callbacks while the host activity is not visible.
     * Note: We intentionally avoid webView.pauseTimers() here because Antigravity runs
     * long-lived background agent streaming tasks; pausing global timers freezes the JavaScript
     * event loop / SSE state stream handling and results in UI progress freezing on 'Working...'
     * when the user returns.
     */
    public static void pause(WebView webView) {
        if (webView == null) {
            return;
        }
        try {
            webView.onPause();
            // webView.pauseTimers(); -- intentionally disabled to keep agent stream live
        } catch (Exception e) {
            Log.w(TAG, "failed to pause webView", e);
        }
    }

    public static void freeMemory(WebView webView) {
        if (webView == null) {
            return;
        }
        try {
            webView.freeMemory();
        } catch (Exception e) {
            Log.w(TAG, "freeMemory failed", e);
        }
    }
}
