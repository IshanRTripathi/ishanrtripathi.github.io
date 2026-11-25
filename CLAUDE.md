# Notes for working on this repo

## Deploying
- Deploy finished work without asking first. Once a change is tested and committed, open a PR into `master`, merge it, and wait for the GitHub Pages run (`.github/workflows/pages.yml`) to succeed. Then check that https://ishanr.com serves the new bundle.
- Work on the branch `claude/ishanr-portfolio-revamp-t4b29n` and never push anywhere else.
- Before merging: `npm run check` and `npm run build` must pass.
