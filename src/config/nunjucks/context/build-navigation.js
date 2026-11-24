export function buildNavigation(request) {
  const navigation = [
    {
      text: 'Home',
      href: '/',
      current: request?.path === '/'
    },
    {
      text: 'About',
      href: '/about',
      current: request?.path === '/about'
    }
  ]

  if (request?.auth?.isAuthenticated) {
    navigation.push(
      {
        text: 'Example',
        href: '/example',
        current: request?.path === '/example'
      },
      // TEMPORARY: delete with src/server/routes/obligation-calculation
      {
        text: 'Obligation calculation test page',
        href: '/obligation-calculation',
        current: request?.path === '/obligation-calculation'
      }
    )
  }

  return navigation
}
