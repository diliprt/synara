# Acceptance test report — batch C (J6 Library, J7 Overview tabs)

- **Branch tested:** `synara/build-project-coordinator-on-main` @ `1bfe0a3f85662dac9aa5ec21dc73433bebca452f`
- **Date:** 2026-09-23
- **Tester note:** no provider CLI installed — model-dependent steps skipped.
- **Environment:** macOS, `bun dev` with `SYNARA_HOME=/var/folders/2j/fwfzfr5x639f8rbmqc9t9ym40000gn/T/synara-acceptance.RZZwC7xWx7`, `SYNARA_NO_BROWSER=1`, `SYNARA_PORT_OFFSET=4703` → web `http://localhost:10436`, server `127.0.0.1:8476`. Driven in real Chrome via clicks/typing.
- **Setup:** fixture projects "web-app" + "api" registered via UI; group "QA Group" created entirely via the real UI (name + icon + onboarding → "Create group") — group creation does NOT launch a model, and the coordinator thread opens with a graceful "Codex CLI is not installed" banner. "web-app" linked to the group (link applied immediately).
- **Setup deviation:** J7's test thread was created via the allowed RPC fallback (`thread.create` through `wsNativeApi` from a playwright-driven page) because no UI affordance to create a second group thread was found in the coordinator-thread header (the "+" New-chat menu is not rendered for the group container's coordinator view; only pin/edit actions exist on rows).
- **Screenshots:** `acceptance/shots/batch-c/` (`screencapture -x`, downscaled to 1400px, palette-quantized PNG ~500 KB each).

## J6 — Library

| Step | Action | Expected | Actual | Screenshot | Result |
|------|--------|----------|--------|------------|--------|
| J6-01 | Open Library via header folder toggle | Panel "Library" + seeded "Artifacts" folder | Panel opened; Artifacts row + `.gitkeep`-style seeding intact | j6-01-library-open-artifacts.png | PASS |
| J6-02 | "+ Add" → file dialog → pick acceptance-image.png | PNG row appears in root | acceptance-image.png 159 B listed | j6-02-upload-png.png | PASS |
| J6-03 | "+ Add" → pick acceptance-note.md | md row listed | acceptance-note.md 94 B listed | j6-03-upload-md.png | PASS |
| J6-04 | Click NAME then DATE MODIFIED headers | Sort indicator + reorder | Both headers toggle asc/desc and reorder correctly; folders pinned first | j6-04a-sort-name-desc.png, j6-04b-sort-date.png | PASS |
| J6-05 | Type filter → Images / Documents / Code / All | Only matching types shown | Images → PNG only; Documents → md only; Code → "No files match"; All restores | j6-05a-filter-images.png, j6-05b-filter-documents.png | PASS |
| J6-06 | Search "png", then clear | Filtered rows / restored | Only PNG row; clearing restores all | j6-06-search-png.png | PASS |
| J6-07 | Click md row → preview; Back | Rendered markdown; returns to list | Preview rendered heading+list; **only the ← arrow navigates back — clicking the filename text does nothing** | j6-07-preview-md.png | PASS (minor UX note) |
| J6-08 | Right-click PNG → Rename → renamed-image.png | Row renamed + re-sorted | Rename applied; row re-sorted | j6-08-renamed.png | PASS |
| J6-09 | Right-click md → Delete → confirm | `Delete file "acceptance-note.md"?` prompt; file removed | Prompt text matched spec ("It can be restored from History."); file removed | j6-09a-delete-prompt.png, j6-09b-deleted.png | PASS |
| J6-10 | History icon | Commit list | 5 commits: Initialize library, Add ×2, Rename…, Delete… — each with sha + relative time; Delete commit shows Restore | j6-10-history.png | PASS |
| J6-11 | Click "Restore" on "Delete acceptance-note.md" | File restored | **FAIL — error banner: `Git command failed in library:restore: git checkout 99ef20d… Commit "99ef20d…" did not change "acceptance-note.md".`** File not restored. See Bug Report B1. | j6-11-restore-error.png | **FAIL** |
| J6-12 | External on-disk write → observe → blur+refocus | (a) thread tool adds file — SKIP no provider; (b) document actual refresh behavior | `external-file.txt` written to library dir NOT visible initially; appeared after window refocus (documented focus-refresh; no fs watch) | j6-12a-external-not-visible.png, j6-12b-external-visible-after-refocus.png | PASS (behavior documented); tool-add part SKIP |
| J6-13 | Settings → Git remote `https://unreachable.invalid/x.git` + Push on change → re-upload md | Write stays fast; redacted push error surfaced | Upload completed instantly; "Push failed" pill appeared; tooltip shows `Could not resolve host: unreachable.invalid` (failCount 1 in `.git/synara-push-status.json`). URL shown verbatim — no credentials to redact. | j6-13a-push-failed.png, j6-13b-push-error-tooltip.png | PASS |

