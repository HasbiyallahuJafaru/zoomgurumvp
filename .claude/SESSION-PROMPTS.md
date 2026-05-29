# ZoomGuru MVP — Session Prompts
# One prompt per file. Copy exactly. Paste into Claude Code.
# Apply in order. tsc --noEmit after every file.
# Zero errors before moving to next prompt.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION STARTER — Paste this FIRST in every Claude Code session
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read .claude/BIBLE.md first.
Read .claude/CLAUDE.md second.
Read the specific .claude doc for the file I am about to generate.

Rules:
- Complete files only. First line to last line.
- tsc --noEmit must pass after every file.
- State what you will import and export BEFORE generating.
- One file per prompt. Confirm before next.
- No TODOs. No placeholders. No assumed APIs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BACKEND — Generate in this order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─────────────────────────────────────────────────────────────
BACKEND FILE 1 — database/db.ts
─────────────────────────────────────────────────────────────

Read .claude/BACKEND.md and .claude/DATABASE.md.

Generate COMPLETE apps/backend/src/database/db.ts

Requirements:
- Import neon and NeonQueryFunction from @neondatabase/serverless
- Export one function: getDB()
- getDB() returns a singleton neon client
- If DATABASE_URL is not set, throw Error('DATABASE_URL not set')
- Module-level singleton pattern (_sql variable)
- TypeScript strict compliant
- No other exports

Pre-declaration:
  Imports from: @neondatabase/serverless
  Exports: getDB function
  Dependencies: process.env.DATABASE_URL

Generate the complete file. Then confirm:
npx tsc --noEmit → must show zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 2 — database/init.ts
─────────────────────────────────────────────────────────────

Read .claude/DATABASE.md.

Generate COMPLETE apps/backend/src/database/init.ts

Requirements:
- Import getDB from ./db
- Export one async function: initDB()
- initDB creates pgcrypto extension
- initDB creates users table (see DATABASE.md schema)
- Wraps in try/catch with retry (max 3 attempts, 2s backoff)
- Logs ✅ ZoomGuru DB ready on success
- No other exports

Pre-declaration:
  Imports from: ./db
  Exports: initDB function
  Side effects: creates DB tables on Neon

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 3 — auth/jwt.strategy.ts
─────────────────────────────────────────────────────────────

Read .claude/BACKEND.md.

Generate COMPLETE apps/backend/src/auth/jwt.strategy.ts

Requirements:
- Import Injectable from @nestjs/common
- Import PassportStrategy from @nestjs/passport
- Import ExtractJwt, Strategy from passport-jwt
- Class JwtStrategy extends PassportStrategy(Strategy)
- Constructor: super with fromAuthHeaderAsBearerToken()
  and secret from process.env.JWT_SECRET
- validate(payload): returns { userId: payload.sub, email: payload.email }
- Decorated with @Injectable()

Pre-declaration:
  Imports from: @nestjs/common, @nestjs/passport, passport-jwt
  Exports: JwtStrategy class

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 4 — auth/auth.service.ts
─────────────────────────────────────────────────────────────

Read .claude/BACKEND.md and .claude/DATABASE.md.

Generate COMPLETE apps/backend/src/auth/auth.service.ts

Requirements:
- Import Injectable, UnauthorizedException from @nestjs/common
- Import JwtService from @nestjs/jwt
- Import bcryptjs (import * as bcrypt)
- Import getDB from ../database/db
- Class AuthService with constructor(private jwtService: JwtService)

- Method: async login(identifier: string, password: string)
  - identifier can be email OR username
  - Query: SELECT id, email, name, username, password_hash
    FROM users WHERE email = $1 OR username = $1 LIMIT 1
  - If no user: throw UnauthorizedException('Invalid credentials')
  - bcrypt.compare password against password_hash
  - If no match: throw UnauthorizedException('Invalid credentials')
  - Generate JWT: jwtService.sign({ sub: user.id, email: user.email })
    with expiresIn: '30d'
  - Return: { accessToken, user: { id, email, name, username } }

Pre-declaration:
  Imports from: @nestjs/common, @nestjs/jwt, bcryptjs, ../database/db
  Exports: AuthService class
  Methods: login(identifier, password)

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 5 — auth/auth.controller.ts
─────────────────────────────────────────────────────────────

Read .claude/BACKEND.md.

