import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance, type Props } from 'tippy.js'
import type { Editor } from '@tiptap/core'
import { MentionList, type MentionListRef } from './MentionList'

interface SuggestionProps {
  editor: Editor
  clientRect?: (() => DOMRect | null) | null
  [key: string]: unknown
}

export const mentionSuggestion = {
  char: '[[',
  allowSpaces: true,

  items: async ({ query }: { query: string }) => {
    const entities = await window.api.entity.search(query)
    return entities.slice(0, 10).map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type
    }))
  },

  render: () => {
    let component: ReactRenderer<MentionListRef>
    let popup: Instance[]

    return {
      onStart: (props: SuggestionProps) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor
        })

        if (!props.clientRect) return

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          theme: 'mentions'
        })
      },

      onUpdate(props: SuggestionProps) {
        component.updateProps(props)
        if (!props.clientRect) return
        popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect })
      },

      onKeyDown(props: { event: KeyboardEvent }) {
        if (props.event.key === 'Escape') {
          popup[0]?.hide()
          return true
        }
        return component.ref?.onKeyDown(props) ?? false
      },

      onExit() {
        popup[0]?.destroy()
        component.destroy()
      }
    }
  }
}
