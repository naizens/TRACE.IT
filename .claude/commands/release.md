Perform a full TRACE.IT release. The new version number is: $ARGUMENTS

Follow these steps exactly:

## 1. Determine the new version

**If $ARGUMENTS is provided** (e.g. `/release 0.2.0`), use that as the new version.

**If no argument was given:**
1. Read the current version from `package.json` (format: `MAJOR.MINOR.PATCH`).
2. Run `git diff --stat` to see which files are modified.
3. Inspect the diffs to determine the nature of the changes:
   - If **any** change introduces a new user-visible feature (`feat`) → bump **MINOR**, reset PATCH to 0 (e.g. `0.1.3` → `0.2.0`)
   - If all changes are only bug fixes, performance improvements, or refactors (no new features) → bump **PATCH** only (e.g. `0.2.0` → `0.2.1`)
4. Use the computed version going forward.

## 2. Read current state
- Read `package.json` to confirm the current version.
- Read `src/renderer/src/components/layout/TitleBar.tsx` to find the hardcoded version badge.
- Read `src/renderer/src/components/ui/ChangelogModal.tsx` to see the existing changelog entries.
- Run `git status` to see what files are modified and `git log --oneline -5` to review recent commits.

## 3. Summarise changes for the changelog
Look at all uncommitted modified files (from `git diff --stat` and `git diff`). Based on the actual diffs, write concise changelog entries describing what changed from the user's perspective. Use these types:
- `feat` — new user-visible feature
- `perf` — performance improvement
- `fix` — bug fix
- `refactor` — internal improvement / polish (no new feature)

## 4. Update the 3 required files

### package.json
Change `"version"` to the new version string.

### TitleBar.tsx
Find the hardcoded version text (e.g. `v0.1.0`) inside the changelog button and update it to the new version.

### ChangelogModal.tsx
Prepend a new entry to the top of the `CHANGELOG` array:
```ts
{
  version: 'X.Y.Z',
  date: 'YYYY-MM-DD',   // use today's date
  changes: [
    { type: '...', text: '...' },
  ],
},
```

## 5. Commit, tag, and push

### Commit 1..N — granular changes (one commit per concern)
Look at the full diff of all modified files **except** the 3 version-bump files (`package.json`, `TitleBar.tsx`, `ChangelogModal.tsx`). Group them by logical concern and create one commit per group. Examples of good groupings:
- UI / styling changes → `style: ...`
- New feature files/logic → `feat: ...`
- Bug fixes → `fix: ...`
- Performance improvements → `perf: ...`
- Refactoring / internal cleanup → `refactor: ...`
- Docs / comments → `docs: ...`

For each group:
```bash
git add <files belonging to this concern>
git commit -m "<type>: <short description>"
```

If files span multiple concerns, split them by type. Only skip this step entirely if there are no non-version files to commit.

### Last commit — version bump
After all feature/fix commits, stage only the 3 version files:
```bash
git add package.json src/renderer/src/components/layout/TitleBar.tsx src/renderer/src/components/ui/ChangelogModal.tsx
git commit -m "chore: bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

Do not push to any other remote or branch. Do not use `--force`.
