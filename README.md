# BusyCode CLI

BusyCode is a fake AI agent CLI simulator. It recreates the feel of familiar terminal agents and immediately looks like it is exploring, thinking, editing, and verifying a codebase.

## Development

```sh
pnpm install
pnpm dev
```

## Verification

```sh
pnpm lint
pnpm run build
```

The Cloudflare/Vite build may print a Wrangler debug-log permission warning in restricted sandboxes, but the client and worker bundles should still complete.
