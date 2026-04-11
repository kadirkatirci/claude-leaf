import { ACTIVE_SCHEDULE_STATUSES, SCHEDULE_PRESETS, SCHEDULE_STATUS } from './constants.js';

export function normalizeConversationUrl(rawUrl) {
  if (!rawUrl) {
    return '';
  }

  try {
    const url = new URL(rawUrl, window.location.origin);
    return `${url.origin}${url.pathname}`;
  } catch {
    return String(rawUrl);
  }
}

export function normalizeSnapshotText(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function isActiveSchedule(record) {
  return !!record && ACTIVE_SCHEDULE_STATUSES.has(record.status);
}

export function buildScheduledForLabel(timestampMs) {
  if (!timestampMs) {
    return '';
  }

  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
  });

  return formatter.format(new Date(timestampMs));
}

export function getPresetDatetimeValue(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

export function buildPendingStatusLabel(record) {
  if (!record) {
    return '';
  }

  const prefix = record.status === SCHEDULE_STATUS.RETRYING ? 'Retrying send' : 'Scheduled send';
  const suffix = buildScheduledForLabel(record.scheduledForMs);

  if (record.status === SCHEDULE_STATUS.RETRYING && record.retryCount > 0) {
    return `${prefix} at ${suffix} (retry ${record.retryCount}/3)`;
  }

  return `${prefix} at ${suffix}`;
}

export function buildFailureMessage(record) {
  const code = record?.lastErrorCode;

  switch (code) {
    case 'draft_mismatch':
      return 'Scheduled draft no longer matches the locked composer.';
    case 'attachment_restore_failed':
      return 'Scheduled attachments could not be restored after navigation or reload.';
    case 'retry_exhausted':
      return 'Scheduled send failed after 3 retry attempts.';
    case 'expired_session':
      return 'Pending scheduled sends expire when the browser session restarts.';
    case 'composer_busy':
      return 'Claude was busy when the scheduled send became due.';
    case 'composer_not_ready':
      return 'Composer was not ready when the scheduled send became due.';
    case 'matching_tab_missing':
      return 'No matching Claude tab was available when the scheduled send became due.';
    default:
      return 'Scheduled send failed.';
  }
}

export function getPresetLabelForDelay(delayMs) {
  return SCHEDULE_PRESETS.find(preset => preset.delayMs === delayMs)?.label || null;
}
