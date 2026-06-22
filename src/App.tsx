import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import './App.css'

const cliOptions = ['Claude Code', 'Codex', 'Gemini CLI', 'OpenCode']
const startCommand = 'busycode'
const workspacePath = '~/workspace'
const typingDelay = 125
const introDelay = 340
const optionsDelay = 760
const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const claudeThinkingFrames = ['✻', '✳', '✢', '·']

type CodexTimelineEvent = {
  text: string
  detail: string
  duration: number
  mode?: 'working' | 'thinking'
  output?: string[]
  diff?: Array<{
    kind: 'add' | 'delete' | 'context' | 'hunk'
    text: string
  }>
  result?: string
}

type CodexTuiProps = {
  onExit: () => void
  screenRef: RefObject<HTMLElement | null>
}

type ClaudeCodeTuiProps = {
  onExit: () => void
  screenRef: RefObject<HTMLElement | null>
}

type ClaudeTimelineEvent = {
  title: string
  duration: number
  lines: string[]
  statusText: string
  ultra?: boolean
}

type ClaudeTranscriptItem =
  | { type: 'user'; text: string }
  | { type: 'tool'; title: string; lines: string[] }
  | { type: 'status'; text: string; hint?: string }

type GeminiCliTuiProps = {
  onExit: () => void
  screenRef: RefObject<HTMLElement | null>
}

type OpenCodeTuiProps = {
  onExit: () => void
  screenRef: RefObject<HTMLElement | null>
}

type OpenCodeAgentMode = 'build' | 'plan'

type OpenCodeTranscriptItem =
  | { type: 'assistant'; lines: string[] }
  | { type: 'thinking'; title: string; detail: string }
  | { type: 'tool'; title: string; lines: string[]; footer?: string }

type OpenCodeTimelineEvent = OpenCodeTranscriptItem & {
  duration: number
  activeText: string
}

type OpenCodeSessionData = {
  title: string
  tokens: string
  contextUsed: number
  cost: string
  timeline: OpenCodeTimelineEvent[]
}

type GeminiToolLine =
  | string
  | {
      kind: 'add' | 'delete' | 'context' | 'hunk'
      text: string
    }

type GeminiTimelineEvent = {
  kind: 'thinking' | 'tool' | 'gemini'
  title: string
  detail?: string
  lines?: GeminiToolLine[]
  result?: string
  collapsedNote?: string
  ultra?: boolean
  duration: number
}

type GeminiTranscriptItem =
  | { type: 'user'; text: string }
  | { type: 'thinking'; text: string; hint?: string; ultra?: boolean }
  | { type: 'tool'; title: string; lines: GeminiToolLine[]; result?: string; collapsedNote?: string }
  | { type: 'gemini'; lines: string[] }

const geminiHeaderIcon = ['▝▜▄  ', '  ▝▜▄', ' ▗▟▀ ', '▝▀    ']
const geminiTips = [
  '1. /help for more information',
  '2. Ask coding questions, edit code or run commands',
  '3. Be specific for the best results',
]

const openCodeLogo = {
  left: ['                   ', '█▀▀█ █▀▀█ █▀▀█ █▀▀▄', '█__█ █__█ █^^^ █__█', '▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀~~▀'],
  right: ['             ▄     ', '█▀▀▀ █▀▀█ █▀▀█ █▀▀█', '█___ █__█ █__█ █^^^', '▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀'],
}

const openCodePlaceholder = 'Fix a TODO in the codebase'
const openCodeSessionPlaceholder = 'Type a task, @file, or !command'
const openCodeSpinnerPath = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1]

const formatOpenCodeLogoLine = (line: string) =>
  line.replaceAll('^', '▀').replaceAll('~', '▀').replaceAll('_', ' ')

const buildOpenCodeSessionTitle = (prompt: string) => {
  const trimmed = prompt.trim() || 'OpenCode TUI source sync'
  const normalized = trimmed.replace(/[!?.,]+$/g, '')
  if (normalized.length <= 40) {
    return normalized.charAt(0).toUpperCase() + normalized.slice(1)
  }

  return `${normalized.slice(0, 37).trimEnd()}...`
}

const buildOpenCodeQuery = (prompt: string) => {
  const trimmed = prompt.trim() || 'OpenCode TUI'
  return trimmed.length <= 28 ? trimmed : `${trimmed.slice(0, 28).trimEnd()}…`
}

const buildOpenCodeSession = (prompt: string, agentMode: OpenCodeAgentMode): OpenCodeSessionData => {
  const title = buildOpenCodeSessionTitle(prompt)
  const query = buildOpenCodeQuery(prompt)
  const tokenCount = 31400 + prompt.trim().length * 211
  const contextUsed = Math.max(18, Math.min(44, Math.round(tokenCount / 1850)))
  const cost = `$${(tokenCount / 136000).toFixed(2)}`
  const lead =
    agentMode === 'plan'
      ? `I'll inspect the original OpenCode TUI source first and keep the changes scoped.`
      : `I'll read the original OpenCode TUI source and mirror its runtime layout here.`

  return {
    title,
    tokens: tokenCount.toLocaleString('en-US'),
    contextUsed,
    cost,
    timeline: [
      {
        type: 'thinking',
        title: 'Thinking: Initiating Deep Dive',
        detail: `I'm now zeroing in on the core of the request. The user is asking for a precise and source-shaped OpenCode screen, so I'm tracing the real TUI flow for "${query}" before changing the renderer.`,
        activeText: 'Initiating deep dive...',
        duration: 1400,
      },
      {
        type: 'assistant',
        lines: [lead],
        activeText: 'Grounding transcript...',
        duration: 1100,
      },
      {
        type: 'tool',
        title: '# List files in the root directory',
        lines: [
          '$ ls -la',
          '',
          'total 1280',
          'drwxr-xr-x@ 25 my   staff   800 Apr 10 00:34 .',
          'drwxr-xr-x@ 11 my   staff   352 Apr 10 00:00 ..',
          'drwxr-xr-x@  7 my   staff   224 Apr 10 10:36 .codex',
          '-rw-r--r--@  1 my   staff   475 Apr 10 00:26 .gitignore',
          'drwxr-xr-x@ 10 my   staff   320 Apr 10 00:35 .omx',
          'drwxr-xr-x@  3 my   staff    96 Apr 10 00:04 .vscode',
          'drwxr-xr-x@  4 my   staff   128 Apr 10 00:34 .wrangler',
          '-rw-r--r--@  1 my   staff 27560 Apr 10 00:26 AGENTS.md',
          'drwxr-xr-x@  4 my   staff   128 Apr 10 00:34 dist',
          '…',
        ],
        footer: 'Click to expand',
        activeText: 'Listing workspace...',
        duration: 1800,
      },
      {
        type: 'tool',
        title: '# Inspect upstream OpenCode TUI files',
        lines: [
          '$ curl -L home.tsx footer.tsx prompt/index.tsx sidebar.tsx',
          '',
          'Loaded centered prompt entry from routes/home.tsx',
          'Loaded footer status row from routes/session/footer.tsx',
          'Loaded composer metadata and retry row from component/prompt/index.tsx',
          'Loaded 42-column sidebar structure from routes/session/sidebar.tsx',
        ],
        footer: 'Click to expand',
        activeText: 'Inspecting upstream source...',
        duration: 1700,
      },
      {
        type: 'assistant',
        lines: [
          'The live screen should feel like one terminal transcript, not a dashboard. I am collapsing the UI into a top prompt bar plus stacked reasoning and tool blocks to match the real OpenCode feel.',
        ],
        activeText: 'Reconciling UI shape...',
        duration: 1500,
      },
      {
        type: 'tool',
        title: '# Patch BusyCode OpenCode renderer',
        lines: [
          '$ apply_patch src/App.tsx src/App.css',
          '',
          '- remove dashboard-like home composition',
          '+ promote top prompt bar',
          '+ render stacked thinking and tool panels',
          '+ darken canvas and simplify transcript chrome',
        ],
        footer: 'Click to expand',
        activeText: 'Patching renderer...',
        duration: 1600,
      },
    ],
  }
}

const buildGeminiSearchTarget = (prompt: string) => {
  const trimmed = prompt.trim() || 'busycode'
  return trimmed.length <= 28 ? trimmed : trimmed.slice(0, 28)
}

