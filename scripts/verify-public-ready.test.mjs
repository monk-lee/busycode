import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { collectPublicReadyIssues } from './verify-public-ready.mjs'

const siteUrl = 'https://busycode.monklabs.dev/'
const ogImageUrl = 'https://busycode.monklabs.dev/og-image.png'

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0)
  buffer.writeUInt32BE(width, 16)
  buffer.writeUInt32BE(height, 20)
  return buffer
}

async function writeFixture(root, overrides = {}) {
  await mkdir(join(root, 'public'), { recursive: true })
  await mkdir(join(root, 'dist'), { recursive: true })
  await mkdir(join(root, '.github', 'workflows'), { recursive: true })

  const indexHtml =
    overrides.indexHtml ??
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>BusyCode - Fake AI Agent CLI Simulator</title>
    <meta name="description" content="BusyCode is a browser-based fake AI agent CLI simulator that makes a screen look like Claude Code, Codex, Gemini CLI, or OpenCode is actively working." />
    <meta name="author" content="MonkLabs" />
    <meta name="theme-color" content="#0b0c0b" />
    <link rel="canonical" href="${siteUrl}" />
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/site.webmanifest" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="BusyCode" />
    <meta property="og:title" content="BusyCode - Fake AI Agent CLI Simulator" />
    <meta property="og:description" content="Make any screen look like an AI coding agent is exploring, thinking, editing, and verifying a codebase." />
    <meta property="og:url" content="${siteUrl}" />
    <meta property="og:image" content="${ogImageUrl}" />
    <meta property="og:image:secure_url" content="${ogImageUrl}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="BusyCode social preview showing a fake AI agent CLI simulator interface." />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="BusyCode - Fake AI Agent CLI Simulator" />
    <meta name="twitter:description" content="Make any screen look like an AI coding agent is exploring, thinking, editing, and verifying a codebase." />
    <meta name="twitter:image" content="${ogImageUrl}" />
    <meta name="twitter:image:alt" content="BusyCode social preview showing a fake AI agent CLI simulator interface." />
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"WebApplication","name":"BusyCode","url":"${siteUrl}","image":"${ogImageUrl}","description":"BusyCode is a browser-based fake AI agent CLI simulator.","applicationCategory":"EntertainmentApplication","operatingSystem":"Any","creator":{"@type":"Organization","name":"MonkLabs","url":"https://monklabs.dev/"}}
    </script>
  </head>
  <body>
    <div id="root"></div>
    <noscript><main><h1>BusyCode</h1><p>BusyCode is a fake AI agent CLI simulator.</p></main></noscript>
    <script type="module" crossorigin src="/assets/index.js"></script>
  </body>
