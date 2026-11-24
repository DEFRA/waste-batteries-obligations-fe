import { randomBytes } from 'node:crypto'

// TEMPORARY. Delete this folder to remove the manual obligation calculation page.
// Update json builds a new scheme id for 2026. The API reads those query fields
// and builds the sample calculation. A request does not post a calculation body.

const exampleYear = 2026
const schemeOrgIdBytes = 12

export const defaultExampleKind = 'full'

export const exampleKinds = [{ value: 'full', text: 'Full key' }]

function pretty(value) {
  return JSON.stringify(value, null, 2)
}

function schemeOrgId() {
  return randomBytes(schemeOrgIdBytes).toString('hex')
}

function fullKey() {
  return {
    schemeOrgId: schemeOrgId(),
    compliancePeriodYear: exampleYear
  }
}

const builders = {
  full: fullKey
}

export function buildExampleCalculation(kind = defaultExampleKind) {
  const build = builders[kind] ?? builders[defaultExampleKind]
  return pretty(build())
}
