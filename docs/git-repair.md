# Git repair (Windows worktree path break)

## Symptom

Running `git status` fails with an error similar to:

```
fatal: not a git repository: .../.git/worktrees/<worktree-name>
```

In this project it looked like:

```
fatal: not a git repository: C:/Users/TheoSoungWin10/Desktop/MLA+/.git/worktrees/MLA+-blackbox-fix
```

## Why it happens

This folder was created as a **Git worktree**. In a worktree checkout, `.git` is usually a small *text file* that points at the main repository’s gitdir, for example:

```
gitdir: C:/path/to/main-repo/.git/worktrees/<worktree-name>
```

If the main repo folder is renamed/moved/deleted, the pointer becomes invalid and Git commands stop working in the worktree.

> The `+` in the folder name is not the issue — the missing/changed main-repo path is.

## Fix option A (quick): detach and re-init (loses old history)

Use this when you only need Git working again in this folder and you **don’t have the original main repo** anymore.

```powershell
Set-Location 'C:\Users\TheoSoungWin10\Desktop\MLA+-blackbox-fix'

# Backup the broken pointer file
Rename-Item -LiteralPath .git -NewName '.git.broken-worktree' -Force

# Create a fresh .git directory here
git init
```

After that:

```powershell
git status
```

should work normally.

## Fix option B (preferred): restore worktree linkage (keeps history)

Use this if you still have the original main repository (the one that contains the real `.git` directory).

1. Find the main repo that contains:
   - `.git\worktrees\MLA+-blackbox-fix\`
2. Update the `.git` *file* inside this folder to point to the correct gitdir (the new location of the main repo).
3. From the main repo, run:

```powershell
git worktree repair
```

If the main repo is gone, use Fix option A.

