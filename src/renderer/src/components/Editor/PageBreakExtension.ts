import { Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      setPageBreak: () => ReturnType
    }
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  parseHTML() {
    return [{ tag: "div[data-type='page-break']" }]
  },

  renderHTML() {
    return [
      'div',
      { 'data-type': 'page-break', class: 'page-break-node' },
      ['span', { class: 'page-break-node-label' }, 'Page Break']
    ]
  },

  addCommands() {
    return {
      setPageBreak: () => ({ commands }) => commands.insertContent({ type: this.name })
    }
  }
})
