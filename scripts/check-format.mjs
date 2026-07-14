import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const windowsGit = 'C:\\Program Files\\Git\\cmd\\git.exe'
const gitCommand = process.platform === 'win32' && existsSync(windowsGit) ? windowsGit : 'git'

function runGit(args) {
  return spawnSync(gitCommand, args, { cwd: process.cwd(), encoding: 'utf8' })
}

const files = new Set()

function addFiles(args) {
  const result = runGit(args)
  if (result.status !== 0 || !result.stdout) return
  for (const file of result.stdout.split(/\r?\n/)) {
    if (file) files.add(file)
  }
}

const baseRefs = [process.env.FORMAT_BASE_REF, 'origin/main', 'HEAD^'].filter(Boolean)
let baseRef

for (const ref of baseRefs) {
  const result = runGit(['rev-parse', '--verify', ref])
  if (result.status === 0) {
    baseRef = ref
    break
  }
}

if (baseRef) {
  addFiles(['diff', '--name-only', '--diff-filter=ACMR', baseRef + '...HEAD'])
}
addFiles(['diff', '--name-only', '--diff-filter=ACMR'])
addFiles(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
addFiles(['ls-files', '--others', '--exclude-standard'])

const supported = /\.(?:[cm]?[jt]sx?|json|css|md)$/
const paths = [...files]
  .filter((file) => supported.test(file))
  .filter((file) => existsSync(join(process.cwd(), file)))
  .sort()

if (paths.length === 0) {
  console.log('No changed files require a Prettier check.')
  process.exit(0)
}

const prettierBin = join(process.cwd(), 'node_modules', 'prettier', 'bin', 'prettier.cjs')
const result = spawnSync(process.execPath, [prettierBin, '--check', ...paths], { stdio: 'inherit' })

if (result.error) {
  throw result.error
}

process.exit(result.status ?? 1)
