# Synara UI acceptance — batch b (J4 Coordinator work + J5 Standing context)

- **Tested SHA:** `1bfe0a3f85662dac9aa5ec21dc73433bebca452f` (branch `synara/build-project-coordinator-on-main`)
- **Environment:** web `http://localhost:10435`, server `ws://localhost:8475`, `SYNARA_HOME=/var/folders/2j/fwfzfr5x639f8rbmqc9t9ym40000gn/T/tmp.onlolDHPYS`, Chrome via CDP :29229. Real UI driven by click/type/screenshot; wsNativeApi used ONLY for fixtures (thread state, MEMORY.md line) and diagnostics.
- **Provider status — NO WORKING PROVIDER.** Pi CLI is detected as "Connected" but has zero credentials (`~/.pi/agent/auth.json` is `{}`); every model picker shows fallback `codex / gpt-5-codex` and expanding Pi shows "No Pi models found". Real turns fail: coordinator send → "Codex CLI (codex) is not installed or not on PATH." toast; thread turn → inline "Provider turn start failed (pi): No API key for azure-openai-responses/gpt-6-astra". All model-dependent steps were still executed in the UI and the actual error behavior recorded (marked BLOCKED). Server-side digest generation also fails loudly: `generationState: "failed"`, `lastError: "Codex CLI (codex) is required but not available."`
- **Fixtures:** `/Users/devin/synara-acceptance-fixtures/{web-app,api}` — registered through the real UI during onboarding (typed-path input). Group "Ops group" created via real UI (project id `38448b8c-d6cb-4832-9dd3-9ec4beb81928`, workspace `~/Documents/Synara/Groups/ops-group`).

## J4 — Coordinator work

| # | Action | Expected | Actual | Screenshot | Result |
|---|--------|----------|--------|------------|--------|
| J4.1 | "New group" → name "Ops group" → onboarding dialog (icon 🦉, goal text, coordinator Brain+Rose, model pickers) | Onboarding dialog w/ all fields; model pickers show usable state | Dialog opened with General/Memory/Environment/Plugins. Fields accept input. Model pickers show fallback `GPT-5 Codex`; provider list offers only "Pi" (+ "Add Providers") and expanding it shows "No Pi models found" — nothing selectable | j4-01, j4-02, j4-03 | PASS (model picker honest about no providers) |
| J4.2 | Environment → "Add repository" → pick web-app | web-app appears in "Linked repositories" | Row clicked, picker closed, but section still shows "No linked repositories." and web-app stays in the picker. **Link DOES persist server-side** (verified: `config.linkedProjectIds=[web-app]` + activity "Linked repository web-app" after create) — UI just can't show links pre-configure | ss_4f020388, ss_a5ba63b2 | FAIL (silent no-op UX; see bug 1) |
| J4.3 | "Create group" | Dialog closes; group + coordinator in sidebar; chat opens | Sidebar shows "Ops group" + "Ops group Coordinator"; coordinator chat opened with canned welcome + "Codex provider status" banner | j4-04 | PASS |
| J4.4 | Send "Fix the failing test in web-app and write a short summary of the api README" | (w/ provider) two threads start as links | Send blocked: toast "Codex CLI (`codex`) is not installed or not on PATH."; draft preserved in composer; no transcript row | j4-05 | BLOCKED (provider); error UX correct |
| J4.5 | Overview → Threads tab buckets | "Waiting on you / Working / Ready for review / Idle / Resolved", no "Landing" | Empty state first ("No threads yet…"), then after fixtures: Waiting(1), Ready for review(1) w/ #42 badge, Idle(2), Resolved(1, collapsed). No "Landing". Empty "Working" section is hidden | j4-06, j4-07, j4-08 | PASS (fixture-driven) |
| J4.6 | Fixture bucketing (thread.create + real turn.start→error, lastKnownPr, archive; refreshDigest) | Each state lands in correct bucket | error session → Waiting; open PR → Ready for review; bare → Idle; archived → Resolved. Later re-check: real pi-error on the "idle" thread re-bucketed it to Waiting (2) live. "Working" not verifiable — no way to fixture a running session without a provider | j4-07, j4-08, j4-10 | PASS (fixture-driven; Working untested) |
| J4.7 | "Waiting on you" dot on Group button + sidebar row | Amber needs-attention dot on both | Sidebar group row shows dot + "A thread needs you"; header group-panel button gains `aria-label="…needs attention"`; waiting thread row dotted | j4-07, j4-10 | PASS (fixture-derived) |
| J4.8 | Follow-up "also add a test for X" routes to existing thread | (w/ provider) same thread, no new one | Send blocked by provider; draft kept; no new thread spawned | j4-09 | BLOCKED (provider) |
| J4.9 | Sidebar member-thread rows navigate | Click opens thread | Clicks/Enter on fixture rows did NOT navigate; Overview-panel rows DO navigate (clicked working row → /ec11156a…). Rows also lack aria-labels | ss_b444047c | MINOR (see notes) |

## J5 — Standing context

