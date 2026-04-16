export const getRoleLabel = (codes: string[]): string => {
  if (codes.includes('ADMIN_GLOBAL')) return 'Administrateur Global';
  if (codes.includes('ADMIN_LANDS')) return 'Admin Terrains';
  if (codes.includes('ADMIN_KBS')) return 'Admin KBS';
  if (codes.includes('ADMIN_KAMNET')) return 'Admin KAMNET';
  if (codes.includes('AGENT')) return 'Agent Confirmé';
  if (codes.includes('CLIENT')) return 'Client';
  return 'Utilisateur';
};

export const getInitials = (firstName?: string | null, lastName?: string | null): string => {
  const f = firstName?.[0] ?? '';
  const l = lastName?.[0] ?? '';
  return (f + l).toUpperCase() || '?';
};
