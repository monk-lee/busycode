# Security Policy

## Supported Scope

BusyCode is a static browser application deployed with Cloudflare Workers Static Assets.

The application does not run a custom backend, does not request browser permissions, and does not intentionally collect user data. Deployment credentials must stay outside the repository and be stored only in the deployment environment.

## Reporting a Vulnerability

Do not report suspected vulnerabilities in public issues.

When this repository is hosted on GitHub, use GitHub private vulnerability reporting. If private vulnerability reporting is not available on the current host, contact the maintainer privately through the access channel used for this repository.

Please include:

- Affected URL, commit, or configuration file
- Steps to reproduce
- Expected impact
- Whether any credential, token, or user data exposure is suspected

Never include live secrets in a report. Redact values and report only presence, source, and scope.

## Security Boundary

In scope:

- Static asset deployment configuration
- Public SEO and crawler files
- Browser-only UI behavior
- CI and dependency configuration

Out of scope unless the project changes:

- Server-side request handling
- User accounts
- Payment data
- API provider calls
- Local binary execution
- Release artifact signing

