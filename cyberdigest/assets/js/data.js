/* CyberDigest — static reference data: topics, GCC countries, helpers. */
(function () {
  const TOPICS = {
    ransomware:      { label: 'Ransomware',          emoji: '🔐', c1: '#ef4444', c2: '#7f1d1d' },
    vulnerabilities: { label: 'Vulnerabilities',     emoji: '🩹', c1: '#f59e0b', c2: '#9a3412' },
    breaches:        { label: 'Data breaches',       emoji: '💧', c1: '#ec4899', c2: '#831843' },
    'threat-intel':  { label: 'Threat intel & APT',  emoji: '🎯', c1: '#8b5cf6', c2: '#3b0764' },
    malware:         { label: 'Malware',             emoji: '🦠', c1: '#22c55e', c2: '#14532d' },
    phishing:        { label: 'Phishing & fraud',    emoji: '🎣', c1: '#06b6d4', c2: '#164e63' },
    identity:        { label: 'Identity & access',   emoji: '🪪', c1: '#3b82f6', c2: '#1e3a8a' },
    cloud:           { label: 'Cloud & SaaS',        emoji: '☁️', c1: '#0ea5e9', c2: '#0c4a6e' },
    network:         { label: 'Network & edge',      emoji: '🛜', c1: '#14b8a6', c2: '#134e4a' },
    'ot-ics':        { label: 'OT & critical infra', emoji: '🏭', c1: '#a16207', c2: '#422006' },
    ai:              { label: 'AI security',         emoji: '🤖', c1: '#6366f1', c2: '#312e81' },
    policy:          { label: 'Policy & regulation', emoji: '⚖️', c1: '#64748b', c2: '#1e293b' },
    education:       { label: 'Education sector',    emoji: '🎓', c1: '#84cc16', c2: '#365314' },
    general:         { label: 'General',             emoji: '📰', c1: '#2563eb', c2: '#0f172a' },
  };

  const COUNTRIES = {
    AE: { name: 'UAE',          flag: '🇦🇪' },
    SA: { name: 'Saudi Arabia', flag: '🇸🇦' },
    QA: { name: 'Qatar',        flag: '🇶🇦' },
    OM: { name: 'Oman',         flag: '🇴🇲' },
    BH: { name: 'Bahrain',      flag: '🇧🇭' },
    KW: { name: 'Kuwait',       flag: '🇰🇼' },
  };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function ago(iso) {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  const readMins = (item) => Math.max(1, Math.round(((item.ideas || []).join(' ').split(/\s+/).length + 15) / 200));

  window.CD = { TOPICS, COUNTRIES, esc, dayKey, ago, readMins };
})();
