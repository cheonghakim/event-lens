import '../src/styles/base.css'
import '../src/styles/layout.css'
import '../src/styles/components.css'
import '../src/styles/severity.css'
import '../src/styles/ui.css'
import '../src/styles/theme-dark.css'
import '../src/styles/theme-light.css'

/** @type { import('@storybook/html').Preview } */
const preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark',  value: '#0f0f0f' },
        { name: 'light', value: '#f5f5f5' },
      ],
    },
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
}

export default preview
