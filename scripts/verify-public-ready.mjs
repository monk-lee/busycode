import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE_URL = 'https://busycode.monklabs.dev/'
const SITE_HOST = 'busycode.monklabs.dev'
const MANIFEST_PATH = '/site.webmanifest'

async function readText(path) {
  return readFile(path, 'utf8')
}

function stripJsonComments(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1')
}

async function readJson(path, issues, label, { jsonc = false } = {}) {
  try {
    const text = await readText(path)
    return JSON.parse(jsonc ? stripJsonComments(text) : text)
  } catch (error) {
    issues.push(`${label} must be valid JSON${jsonc ? 'C' : ''}: ${error.message}`)
    return undefined
  }
}

async function readRequiredText(path, issues, label) {
  try {
    return await readText(path)
  } catch {
    issues.push(`${label} is missing`)
    return ''
  }
}

function requireIncludes(issues, text, needle, label) {
  if (!text.includes(needle)) {
    issues.push(label)
  }
}

function findMetaContent(html, keyType, key) {
  const pattern = new RegExp(
    `<meta\\b(?=[^>]*\\b${keyType}=["']${escapeRegExp(key)}["'])(?=[^>]*\\bcontent=["']([^"']+)["'])[^>]*>`,
    'i',
  )
  return html.match(pattern)?.[1]
}

function hasLink(html, rel, href) {
  const pattern = new RegExp(
    `<link\\b(?=[^>]*\\brel=["']${escapeRegExp(rel)}["'])(?=[^>]*\\bhref=["']${escapeRegExp(href)}["'])[^>]*>`,
    'i',
  )
  return pattern.test(html)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectJsonLd(html, issues, label) {
  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  const parsedBlocks = []

  if (blocks.length === 0) {
    issues.push(`${label} must include application/ld+json structured data`)
    return parsedBlocks
  }

  for (const [index, block] of blocks.entries()) {
    try {
      parsedBlocks.push(JSON.parse(block[1]))
    } catch (error) {
      issues.push(`${label} JSON-LD block ${index + 1} must parse: ${error.message}`)
    }
  }

  return parsedBlocks
}

function validateIndexHtml(html, issues, label, { built = false } = {}) {
  requireIncludes(issues, html, '<html lang="en">', `${label} must set html lang to en`)
  requireIncludes(
    issues,
    html,
    '<title>BusyCode - Fake AI Agent CLI Simulator</title>',
    `${label} must include the public BusyCode title`,
  )

  const description = findMetaContent(html, 'name', 'description')
  if (!description || description.length < 80 || !description.includes('fake AI agent CLI simulator')) {
    issues.push(`${label} must include a specific meta description`)
  }

  const themeColor = findMetaContent(html, 'name', 'theme-color')
  if (themeColor !== '#0b0c0b') {
    issues.push(`${label} must include the BusyCode theme color`)
  }

  if (!hasLink(html, 'canonical', SITE_URL)) {
    issues.push(`${label} must include canonical link to ${SITE_URL}`)
  }

  if (!hasLink(html, 'manifest', MANIFEST_PATH)) {
    issues.push(`${label} must link ${MANIFEST_PATH}`)
  }

  const openGraphChecks = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'BusyCode'],
    ['property', 'og:title', 'BusyCode - Fake AI Agent CLI Simulator'],
    ['property', 'og:url', SITE_URL],
    ['name', 'twitter:card', 'summary'],
    ['name', 'twitter:title', 'BusyCode - Fake AI Agent CLI Simulator'],
  ]

  for (const [keyType, key, expected] of openGraphChecks) {
    if (findMetaContent(html, keyType, key) !== expected) {
      issues.push(`${label} must include ${key}=${expected}`)
    }
  }

  for (const [keyType, key] of [
    ['property', 'og:description'],
    ['name', 'twitter:description'],
  ]) {
    const content = findMetaContent(html, keyType, key)
    if (!content || !content.includes('AI coding agent')) {
      issues.push(`${label} must include a useful ${key}`)
    }
  }

  const jsonLd = collectJsonLd(html, issues, label)
  const webApplication = jsonLd.find((block) => block?.['@type'] === 'WebApplication')
  if (!webApplication) {
    issues.push(`${label} JSON-LD must describe a WebApplication`)
  } else {
    if (webApplication.name !== 'BusyCode') {
      issues.push(`${label} JSON-LD WebApplication name must be BusyCode`)
    }
    if (webApplication.url !== SITE_URL) {
      issues.push(`${label} JSON-LD WebApplication url must be ${SITE_URL}`)
    }
    if (webApplication.creator?.name !== 'MonkLabs' || webApplication.creator?.url !== 'https://monklabs.dev/') {
      issues.push(`${label} JSON-LD creator must point to MonkLabs`)
    }
  }

  requireIncludes(issues, html, '<noscript>', `${label} must include a noscript fallback`)
  requireIncludes(issues, html, '<h1>BusyCode</h1>', `${label} noscript fallback must name BusyCode`)

  if (built && html.includes('/src/main.tsx')) {
    issues.push(`${label} must not reference the development entrypoint after build`)
  }
}

