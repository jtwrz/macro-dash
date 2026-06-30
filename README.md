# Macro Dashboard — Yield Curve & Inflation

A static single-page dashboard showing the animated US Treasury yield curve and inflation measures side by side. Dark, editorial, built with vanilla JS and Chart.js — no framework, no bundler.

## Getting a FRED API key

1. Go to [fred.stlouisfed.org/docs/api/api_key.html](https://fred.stlouisfed.org/docs/api/api_key.html)
2. Register for a free account and request an API key
3. Your key is a 32-character alphanumeric string

## Wiring up your key

Open `src/fred.js` and replace the value of `FRED_API_KEY` at the top of the file:

```js
const FRED_API_KEY = 'your_key_here';
```

> **Note:** This key is visible in browser DevTools to anyone who visits the page. This is acceptable for a personal dashboard. A future phase will move data fetching to a Python script that runs in GitHub Actions, keeping the key out of the browser entirely.

## Running locally

Open a terminal in the `Macro_Dash/` root and run:

```
python3 -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000) in your browser.

A local server is required because the JS modules use `import`/`export`, which browsers block over the `file://` protocol.

## Deploying to GitHub Pages

1. Push this repo to GitHub (main branch)
2. In your repo, go to **Settings → Pages**
3. Under **Source**, select **GitHub Actions**
4. The workflow at `.github/workflows/deploy.yml` will run automatically on the next push to `main` and deploy the repo root to Pages

Your dashboard will be live at `https://<your-username>.github.io/<repo-name>/`.
