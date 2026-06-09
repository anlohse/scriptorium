import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerDocumentHandlers } from './ipc/documents'
import { registerEntityHandlers } from './ipc/entities'
import { registerSearchHandlers } from './ipc/search'
import { registerExportHandlers } from './ipc/export'
import { registerProjectHandlers } from './ipc/project'
import { registerAssetHandlers } from './ipc/assets'
import { registerTranslationHandlers } from './ipc/translations'
import { registerSpellCheckHandlers } from './ipc/spellcheck'
import { closeDb } from './db'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: true,
    backgroundColor: '#f8f7f4',
    icon: is.dev
      ? join(__dirname, '../../src/assets/ico_128x128.png')
      : join(process.resourcesPath, 'icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.scriptorium.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerProjectHandlers()
  registerDocumentHandlers()
  registerEntityHandlers()
  registerSearchHandlers()
  registerExportHandlers()
  registerAssetHandlers()
  registerTranslationHandlers()
  registerSpellCheckHandlers()

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
