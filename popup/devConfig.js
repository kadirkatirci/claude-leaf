export async function loadPopupDevConfig() {
  try {
    const { getDevDisabledModules } = await import('../src/config/DevConfig.js');

    return {
      disabledModules: getDevDisabledModules(),
    };
  } catch {
    return { disabledModules: [] };
  }
}