</html>`

  await writeFile(
    join(root, 'wrangler.jsonc'),
    overrides.wrangler ??
      JSON.stringify({
        name: 'busycode',
        workers_dev: false,
        assets: { directory: './dist', not_found_handling: 'single-page-application' },
        routes: [{ pattern: 'busycode.monklabs.dev', custom_domain: true }],
      }),
  )
  await writeFile(
    join(root, 'package.json'),
    overrides.packageJson ??
      JSON.stringify({
        private: true,
        packageManager: 'pnpm@10.32.1',
        scripts: {
          build: 'tsc -b && vite build',
          lint: 'eslint .',
          'test:public-ready': 'node --test scripts/verify-public-ready.test.mjs',
          'verify:public': 'pnpm run build && pnpm run test:public-ready && node scripts/verify-public-ready.mjs',
        },
      }),
  )
  await writeFile(join(root, 'index.html'), indexHtml)
  await writeFile(join(root, 'dist', 'index.html'), indexHtml)
  await writeFile(
    join(root, 'public', 'robots.txt'),
    overrides.robots ?? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`,
  )
  await writeFile(
    join(root, 'public', 'sitemap.xml'),
    overrides.sitemap ??
      `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}</loc>
    <lastmod>2026-05-28</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`,
  )
  await writeFile(
    join(root, 'public', 'site.webmanifest'),
    overrides.manifest ??
      JSON.stringify({
        id: '/',
        name: 'BusyCode',
        short_name: 'BusyCode',
        description: 'A browser-based fake AI agent CLI simulator.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0c0b',
        theme_color: '#0b0c0b',
        lang: 'en',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      }),
  )
  await writeFile(join(root, 'dist', 'robots.txt'), overrides.robots ?? `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}sitemap.xml\n`)
  await writeFile(join(root, 'dist', 'sitemap.xml'), await readFile(join(root, 'public', 'sitemap.xml'), 'utf8'))
  await writeFile(join(root, 'dist', 'site.webmanifest'), await readFile(join(root, 'public', 'site.webmanifest'), 'utf8'))
  for (const [relativePath, width, height] of [
    ['favicon-32.png', 32, 32],
    ['apple-touch-icon.png', 180, 180],
    ['icon-192.png', 192, 192],
    ['icon-512.png', 512, 512],
    ['og-image.png', 1200, 630],
  ]) {
    const image = pngHeader(width, height)
    await writeFile(join(root, 'public', relativePath), image)
    await writeFile(join(root, 'dist', relativePath), image)
  }
  await writeFile(
    join(root, 'README.md'),
    overrides.readme ??
      '# BusyCode\n\nSee [SECURITY.md](SECURITY.md) and [PRIVACY.md](PRIVACY.md).\n',
  )
  await writeFile(
    join(root, 'SECURITY.md'),
    overrides.security ??
      'Do not report suspected vulnerabilities in public issues.\nUse private vulnerability reporting.\nNever include live secrets in a report.\n',
  )
  await writeFile(
    join(root, 'PRIVACY.md'),
    overrides.privacy ??
      'BusyCode does not intentionally collect user data.\nCookies are not used.\nLocal storage is not used.\nNo third-party API/provider calls are made from the browser.\nCloudflare may process standard request metadata.\n',
  )
  await writeFile(
    join(root, 'CONTRIBUTING.md'),
    overrides.contributing ??
      'Run pnpm run verify:public, pnpm run lint, and pnpm audit.\nDo not commit secrets.\n',
  )
  await writeFile(join(root, 'LICENSE'), overrides.license ?? 'MIT License\n')
  await writeFile(
    join(root, '.github', 'pull_request_template.md'),
    overrides.prTemplate ??
      'browser permission\ncredential/token storage\nautomatic external calls\nuser data flow\nCloudflare deployment scope\npublic SEO/crawler behavior\n',
  )
  await writeFile(
    join(root, '.github', 'dependabot.yml'),
    overrides.dependabot ??
      'version: 2\nupdates:\n  - package-ecosystem: "npm"\n    schedule:\n      interval: "monthly"\n    groups:\n      npm-dependencies:\n        patterns:\n          - "*"\n    open-pull-requests-limit: 5\n  - package-ecosystem: "github-actions"\n    schedule:\n      interval: "monthly"\n    groups:\n      github-actions:\n        patterns:\n          - "*"\n    open-pull-requests-limit: 5\n',
  )
  await writeFile(
    join(root, '.github', 'workflows', 'verify.yml'),
    overrides.workflow ??
      'name: Verify\npermissions:\n  contents: read\nconcurrency:\n  group: verify-${{ github.workflow }}-${{ github.ref }}\n  cancel-in-progress: true\njobs:\n  verify:\n    steps:\n      - run: corepack enable\n      - run: corepack prepare pnpm@10.32.1 --activate\n      - run: pnpm run verify:public\n      - run: pnpm run lint\n      - run: pnpm audit\n',
  )
}

test('accepts a public-ready BusyCode static build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'busycode-public-ready-'))

  try {
    await writeFixture(root)
    assert.deepEqual(await collectPublicReadyIssues(root), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reports missing canonical and workers.dev exposure', async () => {
  const root = await mkdtemp(join(tmpdir(), 'busycode-public-ready-broken-'))

  try {
    await writeFixture(root, {
      indexHtml: '<!doctype html><html><head><title>BusyCode</title></head><body><div id="root"></div></body></html>',
      wrangler: JSON.stringify({ name: 'busycode', workers_dev: true }),
    })
    const issues = await collectPublicReadyIssues(root)

    assert(issues.some((issue) => issue.includes('canonical')))
    assert(issues.some((issue) => issue.includes('workers_dev')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reports missing public repository controls', async () => {
  const root = await mkdtemp(join(tmpdir(), 'busycode-public-ready-repo-broken-'))

  try {
    await writeFixture(root, {
      privacy: 'No useful privacy boundary.\n',
      packageJson: JSON.stringify({ private: false, scripts: { release: 'npm publish' } }),
      workflow: 'name: Verify\npermissions: write-all\njobs:\n  verify:\n    steps:\n      - run: pnpm run build\n',
      dependabot: 'version: 2\n',
      prTemplate: 'No checklist.\n',
    })
    const issues = await collectPublicReadyIssues(root)

    assert(issues.some((issue) => issue.includes('private=true')))
    assert(issues.some((issue) => issue.includes('release/publish')))
    assert(issues.some((issue) => issue.includes('write-all')))
    assert(issues.some((issue) => issue.includes('user data flow')))
    assert(issues.some((issue) => issue.includes('package-ecosystem: "npm"')))
    assert(issues.some((issue) => issue.includes('does not intentionally collect')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('reports non-GitHub pnpm setup actions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'busycode-public-ready-workflow-broken-'))

  try {
    await writeFixture(root, {
      workflow: 'name: Verify\npermissions:\n  contents: read\njobs:\n  verify:\n    steps:\n      - uses: pnpm/action-setup@v4\n      - run: pnpm run verify:public\n      - run: pnpm run lint\n      - run: pnpm audit\n',
    })
    const issues = await collectPublicReadyIssues(root)

    assert(issues.some((issue) => issue.includes('Corepack')))
    assert(issues.some((issue) => issue.includes('GitHub-owned setup actions')))
    assert(issues.some((issue) => issue.includes('concurrency')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
