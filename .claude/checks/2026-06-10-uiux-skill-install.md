# ui-ux-pro-max skill install · 2026-06-10

- Source: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (MIT, v2.5.0).
- Installed the repo's bundled skill folders into C:\Users\kabir\.claude\skills\:
  ui-ux-pro-max (main, 1.9 MB: SKILL.md + data CSVs + search scripts),
  plus companions banner-design, brand, design, design-system, slides,
  ui-styling. No name collisions with existing skills.
- Windows gotcha fixed: the repo's .claude/skills/ui-ux-pro-max/scripts and
  /data are SYMLINKS to src/ui-ux-pro-max/; Git for Windows checked them out
  as text stubs. Replaced the stubs with the real directories from the repo's
  src/ tree. Other 6 skills had no stubs.
- Smoke test: python scripts/search.py "glassmorphism" --domain style
  returns real results (3 styles). Skills appear in the session skill list.
- The clone + temp files were removed; only the skill folders remain.