Generate COMPLETE apps/backend/src/auth/auth.controller.ts

Requirements:
- Imports: Controller, Post, Body, Headers from @nestjs/common
- Import AuthService from ./auth.service
- Class AuthController with constructor(private authService: AuthService)

- @Post('login') endpoint:
  - @Body() body: { email: string; password: string }
  - @Headers('x-device-id') deviceId: string
  - Calls authService.login(body.email, body.password)
  - deviceId is received but not used in MVP
    (just log it: console.log('Device:', deviceId))
  - Returns the result of authService.login()

Pre-declaration:
  Imports from: @nestjs/common, ./auth.service
  Exports: AuthController class
  Endpoints: POST /auth/login

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 6 — auth/auth.module.ts
─────────────────────────────────────────────────────────────

Read .claude/BACKEND.md.

Generate COMPLETE apps/backend/src/auth/auth.module.ts

Requirements:
- Import Module from @nestjs/common
- Import JwtModule from @nestjs/jwt
- Import PassportModule from @nestjs/passport
- Import AuthController, AuthService, JwtStrategy
- @Module decorator:
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'local_dev_secret',
      signOptions: { expiresIn: '30d' },
    }),
  ]
  controllers: [AuthController]
  providers: [AuthService, JwtStrategy]
  exports: [AuthService, JwtModule]

Pre-declaration:
  Imports from: @nestjs/common, @nestjs/jwt, @nestjs/passport,
                ./auth.controller, ./auth.service, ./jwt.strategy
  Exports: AuthModule class

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 7 — ai/ai.service.ts
─────────────────────────────────────────────────────────────

Read .claude/BACKEND.md.

Generate COMPLETE apps/backend/src/ai/ai.service.ts

Requirements:
- Import Injectable from @nestjs/common
- Import ServerResponse from http
- Class AiService

SYSTEM PROMPT (hardcoded, no CV for MVP):
  const BASE_SYSTEM_PROMPT = `You are ZoomGuru, an AI interview
  assistant. Answer the interview question clearly and confidently,
  as if speaking directly to the interviewer. Be concise and
  professional. For coding: show approach then code.
  For behavioral: use STAR format naturally.
  Keep answers to 3-6 sentences unless more depth is needed.`

QUESTION ROUTER (simple keyword detection):
  private routeModel(text: string): 'deepseek-chat' | 'deepseek-reasoner'
  - Check for coding keywords: implement, algorithm, complexity,
    leetcode, function, code, binary, array, tree, graph, dynamic
  - Check for system design: design, architect, scale, system,
    microservice, database, cache, load balancer
  - Check for math: calculate, probability, formula, proof, derive
  - If any match: return 'deepseek-reasoner'
  - Otherwise: return 'deepseek-chat'