## J7 — Overview tabs

| Step | Action | Expected | Actual | Screenshot | Result |
|------|--------|----------|--------|------------|--------|
| J7-01 | Open Group panel | Tabs Threads / Pull requests / Automations | All three tabs visible; Threads default with empty state | j7-01-tabs.png | PASS |
| J7-02 | Pull requests tab | Empty state (no model → no PRs) | "No pull requests yet. PRs opened by group threads land here." | j7-02-prs-empty.png | PASS |
| J7-03 | Automations tab | Heartbeat automation without a model | "QA Group Coordinator events" row — "Project events · Never run" + enabled switch | j7-03-automation.png | PASS |
| J7-04 | Create a group thread | Thread row in Threads tab | "test thread" created via allowed RPC fallback (UI affordance absent — see setup deviation); row under "Idle" section | j7-04-thread-idle.png | PASS (fixture) |
| J7-05 | Right-click row → "Mark resolved" | Row moves to Resolved | Row left Idle; "Resolved" section (count 1) holds it | j7-05-resolved.png | PASS |
| J7-06 | Resolved → right-click → "Reopen" | Row returns to Idle | Row back under "Idle"; Resolved section removed | j7-06-reopen-idle.png | PASS |

## Bug Reports

### B1 — Library History "Restore" of a deleted file fails whenever any unrelated commit follows the delete (FAIL)

- **Steps:** Upload a file → delete it (with another commit between the file's own history and HEAD — here a *rename of a different file*) → Library panel → History (library scope) → click "Restore" on the `Delete <name>` commit.
- **Expected:** File restored to its pre-delete content.
- **Actual:** Error banner: `Git command failed in library:restore: git checkout 99ef20d6cef… (…/library) — Commit "99ef20d…" did not change "acceptance-note.md".` Nothing restored.
- **Screenshot:** j6-11-restore-error.png
- **Root cause (high confidence):**
  - Frontend `apps/web/src/components/chat/group/LibraryPanel.tsx:498-501` — for library-scope history it sets `restoreSha = shaBeforeDelete = historyCommits[index + 1]?.sha`, i.e. the *next commit in the whole repo log* (any path), which is the correct "state just before the delete" target.
  - Backend `apps/server/src/projectAgent/libraryGit.ts:245-283` (`resolveLibraryPathAtCommit`, used at :323) walks `git log --follow --name-status -- <path>` — i.e. only commits that *changed that path* — and returns `current` solely on exact sha equality. A repo commit that never touched the path (like `99ef20d`, a rename of a different file) can never match → `null` → the "did not change" `GitCommandError` at :324-330.
  - Fix direction: resolve "does the path exist at sha / what was its name at sha" for an arbitrary ancestor sha (e.g. `git ls-tree <sha> -- <path>` / `cat-file -e`), not only for path-changing commits — or have the UI pass the pre-delete commit that is guaranteed in the path's history.

### Minor observations (not FAILs)

- **B2 (UX):** In the file preview breadcrumb `← acceptance-note.md`, only the arrow is a button — clicking the filename text does nothing (expected it to also navigate back).
- **B3 (UX):** During group onboarding, "Add repository" linked the project silently — the "Linked repositories" list still showed "No linked repositories." until the group was created; the link did apply (visible in settings afterwards).
- **B4 (note):** The "Push failed" tooltip shows the remote URL verbatim. `redactRemoteUrlsInText` presumably strips credentials only; our test URL had none, so this is probably working as intended — worth confirming expected redaction scope.

## Skipped / untested (no provider CLI)

- **J6-12 (partial):** A thread adding a file to the Library via its tool and it appearing without reload — needs a real model turn. Partially covered by the external-write + refocus check (documented behavior).
- **J7-03 (partial):** A *coordinator-created* automation from "check the api tests every morning" — needs a model turn. The built-in heartbeat automation was verified instead.
- **J7-02 (partial):** A thread actually opening a PR and it listing in Pull requests — needs a model turn (and git hosting). Empty state verified.
- Any coordinator/member-thread conversational behavior (group chat send would error immediately without a provider).

## Totals

- **PASS:** 17 · **FAIL:** 1 (J6-11 / Bug B1) · **SKIP:** 3 partial model-dependent items
