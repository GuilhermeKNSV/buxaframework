# v0.13.96 — NPC point rewards and compact Quick attributes

- NPC GM level edits now grant/retract attribute and proficiency points for *every* crossed configured reward level, without replaying scene celebrations or mutating item/resource data.
- When subtracting more points than remain unspent, the shortfall is tracked and deducted from future level rewards (never deletes spent attributes/proficiencies). Manually editing a point pool clears its matching shortfall.
- NPC Quick attributes now use dense one-row neutral tiles with dice, name, modifier (including +0), and value; their dice button still opens the normal roll menu and right-click still opens the GM attribute editor.
- NPC Visual and Player sheets remain unchanged.
