export const ADMIN_EMAIL = 'gustavohenriquegolec@gmail.com'

export function isAdminUser(user) {
    const email = user?.email?.trim().toLowerCase()
    return email === ADMIN_EMAIL
}
