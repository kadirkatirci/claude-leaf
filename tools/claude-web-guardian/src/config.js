export const DEFAULT_SETTINGS = {
  enabled: true,
  intervalMinutes: 60,
  checks: {
    domCore: true,
    editHistory: true,
    sidebar: true,
    theme: true,
    routes: true,
  },
  bridge: {
    enabled: false,
    webhookUrl: '',
  },
  historyLimit: 200,
};

export const STORAGE_KEYS = {
  settings: 'cwg_settings',
  reports: 'cwg_reports',
  lastRunAt: 'cwg_last_run_at',
};

export const ALARM_NAME = 'cwg_scheduled_canary';