function validateRobots(text, issues, label) {
  requireIncludes(issues, text, 'User-agent: *', `${label} must apply to all user agents`)
  requireIncludes(issues, text, 'Allow: /', `${label} must allow crawling`)
  requireIncludes(issues, text, `Sitemap: ${SITE_URL}sitemap.xml`, `${label} must point to the BusyCode sitemap`)
}

function validateSitemap(text, issues, label) {
  requireIncludes(issues, text, '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', `${label} must use the sitemap namespace`)
  requireIncludes(issues, text, `<loc>${SITE_URL}</loc>`, `${label} must include only the BusyCode canonical URL`)

  const lastmod = text.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]
  if (!lastmod || Number.isNaN(Date.parse(lastmod))) {
    issues.push(`${label} must include a valid lastmod date`)
  }
}

function validateManifest(manifest, issues, label) {
  if (!manifest) {
    return
  }

  const expectations = {
    id: '/',
    name: 'BusyCode',
    short_name: 'BusyCode',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0b0c0b',
    theme_color: '#0b0c0b',
    lang: 'en',
  }

  for (const [key, expected] of Object.entries(expectations)) {
    if (manifest[key] !== expected) {
      issues.push(`${label} must set ${key}=${expected}`)
    }
  }

  if (!manifest.description?.includes('fake AI agent CLI simulator')) {
    issues.push(`${label} must describe BusyCode`)
  }
}

function validatePackageManifest(manifest, issues, label) {
  if (!manifest) {
    return
  }

  if (manifest.private !== true) {
    issues.push(`${label} must keep private=true until an npm publish flow exists`)
  }

  if (!manifest.packageManager?.startsWith('pnpm@')) {
    issues.push(`${label} must pin packageManager to pnpm`)
  }

  for (const scriptName of Object.keys(manifest.scripts ?? {})) {
    if (/^(release|publish)/i.test(scriptName)) {
      issues.push(`${label} must not define release/publish scripts for this static web app`)
    }
  }
}

async function validateRequiredDocument(root, issues, relativePath, requiredPhrases) {
  const text = await readRequiredText(join(root, relativePath), issues, relativePath)

  for (const phrase of requiredPhrases) {
    requireIncludes(issues, text, phrase, `${relativePath} must mention ${phrase}`)
  }
}

async function validateRepositoryFiles(root, issues) {
  await validateRequiredDocument(root, issues, 'README.md', ['SECURITY.md', 'PRIVACY.md'])
  await validateRequiredDocument(root, issues, 'SECURITY.md', [
    'Do not report suspected vulnerabilities in public issues.',
    'private vulnerability reporting',
    'Never include live secrets',
  ])
  await validateRequiredDocument(root, issues, 'PRIVACY.md', [
    'does not intentionally collect',
    'Cookies',
    'Local storage',
    'third-party API/provider calls',
    'Cloudflare may process standard request metadata',
  ])
  await validateRequiredDocument(root, issues, 'CONTRIBUTING.md', [
    'pnpm run verify:public',
    'pnpm audit',
    'Do not commit secrets',
  ])
  await validateRequiredDocument(root, issues, 'LICENSE', ['MIT License'])
}

async function validatePrTemplate(root, issues) {
  const text = await readRequiredText(join(root, '.github', 'pull_request_template.md'), issues, '.github/pull_request_template.md')
  const checklist = [
    'browser permission',
    'credential/token storage',
    'automatic external calls',
    'user data flow',
    'Cloudflare deployment scope',
    'public SEO/crawler behavior',
  ]

  for (const item of checklist) {
    requireIncludes(issues, text, item, `.github/pull_request_template.md must check ${item}`)
  }
}

async function validateDependabot(root, issues) {
  const text = await readRequiredText(join(root, '.github', 'dependabot.yml'), issues, '.github/dependabot.yml')

  for (const phrase of ['package-ecosystem: "npm"', 'package-ecosystem: "github-actions"', 'interval: "monthly"', 'groups:', 'open-pull-requests-limit: 5']) {
    requireIncludes(issues, text, phrase, `.github/dependabot.yml must include ${phrase}`)
  }
}

