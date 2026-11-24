import { config } from '#/config/config.js'

const obligationCalculationsPath = '/obligation-calculations'
const queryKeys = ['schemeOrgId', 'compliancePeriodYear']

function backendUrl(path) {
  return new URL(path, config.get('wasteBatteriesObligationsBeUrl'))
}

function jsonHeaders(accessToken) {
  return {
    accept: 'application/json',
    authorization: `Bearer ${accessToken}`
  }
}

async function readResponse(response) {
  return {
    statusCode: response.status,
    statusText: response.statusText,
    body: await response.text()
  }
}

function calculationPath(key) {
  const params = new URLSearchParams()

  for (const name of queryKeys) {
    const value = key[name]
    if (value === undefined || value === null || typeof value === 'object') {
      continue
    }

    params.append(name, String(value))
  }

  const query = params.toString()
  return query === ''
    ? obligationCalculationsPath
    : `${obligationCalculationsPath}?${query}`
}

export async function createObligationCalculation({ key, accessToken }) {
  const response = await fetch(backendUrl(calculationPath(key)), {
    method: 'POST',
    headers: jsonHeaders(accessToken)
  })

  return readResponse(response)
}

export async function addObligationCalculationVersion({ key, accessToken }) {
  const response = await fetch(backendUrl(calculationPath(key)), {
    method: 'PATCH',
    headers: jsonHeaders(accessToken)
  })

  return readResponse(response)
}
