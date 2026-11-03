# Buxa Framework 0.16.8 — Directory tab view fix

- The tab selection now behaves like a separate directory view, not a folder card. Tab contents appear at the root of the view.
- **Only Main** and its descendant content persist visibly across every custom tab.
- Other world-root content stays on the Main tab, not in every tab.
- Moving individual documents or entire nested folders from Main to a custom tab and back preserves the actual documents and nesting.
- Works for Items, Actors, and Scenes, including auto-numbered tabs and inline rename.
- Existing saved tab-backed folders remain compatible and are hidden from the directory cards; no migration or destructive rewrite is needed.
- Adds 15 new regression tests; full suite 2,769 tests passing. Live Foundry V14 behavior remains to be tested.
