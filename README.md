# Moving quote frontend

Static RTL form for the moving-quote workflow. The browser receives only public
runtime settings; credentials and downstream API tokens must never be included.

## Local verification

```powershell
npm ci
npm test -- --run
npm run build
npx playwright test
```

For a manual local connection test, copy `public/runtime-config.example.js` over
`public/runtime-config.js` and replace both placeholder URLs. Restore the safe
empty version before committing. Never commit a live webhook URL.

## GitHub Pages deployment

1. Configure GitHub Pages to use **GitHub Actions** as its source.
2. Add the repository Actions secret `MOVING_QUOTE_WEBHOOK_URL`. Its value is the
   HTTPS Make custom-webhook URL. Do not store the URL in repository variables,
   source files, documentation, logs, or issue text.
3. Run **Deploy moving quote form** manually, or push a reviewed change under
   `apps/moving-quote/` to `main`.
4. Keep the Make scenario inactive until contract tests for GET, POST and OPTIONS
   pass. A successful Pages deployment does not authorize scenario activation.

The workflow generates `runtime-config.js` only inside the Actions runner, runs
the unit suite and production build, and uploads `dist/` to Pages. The same Make
webhook is currently configured for GET prefill and POST submit; Make must route
by HTTP method.
