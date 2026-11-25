import { vi } from 'vitest'

import { createServer } from '#/server/server.js'
import { statusCodes } from '#/server/common/constants/status-codes.js'
import { obligationCalculationPage } from './controller.js'

import {
  buildExampleCalculation,
  defaultExampleKind,
  exampleKinds
} from './example-calculation.js'

function extractCrumb(html) {
  return html.match(/name="crumb" value="([^"]+)"/)?.[1]
}

function cookieHeader(setCookie) {
  return setCookie.map((cookie) => cookie.split(';')[0]).join('; ')
}

function schemeOrgId(html) {
  return html.match(/schemeOrgId(?:&quot;|"): (?:&quot;|")([0-9a-f]{24})/)?.[1]
}

const signedIn = {
  strategy: 'session',
  credentials: {
    id: 'user-123',
    sessionId: 'sid',
    scope: ['user'],
    accessToken: 'access-token'
  }
}

const jsonHeaders = {
  accept: 'application/json',
  authorization: 'Bearer access-token'
}

describe('#obligationCalculationController', () => {
  const originalFetch = globalThis.fetch
  let server

  async function signedInPost(payload) {
    const getResponse = await server.inject({
      method: 'GET',
      url: '/obligation-calculation',
      auth: signedIn
    })

    return server.inject({
      method: 'POST',
      url: '/obligation-calculation',
      headers: {
        cookie: cookieHeader(getResponse.headers['set-cookie'])
      },
      payload: {
        ...payload,
        crumb: extractCrumb(getResponse.result)
      },
      auth: signedIn
    })
  }

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    globalThis.fetch = originalFetch
    await server.stop({ timeout: 0 })
  })

  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  test('Should redirect signed-out users to sign in', async () => {
    const { headers, statusCode } = await server.inject({
      method: 'GET',
      url: '/obligation-calculation'
    })

    expect(statusCode).toBe(302)
    expect(headers.location).toBe(
      '/auth/sign-in?redirect=%2Fobligation-calculation'
    )
  })

  test('Should render an example request for signed-in users', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/obligation-calculation',
      auth: signedIn
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('Obligation calculation test page')
    expect(result).toContain('obligation-calculation-temporary-banner')
    expect(result).toContain('>Obligation calculation saving</h1>')
    expect(result).toContain(
      'This screen is only for trying the obligation calculations API. It is not part of the live service and will be removed prior to go live.'
    )
    expect(result).toContain('Request JSON')
    expect(result).toContain('rows="12"')
    expect(result).not.toContain('data-scroll-to')
    expect(result).toContain(
      'formaction="/obligation-calculation#request-json"'
    )
    expect(result).toContain(
      'formaction="/obligation-calculation#create-calculation"'
    )
    expect(result).toContain('formaction="/obligation-calculation#add-version"')
    expect(result.indexOf('id="create-calculation"')).toBeLessThan(
      result.indexOf('id="add-version"')
    )
    expect(result).toContain('>Create</button>')
    expect(result).toContain('>Add version</button>')
    expect(result.match(/<option /g)).toHaveLength(1)
    expect(result).toContain('value="full" selected>Full key')
    expect(result).not.toContain('Omitted key')
    expect(result).not.toContain('<option disabled>')
    expect(result).toContain('Update json')
    expect(schemeOrgId(result)).toMatch(/^[0-9a-f]{24}$/)
    expect(result).toContain('compliancePeriodYear')
    expect(result).toContain('2026')
    expect(result).toContain('name="crumb"')
  })

  test('Should replace the example with a new scheme', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const getResponse = await server.inject({
      method: 'GET',
      url: '/obligation-calculation',
      auth: signedIn
    })
    const firstSchemeOrgId = schemeOrgId(getResponse.result)

    const { result, statusCode } = await server.inject({
      method: 'POST',
      url: '/obligation-calculation',
      headers: {
        cookie: cookieHeader(getResponse.headers['set-cookie'])
      },
      payload: {
        crumb: extractCrumb(getResponse.result),
        intent: 'update-json',
        exampleKind: 'full',
        calculationJson: '{not json',
        responseStatusCode: '201',
        responseStatusText: 'Created',
        responseBody: '{"id":"kept-response"}'
      },
      auth: signedIn
    })

    expect(statusCode).toBe(statusCodes.ok)
    const textarea = result.match(
      /id="calculationJson"[^>]*>([\s\S]*?)<\/textarea>/
    )?.[1]

    expect(schemeOrgId(result)).toMatch(/^[0-9a-f]{24}$/)
    expect(schemeOrgId(result)).not.toBe(firstSchemeOrgId)
    expect(textarea).not.toContain(firstSchemeOrgId)
    expect(textarea).toContain('compliancePeriodYear')
    expect(result).toContain('value="full" selected')
    expect(result).toContain('data-scroll-to="request-json"')
    expect(result).toContain('201 Created')
    expect(result).toContain('kept-response')
    expect(result).toContain('name="responseStatusCode" value="201"')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should show the API status and body after posting', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { id: '674a1b2c3d4e5f6789012347', version: 1, isCurrent: true },
          { status: 201, statusText: 'Created' }
        )
      )
    globalThis.fetch = fetchMock

    const calculationJson = JSON.stringify({
      schemeOrgId: '674a1b2c3d4e5f6789012345',
      compliancePeriodYear: 2026
    })

    const { result, statusCode } = await signedInPost({
      intent: 'post',
      calculationJson
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('201 Created')
    expect(result).toContain('data-scroll-to="create-calculation"')
    expect(result).toContain('674a1b2c3d4e5f6789012347')
    expect(result).toMatch(/version(?:&quot;|"): 1/)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.pathname).toBe('/obligation-calculations')
    expect(url.searchParams.get('schemeOrgId')).toBe('674a1b2c3d4e5f6789012345')
    expect(url.searchParams.get('compliancePeriodYear')).toBe('2026')
    expect(options).toEqual({
      method: 'POST',
      headers: jsonHeaders
    })
  })

  test('Should show an API error body without hiding the status code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      Response.json(
        {
          title: 'Bad Request',
          errors: {
            ObligationCalculation: [
              'A current obligation calculation already exists for this scheme and compliance year.'
            ]
          }
        },
        { status: 400, statusText: 'Bad Request' }
      )
    )

    const { result, statusCode } = await signedInPost({
      intent: 'post',
      calculationJson:
        '{"schemeOrgId":"674a1b2c3d4e5f6789012345","compliancePeriodYear":2026}'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('400 Bad Request')
    expect(result).toContain('A current obligation calculation already exists')
  })

  test('Should patch a newer version', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { id: '674a1b2c3d4e5f6789012348', version: 2, isCurrent: true },
          { status: 200, statusText: 'OK' }
        )
      )
    globalThis.fetch = fetchMock

    const { result, statusCode } = await signedInPost({
      intent: 'patch',
      calculationJson: JSON.stringify({
        schemeOrgId: '674a1b2c3d4e5f6789012345',
        compliancePeriodYear: 2026
      })
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('200 OK')
    expect(result).toContain('data-scroll-to="add-version"')
    expect(result).toContain('674a1b2c3d4e5f6789012348')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.pathname).toBe('/obligation-calculations')
    expect(url.searchParams.get('schemeOrgId')).toBe('674a1b2c3d4e5f6789012345')
    expect(url.searchParams.get('compliancePeriodYear')).toBe('2026')
    expect(options).toEqual({
      method: 'PATCH',
      headers: jsonHeaders
    })
  })

  test('Should post with no query when the key is omitted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { id: '674a1b2c3d4e5f6789012347', version: 1 },
          { status: 201, statusText: 'Created' }
        )
      )
    globalThis.fetch = fetchMock

    const { statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: '{}'
    })

    expect(statusCode).toBe(statusCodes.ok)

    const [url] = fetchMock.mock.calls[0]
    expect(url.pathname).toBe('/obligation-calculations')
    expect(url.search).toBe('')
  })

  test('Should leave null fields off the query', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: '674a1b2c3d4e5f6789012347' }, { status: 201 })
      )
    globalThis.fetch = fetchMock

    const { statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: JSON.stringify({
        schemeOrgId: null,
        compliancePeriodYear: null
      })
    })

    expect(statusCode).toBe(statusCodes.ok)

    const [url] = fetchMock.mock.calls[0]
    expect(url.search).toBe('')
  })

  test('Should send blank fields as empty query values', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ title: 'Bad Request' }, { status: 400 })
      )
    globalThis.fetch = fetchMock

    const { statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: JSON.stringify({
        schemeOrgId: '',
        compliancePeriodYear: ''
      })
    })

    expect(statusCode).toBe(statusCodes.ok)

    const [url] = fetchMock.mock.calls[0]
    expect(url.searchParams.get('schemeOrgId')).toBe('')
    expect(url.searchParams.get('compliancePeriodYear')).toBe('')
  })

  test('Should leave an object field and unknown properties off the query', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: '674a1b2c3d4e5f6789012347' }, { status: 201 })
      )
    globalThis.fetch = fetchMock

    const { statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: JSON.stringify({
        schemeOrgId: { id: '674a1b2c3d4e5f6789012345' },
        compliancePeriodYear: 2026,
        regulatorNote: 'ignore me'
      })
    })

    expect(statusCode).toBe(statusCodes.ok)

    const [url] = fetchMock.mock.calls[0]
    expect(url.searchParams.has('schemeOrgId')).toBe(false)
    expect(url.searchParams.has('regulatorNote')).toBe(false)
    expect(url.searchParams.get('compliancePeriodYear')).toBe('2026')
  })

  test('Should send a trimmed scheme id without trimming it first', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: '674a1b2c3d4e5f6789012347' }, { status: 201 })
      )
    globalThis.fetch = fetchMock

    const { statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: JSON.stringify({
        schemeOrgId: '  674a1b2c3d4e5f6789012345  ',
        compliancePeriodYear: 2026
      })
    })

    expect(statusCode).toBe(statusCodes.ok)

    const [url] = fetchMock.mock.calls[0]
    expect(url.searchParams.get('schemeOrgId')).toBe(
      '  674a1b2c3d4e5f6789012345  '
    )
  })

  test('Should send the scheme only', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        Response.json({ id: '674a1b2c3d4e5f6789012347' }, { status: 201 })
      )
    globalThis.fetch = fetchMock

    const { statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: JSON.stringify({
        schemeOrgId: '674a1b2c3d4e5f6789012345'
      })
    })

    expect(statusCode).toBe(statusCodes.ok)

    const [url] = fetchMock.mock.calls[0]
    expect(url.searchParams.get('schemeOrgId')).toBe('674a1b2c3d4e5f6789012345')
    expect(url.searchParams.has('compliancePeriodYear')).toBe(false)
  })

  test('Should reject JSON that is not an object before calling the API', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const { result, statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: '[1, 2]'
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toContain('Enter valid JSON')
    expect(result).toContain('[1, 2]')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should reject JSON that cannot be parsed before calling the API', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const { result, statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: '{not json'
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toContain('Enter valid JSON')
    expect(result).toContain('{not json')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should say the request could not be read when the payload is invalid', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const withJson = await signedInPost({
      exampleKind: 'full',
      calculationJson: '{"kept":true}'
    })

    expect(withJson.statusCode).toBe(statusCodes.badRequest)
    expect(withJson.result).toContain('The request could not be read')
    expect(withJson.result).toMatch(/\{(?:&quot;|")kept(?:&quot;|"):true\}/)

    const withoutJson = await signedInPost({
      intent: 'nope'
    })

    expect(withoutJson.statusCode).toBe(statusCodes.badRequest)
    expect(withoutJson.result).toContain('The request could not be read')
    expect(withoutJson.result).toContain('name="calculationJson"')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should ask for JSON before adding a version', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const { result, statusCode } = await signedInPost({
      intent: 'patch'
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toContain('Enter the JSON to add a version')
    expect(result).toContain('data-scroll-to="add-version"')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should ask for JSON when the calculation is empty', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock

    const { result, statusCode } = await signedInPost({
      intent: 'post'
    })

    expect(statusCode).toBe(statusCodes.badRequest)
    expect(result).toContain('Enter the JSON to post')
    expect(result).toContain('data-scroll-to="create-calculation"')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('Should drop a stored response when the status code is blank', async () => {
    const { result, statusCode } = await signedInPost({
      intent: 'update-json',
      exampleKind: 'full',
      responseStatusCode: '',
      responseStatusText: 'Created',
      responseBody: 'should-not-keep'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).not.toContain('should-not-keep')
    expect(result).not.toContain('name="responseStatusCode"')
    expect(result).toContain('data-scroll-to="request-json"')
  })

  test('Should keep a response when the status text and body are missing', async () => {
    const { result, statusCode } = await signedInPost({
      intent: 'update-json',
      exampleKind: 'full',
      responseStatusCode: '201'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('201')
    expect(result).toContain('name="responseStatusText" value=""')
    expect(result).toContain('name="responseBody" value=""')
  })

  test('Should show an empty API body', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 204, statusText: 'No Content' })
      )

    const { result, statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: '{"schemeOrgId":"674a1b2c3d4e5f6789012345"}'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('204 No Content')
    expect(result).toContain('(empty body)')
  })

  test('Should show a non-JSON API body unchanged', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('plain text', {
        status: 200,
        statusText: 'OK'
      })
    )

    const { result, statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: '{"schemeOrgId":"674a1b2c3d4e5f6789012345"}'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toContain('200 OK')
    expect(result).toContain('plain text')
  })

  test('Should show a problem when the API call fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const { result, statusCode } = await signedInPost({
      intent: 'post',
      calculationJson: '{"schemeOrgId":"674a1b2c3d4e5f6789012345"}'
    })

    expect(statusCode).toBe(statusCodes.internalServerError)
    expect(result).toContain('There was a problem calling the API')
    expect(result).toContain('Error: Obligation calculation test page')
  })

  test('Should fall back when the example kind or JSON is missing', () => {
    const page = obligationCalculationPage(
      { plugins: { crumb: 'crumb-token' } },
      { exampleKind: 'not-a-kind' }
    )

    expect(page.exampleKind).toBe(defaultExampleKind)
    expect(page.calculationJson).toBe('')
    expect(page.crumb).toBe('crumb-token')
    expect(page.pageTitle).toBe('Obligation calculation test page')
    expect(page.heading).toBe('Obligation calculation saving')
    expect(page.temporaryLabel).toBe('Temporary test page')
    expect(page.breadcrumbs[1].text).toBe('Obligation calculation test page')
  })
})

function parsedExample(kind) {
  return JSON.parse(buildExampleCalculation(kind))
}

describe('#buildExampleCalculation', () => {
  test('Should fall back to the full example for an unknown kind', () => {
    const body = parsedExample('not-a-kind')

    expect(body.schemeOrgId).toMatch(/^[0-9a-f]{24}$/)
    expect(body.compliancePeriodYear).toBe(2026)
  })

  test('Should default to a full key', () => {
    const body = parsedExample()

    expect(defaultExampleKind).toBe('full')
    expect(body.schemeOrgId).toMatch(/^[0-9a-f]{24}$/)
    expect(body.compliancePeriodYear).toBe(2026)
    expect(parsedExample().schemeOrgId).not.toBe(body.schemeOrgId)
  })

  test('Should list the full key as the only example', () => {
    expect(exampleKinds).toEqual([{ value: 'full', text: 'Full key' }])
  })
})
