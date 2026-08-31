/**
 * Helper permission utility for checking top manager / admin access.
 * Admin and Top Manager ("Rashin Sheran" / manager@raxwo.com) have full company-wide visibility
 * and attendance marking privileges.
 * Project Managers and Team Leaders have restricted attendance privileges and intern-only scoping.
 */
function isTopManagerOrAdmin(user) {
  if (!user) return false;
  const staffRoles = ['admin', 'owner', 'manager', 'developer', 'marketing', 'designer', 'hr', 'director', 'superadmin'];
  if (staffRoles.includes(user.role)) return true;
  if (user.email && user.email.toLowerCase() === 'manager@raxwo.com') return true;
  if (user.name && user.name.toLowerCase().includes('rashin')) return true;
  return false;
}

module.exports = {
  isTopManagerOrAdmin,
};
