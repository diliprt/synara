# Batch d acceptance — J8 Hand off, J9 Lifecycle, J10 Regression

**No provider CLI is installed or signed in on this Mac** (no codex/claude/opencode/gemini/etc binaries, no `~/.codex`/`~/.claude`, and the bundled Pi provider is present but unauthenticated — `~/.pi/agent/auth.json` is `{}`). Therefore **every step that requires a real model turn is marked `BLOCKED-NO-PROVIDER`** (not an app FAIL). Everything purely UI/orchestration was driven for real in the browser and screenshotted each step.

Environment:
- Repo `/Users/devin/repos/synara` @ `synara/build-project-coordinator-on-main` (1bfe0a3f8).
- Dev server: `env -u T3CODE_AUTH_TOKEN -u SYNARA_AUTH_TOKEN SYNARA_HOME=/tmp/synara-home-batchd SYNARA_NO_BROWSER=1 SYNARA_PORT_OFFSET=4704 bun dev` → web http://localhost:10437/, server :8477. Fresh home; same home reused for the restart test.
- Fixtures: `~/synara-fixtures/web-app` and `~/synara-fixtures/api` (git repos, each with a README + a failing `node --test` `assert.equal(1,2)`), both registered as ordinary projects via the in-app Add Project UI.
- Groups created via UI: `test-group` (linked `web-app`), `scratch-group` (linked `api`), and `run testthe failing` (auto-created by J9-3 "Continue as a group", linked `api`).

Screenshot dir: `acceptance/shots/batch-d/` (all full-app captures, downscaled to 1400px).

---

## J8 — Hand off

| Step | Action | Expected | Actual | Screenshot | Result |
|---|---|---|---|---|---|
| J8-1 | Open ordinary thread `api/run testthe failing` → header "Hand off" | Hand off control present (as upstream) | Button renders in chat header; it is **disabled** — `handoffActionTargetProviders` is empty because no provider is usable (pi installed-but-unauthenticated → `isProviderUsable` false; no CLI providers). Right-click thread context menu shows standard items and **no "Handoff to X" provider items** (also gated on usable providers). | `j8-01-ordinary-thread-context-menu.png` | PASS (correct gating; menu contents unverifiable w/o a provider) |
| J8-2 | Group (non-coordinator) chat → Hand off → provider option → new thread lands in SAME group | Provider hand-off creates a thread inside the same group | **Could not create a group worker thread at all without a provider**: group-chat sends are locked to the group's "Thread model" (codex), which isn't installed → send is blocked before a thread is created; the composer model pick does not override it; the group's Thread-model picker shows "No Pi models found" (only authenticated-provider models are listed), so it can't be repointed to Pi. "Move to group…" on an ordinary thread only **links the project + posts a pickup message to the coordinator** (verified — coordinator transcript shows "A thread was handed to this group for you to pick up…"), it does not create a worker thread. Even if a thread existed, the Hand off menu is disabled (no usable target providers). | — | BLOCKED-NO-PROVIDER |
| J8-3 | Coordinator chat → check for Hand off control | No Hand off control on coordinator | Coordinator chat header has **no** Hand off button. | `j8-03-coordinator-no-handoff.png` | PASS |
| J8-4 | Group chat → Hand off menu → confirm only provider options, no worktree/local | Group chats show no worktree/local hand-off items | The header Hand off menu only ever lists provider items (no worktree/local there at all); the worktree/local hand-off items live in the composer env picker and are gated by `workspaceHandoff = !isGroupContainer` → group chats never receive them (code-verified `threadHandoff.ts`). The group chat's own "Work in" picker showed only workspace-folder options (no "Hand off to new worktree"/"Hand off to local"). A full visual of the env-picker handoff rows needs a live group thread (none creatable w/o provider). | — | PASS (code + draft picker); full env-picker visual inconclusive |

## J9 — Lifecycle