const buildGeminiTimeline = (prompt: string): GeminiTimelineEvent[] => {
  const searchTarget = buildGeminiSearchTarget(prompt)

  return [
    {
      kind: 'thinking',
      title: 'Reasoning',
      detail: `Breaking "${searchTarget}" into UI, behavior, and verification steps`,
      duration: 1500,
    },
    {
      kind: 'tool',
      title: `✓ Shell rg "${searchTarget}" src/App.tsx [cwd: ${workspacePath}]`,
      lines: [
        'type GeminiCliTuiProps = {',
        "const geminiTips = ['1. /help for more information', ...]",
        'function GeminiCliTui({ onExit, screenRef }: GeminiCliTuiProps) {',
      ],
      collapsedNote: 'first 72 lines hidden (Ctrl+O to show)',
      result: '3 matches',
      duration: 2100,
    },
    {
      kind: 'tool',
      title: '✓ Read src/App.tsx',
      lines: [
        "const cliOptions = ['Claude Code', 'Codex', 'Gemini CLI', 'OpenCode']",
        'const spinnerFrames = [\'⠋\', \'⠙\', \'⠹\', ...]',
        'function GeminiCliTui({ onExit, screenRef }: GeminiCliTuiProps) {',
      ],
      collapsedNote: 'showing focused region around GeminiCliTui',
      result: 'state machine mapped',
      duration: 1700,
    },
    {
      kind: 'thinking',
      title: 'Reasoning',
      detail: 'Matching Gemini transcript rhythm to the existing Codex and Claude simulators',
      duration: 2200,
    },
    {
      kind: 'thinking',
      title: 'Ultra Thinking',
      detail: 'Cross-checking shell cards, reasoning cadence, and transcript density before editing',
      ultra: true,
      duration: 5200,
    },
    {
      kind: 'tool',
      title: '✓ Search "useEffect|useLayoutEffect|setInterval" src',
      lines: [
        'src/App.tsx:1:import { useEffect, useLayoutEffect, useRef, useState } from "react"',
        'src/App.tsx:421: useEffect(() => {',
        'src/App.tsx:1180: useEffect(() => {',
      ],
      result: 'timer-driven screens located',
      duration: 1900,
    },
    {
      kind: 'tool',
      title: `✓ Web Search("${searchTarget}")`,
      lines: [
        `Found 10 results for "${searchTarget}"`,
        'github.com/google-gemini/gemini-cli',
        'docs.geminicli.com/get-started',
        'Matched transcript card pattern against screenshot references',
      ],
      result: 'search results grounded',
      duration: 1800,
    },
    {
      kind: 'tool',
      title: '✓ Read AGENTS.md, src/App.tsx, src/App.css',
      lines: [
        'Found busycode launcher routing for Codex, Claude Code, and Gemini CLI',
        'Verified Gemini footer/path conventions now match the other simulators',
        'Confirmed Ctrl+C and Enter behaviors share the same document-level key handling pattern',
      ],
      result: 'context assembled',
      duration: 1700,
    },
    {
      kind: 'thinking',
      title: 'Reasoning',
      detail: 'Selecting shell cards over generic bullets so Gemini feels closer to the real CLI transcript',
      duration: 2400,
    },
    {
      kind: 'tool',
      title: '✓ Edit src/App.tsx src/App.css',
      lines: [
        '@@ Gemini timeline @@',
        '+ richer prompt-shaped tool cards',
        '+ validation/result lines',
        '+ active reasoning row only spins while current',
      ],
      result: 'Applied patch (+84 -21)',
      duration: 1800,
    },
    {
      kind: 'tool',
      title: '✓ Shell git diff -- src/App.tsx src/App.css',
      lines: [
        { kind: 'context', text: 'diff --git a/src/App.tsx b/src/App.tsx' },
        { kind: 'hunk', text: '@@ Gemini timeline @@' },
        { kind: 'delete', text: '- simple transcript cards without web-search coverage' },
        { kind: 'add', text: '+ web search card and rich diff rendering in Gemini timeline' },
        { kind: 'add', text: '+ colored add/delete/hunk/context lines for git diff cards' },
      ],
      result: 'diff reviewed',
      duration: 1500,
    },
    {
      kind: 'thinking',
      title: 'Ultra Thinking',
      detail: 'Replaying likely user interactions to catch awkward transitions before validation',
      ultra: true,
      duration: 4800,
    },
    {
      kind: 'tool',
      title: '✓ Shell pnpm lint && pnpm run build',
      lines: [
        'ESLint completed without generated worker type warnings',
        'Vite static build completed',
        'Wrangler deploy config points at static dist assets',
      ],
      result: 'lint/build green; static-only deploy ready',
      duration: 2100,
    },
    {
      kind: 'thinking',
      title: 'Reasoning',
      detail:
        'Transcript now mixes search, read, explore, edit, diff, and validation cards like the other simulator lanes.',
      duration: 2300,
    },
  ]
}

const claudeTimeline: ClaudeTimelineEvent[] = [
  {
    title: 'Explore(Deep codebase exploration)',
    lines: [
      '└ Read(vite.config.ts)',
      '  Bash(find src -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" \\) | grep -v node_modules | head…)',
      '  Running…',
      '  +4 more tool uses (ctrl+o to expand)',
    ],
    statusText: 'Symbioting…',
    duration: 3200,
  },
  {
    title: 'Thinking through the codebase architecture… (ctrl+o to expand)',
    lines: [
      '└ aligning transcript flow, tool grouping, and terminal realism',
      '  +3 more thought branches (ctrl+o to expand)',
    ],
    statusText: 'Ultra Thinking…',
    duration: 12000,
    ultra: true,
  },
  {
    title: 'Read(src/App.tsx)',
    lines: [
      '└ Bash(sed -n "1,220p" src/App.tsx)',
      '  Running…',
      '  (ctrl+b to run in background)',
    ],
    statusText: 'Germinating…',
    duration: 2400,
  },
  {
    title: 'Search(useEffect|useLayoutEffect|setInterval in src)',
    lines: [
      '└ Bash(rg "useEffect|useLayoutEffect|setInterval" src)',
      '  Running…',
      '  +2 more tool uses (ctrl+o to expand)',
    ],
    statusText: 'Transfiguring…',
    duration: 5400,
  },
  {
    title: 'Reconciling request intent with repository state… (ctrl+o to expand)',
    lines: [
      '└ evaluating hidden constraints and likely UI revisions',
      '  +5 more thought branches (ctrl+o to expand)',
    ],
    statusText: 'Ultra Thinking…',
    duration: 15000,
    ultra: true,
  },
  {
    title: 'Edit(src/App.tsx)',
    lines: [
      '└ Applied patch (+58 -18)',
      '  Bash(git diff -- src/App.tsx src/App.css)',
      '  Ready for review',
    ],
    statusText: 'Refining…',
    duration: 2600,
  },
  {
    title: 'Simulating likely next edits before acting… (ctrl+o to expand)',
    lines: [
      '└ measuring whether this should become a patch, search, or transcript update',
      '  +2 more thought branches (ctrl+o to expand)',
    ],
    statusText: 'Ultra Thinking…',
    duration: 11000,
    ultra: true,
  },
  {
    title: 'Read(memory/MEMORY.md)',
    lines: [
      '└ Bash(sed -n "1,180p" memory/MEMORY.md)',
      '  Running…',
      '  (ctrl+b to run in background)',
    ],
    statusText: 'Germinating…',
    duration: 2600,
  },
  {
    title: 'Run(pnpm run build)',
    lines: [
      '└ Bash(pnpm run build)',
      '  Running…',
      '  +1 more tool use (ctrl+o to expand)',
    ],
    statusText: 'Transfiguring…',
    duration: 4200,
  },
]

const claudeAvatarPixels = [
  '1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1',
  '1,1,1,2,2,2,2,2,2,1,1,1',
  '1,1,1,2,2,2,2,2,2,1,1,1',
  '1,1,2,2,2,2,2,2,2,2,1,1',
  '1,2,2,2,2,2,2,2,2,2,2,1',
  '1,2,2,3,2,2,2,2,3,2,2,1',
  '1,2,2,4,2,2,2,2,4,2,2,1',
  '1,2,2,2,2,2,2,2,2,2,2,1',
  '1,2,2,2,2,2,2,2,2,2,2,1',
  '1,2,2,2,2,3,3,2,2,2,2,1',
  '1,1,2,2,2,2,2,2,2,2,1,1',
  '1,1,1,1,1,1,1,1,1,1,1,1',
].map((row) => row.split(','))

