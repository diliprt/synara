# Acceptance test report — Synara "Groups" build (Batch A: J1–J3)

Build: `/Users/devin/repos/synara` @ `1bfe0a3f8` branch `synara/build-project-coordinator-on-main` (diliprt/synara fork).
Env: `bun dev` with `SYNARA_HOME=/Users/devin/acceptance-batch-a/synara-home`, `SYNARA_PORT_OFFSET=4701`, `SYNARA_NO_BROWSER=1`. Web `http://localhost:10434`, server `127.0.0.1:8474`.
Method: real Chrome UI only — click/type/screenshot at every step. Shell used only for fixtures (git repos `web-app`/`api` under `~/acceptance-fixtures/`, legacy Studio seeding in `state.sqlite`) and read-only diagnosis.
Limitation: **no provider CLIs installed** (codex/claude/etc absent) → coordinator first turn errors "Codex CLI is not installed" (expected; greeting is server-synthesized). Model picker offers only "Pi" → "No Pi models found" → defaults (GPT-5 Codex) used everywhere; effort shows "Not available for gpt-5-codex".

## J1 — First run & navigation

| # | Action | Expected | Actual | Screenshot | Result |
|---|--------|----------|--------|------------|--------|
| 1 | Launch `bun dev`, open web URL | App loads, first-run welcome | Welcome dialog shown, dismissed | j1-01 | PASS |
| 2 | Open switcher pill (top-left) | Lists "Synara" + "Groups" | Both entries listed | j1-03 | PASS |
| 3 | Select "Groups" | Empty state "No groups yet" | Groups surface + empty-state copy | j1-04 | PASS |
| 4 | Register `web-app` via "Add project" | Ordinary project listed | `web-app` registered under Synara | j1-11 | PASS |
| 5 | Register `api` via "Add project" | Ordinary project listed | `api` registered | j1-12 | PASS |
| 6 | Settings → "Show the Groups tab" OFF | Tab hidden; /groups bounces | Switcher loses Groups entry; /groups route bounces to "/" | j1-05..j1-08 | PASS |
| 7 | Toggle back ON | Groups entry restored | Restored in switcher | j1-09 | PASS |
| 8 | Navigate to `/studio` | Redirects to `/groups` | Redirected (Groups surface, not 404) | j1-10 | PASS |
| 9 | Legacy Studio seed → restart | Appears as group "Groups" w/ old chats | Container adopted + retitled "Groups"; seeded chats present | j1-13 | PASS |
| 10 | Hide section while group thread open | (brief: "bounces off group threads") | Group thread STAYS open; switcher shows only "Synara" | j1-14, j1-15 | PASS* |

\* Ambiguity note: the `/groups` index route bounces when the section is hidden, but an open group *thread* stays open — this is designed behavior (repo browser test "keeps a group thread open when the Groups section is hidden"). Verified: thread rendered fully with toggle OFF; only the switcher entry is suppressed.

## J2 — Create a group

| # | Action | Expected | Actual | Screenshot | Result |
|---|--------|----------|--------|------------|--------|
| 1 | Sidebar → "New group" | Name dialog (placeholder "Group name", "Create group") | RenameDialog opened | j2-01, j2-04b | PASS |
| 2 | Enter "Frontend" → Create | Onboarding dialog, sections General/Memory/Environment/Plugins | "Set up your group" opened, all 4 sections in nav | j2-02 | PASS |
| 3 | Set goal + coordinator icon + color | Values applied in draft | Goal "Coordinate frontend work across web-app and api repos"; trophy/compass icon + teal color | j2-02 | PASS |
| 4 | Set coordinator + thread model/effort | Model/effort pickable | Only "Pi" offered → "No Pi models found"; kept GPT-5 Codex default; effort "Not available for gpt-5-codex" | j2-03 | PASS (env-limited) |
| 5 | "Use default" appearance | Resets icon+color | Reset verified (first click missed row, second worked) | — | PASS |
| 6 | Environment → "Add repository" → `web-app` | Row appears under "Linked repositories" | **Picker closed but "No linked repositories." remained** — link persisted server-side yet invisible pre-config | j2-06 | **FAIL → BUG-1** |
| 7 | "Create group" | Coordinator chat opens w/ greeting + chips | "Frontend Coordinator" opened; server greeting + "Connect repositories / Add a goal / Write instructions" chips | j2-04 | PASS |
| 8 | Sidebar check | Group + coordinator row first, chosen icon/color | "Frontend" group w/ "Frontend Coordinator" first, chosen icon+teal | j2-04 | PASS |
| 9 | Repeat "New group" → "Frontend!" | Two groups stay ("Frontend", "Frontend!") | Separate group created (`frontend-2` dir on disk); both in sidebar | j2-05, j2-05b | PASS |

