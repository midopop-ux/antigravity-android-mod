package com.agy.core;

import android.content.Context;
import android.os.Build;
import android.util.Log;

import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Periodically refreshes the CSRF token used for Core RPC calls.
 *
 * The refresh command updates the local SQLite state DB via Shizuku (rish).
 * It is executed every 45 minutes (or configurable) to avoid the 1‑hour
 * token expiration that triggers the authentication dialog.
 */
public final class TokenRefresher {
    private static final String TAG = "TokenRefresher";
    private static final long REFRESH_INTERVAL_MS = TimeUnit.MINUTES.toMillis(45);
    private static final String REFRESH_CMD = "rish -c \"sqlite3 /data/user/0/com.agy/files/.gemini/config/state.db \"UPDATE CoreRuntimeState SET csrfToken = (SELECT token FROM AuthRefresh WHERE valid = 1 LIMIT 1);\"\"";

    private final ScheduledExecutorService scheduler;
    private final Context context;

    public TokenRefresher(Context ctx) {
        this.context = ctx.getApplicationContext();
        this.scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "AGY-TokenRefresher");
            t.setDaemon(true);
            return t;
        });
        start();
    }

    private void start() {
        // Initial delay of 5 minutes to give the app time to settle.
        long initialDelay = TimeUnit.MINUTES.toMillis(5);
        scheduler.scheduleAtFixedRate(this::runRefresh, initialDelay, REFRESH_INTERVAL_MS, TimeUnit.MILLISECONDS);
        Log.i(TAG, "Token refresher scheduled (interval=" + REFRESH_INTERVAL_MS / 60000 + "min)");
    }

    private void runRefresh() {
        try {
            Log.i(TAG, "Running CSRF token refresh command");
            Process proc = Runtime.getRuntime().exec(REFRESH_CMD);
            int exit = proc.waitFor();
            if (exit == 0) {
                Log.i(TAG, "CSRF token refreshed successfully");
            } else {
                Log.w(TAG, "Token refresh command exited with code " + exit);
            }
        } catch (IOException | InterruptedException e) {
            Log.e(TAG, "Failed to refresh CSRF token", e);
            Thread.currentThread().interrupt();
        }
    }

    public void stop() {
        scheduler.shutdownNow();
        Log.i(TAG, "Token refresher stopped");
    }
}
