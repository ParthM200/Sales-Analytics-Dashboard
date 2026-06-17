// config.example.js — copy this to js/config.js and add your key.
// config.js is gitignored so your key never appears in the repo.
//
// HOW TO DEPLOY ON GITHUB PAGES WITH AI COACH:
//
// Option A — GitHub Actions secret (recommended):
//   1. Go to your repo → Settings → Secrets → Actions → New secret
//   2. Name: ANTHROPIC_API_KEY  Value: sk-ant-...
//   3. Add a .github/workflows/deploy.yml that runs:
//      echo "window.CLAUDE_API_KEY='${{ secrets.ANTHROPIC_API_KEY }}';" > js/config.js
//      Then deploys the site with `gh-pages` or the built-in Pages action.
//
// Option B — local dev only:
//   1. cp js/config.example.js js/config.js
//   2. Set your key below.
//   3. Never commit js/config.js.

window.CLAUDE_API_KEY = 'YOUR_ANTHROPIC_API_KEY_HERE';
