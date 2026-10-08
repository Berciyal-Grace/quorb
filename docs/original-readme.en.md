<div align="center">

# Quorb

**Your AI quotas, always in sight.**
Edge-docked usage rings for Claude, Codex, Gemini, Cursor, Copilot, OpenRouter and more — on Windows.

**English** · [Español](../README.es.md)

[![Release](https://img.shields.io/github/v/release/egdev6/quorb?color=ff0036)](https://github.com/egdev6/quorb/releases)
[![Stars](https://img.shields.io/github/stars/egdev6/quorb?style=flat&color=ff0036)](https://github.com/egdev6/quorb/stargazers)
[![License: MIT](https://img.shields.io/badge/license-MIT-black)](../LICENSE)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-black?logo=windows)
![Tauri 2](https://img.shields.io/badge/Tauri-2-black?logo=tauri)

</div>

---

You pay for Claude Max, ChatGPT Plus, Cursor, Copilot… and you only find out you're out of quota when the model stops answering. **Quorb** sits on the edge of your screen as a slim strip of rings — one per subscription — so you always know how much is left, how fast you're burning it and when it resets.

## Features

- 🟠 **Edge-docked strip of rings** — logo in the middle, one ring per limit (5-hour session, weekly, per model). Drag it anywhere; it snaps to the nearest screen edge and turns vertical on the sides.
- 🔍 **Hover for details** — bars, percentages, reset times, plan and spend. The panel scales with the ring size.
- 📈 **Pace & history** — “at this rate you'll run out in 8 h”, plus a local 24 h / 7 d / 30 d history.
- 🎉 **Alerts at two moments** — when you cross your limit and when it resets: Windows notification + a full-screen effect (confetti, danger glow, or your own transparent video / GIF) that never steals your mouse.
- 🎨 **Make it yours** — 32–80 px rings, any RGB accent (the other tones and glows are derived), auto-hide, reorder or hide rings.
- ⌨️ **Global shortcuts** — `Ctrl+Alt+U` toggle, `Ctrl+Alt+I` open the busiest provider, `Ctrl+Alt+R` refresh. Remappable.
- 🔄 **Auto-updates** — signed releases from GitHub; a download icon shows up in the strip when there's a new version.
- 🔐 **Private by design** — no server, no telemetry. Keys live in Windows Credential Manager; OAuth sessions are read from the official CLIs and never refreshed or modified.

<img src="../.github/assets/project-image.png" alt="Promotional illustration of Quorb's usage strip" width="820">

## Supported providers

| Provider | What you see | How it connects | Official API |
|---|---|---|:---:|
| **Claude** Pro / Max | 5-hour session, weekly, Opus | Claude Code login (`claude` → `/login`) | ❌ |
| **ChatGPT** Plus / Pro · Codex | 5-hour and weekly limits | Codex CLI login (`codex login`) | ❌ |
| **Gemini** (AI Pro / Code Assist) | Daily quota per model | Gemini CLI Google login | ❌ |
| **Cursor** | Plan usage (total, Auto, API models) + on-demand spend | Cursor app session (read-only) | ❌ |
| **GitHub Copilot** | Premium requests vs. your plan | Fine-grained token (“Plan: read”) | ✅ |
| **OpenRouter** | Daily / monthly spend, key limit, credits | API key | ✅ |
| **NaN Builders** | Plan quota + tokens per day | Email magic link or API key | ⚠️ |
| **Anthropic API** | Monthly cost | Admin key | ✅ |
| **OpenAI API** | Monthly cost | Admin key | ✅ |

❌ = undocumented endpoint, the same one the official app uses; it may change without notice. Missing your tool? [Request a provider](https://github.com/egdev6/quorb/issues).

## Install

1. Download the latest `.msi` or `-setup.exe` from [**Releases**](https://github.com/egdev6/quorb/releases).
2. Run it. Quorb starts in the tray and shows the strip on the top edge.
3. Open **Settings** (gear icon or tray menu) and enable the providers you use. Claude, Codex, Gemini and Cursor work as soon as you're logged into their official app/CLI.

After that, Quorb keeps itself up to date: it checks GitHub Releases on startup and every 6 hours, and only installs updates signed with the project's key (Settings › Updates).

> Windows may show a SmartScreen warning because the installer is not code-signed yet: **More info → Run anyway**.

## Build from source

Requirements: [Rust](https://rustup.rs) (MSVC toolchain), Microsoft C++ Build Tools, WebView2 (included in Windows 10/11) and Node 22+. See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```powershell
git clone https://github.com/egdev6/quorb
cd quorb
npm install
npm run app:dev      # dev with hot reload
npm run app:build    # installer in src-tauri\target\release\bundle
```

Tests: `npm test` and `cd src-tauri && cargo test`.

## Releasing (maintainers)

```powershell
npm run bump 0.2.0
git commit -am "release v0.2.0"
git tag v0.2.0
git push --follow-tags
```

The [release workflow](mover-a-.github/workflows/release.yml) builds the installers, signs the update and publishes `latest.json`. One-time setup: `npm run setup:signing` (generates the signing key, writes the public key to `tauri.conf.json` and uploads the GitHub secrets with `gh`). `npm run app:build` builds an unsigned local installer without any keys.

## Privacy & how it works

- Everything runs locally. Quorb only talks to each provider's own endpoints.
- API keys and the NaN session are stored in **Windows Credential Manager**, never on disk or in the UI.
- For Claude, Codex, Gemini and Cursor, Quorb **reads** the session the official tool already stored. It never writes to those files and never rotates refresh tokens, so your CLI stays logged in. (Gemini's short-lived access token is refreshed in memory only.)
- There is no “Sign in with Claude/OpenAI” button because neither offers third-party OAuth for consumer plans — login always happens in the official CLI.
- Using undocumented endpoints is a grey area. Use Quorb knowing they can change or stop working.

More details (WSL paths, data files, project layout, adding a provider) in the [Spanish docs](../README.es.md).

## Roadmap

- [x] Auto-updates from GitHub Releases
- [ ] Code-signed installer + `winget install quorb`
- [ ] Click-through mode
- [ ] GLM 4-hour window on NaN Builders
- [ ] macOS / Linux builds

## Contributing

Issues and PRs are welcome — especially new providers. Each one is a single Rust file in [`src-tauri/src/providers`](../src-tauri/src/providers) that returns a `UsageReport`; see “Añadir un proveedor” in the [contribution guide](../CONTRIBUTING.md#añadir-un-proveedor).

If Quorb saves you from a surprise rate limit, a ⭐ helps others find it.

## License

[MIT](../LICENSE) © Enrique Gómez Navarro — [egdev.es](https://egdev.es) · [@egdev66](https://x.com/egdev66) · [Twitch](https://twitch.tv/egdev6)

<sub>Not affiliated with Anthropic, OpenAI, Google, Anysphere, GitHub, OpenRouter or NaN Builders. All trademarks belong to their owners.</sub>
