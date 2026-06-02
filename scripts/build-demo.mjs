import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const docsDir = path.join(root, 'docs')
const distDir = path.join(root, 'dist')

if (!fs.existsSync(path.join(distDir, 'index.mjs'))) {
  throw new Error('dist/index.mjs is missing. Run npm run build before npm run build:demo.')
}

fs.rmSync(docsDir, { recursive: true, force: true })
fs.mkdirSync(docsDir, { recursive: true })
fs.copyFileSync(path.join(root, 'index.html'), path.join(docsDir, 'index.html'))
fs.cpSync(distDir, path.join(docsDir, 'dist'), { recursive: true })

console.log('Demo built in docs/.')
