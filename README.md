# OpsLog — A Voice-Driven Work Journal for IT Engineers

> Track every task you do (from a 2-minute MFA reset to a week-long Shibboleth upgrade) with an assistant that **rings you like a phone call** every 30 minutes during working hours. It builds your **daily, weekly, monthly, quarterly and yearly reports** for you.

![Platform](https://img.shields.io/badge/platform-any%20browser-4f6bff) ![Backend](https://img.shields.io/badge/backend-none-8b5cf6) ![Data](https://img.shields.io/badge/data-stays%20on%20your%20device-22c55e)

---

## 1. Description

OpsLog is a modern, installable web app (PWA) for a personal record of IT operations work: Active Directory, Entra ID, M365, mail flow, firewall policy, network troubleshooting, Shibboleth, SSL certificates, DMARC, 3rd-party SSO, domain controllers, member servers, service health and so on.

You can type an update or **say it out loud**. OpsLog works out the **area**, **type** (entry, task or job), **status**, **priority**, **time spent** and **ticket number** from what you say:

> *"Reset MFA for a student and revoked all sessions, took 10 minutes, INC0012345"*
> → **MFA & Sessions** · Done · 10m · `INC0012345`

It runs entirely in the browser and needs no server or database. Your data stays on your device.

## 2. Purpose

| Problem | How OpsLog solves it |
|---|---|
| At the end of the week you can't remember half of what you fixed. | An assistant **calls you every 30 minutes** and asks what you did. Answering takes 15 seconds. |
| Small jobs (password resets, unlocks, message traces) never show up in reports. | Every item counts. Reports show *volume* as well as *big projects*. |
| Appraisals, monthly reports and CV updates take hours. | One click gives you a **Day / Week / Month / Quarter / Year** report with charts, a written summary, and Markdown, CSV or PDF export. |
| You want to **showcase** your work without leaking user data. | **Showcase mode** masks e-mail addresses and IPs on screen and in exports. |

## 3. Scenario

> *It's Monday 10:30. You've just finished a mail-flow trace for the Finance team and are halfway through a FortiGate policy change.*
>
> Your PC rings: **"📞 Ava · OpsLog Assistant — Work check-in · 10:30 AM"**. You click **Answer**:
>
> **Ava:** "Hi Maqbool, it's Ava. Time for your check-in. What have you worked on since 10:00 AM?"
> **You:** "Traced mail flow for finance, NDR from a partner domain, twenty minutes. Also working on the FortiGate policy for the vendor VPN."
> **Ava:** "Got it — logged 2 items: Mail Flow, Firewall & Policy as an open task. Anything else?"
> **You:** "That's all."
> **Ava:** "Thanks — 2 items saved. I'll check in again at 11:00 AM."
>
> At **4:00 PM** (3:00 PM on Thursday) the last call is the **end-of-day wrap-up**. Ava reads out your day's summary, and on Thursday it opens your **weekly report**. On the last working day of the month, quarter or year it opens those reports too.

---

## 4. Features

- **📞 Phone-call style check-ins**: a full-screen incoming-call screen with ringtone, vibration (on mobile), desktop notification, Answer / Snooze / Decline, and a spoken two-way conversation.
- **⏰ Your working hours built in**: by default Sun–Wed 08:00–14:00 and 15:00–16:00, Thu 08:00–15:00, every 30 minutes. You can edit this in *Settings*.
- **🎙️ Voice or text**: dictate anywhere (quick log, editor, task board) or type during the call.
- **🧠 Auto-classification** into 18 areas: AD, Password Reset, MFA & Sessions, Entra ID, 3rd-party SSO, Shibboleth IdP, SSL/TLS, DMARC/SPF/DKIM, Mail Flow, M365, Firewall & Policy, Security Investigation, Network Config, Connectivity, Domain Controllers, Member Servers, Service Health & Uptime, and Other.
- **🗂️ Entries, tasks and jobs** on a drag-and-drop board (Open → In progress → Blocked → Done).
- **📊 Dashboard**: today's timeline, KPIs, streak, check-in answer rate, weekly chart, area donut and a 12-month activity heatmap.
- **📑 Reports** for Day / Week / Month / Quarter / Year, with a written narrative, charts, time-by-area breakdown, high-impact work, and export to **Markdown, CSV, Print/PDF** or a copied summary.
- **🙈 Showcase mode** masks e-mails and IP addresses.
- **💾 Backup / restore** to and from JSON. **Sample data** is included so you can demo the dashboards straight away.
- **📱 Installable PWA** that works offline and adapts to desktop, tablet and phone in light or dark theme.
- **🪟 Windows helper script** so the check-in still rings when the browser is closed (see section 7).

### Things you can say during a call

| Say… | What happens |
|---|---|
| "Created an AD account for the new lecturer in Finance, 10 minutes" | Logs a completed **Active Directory** entry with 10m |
| "Need to renew the SSL cert on the VPN gateway by Thursday, high priority" | Creates an **open task**, due Thursday, priority High |
| "Unlocked the dean's account. Also patched two member servers, took an hour" | Logs **two** items (split on *also / then / next*) |
| "What did I do today?" / "Summary this week" / "…this month" | Reads out a spoken summary |
| "Open tasks" | Reads your top open tasks |
| "Mark the certificate task done" | Finds the matching open task and closes it |
| "Nothing new" / "That's all" / "Bye" | Ends the call |

---

## 5. How to use it (step by step)

### Step 1: Open the app
- **Hosted:** publish it with GitHub Pages (see section 6) and open `https://<your-user>.github.io/my-tickets-/`.
- **Local test:** from the repo folder run `python -m http.server 8080` and open <http://localhost:8080>.
  (Opening `index.html` by double-clicking works too, but notifications and offline mode need `http(s)://`.)

### Step 2: Install it (recommended)
In **Edge or Chrome**, click the *Install app* icon in the address bar. OpsLog then runs in its own window, which is what the Windows helper looks for.

### Step 3: Personalise
Go to **Settings** and:
1. Enter your **name** (the assistant greets you by it), role and team.
2. Click **Enable desktop notifications**. You'll be alerted while OpsLog is in the background.
3. Check the **Working hours** windows and the *Call every* interval.
4. Click **Test incoming call**, then **Answer**, and say something.

> 💡 **Sound needs one click.** Browsers block audio until you interact with the page once. After opening OpsLog, click anywhere (the orange *"Click anywhere to arm call sound"* pill disappears). Keep the tab or app open, minimised if you like.

### Step 4: Log work
- **Answer the calls.** This is the main workflow.
- Use the **Quick log** box on the dashboard (type or 🎙️). A preview shows how it will be classified.
- Click **+ New entry** for full control (area, type, status, priority, time, ticket, due date, tags).
- Click the green **📞** button anytime to call the assistant yourself.
- Keyboard shortcuts: `N` = new entry, `C` = call assistant, `Enter` / `Esc` = answer / decline a ringing call.

### Step 5: Reports and showcase
Open **Reports**, pick *Day / Week / Month / Quarter / Year*, and use ◀ ▶ to move through periods. Then:
- **Print / PDF** gives a clean printable report (sidebar and buttons are hidden).
- **Markdown** is ready to paste into your website, wiki or appraisal.
- **CSV** opens in Excel.
- Turn on **👁 Showcase mode** (top bar) before sharing your screen or exporting.

### Step 6: Back up
**Settings → Export backup (JSON)**. Do this regularly. Data lives in your browser profile, so clearing site data deletes it. **Import backup** restores or merges on another PC.

---

## 6. Publish with GitHub Pages

The repo includes `.github/workflows/pages.yml`, which deploys the site on every push to `main`.

1. Merge this branch into `main`.
2. In GitHub go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. After the workflow runs, the site is live at `https://<your-user>.github.io/my-tickets-/`.

> Your work data is **never** uploaded to GitHub. The site is only the app code; entries stay in each browser's local storage.

---

## 7. Make it ring even when the browser is closed (Windows + PowerShell)

Browsers can only ring while the page is open. For a guaranteed "phone call" on your workstation, register the scheduled tasks once:

```powershell
# Run in a normal (non-admin) PowerShell window from the repo's tools folder
Set-ExecutionPolicy -Scope Process Bypass
.\tools\Register-OpsLogCheckins.ps1 -AppUrl "https://<your-user>.github.io/my-tickets-/" -Browser Edge -SkipWhenLocked
```

What it does at every slot (Sun–Wed 08:00–14:00 and 15:00–16:00, Thu 08:00–15:00, every 30 min):
1. Plays a ring and **speaks** *"It's your OpsLog check-in. What have you been working on?"* (Windows SAPI voice).
2. If OpsLog is already open, it brings that window to the front, and the page rings by itself. Otherwise it opens OpsLog in **incoming-call mode** (`?call=1`).
3. With `-SkipWhenLocked` it does nothing while your PC is locked.

Other useful commands:

```powershell
# Test one alert right now
& "$env:LOCALAPPDATA\OpsLog\Invoke-OpsLogCheckin.ps1" -AppUrl "https://<your-user>.github.io/my-tickets-/"

# Change the interval to 45 minutes
.\tools\Register-OpsLogCheckins.ps1 -AppUrl "<url>" -IntervalMinutes 45

# Remove everything
.\tools\Register-OpsLogCheckins.ps1 -Unregister
```

The tasks appear in **Task Scheduler → Task Scheduler Library → OpsLog**. To change hours, edit the `$Windows` table at the top of the script, then re-run it.

---

## 8. How it works (for the curious)

```
index.html                 App shell, call screen, editor dialog
assets/css/app.css         Design tokens (light/dark), layout, call UI, print styles
assets/js/util.js          Date helpers, icons, masking, toasts
assets/js/categories.js    18 work areas + keyword classifier  ← add your own keywords here
assets/js/parser.js        Free text → {title, area, type, status, priority, minutes, ticket, due}
assets/js/store.js         localStorage persistence, settings, call log, backup/restore
assets/js/voice.js         Speech synthesis (assistant voice), speech recognition, ringtone
assets/js/agent.js         Work-hours scheduler + phone-call conversation engine
assets/js/reports.js       Period ranges, aggregation, narrative, Markdown/CSV export
assets/js/charts.js        Dependency-free SVG charts (donut, bars, heatmap)
assets/js/app.js           Views: Dashboard, Work Log, Tasks, Reports, Settings
sw.js                      Offline cache + notification "Answer / Snooze" buttons
tools/Register-OpsLogCheckins.ps1   Windows scheduled-task "phone call" helper
```

**Browser support:** voice input (speech recognition) works in **Chrome, Edge and Safari**. In Firefox you can still answer calls by typing. Everything else works in any modern browser.

## 9. Ideas for later

- Real phone calls or SMS via Twilio / Teams (needs a small serverless backend).
- Sync across devices (OneDrive / SharePoint list / Microsoft Graph).
- Pull ticket data automatically from ServiceNow / Jira.
- Microsoft 365 Copilot-style monthly narrative using an LLM API.

---

*Built for engineers who do a hundred small things a day and deserve credit for every one of them.*
