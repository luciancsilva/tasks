# Git Review & Upstream Synchronization

## Purpose

Evaluate and selectively integrate changes from the upstream repository into the current fork while preserving all fork-specific customizations.

Act as the repository maintainer. Complete every safe action autonomously. Only stop and request human input if an action is destructive, irreversible, or genuinely ambiguous.

---

## Repository Discovery

* Detect the current Git repository.
* Detect the configured `origin` and `upstream` remotes.
* If no `upstream` remote exists:

  * Attempt to determine the original repository automatically.
  * Only ask for confirmation if it cannot be determined reliably.

Determine the synchronization status between the active branch and its upstream counterpart.

---

## Safety Checks

Before making any modifications:

* Fetch all remotes.
* Verify that the working tree is clean.
* If uncommitted changes exist:

  * Stash them automatically when it is safe to do so.
  * Otherwise, stop and explain why manual intervention is required.

---

## Review Process

Identify every upstream commit that has not yet been integrated into the current branch.

For each missing commit:

* Understand its purpose.
* Review the affected files.
* Evaluate compatibility with the current fork.
* Determine whether the commit should be:

  * **Apply** (integrate unchanged)
  * **Adapt** (integrate with modifications)
  * **Skip** (do not integrate)

Do not assume every upstream commit should be incorporated.

If a commit has already been fully or partially implemented within the fork, recognize it and avoid duplicate work.

Consider dependencies between upstream commits. If a prerequisite commit is intentionally skipped, evaluate whether dependent commits should also be skipped.

---

## Integration

Choose the synchronization strategy that best preserves the fork history while minimizing risk.

Use whichever approach is most appropriate:

* merge
* cherry-pick
* rebase
* manual implementation

Avoid blindly merging or rebasing if doing so would overwrite or degrade fork-specific functionality.

Resolve merge conflicts carefully and prefer the technically superior solution rather than automatically favoring either upstream or fork.

Perform every required Git operation autonomously, including:

* fetch
* checkout (when needed)
* merge
* cherry-pick
* rebase
* conflict resolution
* commit creation (when necessary)
* push

---

## Validation

After integration:

* Ensure the project builds successfully.
* Execute the project's available tests.
* Resolve any issues introduced during integration whenever possible.

If validation fails and the issue cannot be resolved safely, revert or roll back the problematic integration before pushing.

Only push changes once the repository is in a consistent and validated state.

---

## Fork Documentation & README Synchronization

* Every time upstream changes are reviewed, merged, or adapted, you MUST verify and update `README.md`.
* `README.md` serves as the functional summary and living documentation of all differences, bug fixes, localization (pt-BR), and custom enhancements between this fork (`luciancsilva/tasks`) and the original project (`chrisvel/tududi`).
* Always populate and refine `README.md` during synchronization to ensure it accurately reflects:
  * The current divergence and list of custom features vs. upstream.
  * Newly integrated upstream versions/commits.
  * Active implementation plans and bug fixes (`plans/`).

---

## Deliverables

Provide a concise report containing:

1. The missing upstream commits that were evaluated.
2. The decision for each commit:

   * Apply
   * Adapt
   * Skip
3. A brief justification for every decision.
4. The Git operations that were performed.
5. Any conflicts encountered and how they were resolved.
6. Validation results.
7. Remaining risks or recommended follow-up work.
8. Confirmation that `README.md` has been updated with any new changes or differences between the fork and upstream.

The goal is not simply to synchronize with upstream, but to keep the fork healthy, maintainable, functionally correct, and well-documented.