METHOD: async streamAnswer(params: {
  transcript: string,
  reply: ServerResponse
})
  - Detect model via routeModel(transcript)
  - Call DeepSeek API:
    URL: https://api.deepseek.com/chat/completions
    Method: POST
    Headers: Authorization: Bearer process.env.DEEPSEEK_API_KEY
    Body: {
      model: detected model,
      messages: [
        { role: 'system', content: BASE_SYSTEM_PROMPT },
        { role: 'user', content: transcript }
      ],
      stream: true,
      max_tokens: 1500,
      temperature: 0.7
    }
  - Use AbortController with 30 second timeout
  - Stream chunks to reply using SSE format:
    reply.write(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`)
  - On completion: reply.write(`data: ${JSON.stringify({ done: true })}\n\n`)
  - reply.end()

METHOD: async streamScreenshot(params: {
  image: string,
  reply: ServerResponse
})
  - Step 1: Call Qwen VL to describe the image:
    URL: https://dashscope.aliyuncs.com/api/v1/services/aigc/
         multimodal-generation/generation
    Method: POST
    Headers: Authorization: Bearer process.env.QWEN_API_KEY
    Body: {
      model: 'qwen-vl-max',
      input: {
        messages: [{
          role: 'user',
          content: [
            { image: `data:image/png;base64,${image}` },
            { text: 'Describe exactly what is on this screen.
              If there is code, extract it completely.
              If there is a question, write it out exactly.' }
          ]
        }]
      }
    }
  - Extract description from response:
    visionData.output.choices[0].message.content[0].text
  - Step 2: Send description to deepseek-reasoner same as streamAnswer
    but with transcript = screenContent

Both methods must handle errors gracefully:
  - On fetch error: write error chunk then done
  - On timeout (AbortError): write timeout message then done

Pre-declaration:
  Imports from: @nestjs/common, http
  Exports: AiService class
  External calls: DeepSeek API, Qwen VL API
  Env vars used: DEEPSEEK_API_KEY, QWEN_API_KEY

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 8 — ai/ai.controller.ts
─────────────────────────────────────────────────────────────

Read .claude/BACKEND.md.

Generate COMPLETE apps/backend/src/ai/ai.controller.ts

Requirements:
- Imports: Controller, Post, Body, Req, Res, UseGuards
  from @nestjs/common
- Import AuthGuard from @nestjs/passport
- Import AiService from ./ai.service
- Import FastifyReply from fastify
- Class AiController

- @Post('stream') endpoint:
  - @UseGuards(AuthGuard('jwt'))
  - @Body() body: { transcript: string; sessionId?: string }
  - @Res() reply: FastifyReply
  - Write SSE headers:
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
  - Call aiService.streamAnswer({
      transcript: body.transcript,
      reply: reply.raw
    })

- @Post('screenshot') endpoint:
  - @UseGuards(AuthGuard('jwt'))
  - @Body() body: { image: string; sessionId?: string }
  - @Res() reply: FastifyReply
  - Same SSE headers as above
  - Call aiService.streamScreenshot({
      image: body.image,
      reply: reply.raw
    })

Pre-declaration:
  Imports from: @nestjs/common, @nestjs/passport, fastify, ./ai.service
  Exports: AiController class
  Endpoints: POST /ai/stream, POST /ai/screenshot
  Auth: JWT on both endpoints

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 9 — ai/ai.module.ts
─────────────────────────────────────────────────────────────

Generate COMPLETE apps/backend/src/ai/ai.module.ts

Simple module wiring:
  imports: [AuthModule] (for JwtModule re-export)
  controllers: [AiController]
  providers: [AiService]

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 10 — app.module.ts
─────────────────────────────────────────────────────────────

Generate COMPLETE apps/backend/src/app.module.ts

Requirements:
- Import Module from @nestjs/common
- Import AuthModule from ./auth/auth.module
- Import AiModule from ./ai/ai.module
- @Module({ imports: [AuthModule, AiModule] })
- Export AppModule class

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
BACKEND FILE 11 — main.ts
─────────────────────────────────────────────────────────────

Read .claude/BACKEND.md.

Generate COMPLETE apps/backend/src/main.ts

Requirements:
- Import NestFactory from @nestjs/core
- Import NestFastifyApplication, FastifyAdapter from @nestjs/platform-fastify
- Import AppModule from ./app.module
- Import initDB from ./database/init

- Env validation at very start of bootstrap():
  const REQUIRED = ['DATABASE_URL', 'JWT_SECRET', 'DEEPSEEK_API_KEY', 'QWEN_API_KEY'];
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length) {
    console.error('❌ Missing env vars:', missing.join(', '));
    process.exit(1);
  }

- Create app with FastifyAdapter({ logger: false })
- enableCors({ origin: true, credentials: true })
- await initDB()
- await app.listen(process.env.PORT || 3000, '0.0.0.0')
- console.log('✅ ZoomGuru backend: http://localhost:3000')

Generate complete file. tsc --noEmit. Zero errors.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ELECTRON — Generate in this order
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

─────────────────────────────────────────────────────────────
ELECTRON FILE 1 — src/global.d.ts
─────────────────────────────────────────────────────────────

Read .claude/ELECTRON.md — IPC Channels section.

Generate COMPLETE apps/electron/src/global.d.ts

This file defines the TypeScript type for window.zoomguru.
It must match preload.ts EXACTLY.

Requirements:
- Interface ZoomGuruBridge with these methods ONLY:
  onTrigger(event: string, callback: (...args: any[]) => void): void
  captureScreen(): Promise<string>
  getDeviceId(): Promise<string>
  hideWindow(): Promise<void>

- Extend the global Window interface:
  declare global {
    interface Window {
      zoomguru: ZoomGuruBridge
    }
  }

- export {} at the bottom (makes it a module)

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
ELECTRON FILE 2 — electron/fingerprint.ts
─────────────────────────────────────────────────────────────

This file already exists and works. Do not regenerate it.
Verify it exports getDeviceFingerprint(): string.
If it does: SKIP this prompt.

─────────────────────────────────────────────────────────────
ELECTRON FILE 3 — electron/capture.ts
─────────────────────────────────────────────────────────────

This file already exists and works. Do not regenerate it.
Verify it exports initCapture(win: BrowserWindow): void.
If it does: SKIP this prompt.

─────────────────────────────────────────────────────────────
ELECTRON FILE 4 — electron/preload.ts
─────────────────────────────────────────────────────────────

Read .claude/ELECTRON.md — IPC Channels section.

Generate COMPLETE apps/electron/electron/preload.ts

Requirements:
- Import contextBridge, ipcRenderer from electron
- contextBridge.exposeInMainWorld('zoomguru', {

  onTrigger: (event: string, callback: (...args: any[]) => void) => {
    const channel = `trigger:${event}`;
    ipcRenderer.removeAllListeners(channel);
    ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },

  captureScreen: (): Promise<string> =>
    ipcRenderer.invoke('capture:screen'),

  getDeviceId: (): Promise<string> =>
    ipcRenderer.invoke('device:fingerprint'),

  hideWindow: (): Promise<void> =>
    ipcRenderer.invoke('window:hide'),
})

THIS IS THE COMPLETE BRIDGE. Nothing else.
No Google OAuth. No store. No speech. No openExternal.
MVP only.

Pre-declaration:
  Imports from: electron
  Exposes: onTrigger, captureScreen, getDeviceId, hideWindow
  Must match global.d.ts exactly

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
ELECTRON FILE 5 — electron/main.ts
─────────────────────────────────────────────────────────────

Read .claude/ELECTRON.md completely.

Generate COMPLETE apps/electron/electron/main.ts

Requirements:

IMPORTS:
  app, BrowserWindow, globalShortcut, ipcMain,
  Tray, Menu from electron
  path from path
  Store from electron-store
  initCapture from ./capture
  getDeviceFingerprint from ./fingerprint

MODULE-LEVEL VARIABLES:
  let mainWindow: BrowserWindow | null = null
  let tray: Tray | null = null
  let isQuitting = false
  const fingerprint = getDeviceFingerprint()
  const store = new Store()

FUNCTION createWindow():
  - Create BrowserWindow with EXACT options from ELECTRON.md
  - transparent: process.platform === 'darwin'
  - backgroundColor: process.platform === 'win32' ? '#00000001' : '#00000000'
  - show: false (never show before protection applied)
  - Call setContentProtection(true) BEFORE any show
  - On Windows: re-apply after first show event
  - setAlwaysOnTop(true, 'screen-saver')
  - setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  - Restore saved position from store or default to right side
  - Save position on 'moved' event
  - Load http://localhost:5173 in development
  - Load dist/index.html in production
  - ready-to-show: show window (protection already applied)
  - close event: preventDefault if !isQuitting, hide instead

FUNCTION createTray():
  - Load icon from ../assets/tray-icon.png
  - Context menu: Show ZoomGuru, Hide ZoomGuru, separator, Quit
  - Quit sets isQuitting = true before app.quit()
  - Single click toggles visible/hidden

FUNCTION registerHotkeys():
  - Cmd/Ctrl+Shift+A: send trigger:listen to renderer
  - Cmd/Ctrl+Shift+S: send trigger:screenshot to renderer
  - Cmd/Ctrl+Shift+H: toggle mainWindow visible/hidden directly
  - Cmd/Ctrl+Shift+C: send trigger:clear to renderer

FUNCTION registerIpcHandlers():
  - window:hide: mainWindow?.hide()
  - device:fingerprint: return fingerprint

APP LIFECYCLE:
  app.whenReady():
    createWindow()
    createTray()
    registerHotkeys()
    registerIpcHandlers()
    initCapture(mainWindow!)

  window-all-closed: quit if not darwin
  will-quit: unregister all shortcuts
  activate (macOS): recreate if no windows

NO auto-updater. NO deep link handler.
NO protection self-test. NO Google OAuth.
MVP only.

Pre-declaration:
  Imports from: electron, path, electron-store, ./capture, ./fingerprint
  IPC handlers registered: window:hide, device:fingerprint
  IPC handlers in initCapture: capture:screen
  Push channels sent: trigger:listen, trigger:screenshot,
                      trigger:clear

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
ELECTRON FILE 6 — src/auth/Login.tsx
─────────────────────────────────────────────────────────────

Read .claude/ELECTRON.md.

Generate COMPLETE apps/electron/src/auth/Login.tsx

Requirements:
- 'use client' NOT needed (this is Electron renderer, not Next.js)
- Import useState from react
- Props interface: { onLogin: (user: any) => void }

STATE:
  identifier: string (email or username)
  password: string
  error: string
  loading: boolean

CONSTANTS:
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

handleSubmit(e: React.FormEvent):
  - e.preventDefault()
  - setError(''), setLoading(true)
  - const deviceId = await window.zoomguru.getDeviceId()
  - fetch POST `${API_URL}/auth/login`:
    headers: {
      'Content-Type': 'application/json',
      'X-Device-ID': deviceId
    }
    body: JSON.stringify({ email: identifier, password })
  - On success: onLogin(data.user)
    Store: localStorage.setItem('access_token', data.accessToken)
  - On failure: setError(data.message || 'Login failed')
  - finally: setLoading(false)

UI (dark theme, matches ELECTRON.md Overlay UI spec):
  - Dark container filling viewport
  - Centered card (360px wide max)
  - "ZoomGuru" title
  - "Your invisible interview edge" subtitle
  - Input: Email or username (type text)
  - Input: Password (type password)
  - Error message (red) if error
  - Submit button: "Sign In" / "Signing in..."
  - No Google button. No register link. MVP only.
  - ✕ button top-right calls window.zoomguru.hideWindow()

Use className with CSS from index.css OR pure inline styles.
No external UI library.

Pre-declaration:
  Imports from: react
  Uses: window.zoomguru.getDeviceId(), window.zoomguru.hideWindow()
  Calls: POST /auth/login

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
ELECTRON FILE 7 — src/overlay/AnswerStream.tsx
─────────────────────────────────────────────────────────────

Generate COMPLETE apps/electron/src/overlay/AnswerStream.tsx

Simple component. Renders streaming answer text.

Props: { answer: string; isStreaming: boolean }

UI:
  - Scrollable div filling available height
  - answer text rendered with white-space: pre-wrap
  - Font: system-ui, 13px, color white, line-height 1.6
  - Padding: 16px
  - When isStreaming and no answer yet: show "Thinking..."
    in muted color with a subtle animation
  - When answer exists: render the text
  - Auto-scroll to bottom as new content arrives
    (use useEffect with ref on the scroll container)

No external dependencies.

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
ELECTRON FILE 8 — src/overlay/Overlay.tsx
─────────────────────────────────────────────────────────────

Read .claude/ELECTRON.md completely — Overlay UI Spec
and Streaming Implementation sections.

Generate COMPLETE apps/electron/src/overlay/Overlay.tsx

IMPORTS:
  useState, useEffect, useRef from react
  AnswerStream from ./AnswerStream

CONSTANTS:
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

STATE:
  answer: string
  isStreaming: boolean
  isListening: boolean
  isOnline: boolean (navigator.onLine)
  lastTranscript: string (for regenerate)
  lastImage: string (for regenerate)

useEffect (mount only, [] deps):
  Register all hotkey listeners (remove before re-adding):
    window.zoomguru.onTrigger('listen', handleListen)
    window.zoomguru.onTrigger('screenshot', handleScreenshot)
    window.zoomguru.onTrigger('clear', handleClear)
  Online/offline listeners

handleListen():
  - If isStreaming or isListening: return
  - Check mic permission via navigator.mediaDevices.getUserMedia
  - If denied: setAnswer('⚠ Mic access denied...')
  - Use Web Speech API (SpeechRecognition || webkitSpeechRecognition)
  - If not available: setAnswer('⚠ Speech not available')
  - setIsListening(true)
  - On result: setIsListening(false), streamAnswer(transcript)
  - On error/end: setIsListening(false)

handleScreenshot():
  - If isStreaming: return
  - const imageBase64 = await window.zoomguru.captureScreen()
  - setLastImage(imageBase64)
  - streamScreenshot(imageBase64)

handleClear():
  - setAnswer('')
  - setIsStreaming(false)
  - setLastTranscript('')
  - setLastImage('')

async streamAnswer(transcript: string):
  - setAnswer(''), setIsStreaming(true)
  - const token = localStorage.getItem('access_token') || ''
  - const deviceId = await window.zoomguru.getDeviceId()
  - fetch POST ${API_URL}/ai/stream:
    headers: Authorization Bearer, Content-Type, X-Device-ID
    body: { transcript }
  - Use ReadableStream pattern from ELECTRON.md spec exactly
  - On error: setAnswer('⚠ Connection error. Try again.')
  - finally: setIsStreaming(false)

async streamScreenshot(imageBase64: string):
  - Same pattern as streamAnswer but:
  - POST to ${API_URL}/ai/screenshot
  - body: { image: imageBase64 }

UI (from ELECTRON.md Overlay UI Spec):
  Root div: position fixed, inset 0
    background: rgba(8, 8, 14, 0.20)  ← 20% opacity HARDCODED
    backdropFilter: blur(4px)
    borderRadius: 16px
    border: 1px solid rgba(255,255,255,0.08)
    display flex, flexDirection column

  Header (40px, WebkitAppRegion drag):
    Left: "ZoomGuru" (white, 13px, bold)
    Right indicators:
      if isListening: "● Listening..." green
      if isStreaming: "● Thinking..." blue
      if !isOnline: "⚠ No connection" red
    ✕ button (WebkitAppRegion no-drag):
      calls window.zoomguru.hideWindow()

  AnswerStream component (flex 1):
    answer={answer} isStreaming={isStreaming}

  Footer (32px):
    "⌘⇧A Listen  ⌘⇧S Screen  ⌘⇧C Clear"
    font 10px, rgba(255,255,255,0.25)

NO mode bar. NO opacity slider. NO copy button.
NO paywall. NO upgrade button. MVP only.

Pre-declaration:
  Imports from: react, ./AnswerStream
  Uses: window.zoomguru.onTrigger, captureScreen, getDeviceId, hideWindow
  Calls: POST /ai/stream, POST /ai/screenshot

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
ELECTRON FILE 9 — src/App.tsx
─────────────────────────────────────────────────────────────

Generate COMPLETE apps/electron/src/App.tsx

Simple gate: show Login until token exists, then show Overlay.

Requirements:
  import useState from react
  import Login from ./auth/Login
  import Overlay from ./overlay/Overlay

  const App = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(
      () => !!localStorage.getItem('access_token')
    )

    if (!isLoggedIn) {
      return <Login onLogin={() => setIsLoggedIn(true)} />
    }

    return <Overlay />
  }

  export default App

Nothing else. No onboarding. No paywall gate. MVP only.

Generate complete file. tsc --noEmit. Zero errors.

─────────────────────────────────────────────────────────────
ELECTRON FILE 10 — src/index.css
─────────────────────────────────────────────────────────────

Generate COMPLETE apps/electron/src/index.css

Requirements:
  * { box-sizing: border-box; margin: 0; padding: 0 }

  body {
    background: transparent !important
    font-family: system-ui, -apple-system, sans-serif
    -webkit-font-smoothing: antialiased
    overflow: hidden
    user-select: none
  }

  @keyframes pulse {
    0%, 100% { opacity: 1 }
    50% { opacity: 0.4 }
  }

  /* Login styles */
  .auth-container — dark, full viewport, centered
  .auth-card — 360px, dark surface, rounded, border
  .auth-title — large, white, bold
  .auth-subtitle — small, muted
  .form-group — margin bottom
  .form-label — small caps, muted
  .form-input — dark bg, white text, rounded, focus ring
  .form-error — red text, red bg tint
  .btn-primary — gradient blue/purple, white text, full width
  .btn-close — absolute top right, ghost style

  Use only these CSS classes. No external fonts.
  Keep it clean and dark.

Generate complete file.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FINAL VERIFICATION AFTER ALL FILES GENERATED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Run in order:

1. cd apps/backend && npx tsc --noEmit
   Expected: no output (zero errors)

2. cd apps/electron && npx tsc --noEmit
   Expected: no output (zero errors)

3. Run Integration Audit from BIBLE.md
   Check all 5 integration points

4. Only then: npm run start:dev (backend) + npm run dev (electron)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
END OF SESSION PROMPTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
