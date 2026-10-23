// Nomes de pessoas na plataforma: primeiro nome + último sobrenome
// ("Carlos Henrique de Carvalho Silva Corrêa" → "Carlos Corrêa").
//
// Carregar logo depois do supabase-js. Ajusta, na leitura, as respostas do Supabase:
//   - linhas da tabela `usuarios` (o nome completo fica em `nome_completo`);
//   - pessoas embutidas em outras consultas (objeto com `iniciais`, ou relação
//     chamada usuarios / coordenador / autor / responsavel / revisor ...);
//   - colunas de texto com nome de pessoa (criado_por_nome, usuario_nome, ...).
// Nada é gravado: o banco continua com o nome completo.
(function () {
  'use strict';

  function nomeCurto(nome) {
    if (typeof nome !== 'string') return nome;
    var p = nome.trim().split(/\s+/).filter(Boolean);
    return p.length <= 2 ? p.join(' ') : p[0] + ' ' + p[p.length - 1];
  }
  window.expNomeCurto = nomeCurto;

  // Colunas de texto que guardam nome de alguém da equipe
  var COLUNAS_PESSOA = {
    criado_por_nome: 1, concluido_por_nome: 1, usuario_nome: 1, atribuido_nome: 1,
    aprovado_por_nome: 1, coordenador_nome: 1, sender_nome: 1, sender_name: 1,
    validado_por_nome: 1, atrib_nome: 1, fechado_por_nome: 1, registrado_por_nome: 1,
    autor_nome: 1, editado_por_nome: 1, socia_nome: 1, revisor_nome: 1,
  };
  // Relações embutidas que são pessoas (ex.: usuarios(nome), coordenador:usuarios(nome))
  var RELACAO_PESSOA = /^(usuarios?|usuario_[a-z_]+|coordenador[a-z_]*|autor|criador|criado_por|responsavel[a-z_]*|revisor|sender|membro|socio[a-z_]*|dev[a-z_]*|user)$/i;

  function ajustarPessoa(o) {
    if (!o || typeof o !== 'object' || typeof o.nome !== 'string') return;
    if (o.nome_completo === undefined) o.nome_completo = o.nome;
    o.nome = nomeCurto(o.nome);
  }

  function percorrer(o, ehUsuarios, nivel) {
    if (!o || typeof o !== 'object' || nivel > 4) return;
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) percorrer(o[i], ehUsuarios, nivel); return; }
    if (ehUsuarios || ('iniciais' in o && 'nome' in o)) ajustarPessoa(o);
    for (var k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      var v = o[k];
      if (typeof v === 'string') {
        if (COLUNAS_PESSOA[k]) o[k] = nomeCurto(v);
      } else if (v && typeof v === 'object') {
        if (RELACAO_PESSOA.test(k)) (Array.isArray(v) ? v : [v]).forEach(ajustarPessoa);
        percorrer(v, false, nivel + 1);
      }
    }
  }
  window.expNomeCurtoAjustar = function (dados) { try { percorrer(dados, false, 0); } catch (e) {} return dados; };

  // Intercepta o resultado das consultas (o `then` dos builders do supabase-js)
  function acharProtoThen() {
    var lib = window.supabase;
    if (!lib || typeof lib.createClient !== 'function') return null;
    try {
      var c = lib.createClient('https://exp-nome-curto.invalid', 'x', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'exp-nome-curto' },
      });
      var p = Object.getPrototypeOf(c.from('x').select('*'));
      while (p && !Object.prototype.hasOwnProperty.call(p, 'then')) p = Object.getPrototypeOf(p);
      return p;
    } catch (e) { return null; }
  }

  var proto = acharProtoThen();
  if (!proto || proto.__expNomeCurto) return;
  var thenOriginal = proto.then;
  proto.then = function (onOk, onErr) {
    var self = this;
    return thenOriginal.call(this, function (res) {
      try {
        if (res && res.data) {
          var url = self.url && (self.url.pathname || String(self.url));
          percorrer(res.data, /\/usuarios$/.test(url || ''), 0);
        }
      } catch (e) { /* nunca quebra a consulta */ }
      return onOk ? onOk(res) : res;
    }, onErr);
  };
  proto.__expNomeCurto = true;
})();