function ClaudePixelAvatar() {
  return (
    <div className='claude-avatar' aria-hidden='true'>
      {claudeAvatarPixels.flatMap((row, rowIndex) =>
        row.map((value, columnIndex) => (
          <span
            key={`${rowIndex}-${columnIndex}`}
            className={`claude-pixel claude-pixel-${value}`}
          />
        )),
      )}
    </div>
  )
}

const codexTimeline: CodexTimelineEvent[] = [
  {
    text: 'Explored workspace',
    detail: 'src/App.tsx, src/App.css, src/index.css, wrangler.jsonc',
    output: [
      'Search "useEffect|useLayoutEffect|setInterval" in src',
      'Read src/App.tsx, src/App.css',
      'Read wrangler.jsonc',
    ],
    duration: 850,
  },
  {
    text: 'Ran sed -n 1,220p src/App.tsx',
    detail: 'Reading React state machine and keyboard event routing',
    output: [
      "const cliOptions = ['Claude Code', 'Codex', 'Gemini CLI', 'OpenCode']",
      'function CodexTui() {',
      '  const viewportRef = useRef<HTMLDivElement>(null)',
      '… +41 lines',
    ],
    result: '✓ • 1.4s',
    duration: 1600,
  },
  {
    text: 'Ran sed -n 1,260p src/App.css',
    detail: 'Checking terminal layout, overflow rules, and composer styling',
    output: [
      '.codex-screen { height: 100dvh; overflow: hidden; }',
      '.codex-layout { overflow-y: auto; scrollbar-width: none; }',
      '.codex-composer { background: #393a44; }',
    ],
    result: '✓ • 1.2s',
    duration: 1500,
  },
  {
    text: 'Ran rg "useEffect|useLayoutEffect|setInterval" src',
    detail: 'Mapping timers that drive simulated TUI activity',
    output: [
      'src/App.tsx:1:import { useEffect, useLayoutEffect, useRef, useState } from "react"',
      'src/App.tsx:86:  useEffect(() => {',
      'src/App.tsx:112:  useLayoutEffect(() => {',
    ],
    result: '✓ • 0.7s',
    duration: 1300,
  },
  {
    text: 'Reviewed component tree',
    detail: 'Launcher routes to CodexTui after option 2 is submitted',
    output: ['App → busycode launcher', 'App → CodexTui when submittedName === "Codex"'],
    duration: 1200,
  },
  {
    text: 'Explored Codex TUI source',
    detail: 'BottomPane owns ChatComposer, status row, context footer, popups',
    output: [
      'Read codex-rs/tui/src/bottom_pane/mod.rs',
      'Read codex-rs/tui/src/bottom_pane/chat_composer.rs',
      'Read codex-rs/tui/src/status_indicator_widget.rs',
    ],
    duration: 1900,
  },
  {
    text: 'Ultra Thinking',
    detail: 'Reconciling fake productivity, real TUI constraints, and suspiciously urgent vibes',
    mode: 'thinking',
    output: [
      'Considering whether the composer should move or the viewport should follow it',
      'Rejecting fixed footer because the transcript should feel terminal-native',
      'Holding context open while pretending this is computationally expensive',
    ],
    duration: 14500,
  },
  {
    text: 'Ran curl -L github.com/openai/codex',
    detail: 'Fetching openai/codex references from GitHub',
    output: ['HTTP 200', 'Downloaded exec_cell/render.rs', 'Downloaded history_cell.rs'],
    result: '✓ • 2.5s',
    duration: 2500,
  },
  {
    text: 'Read remote Rust sources',
    detail: 'Understanding BottomPane, ChatComposer, and StatusIndicatorWidget',
    output: [
      'BottomPane owns ChatComposer and transient views',
      'ExecCell renders Running/Ran command cells',
      'StatusIndicatorWidget renders Working + elapsed + detail',
    ],
    duration: 3400,
  },
  {
    text: 'Cross-checked TUI behavior',
    detail: 'Comparing source structure with README splash and TUI screenshots',
    output: [
      'Composer remains available while status row is active',
      'Long command output is truncated with omitted line hints',
      'Exploring cells group Read/List/Search operations',
    ],
    duration: 2800,
  },
  {
    text: 'Ultra Thinking',
    detail: 'Estimating how much code can be "read" before anyone asks for screenshots',
    mode: 'thinking',
    output: [
      'Inspecting prior decisions',
      'Simulating a long internal chain of thought without revealing it',
      'Compressing conclusions into plausible terminal output',
    ],
    duration: 18000,
  },
  {
    text: 'Ran rg "codexTimeline|codex-layout|codex-composer"',
    detail: 'Locating simulator timeline and viewport constraints',
    output: [
      'src/App.tsx:18:const codexTimeline',
      'src/App.css:92:.codex-layout',
      'src/App.css:103:.codex-composer',
    ],
    result: '✓ • 0.5s',
    duration: 1100,
  },
  {
    text: 'Edited src/App.tsx',
    detail: 'Appending realistic read/search/build events to Panic Work Mode',
    diff: [
      { kind: 'context', text: '  const codexTimeline = [' },
      { kind: 'delete', text: "-   { text: 'Scanning workspace'," },
      { kind: 'add', text: "+   { text: 'Explored workspace'," },
      { kind: 'add', text: "+     output: ['Search ...', 'Read ...', 'List ...']," },
      { kind: 'context', text: '    duration: 850,' },
    ],
    duration: 1700,
  },
  {
    text: 'Edited src/App.css',
    detail: 'Keeping terminal viewport scroll hidden while content follows bottom',
    diff: [
      { kind: 'hunk', text: '@@ .codex-layout @@' },
      { kind: 'add', text: '+ overflow-y: auto;' },
      { kind: 'add', text: '+ scrollbar-width: none;' },
      { kind: 'context', text: '  height: calc(100dvh - 28px);' },
    ],
    duration: 1400,
  },
  {
    text: 'Ran git diff -- src/App.tsx src/App.css',
    detail: 'Reviewing render path and style changes for accidental layout drift',
    output: [
      'diff --git a/src/App.tsx b/src/App.tsx',
      '@@ -18,7 +18,31 @@',
      '… +64 lines',
    ],
    result: '✓ • 0.8s',
    duration: 1300,
  },
  {
    text: 'Ran pnpm lint',
    detail: 'ESLint reports no blocking issues',
    output: [
      'src/App.tsx checked',
      'src/App.css checked',
      'static-only Cloudflare config checked',
    ],
    result: '✓ • 1.6s',
    duration: 2100,
  },
  {
    text: 'Ran pnpm run build',
    detail: 'TypeScript build and Vite bundle completed',
    output: [
      '✓ 30 modules transformed.',
      'dist/client/assets/index.js   200.8 kB',
      '✓ built in 412ms',
    ],
    result: '✓ • 2.0s',
    duration: 2400,
  },
  {
    text: 'Ultra Thinking',
    detail: 'Searching for a reason the UI still looks like work',
    mode: 'thinking',
    output: [
      'Reviewing spacing, terminal density, status rhythm, and fake confidence',
      'Comparing "Panic Work Mode" against "Crazy Worker Mode"',
      'Conclusion: keep panic, increase apparent effort',
    ],
    duration: 16000,
  },
  {
    text: 'Ran rg "TODO|FIXME|hack|panic"',
    detail: 'rg "TODO|FIXME|hack|panic" returned nothing actionable',
    output: ['No matches found in src'],
    result: '✓ • 0.4s',
    duration: 900,
  },
  {
    text: 'Updated plan',
    detail: 'Next: Claude Code, Gemini CLI, and OpenCode themed workers',
    output: ['□ Add Claude Code simulator', '□ Add Gemini CLI simulator', '□ Add OpenCode simulator'],
    duration: 1500,
  },
  {
    text: 'Compacted visible transcript',
    detail: 'Keeping the visible transcript believable, not useful',
    output: ['Retained recent 32 transcript cells', 'Dropped stale header rows from viewport'],
    duration: 1100,
  },
]

