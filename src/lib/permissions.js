// Default permission matrix — orgs can override via org_permissions table
const DEFAULT_PERMISSIONS = {
  analyst: {
    'deal.screen': true,
    'deal.save': true,
    'deal.delete_own': true,
    'pipeline.create': true,
    'pipeline.move_review': true,
    'pipeline.move_approved': false,
    'pipeline.move_funded': false,
    'pipeline.move_declined': false,
    'pipeline.delete_own': true,
    'pipeline.delete_any': false,
    'audit.view': false,
    'org.manage_users': false,
    'org.manage_permissions': false,
  },
  senior_analyst: {
    'deal.screen': true,
    'deal.save': true,
    'deal.delete_own': true,
    'pipeline.create': true,
    'pipeline.move_review': true,
    'pipeline.move_approved': true,
    'pipeline.move_funded': false,
    'pipeline.move_declined': true,
    'pipeline.delete_own': true,
    'pipeline.delete_any': true,
    'audit.view': true,
    'org.manage_users': false,
    'org.manage_permissions': false,
  },
  credit_committee: {
    'deal.screen': true,
    'deal.save': true,
    'deal.delete_own': true,
    'pipeline.create': true,
    'pipeline.move_review': true,
    'pipeline.move_approved': true,
    'pipeline.move_funded': true,
    'pipeline.move_declined': true,
    'pipeline.delete_own': true,
    'pipeline.delete_any': true,
    'audit.view': true,
    'org.manage_users': false,
    'org.manage_permissions': false,
  },
  admin: {
    'deal.screen': true,
    'deal.save': true,
    'deal.delete_own': true,
    'pipeline.create': true,
    'pipeline.move_review': true,
    'pipeline.move_approved': true,
    'pipeline.move_funded': true,
    'pipeline.move_declined': true,
    'pipeline.delete_own': true,
    'pipeline.delete_any': true,
    'audit.view': true,
    'org.manage_users': true,
    'org.manage_permissions': true,
  },
};

// All known permission keys (for the admin settings UI)
export const PERMISSION_KEYS = Object.keys(DEFAULT_PERMISSIONS.analyst);

export const PERMISSION_LABELS = {
  'deal.screen': 'Screen new deals',
  'deal.save': 'Save deals',
  'deal.delete_own': 'Delete own saved deals',
  'pipeline.create': 'Add deals to pipeline',
  'pipeline.move_review': 'Move to Under Review',
  'pipeline.move_approved': 'Move to Approved',
  'pipeline.move_funded': 'Move to Funded',
  'pipeline.move_declined': 'Move to Declined',
  'pipeline.delete_own': 'Delete own pipeline deals',
  'pipeline.delete_any': 'Delete any pipeline deal',
  'audit.view': 'View audit log',
  'org.manage_users': 'Manage team members',
  'org.manage_permissions': 'Edit role permissions',
};

export const ROLE_LABELS = {
  analyst: 'Analyst',
  senior_analyst: 'Senior Analyst',
  credit_committee: 'Credit Committee',
  admin: 'Admin',
};

// Merge default permissions with org-specific overrides
export function resolvePermissions(role, orgOverrides = []) {
  const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.analyst;
  const resolved = { ...defaults };

  for (const override of orgOverrides) {
    if (override.role === role && override.permission_key in resolved) {
      resolved[override.permission_key] = override.allowed;
    }
  }

  return resolved;
}

export function hasPermission(permissions, key) {
  return permissions?.[key] === true;
}
