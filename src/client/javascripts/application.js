import {
  createAll,
  Button,
  Checkboxes,
  ErrorSummary,
  Radios,
  SkipLink
} from 'govuk-frontend'

createAll(Button)
createAll(Checkboxes)
createAll(ErrorSummary)
createAll(Radios)
createAll(SkipLink)

// TEMPORARY: delete with src/server/routes/obligation-calculation
const obligationScrollTarget = document.querySelector('[data-scroll-to]')
const obligationScrollTo = obligationScrollTarget?.dataset.scrollTo
if (obligationScrollTo) {
  document.getElementById(obligationScrollTo)?.scrollIntoView()
}
