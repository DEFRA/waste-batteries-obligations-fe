import { statusCodes } from '#/server/common/constants/status-codes.js'

import {
  addObligationCalculationVersion,
  createObligationCalculation
} from './obligation-calculation-api.js'
import {
  buildExampleCalculation,
  defaultExampleKind,
  exampleKinds
} from './example-calculation.js'

const pageTitle = 'Obligation calculation test page'
const heading = 'Obligation calculation saving'
const temporaryLabel = 'Temporary test page'
const calculationView = 'obligation-calculation/index'
const patchIntent = 'patch'

function selectedKind(value) {
  return exampleKinds.some((kind) => kind.value === value)
    ? value
    : defaultExampleKind
}

function scrollTarget(intent) {
  if (intent === 'update-json') {
    return 'request-json'
  }

  if (intent === patchIntent) {
    return 'add-version'
  }

  return 'create-calculation'
}

export function obligationCalculationPage(request, values = {}) {
  const exampleKind = selectedKind(values.exampleKind)

  return {
    pageTitle: values.errorMessage ? `Error: ${pageTitle}` : pageTitle,
    heading,
    temporaryLabel,
    breadcrumbs: [{ text: 'Home', href: '/' }, { text: pageTitle }],
    crumb: request.plugins.crumb,
    exampleKinds,
    exampleKind,
    calculationJson: values.calculationJson ?? '',
    response: values.response ?? null,
    errorMessage: values.errorMessage,
    scrollTo: values.scrollTo ?? null
  }
}

function postedResponse(payload) {
  const statusCode = payload?.responseStatusCode
  if (statusCode === undefined || statusCode === null || statusCode === '') {
    return null
  }

  return {
    statusCode,
    statusText: payload.responseStatusText ?? '',
    body: payload.responseBody ?? ''
  }
}

function formattedBody(body) {
  if (!body) {
    return '(empty body)'
  }

  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export const obligationCalculationGetController = {
  handler(request, h) {
    return h.view(
      calculationView,
      obligationCalculationPage(request, {
        exampleKind: defaultExampleKind,
        calculationJson: buildExampleCalculation(defaultExampleKind)
      })
    )
  }
}

function parsedJson(calculationJson) {
  try {
    return JSON.parse(calculationJson)
  } catch {
    return undefined
  }
}

function jsonObject(value) {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }

  return null
}

function viewPage(h, request, values, statusCode) {
  const response = h.view(
    calculationView,
    obligationCalculationPage(request, values)
  )

  if (statusCode === undefined) {
    return response
  }

  return response.code(statusCode)
}

async function callApi(request, h, page, call, logMessage) {
  const { exampleKind, calculationJson, scrollTo } = page

  try {
    const response = await call()

    return viewPage(h, request, {
      exampleKind,
      calculationJson,
      scrollTo,
      response: {
        statusCode: response.statusCode,
        statusText: response.statusText,
        body: formattedBody(response.body)
      }
    })
  } catch (error) {
    request.logger.error(error, logMessage)

    return viewPage(
      h,
      request,
      {
        exampleKind,
        calculationJson,
        errorMessage: 'There was a problem calling the API',
        scrollTo
      },
      statusCodes.internalServerError
    )
  }
}

function accessToken(request) {
  return request.auth.credentials.accessToken
}

function missingJsonMessage(intent) {
  if (intent === patchIntent) {
    return 'Enter the JSON to add a version'
  }

  return 'Enter the JSON to post'
}

function postCalculation(request, h, page) {
  return callApi(
    request,
    h,
    page,
    () =>
      createObligationCalculation({
        key: page.key,
        accessToken: accessToken(request)
      }),
    'Could not post the obligation calculation'
  )
}

function addVersion(request, h, page) {
  return callApi(
    request,
    h,
    page,
    () =>
      addObligationCalculationVersion({
        key: page.key,
        accessToken: accessToken(request)
      }),
    'Could not add an obligation calculation version'
  )
}

function rejectJson(h, request, page, errorMessage) {
  return viewPage(
    h,
    request,
    {
      ...page,
      errorMessage
    },
    statusCodes.badRequest
  )
}

function submitParsed(request, h, page, parsed) {
  const key = jsonObject(parsed)

  if (!key) {
    return rejectJson(h, request, page, 'Enter valid JSON')
  }

  const withKey = { ...page, key }

  if (request.payload.intent === patchIntent) {
    return addVersion(request, h, withKey)
  }

  return postCalculation(request, h, withKey)
}

export const obligationCalculationPostController = {
  async handler(request, h) {
    const exampleKind = selectedKind(request.payload.exampleKind)
    const scrollTo = scrollTarget(request.payload.intent)

    if (request.payload.intent === 'update-json') {
      return viewPage(h, request, {
        exampleKind,
        calculationJson: buildExampleCalculation(exampleKind),
        response: postedResponse(request.payload),
        scrollTo
      })
    }

    const calculationJson = request.payload.calculationJson ?? ''
    const page = { exampleKind, calculationJson, scrollTo }

    if (calculationJson.trim() === '') {
      return rejectJson(
        h,
        request,
        page,
        missingJsonMessage(request.payload.intent)
      )
    }

    return submitParsed(request, h, page, parsedJson(calculationJson))
  }
}
