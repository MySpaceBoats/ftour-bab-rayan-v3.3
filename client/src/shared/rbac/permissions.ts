// ============================================
// RBAC — Source unique de vérité
// ============================================
// Tous les rôles, modules autorisés et routes autorisées
// sont définis ici. Plus aucun allowedRoles dispersé.
// ============================================

/**
 * Rôles officiels — un seul nom par rôle, zéro alias.
 */
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  ADMIN_OPS: 'admin_ops',
  ADMIN_RESTAURANT: 'admin_restaurant',
  VUE_RESTAURANT: 'vue_restaurant',
  ADMIN_PATISSERIE: 'admin_patisserie',
  ADMIN_TERROIR: 'admin_terroir',
  ADMIN_BOUTIQUE: 'admin_boutique',
  ADMIN_DONS: 'admin_dons',
  SCANNER: 'scanner',
  ADMIN_CONTENU: 'admin_contenu',
  ADMIN_MESSAGES: 'admin_messages',
  USER: 'user',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Modules métier
 */
export const MODULES = {
  RESTAURANT_PARTICULIERS: 'restaurant_particuliers',
  RESTAURANT_ENTREPRISES: 'restaurant_entreprises',
  RESTAURANT_GROUPES: 'restaurant_groupes',
  PATISSERIE: 'patisserie',
  TERROIR: 'terroir',
  GOODIES: 'goodies',
  DONS: 'dons',
  OPS: 'ops',
  SCANNER: 'scanner',
  CONTENU: 'contenu',
  MESSAGES: 'messages',
  UTILISATEURS: 'utilisateurs',
  SYSTEM: 'system',
} as const;

export type Module = (typeof MODULES)[keyof typeof MODULES];

// ============================================
// PERMISSION MAP: ROLE → MODULES AUTORISÉS
// ============================================

const ALL_MODULES = Object.values(MODULES);

export const ROLE_MODULES: Record<Role, readonly Module[]> = {
  [ROLES.SUPER_ADMIN]: ALL_MODULES,
  [ROLES.ADMIN]: ALL_MODULES,
  [ROLES.ADMIN_OPS]: [
    MODULES.OPS,
    MODULES.SCANNER,
    MODULES.RESTAURANT_PARTICULIERS,
    MODULES.RESTAURANT_ENTREPRISES,
    MODULES.RESTAURANT_GROUPES,
  ],
  [ROLES.ADMIN_RESTAURANT]: [MODULES.RESTAURANT_PARTICULIERS, MODULES.RESTAURANT_ENTREPRISES, MODULES.RESTAURANT_GROUPES],
  [ROLES.VUE_RESTAURANT]: [MODULES.RESTAURANT_PARTICULIERS, MODULES.RESTAURANT_ENTREPRISES, MODULES.RESTAURANT_GROUPES],
  [ROLES.ADMIN_PATISSERIE]: [MODULES.PATISSERIE],
  [ROLES.ADMIN_TERROIR]: [MODULES.TERROIR],
  [ROLES.ADMIN_BOUTIQUE]: [MODULES.GOODIES, MODULES.PATISSERIE],
  [ROLES.ADMIN_DONS]: [MODULES.DONS],
  [ROLES.SCANNER]: [MODULES.SCANNER],
  [ROLES.ADMIN_CONTENU]: [MODULES.CONTENU],
  [ROLES.ADMIN_MESSAGES]: [MODULES.MESSAGES],
  [ROLES.USER]: [],
};

// ============================================
// PERMISSION MAP: ROUTE → RÔLES AUTORISÉS
// ============================================

/**
 * Pour chaque route admin, la liste des rôles qui y ont accès.
 * super_admin et admin ont accès partout par convention.
 */
const ADMIN_BASE: Role[] = [ROLES.SUPER_ADMIN, ROLES.ADMIN];

