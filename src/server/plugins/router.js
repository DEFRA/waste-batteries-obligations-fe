import { home } from '../routes/home/index.js'
import { about } from '../routes/about/index.js'
import { health } from '../routes/health/index.js'
import { authRoutes } from '../routes/auth/index.js'
import { example } from '../routes/example/index.js'
import { obligationCalculation } from '../routes/obligation-calculation/index.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here.
      // TEMPORARY: obligationCalculation is the manual API page. Delete it with src/server/routes/obligation-calculation.
      await server.register([
        home,
        about,
        authRoutes,
        example,
        obligationCalculation
      ])
    }
  }
}
