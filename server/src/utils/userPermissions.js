/**
 * Helper permission utility for checking top manager / admin access.
 * Admin and Top Manager ("Rashin Sheran" / manager@raxwo.com) have full company-wide visibility
 * and attendance marking privileges.
 * Project Managers and Team Leaders have restricted attendance privileges and intern-only scoping.
 */
function isTopManagerOrAdmin(user) {
  if (!user) return false;
  const topRoles = ['admin', 'owner', 'superadmin', 'director'];
  if (topRoles.includes(user.role)) return true;
  if (user.email && user.email.toLowerCase() === 'manager@raxwo.com') return true;
  if (user.name && user.name.toLowerCase().includes('rashin')) return true;
  return false;
}

module.exports = {
  isTopManagerOrAdmin,
};
