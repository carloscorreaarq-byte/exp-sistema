(() => {
  const ROLES_LABEL = {
    socio: 'Socio',
    socio_adm: 'Socio administrador',
    socio_admin: 'Socio administrador',
    coordenador: 'Coordenador',
    colaborador: 'Colaborador',
    admin: 'Administrador',
  };

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
  window.NUCLEO_COR = window.NUCLEO_COR || NUCLEO_COR;
  window.STATUS_ETAPA = window.STATUS_ETAPA || STATUS_ETAPA;
})();
