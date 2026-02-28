Perform a full TRACE.IT release. The new version number is: $ARGUMENTS

Follow these steps exactly:

## 1. Determine the new version
If $ARGUMENTS is provided (e.g. `/release 0.0.9`), use that as the new version.
If no argument was given, read the current version from `package.json` and increment the patch number by 1.

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
Find the hardcoded `v0.0.X` text inside the changelog button and update it to the new version.

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
Stage all modified files (the 3 required ones plus any other uncommitted changes), then:
```bash
git add <all modified files>
git commit -m "feat: <short summary of changes> and bump version to X.Y.Z"
git tag vX.Y.Z
git push origin main
git push origin vX.Y.Z
```

Do not push to any other remote or branch. Do not use `--force`.
