export function isModuleDevDisabled(devConfig, moduleId) {
  return devConfig.disabledModules.includes(moduleId);
}

export function getDefaultSettings(config) {
  return JSON.parse(JSON.stringify(config.defaultSettings));
}

export function deepMerge(target, source) {
  const result = { ...target };

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }

  return result;
}

export function getSettingValue(settings, key, moduleId = null) {
  const parts = key.split('.');
  let value = moduleId ? settings[moduleId] : settings;

  for (const part of parts) {
    if (value === undefined || value === null) {
      return undefined;
    }
    value = value[part];
  }

  return value;
}

export function setSettingValue(settings, key, value, moduleId = null) {
  const parts = key.split('.');
  let target = moduleId ? settings[moduleId] || (settings[moduleId] = {}) : settings;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!target[parts[i]]) {
      target[parts[i]] = {};
    }
    target = target[parts[i]];
  }

  target[parts[parts.length - 1]] = value;
}
