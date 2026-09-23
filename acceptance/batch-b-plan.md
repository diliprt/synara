# Synara UI acceptance — batch b test plan (J4 + J5 only)

SHA under test: `1bfe0a3f8` (record actual `git rev-parse HEAD` at test time).
Environment: web http://localhost:10435, server ws://localhost:8475,
SYNARA_HOME=/var/folders/2j/fwfzfr5x639f8rbmqc9t9ym40000gn/T/tmp.onlolDHPYS,
Chrome CDP :29229. **No model provider is installed/signed in** — coordinator/model
turns cannot run; those steps are executed in the UI anyway and the actual error/
blocked behaviour is recorded (BLOCKED unless the app itself misbehaves → FAIL).

Fixture repos (already created, plain git repos with README + package.json + one
failing node:test):
- /Users/devin/synara-acceptance-fixtures/web-app  (test/greeting.test.js fails)
- /Users/devin/synara-acceptance-fixtures/api      (test/sum.test.js fails)

Screenshots → /Users/devin/repos/synara/acceptance/shots/batch-b/ (j4-NN-*, j5-NN-*, j0-NN-*).

Code anchors: GroupSettingsDialog mode="onboarding" (apps/web/src/components/chat/group/GroupSettingsDialog.tsx);
link repo = Environment section → "Add repository" (GroupLinkProjectDialog);
Overview = GroupOverview tabs (Threads/PRs/Automations) in ProjectPanel;
buckets = resolveGroupThreadState (packages/shared/src/groupThreadState.ts):
waiting = hasPendingApprovals/hasPendingUserInput OR errored session/turn;
working = session running/connecting/starting or live turn; review = open non-draft PR;
resolved = archived/task done/closed PR; idle = default.
Memory: api.projectAgent.writeDocument/listDocuments; UI note input writes
memory/notes/<ts>-<slug>.md (NO model needed); coordinator remember writes
memory/<date>-<slug>.md + MEMORY.md line; disk mirror = $SYNARA_HOME/dev/project-context/<projectId>/;
groupsWorkspaceRoot = ~/Documents/Synara/Groups (OS home, not SYNARA_HOME).
Sanctioned fixture path: in-page `await import('/src/wsNativeApi.ts')` → createWsNativeApi()
→ api.orchestration.dispatchCommand({type:'thread.create'| 'thread.session.set'| 'thread.archive'})
and api.projectAgent.writeDocument — fixtures only; everything user-reachable is done in the UI.

## Step 0 — preconditions (fixtures)
- 0.1 Register web-app and api as projects through the real UI (Add project → type
  local path → create). If UI can't register paths, use wsNativeApi project.create
  and note it. PASS: both appear in sidebar project list.
- 0.2 Screenshot provider state at UI level (Settings → Providers or onboarding
  pickers) — record what is offered with zero sign-ins.

## J4 — Coordinator work
- J4.1 Switch sidebar surface → Groups; click "New group"; RenameDialog: name "Ops group" → Create.
  PASS: GroupSettingsDialog opens titled "Set up your group" with sections General/Memory/Environment/Plugins.
- J4.2 General: set icon (emoji), goal text, coordinator icon + color.
  PASS: fields accept input; screenshot model pickers — record exactly what
  providers/models show with no signed-in provider (expected: fallback codex/gpt-5-codex
  or provider list w/ not-signed-in state).
- J4.3 Environment → "Add repository" → pick "web-app" → linked repo listed.
  PASS: web-app appears in linked list (also link api if possible — try both).
- J4.4 Click "Create group". PASS: dialog closes, group row + coordinator row appear
  in Groups sidebar; no error toast.
- J4.5 Open coordinator chat; send "Fix the failing test in web-app and write a
  short summary of the api README". Expected w/ provider: two threads start as links.
  Actual w/o provider: record observed behaviour — expect some error/queued state.
  PASS criteria: an explicit error/blocked state is surfaced; FAIL if silent no-op.
- J4.6 Open the Group/Overview panel (header "Group" button) → Threads tab.
  PASS: renders with sections "Waiting on you", "Working", "Ready for review",
  "Idle", "Resolved"; NO "Landing" bucket.
- J4.7 (FIXTURE) Via wsNativeApi create threads in the group project in states:
  error session → "Waiting on you"; running session → "Working"; plain → "Idle";
  (attempt open-PR via lastKnownPr → "Ready for review"; archived → "Resolved").
  PASS: each lands in the right bucket in the Overview. Marked fixture-driven.
- J4.8 (FIXTURE-derived) With a "waiting" thread present: PASS if amber dot shows
  on the group sidebar row AND on the Group header button (needs-attention).
- J4.9 Send follow-up "also add a test for X" in coordinator chat.
  Expected w/ provider: routes to existing web-app thread, no new thread.
  Actual: record observed behaviour (BLOCKED — needs coordinator turn).

## J5 — Standing context
- J5.1 Group Settings → Memory → instructions textarea: "Always branch from main"
  → blur. Reopen settings. PASS: persists in UI; "Applies immediately" hint;
  instructions.md exists under $SYNARA_HOME/dev/project-context/<groupId>/ with
  the text (verify via shell).
- J5.2 In coordinator chat send "remember releases go out on Tuesdays".
  Expected w/ provider: synara_project_remember writes memory/<date>-*.md + MEMORY.md.
  Actual: record observed (BLOCKED — needs model turn).
- J5.3 (UI path, no model) Settings → Memory → "Add a memory note" input:
  "Releases go out on Tuesdays" → save. PASS: appears in "Memory files" list;
  View shows content; mirror file exists on disk under project-context/<groupId>/memory/.
- J5.4 (FIXTURE) Mimic synara_project_remember: via wsNativeApi writeDocument write
  memory/<today>-releases-go-out-on-tuesdays.md and MEMORY.md containing the line.
  Reopen Memory section. PASS: note appears in "Memory files"; MEMORY.md View shows
  the line. Marked fixture-driven.
- J5.5 In a NEW group chat/thread ask "what are this group's rules?".
  Expected w/ provider: answer cites "Always branch from main" + Tuesday releases.
  Actual: record observed (BLOCKED — needs model turn).

## Evidence rules
- Screenshot at every step (full window, named per convention).
- Every step marked PASS / FAIL / BLOCKED / untested; FAILs get a bug note with
  suspected file:line.
- Fixture-driven rows are explicitly labelled in batch-b.md.
