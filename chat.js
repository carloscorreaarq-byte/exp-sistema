/* ═══════════════════════════════════════════════════════════════════
   EXP · CHAT WIDGET — chat.js
   Fase 1: canal #geral · status via Presence · reactions · badge
   ─────────────────────────────────────────────────────────────────
   Uso: incluir <script src="chat.js"></script> antes de </body>
        em todos os módulos do sistema.
   Requer: @supabase/supabase-js@2 já carregado na página,
           sessionStorage.exp_usuario preenchido (usuário logado).
   ═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ── Configuração ─────────────────────────────────────────────── */
  var SB_URL  = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
  var SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
  var CHANNEL = 'general';
  var STATUS_KEY = 'exp_chat_status'; // localStorage

  var STATUS_LABELS = {
    online:  'Online',
    foco:    'Foco',
    ocupado: 'Ocupado',
    ausente:  'Ausente'
  };

  /* ── Estado interno ───────────────────────────────────────────── */
  var sb             = null;   // Supabase client (escopo isolado)
  var user           = null;   // { id, auth_id, nome, iniciais, cor, ... }
  var presenceCh     = null;   // Canal de Presence
  var msgCh          = null;   // Canal de mensagens (postgres_changes)
  var messages       = [];     // Array de mensagens carregadas
  var isOpen         = false;  // Painel aberto?
  var isLoading      = false;  // Carregando mensagens?
  var unreadCount    = 0;      // Mensagens não lidas
  var userStatus     = localStorage.getItem(STATUS_KEY) || 'online';
  var scrolledToEnd  = true;   // Usuário está no fim do scroll?
  var lastMsgDate    = null;   // Para separadores de data

  /* ── Refs DOM ─────────────────────────────────────────────────── */
  var $panel, $msgs, $input, $badge, $dot, $select;

  /* ══════════════════════════════════════════════════════════════
     INIT
  ══════════════════════════════════════════════════════════════ */
  function init() {
    // Só roda se há usuário logado (ignora página de login)
    var raw = sessionStorage.getItem('exp_usuario');
    if (!raw) return;

    try { user = JSON.parse(raw); } catch (e) { return; }
    if (!user || !user.nome) return;

    // Garantir auth_id (fallback para id se necessário)
    if (!user.auth_id) user.auth_id = user.id;

    // Cliente Supabase isolado (não conflita com `sb` das páginas)
    sb = supabase.createClient(SB_URL, SB_KEY);

    // Verificar sessão ativa antes de montar o widget
    sb.auth.getSession().then(function (result) {
      if (!result.data || !result.data.session) return;
      mountWidget();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     MONTAGEM DO WIDGET
  ══════════════════════════════════════════════════════════════ */
  function mountWidget() {
    if (document.getElementById('exp-chat-widget')) return;

    // Carregar CSS externo
    injectCSS();

    // Injetar HTML do widget
    injectHTML();

    // Cachear refs DOM
    $panel  = document.getElementById('exp-chat-panel');
    $msgs   = document.getElementById('exp-chat-msgs');
    $input  = document.getElementById('exp-chat-input');
    $badge  = document.getElementById('exp-chat-badge');
    $dot    = document.getElementById('exp-chat-dot');
    $select = document.getElementById('exp-chat-select');

    // Aplicar status salvo
    applyStatus(userStatus, false);

    // Monitorar scroll (para o toast "nova mensagem")
    $msgs.addEventListener('scroll', function () {
      var atBottom = $msgs.scrollHeight - $msgs.scrollTop - $msgs.clientHeight < 40;
      scrolledToEnd = atBottom;
    });

    // Inicializar Presence + contagem de não lidas
    setupPresence();
    fetchUnreadCount();
    subscribeMessages();

    // Descadastrar Presence ao sair/navegar
    window.addEventListener('beforeunload', function () {
      if (presenceCh) presenceCh.untrack();
    });
  }

  /* ── CSS embutido (sem dependência de arquivo externo) ───────── */
  function injectCSS() {
    if (document.getElementById('exp-chat-css')) return;
    var style = document.createElement('style');
    style.id = 'exp-chat-css';
    style.textContent = [
      '#exp-chat-widget{position:fixed;bottom:24px;right:24px;z-index:10000;font-family:"Raleway",sans-serif;font-size:14px;color:#111110}',
      '.chat-toggle{width:48px;height:48px;background:var(--verde,#1D6A4A);border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 4px 20px rgba(29,106,74,.35);position:relative;transition:transform .15s ease,box-shadow .15s ease;user-select:none}',
      '.chat-toggle:hover{transform:scale(1.07);box-shadow:0 6px 24px rgba(29,106,74,.45)}',
      '.chat-toggle:active{transform:scale(.96)}',
      '.chat-badge{position:absolute;top:-5px;right:-5px;background:var(--tc,#B84C3A);color:#fff;font-size:10px;font-weight:700;font-family:"DM Mono",monospace;min-width:18px;height:18px;border-radius:9px;display:none;align-items:center;justify-content:center;padding:0 4px;border:2px solid var(--off,#F7F6F3);line-height:1}',
      '.chat-panel{position:absolute;bottom:60px;right:0;width:320px;height:480px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.14),0 2px 8px rgba(0,0,0,.06);display:none;flex-direction:column;overflow:hidden;animation:chatOpen .18s ease-out;border:1px solid var(--cinza2,#ECEAE4)}',
      '@keyframes chatOpen{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
      '.chat-header{padding:14px 16px 12px;background:var(--verde,#1D6A4A);color:#fff;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}',
      '.chat-header-info{display:flex;flex-direction:column;gap:2px}',
      '.chat-header-title{font-weight:700;font-size:13px;letter-spacing:.2px}',
      '.chat-header-channel{font-family:"DM Mono",monospace;font-size:10px;opacity:.65;letter-spacing:.3px}',
      '.chat-close{background:rgba(255,255,255,.12);border:none;color:#fff;cursor:pointer;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;transition:background .12s;flex-shrink:0}',
      '.chat-close:hover{background:rgba(255,255,255,.22)}',
      '.chat-status-bar{padding:9px 14px;border-bottom:1px solid var(--cinza2,#ECEAE4);display:flex;align-items:center;gap:8px;background:#fff;flex-shrink:0}',
      '.chat-status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;transition:background .2s}',
      '.chat-status-dot.online{background:var(--verde-l,#2D9E6B)}',
      '.chat-status-dot.foco{background:var(--az,#1D4FA0)}',
      '.chat-status-dot.ocupado{background:var(--tc,#B84C3A)}',
      '.chat-status-dot.ausente{background:var(--am,#C4831A)}',
      '.chat-status-nome{font-weight:600;font-size:12px;color:var(--preto,#111110);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.chat-status-select{border:1px solid var(--cinza2,#ECEAE4);background:var(--off,#F7F6F3);font-family:"Raleway",sans-serif;font-size:11px;font-weight:500;color:var(--preto,#111110);cursor:pointer;padding:3px 6px;border-radius:6px;outline:none;transition:border-color .12s}',
      '.chat-status-select:hover,.chat-status-select:focus{border-color:var(--verde-l,#2D9E6B)}',
      '.chat-messages{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:2px;scroll-behavior:smooth}',
      '.chat-messages::-webkit-scrollbar{width:4px}',
      '.chat-messages::-webkit-scrollbar-track{background:transparent}',
      '.chat-messages::-webkit-scrollbar-thumb{background:var(--cinza,#D0CFC9);border-radius:2px}',
      '.chat-empty{text-align:center;color:var(--cinza,#D0CFC9);font-size:12px;line-height:1.7;margin:auto;padding:24px 16px}',
      '.chat-empty-icon{font-size:28px;margin-bottom:8px;opacity:.6}',
      '.chat-loading{display:flex;align-items:center;justify-content:center;gap:6px;margin:auto;color:var(--cinza,#D0CFC9);font-size:12px}',
      '.chat-loading-dot{width:5px;height:5px;border-radius:50%;background:var(--cinza,#D0CFC9);animation:chatPulse 1.2s ease-in-out infinite}',
      '.chat-loading-dot:nth-child(2){animation-delay:.2s}',
      '.chat-loading-dot:nth-child(3){animation-delay:.4s}',
      '@keyframes chatPulse{0%,80%,100%{opacity:.2}40%{opacity:1}}',
      '.chat-date-sep{display:flex;align-items:center;gap:8px;margin:10px 0 6px;color:var(--cinza,#D0CFC9);font-size:10px;font-family:"DM Mono",monospace;letter-spacing:.4px}',
      '.chat-date-sep::before,.chat-date-sep::after{content:"";flex:1;height:1px;background:var(--cinza2,#ECEAE4)}',
      '.chat-msg{display:flex;flex-direction:column;gap:2px;padding:3px 6px;border-radius:8px;transition:background .1s}',
      '.chat-msg:hover{background:var(--off,#F7F6F3)}',
      '.chat-msg-meta{display:flex;align-items:center;gap:7px;margin-top:8px}',
      '.chat-av{width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0;font-family:"DM Mono",monospace}',
      '.chat-msg-name{font-weight:600;font-size:12px;color:var(--preto,#111110)}',
      '.chat-msg.own .chat-msg-name{color:var(--verde,#1D6A4A)}',
      '.chat-msg-time{font-family:"DM Mono",monospace;font-size:9px;color:var(--cinza,#D0CFC9);margin-left:2px}',
      '.chat-msg-text{font-size:13px;color:var(--preto,#111110);line-height:1.55;word-break:break-word;padding:0 2px}',
      '.chat-msg-text.grouped,.chat-msg-reactions.grouped{margin-left:31px}',
      '.chat-msg-reactions{display:flex;gap:5px;margin-top:2px;opacity:0;transition:opacity .12s}',
      '.chat-msg:hover .chat-msg-reactions,.chat-msg-reactions.has-reactions{opacity:1}',
      '.chat-rbtn{background:var(--off,#F7F6F3);border:1px solid var(--cinza2,#ECEAE4);border-radius:12px;padding:2px 8px;font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:3px;transition:background .1s,border-color .1s,transform .08s;color:var(--preto,#111110);font-family:"Raleway",sans-serif;line-height:1}',
      '.chat-rbtn:hover{background:var(--verde-bg,#EAF5EE);border-color:var(--verde-l,#2D9E6B);transform:scale(1.05)}',
      '.chat-rbtn.active{background:var(--verde-bg,#EAF5EE);border-color:var(--verde,#1D6A4A);font-weight:600}',
      '.chat-rbtn-count{font-size:10px;font-family:"DM Mono",monospace;font-weight:500;color:var(--verde,#1D6A4A);min-width:8px}',
      '.chat-input-area{padding:10px 12px;border-top:1px solid var(--cinza2,#ECEAE4);display:flex;gap:8px;align-items:flex-end;background:#fff;flex-shrink:0}',
      '.chat-input{flex:1;border:1px solid var(--cinza2,#ECEAE4);border-radius:10px;padding:8px 12px;font-family:"Raleway",sans-serif;font-size:13px;resize:none;outline:none;max-height:80px;min-height:36px;color:var(--preto,#111110);background:var(--off,#F7F6F3);line-height:1.45;transition:border-color .15s,background .15s;overflow-y:auto}',
      '.chat-input::placeholder{color:var(--cinza,#D0CFC9)}',
      '.chat-input:focus{border-color:var(--verde,#1D6A4A);background:#fff}',
      '.chat-send{width:36px;height:36px;background:var(--verde,#1D6A4A);border:none;border-radius:10px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,transform .08s}',
      '.chat-send:hover{background:var(--verde-l,#2D9E6B)}',
      '.chat-send:active{transform:scale(.93)}',
      '.chat-send:disabled{background:var(--cinza2,#ECEAE4);cursor:not-allowed;transform:none}',
      '.chat-new-msg-toast{position:absolute;bottom:130px;left:50%;transform:translateX(-50%);background:var(--verde,#1D6A4A);color:#fff;font-size:11px;font-weight:600;padding:5px 12px;border-radius:20px;cursor:pointer;white-space:nowrap;box-shadow:0 2px 10px rgba(29,106,74,.3);animation:chatToastIn .2s ease-out;z-index:10001}',
      '@keyframes chatToastIn{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ── HTML ─────────────────────────────────────────────────────── */
  function injectHTML() {
    var wrap = document.createElement('div');
    wrap.id = 'exp-chat-widget';

    var firstName = user.nome.split(' ')[0];

    wrap.innerHTML = [
      /* ── Painel expandido ── */
      '<div class="chat-panel" id="exp-chat-panel" style="display:none">',

        /* Cabeçalho */
        '<div class="chat-header">',
          '<div class="chat-header-info">',
            '<div class="chat-header-title">Chat da equipe</div>',
            '<div class="chat-header-channel"># geral</div>',
          '</div>',
          '<button class="chat-close" onclick="expChat.close()" title="Fechar">✕</button>',
        '</div>',

        /* Barra de status */
        '<div class="chat-status-bar">',
          '<div class="chat-status-dot online" id="exp-chat-dot"></div>',
          '<span class="chat-status-nome">' + escHtml(firstName) + '</span>',
          '<select class="chat-status-select" id="exp-chat-select"',
            ' onchange="expChat.setStatus(this.value)"',
            ' title="Alterar status">',
            '<option value="online">Online</option>',
            '<option value="foco">Foco</option>',
            '<option value="ocupado">Ocupado</option>',
            '<option value="ausente">Ausente</option>',
          '</select>',
        '</div>',

        /* Mensagens */
        '<div class="chat-messages" id="exp-chat-msgs">',
          renderLoading(),
        '</div>',

        /* Input */
        '<div class="chat-input-area">',
          '<textarea class="chat-input" id="exp-chat-input"',
            ' placeholder="Mensagem para #geral…" rows="1"',
            ' onkeydown="expChat.handleKey(event)"',
            ' oninput="expChat.autoResize(this)"></textarea>',
          '<button class="chat-send" id="exp-chat-send"',
            ' onclick="expChat.send()" title="Enviar (Enter)">',
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"',
              ' stroke="currentColor" stroke-width="2.5"',
              ' stroke-linecap="round" stroke-linejoin="round">',
              '<line x1="22" y1="2" x2="11" y2="13"/>',
              '<polygon points="22 2 15 22 11 13 2 9 22 2"/>',
            '</svg>',
          '</button>',
        '</div>',

      '</div>',

      /* ── Botão flutuante ── */
      '<div class="chat-toggle" id="exp-chat-toggle"',
        ' onclick="expChat.toggle()" title="Chat da equipe">',
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none"',
          ' stroke="white" stroke-width="2" stroke-linecap="round"',
          ' stroke-linejoin="round">',
          '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        '</svg>',
        '<div class="chat-badge" id="exp-chat-badge"></div>',
      '</div>'
    ].join('');

    document.body.appendChild(wrap);
  }

  /* ══════════════════════════════════════════════════════════════
     STATUS (Presence)
  ══════════════════════════════════════════════════════════════ */
  function applyStatus(status, broadcast) {
    if (typeof broadcast === 'undefined') broadcast = true;

    userStatus = status;
    localStorage.setItem(STATUS_KEY, status);

    // Atualizar dot e select no DOM
    if ($dot) {
      $dot.className = 'chat-status-dot ' + status;
    }
    if ($select) {
      $select.value = status;
    }

    // Broadcast via Presence
    if (broadcast && presenceCh) {
      presenceCh.track(presencePayload(status));
    }
  }

  function presencePayload(status) {
    return {
      user_id:  user.auth_id,
      nome:     user.nome,
      iniciais: user.iniciais || user.nome.substring(0, 2).toUpperCase(),
      cor:      user.cor || '#1D6A4A',
      status:   status
    };
  }

  function setupPresence() {
    presenceCh = sb.channel('exp:chat:presence');

    presenceCh
      .on('presence', { event: 'sync' }, function () {
        // Presença sincronizada — poderíamos mostrar quem está online
        // no futuro (Fase 2: lista de membros online)
      })
      .subscribe(function (status) {
        if (status === 'SUBSCRIBED') {
          presenceCh.track(presencePayload(userStatus));
        }
      });
  }

  /* ══════════════════════════════════════════════════════════════
     REALTIME — MENSAGENS
  ══════════════════════════════════════════════════════════════ */
  function subscribeMessages() {
    msgCh = sb.channel('exp:chat:messages')
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'chat_messages',
        filter: 'channel=eq.' + CHANNEL
      }, function (payload) {
        var msg = payload.new;
        messages.push(msg);

        if (isOpen) {
          // Painel aberto: renderizar e rolar (ou mostrar toast)
          renderMessages();
          if (scrolledToEnd) {
            scrollBottom();
          } else if (msg.sender_id !== user.auth_id) {
            showNewMsgToast();
          }
          // Marcar como lido somente se é de outro usuário
          if (msg.sender_id !== user.auth_id) markRead();
        } else {
          // Painel fechado: só incrementar badge se não é minha mensagem
          if (msg.sender_id !== user.auth_id) {
            unreadCount++;
            updateBadge();
          }
        }
      })
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'chat_messages',
        filter: 'channel=eq.' + CHANNEL
      }, function (payload) {
        var updated = payload.new;
        var idx = messages.findIndex(function (m) { return m.id === updated.id; });
        if (idx !== -1) {
          messages[idx] = updated;
          if (isOpen) renderMessages();
        }
      })
      .subscribe();
  }

  /* ══════════════════════════════════════════════════════════════
     CARREGAR MENSAGENS (últimas 72h)
  ══════════════════════════════════════════════════════════════ */
  function loadMessages() {
    if (isLoading) return;
    isLoading = true;

    showLoading();

    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    sb.from('chat_messages')
      .select('*')
      .eq('channel', CHANNEL)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .then(function (result) {
        isLoading = false;
        if (result.error) {
          showError();
          return;
        }
        messages = result.data || [];
        renderMessages();
        scrollBottom();
      });
  }

  /* ══════════════════════════════════════════════════════════════
     CONTAGEM DE NÃO LIDAS
  ══════════════════════════════════════════════════════════════ */
  function fetchUnreadCount() {
    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    // Buscar last_read_at do usuário
    sb.from('chat_read_status')
      .select('last_read_at')
      .eq('user_id', uid)
      .eq('channel', CHANNEL)
      .maybeSingle()
      .then(function (result) {
        var lastRead = (result.data && result.data.last_read_at) ? result.data.last_read_at : since;

        // Contar mensagens mais novas que last_read (excluindo as próprias)
        sb.from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('channel', CHANNEL)
          .gt('created_at', lastRead)
          .neq('sender_id', uid)
          .then(function (countResult) {
            unreadCount = countResult.count || 0;
            updateBadge();
          });
      });
  }

  function markRead() {
    sb.from('chat_read_status')
      .upsert({
        user_id:      user.auth_id,
        channel:      CHANNEL,
        last_read_at: new Date().toISOString()
      })
      .then(function () {
        unreadCount = 0;
        updateBadge();
      });
  }

  /* ══════════════════════════════════════════════════════════════
     ENVIAR MENSAGEM
  ══════════════════════════════════════════════════════════════ */
  function send() {
    if (!$input) return;
    var content = $input.value.trim();
    if (!content) return;

    // Limpar input imediatamente (UX responsiva)
    $input.value = '';
    $input.style.height = 'auto';

    sb.from('chat_messages')
      .insert({
        channel:        CHANNEL,
        sender_id:      user.auth_id,
        sender_name:    user.nome,
        sender_iniciais: user.iniciais || user.nome.substring(0, 2).toUpperCase(),
        sender_cor:     user.cor || '#1D6A4A',
        content:        content
      })
      .then(function (result) {
        if (result.error) {
          // Recolocar texto no input se falhar
          $input.value = content;
          console.warn('[EXP Chat] Erro ao enviar:', result.error.message);
        }
      });
  }

  /* ══════════════════════════════════════════════════════════════
     REACTIONS
  ══════════════════════════════════════════════════════════════ */
  function toggleReaction(msgId, type) {
    var msg = messages.find(function (m) { return m.id === msgId; });
    if (!msg) return;

    var uid = user.auth_id;
    var reactions = msg.reactions || { like: [], love: [] };
    var arr = (reactions[type] || []).slice(); // cópia

    var idx = arr.indexOf(uid);
    if (idx === -1) arr.push(uid);
    else arr.splice(idx, 1);

    var updated = Object.assign({}, reactions);
    updated[type] = arr;

    // Atualizar otimisticamente no estado local
    msg.reactions = updated;
    renderMessages();

    // Persistir no banco
    sb.from('chat_messages')
      .update({ reactions: updated })
      .eq('id', msgId)
      .then(function (result) {
        if (result.error) {
          // Reverter em caso de erro
          msg.reactions = reactions;
          renderMessages();
        }
      });
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════ */
  function renderMessages() {
    if (!$msgs) return;

    if (messages.length === 0) {
      $msgs.innerHTML = [
        '<div class="chat-empty">',
          '<div class="chat-empty-icon">💬</div>',
          'Nenhuma mensagem ainda.<br>Diga olá à equipe!',
        '</div>'
      ].join('');
      return;
    }

    var uid  = user.auth_id;
    var html = '';
    var prevSenderId = null;
    var prevTime     = null;
    lastMsgDate      = null;

    messages.forEach(function (msg) {
      var isOwn   = msg.sender_id === uid;
      var msgDate = new Date(msg.created_at);
      var dateStr = msgDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

      /* Separador de data */
      if (dateStr !== lastMsgDate) {
        lastMsgDate = dateStr;
        html += '<div class="chat-date-sep">' + formatDateSep(msgDate) + '</div>';
        prevSenderId = null; // Forçar novo header após separador
      }

      /* Agrupamento: mesmo remetente E dentro de 5 minutos */
      var gap = prevTime ? (msgDate - prevTime) : Infinity;
      var grouped = (msg.sender_id === prevSenderId) && (gap < 5 * 60 * 1000);

      var timeStr = msgDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      var iniciais = msg.sender_iniciais || msg.sender_name.substring(0, 2).toUpperCase();
      var cor      = msg.sender_cor || '#1D6A4A';

      var reactions  = msg.reactions || { like: [], love: [] };
      var likesArr   = reactions.like  || [];
      var lovesArr   = reactions.love  || [];
      var userLiked  = likesArr.indexOf(uid)  !== -1;
      var userLoved  = lovesArr.indexOf(uid) !== -1;
      var likeCount  = likesArr.length;
      var loveCount  = lovesArr.length;
      var hasReact   = likeCount > 0 || loveCount > 0;

      html += '<div class="chat-msg' + (isOwn ? ' own' : '') + '" data-id="' + msg.id + '">';

      /* Header (avatar + nome + hora) */
      if (!grouped) {
        html += '<div class="chat-msg-meta">';
        html += '<div class="chat-av" style="background:' + cor + '">' + escHtml(iniciais) + '</div>';
        html += '<span class="chat-msg-name">' + escHtml(msg.sender_name) + '</span>';
        html += '<span class="chat-msg-time">' + timeStr + '</span>';
        html += '</div>';
      }

      /* Texto */
      html += '<div class="chat-msg-text' + (grouped ? ' grouped' : '') + '">';
      html += escHtml(msg.content).replace(/\n/g, '<br>');
      html += '</div>';

      /* Reactions */
      html += '<div class="chat-msg-reactions' + (grouped ? ' grouped' : '') + (hasReact ? ' has-reactions' : '') + '">';

      html += '<button class="chat-rbtn' + (userLiked ? ' active' : '') + '"';
      html += ' onclick="expChat.react(\'' + msg.id + '\',\'like\')"';
      html += ' data-count="' + likeCount + '"';
      html += ' title="Curtir">';
      html += '👍';
      if (likeCount > 0) html += '<span class="chat-rbtn-count">' + likeCount + '</span>';
      html += '</button>';

      html += '<button class="chat-rbtn' + (userLoved ? ' active' : '') + '"';
      html += ' onclick="expChat.react(\'' + msg.id + '\',\'love\')"';
      html += ' data-count="' + loveCount + '"';
      html += ' title="Amar">';
      html += '❤️';
      if (loveCount > 0) html += '<span class="chat-rbtn-count">' + loveCount + '</span>';
      html += '</button>';

      html += '</div>'; // .chat-msg-reactions
      html += '</div>'; // .chat-msg

      prevSenderId = msg.sender_id;
      prevTime     = msgDate;
    });

    $msgs.innerHTML = html;
  }

  /* ══════════════════════════════════════════════════════════════
     UI HELPERS
  ══════════════════════════════════════════════════════════════ */
  function updateBadge() {
    if (!$badge) return;
    if (unreadCount > 0) {
      $badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
      $badge.style.display = 'flex';
    } else {
      $badge.style.display = 'none';
    }
  }

  function scrollBottom() {
    if ($msgs) {
      $msgs.scrollTop = $msgs.scrollHeight;
      scrolledToEnd = true;
    }
  }

  function showLoading() {
    if (!$msgs) return;
    $msgs.innerHTML = renderLoading();
  }

  function renderLoading() {
    return [
      '<div class="chat-loading">',
        '<div class="chat-loading-dot"></div>',
        '<div class="chat-loading-dot"></div>',
        '<div class="chat-loading-dot"></div>',
      '</div>'
    ].join('');
  }

  function showError() {
    if (!$msgs) return;
    $msgs.innerHTML = '<div class="chat-empty">Erro ao carregar mensagens.<br>Tente novamente.</div>';
  }

  function showNewMsgToast() {
    // Remover toast anterior se existir
    var old = document.getElementById('exp-chat-toast');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.id = 'exp-chat-toast';
    toast.className = 'chat-new-msg-toast';
    toast.textContent = '↓ Nova mensagem';
    toast.onclick = function () {
      scrollBottom();
      toast.remove();
    };
    $panel.appendChild(toast);

    // Auto-remover após 4s
    setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 4000);
  }

  /* ── Formatação de data para separadores ─────────────────────── */
  function formatDateSep(date) {
    var today     = new Date();
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    var isToday     = date.toDateString() === today.toDateString();
    var isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday)     return 'Hoje';
    if (isYesterday) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }

  /* ── HTML escape (segurança) ──────────────────────────────────── */
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── Auto-resize do textarea ──────────────────────────────────── */
  function autoResize(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 80) + 'px';
  }

  /* ── Tecla Enter (enviar) / Shift+Enter (quebra de linha) ─────── */
  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     ABRIR / FECHAR
  ══════════════════════════════════════════════════════════════ */
  function toggle() {
    if (isOpen) close();
    else open();
  }

  function open() {
    if (!$panel) return;
    isOpen = true;
    $panel.style.display = 'flex';
    loadMessages();  // carrega/recarrega ao abrir
    markRead();
    // Focar input após breve delay (aguardar animação CSS)
    setTimeout(function () { if ($input) $input.focus(); }, 150);
  }

  function close() {
    if (!$panel) return;
    isOpen = false;
    $panel.style.display = 'none';
  }

  /* ══════════════════════════════════════════════════════════════
     API PÚBLICA — expChat.*
     (referenciada pelos onclick inline do HTML)
  ══════════════════════════════════════════════════════════════ */
  window.expChat = {
    toggle:     toggle,
    open:       open,
    close:      close,
    send:       send,
    setStatus:  function (s) { applyStatus(s, true); },
    react:      toggleReaction,
    handleKey:  handleKey,
    autoResize: autoResize
  };

  /* ══════════════════════════════════════════════════════════════
     BOOT — aguarda Supabase SDK carregar na página
  ══════════════════════════════════════════════════════════════ */
  function boot() {
    if (typeof supabase === 'undefined') {
      // SDK ainda não carregou — tentar em breve
      setTimeout(boot, 200);
      return;
    }
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    // Pequeno delay para garantir que o init() da página rodou primeiro
    setTimeout(boot, 50);
  }

})();
