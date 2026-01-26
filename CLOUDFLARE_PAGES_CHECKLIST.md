# Cloudflare Pages Frontend Checklist (Vite)

## Preflight
- [ ] Frontend lives in `frontend/`
- [ ] SPA redirect file exists: `frontend/public/_redirects`
- [ ] Basic headers file exists: `frontend/public/_headers`
- [ ] `frontend/.env` has `VITE_API_BASE_URL` set to the tunnel/API domain

## Build locally (optional sanity check)
```bash
cd frontend
npm ci
npm run check:env
npm run build
```
- [ ] Build output created at `frontend/dist/`

## Pages project settings (Git integration)
- [ ] Root directory: `frontend`
- [ ] Build command: `npm run build`
- [ ] Build output directory: `dist`

## Manual upload (if not using Git)
- [ ] Upload the contents of `frontend/dist/` (not the folder itself)

## Quick smoke checks
- [ ] Site loads at `https://<your-project>.pages.dev`
- [ ] SPA route works (directly open a deep link)
- [ ] JS/CSS files return `Content-Type: application/javascript` and `text/css`
