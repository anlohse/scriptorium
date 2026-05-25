import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react'

export interface MentionItem {
  id: string
  name: string
  type: string
}

interface MentionListProps {
  items: MentionItem[]
  command: (item: { id: string; label: string }) => void
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number): void => {
    const item = props.items[index]
    if (item) props.command({ id: item.id, label: item.name })
  }

  useEffect(() => setSelectedIndex(0), [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex(i => (i + props.items.length - 1) % props.items.length)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex(i => (i + 1) % props.items.length)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    }
  }))

  if (!props.items.length) {
    return <div className="p-2 text-sm text-ink-muted">No entities found</div>
  }

  return (
    <div>
      {props.items.map((item, index) => (
        <div
          key={item.id}
          className={`mention-item ${index === selectedIndex ? 'is-selected' : ''}`}
          onClick={() => selectItem(index)}
        >
          <span>{item.name}</span>
          <span className="mention-item-type ml-auto">{item.type}</span>
        </div>
      ))}
    </div>
  )
})

MentionList.displayName = 'MentionList'
