(function exposeRolePresentation(root) {
  const capabilities = {
    reception: ['booking.request.read', 'booking.request.decide', 'booking.create', 'client.admin.read'],
    admin: ['booking.request.read', 'booking.request.decide', 'booking.create', 'client.admin.read', 'clinic.staff.read', 'clinic.settings.read'],
    veterinarian: ['schedule.own.read', 'visit.assigned.read'],
    'multi-role': ['booking.request.read', 'booking.request.decide', 'booking.create', 'client.admin.read', 'schedule.own.read', 'visit.assigned.read'],
  };
  const workspaces = { reception: 'reception', admin: 'admin', veterinarian: 'veterinarian', 'multi-role': 'reception' };
  const labels = { reception: 'Ресепшен', admin: 'Управление', veterinarian: 'Врач', 'multi-role': 'Ресепшен' };
  const presentation = Object.fromEntries(Object.entries(capabilities).map(([role, keys]) => [role, {
    role,
    activeWorkspace: workspaces[role],
    workspaceLabel: labels[role],
    capabilities: new Set(keys),
  }]));
  root.VH_ROLE_PRESENTATION = Object.freeze(presentation);
})(globalThis);