## J3 — Settings persistence

| # | Action | Expected | Actual | Screenshot | Result |
|---|--------|----------|--------|------------|--------|
| 1 | Panel gear ("Group settings") | Edit dialog opens | Group panel → gear → dialog on General | j3-04, j3-05 | PASS |
| 2 | Sidebar right-click → "Edit project agent" | Edit dialog opens | Opened; values persisted | j3-03 | PASS |
| 3 | Chip "Connect repositories" | Opens Environment | Opened Environment; **`web-app` shown linked + Remove** (proves BUG-1 link persisted) | j3-01 | PASS |
| 4 | Chip "Add a goal" | Opens General | Opened General, goal persisted | j3-06 | PASS |
| 5 | Chip "Write instructions" | Opens Memory | Opened Memory, "# Instructions" persisted | j3-07 | PASS |
| 6 | All values persisted | Goal/icon/color/models/efforts/link | All persisted (models = GPT-5 Codex defaults; effort N/A) | j3-03, j3-09 | PASS |
| 7 | "Use default" in edit mode | Resets appearance | Selection cleared, Save re-enabled | j3-08 | PASS |
| 8 | Invalid remote URL "notaurl" → Save | Rejected | Red error: regex + `at ["libraryRemoteUrl"]`; dialog stays open | j3-02 | PASS |
| 9 | Edit mode submit label | Never "Create group" | Footer shows "Save" | j3-05 | PASS |
| 10 | Memory + Plugins sections render | Sections functional | Memory editor + toggles OK; Plugins lists providers ("No installed plugins" — no CLIs) | j3-10, j3-11 | PASS |

## Bug Reports

### BUG-1 — Linked repository is invisible during group onboarding

- **Steps**: Groups → New group → "Frontend" → Environment → "Add repository" → click `web-app`.
- **Expected**: `web-app` appears under "Linked repositories" (linking "applies immediately" per the copy).
- **Actual**: picker closes, section still reads "No linked repositories." — looks like the click silently failed (no toast, no error). Re-tried 3×; same. After finishing "Create group" and reopening settings, `web-app` IS listed — the link persisted server-side the whole time; it just cannot render during onboarding.
- **Root cause (analysis)**: the client reads the list from `props.agent.overview?.config?.linkedProjectIds` (`apps/web/src/components/chat/group/GroupEnvironmentSection.tsx:45`), but the server's `buildOverview` returns `config: null` for unconfigured groups (`apps/server/src/projectAgent/Layers/ProjectAgentService.ts:683–693`). The server explicitly supports linking before the config exists (comment at `ProjectAgentService.ts:1427–1429`), so `project_agent_linked_projects` gets the row — the overview just has no `config` to carry it back until the group is saved.
- **Suspected fix area**: include linked ids in the unconfigured overview path (`ProjectAgentService.ts:684–693`), or have the section read links from a non-config source (`GroupEnvironmentSection.tsx:45` / `useProjectAgent.ts`).
- **Screenshots**: `j2-06-link-invisible-onboarding.png` (during onboarding), `j3-01-chip-environment-linked.png` (after create — linked row visible).

### BUG-2 (minor) — Stale save error persists after draft returns to baseline

- **Steps**: Edit group → Environment → Git remote = `notaurl` → Save → red regex error appears → clear field back to "" → Save becomes disabled (no longer dirty) but the error text stays in the footer.
- **Expected**: error clears when the field is corrected (or when the dialog is no longer dirty).
- **Actual**: `saveError` only clears at the start of a save attempt or on dialog reopen; with Save disabled there is no way to dismiss it — footer shows an error for a now-valid draft.
- **Suspected**: `apps/web/src/components/chat/group/GroupSettingsDialog.tsx:344–348` — `setSaveError` not cleared on draft/`dirty` change.
- **Screenshot**: `j3-02-invalid-remote-rejected.png` (error state; identical text persisted after clearing).

## Notes / non-issues

- Coordinator first turn errors "Codex CLI is not installed" — environment limitation (no provider CLIs); the server-synthesized greeting + chips still render. Not a config failure.
- Save button is intentionally disabled in edit mode when `!dirty` (`GroupSettingsDialog.tsx:359`) — explains the apparently "dead" Save clicks during BUG-2 verification.
- Near-duplicate names dedupe cleanly: `Frontend!` → `frontend-2/` workspace dir; no merge, no error.
- "bounces off group threads" (J1): group threads stay open when the section is hidden — designed (repo browser test). Only `/groups` index + switcher entry are gated.

## Untested

- Real model/coordinator turns (no provider CLIs on PATH; `Pi` offered but no models).
- Coordinator/Thread effort pickers — "Not available for gpt-5-codex" in this env.
- Memory note submission, tasks, automations (out of J1–J3 scope).
