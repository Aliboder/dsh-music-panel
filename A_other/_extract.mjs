import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'
const src = readFileSync('src/client/styles/theme.js', 'utf8')
const sandbox = { MP_Z_CSS: '' }
vm.createContext(sandbox)
vm.runInContext(src, sandbox)
const themeCss = sandbox.THEME_TEXT
const tailwind = readFileSync('src/folia-build/folia-tailwind.css', 'utf8')
writeFileSync('A_other/_theme.css', themeCss + '\n' + tailwind)
console.log('theme', themeCss.length, 'tailwind', tailwind.length)