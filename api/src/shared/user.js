// Resolves the calling user from the Static Web Apps auth header.
// https://learn.microsoft.com/azure/static-web-apps/user-information
function getUser(request) {
  const header = request.headers.get('x-ms-client-principal')
  if (header) {
    const principal = JSON.parse(Buffer.from(header, 'base64').toString('utf8'))
    const admins = (process.env.ADMIN_USER_IDS || '').split(',').map((s) => s.trim()).filter(Boolean)
    return {
      id: principal.userId,
      name: principal.userDetails,
      roles: principal.userRoles || [],
      isAdmin: admins.includes(principal.userId) || (principal.userRoles || []).includes('admin'),
    }
  }
  // Local development without SWA auth in front of the Functions host.
  return { id: 'local-dev-user', name: 'Local Developer', roles: ['authenticated'], isAdmin: true }
}

module.exports = { getUser }