| Step | Action | Expected | Actual | Screenshot | Result |
|---|---|---|---|---|---|
| J9-1 | Group settings → Lifecycle → Pause, then Resume | Pause stops threads + blocks wakes, banner appears; Resume clears | "This group is paused." banner + Resume shown on the coordinator chat; Resume cleared it. No running threads existed to interrupt (none possible w/o provider). | `j9-01-paused-banner.png` | PASS |
| J9-2 | Lifecycle → Archive → expand "Archived groups" → Unarchive | Group archives into "Archived groups", unarchive restores with threads | test-group vanished into a collapsed "Archived groups" section; hover revealed an "Unarchive" button; unarchiving restored it with the coordinator thread + pickup message fully intact. | `j9-02a-archived-groups-test-group.png`, `j9-02b-unarchived-coordinator-intact.png` | PASS |
| J9-3 | Ordinary thread ctx menu → "Continue as a group" | New group created, linked to the thread's context; coordinator reads thread + proposes next steps | New group "run testthe failing" created (auto-named from the thread) and the "Set up your group" onboarding appeared; on create, the group's coordinator opened with the pickup message referencing the source thread id — context is linked. The coordinator's "read + propose next steps" needs a model turn → codex-not-installed error (BLOCKED-NO-PROVIDER). | `j9-03-continue-as-group-onboarding.png`, `j9-03b-new-group-created-pickup-msg.png` | PASS (UI); proposal BLOCKED-NO-PROVIDER |
| J9-4 | scratch-group → Danger zone → "Delete group…" → type name → confirm | Requires typing group name; group gone; linked repos + threads untouched; library trashed | The "Delete group" button stayed disabled until the exact name `scratch-group` was typed; on confirm the group disappeared. Server-side the coordinator data + context mirror + managed library were removed (only 2 group context dirs remain for test-group + run-testthe-failing). `api`/`web-app` projects and the api thread were untouched. **Observation:** the group's workspace folder `~/Documents/Synara/Groups/scratch-group` (containing Synara-generated `AGENTS.md`/`CLAUDE.md`) was left on disk — the delete copy only promises to remove context/coordinator/automations and trash the library, so this is defensible but leaves generated files orphaned. | `j9-04-delete-typed-confirm.png`, `j9-04b-scratch-group-deleted.png` | PASS (see observation) |

## J10 — Regression sweep (ordinary Synara mode)

