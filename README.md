# BusyCode

BusyCode is a fake AI agent CLI simulator. It recreates the feel of familiar terminal agents and immediately looks like it is exploring, thinking, editing, and verifying a codebase.

Live demo: https://busycode.monklabs.dev

## Development

```sh
pnpm install
pnpm dev
```

## Verification

```sh
pnpm run verify:public
pnpm run lint
pnpm audit
```

The Cloudflare deploy step may print a Wrangler debug-log permission warning in restricted sandboxes, but the static asset build should still complete.

## Deployment

BusyCode is deployed as Cloudflare Workers Static Assets. Static assets are served from `dist/` without an application server.

```sh
pnpm run deploy
```

## Public Repository Notes

- Security reports should not be filed as public issues. See [SECURITY.md](SECURITY.md).
- BusyCode does not intentionally collect user data or call external providers from the browser. See [PRIVACY.md](PRIVACY.md).
- This project does not currently publish npm packages or signed release artifacts.
