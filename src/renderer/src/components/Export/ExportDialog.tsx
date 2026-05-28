import React, { useState } from 'react'
import { X, Download, Globe, AlertTriangle } from 'lucide-react'
import { useProjectStore } from '../../stores/projectStore'

interface Props {
  onClose: () => void
}

type Format = 'html' | 'markdown' | 'docx'

const DOCX_PROFILES = [
  { id: 'draft', label: 'Draft', description: 'A4, 1.5× spacing, Calibri' },
  { id: 'editor-review', label: 'Editor Review', description: 'A4, double spacing, metadata page' },
  { id: 'manuscript', label: 'Manuscript', description: 'Letter, double spacing, Times New Roman' }
]

interface DocxResult {
  success: boolean
  outputPath?: string
  warnings?: Array<{ code: string; message: string }>
  error?: string
}

export function ExportDialog({ onClose }: Props): React.ReactElement {
  const { volumes, languageConfig } = useProjectStore()
  const [format, setFormat] = useState<Format>('html')
  const [scope, setScope] = useState<'project' | 'volume'>('project')
  const [volumeId, setVolumeId] = useState('')
  const [locale, setLocale] = useState<string>('')
  const [fallbackToOriginal, setFallbackToOriginal] = useState(true)
  const [includeTitle, setIncludeTitle] = useState(true)
  const [chapterNumbering, setChapterNumbering] = useState(false)
  const [docxProfileId, setDocxProfileId] = useState('draft')
  const [exporting, setExporting] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; outputPath?: string; error?: string } | null>(null)
  const [docxWarnings, setDocxWarnings] = useState<Array<{ code: string; message: string }>>([])

  const hasLanguages = languageConfig.languages.length > 0

  const handleExport = async (): Promise<void> => {
    setExporting(true)
    setResult(null)
    setDocxWarnings([])
    try {
      if (format === 'docx') {
        const scopeObj = scope === 'volume' && volumeId
          ? { type: 'volume', volumeId }
          : { type: 'project' }
        const res = await window.api.export.docx({
          scope: scopeObj,
          profileId: docxProfileId,
          locale: locale || undefined,
          fallbackToOriginal: locale ? fallbackToOriginal : undefined
        }) as DocxResult
        if (res.warnings && res.warnings.length > 0) setDocxWarnings(res.warnings)
        setResult({ success: res.success, outputPath: res.outputPath, error: res.error })
      } else {
        const res = await window.api.export.run({
          name: 'Export',
          format,
          scope,
          volume_id: scope === 'volume' ? volumeId : undefined,
          includeTitle,
          chapterNumbering,
          locale: locale || undefined,
          fallbackToOriginal: locale ? fallbackToOriginal : undefined
        })
        if (!res.canceled) setResult(res)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-accent" />
            <h2 className="font-semibold text-ink">Export</h2>
          </div>
          <button className="p-1 rounded hover:bg-surface-100 text-ink-muted" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Format */}
          <div>
            <label className="text-xs font-medium text-ink-muted">Format</label>
            <div className="flex gap-2 mt-1">
              {(['html', 'markdown', 'docx'] as const).map(f => (
                <button
                  key={f}
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${format === f ? 'bg-accent text-white border-accent' : 'border-surface-300 text-ink-muted hover:border-accent'}`}
                  onClick={() => setFormat(f)}
                >
                  {f === 'html' ? 'HTML' : f === 'markdown' ? 'Markdown' : 'DOCX'}
                </button>
              ))}
            </div>
          </div>

          {/* DOCX Profile selector */}
          {format === 'docx' && (
            <div>
              <label className="text-xs font-medium text-ink-muted">Profile</label>
              <div className="mt-1 space-y-1">
                {DOCX_PROFILES.map(p => (
                  <button
                    key={p.id}
                    className={`w-full flex items-start gap-3 px-3 py-2 rounded border text-left transition-colors ${docxProfileId === p.id ? 'bg-accent/10 border-accent' : 'border-surface-200 hover:border-accent/50'}`}
                    onClick={() => setDocxProfileId(p.id)}
                  >
                    <div className={`mt-0.5 w-3 h-3 rounded-full border-2 flex-shrink-0 ${docxProfileId === p.id ? 'bg-accent border-accent' : 'border-surface-400'}`} />
                    <div>
                      <p className={`text-sm font-medium ${docxProfileId === p.id ? 'text-accent' : 'text-ink'}`}>{p.label}</p>
                      <p className="text-xs text-ink-muted">{p.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Scope */}
          <div>
            <label className="text-xs font-medium text-ink-muted">Scope</label>
            <div className="flex gap-2 mt-1">
              {(['project', 'volume'] as const).map(s => (
                <button
                  key={s}
                  className={`flex-1 py-1.5 text-sm rounded border transition-colors ${scope === s ? 'bg-accent text-white border-accent' : 'border-surface-300 text-ink-muted hover:border-accent'}`}
                  onClick={() => setScope(s)}
                >
                  {s === 'project' ? 'Full Project' : 'One Volume'}
                </button>
              ))}
            </div>
          </div>

          {scope === 'volume' && (
            <div>
              <label className="text-xs font-medium text-ink-muted">Volume</label>
              <select className="input mt-1 text-sm" value={volumeId} onChange={e => setVolumeId(e.target.value)}>
                <option value="">Select volume…</option>
                {volumes.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
              </select>
            </div>
          )}

          {/* Language */}
          <div>
            <label className="text-xs font-medium text-ink-muted flex items-center gap-1">
              <Globe className="w-3 h-3" /> Language
            </label>
            <select className="input mt-1 text-sm" value={locale} onChange={e => setLocale(e.target.value)}>
              <option value="">Original</option>
              {languageConfig.languages.map(l => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            {!hasLanguages && (
              <p className="text-[10px] text-ink-faint mt-1">Add languages in the Translations sidebar to export translations.</p>
            )}
          </div>

          {locale && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={fallbackToOriginal} onChange={e => setFallbackToOriginal(e.target.checked)} className="rounded" />
              <span className="text-ink-muted">Fall back to original for untranslated chapters</span>
            </label>
          )}

          {/* HTML/Markdown-only options */}
          {format !== 'docx' && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={chapterNumbering} onChange={e => setChapterNumbering(e.target.checked)} className="rounded" />
                <span className="text-ink-muted">Chapter numbering</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={includeTitle} onChange={e => setIncludeTitle(e.target.checked)} className="rounded" />
                <span className="text-ink-muted">Include titles</span>
              </label>
            </div>
          )}

          {result?.success && (
            <p className="text-xs text-green-600 bg-green-50 px-3 py-2 rounded">
              Exported to: {result.outputPath}
            </p>
          )}
          {result?.error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded">{result.error}</p>
          )}
          {docxWarnings.length > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded space-y-1">
              <div className="flex items-center gap-1 font-medium">
                <AlertTriangle className="w-3 h-3" />
                {docxWarnings.length} warning{docxWarnings.length > 1 ? 's' : ''}
              </div>
              {docxWarnings.slice(0, 3).map((w, i) => (
                <p key={i} className="text-ink-muted">{w.message}</p>
              ))}
              {docxWarnings.length > 3 && <p className="text-ink-faint">…and {docxWarnings.length - 3} more</p>}
            </div>
          )}

          <button
            className="btn-primary w-full"
            onClick={handleExport}
            disabled={exporting || (scope === 'volume' && !volumeId)}
          >
            {exporting
              ? 'Exporting…'
              : format === 'docx'
                ? `Export ${locale ? locale.toUpperCase() + ' ' : ''}DOCX`
                : locale
                  ? `Export ${locale.toUpperCase()}`
                  : 'Export Original'}
          </button>
        </div>
      </div>
    </div>
  )
}
