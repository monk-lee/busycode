# Contributing

## Development

```sh
pnpm install
pnpm dev
```

## Verification

Run the full public-ready check before opening a pull request:

```sh
pnpm run verify:public
pnpm run lint
pnpm audit
```

## Security and Privacy Review

Call out any change that affects:

- Browser permissions
- Credential or token storage
- Automatic external calls
- User data flow
- Cloudflare deployment configuration
- Public SEO/crawler behavior

Do not commit secrets. Report secret presence only, never secret values.

## Release Scope

BusyCode is currently a static web application. There is no npm publish or release artifact workflow.

