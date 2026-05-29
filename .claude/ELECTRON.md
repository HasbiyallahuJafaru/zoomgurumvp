# ZoomGuru MVP — Electron App

## Purpose
Transparent always-on-top overlay that is invisible
to screen share software. Streams AI answers to the user
during live interviews.

---

## File Structure (MVP — nothing else)

```
apps/electron/
├── electron/
│   ├── main.ts          ← window creation, hotkeys, IPC handlers
│   ├── preload.ts       ← context bridge — renderer ↔ main
│   ├── capture.ts       ← desktopCapturer screenshot
│   └── fingerprint.ts   ← device ID generation
├── src/
│   ├── main.tsx         ← React entry point
│   ├── App.tsx          ← login gate → overlay switch
│   ├── auth/
│   │   └── Login.tsx    ← email + password form
│   ├── overlay/
│   │   ├── Overlay.tsx  ← main overlay UI + streaming
│   │   └── AnswerStream.tsx ← renders streaming text
│   └── global.d.ts      ← window.zoomguru type definition
├── .env                 ← local env vars
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Window Configuration

```typescript
// Exact BrowserWindow options — do not change these
{
  width: 420,
  height: 600,
  frame: false,
  transparent: process.platform === 'darwin',
  backgroundColor: process.platform === 'win32'
    ? '#00000001'
    : '#00000000',
  alwaysOnTop: true,
  skipTaskbar: true,
  resizable: true,
  movable: true,
  hasShadow: false,
  show: false,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    devTools: true,  // always on for local MVP
  }
}
```

---

## Screen Share Exclusion

```typescript
// macOS
win.setContentProtection(true);

// Windows
win.setContentProtection(true);
// Re-apply after first show
win.once('show', () => win.setContentProtection(true));
```

Must be called BEFORE win.show().

---

## IPC Channels — Complete Map

Every channel must exist in ALL FOUR places.
This table is the contract. Do not deviate from it.

```
Channel           main.ts handler      preload.ts expose    renderer usage
─────────────────────────────────────────────────────────────────────────
capture:screen    initCapture()        captureScreen()      Overlay.tsx
device:fingerprint registerIpcHandlers  getDeviceId()        Login.tsx
window:hide       registerIpcHandlers  hideWindow()         Overlay.tsx + Login.tsx
─────────────────────────────────────────────────────────────────────────

Push channels (main → renderer, no handler needed):
trigger:listen    globalShortcut       onTrigger('listen')  Overlay.tsx
trigger:screenshot globalShortcut      onTrigger('screenshot') Overlay.tsx
trigger:clear     globalShortcut       onTrigger('clear')   Overlay.tsx
trigger:hide      globalShortcut       onTrigger('hide')    App.tsx or Overlay.tsx
```

---

## Global Hotkeys

```
Cmd/Ctrl + Shift + A  →  trigger:listen     (start mic)
Cmd/Ctrl + Shift + S  →  trigger:screenshot (capture screen)
Cmd/Ctrl + Shift + H  →  hide/show window   (direct in main)
Cmd/Ctrl + Shift + C  →  trigger:clear      (clear answer)
```

---

## window.zoomguru Interface (global.d.ts)

```typescript
interface ZoomGuruBridge {
  onTrigger(event: string, callback: (...args: any[]) => void): void
  captureScreen(): Promise<string>
  getDeviceId(): Promise<string>
  hideWindow(): Promise<void>
}

declare global {
  interface Window {
    zoomguru: ZoomGuruBridge
  }
}
```

This must match preload.ts exactly.
Any method added to preload must be added here too.
Any method removed from preload must be removed here too.

---

## Overlay UI Spec

```
Window: 420 × 600px, transparent, no frame

Visual:
  Background: rgba(8, 8, 14, 0.20)  ← 20% opacity
  Backdrop filter: blur(4px)
  Border radius: 16px
  Border: 1px solid rgba(255,255,255,0.08)

Header (40px):
  Left: "ZoomGuru" text (white, 13px, bold)
  Right: ✕ button (calls hideWindow)
  Draggable region: entire header
  ✕ button: WebkitAppRegion no-drag

Answer area (flex 1, scrollable):
  Font: system-ui or Inter, 13px, white
  Line height: 1.6
  Padding: 16px
  Scrolls automatically as content grows

Footer (32px):
  ⌘⇧A Listen  ⌘⇧S Screen  ⌘⇧C Clear
  Font: 10px, rgba(255,255,255,0.25)
  No interactive elements

States:
  Idle:      footer hints visible, answer area empty
  Listening: "● Listening..." shown in header (green)
  Streaming: "● Thinking..." shown in header (blue)
             Answer text builds word by word
  Error:     Error message shown in answer area (red text)
```

---

## Streaming Implementation

Uses fetch() + ReadableStream. NOT EventSource.
EventSource cannot send Authorization headers.

```typescript
// Pattern for both streamAnswer and streamScreenshot
const response = await fetch(`${API_URL}/ai/stream`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Device-ID': deviceId,
  },
  body: JSON.stringify({ transcript, sessionId }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();
let buffer = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.startsWith('data: ')) continue;
    const raw = line.slice(6).trim();
    if (!raw || raw === '[DONE]') continue;
    const data = JSON.parse(raw);
    if (data.done) return;
    if (data.chunk) setAnswer(prev => prev + data.chunk);
  }
}
```

---

## Environment Variables

```env
# apps/electron/.env
VITE_API_URL=http://localhost:3000
VITE_APP_ENV=development
```

```env
# apps/electron/.env.production
VITE_API_URL=https://api.zoomguru.com
VITE_APP_ENV=production
```

VITE_API_URL must always have a fallback:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

---

## Token Storage (Local MVP)

```typescript
// Store in localStorage only for local MVP
// electron-store encryption not needed locally
localStorage.setItem('access_token', data.accessToken);
localStorage.setItem('session_id', data.sessionId || '');

// Read back
const token = localStorage.getItem('access_token') || '';
```

---

## Vite Config Requirements

```typescript
// vite.config.ts must:
// 1. Inject VITE_* vars into electron subprocess builds
// 2. Use vite-plugin-electron for main + preload
// 3. Use vite-plugin-electron-renderer for renderer

define: {
  'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
  'import.meta.env.VITE_APP_ENV': JSON.stringify(env.VITE_APP_ENV),
}
```

---

## TypeScript Config Requirements

```json
// apps/electron/tsconfig.json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "allowImportingTsExtensions": true
  },
  "include": ["src"],
  "references": [{ "path": "./electron/tsconfig.json" }]
}
```

---

## Compiler Verification

After every generated file:
```bash
cd apps/electron
npx tsc --noEmit
```

Zero errors = ready.
Any errors = fix before proceeding to next file.
