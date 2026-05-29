/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.zoomguru.app',
  productName: 'ZoomGuru',
  copyright: 'Copyright © 2025 ZoomGuru',

  directories: {
    output: 'release',
    buildResources: 'assets',
  },

  files: [
    'dist/**/*',
    'dist-electron/**/*',
    'assets/**/*',
    'package.json',
  ],

  asar: true,
  asarUnpack: [
    'node_modules/pdf-parse/**/*',
  ],

  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'assets/tray-icon.png',
    requestedExecutionLevel: 'asInvoker',
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: false,
    shortcutName: 'ZoomGuru',
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },

  mac: {
    target: [{ target: 'dmg', arch: ['x64', 'arm64'] }],
    icon: 'assets/tray-icon.png',
    category: 'public.app-category.productivity',
    darkModeSupport: true,
    hardenedRuntime: false,
    gatekeeperAssess: false,
    extendInfo: {
      NSMicrophoneUsageDescription: 'ZoomGuru uses your microphone to listen to interview questions.',
      NSScreenCaptureDescription: 'ZoomGuru captures your screen to answer visual questions.',
    },
  },

  dmg: {
    sign: false,
  },
};