async function validateWorkflowPermissions(root, issues) {
  const text = await readRequiredText(join(root, '.github', 'workflows', 'verify.yml'), issues, '.github/workflows/verify.yml')

  requireIncludes(issues, text, 'permissions:', '.github/workflows/verify.yml must define top-level permissions')
  requireIncludes(issues, text, 'contents: read', '.github/workflows/verify.yml must keep default token contents read-only')
  requireIncludes(issues, text, 'pnpm run verify:public', '.github/workflows/verify.yml must run public-ready verification')
  requireIncludes(issues, text, 'pnpm run lint', '.github/workflows/verify.yml must run lint')
  requireIncludes(issues, text, 'pnpm audit', '.github/workflows/verify.yml must run dependency audit')
  requireIncludes(issues, text, 'corepack enable', '.github/workflows/verify.yml must use Corepack for pnpm setup')
  requireIncludes(issues, text, 'corepack prepare pnpm@10.32.1 --activate', '.github/workflows/verify.yml must pin pnpm with Corepack')
  requireIncludes(issues, text, 'concurrency:', '.github/workflows/verify.yml must define concurrency to cancel superseded verification runs')

  if (/(^|\n)\s*(contents|actions|checks|deployments|id-token|issues|packages|pull-requests|security-events|statuses):\s*write\b/.test(text)) {
    issues.push('.github/workflows/verify.yml must not grant write permissions in verify workflow')
  }

  if (text.includes('write-all')) {
    issues.push('.github/workflows/verify.yml must not use write-all permissions')
  }

  if (text.includes('pnpm/action-setup')) {
    issues.push('.github/workflows/verify.yml must use only GitHub-owned setup actions')
  }
}

async function validateCopiedAsset(root, issues, relativePath, validator) {
  const publicPath = join(root, 'public', relativePath)
  const distPath = join(root, 'dist', relativePath)

  const publicText = await readRequiredText(publicPath, issues, `public/${relativePath}`)
  const distText = await readRequiredText(distPath, issues, `dist/${relativePath}`)

  if (publicText && distText && publicText !== distText) {
    issues.push(`dist/${relativePath} must match public/${relativePath}`)
  }

  validator(publicText, issues, `public/${relativePath}`)
  validator(distText, issues, `dist/${relativePath}`)
}

export async function collectPublicReadyIssues(root = process.cwd()) {
  const issues = []

  const wrangler = await readJson(join(root, 'wrangler.jsonc'), issues, 'wrangler.jsonc', { jsonc: true })
  if (wrangler) {
    if (wrangler.name !== 'busycode') {
      issues.push('wrangler.jsonc name must be busycode')
    }
    if (wrangler.workers_dev !== false) {
      issues.push('wrangler.jsonc must set workers_dev=false')
    }
    if (wrangler.assets?.directory !== './dist') {
      issues.push('wrangler.jsonc assets.directory must be ./dist')
    }
    if (!wrangler.routes?.some((route) => route.pattern === SITE_HOST && route.custom_domain === true)) {
      issues.push(`wrangler.jsonc must route the custom domain ${SITE_HOST}`)
    }
  }

  const packageManifest = await readJson(join(root, 'package.json'), issues, 'package.json')
  validatePackageManifest(packageManifest, issues, 'package.json')

  const sourceHtml = await readRequiredText(join(root, 'index.html'), issues, 'index.html')
  if (sourceHtml) {
    validateIndexHtml(sourceHtml, issues, 'index.html')
  }

  const builtHtml = await readRequiredText(join(root, 'dist', 'index.html'), issues, 'dist/index.html')
  if (builtHtml) {
    validateIndexHtml(builtHtml, issues, 'dist/index.html', { built: true })
  }

  await validateCopiedAsset(root, issues, 'robots.txt', validateRobots)
  await validateCopiedAsset(root, issues, 'sitemap.xml', validateSitemap)

  const publicManifest = await readJson(join(root, 'public', 'site.webmanifest'), issues, 'public/site.webmanifest')
  const distManifest = await readJson(join(root, 'dist', 'site.webmanifest'), issues, 'dist/site.webmanifest')
  validateManifest(publicManifest, issues, 'public/site.webmanifest')
  validateManifest(distManifest, issues, 'dist/site.webmanifest')

  if (publicManifest && distManifest && JSON.stringify(publicManifest) !== JSON.stringify(distManifest)) {
    issues.push('dist/site.webmanifest must match public/site.webmanifest')
  }

  for (const relativePath of ['llms.txt', 'humans.txt']) {
    if (existsSync(join(root, 'public', relativePath)) || existsSync(join(root, 'dist', relativePath))) {
      issues.push(`${relativePath} is intentionally out of scope for BusyCode public SEO`)
    }
  }

  await validateRepositoryFiles(root, issues)
  await validatePrTemplate(root, issues)
  await validateDependabot(root, issues)
  await validateWorkflowPermissions(root, issues)

  return issues
}

async function main() {
  const issues = await collectPublicReadyIssues()

  if (issues.length > 0) {
    console.error('Public-ready verification failed:')
    for (const issue of issues) {
      console.error(`- ${issue}`)
    }
    process.exitCode = 1
    return
  }

  console.log('Public-ready verification passed')
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] === currentFile) {
  await main()
}
