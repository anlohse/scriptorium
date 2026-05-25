import React, { useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { useUIStore } from '../../stores/uiStore'
import type { Translation, TranslationStatus, Document } from '../../types'
import { Plus, Globe, Trash2, ChevronDown, ChevronRight, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react'

const STATUS_ICON: Record<TranslationStatus, React.ReactNode> = {
  untranslated: <X className="w-3 h-3 text-ink-faint" />,
  draft: <Clock className="w-3 h-3 text-yellow-500" />,
  in_progress: <Clock className="w-3 h-3 text-blue-500" />,
  completed: <CheckCircle className="w-3 h-3 text-green-500" />,
  outdated: <AlertTriangle className="w-3 h-3 text-orange-500" />
}

const STATUS_LABEL: Record<TranslationStatus, string> = {
  untranslated: 'Untranslated',
  draft: 'Draft',
  in_progress: 'In Progress',
  completed: 'Completed',
  outdated: 'Outdated'
}

const COMMON_LOCALES = ['en-US', 'en-GB', 'pt-BR', 'pt-PT', 'es-ES', 'es-MX', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN', 'ko-KR', 'it-IT', 'ru-RU', 'ar-SA']

export function TranslationList(): React.ReactElement {
  const { documents, languageConfig, setLanguageConfig, translations, upsertTranslation, removeTranslation, refreshLanguageConfig, refreshTranslations } = useProjectStore()
  const { setTranslationId, setActiveDocument } = useUIStore()
  const [expandedLocales, setExpandedLocales] = useState<Set<string>>(new Set())
  const [showAddLang, setShowAddLang] = useState(false)
  const [newLocale, setNewLocale] = useState('')
  const [showAddTranslation, setShowAddTranslation] = useState<string | null>(null) // locale
  const [selectedDocId, setSelectedDocId] = useState('')

  const chapters = documents.filter(d => d.type === 'chapter' || d.type === 'scene')

  const toggleLocale = (locale: string): void => {
    setExpandedLocales(prev => {
      const next = new Set(prev)
      if (next.has(locale)) next.delete(locale)
      else next.add(locale)
      return next
    })
  }

  const addLanguage = async (): Promise<void> => {
    const locale = newLocale.trim()
    if (!locale || languageConfig.languages.includes(locale)) return
    const langs = [...languageConfig.languages, locale]
    const defLang = languageConfig.defaultLanguage || locale
    await window.api.project.setLanguages(langs, defLang)
    await refreshLanguageConfig()
    setNewLocale('')
    setShowAddLang(false)
    setExpandedLocales(prev => new Set([...prev, locale]))
  }

  const removeLanguage = async (locale: string): Promise<void> => {
    if (!confirm(`Remove language ${locale}? This will delete all associated translations.`)) return
    const langs = languageConfig.languages.filter(l => l !== locale)
    const defLang = langs[0] || ''
    await window.api.project.setLanguages(langs, defLang)
    // Delete all translations for this locale
    const localeTranslations = translations.filter(t => t.locale === locale)
    await Promise.all(localeTranslations.map(t => window.api.translation.delete(t.id)))
    localeTranslations.forEach(t => removeTranslation(t.id))
    await refreshLanguageConfig()
  }

  const createTranslation = async (locale: string, documentId: string): Promise<void> => {
    const existing = translations.find(t => t.document_id === documentId && t.locale === locale)
    if (existing) { setTranslationId(existing.id); return }
    const t = await window.api.translation.create(documentId, locale)
    upsertTranslation(t)
    setTranslationId(t.id)
    setShowAddTranslation(null)
  }

  const openTranslation = (t: Translation): void => {
    setActiveDocument(t.document_id)
    setTranslationId(t.id)
  }

  const deleteTranslation = async (t: Translation): Promise<void> => {
    await window.api.translation.delete(t.id)
    removeTranslation(t.id)
  }

  const coverageForLocale = (locale: string): { done: number; total: number } => {
    const total = chapters.length
    const done = translations.filter(t => t.locale === locale && (t.status === 'completed' || t.status === 'in_progress')).length
    return { done, total }
  }

  const getDocTitle = (docId: string): string => {
    return documents.find(d => d.id === docId)?.title || 'Unknown'
  }

  if (languageConfig.languages.length === 0) {
    return (
      <div className="flex flex-col gap-3 p-3">
        <div className="text-center py-6">
          <Globe className="w-8 h-8 text-ink-faint mx-auto mb-2" />
          <p className="text-xs text-ink-muted mb-3">No languages configured yet.</p>
          <button
            onClick={() => setShowAddLang(true)}
            className="btn-primary text-xs flex items-center gap-1 mx-auto"
          >
            <Plus className="w-3 h-3" /> Add Language
          </button>
        </div>
        {showAddLang && <AddLanguageForm value={newLocale} onChange={setNewLocale} onAdd={addLanguage} onCancel={() => setShowAddLang(false)} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Languages list */}
      {languageConfig.languages.map(locale => {
        const { done, total } = coverageForLocale(locale)
        const expanded = expandedLocales.has(locale)
        const localeTranslations = translations.filter(t => t.locale === locale)
        const isDefault = locale === languageConfig.defaultLanguage

        return (
          <div key={locale} className="border border-surface-200 rounded-lg overflow-hidden">
            {/* Locale header */}
            <div
              className="flex items-center gap-2 px-2 py-1.5 bg-surface-100 cursor-pointer hover:bg-surface-200 transition-colors"
              onClick={() => toggleLocale(locale)}
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5 text-ink-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-ink-muted" />}
              <Globe className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-medium text-ink flex-1">{locale}</span>
              {isDefault && <span className="text-[9px] bg-accent/10 text-accent px-1 rounded">default</span>}
              <span className="text-[10px] text-ink-faint">{done}/{total}</span>
              <button
                className="p-0.5 hover:text-accent ml-1 text-ink-faint"
                onClick={e => { e.stopPropagation(); setShowAddTranslation(locale) }}
                title="Add translation"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                className="p-0.5 hover:text-red-500 text-ink-faint"
                onClick={e => { e.stopPropagation(); removeLanguage(locale) }}
                title="Remove language"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>

            {/* Coverage bar */}
            <div className="h-0.5 bg-surface-200">
              <div className="h-full bg-green-400 transition-all" style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
            </div>

            {/* Translation items */}
            {expanded && (
              <div className="divide-y divide-surface-100">
                {localeTranslations.length === 0 ? (
                  <p className="text-[10px] text-ink-faint px-3 py-2 italic">No translations yet</p>
                ) : (
                  localeTranslations.map(t => (
                    <div key={t.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-50 group">
                      <span title={STATUS_LABEL[t.status]}>{STATUS_ICON[t.status]}</span>
                      <button
                        className="text-xs text-ink flex-1 text-left truncate hover:text-accent"
                        onClick={() => openTranslation(t)}
                      >
                        {getDocTitle(t.document_id)}
                      </button>
                      <button
                        className="hidden group-hover:block text-ink-faint hover:text-red-500"
                        onClick={() => deleteTranslation(t)}
                        title="Delete translation"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}

                {/* Add translation for this locale */}
                {showAddTranslation === locale && (
                  <div className="px-3 py-2 bg-surface-50">
                    <select
                      className="input text-xs w-full mb-1"
                      value={selectedDocId}
                      onChange={e => setSelectedDocId(e.target.value)}
                    >
                      <option value="">Select document…</option>
                      {chapters.filter(d => !translations.some(t => t.document_id === d.id && t.locale === locale)).map(d => (
                        <option key={d.id} value={d.id}>{d.title}</option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      <button className="btn-primary text-xs py-0.5 flex-1" onClick={() => selectedDocId && createTranslation(locale, selectedDocId)} disabled={!selectedDocId}>Add</button>
                      <button className="btn-ghost text-xs py-0.5" onClick={() => setShowAddTranslation(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add language button */}
      <button
        onClick={() => setShowAddLang(!showAddLang)}
        className="flex items-center gap-1 text-xs text-accent hover:underline px-1"
      >
        <Plus className="w-3 h-3" /> Add Language
      </button>

      {showAddLang && <AddLanguageForm value={newLocale} onChange={setNewLocale} onAdd={addLanguage} onCancel={() => setShowAddLang(false)} />}
    </div>
  )
}

function AddLanguageForm({ value, onChange, onAdd, onCancel }: {
  value: string; onChange: (v: string) => void; onAdd: () => void; onCancel: () => void
}): React.ReactElement {
  return (
    <div className="border border-surface-200 rounded p-2 bg-surface-50">
      <p className="text-[10px] text-ink-faint mb-1">Enter locale code (e.g. en-US, pt-BR, ja-JP)</p>
      <input
        list="common-locales"
        className="input text-xs w-full mb-1"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="en-US"
        onKeyDown={e => e.key === 'Enter' && onAdd()}
        autoFocus
      />
      <datalist id="common-locales">
        {COMMON_LOCALES.map(l => <option key={l} value={l} />)}
      </datalist>
      <div className="flex gap-1">
        <button className="btn-primary text-xs py-0.5 flex-1" onClick={onAdd}>Add</button>
        <button className="btn-ghost text-xs py-0.5" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
