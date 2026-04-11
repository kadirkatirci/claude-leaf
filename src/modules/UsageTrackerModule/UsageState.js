import { USAGE_STALE_MS } from './constants.js';

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const percent = numeric <= 1 ? numeric * 100 : numeric;
  return Math.min(100, Math.max(0, percent));
}

function normalizeResetAt(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    return value < 1e12 ? value * 1000 : value;
  }

  const timestampMs = Date.parse(value);
  return Number.isFinite(timestampMs) ? timestampMs : null;
}

function buildResetLabel(timestampMs, nowMs = Date.now()) {
  if (!Number.isFinite(timestampMs)) {
    return 'reset time unavailable';
  }

  const deltaMs = timestampMs - nowMs;
  const totalMinutes = Math.max(0, Math.round(deltaMs / 60000));

  if (totalMinutes < 60) {
    return `resets in ${totalMinutes} min`;
  }

  if (totalMinutes < 24 * 60) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `resets in ${hours}h ${minutes}m`;
  }

  return `resets ${new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestampMs))}`;
}

function getTone(percent) {
  if (!Number.isFinite(percent)) {
    return 'muted';
  }
  if (percent >= 95) {
    return 'danger';
  }
  if (percent >= 80) {
    return 'warning';
  }
  return 'normal';
}

function buildUsageWindow(label, utilization, resetsAt, nowMs) {
  const percent = clampPercent(utilization);
  if (!Number.isFinite(percent)) {
    return null;
  }

  const resetsAtMs = normalizeResetAt(resetsAt);
  const percentRounded = Math.round(percent);
  const resetLabel = buildResetLabel(resetsAtMs, nowMs);

  return {
    label,
    percent,
    ratio: percent / 100,
    resetsAtMs,
    resetLabel,
    tone: getTone(percent),
    title: `${label} ${percentRounded}% - ${resetLabel}`,
  };
}

export function normalizeUsagePayload(payload, nowMs = Date.now()) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const session = buildUsageWindow(
    'Session',
    payload.five_hour?.utilization,
    payload.five_hour?.resets_at,
    nowMs
  );
  const weekly = buildUsageWindow(
    'Weekly',
    payload.seven_day?.utilization,
    payload.seven_day?.resets_at,
    nowMs
  );

  if (!session && !weekly) {
    return null;
  }

  return {
    source: 'usage_api',
    updatedAtMs: nowMs,
    session,
    weekly,
  };
}

export function normalizeMessageLimitPayload(payload, nowMs = Date.now()) {
  const messageLimit = payload?.message_limit || payload;
  const windows = messageLimit?.windows;
  if (!windows || typeof windows !== 'object') {
    return null;
  }

  const session = buildUsageWindow(
    'Session',
    windows['5h']?.utilization,
    windows['5h']?.resets_at,
    nowMs
  );
  const weekly = buildUsageWindow(
    'Weekly',
    windows['7d']?.utilization,
    windows['7d']?.resets_at,
    nowMs
  );

  if (!session && !weekly) {
    return null;
  }

  return {
    source: 'message_limit',
    updatedAtMs: nowMs,
    session,
    weekly,
  };
}

export function mergeUsageState(previousState, nextState) {
  if (!nextState) {
    return previousState || null;
  }

  if (!previousState) {
    return nextState;
  }

  return {
    source: nextState.source,
    updatedAtMs: nextState.updatedAtMs,
    session: nextState.session || previousState.session,
    weekly: nextState.weekly || previousState.weekly,
  };
}

export function isUsageStateStale(state, maxAgeMs = USAGE_STALE_MS) {
  if (!state?.updatedAtMs) {
    return true;
  }

  return Date.now() - state.updatedAtMs > maxAgeMs;
}

export function hasRenderableUsage(state) {
  return !!(state?.session || state?.weekly);
}
