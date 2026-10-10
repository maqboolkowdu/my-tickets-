/* OpsLog — realistic sample data so the dashboard can be showcased before real use. */
(function (WL) {
  'use strict';
  const { U, Store, Agent } = WL;

  const T = {
    ad: ['Created AD account for new staff member in Finance OU', 'Unlocked locked-out account for faculty member', 'Disabled leaver accounts and moved to Disabled OU', 'Added users to Library security group', 'Created service account for backup software', 'Updated GPO for lab computers screen lock'],
    password: ['Reset password for student locked out before exam', 'Password reset for lecturer, verified identity by phone', 'Reset expired password for research account', 'Helped user with SSPR registration'],
    mfa: ['Reset MFA for student with new phone and revoked sessions', 'Revoked all sign-in sessions for compromised account', 'Re-registered Authenticator for VIP user', 'Reset MFA methods for staff member on leave'],
    entra: ['Updated Conditional Access policy to exclude break-glass account', 'Created Entra app registration for research portal', 'Reviewed risky sign-ins in Entra ID', 'Fixed Entra Connect sync error for duplicate proxyAddress', 'Added guest users for visiting researchers'],
    sso: ['Configured SAML SSO for new LMS plugin', 'Troubleshot Zoom SSO claim mismatch', 'Updated SP metadata for library e-resources', 'Set up OIDC integration for student portal'],
    shib: ['Added new relying party to Shibboleth IdP', 'Updated attribute-filter for eduPersonEntitlement release', 'Refreshed InCommon metadata signing cert on Shibboleth', 'Restarted Jetty on Shibboleth IdP after patching'],
    ssl: ['Renewed wildcard SSL certificate and updated load balancer', 'Generated CSR for web server certificate renewal', 'Replaced expiring certificate on RADIUS / NPS', 'Fixed incomplete certificate chain on portal'],
    dmarc: ['Reviewed DMARC aggregate reports for spoofing sources', 'Added SaaS sender to SPF record', 'Enabled DKIM signing for marketing subdomain', 'Moved DMARC policy from p=none to p=quarantine'],
    mailflow: ['Message trace for undelivered emails to external partner', 'Released legitimate mail from quarantine', 'Created transport rule to tag external emails', 'Investigated NDR bounce for distribution list', 'Fixed SMTP relay connector for printers'],
    m365: ['Created shared mailbox for Admissions team', 'Assigned M365 licences to new staff', 'Granted calendar permissions for executive assistant', 'Created Team and SharePoint site for project group', 'Fixed OneDrive sync issue for lecturer'],
    firewall: ['Configured firewall policy to allow vendor VPN access', 'Opened port 443 for new research server on FortiGate', 'Reviewed and cleaned up unused firewall rules', 'Updated geo-block policy on firewall', 'Configured site-to-site IPsec VPN with partner campus'],
    security: ['Investigated phishing campaign and blocked sender domain', 'Security incident: compromised student account, reset and revoked sessions', 'Reviewed Defender alerts for suspicious PowerShell activity', 'Investigated impossible travel sign-in alert'],
    network: ['Configured new VLAN for lab building on core switch', 'Replaced faulty access point in Library', 'Updated DHCP scope for residence halls', 'Configured trunk port and LACP for new server rack', 'Troubleshot eduroam RADIUS authentication failures'],
    connectivity: ['Troubleshooting connectivity issue in Engineering block — packet loss on uplink', 'Traced latency issue to ISP link, raised ticket with provider', 'Fixed DNS resolution issue for remote users', 'Ping and traceroute checks for unreachable lab subnet'],
    dc: ['Checked AD replication with repadmin and dcdiag', 'Fixed SYSVOL replication issue on secondary DC', 'Patched domain controllers in maintenance window', 'Verified FSMO roles and time sync on DCs'],
    servers: ['Patched member servers and rebooted', 'Freed disk space on file server', 'Restored deleted folder from Veeam backup', 'Fixed IIS app pool crash on intranet server', 'Built new Windows Server VM for analytics team'],
    monitoring: ['Morning health check — ensured all services up', 'Reviewed monitoring alerts and cleared false positives', 'Checked uptime of critical services after power maintenance', 'Daily check of backups, DCs and core services — all green'],
    other: ['Documentation update for onboarding runbook', 'Vendor meeting on network refresh', 'Trained help desk on MFA reset process'],
  };
  const WEIGHTS = { ad: 9, password: 8, mfa: 9, entra: 6, sso: 4, shib: 3, ssl: 3, dmarc: 2, mailflow: 6, m365: 8, firewall: 5, security: 4, network: 6, connectivity: 5, dc: 3, servers: 5, monitoring: 7, other: 2 };
  const TASKS = [
    { title: 'Renew SSL certificate for VPN gateway before expiry', category: 'ssl', priority: 'high' },
    { title: 'Follow up with ISP on recurring packet loss', category: 'connectivity', status: 'blocked' },
    { title: 'Migrate remaining DCs to Windows Server 2025', category: 'dc', type: 'job', status: 'in-progress' },
    { title: 'Move DMARC policy to p=reject', category: 'dmarc' },
    { title: 'Onboard new SaaS app to SSO via SAML', category: 'sso', status: 'in-progress' },
    { title: 'Firewall rule review for Q4 audit', category: 'firewall' },
    { title: 'Shibboleth IdP upgrade to v5', category: 'shib', type: 'job' },
  ];

  const rnd = (n) => Math.floor(Math.random() * n);
  const pickWeighted = () => {
    const total = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const [k, w] of Object.entries(WEIGHTS)) { if ((r -= w) < 0) return k; }
    return 'other';
  };

  function generate(days = 400) {
    const out = [];
    const today = U.startOfDay(new Date());
    for (let i = days; i >= 0; i--) {
      const d = U.addDays(today, -i);
      const slots = Agent.slotsFor(d);
      if (!slots.length) continue;
      const n = 2 + rnd(7);
      for (let j = 0; j < n; j++) {
        const cat = pickWeighted();
        const list = T[cat];
        const when = new Date(d);
        when.setHours(0, slots[0] + rnd(slots[slots.length - 1] - slots[0] + 1), 0, 0);
        if (i === 0 && when > new Date()) continue;
        const crit = Math.random() < 0.06 ? 'critical' : Math.random() < 0.15 ? 'high' : 'normal';
        out.push(Store.make({
          title: list[rnd(list.length)], details: '', category: cat, type: 'entry', status: 'done', priority: crit,
          minutes: [5, 10, 15, 20, 30, 45, 60, 90, 120][rnd(9)], ticket: Math.random() < 0.4 ? `INC${100000 + rnd(899999)}` : '',
          when: when.toISOString(), created: when.toISOString(), source: 'demo',
        }));
      }
    }
    TASKS.forEach((t, i) => out.push(Store.make(Object.assign({ type: 'task', status: 'open', priority: 'normal', details: '', when: U.addDays(today, -i).toISOString(), created: U.addDays(today, -i).toISOString(), due: U.ymd(U.addDays(today, 2 + i)), source: 'demo' }, t))));
    // simulated check-in call history
    for (let i = 60; i >= 1; i--) {
      const d = U.addDays(today, -i);
      Agent.slotsFor(d).forEach((m) => {
        const ts = new Date(d); ts.setHours(0, m, 0, 0);
        const r = Math.random();
        Store.calls.push({ ts: ts.toISOString(), kind: 'scheduled', slot: m, outcome: r < 0.82 ? 'answered' : r < 0.9 ? 'snoozed' : 'missed', demo: true });
      });
    }
    return out;
  }

  function load() {
    const list = generate();
    Store.entries.push(...list);
    try { localStorage.setItem('opslog:calls:v1', JSON.stringify(Store.calls)); } catch { /* noop */ }
    Store.persist();
    return list.length;
  }

  function remove() {
    Store.entries = Store.entries.filter((e) => e.source !== 'demo');
    Store.calls = Store.calls.filter((c) => !c.demo);
    try { localStorage.setItem('opslog:calls:v1', JSON.stringify(Store.calls)); } catch { /* noop */ }
    Store.persist();
  }

  WL.Demo = { load, remove };
})(window.WL);
