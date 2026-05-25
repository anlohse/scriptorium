import React from 'react'
import { BookOpen, StickyNote, Users, Image, Globe } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { ManuscriptTree } from './ManuscriptTree'
import { NotesTree } from './NotesTree'
import { EntityList } from './EntityList'
import { AssetList } from './AssetList'
import { TranslationList } from './TranslationList'
import type { SidebarSection } from '../../types'

const sections: Array<{ id: SidebarSection; label: string; icon: React.ReactNode }> = [
  { id: 'manuscript', label: 'Manuscript', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'notes', label: 'Notes', icon: <StickyNote className="w-4 h-4" /> },
  { id: 'entities', label: 'Entities', icon: <Users className="w-4 h-4" /> },
  { id: 'assets', label: 'Assets', icon: <Image className="w-4 h-4" /> },
  { id: 'translations', label: 'Translate', icon: <Globe className="w-4 h-4" /> }
]

export function Sidebar(): React.ReactElement {
  const { activeSection, setActiveSection } = useUIStore()

  return (
    <aside className="h-full bg-surface-100 border-r border-surface-200 flex flex-col overflow-hidden">
      {/* Section tabs */}
      <div className="flex border-b border-surface-200 bg-surface-50 flex-shrink-0">
        {sections.map(s => (
          <button
            key={s.id}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              activeSection === s.id
                ? 'text-accent border-b-2 border-accent -mb-px bg-surface-100'
                : 'text-ink-muted hover:text-ink'
            }`}
            onClick={() => setActiveSection(s.id)}
            title={s.label}
          >
            {s.icon}
            <span className="text-[9px]">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeSection === 'manuscript' && <ManuscriptTree />}
        {activeSection === 'notes' && <NotesTree />}
        {activeSection === 'entities' && <EntityList />}
        {activeSection === 'assets' && <AssetList />}
        {activeSection === 'translations' && <TranslationList />}
      </div>
    </aside>
  )
}
