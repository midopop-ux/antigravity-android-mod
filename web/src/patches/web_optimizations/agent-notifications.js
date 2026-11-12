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