export const ROUTE_ROLES: Record<string, readonly Role[]> = {
  // Dashboard principal
  '/admin': [...ADMIN_BASE, ROLES.ADMIN_OPS, ROLES.ADMIN_BOUTIQUE, ROLES.ADMIN_DONS,
    ROLES.ADMIN_RESTAURANT, ROLES.ADMIN_PATISSERIE, ROLES.ADMIN_TERROIR,
    ROLES.SCANNER, ROLES.ADMIN_CONTENU, ROLES.ADMIN_MESSAGES, ROLES.VUE_RESTAURANT],

  // Restaurant
  '/admin/restaurant/particuliers': [...ADMIN_BASE, ROLES.ADMIN_RESTAURANT, ROLES.VUE_RESTAURANT],
  '/admin/restaurant/entreprises': [...ADMIN_BASE, ROLES.ADMIN_RESTAURANT, ROLES.VUE_RESTAURANT],
  '/admin/restaurant/groupes': [...ADMIN_BASE, ROLES.ADMIN_RESTAURANT, ROLES.VUE_RESTAURANT],
  '/admin/restaurants': [...ADMIN_BASE, ROLES.ADMIN_OPS],
  '/admin/reservations': [...ADMIN_BASE, ROLES.ADMIN_OPS],
  '/admin/reservations-calendar': [...ADMIN_BASE, ROLES.ADMIN_RESTAURANT, ROLES.VUE_RESTAURANT],

  // Pâtisserie
  '/admin/patisserie': [...ADMIN_BASE, ROLES.ADMIN_PATISSERIE, ROLES.ADMIN_BOUTIQUE],
  '/admin/patisserie/catalogue': [...ADMIN_BASE, ROLES.ADMIN_PATISSERIE, ROLES.ADMIN_BOUTIQUE],

  // Terroir
  '/admin/terroir': [...ADMIN_BASE, ROLES.ADMIN_TERROIR],
  '/admin/terroir/products': [...ADMIN_BASE, ROLES.ADMIN_TERROIR],
  '/admin/terroir/orders': [...ADMIN_BASE, ROLES.ADMIN_TERROIR],

  // Goodies
  '/admin/goodies': [...ADMIN_BASE, ROLES.ADMIN_BOUTIQUE],
  '/admin/commandes': [...ADMIN_BASE, ROLES.ADMIN_BOUTIQUE],

  // Dons
  '/admin/dons': [...ADMIN_BASE, ROLES.ADMIN_DONS],

  // Ops
  '/admin/ops': [...ADMIN_BASE, ROLES.ADMIN_OPS],
  '/admin/jours': [...ADMIN_BASE, ROLES.ADMIN_OPS],
  '/admin/benevoles': [...ADMIN_BASE, ROLES.ADMIN_OPS],
  '/admin/scan': [...ADMIN_BASE, ROLES.ADMIN_OPS, ROLES.SCANNER],
  '/admin/scan-reservation': [...ADMIN_BASE, ROLES.ADMIN_OPS, ROLES.SCANNER],
  '/admin/scan-product': [...ADMIN_BASE, ROLES.ADMIN_OPS, ROLES.SCANNER],
  '/admin/payments': [...ADMIN_BASE, ROLES.ADMIN_BOUTIQUE, ROLES.ADMIN_DONS, ROLES.ADMIN_TERROIR],

  // Scanner (route publique scanner)
  '/scanner': [...ADMIN_BASE, ROLES.ADMIN_OPS, ROLES.SCANNER],

  // Contenu
  '/admin/contenu': [...ADMIN_BASE, ROLES.ADMIN_CONTENU],

  // Messages
  '/admin/messages': [...ADMIN_BASE, ROLES.ADMIN_MESSAGES],

  // Utilisateurs (super_admin only)
  '/admin/utilisateurs': [ROLES.SUPER_ADMIN],

  // Dashboard unifié
  '/admin/unified-dashboard': [ROLES.SUPER_ADMIN],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Vérifie si un rôle a accès à une route donnée.
 */
export function hasRouteAccess(role: string | undefined | null, route: string): boolean {
  if (!role) return false;
  const allowedRoles = ROUTE_ROLES[route];
  if (!allowedRoles) return false;
  return allowedRoles.includes(role as Role);
}

/**
 * Vérifie si un rôle a accès à un module donné.
 */
export function hasModuleAccess(role: string | undefined | null, module: Module): boolean {
  if (!role) return false;
  const modules = ROLE_MODULES[role as Role];
  if (!modules) return false;
  return modules.includes(module);
}

/**
 * Retourne la liste des rôles autorisés pour une route.
 * Utilisé par RequireRole en remplacement des allowedRoles dispersés.
 */
export function getRolesForRoute(route: string): readonly Role[] {
  return ROUTE_ROLES[route] ?? [];
}

/**
 * Vérifie si un rôle est un rôle administrateur (tout sauf user).
 */
export function isAdminRole(role: string | undefined | null): boolean {
  if (!role) return false;
  return role !== ROLES.USER;
}