| Step | Action | Expected | Actual | Screenshot | Result |
|---|---|---|---|---|---|
| J10-1 | Ordinary thread → send a message | Message sends, turn runs | Message send **created** the thread server-side (it persisted in the sidebar), then the turn failed at the provider adapter with a clear error: "Provider adapter request failed (pi)… No API key for azure-openai-responses/gpt-6-astra". Correct behaviour for a missing key — error surfaced, not silent. | `j8-01-ordinary-thread-context-menu.png` | BLOCKED-NO-PROVIDER (error is expected; send→thread-create path works) |
| J10-2 | Toggle diff panel; toggle env panel → reload; open Group/Library panels | Diff opens; env open/close pref persists across reload; Group/Library panels don't change env pref | Diff/Source-control panel opens and shows "No changes in the working tree". Environment panel opens via the header "Environment" (window) toggle. **Nuances:** (a) the env-panel open state did **not** auto-restore after reload in this narrow window — the setting `environmentPanelDefaultOpen` is saved, but `resolveDefaultEnvironmentPanelOpen` suppresses default-open when `isConstrainedChatLayout` (floating-overlay layout) is true, so persistence only applies to docked layouts; (b) opening the Project/Library panels claims the dock via `auxiliarySurface` and hides env without touching the persisted pref (`closeEnvironmentPanelAfterAction` uses `persist=false`) — code-verified; env restores when they close. | `j10-02a-diff-panel-open.png`, `j10-02b-env-panel-open.png` | PASS (diff + env open); env auto-open-on-reload suppressed by floating layout — see observation |
| J10-3 | Open Kanban, Automations, Search, Plugins, Split view | Each surface opens | Kanban board shows api column w/ the task card; Automations lists the two group "Coordinator events" automations; Search palette (magnifier) lists recent chats + quick actions and filters on "test-group"; Plugins page shows provider tabs + "No installed plugins found"; `cmd+\` split view renders two panes and the "Select a chat" picker let me pin a second thread. | `j10-03a-kanban.png`, `j10-03b-automations.png`, `j10-03c-search-palette.png`, `j10-03d-search-filtered.png`, `j10-03e-plugins.png`, `j10-03f-split-view.png` | PASS |
| J10-4 | Kill + restart dev server, same SYNARA_HOME | Groups, coordinator, Overview, library intact | After restart + reload: both groups + their coordinators, both projects + the api thread, the split-view layout, and the open diff panel all persisted. Server-side context dirs intact. | `j10-04-after-restart-state-intact.png` | PASS |
| J10-5 | Watch console/server for errors throughout | No unexpected errors | Dev-server log shows no crashes/fatal errors (only a turbo `--parallel` deprecation warning + expected provider failures). **Browser console could not be captured** — Chrome CDP/`browser_console`/`read_dom` were unavailable despite Chrome being frontmost, so in-page console errors were observed only via on-screen behaviour (no error boundaries/crashes seen). | — | PASS (no visible errors); in-page console not machine-captured |

---

## Bug reports / findings

### F1 — Group worker threads can't be created unless the group's configured provider is installed+authenticated, and the group "Thread model" picker can't be repointed to a merely-installed provider
- Steps: Groups surface → `cmd+alt+n` (new group chat) → pick workspace → send.
- Expected: a group chat should be creatable, or at least the group's thread model should be selectable among installed providers.
- Actual: the send is hard-gated on the group's "Thread model" provider (codex). The composer model pick does not override it, and Group Settings → "Thread model" shows "No Pi models found" even though Pi is installed (it only lists *authenticated* providers' models). With codex uninstalled, group chats cannot be sent at all, and there is no UI path to switch the group to an installed-but-unauthenticated provider. Combined with the fact that "Move to group…" only links the project (it does not create a worker thread), a group produces zero worker threads without a working provider.
- Screenshot: none (behaviour is an absence of a creatable thread).
- Suspected area: `apps/web/src/lib/groupWorkerRouting.ts` (workerRouting model lock), `apps/web/src/hooks/useHandleNewGroupChat.ts` + `startContainerChat.ts` (group chat creation + defaults), group Thread-model picker in `apps/web/src/components/chat/group/GroupSettingsDialog.tsx`.
- Severity/notes: likely partly intended (groups are provider-first), but the model picker offering *no* models for installed-but-unauthenticated providers is a real usability gap worth confirming.

### F2 — Deleting a group leaves its `~/Documents/Synara/Groups/<name>` workspace folder (with generated `AGENTS.md`/`CLAUDE.md`) on disk
- Steps: group settings → Danger zone → Delete group → confirm.
- Expected: ambiguous — delete copy says "Deletes the group, its coordinator, context, and automations. The Library is moved to the trash when possible."
- Actual: coordinator data, context mirror, and managed library were removed (verified server-side), but the auto-created group workspace folder remained. Because that folder only ever contained Synara-generated files, it leaves orphan folders accumulating in `~/Documents/Synara/Groups/`.
- Screenshot: `j9-04b-scratch-group-deleted.png` (group gone; folder check via shell).
- Suspected area: `apps/server/src/projectAgent/Layers/ProjectAgentService.ts` `deleteGroup` (~line 2498-2612) — removes `projectContextRoot` + trashes the managed library but never removes the group's `groupsWorkspaceRoot/<slug>` workspace dir.

### F3 — Environment-panel open state does not persist across reload in the constrained/floating layout
- Steps: open Environment panel via header toggle → reload page.
- Expected: env panel remembers its open state.
- Actual: the setting `environmentPanelDefaultOpen` is persisted, but `resolveDefaultEnvironmentPanelOpen` returns it only when `!isConstrainedChatLayout` — in a narrow window the env panel renders as a floating overlay, so it does not auto-reopen on reload. (The right-dock diff/Source-control panel *does* persist.)
- Suspected area: `apps/web/src/components/ChatView.logic.ts` `resolveDefaultEnvironmentPanelOpen` (~line 544) + `environmentUsesFloatingOverlay` in `ChatView.tsx`.
- Notes: may be intended for floating overlays; flagging because the brief asked for the pref to persist and it silently doesn't in this layout.

---

## Notes / unexpected
- "Move to group…" does **not** move the thread — it links the thread's *project* to the group and posts a pickup message to the group's coordinator (verified: coordinator transcript shows the hand-off text). Thread stays in its source project.
- The "Pi update available" and "Codex CLI not installed" toasts recur throughout; a macOS "App Background Activity" notification overlays the top-right in several captures (cosmetic, not app behaviour).
- A stray `localhost:10437/` text was typed into a coordinator composer draft during a URL-bar misfire (my input error, not app code) — it persists as a draft; harmless.
- Dev server (web :10437, server :8477, SYNARA_HOME=/tmp/synara-home-batchd) was stopped after the restart-persistence check.