| # | Action | Expected | Actual | Screenshot | Result |
|---|--------|----------|--------|------------|--------|
| J5.1 | Settings → Memory → instructions "Always branch from main" → blur | Autosaves; persists on reopen; file on disk | Textarea saved on blur; reopened dialog still shows it (39/16,000); `$SYNARA_HOME/dev/project-context/<groupId>/instructions.md` contains "# Instructions\n\nAlways branch from main" | j5-01, j5-02 | PASS |
| J5.2 | Coordinator chat: "remember releases go out on Tuesdays" | synara_project_remember writes memory/<date>-*.md + MEMORY.md line | Send blocked by provider (draft kept) — no remember turn ran | j5-03 | BLOCKED (provider) |
| J5.3 | UI "Add a memory note": "Releases go out on Tuesdays" (no model needed) | Appears in Memory files; mirrored on disk | Saved → listed as `notes/2026-09-23-11-46-29-517-releases-go-out-on-tuesdays.md`; View shows content; file exists at `project-context/<group>/memory/notes/…` | j5-04, j5-05 | PASS |
| J5.4 | Fixture: mimic remember (write memory/<date>-*.md + MEMORY.md line) | Note + index visible in Settings | `memory/<date>-*.md` write REJECTED — "This principal cannot write that memory document." (correct: that path is remember-tool-only, `canWriteMemoryDocument` returns false for all principals). MEMORY.md write via writeDocument SUCCEEDED → View renders "- Releases go out on Tuesdays — see note"; disk mirror updated | j5-06 | PASS (fixture-driven; restriction is correct behavior) |
| J5.5 | New group thread: "what are this group's rules?" | (w/ provider) answer cites instructions + memory | Message posted; turn attempted on **pi / GPT-6 Astra** (app default, NOT group's configured codex/gpt-5-codex thread model — see bug 2) → inline "Provider turn start failed (pi): No API key for azure-openai-responses/gpt-6-astra" + error toast | j5-07 | BLOCKED (provider); error UX correct |

## Bug reports

### Bug 1 — Onboarding "Add repository" silently no-ops in the UI
- **Steps:** New group → onboarding dialog → Environment → "Add repository" → click a project.
- **Expected:** project appears under "Linked repositories".
- **Actual:** picker closes; section still says "No linked repositories." and the project remains pickable. The `projectAgent.linkProject` RPC does succeed and persists (`project_agent_linked_projects` row; post-configure `config.linkedProjectIds` contains it), but the section reads `props.agent.overview?.config?.linkedProjectIds` which is `null` while the group is unconfigured, so the UI can never show the link during onboarding.
- **Screenshot:** j4-02/j4-03 area (Environment section) — ss_4f020388/ss_a5ba63b2 captures.
- **Suspected location:** `apps/web/src/components/chat/group/GroupEnvironmentSection.tsx:45` (`overview?.config?.linkedProjectIds` — nothing to read pre-configure); server side `apps/server/src/projectAgent/Layers/ProjectAgentService.ts:1427-1436` notes links are project-level and succeed pre-configure, but `buildOverview` only exposes them inside `config`. Fix direction: expose `linkedProjectIds` at the overview level (independent of config) or disable link controls until configured.

### Bug 2 — User-started thread in a group ignores the group's "Thread model" config
- **Steps:** Onboarding sets Thread model = codex/gpt-5-codex (fallback). Open a new thread in the group; composer model chip shows **GPT-6 Astra (pi)** — the app-level default — and the turn start goes to pi, failing on its missing API key.
- **Expected:** group member threads use the configured workerRouting model (codex/gpt-5-codex).
- **Actual:** pi/gpt-6-astra.
- **Confidence:** medium — may be intentional that user-driven threads follow the app default; coordinator-created threads would use workerRouting. Flagging since onboarding explicitly configures a thread model.
- **Screenshot:** j5-07 (composer chip "GPT-6 Astra", error mentions pi).
- **Suspected location:** composer model defaulting — `apps/web/src` composer/`useModelSelection` path picks app default rather than `agent.overview.config.workerRouting.modelSelection` for group-project threads.

### Minor — Groups sidebar member rows don't navigate for index threads
- `<div tabindex="0">` rows without aria-label under the group don't open the thread on click/Enter; the Overview panel rows DO navigate (verified → /ec11156a…). Possibly fixture-specific (threads lacking sessions), but the rows look interactive and aren't labeled.

## Other observations
- Coordinator welcome message, Suggestions chips ("Connect repositories / Add a goal / Write instructions"), "Context" collapsible with editable instructions.md + coordinator playbook all render without a provider.
- `refreshDigest` surfaced `generationState: "failed"`, `lastError: "Codex CLI (codex) is required but not available."` — digest generation needs the coordinator model too; error is recorded server-side, Focus falls back to "Coordinator is ready."
- Memory write permissions verified server-side: `memory/MEMORY.md` user-writable; `memory/notes/*` user-only; `memory/<date>-*.md` (remember shape) writeable only by the coordinator's synara_project_remember tool.
- Groups workspace root is `~/Documents/Synara/Groups/<slug>` (real OS home, not SYNARA_HOME); context docs mirror under `$SYNARA_HOME/dev/project-context/<groupId>/`.
