import { execFileSync } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

function run(command, args) {
  try {
    execFileSync(command, args, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

const hasPoomsaeScoring = existsSync(resolve('src/poomsae/scoring.ts'))
const hasProfiles = existsSync(resolve('src/rules/profiles/recognized.ts'))
const hasWorkflow = existsSync(resolve('src/poomsae/workflow.ts'))
const scoringPass = run('node', [
  'node_modules/vitest/vitest.mjs',
  'run',
  'src/poomsae/scoring.test.ts',
])
const workflowPass = run('node', [
  'node_modules/vitest/vitest.mjs',
  'run',
  'src/poomsae/workflow.test.ts',
  'src/pages/RoomPages.test.tsx',
])
const realtimePass = run('node', [
  'node_modules/vitest/vitest.mjs',
  'run',
  'src/room/roomChannel.test.ts',
  'src/room/clock.test.ts',
])
const typecheckPass = run('node', ['node_modules/typescript/bin/tsc', '-b'])
const lintPass = run('node', ['node_modules/eslint/bin/eslint.js', '.'])

const score = {
  ruleCorrectness: scoringPass && hasProfiles && hasPoomsaeScoring ? 40 : 0,
  workflowSuccess: workflowPass && hasWorkflow ? 8 : 0,
  realtimeReliability: realtimePass ? 4 : 0,
  resilience: realtimePass ? 2 : 0,
  usability: 0,
  maintainability: typecheckPass && lintPass ? 5 : 0,
}
const total = Object.values(score).reduce((sum, value) => sum + value, 0)
const result = { total, ...score, generatedAt: new Date().toISOString() }

writeFileSync(resolve('evaluation/latest.json'), `${JSON.stringify(result, null, 2)}\n`)
console.log(JSON.stringify(result, null, 2))
