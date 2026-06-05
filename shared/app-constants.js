(() => {
  const CANONICAL_SOCIO_ADMIN_ROLE = 'socio_admin';
  const SOCIO_ADMIN_ROLE_ALIASES = ['socio_adm', CANONICAL_SOCIO_ADMIN_ROLE];

  const ROLES_LABEL = {
    socio: 'Socio',
    socio_adm: 'Socio administrador',
    socio_admin: 'Socio administrador',
    coordenador: 'Coordenador',
    colaborador: 'Colaborador',
    admin: 'Administrador',
  };

  function normalizeExpRole(role) {
    const normalized = String(role || '').toLowerCase().trim();
    if (normalized === 'socio_adm') return CANONICAL_SOCIO_ADMIN_ROLE;
    return normalized;
  }

  function isSocioRoleCompat(role) {
    return ['socio', CANONICAL_SOCIO_ADMIN_ROLE].includes(normalizeExpRole(role));
  }

  function isSocioAdminRoleCompat(role) {
    return normalizeExpRole(role) === CANONICAL_SOCIO_ADMIN_ROLE;
  }

  const NUCLEO_COR = {
    urbanismo: { cls: 'b-urb', bar: 'gb-urb', dot: '#5280CA', label: 'Urbanismo' },
    paisagismo: { cls: 'b-pai', bar: 'gb-pai', dot: '#45865D', label: 'Paisagismo' },
    especiais: { cls: 'b-esp', bar: 'gb-esp', dot: '#D19931', label: 'Proj. Especiais' },
    consultorias: { cls: 'b-consul', bar: 'gb-consul', dot: '#C36247', label: 'Consultorias' },
  };

  const STATUS_ETAPA = {
    nao_iniciada: { cls: 'b-gr', dot: 'd-gr', label: 'Nao iniciada' },
    em_andamento: { cls: 'b-az', dot: 'd-az', label: 'Em andamento' },
    em_revisao: { cls: 'b-am', dot: 'd-am', label: 'Em revisao' },
    concluida: { cls: 'b-vd', dot: 'd-vd', label: 'Concluida' },
    pausada: { cls: 'b-tc', dot: 'd-tc', label: 'Pausada' },
  };

  window.EXP_ROLES_LABEL = ROLES_LABEL;
  window.EXP_CANONICAL_SOCIO_ADMIN_ROLE = CANONICAL_SOCIO_ADMIN_ROLE;
  window.EXP_SOCIO_ADMIN_ROLE_ALIASES = SOCIO_ADMIN_ROLE_ALIASES;
  window.normalizeExpRole = window.normalizeExpRole || normalizeExpRole;
  window.isSocioRoleCompat = window.isSocioRoleCompat || isSocioRoleCompat;
  window.isSocioAdminRoleCompat = window.isSocioAdminRoleCompat || isSocioAdminRoleCompat;
  window.NUCLEO_COR = window.NUCLEO_COR || NUCLEO_COR;
  window.STATUS_ETAPA = window.STATUS_ETAPA || STATUS_ETAPA;
})();
