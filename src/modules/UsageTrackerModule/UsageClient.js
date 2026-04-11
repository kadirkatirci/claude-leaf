export default class UsageClient {
  constructor(bridge = null) {
    this.bridge = bridge;
  }

  getActiveOrgId() {
    const match = document.cookie.match(/(?:^|;\s*)lastActiveOrg=([^;]+)/);
    if (!match?.[1]) {
      return '';
    }

    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  async fetchUsage(orgUuid) {
    if (!orgUuid) {
      throw new Error('missing_org_uuid');
    }

    try {
      return await this.fetchDirect(orgUuid);
    } catch (error) {
      if (!this.bridge) {
        throw error;
      }

      return this.bridge.requestUsage(orgUuid);
    }
  }

  async fetchDirect(orgUuid) {
    const response = await fetch(`/api/organizations/${encodeURIComponent(orgUuid)}/usage`, {
      credentials: 'include',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`usage_fetch_failed_${response.status}`);
    }

    return response.json();
  }
}
