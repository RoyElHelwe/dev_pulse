# Git Cheat Sheet — When to Do It and What If It Fails

Five moments in every feature. For each one: when you do it, the commands, and how to fix the common problems.

Before any command, you can always check where you are with:

```powershell
git status
git branch
```

---

## 1. START A FEATURE

**When:** every time you begin a new feature (new page, new route, new fix). Never work directly on `main`.

```powershell
git checkout main
git pull
git checkout -b mira/feature-name
```

**If a problem happens**

| Message | What it means | What to do |
| --- | --- | --- |
| `Your local changes would be overwritten by checkout` | You have unsaved changes on your current branch | Save them first: `git add .` → `git commit -m "wip"`. Then try again. |
| `fatal: a branch named 'mira/feature-name' already exists` | You already created this branch | Go to it without `-b`: `git checkout mira/feature-name`. Or pick a new name. |
| `Your branch and 'origin/main' have diverged` (on `git pull`) | You committed on `main` by mistake | See **Problem: I committed on main** at the end. |
| `There is no tracking information for the current branch` | Your `main` isn't linked to GitHub | `git branch --set-upstream-to=origin/main main`, then `git pull` again. |

---

## 2. SAVE MY WORK

**When:** as often as you want. Good moments: after finishing a small part (a form, a route), before a break, and **at the end of every day**. Your work is then safe on GitHub, even if your computer breaks.

```powershell
git add .
git commit -m "what I did"
git push
```

First push of a new branch:

```powershell
git push -u origin mira/feature-name
```

**If a problem happens**

| Message | What it means | What to do |
| --- | --- | --- |
| `.env` appears in `git status` | Git is about to save your secrets | Don't commit. Add `.env` to `.gitignore`. If it was already committed: `git rm --cached .env` then commit. |
| `nothing to commit, working tree clean` | No changes to save | Check you saved the file in VS Code (`Ctrl + S`). |
| `Author identity unknown` | Git doesn't know your name | `git config --global user.name "Your Name"` and `git config --global user.email "you@example.com"`. |
| `The current branch has no upstream branch` | First push of this branch | `git push -u origin mira/feature-name` |
| `Updates were rejected ... fetch first` | GitHub has commits you don't have on this branch | `git pull`, then `git push` again. |
| A login window or `Authentication failed` | GitHub needs you to sign in | Sign in in the window that opens. If it fails, sign in to GitHub in the browser and try again. |

---

## 3. EVERY MORNING / GET MY TEAMMATE'S MERGED CODE

**When:**
- every morning before you start working
- whenever your teammate says "I merged something into main"
- right before you open a pull request

First **save your work** (step 2), then:

```powershell
git checkout main
git pull
git checkout mira/feature-name
git merge main
```

Test the app after merging. Your teammate's code might change something you use.

**If a problem happens**

| Message | What it means | What to do |
| --- | --- | --- |
| `CONFLICT (content): Merge conflict in ...` | You and your teammate changed the same lines | See **Fixing a conflict** below. |
| A strange screen opens (Vim) asking for a message | Git wants a message for the merge | Type `:wq` and press Enter. To use VS Code instead from now on: `git config --global core.editor "code --wait"` |
| `Already up to date` | Nothing new in `main` | Nothing to do. Continue working. |
| You want to cancel the merge | You're lost in the middle of a conflict | `git merge --abort` puts everything back like before the merge. |

### Fixing a conflict

1. Open the file in VS Code. You'll see **Current Change** (yours) and **Incoming Change** (from `main`).
2. Click one:
   - **Accept Current Change** → keep yours
   - **Accept Incoming Change** → keep `main`'s
   - **Accept Both Changes** → keep both (often right when you each added different things)
3. Check the code makes sense, save, and test the app.
4. Finish the merge:

```powershell
git add .
git commit -m "merge main into feature-name"
git push
```

Not sure which to keep? Ask your teammate before choosing.

---

## 4. FEATURE 100% DONE

**When:** the **whole** feature works (page + backend + database), you tested the error cases, the app starts with no errors, and the console is clean. If only part is done, keep saving (step 2) and wait.

