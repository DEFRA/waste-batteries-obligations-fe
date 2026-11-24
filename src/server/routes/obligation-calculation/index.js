import Joi from 'joi'

import { statusCodes } from '#/server/common/constants/status-codes.js'

import {
  obligationCalculationGetController,
  obligationCalculationPage,
  obligationCalculationPostController
} from './controller.js'
import { exampleKinds } from './example-calculation.js'

// TEMPORARY manual test page for the obligation calculations API.
// To remove it, delete src/server/routes/obligation-calculation and the matching
// TEMPORARY lines in:
// - src/server/plugins/router.js
// - src/config/nunjucks/context/build-navigation.js
// - src/config/nunjucks/context/build-navigation.test.js
// - e2e/journeys/accessibility/accessibility.spec.js
// - src/client/stylesheets/partials/_index.scss
// - src/client/javascripts/application.js
// - src/client/javascripts/application.test.js
// The obligations API base URL in src/config/config.js stays. It is how this
// service calls the obligations API, and is not part of the temporary page.

const maxJsonLength = 100_000
const maxStatusCodeLength = 3

export const obligationCalculation = {
  plugin: {
    name: 'obligation-calculation',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/obligation-calculation',
          ...obligationCalculationGetController
        },
        {
          method: 'POST',
          path: '/obligation-calculation',
          options: {
            validate: {
              payload: Joi.object({
                intent: Joi.string()
                  .valid('post', 'patch', 'update-json')
                  .required(),
                exampleKind: Joi.string()
                  .valid(
                    ...exampleKinds.flatMap((kind) =>
                      kind.value ? [kind.value] : []
                    )
                  )
                  .empty('')
                  .default('full'),
                calculationJson: Joi.string().max(maxJsonLength).allow(''),
                responseStatusCode: Joi.string()
                  .max(maxStatusCodeLength)
                  .allow(''),
                responseStatusText: Joi.string().max(100).allow(''),
                responseBody: Joi.string().max(maxJsonLength).allow('')
              }).unknown(true),
              failAction(request, h) {
                return h
                  .view(
                    'obligation-calculation/index',
                    obligationCalculationPage(request, {
                      exampleKind: request.payload?.exampleKind,
                      calculationJson: request.payload?.calculationJson ?? '',
                      errorMessage: 'The request could not be read'
                    })
                  )
                  .code(statusCodes.badRequest)
                  .takeover()
              }
            }
          },
          ...obligationCalculationPostController
        }
      ])
    }
  }
}