function CodexTui({ onExit, screenRef }: CodexTuiProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [visibleEvents, setVisibleEvents] = useState<typeof codexTimeline>(() => [])
  const eventIndexRef = useRef(0)
  const draftRef = useRef('')
  const exitArmTimerRef = useRef<number | null>(null)
  const [totalEvents, setTotalEvents] = useState(0)
  const [spinnerIndex, setSpinnerIndex] = useState(0)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [draft, setDraft] = useState('')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [hasStarted, setHasStarted] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [exitArmed, setExitArmed] = useState(false)
  const activeEvent = codexTimeline[Math.max(0, totalEvents - 1) % codexTimeline.length]
  const isThinking = activeEvent.mode === 'thinking'
  const activeLabel = isThinking ? 'Ultra Thinking' : 'Working'
  const contextLeft = Math.max(42, 88 - totalEvents * 2)

  const updateDraft = (nextDraft: string) => {
    draftRef.current = nextDraft
    setDraft(nextDraft)
  }

  useEffect(() => {
    if (!hasStarted || !isRunning) {
      return
    }

    const addNextEvent = () => {
      const event = codexTimeline[eventIndexRef.current % codexTimeline.length]
      eventIndexRef.current += 1
      setTotalEvents(eventIndexRef.current)
      setVisibleEvents((current) => [...current, event].slice(-32))
      return event.duration
    }

    let activeTimer = 0

    const scheduleNextEvent = (delay: number) => {
      activeTimer = window.setTimeout(() => {
        const nextDelay = addNextEvent()
        scheduleNextEvent(nextDelay)
      }, delay)
    }

    scheduleNextEvent(520)

    return () => {
      window.clearTimeout(activeTimer)
    }
  }, [hasStarted, isRunning])

  useEffect(() => {
    if (!hasStarted || !isRunning) {
      return
    }

    const spinnerTimer = window.setInterval(() => {
      setSpinnerIndex((current) => (current + 1) % spinnerFrames.length)
    }, 120)

    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => {
      window.clearInterval(spinnerTimer)
      window.clearInterval(elapsedTimer)
    }
  }, [hasStarted, isRunning])

  useEffect(() => {
    return () => {
      if (exitArmTimerRef.current !== null) {
        window.clearTimeout(exitArmTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current

    if (viewport) {
      window.requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight
      })
    }
  }, [visibleEvents, spinnerIndex, elapsedSeconds, draft, submittedPrompt])

  useEffect(() => {
    const armExit = () => {
      setExitArmed(true)
      if (exitArmTimerRef.current !== null) {
        window.clearTimeout(exitArmTimerRef.current)
      }
      exitArmTimerRef.current = window.setTimeout(() => {
        setExitArmed(false)
        exitArmTimerRef.current = null
      }, 1600)
    }

    const appendSystemEvent = (text: string, detail: string, output?: string[]) => {
      setVisibleEvents((current) =>
        [
          ...current,
          {
            text,
            detail,
            duration: 0,
            output,
          },
        ].slice(-32),
      )
    }

    const toggleFullscreen = async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      await screenRef.current?.requestFullscreen()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void toggleFullscreen()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()

        if (exitArmed) {
          onExit()
          return
        }

        if (isRunning) {
          setIsRunning(false)
          appendSystemEvent('Interrupted', 'Panic Work Mode stopped by user', [
            'Press Ctrl+C again to exit Codex',
            'Press Enter to resume from the composer',
          ])
        } else {
          appendSystemEvent('Exit armed', 'Press Ctrl+C again to exit Codex')
        }

        armExit()
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const prompt = draftRef.current.trim()
        if (!prompt) {
          return
        }
        setSubmittedPrompt(prompt)
        updateDraft('')
        setHasStarted(true)
        setIsRunning(true)
        setExitArmed(false)
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        updateDraft(draftRef.current.slice(0, -1))
        return
      }

      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        updateDraft(`${draftRef.current}${event.key}`)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [exitArmed, hasStarted, isRunning, onExit, screenRef])

  return (
    <div className='codex-layout' ref={viewportRef}>
      <div className='codex-flow'>
        <section className='codex-session-header' aria-label='Codex session summary'>
          <div className='codex-session-title'>
            <span className='codex-logo'>OpenAI Codex</span>
            <span className='codex-muted'> v0.118.0</span>
          </div>
          <div className='codex-session-grid'>
            <span className='codex-muted'>model</span>
            <span>gpt-5.4 high</span>
            <span className='codex-command'>/model</span>
            <span className='codex-muted'>directory</span>
            <span>{workspacePath}</span>
            <span className='codex-mode'>Panic Work Mode</span>
          </div>
          <p className='codex-session-tip'>
            <span className='codex-tip'>Tip:</span> Use <span className='codex-command'>/fast</span> to enable our
            fastest inference at 2X plan usage.
          </p>
        </section>

        <pre className='codex-transcript'>
          {submittedPrompt ? (
            <>
              <span className='codex-user-prompt'>› {submittedPrompt}</span>
              <br />
              <br />
            </>
          ) : null}
          {visibleEvents.map((event, index) => (
            <span className='codex-event' key={`${event.text}-${index}`}>
              <span className='codex-bullet'>•</span>
              <span> {event.text}</span>
              <br />
              <span className='codex-muted'>  └ {event.detail}</span>
              <br />
              {event.output?.map((line) => (
                <span className='codex-output' key={`${event.text}-${line}`}>
                  <span>    {line}</span>
                  <br />
                </span>
              ))}
              {event.diff?.map((line) => (
                <span className={`codex-diff codex-diff-${line.kind}`} key={`${event.text}-${line.text}`}>
                  <span>    {line.text}</span>
                  <br />
                </span>
              ))}
              {event.result ? (
                <>
                  <span className='codex-result'>  {event.result}</span>
                  <br />
                </>
              ) : null}
            </span>
          ))}
          {hasStarted && isRunning ? (
            <>
              <span className={isThinking ? 'codex-thinking' : 'codex-working'}>
                {spinnerFrames[spinnerIndex]} {activeLabel} ({elapsedSeconds}s • Ctrl+C to interrupt)
              </span>
              <br />
              <span className='codex-muted'>  └ {activeEvent.detail}</span>
            </>
          ) : null}
        </pre>

        <pre className='codex-composer'>
          <span>› </span>
          {draft ? (
            <>
              <span>{draft}</span>
              <span className='cursor' aria-hidden='true' />
            </>
          ) : (
            <>
              <span className='cursor' aria-hidden='true' />
              <span className='codex-placeholder'> Ask Codex to do anything</span>
            </>
          )}
        </pre>

        <pre className='codex-status-line'>
          gpt-5.4 high · {contextLeft}% context · Ctrl+Enter fullscreen ·
          {exitArmed ? ' Ctrl+C to exit' : ' Ctrl+C interrupt'}
        </pre>
      </div>
    </div>
  )
}

function ClaudeCodeTui({ onExit, screenRef }: ClaudeCodeTuiProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef('')
  const exitArmTimerRef = useRef<number | null>(null)
  const timelineIndexRef = useRef(0)
  const [draft, setDraft] = useState('')
  const [exitArmed, setExitArmed] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [thinkingFrameIndex, setThinkingFrameIndex] = useState(0)
  const [recentActivity, setRecentActivity] = useState('')
  const [activeStep, setActiveStep] = useState<ClaudeTimelineEvent | null>(null)
  const [transcript, setTranscript] = useState<ClaudeTranscriptItem[]>(() => [])

  const updateDraft = (nextDraft: string) => {
    draftRef.current = nextDraft
    setDraft(nextDraft)
  }

  const buildSearchQuery = (prompt: string) => {
    const trimmed = prompt.trim()
    if (trimmed.length <= 18) {
      return trimmed
    }

    return `${trimmed.slice(0, 18)}`
  }

  useEffect(() => {
    return () => {
      if (exitArmTimerRef.current !== null) {
        window.clearTimeout(exitArmTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current

    if (viewport) {
      window.requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight
      })
    }
  }, [transcript, activeStep, thinkingFrameIndex, recentActivity])

  useEffect(() => {
    if (!hasStarted || !isRunning) {
      return
    }

    let activeTimer = 0

    const scheduleNext = (delay: number) => {
      activeTimer = window.setTimeout(() => {
        const nextEvent = claudeTimeline[timelineIndexRef.current % claudeTimeline.length]
        timelineIndexRef.current += 1
        setActiveStep(nextEvent)
        const toolItem: ClaudeTranscriptItem = {
          type: 'tool',
          title: nextEvent.title,
          lines: nextEvent.lines,
        }
        setTranscript((current) => [...current, toolItem].slice(-10))
        scheduleNext(nextEvent.duration)
      }, delay)
    }

    scheduleNext(400)

    return () => {
      window.clearTimeout(activeTimer)
    }
  }, [hasStarted, isRunning])

  useEffect(() => {
    if (!hasStarted || !isRunning) {
      return
    }

    const timer = window.setInterval(() => {
      setThinkingFrameIndex((current) => (current + 1) % claudeThinkingFrames.length)
    }, 420)

    return () => {
      window.clearInterval(timer)
    }
  }, [hasStarted, isRunning])

  useEffect(() => {
    const armExit = () => {
      setExitArmed(true)
      if (exitArmTimerRef.current !== null) {
        window.clearTimeout(exitArmTimerRef.current)
      }
      exitArmTimerRef.current = window.setTimeout(() => {
        setExitArmed(false)
        exitArmTimerRef.current = null
      }, 1600)
    }

    const toggleFullscreen = async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      await screenRef.current?.requestFullscreen()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void toggleFullscreen()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()

        if (exitArmed) {
          onExit()
          return
        }

        if (isRunning) {
          setIsRunning(false)
          setActiveStep({
            title: 'Germinating…',
            lines: [],
            statusText: 'paused',
            duration: 0,
          })
          const interruptedItem: ClaudeTranscriptItem = {
            type: 'status',
            text: 'Interrupted.',
            hint: 'Claude Code session paused by user',
          }
          setTranscript((current) => [...current, interruptedItem].slice(-10))
        }

        armExit()
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const prompt = draftRef.current.trim()
        if (prompt) {
          setRecentActivity(`> ${prompt}`)
          const userItem: ClaudeTranscriptItem = { type: 'user', text: prompt }
          const webSearchItem: ClaudeTranscriptItem = {
            type: 'tool',
            title: `Web Search("${buildSearchQuery(prompt)}")`,
            lines: [
              `└ Found 10 results for "${buildSearchQuery(prompt)}"`,
              `  Bash(curl -L "https://search.example/?q=${buildSearchQuery(prompt)}")`,
            ],
          }
          setTranscript((current) => [...current, userItem, webSearchItem].slice(-10))
          updateDraft('')
          setHasStarted(true)
          setIsRunning(true)
          setExitArmed(false)
        }
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        updateDraft(draftRef.current.slice(0, -1))
        return
      }

      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        updateDraft(`${draftRef.current}${event.key}`)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [exitArmed, hasStarted, isRunning, onExit, screenRef])

  return (
    <div className='claude-layout'>
      <div className='claude-scroll' ref={viewportRef}>
        <div className='claude-flow'>
          <pre className='claude-shell-title'>
            <span className='claude-prompt'>›</span>
            <span> claude</span>
          </pre>

          <section className='claude-card-shell' aria-label='Claude Code welcome'>
            <div className='claude-card'>
              <div className='claude-pane claude-pane-left'>
                <p className='claude-welcome'>Welcome back BusyCode!</p>
                <ClaudePixelAvatar />
                <p className='claude-meta'>Opus 4.6 (1M context) with hi… · Claude Max · BusyCode</p>
                <p className='claude-path'>{workspacePath}</p>
              </div>

              <div className='claude-pane claude-pane-right'>
                <p className='claude-section-title'>Tips for getting started</p>
                <p className='claude-copy'>
                  Run <span className='claude-inline'>/init</span> to create a CLAUDE.md file with
                  instructions for Claude
                </p>
                <div className='claude-divider' />
                <p className='claude-section-title'>Recent activity</p>
                <p className='claude-copy'>{recentActivity}</p>
              </div>
            </div>
          </section>

          {hasStarted ? (
            <pre className='claude-transcript'>
              {transcript.map((item, index) => {
                if (item.type === 'user') {
                  return (
                    <span className='claude-transcript-item' key={`${item.type}-${index}`}>
                      <span className='claude-user-line'>❯ {item.text}</span>
                      <br />
                    </span>
                  )
                }

                if (item.type === 'tool') {
                  const isActiveTool = isRunning && activeStep?.title === item.title
                  return (
                    <span className='claude-transcript-item' key={`${item.type}-${index}`}>
                      <span className='claude-tool-title'>
                        <span
                          className={
                            [
                              'claude-tool-icon',
                              item.title.includes('Thinking') ? 'claude-tool-icon-ultra' : '',
                              isActiveTool ? 'claude-tool-icon-active' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')
                          }
                        >
                          ⏺
                        </span>{' '}
                        <span className={item.title.includes('Thinking') ? 'claude-tool-title-ultra' : ''}>
                          {item.title}
                        </span>
                      </span>
                      <br />
                      {item.lines.map((line, lineIndex) => (
                        <span key={`${index}-${lineIndex}`}>
                          <span className='claude-tool-line'>{line}</span>
                          <br />
                        </span>
                      ))}
                    </span>
                  )
                }

                return (
                  <span className='claude-transcript-item' key={`${item.type}-${index}`}>
                    <span className='claude-thinking-line'>✻ {item.text}</span>
                    <br />
                    {item.hint ? (
                      <>
                        <span className='claude-copy'>  └ {item.hint}</span>
                        <br />
                      </>
                    ) : null}
                  </span>
                )
              })}
              {isRunning && activeStep ? (
                <span className='claude-transcript-item'>
                  <span
                    className={
                      activeStep.ultra ? 'claude-thinking-line claude-thinking-line-ultra' : 'claude-thinking-line'
                    }
                  >
                    {claudeThinkingFrames[thinkingFrameIndex]} {activeStep.statusText} (thinking with high effort)
                  </span>
                </span>
              ) : null}
            </pre>
          ) : null}

          <div className='claude-divider-wide' />

          <pre className='claude-input'>
            <span className='claude-input-prompt'>❯</span>
            <span> </span>
            {draft ? (
              <>
                <span>{draft}</span>
                <span className='cursor' aria-hidden='true' />
              </>
            ) : (
              <span className='cursor' aria-hidden='true' />
            )}
          </pre>

          <div className='claude-divider-wide' />

          <pre className='claude-status'>
            <span className='claude-status-primary'>Model: Opus 4.6</span>
            <span> | </span>
            <span className='claude-status-context'>Context: [████████░░░░░░░░░] 230k/1000k (23%)</span>
            <span> | </span>
            <span className='claude-status-muted'>⎇ no git</span>
            <span className='claude-status-right'>
              {exitArmed ? ' · Ctrl+C exit · /effort' : ' · high · /effort · Ctrl+Enter'}
            </span>
          </pre>
        </div>
      </div>
    </div>
  )
}

function GeminiCliTui({ onExit, screenRef }: GeminiCliTuiProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef('')
  const exitArmTimerRef = useRef<number | null>(null)
  const timelineIndexRef = useRef(0)
  const [draft, setDraft] = useState('')
  const [exitArmed, setExitArmed] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [spinnerIndex, setSpinnerIndex] = useState(0)
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [transcript, setTranscript] = useState<GeminiTranscriptItem[]>(() => [])
  const [activeEvent, setActiveEvent] = useState<GeminiTimelineEvent | null>(null)
  const [timeline, setTimeline] = useState<GeminiTimelineEvent[]>(() => [])
  const updateDraft = (nextDraft: string) => {
    draftRef.current = nextDraft
    setDraft(nextDraft)
  }

  const appendTranscriptItem = (item: GeminiTranscriptItem) => {
    setTranscript((current) => [...current, item].slice(-18))
  }

  useEffect(() => {
    return () => {
      if (exitArmTimerRef.current !== null) {
        window.clearTimeout(exitArmTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current

    if (viewport) {
      window.requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight
      })
    }
  }, [transcript, draft, activeEvent, spinnerIndex])

  useEffect(() => {
    if (!hasStarted || !isRunning) {
      return
    }

    let activeTimer = 0

    const pushNextEvent = () => {
      const nextEvent = timeline[timelineIndexRef.current % timeline.length]
      timelineIndexRef.current += 1
      setActiveEvent(nextEvent)

      if (nextEvent.kind === 'thinking') {
        const thinkingItem: GeminiTranscriptItem = {
          type: 'thinking',
          text: nextEvent.title,
          hint: nextEvent.detail,
          ultra: nextEvent.ultra,
        }
        setTranscript((current) =>
          [...current, thinkingItem].slice(-18),
        )
      }

      if (nextEvent.kind === 'tool') {
        const toolItem: GeminiTranscriptItem = {
          type: 'tool',
          title: nextEvent.title,
          lines: nextEvent.lines ?? [],
          result: nextEvent.result,
          collapsedNote: nextEvent.collapsedNote,
        }
        setTranscript((current) =>
          [...current, toolItem].slice(-18),
        )
      }

      if (nextEvent.kind === 'gemini') {
        const geminiLines = (nextEvent.lines ?? []).filter((line): line is string => typeof line === 'string')
        const geminiItem: GeminiTranscriptItem = {
          type: 'gemini',
          lines: geminiLines,
        }
        setTranscript((current) => [...current, geminiItem].slice(-18))
      }

      return nextEvent.duration
    }

    const scheduleNext = (delay: number) => {
      activeTimer = window.setTimeout(() => {
        const nextDelay = pushNextEvent()
        scheduleNext(nextDelay)
      }, delay)
    }

    scheduleNext(360)

    return () => {
      window.clearTimeout(activeTimer)
    }
  }, [hasStarted, isRunning, timeline])

  useEffect(() => {
    if (!hasStarted || !isRunning) {
      return
    }

    const spinnerTimer = window.setInterval(() => {
      setSpinnerIndex((current) => (current + 1) % spinnerFrames.length)
    }, 120)

    return () => {
      window.clearInterval(spinnerTimer)
    }
  }, [hasStarted, isRunning])

  useEffect(() => {
    const armExit = () => {
      setExitArmed(true)
      if (exitArmTimerRef.current !== null) {
        window.clearTimeout(exitArmTimerRef.current)
      }
      exitArmTimerRef.current = window.setTimeout(() => {
        setExitArmed(false)
        exitArmTimerRef.current = null
      }, 1600)
    }

    const toggleFullscreen = async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      await screenRef.current?.requestFullscreen()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void toggleFullscreen()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()

        if (exitArmed) {
          onExit()
          return
        }

        if (isRunning) {
          const interruptedItem: GeminiTranscriptItem = {
            type: 'thinking',
            text: 'Interrupted',
            hint: 'Press Enter to resume or Ctrl+C again to exit Gemini CLI',
          }
          setIsRunning(false)
          appendTranscriptItem(interruptedItem)
        } else {
          appendTranscriptItem({
            type: 'thinking',
            text: 'Exit armed',
            hint: 'Press Ctrl+C again to exit Gemini CLI',
          })
        }

        armExit()
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const prompt = draftRef.current.trim()

        if (prompt) {
          const nextTimeline = buildGeminiTimeline(prompt)
          timelineIndexRef.current = 0
          setTimeline(nextTimeline)
          setSubmittedPrompt(prompt)
          setTranscript([{ type: 'user', text: prompt }])
          updateDraft('')
          setHasStarted(true)
          setIsRunning(true)
          setActiveEvent(nextTimeline[0] ?? null)
        } else if (hasStarted && !isRunning) {
          setIsRunning(true)
        }

        setExitArmed(false)
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        updateDraft(draftRef.current.slice(0, -1))
        return
      }

      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        updateDraft(`${draftRef.current}${event.key}`)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [exitArmed, hasStarted, isRunning, onExit, screenRef])

  return (
    <div className='gemini-layout'>
      <div className='gemini-scroll' ref={viewportRef}>
        <div className='gemini-flow'>
          <pre className='gemini-shell-title'>
            <span className='gemini-shell-prompt'>›</span> npx @google/gemini-cli
          </pre>

          <section className='gemini-header' aria-label='Gemini CLI header'>
            <pre className='gemini-icon' aria-hidden='true'>
              {geminiHeaderIcon.map((line) => `${line}\n`).join('')}
            </pre>

            <div className='gemini-header-meta'>
              <p className='gemini-product'>
                <span className='gemini-product-name'>Gemini CLI</span>
                <span className='gemini-version'> v0.37.1</span>
              </p>
              <p className='gemini-meta-line'>
                Authenticated with busycode-api-key <span className='gemini-inline-command'>/auth</span>
              </p>
            </div>
          </section>

          <section className='gemini-tips' aria-label='Tips for getting started'>
            <p className='gemini-section-title'>Tips for getting started:</p>
            {geminiTips.map((tip) => (
              <p className='gemini-tip-line' key={tip}>
                {tip}
              </p>
            ))}
          </section>

          {hasStarted ? (
            <section className='gemini-log-shell' aria-label='Gemini transcript'>
              <div className='gemini-log'>
                {submittedPrompt ? (
                  <>
                    <div className='gemini-user-line'>
                      <span className='gemini-log-prompt'>❯</span> {submittedPrompt}
                    </div>
                    <br />
                    <br />
                  </>
                ) : null}
                {transcript
                  .filter((item) => item.type !== 'user')
                  .map((item, index) => {
                    if (item.type === 'thinking') {
                      return (
                        <div className='gemini-log-item' key={`${item.type}-${index}`}>
                          <div
                            className={
                              item.ultra
                                ? 'gemini-thinking-line gemini-thinking-line-static gemini-thinking-line-ultra'
                                : 'gemini-thinking-line gemini-thinking-line-static'
                            }
                          >
                            ✦ {item.text}
                          </div>
                          <br />
                          {item.hint ? (
                            <>
                              <div className='gemini-log-muted'>  └ {item.hint}</div>
                              <br />
                            </>
                          ) : null}
                          <br />
                        </div>
                      )
                    }

                    if (item.type === 'tool') {
                      return (
                        <div className='gemini-tool-card' key={`${item.type}-${index}`}>
                          <div className='gemini-tool-title'>{item.title}</div>
                          <br />
                          {item.collapsedNote ? (
                            <>
                              <div className='gemini-tool-note'>... {item.collapsedNote} ...</div>
                              <br />
                            </>
                          ) : null}
                          {item.lines.map((line, lineIndex) =>
                            typeof line === 'string' ? (
                              <div className='gemini-log-muted' key={`${item.title}-${lineIndex}-${line}`}>
                                {line}
                              </div>
                            ) : (
                              <div
                                className={`gemini-tool-line gemini-tool-line-${line.kind}`}
                                key={`${item.title}-${lineIndex}-${line.text}`}
                              >
                                {line.text}
                              </div>
                            ),
                          )}
                          {item.result ? (
                            <>
                              <div className='gemini-result-line'>✓ {item.result}</div>
                              <br />
                            </>
                          ) : null}
                          <br />
                        </div>
                      )
                    }

                    return (
                      <div className='gemini-log-item' key={`${item.type}-${index}`}>
                        {item.lines.map((line) => (
                          <div className='gemini-response-line' key={`${index}-${line}`}>
                            {line}
                          </div>
                        ))}
                        <br />
                      </div>
                    )
                  })}
                {isRunning && activeEvent?.kind === 'thinking' ? (
                  <>
                    <div
                      className={
                        activeEvent.ultra
                          ? 'gemini-thinking-line gemini-thinking-line-active gemini-thinking-line-ultra'
                          : 'gemini-thinking-line gemini-thinking-line-active'
                      }
                    >
                      {activeEvent.ultra
                        ? `${claudeThinkingFrames[spinnerIndex % claudeThinkingFrames.length]} ${activeEvent.title} (thinking with high effort)`
                        : `${spinnerFrames[spinnerIndex]} ${activeEvent.title}`}
                    </div>
                    {activeEvent.detail ? (
                      <>
                        <br />
                        <div className='gemini-log-muted'>  └ {activeEvent.detail}</div>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className='gemini-status-shell' aria-label='Gemini status row'>
            <div className='gemini-status-row gemini-status-row-top'>
              <p className='gemini-status-primary'>
                {isRunning ? `${spinnerFrames[spinnerIndex]} running background tasks` : 'Shift+Tab to accept edits'}
              </p>
              <p className='gemini-status-tip'>? for shortcuts</p>
            </div>

            <div className='gemini-status-row gemini-status-row-bottom'>
              <p className='gemini-status-context'>1 AGENTS.md file • 3 MCP servers • 2 skills</p>
            </div>
          </section>

          <section className='gemini-composer-shell' aria-label='Gemini composer'>
            <pre className='gemini-composer'>
              <span className='gemini-composer-prefix'>› </span>
              {draft ? (
                <>
                  <span>{draft}</span>
                  <span className='cursor' aria-hidden='true' />
                </>
              ) : (
                <>
                  <span className='cursor' aria-hidden='true' />
                  <span className='gemini-placeholder'> Type your message or @path/to/file</span>
                </>
              )}
            </pre>
          </section>

          <div className='gemini-footer'>
            <div className='gemini-footer-column'>
              <p className='gemini-footer-label'>workspace (/directory)</p>
              <p className='gemini-footer-value'>{workspacePath}</p>
            </div>
            <div className='gemini-footer-column'>
              <p className='gemini-footer-label'>sandbox</p>
              <p className='gemini-footer-value gemini-footer-negative'>no sandbox</p>
            </div>
            <div className='gemini-footer-column gemini-footer-column-right'>
              <p className='gemini-footer-label'>/model</p>
              <p className='gemini-footer-value'>
                {exitArmed ? 'Ctrl+C to exit' : isRunning ? 'Ctrl+C to interrupt' : 'Auto (Gemini 3)'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OpenCodeTui({ onExit, screenRef }: OpenCodeTuiProps) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const draftRef = useRef('')
  const exitArmTimerRef = useRef<number | null>(null)
  const timelineIndexRef = useRef(0)
  const [draft, setDraft] = useState('')
  const [exitArmed, setExitArmed] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [spinnerIndex, setSpinnerIndex] = useState(0)
  const [agentMode, setAgentMode] = useState<OpenCodeAgentMode>('build')
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [transcript, setTranscript] = useState<OpenCodeTranscriptItem[]>(() => [])
  const [activeText, setActiveText] = useState('')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [sessionData, setSessionData] = useState<OpenCodeSessionData | null>(null)
  const sessionModel = 'claude-sonnet-4'
  const sessionProvider = 'opencode zen'
  const sessionVariant = 'max'
  const accentClass = agentMode === 'plan' ? 'opencode-agent-plan' : 'opencode-agent-build'
  const accentLabel = agentMode === 'plan' ? 'Plan' : 'Build'
  const spinnerHead = openCodeSpinnerPath[spinnerIndex % openCodeSpinnerPath.length]
  const spinnerTail = openCodeSpinnerPath[(spinnerIndex - 1 + openCodeSpinnerPath.length) % openCodeSpinnerPath.length]

  const updateDraft = (nextDraft: string) => {
    draftRef.current = nextDraft
    setDraft(nextDraft)
  }

  useEffect(() => {
    return () => {
      if (exitArmTimerRef.current !== null) {
        window.clearTimeout(exitArmTimerRef.current)
      }
    }
  }, [])

  useLayoutEffect(() => {
    const viewport = viewportRef.current

    if (viewport) {
      window.requestAnimationFrame(() => {
        viewport.scrollTop = viewport.scrollHeight
      })
    }
  }, [activeText, draft, elapsedSeconds, spinnerIndex, transcript])

  useEffect(() => {
    if (!hasStarted || !isRunning || !sessionData) {
      return
    }

    let activeTimer = 0

    const pushNextEvent = () => {
      const nextEvent = sessionData.timeline[timelineIndexRef.current % sessionData.timeline.length]
      timelineIndexRef.current += 1
      setActiveText(nextEvent.activeText)
      setTranscript((current) => [...current, nextEvent].slice(-24))
      activeTimer = window.setTimeout(pushNextEvent, nextEvent.duration)
    }

    activeTimer = window.setTimeout(pushNextEvent, 260)

    return () => {
      window.clearTimeout(activeTimer)
    }
  }, [hasStarted, isRunning, sessionData])

  useEffect(() => {
    const spinnerTimer = window.setInterval(() => {
      setSpinnerIndex((current) => (current + 1) % spinnerFrames.length)
    }, 120)

    return () => {
      window.clearInterval(spinnerTimer)
    }
  }, [])

  useEffect(() => {
    if (!hasStarted || !isRunning) {
      return
    }

    const elapsedTimer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1)
    }, 1000)

    return () => {
      window.clearInterval(elapsedTimer)
    }
  }, [hasStarted, isRunning])

  useEffect(() => {
    const armExit = () => {
      setExitArmed(true)
      if (exitArmTimerRef.current !== null) {
        window.clearTimeout(exitArmTimerRef.current)
      }
      exitArmTimerRef.current = window.setTimeout(() => {
        setExitArmed(false)
        exitArmTimerRef.current = null
      }, 1600)
    }

    const toggleFullscreen = async () => {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      await screenRef.current?.requestFullscreen()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault()
        void toggleFullscreen()
        return
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
        event.preventDefault()

        if (exitArmed) {
          onExit()
          return
        }

        armExit()
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()

        if (isRunning) {
          setIsRunning(false)
          setActiveText('Interrupted')
        }
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        setAgentMode((current) => (current === 'build' ? 'plan' : 'build'))
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const prompt = draftRef.current.trim()
        if (!prompt) {
          return
        }
        const nextSession = buildOpenCodeSession(prompt, agentMode)
        timelineIndexRef.current = 0
        setSubmittedPrompt(prompt)
        setSessionData(nextSession)
        setTranscript([])
        setElapsedSeconds(0)
        setHasStarted(true)
        setIsRunning(true)
        setExitArmed(false)
        setActiveText('Starting session...')
        updateDraft('')
        return
      }

      if (event.key === 'Backspace') {
        event.preventDefault()
        updateDraft(draftRef.current.slice(0, -1))
        return
      }

      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        updateDraft(`${draftRef.current}${event.key}`)
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [agentMode, exitArmed, isRunning, onExit, screenRef])

  if (!hasStarted || !sessionData) {
    return (
      <div className='opencode-layout'>
        <div className='opencode-home'>
          <pre className='opencode-logo' aria-label='OpenCode logo'>
            {openCodeLogo.left.map((line, index) => (
              <span className='opencode-logo-row' key={`${line}-${index}`}>
                <span className='opencode-logo-left'>{formatOpenCodeLogoLine(line)}</span>
                <span className='opencode-logo-right'>{formatOpenCodeLogoLine(openCodeLogo.right[index])}</span>
                <br />
              </span>
            ))}
          </pre>

          <div className='opencode-home-prompt-shell'>
            <pre className='opencode-home-prompt'>
              {draft ? (
                <>
                  <span>{draft}</span>
                  <span className='cursor' aria-hidden='true' />
                </>
              ) : (
                <>
                  <span className='cursor' aria-hidden='true' />
                  <span className='opencode-placeholder'> {openCodePlaceholder}</span>
                </>
              )}
            </pre>

            <div className='opencode-home-prompt-meta'>
              <div className='opencode-footer-inline'>
                <span className={`opencode-agent ${accentClass}`}>{accentLabel}</span>
                <span>{sessionModel}</span>
                <span className='opencode-muted'>{sessionProvider}</span>
                <span className='opencode-muted'>·</span>
                <span className='opencode-variant'>{sessionVariant}</span>
              </div>
            </div>
          </div>
        </div>

        <div className='opencode-footer'>
          <span className='opencode-muted'>{workspacePath}</span>
          <span className='opencode-footer-inline'>
            <span>Get started</span>
            <span className='opencode-muted'>/connect</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className='opencode-runtime'>
      <div className='opencode-runtime-scroll' ref={viewportRef}>
        <section className='opencode-session-card opencode-user-card'>
          <p>
            <span className='opencode-user-prompt'>›</span> {submittedPrompt}
          </p>
        </section>

        <div className='opencode-transcript'>
          {transcript.map((item, index) =>
            item.type === 'assistant' ? (
              <div className='opencode-assistant-block' key={`assistant-${index}`}>
                {item.lines.map((line) => (
                  <p className='opencode-assistant-line' key={`${index}-${line}`}>
                    {line}
                  </p>
                ))}
              </div>
            ) : item.type === 'thinking' ? (
              <div className='opencode-thinking-block' key={`thinking-${index}`}>
                <p className='opencode-thinking-title'>{item.title}</p>
                <p className='opencode-thinking-detail'>{item.detail}</p>
              </div>
            ) : (
              <div className='opencode-tool-card' key={`tool-${index}`}>
                <p className='opencode-tool-card-title'>{item.title}</p>
                {item.lines.map((line, lineIndex) => (
                  <p className='opencode-tool-card-line' key={`${item.title}-${lineIndex}-${line}`}>
                    {line}
                  </p>
                ))}
                {item.footer ? <p className='opencode-tool-card-footer'>{item.footer}</p> : null}
              </div>
            ),
          )}
        </div>
      </div>

      <div className='opencode-bottom-dock'>
        <div className='opencode-runtime-prompt-shell'>
          <pre className='opencode-runtime-prompt'>
            {draft ? (
              <>
                <span>{draft}</span>
                <span className='cursor' aria-hidden='true' />
              </>
            ) : (
              <>
                <span className='cursor' aria-hidden='true' />
                <span className='opencode-placeholder'> {openCodeSessionPlaceholder}</span>
              </>
            )}
          </pre>

          <div className='opencode-runtime-prompt-meta'>
            <div className='opencode-footer-inline'>
              <span className={`opencode-agent ${accentClass}`}>{accentLabel}</span>
              <span>{sessionModel}</span>
              <span className='opencode-muted'>{sessionProvider}</span>
              <span className='opencode-muted'>·</span>
              <span className='opencode-variant'>{sessionVariant}</span>
            </div>
          </div>
        </div>

        <div className='opencode-footer opencode-footer-session'>
          <div className='opencode-footer-inline'>
            <span className='opencode-muted'>{workspacePath}</span>
          </div>

          <div className='opencode-footer-inline'>
            <span className='opencode-live-spinner' aria-hidden='true'>
              {Array.from({ length: 6 }, (_, index) => (
                <span
                  key={`opencode-footer-spinner-${index}`}
                  className={[
                    'opencode-live-spinner-bar',
                    index === spinnerHead ? 'opencode-live-spinner-bar-active' : '',
                    index === spinnerTail ? 'opencode-live-spinner-bar-tail' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                />
              ))}
            </span>
            <span className='opencode-footer-good'>connected</span>
            <span className='opencode-muted'>permissions</span>
            <span className='opencode-muted'>LSP 3</span>
            <span className='opencode-muted'>MCP 3</span>
            <span className='opencode-muted'>/status</span>
            <span className='opencode-muted'>
              {sessionData.tokens} ({sessionData.contextUsed}%) · {sessionData.cost}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const codexScreenRef = useRef<HTMLElement>(null)
  const claudeScreenRef = useRef<HTMLElement>(null)
  const geminiScreenRef = useRef<HTMLElement>(null)
  const opencodeScreenRef = useRef<HTMLElement>(null)
  const selectedIndexRef = useRef(0)
  const cliReadyRef = useRef(false)
  const submittedNameRef = useRef('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [submittedName, setSubmittedName] = useState('')
  const [typedCommand, setTypedCommand] = useState('')
  const [cliIntroVisible, setCliIntroVisible] = useState(false)
  const [cliReady, setCliReady] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const timer = window.setTimeout(() => {
        setTypedCommand(startCommand)
        setCliIntroVisible(true)
        cliReadyRef.current = true
        setCliReady(true)
      }, 0)

      return () => {
        window.clearTimeout(timer)
      }
    }

    const timers = startCommand.split('').map((_, index) =>
      window.setTimeout(() => {
        setTypedCommand(startCommand.slice(0, index + 1))
      }, typingDelay * (index + 1)),
    )

    const commandCompleteAt = typingDelay * startCommand.length

    timers.push(
      window.setTimeout(() => {
        setCliIntroVisible(true)
      }, commandCompleteAt + introDelay),
    )

    timers.push(
      window.setTimeout(() => {
        cliReadyRef.current = true
        setCliReady(true)
      }, commandCompleteAt + introDelay + optionsDelay),
    )

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [])

  useEffect(() => {
    const focusInput = () => {
      inputRef.current?.focus()
    }

    const selectIndex = (nextIndex: number) => {
      selectedIndexRef.current = nextIndex
      setSelectedIndex(nextIndex)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (submittedNameRef.current) {
        return
      }

      if (!cliReadyRef.current) {
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        selectIndex((selectedIndexRef.current + 1) % cliOptions.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        selectIndex((selectedIndexRef.current - 1 + cliOptions.length) % cliOptions.length)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const selectedName = cliOptions[selectedIndexRef.current]
        submittedNameRef.current = selectedName
        setSubmittedName(selectedName)
        return
      }

      const numericChoice = Number(event.key)
      if (
        Number.isInteger(numericChoice) &&
        numericChoice >= 1 &&
        numericChoice <= cliOptions.length
      ) {
        event.preventDefault()
        selectIndex(numericChoice - 1)
      }
    }

    focusInput()
    document.addEventListener('keydown', handleKeyDown, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  if (submittedName === 'Codex') {
    return (
      <main
        ref={codexScreenRef}
        className='codex-screen'
        aria-label='Codex terminal'
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className='keyboard-capture'
          aria-label='Terminal keyboard input'
          autoComplete='off'
          autoFocus
          readOnly
        />
        <CodexTui
          onExit={() => {
            if (document.fullscreenElement) {
              void document.exitFullscreen()
            }
            submittedNameRef.current = ''
            setSubmittedName('')
          }}
          screenRef={codexScreenRef}
        />
      </main>
    )
  }

  if (submittedName === 'Claude Code') {
    return (
      <main
        ref={claudeScreenRef}
        className='claude-screen'
        aria-label='Claude Code terminal'
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className='keyboard-capture'
          aria-label='Terminal keyboard input'
          autoComplete='off'
          autoFocus
          readOnly
        />
        <ClaudeCodeTui
          onExit={() => {
            if (document.fullscreenElement) {
              void document.exitFullscreen()
            }
            submittedNameRef.current = ''
            setSubmittedName('')
          }}
          screenRef={claudeScreenRef}
        />
      </main>
    )
  }

  if (submittedName === 'Gemini CLI') {
    return (
      <main
        ref={geminiScreenRef}
        className='gemini-screen'
        aria-label='Gemini CLI terminal'
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className='keyboard-capture'
          aria-label='Terminal keyboard input'
          autoComplete='off'
          autoFocus
          readOnly
        />
        <GeminiCliTui
          onExit={() => {
            if (document.fullscreenElement) {
              void document.exitFullscreen()
            }
            submittedNameRef.current = ''
            setSubmittedName('')
          }}
          screenRef={geminiScreenRef}
        />
      </main>
    )
  }

  if (submittedName === 'OpenCode') {
    return (
      <main
        ref={opencodeScreenRef}
        className='opencode-screen'
        aria-label='OpenCode terminal'
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          className='keyboard-capture'
          aria-label='Terminal keyboard input'
          autoComplete='off'
          autoFocus
          readOnly
        />
        <OpenCodeTui
          onExit={() => {
            if (document.fullscreenElement) {
              void document.exitFullscreen()
            }
            submittedNameRef.current = ''
            setSubmittedName('')
          }}
          screenRef={opencodeScreenRef}
        />
      </main>
    )
  }

  return (
    <main className='bash-screen' aria-label='Bash terminal' onClick={() => inputRef.current?.focus()}>
      <input
        ref={inputRef}
        className='keyboard-capture'
        aria-label='Terminal keyboard input'
        autoComplete='off'
        autoFocus
        readOnly
      />
      <pre>
        <span className='prompt'>my@busycode</span>
        <span>:</span>
        <span className='path'>~</span>
        <span>$ </span>
        <span>{typedCommand}</span>
        {!cliIntroVisible ? <span className='cursor' aria-hidden='true' /> : null}
        {cliIntroVisible ? (
          <>
            <br />
            <br />
            <span className='brand'>busycode</span>
            <span> 0.1.0</span>
            <br />
            <span>Select a CLI with ↑/↓ or 1-4, then press Enter.</span>
            <br />
            <br />
          </>
        ) : null}
        {cliReady ? (
          <>
            {cliOptions.map((option, index) => (
              <span className='option-line' key={option}>
                <span className='selector'>{selectedIndex === index ? '>' : ' '}</span>
                <span>{index + 1}. </span>
                <span className={selectedIndex === index ? 'selected-option' : undefined}>
                  {option}
                </span>
                <br />
              </span>
            ))}
            <br />
          </>
        ) : null}
        {submittedName && submittedName !== 'Codex' ? (
          <>
            <span className='busycode-prompt'>busycode</span>
            <span>&gt; </span>
            <span>{submittedName}</span>
            <br />
            <span>{submittedName}</span>
            <br />
            <span className='busycode-prompt'>busycode</span>
            <span>&gt; </span>
            <span className='cursor' aria-hidden='true' />
          </>
        ) : null}
      </pre>
    </main>
  )
}

export default App