1. Merge `main` into your branch (step 3) and test again.
2. Push: `git push`
3. On GitHub: **Compare & pull request** → title + description + choose your teammate as reviewer → **Create pull request**.
4. Tell your teammate it's ready.
5. If they ask for changes: fix, then `git add .` → `git commit -m "fix ..."` → `git push`. The pull request updates by itself.
6. After approval: **Merge pull request** → **Confirm merge** → **Delete branch**.

**If a problem happens**

| Message | What it means | What to do |
| --- | --- | --- |
| No **Compare & pull request** button | You didn't push, or the banner expired | Check you pushed. Otherwise: **Pull requests → New pull request**, `base: main`, `compare: mira/feature-name`. |
| `This branch has conflicts that must be resolved` | `main` changed since you last merged it | Do step 3 on your computer, fix the conflict, push. The pull request updates. |
| The **Merge** button is gray | Approval is required and missing | Wait for your teammate to approve. |
| You see files you didn't mean to change | You changed something by accident | Restore it on your branch: `git checkout main -- path/to/file`, then commit and push. |

---

## 5. AFTER THE MERGE

**When:** right after your pull request is merged on GitHub.

```powershell
git checkout main
git pull
git branch -d mira/feature-name
```

Then tell your teammate: "My feature is merged into main." And start the next one:

```powershell
git checkout -b mira/next-feature
```

**If a problem happens**

| Message | What it means | What to do |
| --- | --- | --- |
| `error: the branch 'mira/feature-name' is not fully merged` | Git isn't sure the branch was merged | Check on GitHub that the pull request says **Merged**. If yes: `git branch -D mira/feature-name` (capital D). If not: don't delete it. |
| `error: Cannot delete branch ... checked out` | You're still on that branch | `git checkout main` first. |
| Your teammate's branch now has conflicts | Your merge changed files they use | They do step 3 on their branch. |

---

## Problem: I committed on main by mistake

You worked and committed on `main` instead of a branch, and haven't pushed.

```powershell
git branch mira/rescue
git checkout main
git reset --hard origin/main
git checkout mira/rescue
```

1. The first line creates a branch that keeps your commits.
2. The next two put `main` back exactly like GitHub's.
3. The last one takes you to your rescued work. Continue there normally.

Only do this if you haven't pushed `main`. If you're unsure, ask first.

## Problem: I worked on main but didn't commit yet

Easy. Just create a branch now; your changes move with you:

```powershell
git checkout -b mira/feature-name
```

## Problem: I want to throw away changes to one file

Only for changes not committed yet:

```powershell
git restore path/to/file
```

## Never do these without asking your teammate

- `git push --force`
- `git reset --hard` (except the rescue above)
- Pushing directly to `main`
- Deleting someone else's branch

When something looks wrong: **stop, don't force anything**, copy the command you ran and the full message, and ask.


## Cheat sheet
 
```
START A FEATURE
git checkout main
git pull
git checkout -b mira/feature-name
 
SAVE MY WORK (as often as I want)
git add .
git commit -m "what I did"
git push                      (first time: git push -u origin mira/feature-name)
 
then to put it into main:
1.Get the latest main into your branch
git checkout main
git pull
git checkout mira/page-a
git merge main
git push

2.Open a pull request on GitHub
Go to your repo. Click the yellow Compare & pull request button.
Check at the top: base: main ← compare: mira/page-a.
Write a title (Add page A) and a short description of what you did and how to test it.
On the right, under Reviewers, choose your teammate.
Click Create pull request.

3. Your teammate reviews
They check the code and click Approve, or ask for changes

4. Merge
After approval, on the pull request page:
Click Merge pull request → Confirm merge
Click Delete branch

Now your page is in main

EVERY MORNING / GET MY TEAMMATE'S MERGED CODE
git checkout main
git pull
git checkout mira/feature-name
git merge main
 
FEATURE 100% DONE
merge main into my branch → test → push
→ pull request on GitHub → teammate reviews → fix comments
→ Merge pull request → Delete branch
 
AFTER THE MERGE
git checkout main
git pull
git branch -d mira/feature-name
tell my teammate
git checkout -b mira/next-feature
```