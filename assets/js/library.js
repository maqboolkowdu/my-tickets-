/* OpsLog — Task Library (templates from the IT & Network Operations dashboard),
   packages of templates and routines that assign them automatically. */
(function (WL) {
  'use strict';
  const { U, Store } = WL;

  const LOCATIONS = ['HQ', 'COE', 'SOFS', 'COM', 'Rustaq'];
  const WINDOWS = { '1-7': [1, 7], '8-14': [8, 14], '15-21': [15, 21], '22-31': [22, 31] };
  const WINDOW_LABEL = { '1-7': '1st–7th', '8-14': '8th–14th', '15-21': '15th–21st', '22-31': '22nd–end of month' };
  const PRIORITY = { critical: 'critical', high: 'high', medium: 'normal', normal: 'normal', low: 'low' };

  // d = daily, w<n> = weekly on weekday n (0 = Sunday), m<window> = monthly window
  const T = (id, title, sched, priority, location) => ({ id, title, sched, priority, location: location || '' });

  const BUILT_IN = [
    { id: 'ad', name: 'Active Directory', category: 'ad',
      purpose: 'Keep the campus identity store accurate, secure, and free of clutter so every staff member, faculty member, and student has exactly the access they need — no more, no less.',
      scenario: 'A new semester brings a wave of onboarding and offboarding; a stale, uncleaned AD slows down provisioning and widens the attack surface from forgotten accounts.',
      tasks: [
        T('AD-01', 'Review lock-outs and password-expiry queue; action any stuck requests', 'd', 'medium'),
        T('AD-02', 'Process new-user / leaver account requests (create, disable, transfer OU)', 'd', 'medium'),
        T('AD-03', 'Investigate recurring account lockout sources (bad password attempts from old cached credentials, mapped drives, mobile devices)', 'd', 'high'),
        T('AD-04', 'Audit stale or disabled accounts with no logon in 90+ days', 'w0', 'low'),
        T('AD-05', 'Check AD replication health across all domain controllers (repadmin /replsummary) and resolve replication errors', 'w1', 'high'),
        T('AD-06', 'Audit privileged group membership (Domain Admins, Enterprise Admins, Schema Admins) for unauthorized or stale members', 'w2', 'critical'),
        T('AD-07', 'Verify FSMO role holders are online; confirm SYSVOL/DFSR replication is healthy across domain controllers', 'w3', 'high'),
        T('AD-08', 'Review and clean up unlinked, duplicate, or conflicting Group Policy Objects', 'm15-21', 'medium'),
        T('AD-09', "Review service account passwords nearing expiry and flag any set to 'password never expires'", 'm8-14', 'high'),
        T('AD-10', 'Deep cleanup: purge expired accounts, tidy OU structure, remove orphaned computer/group objects and stale SPNs', 'm22-31', 'low'),
      ] },
    { id: 'm365', name: 'Microsoft 365 & Azure', category: 'm365',
      purpose: 'Keep the tenant — Exchange, SharePoint, OneDrive, Teams, Intune, Azure, and security tooling — healthy, licensed correctly, and within storage limits.',
      scenario: 'A faculty mailbox nears its quota mid-semester, or Defender flags a compromised sign-in — catching these in the weekly review avoids a support fire-drill.',
      tasks: [
        T('O365-01', 'Check Microsoft 365 Service Health for active advisories/incidents', 'd', 'medium'),
        T('O365-02', 'Security & compliance review: Defender alerts, Secure Score, Conditional Access, Intune compliance', 'w1', 'high'),
        T('O365-03', 'Full tenant report: mailbox sizes, OneDrive storage consumption, license utilization, tenant growth trend', 'm1-7', 'medium'),
      ] },
    { id: 'ssl', name: 'SSL Certificate Expiry', category: 'ssl',
      purpose: 'Prevent unexpected outages and browser security warnings on hosted websites and services caused by expired TLS certificates.',
      scenario: "A student portal's certificate silently expires over a weekend, locking out hundreds of users right before an exam registration deadline.",
      tasks: [
        T('SSL-01', 'Scan all hosted servers & websites for certificates expiring within 30 days', 'w2', 'high'),
        T('SSL-02', 'Full certificate inventory refresh + renewal/procurement planning (60-day horizon)', 'm15-21', 'medium'),
      ] },
    { id: 'demarc', name: 'Demarc Reports (Supplier)', category: 'connectivity',
      purpose: 'Maintain a documented monthly record of demarcation / last-mile circuit performance from the ISP or supplier, for accountability and SLA tracking.',
      scenario: 'A recurring circuit issue needs escalation to the supplier — the monthly demarc reports are the evidence trail that supports the complaint.',
      tasks: [
        T('DMK-01', "Confirm this month's demarc report has been received from the supplier; chase if overdue", 'm1-7', 'medium'),
        T('DMK-02', 'File / archive the report and note any recurring faults for escalation', 'm1-7', 'low'),
      ] },
    { id: 'dns-odp', name: 'Primary DNS — Oman Data Park', category: 'dns',
      purpose: "Ensure the university's authoritative DNS records hosted at Oman Data Park resolve correctly and stay in sync with actual infrastructure.",
      scenario: "A server migration changes an IP address but the DNS record isn't updated — external users can't reach the service until the stale record is caught.",
      tasks: [
        T('DNS-01', 'Spot-check primary DNS zone resolution and record accuracy', 'w4', 'medium'),
        T('DNS-02', 'Full DNS record audit against inventory (A / MX / CNAME / TXT / SPF / DKIM)', 'm15-21', 'medium'),
      ] },
    { id: 'fortigate', name: 'FortiGate Firewalls — All Campuses', category: 'firewall',
      purpose: 'Keep perimeter security consistent and healthy across every campus firewall: policies current, firmware patched, threats triaged, and IPSec tunnels linking every campus back to HQ (and each other, where legacy services depend on it) up and passing traffic.',
      scenario: 'A firmware CVE is disclosed for FortiOS, or a site-to-site IPSec tunnel silently drops — without a daily per-campus check, a branch site can lose resource sharing (or legacy AD access) for hours before anyone notices.',
      tasks: [
        T('FGT-01', 'Triage critical/high-severity IPS & AV alerts across all campus FortiGates', 'd', 'critical'),
        T('FGT-02', 'Policy review, firmware advisory check, and VPN tunnel health across campuses', 'w3', 'high'),
        T('FGT-03', 'Monitor HQ FortiGate health and confirm every inbound campus IPSec tunnel is established', 'd', 'critical', 'HQ'),
        T('FGT-04', 'Verify IPSec tunnel between COE and HQ is up and passing traffic for shared resources', 'd', 'high', 'COE'),
        T('FGT-05', 'Verify IPSec tunnel between SOFS and HQ is up and passing traffic for shared resources', 'd', 'high', 'SOFS'),
        T('FGT-06', 'Verify IPSec tunnel between COM and HQ is up and passing traffic for shared resources', 'd', 'high', 'COM'),
        T('FGT-07', 'Verify IPSec tunnel between COM and Rustaq is up — legacy AD-related services depend on this link', 'd', 'critical', 'COM'),
        T('FGT-08', 'Verify IPSec tunnel between Rustaq and HQ is up and passing traffic for shared resources', 'd', 'high', 'Rustaq'),
        T('FGT-09', 'Verify IPSec tunnel between Rustaq and COM is up — legacy AD-related services depend on this link', 'd', 'critical', 'Rustaq'),
      ] },
    { id: 'cloudflare', name: 'Cloudflare DNS', category: 'dns',
      purpose: 'Manage public-facing DNS records in Cloudflare cleanly — proxy and security settings correct, stale entries removed.',
      scenario: 'A decommissioned subdomain still resolves and gets discovered by a scanner, becoming a phishing or shadow-IT risk if not cleaned up.',
      tasks: [
        T('CF-01', 'Review/add DNS records as requested; verify proxy (orange-cloud) & security settings', 'w3', 'medium'),
        T('CF-02', 'Remove stale or unused DNS entries', 'm15-21', 'low'),
      ] },
    { id: 'trc', name: 'TRC — Research Council Server', category: 'apps',
      purpose: "Keep the National University's TRC (The Research Council) server available and performant for research reporting and compliance.",
      scenario: "Faculty need to submit research output to TRC ahead of a national reporting deadline — an unnoticed outage jeopardizes the university's standing.",
      tasks: [
        T('TRC-01', 'Verify TRC server reachability and check monitoring/alerting', 'd', 'high'),
        T('TRC-02', 'Health check: services running, disk/CPU/memory headroom, connectivity to TRC endpoints', 'w4', 'medium'),
      ] },
    { id: 'masader', name: 'Masader (OMREN Subscription)', category: 'apps',
      purpose: 'Ensure students can access library research databases through the Masader platform under the OMREN consortium subscription without interruption.',
      scenario: "Students researching for a thesis deadline suddenly can't log in to Masader — catching an expired renewal or auth issue early avoids a wave of complaints.",
      tasks: [
        T('MSD-01', 'Verify student access/login to Masader is working', 'd', 'high'),
        T('MSD-02', 'Check OMREN subscription status, renewal date, and usage stats', 'w4', 'medium'),
      ] },
    { id: 'koha', name: 'KOHA Library Services', category: 'apps',
      purpose: 'Keep the KOHA integrated library system — catalog, circulation, OPAC — running so students and staff can search and borrow materials.',
      scenario: 'The OPAC search goes down during peak return/checkout week — a daily uptime check catches it before it becomes a queue at the circulation desk.',
      tasks: [
        T('KOHA-01', 'Verify KOHA service uptime and OPAC accessibility', 'd', 'high'),
        T('KOHA-02', 'Check for pending updates/module errors; review circulation reports', 'w4', 'medium'),
      ] },
    { id: 'eduroam', name: 'Eduroam Wireless', category: 'network',
      purpose: 'Maintain reliable wireless network access for students and visiting researchers via the Eduroam federated authentication service, across every campus.',
      scenario: "A RADIUS certificate quietly expires and students at one campus suddenly can't connect to WiFi during the first week of classes — a per-campus check catches it before it's a helpdesk queue.",
      tasks: [
        T('EDU-01', 'Verify Eduroam authentication service (RADIUS) uptime', 'd', 'critical'),
        T('EDU-02', 'Review connection logs/failures and RADIUS certificate validity', 'w4', 'medium'),
        T('EDU-03', 'Verify Eduroam SSID broadcast and authentication are working at HQ', 'd', 'high', 'HQ'),
        T('EDU-04', 'Verify Eduroam SSID broadcast and authentication are working at COE', 'd', 'high', 'COE'),
        T('EDU-05', 'Verify Eduroam SSID broadcast and authentication are working at SOFS', 'd', 'high', 'SOFS'),
        T('EDU-06', 'Verify Eduroam SSID broadcast and authentication are working at COM', 'd', 'high', 'COM'),
        T('EDU-07', 'Verify Eduroam SSID broadcast and authentication are working at Rustaq', 'd', 'high', 'Rustaq'),
      ] },
    { id: 'backup', name: 'Backup Operations (Veeam)', category: 'backup',
      purpose: 'Guarantee that daily, weekly, and monthly backups run through Veeam Backup & Replication complete successfully — and are actually restorable.',
      scenario: 'A ransomware incident or hardware failure hits a file server — the Veeam backup is only as good as the last time it was verified to restore correctly.',
      tasks: [
        T('BKP-01', "Confirm last night's Veeam backup jobs completed successfully across all systems", 'd', 'critical'),
        T('BKP-02', 'Review the Veeam Backup & Replication console for failed jobs, warnings, or license/certificate expiry', 'd', 'high'),
        T('BKP-03', 'Spot-check restore of a sample file or VM using Veeam Instant Recovery', 'w0', 'high'),
        T('BKP-04', 'Check Veeam backup repository storage capacity and retention policy compliance', 'w2', 'medium'),
        T('BKP-05', 'Full Veeam backup/DR restore test; review job chaining, repository capacity & retention policy', 'm22-31', 'high'),
      ] },
    { id: 'cyber', name: 'Cybersecurity Class Preparation', category: 'teaching',
      purpose: 'Stay ahead of the teaching schedule for the cybersecurity course — labs, slides, and lab environments ready before each session.',
      scenario: 'A hands-on lab (e.g. a VM-based pen-testing exercise) needs its environment rebuilt or patched before class — leaving it to the last minute risks a failed session in front of students.',
      tasks: [
        T('CYB-01', "Review next week's lecture/lab materials; update slides or lab guides as needed", 'w4', 'medium'),
        T('CYB-02', 'Semester readiness review: syllabus alignment, lab VM/environment testing, grading tracker', 'm22-31', 'medium'),
      ] },
    { id: 'patching', name: 'Windows Updates & Firmware', category: 'servers',
      purpose: 'Keep every server under your responsibility current on security patches and firmware to close vulnerabilities before they\'re exploited.',
      scenario: 'A critical Windows Server vulnerability is disclosed — servers still missing the patch during the monthly cycle are the first targets for automated exploit scans.',
      tasks: [
        T('PTC-01', 'Monitor for newly disclosed critical/zero-day security patches', 'd', 'high'),
        T('PTC-02', 'Patch cycle: test, schedule, and deploy Windows Updates & firmware updates to all responsible servers', 'm8-14', 'high'),
      ] },
  ];

  /* PowerShell toolkit from the original dashboard, attached to the tickets they support. */
  const OU = 'OU=National University,DC=nu,DC=edu,DC=om';
  const SCRIPTS = {
    'AD-02': { name: 'Export All AD Users (National University OU) to CSV',
      purpose: 'Pulls a full, timestamped export of every user account under the National University OU — the base dataset for any AD documentation, audit, or director-facing report.',
      code: `Import-Module ActiveDirectory

# Export all AD users in the National University OU to a dated CSV
$OU = "${OU}"
$OutFile = "$env:USERPROFILE\\Desktop\\AD_Users_Export_$(Get-Date -Format 'yyyy-MM-dd').csv"

Get-ADUser -Filter * -SearchBase $OU -Properties DisplayName,SamAccountName,EmailAddress,Enabled,LastLogonDate,PasswordLastSet,PasswordNeverExpires,whenCreated |
    Select-Object DisplayName,SamAccountName,EmailAddress,Enabled,LastLogonDate,PasswordLastSet,PasswordNeverExpires,whenCreated |
    Export-Csv -Path $OutFile -NoTypeInformation -Encoding UTF8

Write-Host "Exported to $OutFile"` },
    'AD-04': { name: 'Export Stale & Disabled Accounts (90+ Days)',
      purpose: 'Finds every account with no logon in 90+ days (or already disabled) and exports it to CSV — the evidence list behind the AD-04 weekly cleanup ticket.',
      code: `Import-Module ActiveDirectory

# Export accounts with no logon in 90+ days, or currently disabled
$OU = "${OU}"
$CutoffDate = (Get-Date).AddDays(-90)
$OutFile = "$env:USERPROFILE\\Desktop\\AD_Stale_Accounts_$(Get-Date -Format 'yyyy-MM-dd').csv"

Get-ADUser -Filter * -SearchBase $OU -Properties LastLogonDate,Enabled,DistinguishedName |
    Where-Object { $_.LastLogonDate -lt $CutoffDate -or -not $_.LastLogonDate } |
    Select-Object Name,SamAccountName,Enabled,LastLogonDate,DistinguishedName |
    Export-Csv -Path $OutFile -NoTypeInformation -Encoding UTF8

Write-Host "Exported to $OutFile"` },
    'AD-06': { name: 'Export Privileged Group Membership',
      purpose: 'Lists everyone in Domain Admins, Enterprise Admins, and Schema Admins — the evidence behind the AD-06 weekly privileged-group audit ticket.',
      code: `Import-Module ActiveDirectory

# Export members of the top-level privileged groups for review
$Groups = "Domain Admins","Enterprise Admins","Schema Admins"
$OutFile = "$env:USERPROFILE\\Desktop\\AD_Privileged_Groups_$(Get-Date -Format 'yyyy-MM-dd').csv"

$Groups | ForEach-Object {
    $GroupName = $_
    Get-ADGroupMember -Identity $GroupName -Recursive |
        Get-ADUser -Properties DisplayName,Enabled,LastLogonDate |
        Select-Object @{N='Group';E={$GroupName}},DisplayName,SamAccountName,Enabled,LastLogonDate
} | Export-Csv -Path $OutFile -NoTypeInformation -Encoding UTF8

Write-Host "Exported to $OutFile"` },
    'AD-09': { name: 'Export Service Account Password Review',
      purpose: "Flags accounts set to 'password never expires' or unchanged for 180+ days — the evidence behind the AD-09 monthly service-account password review ticket.",
      code: `Import-Module ActiveDirectory

# Export accounts set to "password never expires" or unchanged for 180+ days
$OU = "${OU}"
$Cutoff = (Get-Date).AddDays(-180)
$OutFile = "$env:USERPROFILE\\Desktop\\AD_PasswordReview_$(Get-Date -Format 'yyyy-MM-dd').csv"

Get-ADUser -Filter {PasswordNeverExpires -eq $true -or PasswordLastSet -lt $Cutoff} -SearchBase $OU -Properties DisplayName,PasswordNeverExpires,PasswordLastSet,Enabled |
    Select-Object DisplayName,SamAccountName,Enabled,PasswordNeverExpires,PasswordLastSet |
    Export-Csv -Path $OutFile -NoTypeInformation -Encoding UTF8

Write-Host "Exported to $OutFile"` },
  };

  /* ---------------- storage ---------------- */
  const K_CUSTOM = 'opslog:library:custom:v1';
  const K_PKG = 'opslog:packages:v1';
  const read = (k, f) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch { return f; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { U.toast('Could not save — browser storage is full or blocked', 'error'); } };

  let custom = read(K_CUSTOM, []); // [{id, areaId, title, sched, priority, location, script?}]
  const CUSTOM_AREA = { id: 'custom', name: 'My templates', category: 'other', custom: true,
    purpose: 'Your own reusable tasks. Add anything you do repeatedly so it can be assigned in one click or bundled into a routine.',
    scenario: 'You run the same Teams-room check before every board meeting — save it once and assign it whenever the meeting is on the calendar.' };

  function areas() {
    const list = BUILT_IN.map((a) => ({ ...a, tasks: a.tasks.concat(custom.filter((c) => c.areaId === a.id)) }));
    list.push({ ...CUSTOM_AREA, tasks: custom.filter((c) => c.areaId === 'custom' || !BUILT_IN.some((a) => a.id === c.areaId)) });
    return list;
  }
  function all() { return areas().flatMap((a) => a.tasks.map((t) => ({ ...t, area: a }))); }
  function get(id) { return all().find((t) => t.id.toUpperCase() === String(id).toUpperCase()) || null; }

  /* ---------------- schedule maths ---------------- */
  const cadence = (t) => (t.sched === 'd' ? 'daily' : t.sched[0] === 'w' ? 'weekly' : t.sched[0] === 'm' ? 'monthly' : 'ad-hoc');
  const weekday = (t) => Number(t.sched.slice(1));
  const windowOf = (t) => WINDOWS[t.sched.slice(1)];
  function scheduleLabel(t) {
    const c = cadence(t);
    if (c === 'daily') return 'Every day';
    if (c === 'weekly') return U.DAYS[weekday(t)] + 's';
    if (c === 'monthly') return WINDOW_LABEL[t.sched.slice(1)];
    return 'On demand';
  }
  function isDue(t, date) {
    const c = cadence(t);
    if (c === 'daily') return true;
    if (c === 'weekly') return date.getDay() === weekday(t);
    if (c === 'monthly') { const [a, b] = windowOf(t); return date.getDate() >= a && date.getDate() <= b; }
    return false;
  }
  function periodKey(t, date) {
    if (cadence(t) === 'monthly') return `${date.getFullYear()}-${U.pad(date.getMonth() + 1)}-M${t.sched.slice(1)}`;
    return U.ymd(date);
  }
  /** Last day of the template's current window (monthly) or the day itself. */
  function dueDate(t, date) {
    if (cadence(t) !== 'monthly') return U.ymd(date);
    const [, b] = windowOf(t);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    return U.ymd(new Date(date.getFullYear(), date.getMonth(), Math.min(b, last)));
  }

  /** The latest instance (entry) of a template for the period containing `date`. */
  function instance(t, date = new Date()) {
    const key = periodKey(t, date);
    return Store.entries.find((e) => e.templateId === t.id && e.periodKey === key) || null;
  }

  /* ---------------- assigning ---------------- */
  function toEntry(t, date, source) {
    const now = new Date();
    const when = U.sameDay(date, now) ? now : new Date(date.getFullYear(), date.getMonth(), date.getDate(), 8, 0);
    return {
      title: t.title, details: `${t.id} · ${t.area.name} · ${scheduleLabel(t)}`, category: t.area.category,
      type: 'task', status: 'open', priority: PRIORITY[t.priority] || 'normal', ticket: t.id, location: t.location || '',
      tags: [cadence(t)], due: dueDate(t, date), when: when.toISOString(), source,
      templateId: t.id, periodKey: periodKey(t, date),
    };
  }

  /**
   * Assign templates to yourself for `date`. Skips any template already assigned for that period.
   * When an older open copy of the same template exists, it is marked "skipped" (superseded).
   * opts.status = 'done' logs them as completed instead.
   */
  function assign(ids, { date = new Date(), source = 'library', status = 'open' } = {}) {
    const created = [], existing = [], updated = [];
    const fresh = [];
    for (const id of ids) {
      const t = get(id);
      if (!t) continue;
      const inst = instance(t, date);
      if (inst) {
        if (status === 'done' && inst.status !== 'done') { Store.update(inst.id, { status: 'done' }); updated.push(inst); }
        else existing.push(inst);
        continue;
      }
      const data = toEntry(t, date, source);
      if (status === 'done') data.status = 'done';
      fresh.push(data);
    }
    if (fresh.length) {
      const keys = new Set(fresh.map((f) => f.templateId));
      Store.entries.forEach((e) => {
        if (keys.has(e.templateId) && e.status !== 'done' && e.status !== 'skipped') { e.status = 'skipped'; e.updated = new Date().toISOString(); }
      });
      created.push(...Store.addMany(fresh));
    }
    return { created, existing, updated };
  }

  /* ---------------- custom templates ---------------- */
  function nextCustomId() {
    let n = custom.length + 1;
    while (custom.some((c) => c.id === `MY-${U.pad(n)}`)) n++;
    return `MY-${U.pad(n)}`;
  }
  function saveTemplate(tpl) {
    const i = custom.findIndex((c) => c.id === tpl.id);
    if (i >= 0) custom[i] = tpl; else custom.push({ ...tpl, id: tpl.id || nextCustomId() });
    write(K_CUSTOM, custom);
    Store.persist();
  }
  function removeTemplate(id) {
    custom = custom.filter((c) => c.id !== id);
    write(K_CUSTOM, custom);
    packages.forEach((p) => { p.templateIds = p.templateIds.filter((x) => x !== id); });
    write(K_PKG, packages);
    Store.persist();
  }

  /* ---------------- packages & routines ---------------- */
  // mode: 'cadence' = follow each template's own schedule (a routine)
  //       'days'    = assign every template in the package on the chosen weekdays
  //       'manual'  = only when you run it
  let packages = read(K_PKG, null);
  if (!packages) {
    const by = (c) => BUILT_IN.flatMap((a) => a.tasks).filter((t) => cadence(t) === c).map((t) => t.id);
    packages = [
      { id: 'pkg-daily', name: 'Daily operational checks', mode: 'cadence', days: [], auto: true, templateIds: by('daily'), lastRun: null },
      { id: 'pkg-weekly', name: 'Weekly checks', mode: 'cadence', days: [], auto: true, templateIds: by('weekly'), lastRun: null },
      { id: 'pkg-monthly', name: 'Monthly checks', mode: 'cadence', days: [], auto: true, templateIds: by('monthly'), lastRun: null },
      { id: 'pkg-tunnels', name: 'IPSec tunnel sweep — all campuses', mode: 'manual', days: [], auto: false, templateIds: ['FGT-03', 'FGT-04', 'FGT-05', 'FGT-06', 'FGT-07', 'FGT-08', 'FGT-09'], lastRun: null },
      { id: 'pkg-eduroam', name: 'Eduroam campus sweep', mode: 'manual', days: [], auto: false, templateIds: ['EDU-01', 'EDU-03', 'EDU-04', 'EDU-05', 'EDU-06', 'EDU-07'], lastRun: null },
    ];
    write(K_PKG, packages);
  }
  const savePackages = () => { write(K_PKG, packages); Store.persist(); };
  function savePackage(p) {
    const i = packages.findIndex((x) => x.id === p.id);
    if (i >= 0) packages[i] = p; else packages.push({ ...p, id: p.id || 'pkg-' + U.uid() });
    savePackages();
  }
  function removePackage(id) { packages = packages.filter((p) => p.id !== id); savePackages(); }

  /** Templates of a package that are due on `date` under the package's mode. */
  function dueInPackage(p, date, { force = false } = {}) {
    const ids = p.templateIds.filter((id) => get(id));
    if (force || p.mode === 'manual') return ids;
    if (p.mode === 'days') return p.days.includes(date.getDay()) ? ids : [];
    return ids.filter((id) => isDue(get(id), date));
  }

  /** Run a package now. Manual runs assign everything in it; routines assign what is due. */
  function runPackage(p, { date = new Date(), force = false, source = 'routine' } = {}) {
    const ids = dueInPackage(p, date, { force });
    const res = assign(ids, { date, source });
    p.lastRun = U.ymd(date);
    savePackages();
    return res;
  }

  function isWorkday(date) { return WL.Agent ? WL.Agent.slotsFor(date).length > 0 : true; }

  /** Auto-assign routines for today (idempotent: templates already assigned are skipped). */
  function autoRun(date = new Date()) {
    if (Store.settings.routinesEnabled === false) return [];
    const created = [];
    for (const p of packages) {
      if (!p.auto || p.mode === 'manual') continue;
      if (p.mode === 'cadence' && !isWorkday(date)) continue;
      const ids = dueInPackage(p, date);
      if (!ids.length) continue;
      const res = assign(ids, { date, source: 'routine' });
      if (res.created.length) { p.lastRun = U.ymd(date); created.push(...res.created); }
    }
    if (created.length) savePackages();
    return created;
  }

  /** Templates due today that are not yet assigned (across the whole library). */
  function dueToday(date = new Date()) {
    return all().filter((t) => isDue(t, date) && !instance(t, date));
  }

  /** Today's routine/library tickets (the "Today's Focus" list). */
  function todays(date = new Date()) {
    const ymd = U.ymd(date);
    return Store.entries.filter((e) => e.templateId && e.status !== 'skipped' &&
      (e.due === ymd || (e.periodKey && e.periodKey.includes('-M') && e.status !== 'done' && e.due >= ymd) || (e.status === 'done' && e.completedAt && U.ymd(new Date(e.completedAt)) === ymd)));
  }

  /** Find template ids written in free text, e.g. "AD-03 and fgt-07". */
  function idsIn(text) {
    const out = [];
    (String(text).match(/\b[A-Z][A-Z0-9]{1,5}-\d{2}\b/gi) || []).forEach((m) => { const t = get(m); if (t && !out.includes(t.id)) out.push(t.id); });
    return out;
  }
  function findPackage(text) {
    const q = String(text).toLowerCase();
    let best = null, score = 0;
    for (const p of packages) {
      const words = p.name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
      const s = words.filter((w) => q.includes(w)).length;
      if (s > score) { best = p; score = s; }
    }
    return score ? best : null;
  }

  WL.Library = {
    LOCATIONS, WINDOW_LABEL, PRIORITY, areas, all, get, cadence, scheduleLabel, isDue, periodKey, instance,
    assign, saveTemplate, removeTemplate, nextCustomId, scripts: SCRIPTS,
    packages: () => packages, savePackage, removePackage, runPackage, dueInPackage, autoRun, dueToday, todays,
    idsIn, findPackage, isWorkday,
  };
})(window.WL);
