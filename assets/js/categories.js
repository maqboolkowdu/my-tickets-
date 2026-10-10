/* OpsLog — work categories and keyword-based auto classification.
   Add your own keywords here; longer / more specific phrases score higher. */
(function (WL) {
  'use strict';

  const CATEGORIES = [
    { id: 'ad', name: 'Active Directory', short: 'AD', color: '#4f8cff',
      kw: ['active directory', 'ad account', 'ad user', 'create account', 'created account', 'new account', 'new user', 'new starter', 'user account', 'organizational unit', 'ou', 'security group', 'group membership', 'added to group', 'unlock', 'unlocked', 'locked out', 'lockout', 'disable account', 'disabled account', 'enable account', 'leaver', 'gpo', 'group policy', 'aduc', 'samaccountname', 'service account', 'computer object', 'ad'] },
    { id: 'password', name: 'Password Reset', short: 'PWD', color: '#f59e0b',
      kw: ['password reset', 'reset password', 'reset the password', 'reset his password', 'reset her password', 'reset their password', 'pwd reset', 'sspr', 'password expired', 'temporary password', 'temp password', 'password'] },
    { id: 'mfa', name: 'MFA & Sessions', short: 'MFA', color: '#ec4899',
      kw: ['mfa', 'reset mfa', 'multi-factor', 'multifactor', 'authenticator', '2fa', 'revoke session', 'revoked session', 'revoke sessions', 'revoked sessions', 'revoke-mgusersigninsession', 'sign out all sessions', 'refresh token', 're-register', 'reregister', 'authentication method', 'number matching', 'passkey', 'fido'] },
    { id: 'entra', name: 'Entra ID', short: 'ENTRA', color: '#0ea5e9',
      kw: ['entra', 'entra id', 'azure ad', 'aad', 'conditional access', 'app registration', 'enterprise app', 'enterprise application', 'pim', 'privileged identity', 'sign-in logs', 'sign in logs', 'hybrid join', 'entra connect', 'aad connect', 'cloud sync', 'guest user', 'b2b', 'dynamic group', 'admin role', 'graph api'] },
    { id: 'sso', name: '3rd-party SSO', short: 'SSO', color: '#8b5cf6',
      kw: ['sso', 'single sign-on', 'single sign on', 'saml', 'oidc', 'openid', 'oauth', 'federation', 'service provider', 'sp metadata', 'idp metadata', 'claims', 'claim rule', 'assertion', 'acs url', 'entity id', 'canvas', 'blackboard', 'moodle', 'banner', 'workday', 'zoom', 'servicenow'] },
    { id: 'shib', name: 'Shibboleth IdP', short: 'SHIB', color: '#a855f7',
      kw: ['shibboleth', 'shib', 'idp.xml', 'attribute-resolver', 'attribute resolver', 'attribute-filter', 'attribute filter', 'metadata-providers', 'relying-party', 'relying party', 'incommon', 'edugain', 'jetty', 'idp server'] },
    { id: 'ssl', name: 'SSL / TLS Certificates', short: 'SSL', color: '#22c55e',
      kw: ['ssl', 'tls', 'certificate', 'certificates', 'cert', 'csr', 'pfx', 'pem', 'renew cert', 'renewed cert', 'expired cert', 'certbot', "let's encrypt", 'letsencrypt', 'digicert', 'sectigo', 'intermediate', 'wildcard', 'certificate chain', 'keystore'] },
    { id: 'dmarc', name: 'DMARC / SPF / DKIM', short: 'DMARC', color: '#14b8a6',
      kw: ['dmarc', 'spf', 'dkim', 'bimi', 'dns txt', 'txt record', 'rua', 'ruf', 'email authentication', 'p=reject', 'p=quarantine', 'alignment', 'spoofing'] },
    { id: 'mailflow', name: 'Mail Flow', short: 'MAIL', color: '#06b6d4',
      kw: ['mail flow', 'mailflow', 'message trace', 'message tracing', 'trace mail', 'traced', 'transport rule', 'mail flow rule', 'connector', 'ndr', 'bounce', 'bounced', 'quarantine', 'spam', 'junk', 'smtp', 'smtp relay', 'relay', 'eop', 'exchange online protection', 'delivery', 'not receiving', 'not delivered', 'email delay'] },
    { id: 'm365', name: 'Microsoft 365', short: 'M365', color: '#f97316',
      kw: ['m365', 'microsoft 365', 'office 365', 'o365', 'teams', 'sharepoint', 'onedrive', 'exchange', 'exchange online', 'mailbox', 'shared mailbox', 'licence', 'license', 'licensing', 'intune', 'outlook', 'distribution list', 'calendar permission', 'full access', 'send as', 'retention', 'purview', 'compliance search'] },
    { id: 'firewall', name: 'Firewall & Policy', short: 'FW', color: '#ef4444',
      kw: ['firewall', 'firewall policy', 'firewall rule', 'fortigate', 'fortinet', 'palo alto', 'pan-os', 'panorama', 'asa', 'acl', 'nat', 'port forward', 'open port', 'allow rule', 'deny rule', 'vpn', 'ipsec', 'site-to-site', 'globalprotect', 'forticlient', 'security policy', 'sophos', 'checkpoint', 'check point', 'geo block', 'ips profile', 'web filter'] },
    { id: 'security', name: 'Security Investigation', short: 'SEC', color: '#dc2626',
      kw: ['security', 'security incident', 'incident', 'malware', 'compromised', 'compromise', 'suspicious', 'phishing', 'phish', 'threat', 'defender', 'siem', 'sentinel', 'ioc', 'brute force', 'impossible travel', 'risky sign-in', 'risky user', 'vulnerability', 'cve', 'edr', 'forensic', 'investigation', 'investigated', 'ransomware', 'blocked sender'] },
    { id: 'network', name: 'Network Config', short: 'NET', color: '#3b82f6',
      kw: ['switch', 'switches', 'switchport', 'vlan', 'router', 'routing', 'static route', 'ospf', 'bgp', 'trunk', 'port channel', 'lacp', 'stp', 'spanning tree', 'wifi', 'wi-fi', 'wireless', 'access point', 'wlc', 'ssid', 'eduroam', 'dhcp', 'dhcp scope', 'subnet', 'interface', 'cisco', 'aruba', 'juniper', 'meraki', 'ubiquiti', 'radius', 'nps', '802.1x', 'qos', 'core switch', 'patching'] },
    { id: 'connectivity', name: 'Connectivity Troubleshooting', short: 'CONN', color: '#6366f1',
      kw: ['connectivity', 'no internet', 'cannot connect', "can't connect", 'unable to connect', 'ping', 'traceroute', 'tracert', 'packet loss', 'latency', 'jitter', 'dns resolution', 'nslookup', 'link down', 'link flap', 'unreachable', 'slow network', 'slow internet', 'network outage', 'isp', 'wan', 'troubleshoot', 'troubleshooting', 'troubleshot'] },
    { id: 'dc', name: 'Domain Controllers', short: 'DC', color: '#0284c7',
      kw: ['domain controller', 'domain controllers', 'dc', 'dcs', 'replication', 'repadmin', 'dcdiag', 'fsmo', 'sysvol', 'netlogon', 'dns server', 'kerberos', 'ntds', 'time sync', 'w32tm', 'krbtgt', 'forest', 'domain functional level'] },
    { id: 'servers', name: 'Member Servers', short: 'SRV', color: '#64748b',
      kw: ['server', 'servers', 'windows server', 'member server', 'file server', 'print server', 'iis', 'patch', 'patching', 'patched', 'windows update', 'wsus', 'sccm', 'reboot', 'rebooted', 'disk space', 'vm', 'virtual machine', 'vmware', 'vcenter', 'esxi', 'hyper-v', 'backup', 'restore', 'veeam', 'rdp', 'remote desktop', 'scheduled task', 'event log', 'sql server'] },
    { id: 'monitoring', name: 'Service Health & Uptime', short: 'UP', color: '#84cc16',
      kw: ['services up', 'service up', 'ensure services', 'uptime', 'monitoring', 'health check', 'healthcheck', 'status check', 'morning check', 'daily check', 'prtg', 'zabbix', 'nagios', 'solarwinds', 'grafana', 'service health', 'availability', 'heartbeat', 'all green', 'alerts reviewed'] },
    { id: 'other', name: 'Other / General', short: 'GEN', color: '#94a3b8', kw: ['meeting', 'documentation', 'documented', 'training', 'vendor', 'call with'] },
  ];

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  CATEGORIES.forEach((c) => {
    c.rx = (c.kw || []).map((k) => ({ k, rx: new RegExp(`(^|[^a-z0-9])${esc(k)}($|[^a-z0-9])`, 'i'), w: 1 + k.length / 6 }));
  });

  const byId = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  /** Returns best matching category id for free text. */
  function classify(text) {
    const t = ` ${String(text || '').toLowerCase()} `;
    let best = 'other', bestScore = 0;
    for (const c of CATEGORIES) {
      if (c.id === 'other') continue;
      let score = 0;
      for (const { rx, w } of c.rx) if (rx.test(t)) score += w;
      if (score > bestScore) { best = c.id; bestScore = score; }
    }
    return best;
  }

  WL.Categories = { list: CATEGORIES, byId, classify, get: (id) => byId[id] || byId.other };
})(window.WL);
