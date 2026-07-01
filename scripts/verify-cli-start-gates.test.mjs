import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')

function getFunctionBody(functionName) {
  const declaration = new RegExp(`^function ${functionName}\\b`, 'm')
  const match = declaration.exec(appSource)
  assert(match, `${functionName} must exist`)
  const start = match.index

  const nextFunctionStart = appSource.indexOf('\nfunction ', start + functionName.length)
  return appSource.slice(start, nextFunctionStart === -1 ? appSource.length : nextFunctionStart)
}

const cliGates = [
  {
    functionName: 'CodexTui',
    initialStateChecks: [
      "const [visibleEvents, setVisibleEvents] = useState<typeof codexTimeline>(() => [])",
      'const eventIndexRef = useRef(0)',
      'const [totalEvents, setTotalEvents] = useState(0)',
      "const [submittedPrompt, setSubmittedPrompt] = useState('')",
    ],
  },
  {
    functionName: 'ClaudeCodeTui',
    initialStateChecks: [
      'const timelineIndexRef = useRef(0)',
      "const [recentActivity, setRecentActivity] = useState('')",
      'const [activeStep, setActiveStep] = useState<ClaudeTimelineEvent | null>(null)',
      'const [transcript, setTranscript] = useState<ClaudeTranscriptItem[]>(() => [])',
    ],
  },
  {
    functionName: 'GeminiCliTui',
    initialStateChecks: [
      'const timelineIndexRef = useRef(0)',
      "const [submittedPrompt, setSubmittedPrompt] = useState('')",
      'const [transcript, setTranscript] = useState<GeminiTranscriptItem[]>(() => [])',
      'const [activeEvent, setActiveEvent] = useState<GeminiTimelineEvent | null>(null)',
    ],
  },
  {
    functionName: 'OpenCodeTui',
    initialStateChecks: [
      'const timelineIndexRef = useRef(0)',
      "const [submittedPrompt, setSubmittedPrompt] = useState('')",
      'const [transcript, setTranscript] = useState<OpenCodeTranscriptItem[]>(() => [])',
      "const [activeText, setActiveText] = useState('')",
      'const [sessionData, setSessionData] = useState<OpenCodeSessionData | null>(null)',
    ],
  },
]

test('CLI screens wait for typed input before starting work', () => {
  for (const { functionName, initialStateChecks } of cliGates) {
    const body = getFunctionBody(functionName)

    assert(
      body.includes('const [hasStarted, setHasStarted] = useState(false)'),
      `${functionName} must not start before Enter`,
    )
    assert(
      body.includes('const [isRunning, setIsRunning] = useState(false)'),
      `${functionName} must not run before Enter`,
    )

    for (const check of initialStateChecks) {
      assert(body.includes(check), `${functionName} must initialize with ${check}`)
    }
  }
})

test('app does not personalize CLI screens from URL query parameters', () => {
  assert(!appSource.includes('URLSearchParams'), 'App must not read URL query parameters')
  assert(!appSource.includes('window.location.search'), 'App must not inspect location.search')
  assert(!appSource.includes('displayName='), 'CLI screens must not accept URL-derived display names')
})

test('fake CLI providers only use neutral workspace paths', () => {
  const forbiddenPathPatterns = [
    [/~\/Desktop\b/, 'home Desktop paths'],
    [/\/Users\//, 'absolute user paths'],
    [/Desktop\/job\b/, 'local job folder paths'],
    [/monklabs\/busycode\b/, 'internal repository paths'],
    [/~\/\.\.\//, 'shortened local repository paths'],
  ]

  for (const [pattern, description] of forbiddenPathPatterns) {
    assert(!pattern.test(appSource), `Fake CLI providers must not expose ${description}`)
  }

  assert(appSource.includes("const workspacePath = '~/workspace'"), 'fake CLI providers must use a neutral workspace path')
})

test('terminal keyboard capture supports IME-composed input', () => {
  assert(
    appSource.includes('handleKeyboardCaptureChange'),
    'terminal input must read committed input values from an onChange handler',
  )
  assert(
    appSource.includes('onChange={handleKeyboardCaptureChange}'),
    'terminal input must wire onChange so IME-composed text can update UI state',
  )
  assert(
    appSource.includes('event.isComposing'),
    'terminal key handling must ignore composition keydown events',
  )
  assert(
    !/className='keyboard-capture'[\s\S]*?readOnly[\s\S]*?\/>/m.test(appSource),
    'terminal input must not be readOnly because IME composition cannot commit into a readonly input',
  )
})
