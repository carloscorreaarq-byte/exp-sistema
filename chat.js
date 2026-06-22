/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   EXP Â· CHAT WIDGET â€” chat.js  v2.0
   Fase 2: #geral Â· DMs Â· status redesign Â· som Â· links
   â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   Incluir <script src="chat.js"></script> antes de </body>
   em todos os mÃ³dulos. Requer @supabase/supabase-js@2 jÃ¡ carregado.
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

(function () {
  'use strict';

  /* â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var SB_URL     = 'https://pgnydwsjntaezdhkgvpu.supabase.co';
  var SB_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnbnlkd3NqbnRhZXpkaGtndnB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwODk3MTMsImV4cCI6MjA5MDY2NTcxM30.ykOuoOONh31Ws2A2BJMG_WZzr5TBcu3fQCB8APICbBo';
  var STATUS_KEY  = 'exp_chat_status';
  var SOUND_KEY   = 'exp_chat_sound';            /* legado: on/off */
  var SOUND_LEVEL_KEY = 'exp_chat_sound_level';  /* off | low | med | high */
  var SOUND_VOL   = { off:0, low:0.45, med:1, high:1.9 }; /* multiplicador do volume base */
  var SOUND_LABELS = { off:'Desligado', low:'Volume baixo', med:'Volume médio', high:'Volume alto' };
  var PINNED_KEY  = 'exp_chat_pinned';
  var COLOR_KEY   = 'exp_chat_color';   // tema de cor — mesma chave do chat full
  var FLAGS_KEY   = 'exp_chat_flags';   // mensagens sinalizadas — mesma chave do chat full

  var STATUS_COLORS = {
    online:  '#1D6A4A',
    foco:    '#1D4FA0',
    ausente: '#C4831A'
  };
  /* Temas de cor (acento) — espelham o chat full: verde, azul, ouro, terracota.
     Aplicados sobrescrevendo as vars de marca (--verde*) no root do widget. */
  var CHAT_COLOR_THEMES = {
    verde:     { v: '#1D6A4A', l: '#2D9E6B', bg: '#EAF5EE' },
    azul:      { v: '#1D4FA0', l: '#4A72B5', bg: '#EAF0FA' },
    ouro:      { v: '#C4831A', l: '#D9A23E', bg: '#FBF3E3' },
    terracota: { v: '#B84C3A', l: '#D06B58', bg: '#FBEEEB' }
  };
  var BRAND_AVATAR_COLORS = ['#1D6A4A', '#1D4FA0', '#C4831A', '#B84C3A', '#6D7D8A', '#4A72B5', '#7A9E7E'];
  var TEMP_MEDIA_BUCKET = 'gestao-anexos-temp';
  var CHAT_IMAGE_SENTINEL = '[print]';
  var SIGNED_URL_EXPIRES = 7 * 24 * 60 * 60; /* 7 dias — cobre toda a vida do print (expira em 7d) */
  var CHAT_MEDIA_LIMITS = {
    largura_max_px: 1280,
    tamanho_max_kb: 500,
    qualidade_upload: 0.76,
    qualidade_fallback: 0.70
  };

  /* â”€â”€ CSS embutido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var CSS_TEXT = [
    '#exp-chat-widget{position:fixed;bottom:24px;right:24px;z-index:10000;font-family:"Raleway",sans-serif}',
    /* â”€â”€ Controls bar â”€â”€ */
    '.chat-controls{display:flex;align-items:flex-end;gap:8px;justify-content:flex-end}',
    /* â”€â”€ FAB toggle â”€â”€ */
    '.chat-toggle{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;transition:background .3s,transform .15s;user-select:none;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.22)}',
    '.chat-toggle:hover{transform:scale(1.06)}.chat-toggle:active{transform:scale(.94)}',
    '.chat-badge{position:absolute;top:-5px;right:-5px;background:#B84C3A;color:#fff;font-size:9px;font-weight:700;font-family:"DM Mono",monospace;min-width:17px;height:17px;border-radius:9px;display:none;align-items:center;justify-content:center;padding:0 3px;border:2px solid var(--off,#F7F6F3)}',
    /* â”€â”€ Person button (aparece quando aberto) â”€â”€ */
    '.chat-person-btn{width:34px;height:34px;border-radius:50%;background:#fff;border:2px solid #1D6A4A;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color .3s,color .3s,box-shadow .15s;color:#1D6A4A;flex-shrink:0}',
    '.chat-person-btn:hover{box-shadow:0 2px 10px rgba(0,0,0,.14)}',
    /* â”€â”€ Status indicator (aparece quando fechado) â”€â”€ */
    '.chat-status-ind{display:flex;align-items:center;gap:4px;cursor:pointer;padding:4px 7px;background:rgba(255,255,255,.95);border-radius:14px;box-shadow:0 1px 8px rgba(0,0,0,.13);transition:box-shadow .15s;user-select:none;margin-bottom:5px;align-self:flex-end}',
    '.chat-status-ind:hover{box-shadow:0 2px 12px rgba(0,0,0,.2)}',
    '.chat-status-ind-dot{width:8px;height:8px;border-radius:50%;transition:background .3s}',
    '.chat-status-ind-dot.online{background:#2D9E6B}.chat-status-ind-dot.foco{background:#1D4FA0}.chat-status-ind-dot.ausente{background:#C4831A}',
    /* â”€â”€ Status popover (flat â€” sem efeito 3D) â”€â”€ */
    '.chat-status-pop{position:absolute;bottom:50px;right:50px;background:#fff;border:1px solid var(--cinza2,#ECEAE4);border-radius:10px;box-shadow:0 2px 12px rgba(0,0,0,.12);padding:5px;flex-direction:column;gap:1px;min-width:144px;z-index:10002}',
    '.chat-status-pop-hdr{font-size:10px;font-weight:600;color:var(--cinza,#D0CFC9);padding:4px 10px 6px;text-transform:uppercase;letter-spacing:.7px}',
    '.chat-sopt{display:flex;align-items:center;gap:9px;padding:7px 10px;border-radius:7px;border:none;background:none;cursor:pointer;font-family:"Raleway",sans-serif;font-size:12px;font-weight:500;width:100%;text-align:left;transition:background .1s;color:#111110}',
    '.chat-sopt:hover{background:var(--off,#F7F6F3)}.chat-sopt.active{background:var(--cinza2,#ECEAE4);font-weight:700}',
    '.chat-sopt-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}',
    /* â”€â”€ Group confirm bar â”€â”€ */
    '.chat-group-bar{padding:10px 12px;border-top:1px solid var(--cinza2,#ECEAE4);display:flex;align-items:center;justify-content:space-between;background:#fff;flex-shrink:0}',
    '.chat-group-info{font-size:11px;color:var(--cinza,#D0CFC9);font-weight:500}',
    '.chat-group-confirm{background:#111110;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-family:"Raleway",sans-serif;font-size:11px;font-weight:600;cursor:pointer;transition:opacity .15s}',
    '.chat-group-confirm:hover{opacity:.8}',
    /* â”€â”€ Member checkbox â”€â”€ */
    '.chat-member-check{width:18px;height:18px;border-radius:50%;border:1.5px solid var(--cinza2,#ECEAE4);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:background .12s,border-color .12s}',
    '.chat-member-check.sel{background:#111110;border-color:#111110}',
    '.chat-member-check.sel::after{content:"";width:5px;height:5px;border-radius:50%;background:#fff}',
    /* â”€â”€ Panel â”€â”€ */
    '.chat-panel{position:absolute;bottom:58px;right:0;width:320px;height:490px;background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.14);display:none;flex-direction:column;overflow:hidden;animation:chatOpen .18s ease-out;border:1px solid var(--cinza2,#ECEAE4)}',
    '@keyframes chatOpen{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:translateY(0) scale(1)}}',
    /* â”€â”€ Views â”€â”€ */
    '.chat-view{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0}',
    /* â”€â”€ Header â”€â”€ */
    '.chat-header{padding:7px 11px;background:var(--chat-head-bg,var(--cinza2,#ECEAE4));color:var(--chat-head-fg,var(--grafite,#111110));display:flex;align-items:center;gap:7px;flex-shrink:0}',
    '.chat-header-info{flex:1;min-width:0}',
    '.chat-header-title{font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-header-sub{font-size:11px;opacity:.8;margin-top:3px;display:flex;align-items:center;gap:4px}',
    '.chat-header-acts{display:flex;align-items:center;gap:3px}',
    '.chat-icon-btn{background:var(--chat-head-btn,rgba(0,0,0,.07));border:none;color:var(--chat-head-fg,var(--grafite,#111110));cursor:pointer;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .12s}',
    '.chat-icon-btn:hover{background:var(--chat-head-btn-h,rgba(0,0,0,.13))}',
    '.chat-close{background:var(--chat-head-btn,rgba(0,0,0,.07));border:none;color:var(--chat-head-fg,var(--grafite,#111110));cursor:pointer;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:13px;transition:background .12s}',
    '.chat-close:hover{background:var(--chat-head-btn-h,rgba(0,0,0,.13))}',
    '.chat-back-btn{background:var(--chat-head-btn,rgba(0,0,0,.07));border:none;color:var(--chat-head-fg,var(--grafite,#111110));cursor:pointer;width:26px;height:26px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:background .12s;flex-shrink:0}',
    '.chat-back-btn:hover{background:var(--chat-head-btn-h,rgba(0,0,0,.13))}',
    /* â”€â”€ Conv list / member list â”€â”€ */
    '.chat-conv-list,.chat-member-list{flex:1;overflow-y:auto;padding:6px}',
    '.chat-conv-list::-webkit-scrollbar,.chat-member-list::-webkit-scrollbar{width:3px}',
    '.chat-conv-list::-webkit-scrollbar-thumb,.chat-member-list::-webkit-scrollbar-thumb{background:var(--cinza,#D0CFC9);border-radius:2px}',
    '.chat-conv-item,.chat-member-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:background .1s}',
    '.chat-conv-item:hover,.chat-member-item:hover{background:var(--off,#F7F6F3)}',
    '.chat-conv-section{padding:8px 10px 4px;font-size:9px;font-weight:700;letter-spacing:.65px;text-transform:uppercase;color:var(--cinza,#D0CFC9)}',
    '.chat-conv-section-btn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px 4px;border:none;background:none;cursor:pointer;font-family:"Raleway",sans-serif;font-size:9px;font-weight:700;letter-spacing:.65px;text-transform:uppercase;color:var(--cinza,#D0CFC9);text-align:left}',
    '.chat-conv-section-btn:hover{color:var(--grafite,#111110)}',
    '.chat-conv-section-chev{font-size:11px;line-height:1;color:inherit}',
    '.chat-conv-av-hash{width:28px;height:28px;border-radius:50%;background:var(--verde-bg,#EAF5EE);color:var(--verde,#1D6A4A);font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0}',
    '.chat-conv-info{flex:1;min-width:0}',
    '.chat-conv-name{font-size:12px;font-weight:600;color:var(--preto,#111110);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-conv-preview{font-size:10px;color:var(--cinza,#D0CFC9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}',
    '.chat-conv-badge{background:#B84C3A;color:#fff;font-size:9px;font-weight:700;font-family:"DM Mono",monospace;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;flex-shrink:0}',
    '.chat-conv-pin-btn{display:none;align-items:center;justify-content:center;background:none;border:none;cursor:pointer;padding:3px;color:var(--cinza,#D0CFC9);border-radius:4px;flex-shrink:0;transition:color .15s}',
    '.chat-conv-pin-btn:hover{color:var(--verde,#1D6A4A)}',
    '.chat-conv-pin-btn.is-pinned{display:flex;color:var(--verde,#1D6A4A)}',
    '.chat-conv-item:hover .chat-conv-pin-btn{display:flex}',
    '.chat-search-wrap{padding:10px;border-bottom:1px solid var(--cinza2,#ECEAE4);background:#fff}',
    '.chat-search-input{width:100%;border:1px solid var(--cinza2,#ECEAE4);border-radius:10px;padding:8px 10px;font-family:"Raleway",sans-serif;font-size:12px;background:var(--off,#F7F6F3);color:var(--preto,#111110);outline:none}',
    '.chat-search-input:focus{border-color:var(--verde,#1D6A4A);background:#fff}',
    '.chat-search-results{flex:1;overflow-y:auto;padding:6px}',
    '.chat-search-group{padding:8px 10px 4px;font-size:9px;font-weight:700;letter-spacing:.65px;text-transform:uppercase;color:var(--cinza,#D0CFC9)}',
    '.chat-search-item{display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:10px;cursor:pointer;transition:background .1s}',
    '.chat-search-item:hover{background:var(--off,#F7F6F3)}',
    '.chat-search-body{flex:1;min-width:0}',
    '.chat-search-title{font-size:11px;font-weight:700;color:var(--preto,#111110);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-search-meta{font-size:9px;color:#999;margin-top:2px}',
    '.chat-search-snippet{font-size:10px;color:#666;line-height:1.45;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.chat-alert-stack{position:absolute;right:0;bottom:560px;width:320px;display:none;flex-direction:column;gap:8px;z-index:10001}',
    '.chat-alert-card{background:#fff;border:1px solid var(--cinza2,#ECEAE4);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.14);padding:9px 10px;cursor:pointer;transition:transform .12s,box-shadow .12s}',
    '.chat-alert-card:hover{transform:translateY(-1px);box-shadow:0 10px 32px rgba(0,0,0,.18)}',
    '.chat-alert-top{display:flex;align-items:center;gap:8px}',
    '.chat-alert-title{font-size:10px;font-weight:700;color:var(--preto,#111110);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-alert-preview{font-size:10px;color:#666;line-height:1.35;margin-top:5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.chat-alert-chip{margin-left:auto;font-size:8px;font-weight:700;letter-spacing:.45px;text-transform:uppercase;color:var(--verde,#1D6A4A);background:var(--verde-bg,#EAF5EE);border-radius:999px;padding:3px 7px}',
    /* â”€â”€ Messages â”€â”€ */
    '.chat-messages{flex:1;overflow-y:auto;padding:8px 8px 4px;display:flex;flex-direction:column;gap:0;scroll-behavior:smooth;background:var(--chat-msgs-bg,transparent)}',
    '.chat-messages::-webkit-scrollbar{width:3px}',
    '.chat-messages::-webkit-scrollbar-thumb{background:var(--cinza,#D0CFC9);border-radius:2px}',
    /* â”€â”€ Empty / loading â”€â”€ */
    '.chat-empty{text-align:center;color:var(--cinza,#D0CFC9);font-size:11px;line-height:1.7;margin:auto;padding:20px}',
    '.chat-empty-icon{font-size:22px;margin-bottom:6px;opacity:.5}',
    '.chat-loading{display:flex;align-items:center;justify-content:center;gap:5px;margin:auto;padding:20px}',
    '.chat-loading-dot{width:5px;height:5px;border-radius:50%;background:var(--cinza,#D0CFC9);animation:chatPulse 1.2s ease-in-out infinite}',
    '.chat-loading-dot:nth-child(2){animation-delay:.2s}.chat-loading-dot:nth-child(3){animation-delay:.4s}',
    '@keyframes chatPulse{0%,80%,100%{opacity:.2}40%{opacity:1}}',
    /* â”€â”€ Date separator â”€â”€ */
    '.chat-date-sep{display:flex;align-items:center;gap:7px;margin:8px 0 3px;color:var(--cinza,#D0CFC9);font-size:9px;font-family:"DM Mono",monospace;letter-spacing:.5px}',
    '.chat-date-sep::before,.chat-date-sep::after{content:"";flex:1;height:1px;background:var(--cinza2,#ECEAE4)}',
    /* â”€â”€ Message bubble â”€â”€ */
    '.chat-msg{display:flex;flex-direction:column;padding:2px 6px;border-radius:6px;transition:background .1s}',
    '.chat-msg:hover{background:var(--off,#F7F6F3)}',
    /* Alinhamento: recebidas Ã  esq, enviadas Ã  dir */
    '.chat-msg.own{align-items:flex-end}',
    '.chat-msg-meta{display:flex;align-items:center;gap:5px;margin-top:4px;margin-bottom:3px}',
    '.chat-msg.own .chat-msg-meta{flex-direction:row-reverse}',
    '.chat-av{width:17px;height:17px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#fff;flex-shrink:0;font-family:"DM Mono",monospace;letter-spacing:0}',
    '.chat-msg-name{font-weight:600;font-size:10px;color:var(--preto,#111110)}',
    '.chat-msg.own .chat-msg-name{color:var(--verde,#1D6A4A)}',
    '.chat-msg-time{font-family:"DM Mono",monospace;font-size:8px;color:var(--cinza,#D0CFC9)}',
    /* Bolhas: recv = off-white esq; sent = cinza2 dir */
    '.chat-msg-text{font-size:11px;line-height:1.45;word-break:break-word;padding:4px 8px;border-radius:10px;max-width:218px;display:inline-block}',
    '.chat-msg-text.recv{background:var(--off,#F7F6F3);color:var(--preto,#111110);border-radius:2px 10px 10px 10px}',
    '.chat-msg-text.sent{background:var(--cinza2,#ECEAE4);color:var(--preto,#111110);border-radius:10px 2px 10px 10px}',
    '.chat-msg-text.media-only{display:none}',
    '.chat-msg-edited{margin-left:5px;font-size:8px;font-style:italic;color:#b0aca3;white-space:nowrap}',
    /* Edição inline de mensagem */
    '.chat-msg-edit{display:flex;flex-direction:column;gap:5px;max-width:218px}',
    '.chat-msg.own .chat-msg-edit.sent{margin-left:auto}',
    '.chat-msg-edit-input{width:100%;min-height:32px;resize:none;font-family:inherit;font-size:11px;line-height:1.45;color:var(--preto,#111110);padding:5px 8px;border:1px solid var(--verde,#1D6A4A);border-radius:8px;background:var(--branco,#fff);outline:none;box-sizing:border-box}',
    '[data-theme="dark"] .chat-msg-edit-input{background:#2A2927;color:#F0EDE6}',
    '.chat-msg-edit-actions{display:flex;gap:5px}',
    '.chat-msg.own .chat-msg-edit-actions{justify-content:flex-end}',
    '.chat-msg-edit-save,.chat-msg-edit-cancel{font-family:inherit;font-size:10px;font-weight:600;padding:3px 10px;border-radius:6px;cursor:pointer;border:1px solid var(--cinza2,#ECEAE4);background:none;color:#888;transition:all .12s}',
    '.chat-msg-edit-save{background:var(--verde,#1D6A4A);border-color:var(--verde,#1D6A4A);color:#fff}',
    '.chat-msg-edit-save:hover{opacity:.88}',
    '.chat-msg-edit-cancel:hover{border-color:var(--verde,#1D6A4A);color:var(--verde,#1D6A4A)}',
    '.chat-media-thumb{display:block;max-width:218px;max-height:172px;border-radius:12px;overflow:hidden;border:1px solid rgba(17,17,16,.08);background:#F7F6F3;cursor:pointer;margin-top:4px}',
    '.chat-msg.own .chat-media-thumb{margin-left:auto}',
    '.chat-media-thumb img{display:block;width:100%;height:auto;max-height:172px;object-fit:cover}',
    '.chat-media-thumb-pending{display:flex;align-items:center;justify-content:center;min-height:88px;padding:10px;font-size:10px;font-weight:600;color:#666;background:linear-gradient(135deg, rgba(29,106,74,.08), rgba(196,131,26,.08))}',
    '.chat-media-expired{display:flex;align-items:center;justify-content:center;min-height:72px;padding:10px;font-size:10px;font-weight:600;color:#777;background:#F3F1EB;border:1px dashed #D0CFC9;border-radius:12px;margin-top:4px}',
    '.chat-media-failed{margin-top:6px;font-size:10px;font-weight:600;color:#B84C3A;background:none;border:none;padding:0;cursor:pointer;text-align:left;text-decoration:underline}',
    '.chat-link{color:var(--verde,#1D6A4A);text-decoration:underline;word-break:break-all}',
    '.chat-link:hover{color:var(--verde-l,#2D9E6B)}',
    /* â”€â”€ Bubble row: bolha + botÃµes de reaÃ§Ã£o lado a lado â”€â”€ */
    '.chat-msg-bubble-row{display:flex;align-items:flex-end;gap:4px;margin-left:22px}',
    '.chat-msg.own .chat-msg-bubble-row{flex-direction:row-reverse;margin-left:0;margin-right:22px}',
    '.chat-msg-bubble-row.has-rxn{margin-bottom:14px}',
    '.chat-msg-bubble-wrap{position:relative}',
    /* â”€â”€ BotÃµes de reaÃ§Ã£o: dois cÃ­rculos LADO A LADO (aparecem no hover) â”€â”€ */
    '.chat-msg-react-btns{display:flex;flex-direction:row;gap:2px;opacity:0;transition:opacity .15s;flex-shrink:0;align-items:center}',
    '.chat-msg:hover .chat-msg-react-btns{opacity:1}',
    '.chat-rbtn{width:20px;height:20px;border-radius:50%;background:#fff;border:1px solid var(--cinza2,#ECEAE4);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.1);transition:transform .1s,background .1s,border-color .1s;padding:0;flex-shrink:0;color:var(--cinza,#D0CFC9)}',
    '.chat-rbtn:hover{transform:scale(1.15)}',
    '.chat-rbtn.like.active{color:var(--verde,#1D6A4A);border-color:var(--verde,#1D6A4A);background:var(--verde-bg,#EAF5EE)}',
    '.chat-rbtn.heart.active{color:#B84C3A;border-color:#B84C3A;background:#FDF0EE}',
    /* â”€â”€ Badge de reaÃ§Ã£o na quina da bolha â”€â”€ */
    '.chat-msg-rxn-badge{position:absolute;bottom:-9px;right:-10px;background:#fff;border-radius:10px;padding:1px 5px;font-size:10px;box-shadow:0 1px 5px rgba(0,0,0,.15);border:1px solid var(--cinza2,#ECEAE4);display:flex;align-items:center;gap:2px;line-height:1.5;white-space:nowrap}',
    '.chat-msg.own .chat-msg-rxn-badge{right:auto;left:-10px}',
    '.chat-msg-rxn-count{font-size:8px;font-family:"DM Mono",monospace;color:var(--cinza,#D0CFC9);margin-left:1px}',
    /* â”€â”€ Status dot inline (presence) â”€â”€ */
    '.chat-presence-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;display:inline-block}',
    '.chat-presence-dot.online{background:#2D9E6B}.chat-presence-dot.foco{background:#1D4FA0}.chat-presence-dot.ausente{background:#C4831A}',
    '.chat-presence-dot.offline{background:var(--cinza,#D0CFC9)}',
    /* â”€â”€ Input â”€â”€ */
    '.chat-input-area{padding:8px 10px;border-top:1px solid var(--cinza2,#ECEAE4);display:flex;gap:7px;align-items:flex-end;background:#fff;flex-shrink:0}',
    '.chat-attach{width:33px;height:33px;background:var(--off,#F7F6F3);border:1px solid var(--cinza2,#ECEAE4);border-radius:9px;color:var(--grafite,#111110);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:border-color .15s,background .15s,transform .08s}',
    '.chat-attach:hover{background:#fff;border-color:var(--verde,#1D6A4A)}.chat-attach:active{transform:scale(.93)}',
    '.chat-input{flex:1;border:1px solid var(--cinza2,#ECEAE4);border-radius:9px;padding:7px 11px;font-family:"Raleway",sans-serif;font-size:12px;resize:none;outline:none;max-height:80px;min-height:33px;color:var(--preto,#111110);background:var(--off,#F7F6F3);line-height:1.45;transition:border-color .15s,background .15s;overflow-y:auto}',
    '.chat-input::placeholder{color:var(--cinza,#D0CFC9)}',
    '.chat-input:focus{border-color:var(--verde,#1D6A4A);background:#fff}',
    '.chat-send{width:33px;height:33px;background:var(--cinza2,#ECEAE4);border:none;border-radius:9px;color:var(--grafite,#111110);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s,transform .08s}',
    '.chat-send:hover{background:var(--cinza,#D0CFC9)}.chat-send:active{transform:scale(.93)}',
    '.chat-composer-status{padding:0 10px 8px;font-size:10px;color:#666;background:#fff}',
    '.chat-composer-status.ok{color:#1D6A4A}',
    '.chat-composer-status.warn{color:#B84C3A}',
    '.chat-media-viewer{position:fixed;inset:0;background:rgba(17,17,16,.58);display:none;align-items:center;justify-content:center;z-index:10020;padding:20px}',
    '.chat-media-viewer-card{width:min(780px, calc(100vw - 28px));max-height:calc(100vh - 36px);background:#fff;border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden}',
    '.chat-media-viewer-head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--cinza2,#ECEAE4)}',
    '.chat-media-viewer-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}',
    '.chat-media-viewer-title{min-width:0;font-family:"Raleway",sans-serif;font-size:13px;font-weight:700;color:var(--grafite,#111110);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-media-viewer-meta{font-family:"DM Mono",monospace;font-size:10px;color:#777;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.chat-media-viewer-tools{display:flex;align-items:center;gap:6px}',
    '.chat-media-viewer-zoombtn{width:28px;height:28px;border-radius:9px;border:1px solid rgba(17,17,16,.08);background:#fff;color:var(--grafite,#111110);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}',
    '.chat-media-viewer-zoombtn:hover{border-color:var(--verde,#1D6A4A);color:var(--verde,#1D6A4A)}',
    '.chat-media-viewer-zoomlabel{min-width:44px;text-align:center;font-family:"DM Mono",monospace;font-size:10px;color:#666}',
    '.chat-media-viewer-count{min-width:42px;text-align:center;font-family:"DM Mono",monospace;font-size:10px;color:#666}',
    '.chat-media-viewer-body{background:#F7F6F3;position:relative;display:flex;min-height:260px;overflow:hidden}',
    '.chat-media-viewer-stage{flex:1;display:flex;overflow:auto;padding:14px;min-height:calc(100vh - 180px)}',
    '.chat-mv-canvas{margin:auto;position:relative;line-height:0}',
    '.chat-mv-canvas.tool-active{cursor:crosshair}',
    '.chat-media-viewer-body img{max-width:100%;max-height:calc(100vh - 180px);border-radius:12px;display:block;box-shadow:0 12px 28px rgba(0,0,0,.12)}',
    '.chat-mv-toolbar{display:flex;flex-direction:column;gap:6px;padding:12px 8px;flex-shrink:0;align-self:flex-start}',
    '.chat-mv-tool{width:30px;height:30px;border-radius:9px;border:1px solid rgba(17,17,16,.08);background:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:border-color .12s,box-shadow .12s}',
    '.chat-mv-tool:hover{border-color:var(--verde,#1D6A4A)}',
    '.chat-mv-tool.active{border-color:var(--verde,#1D6A4A);box-shadow:0 0 0 2px rgba(29,106,74,.15)}',
    '.chat-mv-marks{position:absolute;inset:0;pointer-events:none}',
    '.chat-mv-mark{position:absolute;transform:translate(-50%,-50%);pointer-events:auto;display:flex;align-items:center;gap:3px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}',
    '.chat-mv-mark-ini{width:15px;height:15px;border-radius:50%;background:rgba(255,255,255,.72);color:rgba(17,17,16,.55);font-family:"DM Mono",monospace;font-size:7px;font-weight:700;display:flex;align-items:center;justify-content:center;letter-spacing:.2px;user-select:none}',
    '[data-theme="dark"] .chat-mv-tool{background:#2A2927;border-color:#3A3937}',
    '.chat-media-viewer-nav{position:absolute;top:50%;transform:translateY(-50%);width:38px;height:38px;border-radius:50%;border:1px solid rgba(17,17,16,.08);background:rgba(255,255,255,.94);color:var(--grafite,#111110);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;box-shadow:0 8px 20px rgba(0,0,0,.12)}',
    '.chat-media-viewer-nav:hover{border-color:var(--verde,#1D6A4A);color:var(--verde,#1D6A4A)}',
    '.chat-media-viewer-nav.prev{left:8px}',
    '.chat-media-viewer-nav.next{right:8px}',
    '.chat-media-viewer-nav[disabled]{opacity:.35;cursor:default;pointer-events:none}',
    '.chat-media-viewer-empty{font-size:11px;color:#777;text-align:center;padding:26px}',
    /* â”€â”€ Toast â”€â”€ */
    '.chat-new-msg-toast{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);background:var(--verde,#1D6A4A);color:#fff;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;cursor:pointer;white-space:nowrap;box-shadow:0 2px 10px rgba(29,106,74,.3);animation:chatToastIn .2s ease-out;z-index:10003}',
    '@keyframes chatToastIn{from{opacity:0;transform:translateX(-50%) translateY(6px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}',
    /* â”€â”€ Dark mode â”€â”€ */
    '[data-theme="dark"] .chat-panel{background:#1C1C1B;border-color:#2E2D2B}',
    '[data-theme="dark"] .chat-header{background:#252523;color:#F0EDE6}',
    '[data-theme="dark"] .chat-icon-btn{background:rgba(255,255,255,.08);color:#F0EDE6}',
    '[data-theme="dark"] .chat-icon-btn:hover{background:rgba(255,255,255,.14)}',
    '[data-theme="dark"] .chat-close{background:rgba(255,255,255,.08);color:#F0EDE6}',
    '[data-theme="dark"] .chat-close:hover{background:rgba(255,255,255,.14)}',
    '[data-theme="dark"] .chat-back-btn{background:rgba(255,255,255,.08);color:#F0EDE6}',
    '[data-theme="dark"] .chat-back-btn:hover{background:rgba(255,255,255,.14)}',
    '[data-theme="dark"] .chat-messages{background:#1C1C1B}',
    '[data-theme="dark"] .chat-msg:hover{background:rgba(255,255,255,.04)}',
    '[data-theme="dark"] .chat-msg-text.recv{background:#2A2927;color:#F0EDE6}',
    '[data-theme="dark"] .chat-msg-text.sent{background:#2E2D2B;color:#F0EDE6}',
    '[data-theme="dark"] .chat-media-thumb{background:#252523;border-color:#3A3836}',
    '[data-theme="dark"] .chat-media-thumb-pending{color:#C8C3BA;background:linear-gradient(135deg, rgba(29,106,74,.18), rgba(196,131,26,.16))}',
    '[data-theme="dark"] .chat-media-expired{background:#252523;border-color:#4A4742;color:#B4AEA4}',
    '[data-theme="dark"] .chat-media-failed{color:#E58C7D}',
    '[data-theme="dark"] .chat-msg-name{color:#F0EDE6}',
    '[data-theme="dark"] .chat-msg-rxn-badge{background:#2A2927;border-color:#2E2D2B}',
    '[data-theme="dark"] .chat-rbtn{background:#2A2927;border-color:#2E2D2B;color:#8C8A85}',
    '[data-theme="dark"] .chat-input-area{background:#1C1C1B;border-top-color:#2E2D2B}',
    '[data-theme="dark"] .chat-attach{background:#252523;border-color:#2E2D2B;color:#F0EDE6}',
    '[data-theme="dark"] .chat-attach:hover{background:#2A2927;border-color:var(--verde,#1D6A4A)}',
    '[data-theme="dark"] .chat-input{background:#252523;border-color:#2E2D2B;color:#F0EDE6}',
    '[data-theme="dark"] .chat-input:focus{border-color:var(--verde,#1D6A4A);background:#2A2927}',
    '[data-theme="dark"] .chat-send{background:#2E2D2B;color:#F0EDE6}',
    '[data-theme="dark"] .chat-send:hover{background:#3A3836}',
    '[data-theme="dark"] .chat-composer-status{background:#1C1C1B;color:#B4AEA4}',
    '[data-theme="dark"] .chat-composer-status.ok{color:#7DD4A3}',
    '[data-theme="dark"] .chat-composer-status.warn{color:#E58C7D}',
    '[data-theme="dark"] .chat-conv-list,.chat-member-list,[data-theme="dark"] .chat-conv-item,[data-theme="dark"] .chat-member-item{background:transparent}',
    '[data-theme="dark"] .chat-conv-item:hover,[data-theme="dark"] .chat-member-item:hover{background:rgba(255,255,255,.05)}',
    '[data-theme="dark"] .chat-conv-pin-btn{color:#6B6762}',
    '[data-theme="dark"] .chat-conv-pin-btn:hover,[data-theme="dark"] .chat-conv-pin-btn.is-pinned{color:#B7E2C8}',
    '[data-theme="dark"] .chat-conv-name{color:#F0EDE6}',
    '[data-theme="dark"] .chat-conv-preview{color:#8C8A85}',
    '[data-theme="dark"] .chat-conv-section{color:#8C8A85}',
    '[data-theme="dark"] .chat-conv-section-btn{color:#8C8A85}',
    '[data-theme="dark"] .chat-conv-section-btn:hover{color:#F0EDE6}',
    '[data-theme="dark"] .chat-search-wrap{background:#1C1C1B;border-bottom-color:#2E2D2B}',
    '[data-theme="dark"] .chat-search-input{background:#252523;border-color:#2E2D2B;color:#F0EDE6}',
    '[data-theme="dark"] .chat-search-input:focus{background:#2A2927}',
    '[data-theme="dark"] .chat-search-group{color:#8C8A85}',
    '[data-theme="dark"] .chat-search-item:hover{background:rgba(255,255,255,.05)}',
    '[data-theme="dark"] .chat-search-title{color:#F0EDE6}',
    '[data-theme="dark"] .chat-search-meta,.chat-search-snippet{color:#8C8A85}',
    '[data-theme="dark"] .chat-status-pop-hdr{color:#8C8A85}',
    '[data-theme="dark"] .chat-group-info{color:#8C8A85}',
    '[data-theme="dark"] .chat-group-bar{background:#1C1C1B;border-top-color:#2E2D2B}',
    '[data-theme="dark"] .chat-status-pop{background:#252523;border-color:#2E2D2B}',
    '[data-theme="dark"] .chat-sopt{color:#F0EDE6}',
    '[data-theme="dark"] .chat-sopt:hover{background:rgba(255,255,255,.07)}',
    '[data-theme="dark"] .chat-sopt.active{background:rgba(255,255,255,.12)}',
    '[data-theme="dark"] .chat-status-ind{background:rgba(30,30,28,.92)}',
    '[data-theme="dark"] .chat-alert-card{background:#252523;border-color:#2E2D2B}',
    '[data-theme="dark"] .chat-alert-title{color:#F0EDE6}',
    '[data-theme="dark"] .chat-alert-preview{color:#8C8A85}',
    '[data-theme="dark"] .chat-media-viewer-card{background:#1C1C1B}',
    '[data-theme="dark"] .chat-media-viewer-head{background:#252523}',
    '[data-theme="dark"] .chat-media-viewer-title{color:#F0EDE6}',
    '[data-theme="dark"] .chat-media-viewer-meta{color:#B4AEA4}',
    '[data-theme="dark"] .chat-media-viewer-zoombtn{background:#2A2927;border-color:#3A3937;color:#F0EDE6}',
    '[data-theme="dark"] .chat-media-viewer-zoombtn:hover{border-color:#B7E2C8;color:#B7E2C8}',
    '[data-theme="dark"] .chat-media-viewer-zoomlabel{color:#B4AEA4}',
    '[data-theme="dark"] .chat-media-viewer-count{color:#B4AEA4}',
    '[data-theme="dark"] .chat-media-viewer-body{background:#252523}',
    '[data-theme="dark"] .chat-media-viewer-nav{background:rgba(42,41,39,.94);border-color:#3A3937;color:#F0EDE6}',
    '[data-theme="dark"] .chat-media-viewer-nav:hover{border-color:#B7E2C8;color:#B7E2C8}',
    '[data-theme="dark"] .chat-media-viewer-empty{color:#B4AEA4}',
    /* â”€â”€ Popover de personalização (tema de cor) â”€â”€ */
    '.chat-color-pop{position:absolute;top:42px;right:10px;background:#fff;border:1px solid var(--cinza2,#ECEAE4);border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.16);padding:10px 11px;z-index:10006;display:none;flex-direction:column;gap:8px;min-width:150px}',
    '.chat-color-pop-hdr{font-size:9px;font-weight:700;letter-spacing:.65px;text-transform:uppercase;color:var(--cinza,#D0CFC9)}',
    '.chat-color-dots{display:flex;gap:9px}',
    '.chat-color-dot{width:26px;height:26px;border-radius:50%;cursor:pointer;border:2px solid transparent;display:flex;align-items:center;justify-content:center;transition:transform .1s;padding:0}',
    '.chat-color-dot:hover{transform:scale(1.12)}',
    '.chat-color-dot.active{border-color:var(--grafite,#111110)}',
    '.chat-color-dot.active::after{content:"";width:8px;height:8px;border-radius:50%;background:#fff}',
    '[data-theme="dark"] .chat-color-pop{background:#252523;border-color:#2E2D2B}',
    '[data-theme="dark"] .chat-color-pop-hdr{color:#8C8A85}',
    /* â”€â”€ Som: popover de volume â”€â”€ */
    '.chat-sound-pop{position:absolute;top:calc(100% + 6px);right:0;background:#fff;border:1px solid var(--cinza2,#ECEAE4);border-radius:11px;box-shadow:0 6px 24px rgba(0,0,0,.16);padding:5px;z-index:10006;display:none;flex-direction:column;gap:1px;min-width:176px}',
    '.chat-sopt-hdr{font-size:9px;font-weight:700;letter-spacing:.65px;text-transform:uppercase;color:var(--cinza,#D0CFC9);padding:5px 9px 6px}',
    '.chat-sopt{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:none;background:none;cursor:pointer;padding:7px 9px;border-radius:7px;font-family:inherit;font-size:12.5px;font-weight:500;color:var(--grafite,#111110);transition:background .1s}',
    '.chat-sopt:hover{background:var(--off,#F7F6F3)}',
    '.chat-sopt.active{background:var(--off,#F7F6F3);font-weight:700}',
    '.chat-sopt-vol{display:inline-flex;align-items:center;justify-content:center;width:16px;flex-shrink:0;color:#888}',
    '.chat-sopt.active .chat-sopt-vol{color:var(--chat-accent,#1D6A4A)}',
    '[data-theme="dark"] .chat-sound-pop{background:#252523;border-color:#2E2D2B}',
    '[data-theme="dark"] .chat-sopt{color:#C8C3BA}',
    '[data-theme="dark"] .chat-sopt:hover{background:rgba(255,255,255,.05)}',
    '[data-theme="dark"] .chat-sopt.active{background:rgba(255,255,255,.07);color:#F0EDE6}',
    '[data-theme="dark"] .chat-sopt-vol{color:#9A958C}',
    '[data-theme="dark"] .chat-color-dot.active{border-color:#F0EDE6}',
    /* â”€â”€ Header toggle ativo (filtro sinalizadas) â”€â”€ */
    '.chat-icon-btn.active{background:var(--chat-head-active-bg,var(--verde,#1D6A4A));color:var(--chat-head-active-fg,#fff)}',
    '.chat-icon-btn.active:hover{background:var(--chat-head-active-bg,var(--verde-l,#2D9E6B));opacity:.9}',
    '[data-theme="dark"] .chat-icon-btn.active{background:var(--verde,#1D6A4A);color:#fff}',
    /* â”€â”€ Botão de sinalizar mensagem (junto às reações) â”€â”€ */
    '.chat-rbtn.flag.active{color:var(--ouro,#C4831A);border-color:var(--ouro,#C4831A);background:#FBF3E3}',
    '[data-theme="dark"] .chat-rbtn.flag.active{background:rgba(196,131,26,.18)}',
    /* Indicador permanente na mensagem sinalizada */
    '.chat-msg.flagged .chat-msg-bubble-wrap::before{content:"";position:absolute;top:2px;left:-12px;width:3px;height:calc(100% - 4px);border-radius:2px;background:var(--ouro,#C4831A)}',
    '.chat-msg.flagged.own .chat-msg-bubble-wrap::before{left:auto;right:-12px}',
    /* â”€â”€ Busca dentro da conversa â”€â”€ */
    '.chat-insearch{display:none;align-items:center;gap:6px;padding:7px 10px;border-bottom:1px solid var(--cinza2,#ECEAE4);background:#fff;flex-shrink:0}',
    '.chat-insearch.open{display:flex}',
    '.chat-insearch-input{flex:1;border:1px solid var(--cinza2,#ECEAE4);border-radius:8px;padding:6px 9px;font-family:"Raleway",sans-serif;font-size:12px;background:var(--off,#F7F6F3);color:var(--preto,#111110);outline:none}',
    '.chat-insearch-input:focus{border-color:var(--verde,#1D6A4A);background:#fff}',
    '.chat-insearch-count{font-family:"DM Mono",monospace;font-size:10px;color:var(--cinza,#D0CFC9);min-width:34px;text-align:center}',
    '.chat-insearch-nav{width:24px;height:24px;border-radius:6px;border:none;background:rgba(0,0,0,.06);color:var(--grafite,#111110);cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .12s}',
    '.chat-insearch-nav:hover{background:rgba(0,0,0,.12)}',
    '.chat-insearch-nav:disabled{opacity:.35;cursor:default}',
    '.chat-msg.in-hit .chat-msg-text{box-shadow:0 0 0 1.5px var(--ouro,#C4831A) inset}',
    '.chat-msg.in-current .chat-msg-text{box-shadow:0 0 0 2px var(--verde,#1D6A4A) inset;background:var(--verde-bg,#EAF5EE)!important}',
    '[data-theme="dark"] .chat-insearch{background:#1C1C1B;border-bottom-color:#2E2D2B}',
    '[data-theme="dark"] .chat-insearch-input{background:#252523;border-color:#2E2D2B;color:#F0EDE6}',
    '[data-theme="dark"] .chat-insearch-input:focus{background:#2A2927}',
    '[data-theme="dark"] .chat-insearch-nav{background:rgba(255,255,255,.08);color:#F0EDE6}',
    '[data-theme="dark"] .chat-insearch-nav:hover{background:rgba(255,255,255,.14)}'
  ].join('\n');

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     ESTADO
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  var sb, user;
  var presenceCh = null, msgCh = null;
  var messages      = [];
  var isOpen        = false;
  var isLoading     = false;
  var scrolledToEnd = true;
  var statusPopOpen = false;
  var currentView    = 'home';      // 'home' | 'channel' | 'members'
  var currentChannel = 'general';
  var currentLabel   = '# geral';
  var loadRequestSeq = 0;
  var teamMembers      = [];
  var allMembers       = [];        // todos os usuÃ¡rios incluindo o prÃ³prio â€” para lookup de avatares
  var projectThreads   = [];
  var projectThreadMeta = {};
  var recentConversationAlerts = [];
  var projectSectionCollapsed = true;
  var pendingMessageSeq = 0;
  var reactionLocks = {};
  var editingMessageId = null;
  var editingDraft = '';
  var chatMediaConfig = null;
  var mediaViewerState = null;
  var mediaObjectUrl = null;
  var messageMediaMap = {};
  var failedStoragePaths = {};
  var mediaRequestSeq = 0;
  var mediaUploadBusy = false;
  var composerStatusTimer = null;
  var searchQuery = '';
  var selectedMembers  = [];        // membros selecionados no seletor de grupo
  var channelUnread    = {};        // { channel: count }
  var onlinePresence   = {};        // { auth_id: { status, nome, ... } }
  var userStatus     = localStorage.getItem(STATUS_KEY) || 'online';
  var soundLevel     = _loadSoundLevel();
  var soundEnabled   = soundLevel !== 'off';
  function _loadSoundLevel() {
    var lv = localStorage.getItem(SOUND_LEVEL_KEY);
    if (lv === 'off' || lv === 'low' || lv === 'med' || lv === 'high') return lv;
    return localStorage.getItem(SOUND_KEY) === 'false' ? 'off' : 'med';
  }
  var pinnedChannels = (function () {
    try { return new Set(JSON.parse(localStorage.getItem(PINNED_KEY) || '[]')); } catch (e) { return new Set(); }
  }());
  /* â”€â”€ Personalização visual â”€â”€ */
  var chatColor    = localStorage.getItem(COLOR_KEY) || 'verde';
  var colorPopOpen = false;
  var soundPopOpen = false;
  /* â”€â”€ Mensagens sinalizadas (salvas) â”€â”€ */
  var flaggedMessages = (function () {
    try { return JSON.parse(localStorage.getItem(FLAGS_KEY) || '[]'); } catch (e) { return []; }
  }());
  var showOnlyFlagged = false;
  /* â”€â”€ Busca dentro da conversa â”€â”€ */
  var inSearchOpen    = false;
  var inSearchQuery   = '';
  var inSearchResults = [];   // ids de mensagens que casam
  var inSearchCurrent = 0;
  var _realtimeDropped = false;

  /* â”€â”€ DOM refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var $panel, $msgs, $input, $badge, $toggle;
  var $viewHome, $viewChan, $viewMembers, $viewSearch;
  var $chanTitle, $personBtn, $statusInd, $statusPop;

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     INIT
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function init() {
    var raw = sessionStorage.getItem('exp_usuario');
    if (!raw) {
      window.addEventListener('exp:session-ready', onSessionReady, { once: true });
      return;
    }
    try { user = JSON.parse(raw); } catch (e) { return; }
    if (!user || !user.nome) return;
    if (!user.app_user_id && typeof user.id !== 'undefined') user.app_user_id = user.id;
    if (!user.apelido) user.apelido = (user.nome || '').split(' ')[0] || '';

    sb = (typeof window.sb !== 'undefined' && window.sb)
      ? window.sb
      : supabase.createClient(SB_URL, SB_KEY);

    sb.auth.getSession().then(function (r) {
      if (!r.data || !r.data.session) return;
      user.auth_id = r.data.session.user.id;
      mountWidget();
    });
  }

  function onSessionReady(ev) {
    if (ev && ev.detail) {
      user = ev.detail;
      if (!user.apelido) user.apelido = (user.nome || '').split(' ')[0] || '';
    }
    init();
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     MOUNT
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function mountWidget() {
    if (document.getElementById('exp-chat-widget')) return;
    injectCSS();
    injectHTML();
    cacheRefs();
    applyChatColor(chatColor, false);
    applyStatus(userStatus, false);
    _renderSoundBtn();
    setupPresence();
    fetchAllUnread();
    subscribeIncoming();
    startPolling();
    loadTeamMembers();

    window.addEventListener('beforeunload', function () {
      if (presenceCh) presenceCh.untrack();
    });

    /* Reconecta o realtime ao voltar para a aba SOMENTE se o canal não estiver ativo */
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState !== 'visible') return;
      var state = msgCh && msgCh.state;
      if (state !== 'joined' && state !== 'joining') subscribeIncoming();
    });

    // Fechar popover de cor ao clicar fora
    document.addEventListener('click', function (e) {
      if (!colorPopOpen) return;
      var pop = document.getElementById('exp-chat-color-pop');
      var btn = document.getElementById('exp-chat-color-btn');
      if (pop && pop.contains(e.target)) return;
      if (btn && btn.contains(e.target)) return;
      closeColorPop();
    });

    // Fechar popover de som ao clicar fora
    document.addEventListener('click', function (e) {
      if (!soundPopOpen) return;
      var wrap = document.getElementById('exp-chat-sound-wrap');
      if (wrap && wrap.contains(e.target)) return;
      closeSoundPop();
    });

    // Fechar popover ao clicar fora
    document.addEventListener('click', function (e) {
      if (!statusPopOpen) return;
      var pop    = document.getElementById('exp-chat-status-pop');
      var ind    = document.getElementById('exp-chat-status-ind');
      var person = document.getElementById('exp-chat-person-btn');
      if (!pop) return;
      if (pop.contains(e.target)) return;
      if (ind && ind.contains(e.target)) return;
      if (person && person.contains(e.target)) return;
      closeStatusPop();
    });

    document.addEventListener('paste', function (event) {
      if (!isOpen || currentView !== 'channel' || mediaUploadBusy) return;
      var imageItems = Array.from((event.clipboardData && event.clipboardData.items) || []).filter(function (item) {
        return /^image\/(png|jpeg|webp)$/i.test(item.type || '');
      });
      if (!imageItems.length) return;
      event.preventDefault();
      imageItems.reduce(function (chain, item) {
        return chain.then(function () {
          var file = item.getAsFile();
          if (!file) return null;
          return sendMediaFile(file);
        });
      }, Promise.resolve());
    });

    /* Clique no print com ferramenta de marcador ativa */
    var _mvCanvas = document.getElementById('exp-chat-mv-canvas');
    if (_mvCanvas) _mvCanvas.addEventListener('click', mvCanvasClick);

    document.addEventListener('click', function (e) {
      var viewer = document.getElementById('exp-chat-media-viewer');
      var card = viewer ? viewer.querySelector('.chat-media-viewer-card') : null;
      if (!viewer || viewer.style.display !== 'flex') return;
      if (e.target && e.target.closest && e.target.closest('.chat-media-thumb')) return;
      if (card && card.contains(e.target)) return;
      closeMediaViewer();
    });

    document.addEventListener('keydown', function (event) {
      if (!mediaViewerState) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        closeMediaViewer();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        prevMediaViewer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextMediaViewer();
      }
    });
  }

  function cacheRefs() {
    $panel      = document.getElementById('exp-chat-panel');
    $msgs       = document.getElementById('exp-chat-msgs');
    $input      = document.getElementById('exp-chat-input');
    $badge      = document.getElementById('exp-chat-badge');
    $toggle     = document.getElementById('exp-chat-toggle');
    $viewHome   = document.getElementById('exp-chat-home');
    $viewChan   = document.getElementById('exp-chat-chan');
    $viewMembers= document.getElementById('exp-chat-members');
    $viewSearch = document.getElementById('exp-chat-search');
    $chanTitle  = document.getElementById('exp-chat-chan-title');
    $personBtn  = document.getElementById('exp-chat-person-btn');
    $statusInd  = document.getElementById('exp-chat-status-ind');
    $statusPop  = document.getElementById('exp-chat-status-pop');

    if ($msgs) {
      $msgs.addEventListener('scroll', function () {
        scrolledToEnd = $msgs.scrollHeight - $msgs.scrollTop - $msgs.clientHeight < 40;
      });
    }
  }

  /* â”€â”€ CSS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function injectCSS() {
    if (document.getElementById('exp-chat-css')) return;
    var s = document.createElement('style');
    s.id = 'exp-chat-css';
    s.textContent = CSS_TEXT;
    document.head.appendChild(s);
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     HTML
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function injectHTML() {
    var wrap = document.createElement('div');
    wrap.id = 'exp-chat-widget';
    wrap.innerHTML = buildHTML();
    document.body.appendChild(wrap);
  }

  function buildHTML() {
    var fn = firstName(user.nome);
    return (
      '<div class="chat-alert-stack" id="exp-chat-alerts" style="display:none"></div>' +
      /* â”€â”€ Painel â”€â”€ */
      '<div class="chat-panel" id="exp-chat-panel" style="display:none">' +

        /* View: Home (lista de conversas) */
        '<div class="chat-view" id="exp-chat-home">' +
          '<div class="chat-header">' +
            '<div class="chat-header-info"><div class="chat-header-title" onclick="window.location.href=\'chat-fullpage.html\'" style="cursor:pointer;user-select:none" title="Abrir chat em tela cheia">EXP.chat ↗</div></div>' +
            '<div class="chat-header-acts">' +
              '<button class="chat-icon-btn" id="exp-chat-color-btn" onclick="expChat.toggleColorPop(event)" title="Personalizar cor">' + icoPalette() + '</button>' +
              '<span id="exp-chat-sound-wrap" style="position:relative;display:inline-flex">' +
                '<button class="chat-icon-btn" id="exp-chat-sound-btn" onclick="expChat.toggleSoundPop(event)" title="Som das notificações">' + (soundEnabled ? icoSound() : icoSoundOff()) + '</button>' +
                '<div class="chat-sound-pop" id="exp-chat-sound-pop">' +
                  '<div class="chat-sopt-hdr">Som das notificações</div>' +
                  soundOpt('off',  'Desligado',    icoVolOff()) +
                  soundOpt('low',  'Volume baixo', icoVolLow()) +
                  soundOpt('med',  'Volume médio', icoVolMed()) +
                  soundOpt('high', 'Volume alto',  icoVolHigh()) +
                '</div>' +
              '</span>' +
              '<button class="chat-icon-btn" onclick="expChat.openSearch()" title="Pesquisar">' + icoSearch() + '</button>' +
              '<button class="chat-icon-btn" onclick="expChat.startDM()" title="Nova mensagem">' + icoPencil() + '</button>' +
              '<button class="chat-close" onclick="expChat.close()">' + icoClose() + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="chat-color-pop" id="exp-chat-color-pop">' +
            '<div class="chat-color-pop-hdr">Tema de cor</div>' +
            '<div class="chat-color-dots">' +
              colorDot('verde',     '#1D6A4A') +
              colorDot('azul',      '#1D4FA0') +
              colorDot('ouro',      '#C4831A') +
              colorDot('terracota', '#B84C3A') +
            '</div>' +
          '</div>' +
          '<div class="chat-conv-list" id="exp-chat-convlist"><div class="chat-loading">' + ldots() + '</div></div>' +
        '</div>' +

        '<div class="chat-view" id="exp-chat-search" style="display:none">' +
          '<div class="chat-header">' +
            '<button class="chat-back-btn" onclick="expChat.goHome()">' + icoBack() + '</button>' +
            '<div class="chat-header-info"><div class="chat-header-title">Pesquisar</div></div>' +
              '<button class="chat-close" onclick="expChat.close()">' + icoClose() + '</button>' +
          '</div>' +
          '<div class="chat-search-wrap">' +
            '<input class="chat-search-input" id="exp-chat-search-input" type="text" placeholder="Buscar conversas e mensagens" oninput="expChat.searchInput(this.value)">' +
          '</div>' +
          '<div class="chat-search-results" id="exp-chat-search-results"><div class="chat-empty">Pesquise por nome de conversa ou texto de mensagem.</div></div>' +
        '</div>' +

        /* View: Channel / DM */
        '<div class="chat-view" id="exp-chat-chan" style="display:none">' +
          '<div class="chat-header">' +
            '<button class="chat-back-btn" onclick="expChat.goHome()">' + icoBack() + '</button>' +
            '<div class="chat-header-info"><div class="chat-header-title" id="exp-chat-chan-title"># geral</div><div class="chat-header-sub" id="exp-chat-chan-sub" style="display:none"></div></div>' +
            '<div class="chat-header-acts">' +
              '<button class="chat-icon-btn" id="exp-chat-insearch-btn" onclick="expChat.openInSearch()" title="Buscar na conversa">' + icoSearch() + '</button>' +
              '<button class="chat-icon-btn" id="exp-chat-flagfilter-btn" onclick="expChat.toggleFlaggedFilter()" title="Mostrar só sinalizadas">' + icoFlag() + '</button>' +
              '<button class="chat-close" onclick="expChat.close()">' + icoClose() + '</button>' +
            '</div>' +
          '</div>' +
          '<div class="chat-insearch" id="exp-chat-insearch">' +
            '<input class="chat-insearch-input" id="exp-chat-insearch-input" type="text" placeholder="Buscar nesta conversa" oninput="expChat.inSearchInput(this.value)" onkeydown="expChat.inSearchKey(event)">' +
            '<span class="chat-insearch-count" id="exp-chat-insearch-count">0/0</span>' +
            '<button class="chat-insearch-nav" id="exp-chat-insearch-prev" onclick="expChat.inSearchPrev()" title="Anterior">' + icoChevUp() + '</button>' +
            '<button class="chat-insearch-nav" id="exp-chat-insearch-next" onclick="expChat.inSearchNext()" title="Próxima">' + icoChevDown() + '</button>' +
            '<button class="chat-insearch-nav" onclick="expChat.closeInSearch()" title="Fechar">' + icoClose() + '</button>' +
          '</div>' +
          '<div class="chat-messages" id="exp-chat-msgs"><div class="chat-loading">' + ldots() + '</div></div>' +
          '<div class="chat-input-area">' +
            '<input id="exp-chat-media-input" type="file" accept="image/png,image/jpeg,image/webp" style="display:none" onchange="expChat.handleMediaInput(this)">' +
            '<button class="chat-attach" onclick="expChat.pickMedia()" title="Anexar print">' + icoAttach() + '</button>' +
            '<textarea class="chat-input" id="exp-chat-input" placeholder="Mensagem..." rows="1"' +
              ' onkeydown="expChat.handleKey(event)" oninput="expChat.autoResize(this)"></textarea>' +
            '<button class="chat-send" onclick="expChat.send()" title="Enviar (Enter)">' + icoSend() + '</button>' +
          '</div>' +
          '<div class="chat-composer-status" id="exp-chat-composer-status" style="display:none"></div>' +
        '</div>' +

        /* View: Seletor de membro (novo DM) */
        '<div class="chat-view" id="exp-chat-members" style="display:none">' +
          '<div class="chat-header">' +
            '<button class="chat-back-btn" onclick="expChat.goHome()">' + icoBack() + '</button>' +
            '<div class="chat-header-info"><div class="chat-header-title">Nova mensagem</div></div>' +
            '<button class="chat-close" onclick="expChat.close()">' + icoClose() + '</button>' +
          '</div>' +
          '<div class="chat-member-list" id="exp-chat-memberlist"><div class="chat-loading">' + ldots() + '</div></div>' +
          '<div class="chat-group-bar" id="exp-chat-group-bar" style="display:none">' +
            '<span class="chat-group-info" id="exp-chat-group-info"></span>' +
            '<button class="chat-group-confirm" onclick="expChat.confirmGroup()">Abrir â†’</button>' +
          '</div>' +
        '</div>' +

      '</div>' + /* fim .chat-panel */

      '<div class="chat-media-viewer" id="exp-chat-media-viewer" style="display:none">' +
        '<div class="chat-media-viewer-card">' +
          '<div class="chat-media-viewer-head">' +
            '<div class="chat-media-viewer-copy">' +
              '<div class="chat-media-viewer-title" id="exp-chat-media-viewer-title">Print do chat</div>' +
              '<div class="chat-media-viewer-meta" id="exp-chat-media-viewer-meta">Autor · data · hora</div>' +
            '</div>' +
            '<div class="chat-media-viewer-tools">' +
              '<span class="chat-media-viewer-count" id="exp-chat-media-viewer-count">1/1</span>' +
              '<button class="chat-media-viewer-zoombtn" onclick="expChat.zoomOutMediaViewer()" title="Diminuir zoom">-</button>' +
              '<button class="chat-media-viewer-zoombtn" onclick="expChat.resetMediaViewerZoom()" title="Redefinir zoom"><span id="exp-chat-media-viewer-zoom-label">100%</span></button>' +
              '<button class="chat-media-viewer-zoombtn" onclick="expChat.zoomInMediaViewer()" title="Aumentar zoom">+</button>' +
            '</div>' +
            '<button class="chat-close" onclick="expChat.closeMediaViewer()">' + icoClose() + '</button>' +
          '</div>' +
          '<div class="chat-media-viewer-body">' +
            '<div class="chat-mv-toolbar">' +
              '<button class="chat-mv-tool" id="exp-chat-mv-tool-seta" onclick="expChat.mvSelectTool(\'seta\')" title="Seta azul">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D4FA0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>' +
              '</button>' +
              '<button class="chat-mv-tool" id="exp-chat-mv-tool-seta_verde" onclick="expChat.mvSelectTool(\'seta_verde\')" title="Seta verde">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D6A4A" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>' +
              '</button>' +
              '<button class="chat-mv-tool" id="exp-chat-mv-tool-alerta" onclick="expChat.mvSelectTool(\'alerta\')" title="Alerta">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C4831A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
              '</button>' +
              '<button class="chat-mv-tool" id="exp-chat-mv-tool-x" onclick="expChat.mvSelectTool(\'x\')" title="Marcar com X">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#B84C3A" stroke-width="2.6" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>' +
              '</button>' +
              '<button class="chat-mv-tool" id="exp-chat-mv-tool-circulo" onclick="expChat.mvSelectTool(\'circulo\')" title="Círculo azul">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D4FA0" stroke-width="2.4"><circle cx="12" cy="12" r="8"/></svg>' +
              '</button>' +
              '<button class="chat-mv-tool" id="exp-chat-mv-tool-circulo_verde" onclick="expChat.mvSelectTool(\'circulo_verde\')" title="Círculo verde">' +
                '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1D6A4A" stroke-width="2.4"><circle cx="12" cy="12" r="8"/></svg>' +
              '</button>' +
            '</div>' +
            '<div class="chat-media-viewer-stage">' +
              '<button class="chat-media-viewer-nav prev" id="exp-chat-media-viewer-prev" onclick="expChat.prevMediaViewer()" title="Imagem anterior">&#8249;</button>' +
              '<div class="chat-mv-canvas" id="exp-chat-mv-canvas" style="display:none">' +
                '<img id="exp-chat-media-viewer-img" alt="Print do chat">' +
                '<div class="chat-mv-marks" id="exp-chat-mv-marks"></div>' +
              '</div>' +
              '<div class="chat-media-viewer-empty" id="exp-chat-media-viewer-empty">Carregando imagem…</div>' +
              '<button class="chat-media-viewer-nav next" id="exp-chat-media-viewer-next" onclick="expChat.nextMediaViewer()" title="Próxima imagem">&#8250;</button>' +
            '</div>' +
          '</div>' +
      '</div>' +
      '</div>' +

      /* â”€â”€ Status popover â”€â”€ */
      '<div class="chat-status-pop" id="exp-chat-status-pop" style="display:none">' +
        '<div class="chat-status-pop-hdr">' + escHtml(fn) + '</div>' +
        sopt('online',  'Online') +
        sopt('foco',    'Foco') +
        sopt('ausente', 'Ausente') +
      '</div>' +

      /* â”€â”€ Controls (person btn + status ind + toggle) â”€â”€ */
      '<div class="chat-controls">' +
        '<button class="chat-person-btn" id="exp-chat-person-btn" onclick="expChat.toggleStatusPop()" title="Meu status" style="display:none">' +
          icoPerson() +
        '</button>' +
        '<div class="chat-status-ind" id="exp-chat-status-ind" onclick="expChat.toggleStatusPop()" title="Status">' +
          '<div class="chat-status-ind-dot" id="exp-chat-ind-dot"></div>' +
          icoChevron() +
        '</div>' +
        '<div class="chat-toggle" id="exp-chat-toggle" onclick="expChat.toggle()">' +
          softAvHtml(
            user.iniciais || (user.nome || '').substring(0,2).toUpperCase(),
            user.cor || '#1D6A4A',
            user.avatar_url || null,
            'width:100%;height:100%;border-radius:50%;font-size:15px;font-weight:700;letter-spacing:0'
          ) +
          '<div class="chat-badge" id="exp-chat-badge"></div>' +
        '</div>' +
      '</div>'
    );
  }

  /* â”€â”€ Helpers de markup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var SOPT_COLORS = { online:'#2D9E6B', foco:'#1D4FA0', ausente:'#C4831A' };
  function sopt(val, label) {
    return '<button class="chat-sopt" data-status="' + val + '" onclick="expChat.setStatus(\'' + val + '\')">' +
      '<span class="chat-sopt-dot" style="background:' + SOPT_COLORS[val] + '"></span>' +
      '<span>' + label + '</span></button>';
  }
  function ldots() {
    return '<div class="chat-loading-dot"></div><div class="chat-loading-dot"></div><div class="chat-loading-dot"></div>';
  }

  /* â”€â”€ SVG icons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function icoChat()    { return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'; }
  function icoSend()    { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'; }
  function icoBack()    { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'; }
  function icoClose()   { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>'; }
  function icoSearch()  { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="16.65" y2="16.65"/></svg>'; }
  function icoAttach()  { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-8.49 8.49a5.5 5.5 0 0 1-7.78-7.78l8.49-8.49a3.5 3.5 0 0 1 4.95 4.95l-8.5 8.49a1.5 1.5 0 0 1-2.12-2.12l7.78-7.78"/></svg>'; }
  function icoPerson()  { return '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'; }
  function icoChevron() { return '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'; }
  function icoPencil()  { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'; }
  function icoSound()   { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'; }
  function icoSoundOff(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'; }
  function icoVolOff() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'; }
  function icoVolLow() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'; }
  function icoVolMed() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M18.07 5.93a9 9 0 0 1 0 12.14"/></svg>'; }
  function icoVolHigh(){ return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'; }
  function soundOpt(level, label, ico) {
    return '<button class="chat-sopt" data-level="' + level + '" onclick="expChat.setSoundLevel(\'' + level + '\')">' +
      '<span class="chat-sopt-vol">' + ico + '</span>' + label + '</button>';
  }
  function icoLike()    { return '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>'; }
  function icoHeart()   { return '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>'; }
  function icoEmpty()   { return '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'; }
  function icoPalette() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r="1.3" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6 2 11c0 4.4 3.6 8 8 8 .9 0 1.5-.7 1.5-1.5 0-.4-.2-.8-.4-1-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H14c3.3 0 6-2.7 6-6 0-3.9-3.6-6.5-8-6.5z"/></svg>'; }
  function icoFlag()    { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>'; }
  function icoPencil()  { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>'; }
  function icoChevUp()  { return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>'; }
  function icoChevDown(){ return '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'; }
  function colorDot(key, hex) {
    return '<button class="chat-color-dot' + (chatColor === key ? ' active' : '') + '" data-color="' + key + '" ' +
      'style="background:' + hex + '" onclick="expChat.setChatColor(\'' + key + '\')" title="' + key + '"></button>';
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     STATUS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function applyStatus(status, broadcast) {
    if (typeof broadcast === 'undefined') broadcast = true;
    userStatus = status;
    localStorage.setItem(STATUS_KEY, status);

    var color = STATUS_COLORS[status] || STATUS_COLORS.online;

    /* FAB: cor de status sÃ³ quando nÃ£o hÃ¡ foto (foto preenche o cÃ­rculo) */
    if ($toggle && !user.avatar_url) {
      $toggle.style.background = color;
    }
    /* Dot no indicador de status */
    var dot = document.getElementById('exp-chat-ind-dot');
    if (dot) dot.className = 'chat-status-ind-dot ' + status;

    /* Person button: cor da borda */
    if ($personBtn) {
      $personBtn.style.borderColor = color;
      $personBtn.style.color       = color;
    }

    /* Popover: marcar opÃ§Ã£o ativa */
    if ($statusPop) {
      var opts = $statusPop.querySelectorAll('.chat-sopt');
      for (var i = 0; i < opts.length; i++) {
        opts[i].classList.toggle('active', opts[i].getAttribute('data-status') === status);
      }
    }

    if (broadcast && presenceCh) presenceCh.track(presencePayload(status));
  }

  function toggleStatusPop() { statusPopOpen ? closeStatusPop() : openStatusPop(); }

  function openStatusPop() {
    if (!$statusPop) return;
    statusPopOpen = true;
    $statusPop.style.display = 'flex';
    var opts = $statusPop.querySelectorAll('.chat-sopt');
    for (var i = 0; i < opts.length; i++) {
      opts[i].classList.toggle('active', opts[i].getAttribute('data-status') === userStatus);
    }
  }

  function closeStatusPop() {
    if (!$statusPop) return;
    statusPopOpen = false;
    $statusPop.style.display = 'none';
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     ABRIR / FECHAR
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function toggle() { isOpen ? close() : open(); }

  function open() {
    if (!$panel) return;
    isOpen = true;
    $panel.style.display    = 'flex';
    if ($personBtn) $personBtn.style.display = 'flex';
    if ($statusInd) $statusInd.style.display = 'none';
    closeStatusPop();
    showView('home');
    renderConversationAlerts();
  }

  function close() {
    if (!$panel) return;
    isOpen = false;
    $panel.style.display    = 'none';
    if ($personBtn) $personBtn.style.display = 'none';
    if ($statusInd) $statusInd.style.display = 'flex';
    closeStatusPop();
    renderConversationAlerts();
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     VIEWS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function showView(view) {
    currentView = view;
    if (view !== 'home') closeColorPop();
    var map = { home: $viewHome, channel: $viewChan, members: $viewMembers, search: $viewSearch };
    Object.keys(map).forEach(function (k) {
      if (map[k]) map[k].style.display = k === view ? 'flex' : 'none';
    });
    if (view === 'home')    renderHome();
    if (view === 'members') renderMemberList();
    if (view === 'search')  renderSearchView();
    renderConversationAlerts();
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     HOME â€” lista de conversas
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function renderHome() {
    var $list = document.getElementById('exp-chat-convlist');
    if (!$list) return;

    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    Promise.all([
      sb.from('chat_messages')
        .select('channel,sender_name,sender_iniciais,sender_cor,content,created_at,sender_id')
        .gte('created_at', since)
        .order('created_at', { ascending: false }),
      fetchProjectHomeItems(uid)
    ]).then(function (res) {
      var r = res[0];
      var projectItems = res[1] || [];
      var msgs = r.data || [];

      /* Agrupar por canal dinÃ¢mico, manter a mensagem mais recente */
      var seen = {};
      var dmList = [];
      msgs.forEach(function (m) {
        if (!isDynamicChannel(m.channel) || !channelHasUser(m.channel, uid)) return;
        if (!seen[m.channel]) { seen[m.channel] = true; dmList.push(m); }
      });

      var html = '';
      var projectHtml = '';

      function buildProjectHomeRow(item) {
        var unread = channelUnread[item.channel] || item.unread || 0;
        var chanArg = attrJsStr(item.channel);
        var labelEsc = escHtml(item.label);
        var labelArg = attrJsStr(item.label);
        var preview = escHtml(compactPreviewText(item.preview || 'Chat do projeto', 42, 'Chat do projeto'));
        return '<div class="chat-conv-item" onclick="expChat.openChannel(\'' + chanArg + '\',\'' + labelArg + '\')">' +
          softAvHtml(item.iniciais, item.cor, null, 'width:28px;height:28px;font-size:10px;flex-shrink:0') +
          '<div class="chat-conv-info">' +
            '<div class="chat-conv-name">' + labelEsc + '</div>' +
            '<div class="chat-conv-preview">' + preview + '</div>' +
          '</div>' +
          (unread > 0 ? '<div class="chat-conv-badge">' + unread + '</div>' : '') +
          '</div>';
      }

      /* Linha #geral */
      var genU = channelUnread['general'] || 0;
      html += '<div class="chat-conv-item" onclick="expChat.openChannel(\'general\',\'# geral\')">' +
        '<div class="chat-conv-av-hash">#</div>' +
        '<div class="chat-conv-info"><div class="chat-conv-name">geral</div><div class="chat-conv-preview">Toda a equipe</div></div>' +
        (genU > 0 ? '<div class="chat-conv-badge">' + genU + '</div>' : '') +
        '</div>';

      /* Linha #sócios (apenas para role socio) */
      if (isSocioLikeRole(user.role)) {
        var socU = channelUnread['socios'] || 0;
        html += '<div class="chat-conv-item" onclick="expChat.openChannel(\'socios\',\'# s\u00F3cios\')">' +
          '<div class="chat-conv-av-hash" style="background:var(--am-bg,#FBF3E8);color:var(--am,#C4831A)">#</div>' +
          '<div class="chat-conv-info"><div class="chat-conv-name">s\u00F3cios</div><div class="chat-conv-preview">Canal privado</div></div>' +
          (socU > 0 ? '<div class="chat-conv-badge">' + socU + '</div>' : '') +
          '</div>';
      }

      var sortedProjectItems = (projectItems || []).slice().sort(function (a, b) {
        var unreadDiff = (b.unread || 0) - (a.unread || 0);
        if (unreadDiff) return unreadDiff;
        return new Date(b.lastCreatedAt || 0) - new Date(a.lastCreatedAt || 0);
      });
      var highlightedProjectItems = projectSectionCollapsed
        ? sortedProjectItems.filter(function (item) { return (channelUnread[item.channel] || item.unread || 0) > 0; }).slice(0, 3)
        : [];

      if (sortedProjectItems.length) {
        projectHtml += '<button class="chat-conv-section-btn" onclick="expChat.toggleProjectSection()">' +
          '<span>Projetos</span>' +
          '<span class="chat-conv-section-chev">' + (projectSectionCollapsed ? '&#9656;' : '&#9662;') + '</span>' +
          '</button>';
      }
      if (!projectSectionCollapsed) sortedProjectItems.forEach(function (item) {
        projectHtml += buildProjectHomeRow(item);
      });

      /* Linhas de DMs e grupos — fixadas primeiro */
      var pinnedDms = dmList.filter(function (dm) { return pinnedChannels.has(dm.channel); });
      var regularDms = dmList.filter(function (dm) { return !pinnedChannels.has(dm.channel); });

      function buildDmRow(dm) {
        var meta     = getConversationMeta(dm, uid);
        var preview  = compactPreviewText(dm.content, 34, 'Nova mensagem');
        var dmU      = channelUnread[dm.channel] || 0;
        var chanArg  = attrJsStr(dm.channel);
        var nameEsc  = escHtml(meta.label);
        var nameArg  = attrJsStr(meta.label);
        var isPinned = pinnedChannels.has(dm.channel);
        var pinBtn   = '<button class="chat-conv-pin-btn' + (isPinned ? ' is-pinned' : '') + '" ' +
          'title="' + (isPinned ? 'Desafixar' : 'Fixar conversa') + '" ' +
          'onclick="event.stopPropagation();expChat.togglePin(\'' + chanArg + '\')">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="' + (isPinned ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
          '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-2a6 6 0 0 0-3-5.2V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5.8A6 6 0 0 0 5 15v2z"/></svg>' +
          '</button>';
        return '<div class="chat-conv-item" onclick="expChat.openChannel(\'' + chanArg + '\',\'' + nameArg + '\')">' +
          softAvHtml(meta.iniciais, meta.cor, meta.avatarUrl, 'width:28px;height:28px;font-size:10px;flex-shrink:0') +
          '<div class="chat-conv-info">' +
            '<div class="chat-conv-name">' + nameEsc + '</div>' +
            '<div class="chat-conv-preview">' + escHtml(preview) + '</div>' +
          '</div>' +
          (dmU > 0 ? '<div class="chat-conv-badge">' + dmU + '</div>' : '') +
          pinBtn +
          '</div>';
      }

      pinnedDms.forEach(function (dm) { html += buildDmRow(dm); });
      regularDms.forEach(function (dm) { html += buildDmRow(dm); });

      highlightedProjectItems.forEach(function (item) {
        html += buildProjectHomeRow(item);
      });

      html += projectHtml;
      $list.innerHTML = html;
    });
  }

  function toggleProjectSection() {
    projectSectionCollapsed = !projectSectionCollapsed;
    if (isOpen && currentView === 'home') renderHome();
  }

  function openSearch() {
    showView('search');
    setTimeout(function () {
      var inp = document.getElementById('exp-chat-search-input');
      if (inp) inp.focus();
    }, 60);
  }

  function searchInput(value) {
    searchQuery = String(value || '');
    renderSearchView();
  }

  function renderSearchView() {
    var wrap = document.getElementById('exp-chat-search-results');
    var inp = document.getElementById('exp-chat-search-input');
    if (!wrap) return;
    if (inp && inp.value !== searchQuery) inp.value = searchQuery;
    var term = (searchQuery || '').trim();
    if (!term) {
      wrap.innerHTML = '<div class="chat-empty">Pesquise por nome de conversa ou texto de mensagem.</div>';
      return;
    }
    wrap.innerHTML = '<div class="chat-loading">' + ldots() + '</div>';
    performSearch(term).then(function (res) {
      var convs = res.conversations || [];
      var msgs = res.messages || [];
      var html = '';
      if (convs.length) {
        html += '<div class="chat-search-group">Conversas</div>';
        html += convs.map(function (item) {
          var chanArg = attrJsStr(item.channel);
          var labelEsc = escHtml(item.label);
          var labelArg = attrJsStr(item.label);
          return '<div class="chat-search-item" onclick="expChat.openChannel(\'' + chanArg + '\',\'' + labelArg + '\')">' +
            softAvHtml(item.iniciais, item.cor, item.avatarUrl || null, 'width:24px;height:24px;font-size:9px;flex-shrink:0') +
            '<div class="chat-search-body">' +
              '<div class="chat-search-title">' + labelEsc + '</div>' +
              '<div class="chat-search-meta">' + escHtml(item.kind || 'Conversa') + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
      if (msgs.length) {
        html += '<div class="chat-search-group">Mensagens</div>';
        html += msgs.map(function (item) {
          var chanArg = attrJsStr(item.channel);
          var labelEsc = escHtml(item.label);
          var labelArg = attrJsStr(item.label);
          return '<div class="chat-search-item" onclick="expChat.openChannel(\'' + chanArg + '\',\'' + labelArg + '\')">' +
            softAvHtml(item.iniciais, item.cor, item.avatarUrl || null, 'width:24px;height:24px;font-size:9px;flex-shrink:0') +
            '<div class="chat-search-body">' +
              '<div class="chat-search-title">' + labelEsc + '</div>' +
              '<div class="chat-search-meta">' + escHtml(item.author || 'Equipe') + ' &middot; ' + escHtml(item.when || '') + '</div>' +
              '<div class="chat-search-snippet">' + escHtml(item.snippet || '') + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
      if (!html) html = '<div class="chat-empty">Nenhum resultado encontrado.</div>';
      wrap.innerHTML = html;
    }).catch(function () {
      wrap.innerHTML = '<div class="chat-empty">Erro ao pesquisar. Tente novamente.</div>';
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     ABRIR CANAL / DM
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function openChannel(channel, displayName) {
    removeConversationAlert(channel);
    closeMediaViewer();
    clearMessageMediaCache();
    setComposerStatus('', '', false);
    currentChannel = channel;
    currentLabel   = displayName || getChannelLabel(channel);
    if ($chanTitle) $chanTitle.textContent = currentLabel;
    messages = [];
    /* Reseta busca interna e filtro de sinalizadas ao trocar de conversa */
    closeInSearch();
    showOnlyFlagged = false;
    var flagBtn = document.getElementById('exp-chat-flagfilter-btn');
    if (flagBtn) flagBtn.classList.remove('active');
    showView('channel');
    updateChannelStatus();
    loadMessages();
    markRead();
    setTimeout(function () { if ($input) $input.focus(); }, 120);
  }

  function openProjectThread(threadId, displayName) {
    if (!threadId) return;
    var channel = projectChannel(threadId);
    if (displayName) applyProjectThreadTitle(threadId, displayName);
    open();
    openChannel(channel, displayName || getChannelLabel(channel));
  }

  function goHome() { selectedMembers = []; showView('home'); }

  /* Atualiza o subtÃ­tulo do canal com status de presenÃ§a */
  function updateChannelStatus() {
    var $sub = document.getElementById('exp-chat-chan-sub');
    if (!$sub) return;

    /* Para DMs: mostrar status da outra pessoa */
    if (currentChannel.startsWith('dm:')) {
      var parts   = currentChannel.replace('dm:', '').split(':');
      var otherUid = parts.find(function (p) { return p !== user.auth_id; });
      var pres    = otherUid ? onlinePresence[otherUid] : null;
      var sLabels = { online: 'Online', foco: 'Foco', ausente: 'Ausente' };
      var status  = pres ? pres.status : 'offline';
      var label   = pres ? (sLabels[status] || status) : 'Offline';
      $sub.style.display = '';
      $sub.innerHTML = '<span class="chat-presence-dot ' + status + '"></span>' + escHtml(label);

    /* Para grupos: mostrar quantos estÃ£o online */
    } else if (currentChannel.startsWith('group:')) {
      var uids   = currentChannel.replace('group:', '').split(':');
      var online = uids.filter(function (uid) { return onlinePresence[uid]; }).length;
      $sub.style.display = '';
      $sub.innerHTML = online + ' de ' + uids.length + ' online';

    } else if (isProjectChannel(currentChannel)) {
      $sub.style.display = '';
      $sub.innerHTML = 'Chat do projeto';

    /* Canais fixos: ocultar subtÃ­tulo */
    } else {
      $sub.style.display = 'none';
    }
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     NOVO DM â€” seletor de membros
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function startDM() {
    showView('members');
    loadTeamMembers();
  }

  function loadTeamMembers() {
    sb.from('usuarios')
      .select('id,auth_id,nome,iniciais,cor,role,avatar_url')
      .order('nome')
      .then(function (r) {
        var all = r.data || [];
        /* allMembers inclui o prÃ³prio usuÃ¡rio â€” usado para lookup de avatares */
        allMembers = all;
        /* teamMembers exclui o prÃ³prio usuÃ¡rio â€” usado no seletor de novo DM */
        teamMembers = all.filter(function (m) {
          return m.auth_id !== user.auth_id && m.id !== user.id;
        });
        if (currentView === 'members') renderMemberList();
        else if (isOpen && currentView === 'home') renderHome();
        else if (isOpen && currentView === 'channel') renderMessages();
      });
  }

  function renderMemberList() {
    var $list = document.getElementById('exp-chat-memberlist');
    if (!$list) return;
    if (!teamMembers.length) {
      $list.innerHTML = '<div class="chat-empty">Carregando equipe...</div>';
      return;
    }
    var roleLabel = {
      socio: 'S\u00F3cio',
      socio_adm: 'S\u00F3cio administrador',
      socio_admin: 'S\u00F3cio administrador',
      coordenador: 'Coordenador',
      colaborador: 'Colaborador'
    };
    var html = '';
    teamMembers.forEach(function (m) {
      var cor = m.cor || '#1D6A4A';
      var sel = selectedMembers.findIndex(function (s) { return s.auth_id === m.auth_id; }) !== -1;
      var pres    = onlinePresence[m.auth_id];
      var pStatus = pres ? pres.status : 'offline';
      var pLabels = { online: 'Online', foco: 'Foco', ausente: 'Ausente', offline: 'Offline' };
      var normalizedRole = typeof window.normalizeExpRole === 'function' ? window.normalizeExpRole(m.role) : (m.role || '').toLowerCase();
      var roleText = roleLabel[normalizedRole] || roleLabel[(m.role || '').toLowerCase()] || '';
      html += '<div class="chat-member-item" onclick="expChat.toggleMember(\'' + m.auth_id + '\')">' +
        '<div class="chat-member-check' + (sel ? ' sel' : '') + '"></div>' +
        '<div style="position:relative;flex-shrink:0">' +
          avHtml(m.iniciais || m.nome.substring(0, 2).toUpperCase(), cor, m.avatar_url, 'width:28px;height:28px;font-size:10px') +
          '<span class="chat-presence-dot ' + pStatus + '" style="position:absolute;bottom:-1px;right:-1px;border:1.5px solid #fff"></span>' +
        '</div>' +
        '<div class="chat-conv-info">' +
          '<div class="chat-conv-name">' + escHtml(m.nome) + '</div>' +
          '<div class="chat-conv-preview">' + escHtml(pLabels[pStatus]) + ' &middot; ' + escHtml(roleText) + '</div>' +
        '</div>' +
        '</div>';
    });
    $list.innerHTML = html;

    /* Barra de confirmaÃ§Ã£o */
    var $bar  = document.getElementById('exp-chat-group-bar');
    var $info = document.getElementById('exp-chat-group-info');
    var n = selectedMembers.length;
    if ($bar) $bar.style.display = n > 0 ? 'flex' : 'none';
    if ($info) {
      if (n === 1) $info.textContent = '1 pessoa selecionada';
      else if (n > 1) $info.textContent = n + ' pessoas selecionadas';
    }
    var $btn = document.querySelector('.chat-group-confirm');
    if ($btn) $btn.textContent = n === 1 ? 'Mensagem direta â†’' : 'Criar grupo â†’';
  }

  function toggleMember(authId) {
    var idx = selectedMembers.findIndex(function (m) { return m.auth_id === authId; });
    if (idx === -1) {
      var member = teamMembers.find(function (m) { return m.auth_id === authId; });
      if (member) selectedMembers.push(member);
    } else {
      selectedMembers.splice(idx, 1);
    }
    renderMemberList();
  }

  function confirmGroup() {
    if (!selectedMembers.length) return;
    var ch, label;
    if (selectedMembers.length === 1) {
      /* DM 1:1 */
      var m = selectedMembers[0];
      ch    = dmChannel(user.auth_id, m.auth_id);
      label = firstName(m.nome);
    } else {
      /* Grupo: canal com todos os UIDs ordenados */
      var allUids = [user.auth_id].concat(selectedMembers.map(function (m) { return m.auth_id; })).sort();
      ch    = 'group:' + allUids.join(':');
      label = selectedMembers.map(function (m) { return firstName(m.nome); }).join(', ');
    }
    selectedMembers = [];
    openChannel(ch, label);
  }

  function dmChannel(uid1, uid2) {
    return 'dm:' + [uid1, uid2].sort().join(':');
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     PRESENCE
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function setupPresence() {
    presenceCh = sb.channel('exp:chat:presence');
    presenceCh
      .on('presence', { event: 'sync' }, function () {
        var state = presenceCh.presenceState();
        onlinePresence = {};
        Object.keys(state).forEach(function (key) {
          state[key].forEach(function (p) {
            if (p.user_id) onlinePresence[p.user_id] = p;
          });
        });
        // Atualizar UI se aberto
        if (isOpen) {
          if (currentView === 'members') renderMemberList();
          if (currentView === 'channel') updateChannelStatus();
        }
      })
      .subscribe(function (s) {
        if (s === 'SUBSCRIBED') presenceCh.track(presencePayload(userStatus));
      });
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

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     REALTIME â€” receber mensagens
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function subscribeIncoming() {
    if (msgCh) { sb.removeChannel(msgCh); msgCh = null; }

    msgCh = sb.channel('exp:chat:incoming')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, function (payload) {
        var msg = payload.new;
        var ch  = msg.channel;
        var uid = user.auth_id;

        /* Ignorar canais que nÃ£o envolvem o usuÃ¡rio */
        var isSocios = ch === 'socios' && isSocioLikeRole(user.role);
        if (ch !== 'general' && !isSocios && ch.indexOf(uid) === -1) return;

        if (_wasSeen(msg.id)) return;
        _markSeen(msg.id);

        var isActive = isOpen && currentView === 'channel' && currentChannel === ch;
        var isOwn    = msg.sender_id === uid;

        if (isActive) {
          upsertMessage(msg);
          renderMessages();
          if (scrolledToEnd) scrollBottom();
          else if (!isOwn) showNewMsgToast();
          if (!isOwn) markRead();
        } else if (!isOwn) {
          channelUnread[ch] = (channelUnread[ch] || 0) + 1;
          updateBadge();
          if (isOpen && currentView === 'channel') addConversationAlert(msg);
          if (isOpen && currentView === 'home') renderHome();
          if (_shouldPlaySound(ch)) playNotificationSound();
          _sendChatPush(msg);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, function (payload) {
        var up = payload.new;
        if (up.channel !== currentChannel) return;
        upsertMessage(up);
        if (isOpen && currentView === 'channel') renderMessages();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_thread_messages' }, function (payload) {
        var raw = payload.new;
        if (_wasSeen('t:' + raw.id)) return;
        _markSeen('t:' + raw.id);
        var msg = normalizeProjectMessage(raw);
        var ch  = msg.channel;
        if (!projectThreadMeta[ch]) {
          projectThreadMeta[ch] = buildProjectThreadMeta(raw.thread_id, null, raw.content, raw.created_at, raw.sender_auth_id);
        }
        updateProjectThreadSnapshot(raw.thread_id, raw.content, raw.created_at, raw.sender_auth_id);

        var isActive = isOpen && currentView === 'channel' && currentChannel === ch;
        var isOwn    = raw.sender_auth_id === user.auth_id;

        if (isActive) {
          upsertMessage(msg);
          renderMessages();
          if (scrolledToEnd) scrollBottom();
          else if (!isOwn) showNewMsgToast();
          if (!isOwn) markRead();
        } else if (!isOwn) {
          channelUnread[ch] = (channelUnread[ch] || 0) + 1;
          updateBadge();
          if (isOpen && currentView === 'channel') addConversationAlert(msg);
          if (isOpen && currentView === 'home') renderHome();
          if (_shouldPlaySound(ch)) playNotificationSound();
          _sendChatPush(msg);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_thread_messages' }, function (payload) {
        var up = normalizeProjectMessage(payload.new);
        updateProjectThreadSnapshot(payload.new.thread_id, payload.new.content, payload.new.created_at, payload.new.sender_auth_id);
        if (up.channel !== currentChannel) return;
        upsertMessage(up);
        if (isOpen && currentView === 'channel') renderMessages();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gestao_anexos_temporarios' }, function (payload) {
        handleChatTempMediaRealtime(payload.new);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gestao_anexos_temporarios' }, function (payload) {
        handleChatTempMediaRealtime(payload.new);
      })
      .subscribe(function (status, err) {
        console.log('[EXP Chat] realtime status:', status, err || '');
        if (status === 'SUBSCRIBED') {
          console.log('[EXP Chat] realtime conectado ✓');
          /* Após uma queda, busca o que chegou enquanto estava offline */
          if (_realtimeDropped) {
            _realtimeDropped = false;
            console.log('[EXP Chat] recuperando mensagens perdidas...');
            fetchAllUnread();
            if (isOpen && currentView === 'home') renderHome();
            if (isOpen && currentView === 'channel') loadMessages();
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          _realtimeDropped = true;
          if (status !== 'CLOSED') {
            console.warn('[EXP Chat] reconectando em 4s...');
            setTimeout(function () {
              var s = msgCh && msgCh.state;
              if (s !== 'joined' && s !== 'joining') subscribeIncoming();
            }, 4000);
          }
        }
      });
  }

  /* ══════════════════════════════════════════════════════════════════
     POLLING FALLBACK — pega mensagens perdidas quando o realtime cai.
     O timer roda num Web Worker, que NÃO sofre throttling de aba em
     background; o dedup por id evita som/push duplicado com o realtime.
  ══════════════════════════════════════════════════════════════════ */
  var POLL_INTERVAL_MS = 30000;
  var _lastPollTs = new Date().toISOString();
  var _seenMsgIds = {};
  var _seenMsgOrder = [];
  var SEEN_MSG_CAP = 5000;
  function _markSeen(id) {
    if (id == null) return;
    var key = String(id);
    if (_seenMsgIds[key]) return;
    _seenMsgIds[key] = true;
    _seenMsgOrder.push(key);
    /* Evita crescimento ilimitado numa sessão longa: descarta os ids mais antigos. */
    if (_seenMsgOrder.length > SEEN_MSG_CAP) {
      var drop = _seenMsgOrder.splice(0, _seenMsgOrder.length - SEEN_MSG_CAP);
      drop.forEach(function (k) { delete _seenMsgIds[k]; });
    }
  }
  function _wasSeen(id)  { return id != null && !!_seenMsgIds[String(id)]; }

  function _processMissedMessage(msg) {
    var ch  = msg.channel;
    var uid = user.auth_id;
    var isSocios = ch === 'socios' && isSocioLikeRole(user.role);
    if (ch !== 'general' && !isSocios && ch.indexOf(uid) === -1) return;
    if (msg.sender_id === uid) return;

    var isActive = isOpen && currentView === 'channel' && currentChannel === ch;
    if (isActive) {
      upsertMessage(msg);
      renderMessages();
      if (scrolledToEnd) scrollBottom(); else showNewMsgToast();
      markRead();
      return;
    }
    channelUnread[ch] = (channelUnread[ch] || 0) + 1;
    updateBadge();
    if (isOpen && currentView === 'channel') addConversationAlert(msg);
    if (isOpen && currentView === 'home') renderHome();
    if (_shouldPlaySound(ch)) playNotificationSound();
    _sendChatPush(msg);
  }

  function _pollMissed() {
    if (!sb || !user || !user.auth_id) return;
    var since = _lastPollTs;
    Promise.all([
      sb.from('chat_messages').select('*').gt('created_at', since).order('created_at'),
      sb.from('chat_thread_messages').select('*').gt('created_at', since).order('created_at')
    ]).then(function (res) {
      (res[0].data || []).forEach(function (m) {
        if (m.created_at > _lastPollTs) _lastPollTs = m.created_at;
        if (_wasSeen(m.id)) return;
        _markSeen(m.id);
        _processMissedMessage(m);
      });
      (res[1].data || []).forEach(function (raw) {
        if (raw.created_at > _lastPollTs) _lastPollTs = raw.created_at;
        if (_wasSeen('t:' + raw.id)) return;
        _markSeen('t:' + raw.id);
        updateProjectThreadSnapshot(raw.thread_id, raw.content, raw.created_at, raw.sender_auth_id);
        var m = normalizeProjectMessage(raw);
        m.sender_id = raw.sender_auth_id;
        _processMissedMessage(m);
      });
    }).catch(function () {});
  }

  function startPolling() {
    try {
      /* Timer num Web Worker: não sofre throttling de aba em background */
      var blob = new Blob(['setInterval(function(){postMessage(1)},' + POLL_INTERVAL_MS + ')'], { type: 'text/javascript' });
      var blobUrl = URL.createObjectURL(blob);
      var w = new Worker(blobUrl);
      /* O worker já mantém sua própria referência ao script após criado. */
      URL.revokeObjectURL(blobUrl);
      w.onmessage = _pollMissed;
    } catch (e) {
      setInterval(_pollMissed, POLL_INTERVAL_MS);
    }
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     CARREGAR MENSAGENS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function loadMessages() {
    if (isLoading) return;
    var channel = currentChannel;
    var requestSeq = ++loadRequestSeq;
    isLoading = true;
    showLoading();
    if (isProjectChannel(channel)) {
      var threadId = projectThreadIdFromChannel(channel);
      sb.from('chat_thread_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(200)
        .then(function (r) {
          if (requestSeq !== loadRequestSeq || channel !== currentChannel) return;
          isLoading = false;
          if (r.error) { showError(); return; }
          messages = (r.data || []).slice().reverse().map(normalizeProjectMessage);
          clearMessageMediaCache();
          renderMessages();
          loadCurrentMessageMedia();
          scrollBottom();
        });
      return;
    }

    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    sb.from('chat_messages')
      .select('*')
      .eq('channel', channel)
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .then(function (r) {
        if (requestSeq !== loadRequestSeq || channel !== currentChannel) return;
        isLoading = false;
        if (r.error) { showError(); return; }
        messages = r.data || [];
        clearMessageMediaCache();
        renderMessages();
        loadCurrentMessageMedia();
        scrollBottom();
      });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     NÃƒO LIDAS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function fetchAllUnread() {
    var uid   = user.auth_id;
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();

    fetchProjectUnreadMap(uid).then(function (projectUnread) {
      Object.keys(projectUnread || {}).forEach(function (channel) {
        channelUnread[channel] = projectUnread[channel];
      });
      updateBadge();
      if (isOpen && currentView === 'home') renderHome();
    });

    /* Canais fixos contam não lidas além da janela de 72h, então são apurados
       à parte. O fetch geral (DMs/grupos) preserva esses valores em vez de
       recalculá-los — assim as duas consultas não disputam channelUnread. */
    var fixedChannels = ['general'];
    if (isSocioLikeRole(user.role)) fixedChannels.push('socios');
    var isFixedChannel = function (ch) { return fixedChannels.indexOf(ch) !== -1; };

    sb.from('chat_read_status').select('channel,last_read_at').eq('user_id', uid)
      .then(function (r) {
        if (r.error) return;
        var readMap = {};
        (r.data || []).forEach(function (row) { readMap[row.channel] = row.last_read_at; });

        fixedChannels.forEach(function (ch) {
          var lastRead = readMap[ch] || since;
          sb.from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('channel', ch)
            .gt('created_at', lastRead)
            .neq('sender_id', uid)
            .then(function (r2) {
              channelUnread[ch] = r2.count || 0;
              updateBadge();
              if (isOpen && currentView === 'home') renderHome();
            });
        });

        sb.from('chat_messages')
          .select('channel,sender_id,created_at')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .then(function (r2) {
            if (r2.error) return;
            /* Preserva canais fixos (apurados acima) e de projeto (apurados em
               fetchProjectUnreadMap) — o fetch geral cuida só de DMs/grupos. */
            var preserved = {};
            Object.keys(channelUnread).forEach(function (key) {
              if (isProjectChannel(key) || isFixedChannel(key)) preserved[key] = channelUnread[key];
            });
            var nextUnread = {};
            (r2.data || []).forEach(function (msg) {
              if (msg.sender_id === uid || isFixedChannel(msg.channel)) return;
              var lastRead = readMap[msg.channel] || since;
              if (msg.created_at > lastRead) nextUnread[msg.channel] = (nextUnread[msg.channel] || 0) + 1;
            });
            channelUnread = nextUnread;
            Object.keys(preserved).forEach(function (key) {
              channelUnread[key] = preserved[key];
            });
            updateBadge();
            if (isOpen && currentView === 'home') renderHome();
          });
      });
  }

  function markRead() {
    var channel = currentChannel;
    if (isProjectChannel(channel)) {
      sb.from('chat_thread_reads').upsert({
        user_auth_id: user.auth_id,
        thread_id: projectThreadIdFromChannel(channel),
        last_read_at: new Date().toISOString()
      }).then(function (r) {
        if (r.error) return;
        channelUnread[channel] = 0;
        updateBadge();
        if (projectThreadMeta[channel]) projectThreadMeta[channel].unread = 0;
        removeConversationAlert(channel);
        if (isOpen && currentView === 'home') renderHome();
      });
      return;
    }
    sb.from('chat_read_status').upsert({
      user_id: user.auth_id, channel: channel, last_read_at: new Date().toISOString()
    }).then(function (r) {
      if (r.error) return;
      channelUnread[channel] = 0;
      updateBadge();
      removeConversationAlert(channel);
      if (isOpen && currentView === 'home') renderHome();
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     ENVIAR
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function send() {
    if (!$input) return;
    var content = $input.value.trim();
    if (!content) return;
    $input.value = '';
    $input.style.height = 'auto';
    var pendingMsg = buildPendingMessage(content);
    upsertMessage(pendingMsg);
    renderMessages();
    scrollBottom();

    if (isProjectChannel(currentChannel)) {
      sb.from('chat_thread_messages').insert({
        thread_id: currentChannel.replace('project:', ''),
        sender_auth_id: user.auth_id,
        content: content
      }).select('*').single().then(function (r) {
        if (r.error) {
          removeMessageById(pendingMsg.id);
          renderMessages();
          $input.value = content;
          console.warn('[EXP Chat] Erro ao enviar no projeto:', r.error.message);
          return;
        }
        upsertMessage(normalizeProjectMessage(r.data));
        renderMessages();
      });
      return;
    }

    sb.from('chat_messages').insert({
      channel:         currentChannel,
      sender_id:       user.auth_id,
      sender_name:     user.nome,
      sender_iniciais: user.iniciais || user.nome.substring(0, 2).toUpperCase(),
      sender_cor:      user.cor || '#1D6A4A',
      content:         content
    }).select('*').single().then(function (r) {
      if (r.error) {
        removeMessageById(pendingMsg.id);
        renderMessages();
        $input.value = content;
        console.warn('[EXP Chat] Erro ao enviar:', r.error.message);
        return;
      }
      upsertMessage(r.data);
      renderMessages();
    });
  }

  function pickMedia() {
    if (mediaUploadBusy) return;
    var input = document.getElementById('exp-chat-media-input');
    if (!input) return;
    input.value = '';
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  }

  async function handleMediaInput(input) {
    var file = input && input.files ? input.files[0] : null;
    if (!file) return;
    try {
      await sendMediaFile(file);
    } finally {
      input.value = '';
    }
  }

  function mediaRpcContent(rawContent) {
    return isImageOnlySentinel(rawContent) ? '' : String(rawContent || '');
  }

  async function persistPreparedMedia(prepared, content, contextType, pendingMsg) {
    if (!prepared || !prepared.blob) throw new Error('O print nÃ£o estÃ¡ mais disponÃ­vel para reenvio.');
    var storagePath = '';
    var uploaded = false;
    var previewUrl = prepared.objectUrl || (pendingMsg && pendingMsg.temp_media && pendingMsg.temp_media.objectUrl) || null;
    var targetChannel = pendingMsg && pendingMsg.channel ? pendingMsg.channel : currentChannel;
    var targetThreadId = pendingMsg && pendingMsg.thread_id ? pendingMsg.thread_id : projectThreadIdFromChannel(currentChannel);
    try {
      storagePath = buildChatMediaPath(contextType, prepared.ext);
      setComposerStatus('Enviando print...', '', true);
      var uploadRes = await sb.storage.from(TEMP_MEDIA_BUCKET).upload(storagePath, prepared.blob, {
        contentType: prepared.mimeType,
        upsert: false
      });
      if (uploadRes.error) throw uploadRes.error;
      uploaded = true;

      var rpcName = contextType === 'chat_thread_message'
        ? 'send_chat_thread_message_with_temp_media'
        : 'send_chat_message_with_temp_media';
      var rpcPayload = contextType === 'chat_thread_message'
        ? {
            p_thread_id: targetThreadId,
            p_content: content,
            p_storage_path: storagePath,
            p_mime_type: prepared.mimeType,
            p_arquivo_ext: prepared.ext,
            p_size_bytes: prepared.blob.size,
            p_width_px: prepared.width,
            p_height_px: prepared.height
          }
        : {
            p_channel: targetChannel,
            p_content: content,
            p_storage_path: storagePath,
            p_mime_type: prepared.mimeType,
            p_arquivo_ext: prepared.ext,
            p_size_bytes: prepared.blob.size,
            p_width_px: prepared.width,
            p_height_px: prepared.height
          };
      var rpcRes = await sb.rpc(rpcName, rpcPayload);
      if (rpcRes.error) throw rpcRes.error;
      var saved = Array.isArray(rpcRes.data) ? rpcRes.data[0] : rpcRes.data;

      if (!saved || !saved.id) throw new Error('Mensagem com print nÃ£o retornou do servidor.');

      upsertMessage(contextType === 'chat_thread_message' ? normalizeProjectMessage(saved) : saved);
      assignMessageMedia(contextType, saved.id, {
        storage_path: storagePath,
        objectUrl: previewUrl,
        mime_type: prepared.mimeType,
        arquivo_ext: prepared.ext,
        width_px: prepared.width,
        height_px: prepared.height,
        pending: false,
        failed: false,
        failed_load: false,
        blob: null,
        expires_at: addDaysIso(7)
      }, pendingMsg ? pendingMsg.id : null);
      renderMessages();
      setComposerStatus('Print enviado. Expira em 7 dias.', 'ok', false);
      return saved;
    } catch (error) {
      if (uploaded && storagePath) {
        try { await sb.storage.from(TEMP_MEDIA_BUCKET).remove([storagePath]); } catch (e) {}
      }
      throw error;
    }
  }

  async function sendMediaFile(file) {
    if (!$input || mediaUploadBusy) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type || '')) {
      console.warn('[EXP Chat] Tipo de imagem nÃƒÂ£o suportado.');
      setComposerStatus('Use apenas prints em PNG, JPG ou WEBP.', 'warn', true);
      return;
    }

    mediaUploadBusy = true;
    var content = ($input.value || '').trim();
    $input.value = '';
    $input.style.height = 'auto';

    var optimized = null;
    var previewUrl = null;
    var pendingMsg = null;
    var contextType = isProjectChannel(currentChannel) ? 'chat_thread_message' : 'chat_message';
    var messageId = newUuid();

    try {
      setComposerStatus('Otimizando print...', '', true);
      var cfg = await loadChatMediaConfig();
      optimized = await optimizeChatMediaImage(file, cfg);
      previewUrl = URL.createObjectURL(optimized.blob);
      pendingMsg = buildPendingMessage(content || CHAT_IMAGE_SENTINEL, {
        id: messageId,
        temp_media: {
          objectUrl: previewUrl,
          mime_type: optimized.mimeType,
          arquivo_ext: optimized.ext,
          width_px: optimized.width,
          height_px: optimized.height,
          expires_at: addDaysIso(7),
          pending: true,
          failed: false,
          failed_load: false,
          blob: optimized.blob
        }
      });
      upsertMessage(pendingMsg);
      assignMessageMedia(contextType, messageId, {
        storage_path: null,
        objectUrl: previewUrl,
        mime_type: optimized.mimeType,
        arquivo_ext: optimized.ext,
        width_px: optimized.width,
        height_px: optimized.height,
        pending: true,
        failed: false,
        failed_load: false,
        blob: optimized.blob,
        expires_at: addDaysIso(7)
      });
      renderMessages();
      scrollBottom();

      await persistPreparedMedia({
        blob: optimized.blob,
        mimeType: optimized.mimeType,
        ext: optimized.ext,
        width: optimized.width,
        height: optimized.height,
        objectUrl: previewUrl
      }, mediaRpcContent(content || CHAT_IMAGE_SENTINEL), contextType, pendingMsg);
    } catch (error) {
      var failMsg = describeChatMediaError(error);
      if (pendingMsg && pendingMsg.id) {
        pendingMsg.pending = false;
        pendingMsg.failed = true;
        pendingMsg.error_message = failMsg;
        upsertMessage(pendingMsg);
      }
      if (previewUrl) {
        assignMessageMedia(contextType, pendingMsg ? pendingMsg.id : messageId, {
          storage_path: null,
          objectUrl: previewUrl,
          mime_type: optimized && optimized.mimeType || null,
          arquivo_ext: optimized && optimized.ext || null,
          width_px: optimized && optimized.width || null,
          height_px: optimized && optimized.height || null,
          pending: false,
          failed: true,
          failed_load: false,
          blob: optimized && optimized.blob || null,
          expires_at: addDaysIso(7)
        });
      }
      /* O upload (quando chegou a ocorrer) já é removido dentro de persistPreparedMedia. */
      console.warn('[EXP Chat] Erro ao anexar print:', error && error.message ? error.message : error);
      setComposerStatus('Falha ao enviar print: ' + failMsg, 'warn', true);
      renderMessages();
    } finally {
      mediaUploadBusy = false;
    }
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     REACTIONS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function retryMediaIssue(messageId) {
    var msg = messages.find(function (item) { return item.id === messageId; });
    var media = msg ? getMessageMedia(msg) : null;
    if (msg && msg.failed) {
      retryMediaMessage(messageId);
      return;
    }
    if (media && media.failed_load) retryMediaLoad(messageId);
  }

  async function retryMediaMessage(messageId) {
    if (mediaUploadBusy) return;
    var msg = messages.find(function (item) { return item.id === messageId; });
    var media = msg ? getMessageMedia(msg) : null;
    if (!msg || !media || !media.blob) {
      setComposerStatus('Esse print nÃ£o estÃ¡ mais disponÃ­vel para reenvio. Cole novamente.', 'warn', true);
      return;
    }
    var contextType = mediaContextTypeForMessage(msg);
    mediaUploadBusy = true;
    try {
      msg.pending = true;
      msg.failed = false;
      delete msg.error_message;
      assignMessageMedia(contextType, msg.id, Object.assign({}, media, {
        pending: true,
        failed: false,
        failed_load: false
      }));
      renderMessages();
      await persistPreparedMedia({
        blob: media.blob,
        mimeType: media.mime_type || 'image/webp',
        ext: media.arquivo_ext || 'webp',
        width: media.width_px || null,
        height: media.height_px || null,
        objectUrl: media.objectUrl || null
      }, mediaRpcContent(msg.content), contextType, msg);
    } catch (error) {
      var failMsg = describeChatMediaError(error);
      msg.pending = false;
      msg.failed = true;
      msg.error_message = failMsg;
      assignMessageMedia(contextType, msg.id, Object.assign({}, media, {
        pending: false,
        failed: true,
        failed_load: false
      }));
      console.warn('[EXP Chat] Erro ao reenviar print:', error && error.message ? error.message : error);
      setComposerStatus('Falha ao reenviar print: ' + failMsg, 'warn', true);
      renderMessages();
    } finally {
      mediaUploadBusy = false;
    }
  }

  async function retryMediaLoad(messageId) {
    var msg = messages.find(function (item) { return item.id === messageId; });
    if (!msg || String(msg.id || '').indexOf('pending:') === 0) return;
    var contextType = mediaContextTypeForMessage(msg);
    var currentMedia = getMessageMedia(msg) || {};
    assignMessageMedia(contextType, msg.id, Object.assign({}, currentMedia, {
      pending: true,
      failed_load: false
    }));
    renderMessages();
    try {
      var metaRes = await sb.from('gestao_anexos_temporarios')
        .select('contexto_id,storage_path,mime_type,arquivo_ext,size_bytes,width_px,height_px,expires_at,created_at,marcadores')
        .eq('contexto_tipo', contextType)
        .eq('contexto_id', msg.id)
        .is('removido_em', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (metaRes.error || !metaRes.data) throw metaRes.error || new Error('Print nÃ£o encontrado.');
      var sres = await sb.storage.from(TEMP_MEDIA_BUCKET).createSignedUrl(metaRes.data.storage_path, SIGNED_URL_EXPIRES);
      if (sres.error || !sres.data || !sres.data.signedUrl) throw sres.error || new Error('Falha ao carregar o print.');
      delete failedStoragePaths[metaRes.data.storage_path];
      assignMessageMedia(contextType, msg.id, Object.assign({}, metaRes.data, {
        objectUrl: sres.data.signedUrl,
        pending: false,
        failed: false,
        failed_load: false,
        blob: currentMedia.blob || null
      }));
      renderMessages();
    } catch (error) {
      assignMessageMedia(contextType, msg.id, Object.assign({}, currentMedia, {
        pending: false,
        failed_load: true
      }));
      setComposerStatus('Falha ao carregar print. Clique no aviso para tentar de novo.', 'warn', true);
      renderMessages();
    }
  }

  function toggleReaction(msgId, type) {
    var msg = messages.find(function (m) { return m.id === msgId; });
    if (!msg) return;
    var isProjectMsg = isProjectChannel(msg.channel);
    var lockKey = msgId + '|' + type;
    if (reactionLocks[lockKey]) return;
    var uid = user.auth_id;
    var rx  = normalizeReactions(msg.reactions);
    var arr = (rx[type] || []).slice();
    var idx = arr.indexOf(uid);
    if (idx === -1) arr.push(uid); else arr.splice(idx, 1);
    var upd = Object.assign({}, rx);
    upd[type] = arr;
    msg.reactions = upd;
    renderMessages();
    var rpcName = isProjectMsg ? 'chat_thread_toggle_reaction' : 'chat_toggle_reaction';
    reactionLocks[lockKey] = true;
    sb.rpc(rpcName, { p_message_id: msgId, p_reaction: type })
      .then(function (r) {
        if (r.error) {
          msg.reactions = rx;
          renderMessages();
          console.warn('[EXP Chat] Erro ao reagir:', r.error.message);
          setComposerStatus('Não foi possível salvar a reação.', 'warn', true);
          return;
        }
        var updated = Array.isArray(r.data) ? r.data[0] : r.data;
        if (updated && updated.id) {
          upsertMessage(isProjectMsg ? normalizeProjectMessage(updated) : updated);
        }
        setComposerStatus('', '', false);
        renderMessages();
      })
      .finally(function () {
        delete reactionLocks[lockKey];
      });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RENDER MENSAGENS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function renderMessages() {
    if (!$msgs) return;
    if (!messages.length) {
      $msgs.innerHTML = '<div class="chat-empty"><div class="chat-empty-icon">' + icoEmpty() + '</div>Nenhuma mensagem ainda.</div>';
      return;
    }
    /* Filtro "sÃ³ sinalizadas" */
    var toRender = showOnlyFlagged
      ? messages.filter(function (m) { return isMessageFlagged(m.id); })
      : messages;
    if (!toRender.length) {
      $msgs.innerHTML = '<div class="chat-empty"><div class="chat-empty-icon">' + icoFlag() + '</div>Nenhuma mensagem sinalizada nesta conversa.</div>';
      return;
    }
    var uid = user.auth_id;
    var html = '';
    var prevSender = null, prevTime = null, lastDate = null;

    toRender.forEach(function (msg) {
      var isOwn   = msg.sender_id === uid;
      var flagged = isMessageFlagged(msg.id);
      var dt      = new Date(msg.created_at);
      var dateStr = dt.toDateString();

      if (dateStr !== lastDate) {
        lastDate = dateStr;
        html += '<div class="chat-date-sep">' + fmtDateSep(dt) + '</div>';
        prevSender = null;
      }

      var gap     = prevTime ? (dt - prevTime) : Infinity;
      var grouped = msg.sender_id === prevSender && gap < 5 * 60 * 1000;
      var iniciais= msg.sender_iniciais || (msg.sender_name || '').substring(0, 2).toUpperCase();
      var cor     = msg.sender_cor || '#1D6A4A';
      var fn      = firstName(msg.sender_name);
      var msgMember = allMembers.find(function (m) { return m.auth_id === msg.sender_id; });
      var msgAvatar = msgMember ? msgMember.avatar_url : null;
      var media   = getMessageMedia(msg);
      var imageOnly = isImageOnlySentinel(msg.content);
      var hasText = !!String(msg.content || '').trim() && !imageOnly;
      var showExpired = imageOnly && !media && isChatMediaExpired(msg);
      var showMediaLoading = imageOnly && !media && !showExpired;
      var showFailed = !!msg.failed;
      var showLoadFailed = !!(media && media.failed_load);

      var rx      = normalizeReactions(msg.reactions);
      var likeArr = rx.like  || [];
      var loveArr = rx.love  || [];
      var liked   = likeArr.indexOf(uid) !== -1;
      var loved   = loveArr.indexOf(uid) !== -1;
      var likeN   = likeArr.length;
      var loveN   = loveArr.length;
      var hasRxn  = likeN > 0 || loveN > 0;

      html += '<div class="chat-msg' + (isOwn ? ' own' : '') + (flagged ? ' flagged' : '') + '" data-id="' + msg.id + '">';

      if (!grouped) {
        html += '<div class="chat-msg-meta">' +
          avHtml(iniciais, cor, msgAvatar, '') +
          '<span class="chat-msg-name">' + escHtml(fn) + '</span>' +
          '<span class="chat-msg-time">' + fmtTime(dt) + '</span>' +
          '</div>';
      }

      var side = isOwn ? 'sent' : 'recv';

      /* Badge na quina da bolha (quando hÃ¡ reaÃ§Ãµes) */
      var badgeHtml = '';
      if (hasRxn) {
        badgeHtml = '<div class="chat-msg-rxn-badge">';
        if (likeN > 0) badgeHtml += '&#128077;' + (likeN > 1 ? '<span class="chat-msg-rxn-count">' + likeN + '</span>' : '');
        if (loveN > 0) badgeHtml += '&#10084;&#65039;' + (loveN > 1 ? '<span class="chat-msg-rxn-count">' + loveN + '</span>' : '');
        badgeHtml += '</div>';
      }

      /* Edição inline da própria mensagem */
      if (editingMessageId === msg.id && hasText) {
        html += '<div class="chat-msg-edit ' + side + '">' +
          '<textarea class="chat-msg-edit-input" oninput="expChat.editMessageInput(this)" onkeydown="expChat.editMessageKey(event,\'' + msg.id + '\')">' + escHtml(editingDraft) + '</textarea>' +
          '<div class="chat-msg-edit-actions">' +
            '<button class="chat-msg-edit-save" onclick="expChat.saveEditMessage(\'' + msg.id + '\')">Salvar</button>' +
            '<button class="chat-msg-edit-cancel" onclick="expChat.cancelEditMessage()">Cancelar</button>' +
          '</div></div>';
        html += '</div>';
        prevSender = msg.sender_id;
        prevTime   = dt;
        return;
      }

      /* Bolha + botÃµes de reaÃ§Ã£o lado a lado */
      html += '<div class="chat-msg-bubble-row' + (hasRxn ? ' has-rxn' : '') + '">' +
        '<div class="chat-msg-bubble-wrap">' +
          '<div class="chat-msg-text ' + side + (hasText ? '' : ' media-only') + '">' +
            (hasText ? linkify(escHtml(msg.content).replace(/\n/g, '<br>')) + (msg.editado_em ? '<span class="chat-msg-edited">(editado)</span>' : '') : '') +
          '</div>' +
          (media && media.objectUrl
            ? '<div class="chat-media-thumb" onclick="expChat.openMediaViewer(\'' + mediaKeyForMessage(msg) + '\')">' +
                '<img src="' + escHtml(media.objectUrl) + '" alt="Print do chat" loading="lazy" decoding="async">' +
              '</div>'
            : media && media.pending
              ? '<div class="chat-media-thumb"><div class="chat-media-thumb-pending">Enviando print...</div></div>'
              : showLoadFailed
                ? '<button type="button" class="chat-media-failed" onclick="expChat.retryMediaIssue(\'' + msg.id + '\')">Falha ao carregar print. Clique para tentar de novo.</button>'
              : showExpired
                ? '<div class="chat-media-expired">Print expirado</div>'
                : showMediaLoading
                  ? '<div class="chat-media-thumb"><div class="chat-media-thumb-pending">Carregando print...</div></div>'
                : '') +
          (showFailed ? '<button type="button" class="chat-media-failed" onclick="expChat.retryMediaIssue(\'' + msg.id + '\')">Falha no envio do print. Clique para tentar de novo.</button>' : '') +
          badgeHtml +
        '</div>' +
        '<div class="chat-msg-react-btns">' +
          '<button class="chat-rbtn like' + (liked ? ' active' : '') + '" onclick="expChat.react(\'' + msg.id + '\',\'like\')" title="Curtir">' + icoLike() + '</button>' +
          '<button class="chat-rbtn heart' + (loved ? ' active' : '') + '" onclick="expChat.react(\'' + msg.id + '\',\'love\')" title="Amei">' + icoHeart() + '</button>' +
          ((isOwn && hasText && !msg.pending && !msg.failed) ? '<button class="chat-rbtn" onclick="expChat.startEditMessage(\'' + msg.id + '\')" title="Editar">' + icoPencil() + '</button>' : '') +
          '<button class="chat-rbtn flag' + (flagged ? ' active' : '') + '" onclick="expChat.flagMessage(\'' + msg.id + '\')" title="' + (flagged ? 'Remover marcação' : 'Sinalizar / salvar') + '">' + icoFlag() + '</button>' +
        '</div>' +
      '</div>';

      html += '</div>';
      prevSender = msg.sender_id;
      prevTime   = dt;
    });

    $msgs.innerHTML = html;
    if (inSearchOpen) highlightInSearch();
    if (editingMessageId) {
      var $ed = $msgs.querySelector('.chat-msg-edit-input');
      if ($ed) { $ed.focus(); var v = $ed.value; $ed.value = ''; $ed.value = v; autoResize($ed); }
    }
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     EDITAR MENSAGEM
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function startEditMessage(msgId) {
    var msg = messages.find(function (m) { return m.id === msgId; });
    if (!msg || msg.sender_id !== user.auth_id) return;
    if (isImageOnlySentinel(msg.content) || isAnnotSentinel(msg.content)) return;
    editingMessageId = msgId;
    editingDraft = String(msg.content || '');
    renderMessages();
  }
  function editMessageInput(el) { editingDraft = el.value; autoResize(el); }
  function editMessageKey(e, msgId) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEditMessage(msgId); }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEditMessage(); }
  }
  function cancelEditMessage() { editingMessageId = null; editingDraft = ''; renderMessages(); }
  function saveEditMessage(msgId) {
    var msg = messages.find(function (m) { return m.id === msgId; });
    if (!msg) { cancelEditMessage(); return; }
    var newContent = (editingDraft || '').trim();
    var prevContent = msg.content, prevEdit = msg.editado_em || null;
    if (!newContent || newContent === prevContent) { cancelEditMessage(); return; }
    var nowIso = new Date().toISOString();
    msg.content = newContent; msg.editado_em = nowIso;
    editingMessageId = null; editingDraft = '';
    renderMessages();
    var isProjectMsg = isProjectChannel(msg.channel);
    var rpcName = isProjectMsg ? 'chat_thread_edit_message' : 'chat_edit_message';
    sb.rpc(rpcName, { p_message_id: msgId, p_content: newContent })
      .then(function (r) {
        if (r.error) {
          msg.content = prevContent; msg.editado_em = prevEdit;
          renderMessages();
          console.warn('[EXP Chat] Erro ao editar:', r.error.message);
          setComposerStatus('Não foi possível editar a mensagem.', 'warn', true);
          return;
        }
        var updated = Array.isArray(r.data) ? r.data[0] : r.data;
        if (updated && updated.id) upsertMessage(isProjectMsg ? normalizeProjectMessage(updated) : updated);
        setComposerStatus('', '', false);
        renderMessages();
      });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     LINKIFY â€” URLs viram hiperlinks
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function linkify(html) {
    /* O texto já passou por escHtml, então & virou &amp;. Aceitamos &amp; dentro
       da URL para não truncar links com query string (?a=1&b=2). */
    return html.replace(/(https?:\/\/(?:&amp;|[^\s&"<>])+)/g, function (url) {
      return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="chat-link">' + url + '</a>';
    });
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     PUSH NOTIFICATION â€” DM direto ou menÃ§Ã£o
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  /* Push de chat nasce no backend (edge function chat-fanout). O cliente cuida
     apenas de UI local, som e contagem de não lidas — não dispara push. */

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     SOM DE NOTIFICAÃ‡ÃƒO (Web Audio API â€” sem arquivo externo)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  /* ══════════════════════════════════════════════════════════════════
     CANAIS FIXADOS
  ══════════════════════════════════════════════════════════════════ */
  function togglePin(channel) {
    if (pinnedChannels.has(channel)) pinnedChannels.delete(channel);
    else pinnedChannels.add(channel);
    try { localStorage.setItem(PINNED_KEY, JSON.stringify(Array.from(pinnedChannels))); } catch (e) {}
    if (isOpen && currentView === 'home') renderHome();
  }

  /* Push pra si mesmo quando a aba NÃO está em primeiro plano de fato.
     Espelha a lógica do chat-fullpage: garante notificação do sistema operacional
     quando a aba do Chrome está aberta mas você está em outro programa. */
  function _sendChatPush(msg) {
    if (userStatus === 'foco') return;
    var ch = msg && msg.channel, uid = user.auth_id;
    if (!ch) return;
    var isDM = ch.indexOf('dm:') === 0 || ch.indexOf('group:') === 0;
    var isGeneral = ch === 'general';
    var isSocios = ch === 'socios' && isSocioLikeRole(user.role);
    if (!(isDM && ch.indexOf(uid) !== -1) && !isProjectChannel(ch) && !isGeneral && !isSocios) return;
    var appUserId = user.app_user_id || user.id; if (!appUserId) return;
    var raw = (msg.content || '').trim();
    if (/^\[anotacoes:.+\]$/.test(raw)) return; /* anotação sobre print: não notifica */
    /* Só é "estou olhando o chat" se a aba está VISÍVEL e o Chrome EM FOCO.
       Em outro programa (sem foco), visibilityState ainda é 'visible' — por isso
       checamos document.hasFocus() e, sem foco, garantimos o push. */
    if (document.visibilityState === 'visible' && document.hasFocus()) return;
    var sender = (msg.sender_name || '').split(' ')[0];
    var title = isProjectChannel(ch) ? sender + ' atualizou um projeto'
      : isDM ? sender + ' enviou uma mensagem'
      : isGeneral ? sender + ' no #geral'
      : sender + ' no #sócios';
    var body = raw === '[print]' ? '📷 Enviou um print'
      : (raw.length > 80 ? raw.substring(0, 80) + '...' : raw) || 'Nova mensagem no chat';
    sb.functions.invoke('send-push', { body: { usuario_id: appUserId, title: title, body: body, url: window.location.href, tag: 'exp-chat-' + ch } })
      .catch(function (e) { console.warn('[EXP Chat Push] erro:', e); });
  }

  function _shouldPlaySound(ch) {
    if (!soundEnabled) return false;
    if (userStatus === 'foco') return false;
    if (ch === 'general') return true;
    if (ch === 'socios' && isSocioLikeRole(user.role)) return true;
    if (isDynamicChannel(ch) && channelHasUser(ch, user.auth_id)) return true;
    if (pinnedChannels.has(ch)) return true;
    return false;
  }

  var _audioCtx = null;
  function _getAudioCtx() {
    if (_audioCtx && _audioCtx.state !== 'closed') return _audioCtx;
    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    _audioCtx = new Ctx();
    return _audioCtx;
  }
  /* Desbloqueia o AudioContext na primeira interação do usuário */
  document.addEventListener('click', function () { _getAudioCtx(); }, { once: true });

  function playNotificationSound() {
    if (soundLevel === 'off') return;
    var mult = SOUND_VOL[soundLevel] || 1;
    try {
      var ctx = _getAudioCtx();
      if (!ctx) return;
      function _play() {
        /* Sino suave: G5 + B5 simultâneos, ataque rápido, decay longo */
        [{ f: 784, vol: 0.032 }, { f: 987.8, vol: 0.022 }].forEach(function (n) {
          var osc  = ctx.createOscillator();
          var gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = n.f;
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(n.vol * mult, ctx.currentTime + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.57);
        });
      }
      if (ctx.state === 'suspended') ctx.resume().then(_play);
      else _play();
    } catch (e) {}
  }

  function _renderSoundBtn() {
    var btn = document.getElementById('exp-chat-sound-btn');
    if (btn) {
      btn.innerHTML = soundLevel === 'off' ? icoSoundOff() : icoSound();
      btn.title = 'Som das notificações: ' + (SOUND_LABELS[soundLevel] || '');
    }
    var pop = document.getElementById('exp-chat-sound-pop');
    if (pop) pop.querySelectorAll('.chat-sopt').forEach(function (o) {
      o.classList.toggle('active', o.getAttribute('data-level') === soundLevel);
    });
  }
  function toggleSoundPop(event) {
    if (event) event.stopPropagation();
    soundPopOpen ? closeSoundPop() : openSoundPop();
  }
  function openSoundPop() {
    var pop = document.getElementById('exp-chat-sound-pop');
    if (!pop) return;
    if (colorPopOpen) closeColorPop();
    soundPopOpen = true; pop.style.display = 'flex'; _renderSoundBtn();
  }
  function closeSoundPop() {
    soundPopOpen = false;
    var pop = document.getElementById('exp-chat-sound-pop');
    if (pop) pop.style.display = 'none';
  }
  function setSoundLevel(lv) {
    if (!SOUND_VOL.hasOwnProperty(lv)) return;
    soundLevel = lv; soundEnabled = lv !== 'off';
    localStorage.setItem(SOUND_LEVEL_KEY, lv);
    localStorage.setItem(SOUND_KEY, soundEnabled ? 'true' : 'false');
    _renderSoundBtn(); closeSoundPop();
    if (lv !== 'off') playNotificationSound(); /* prévia do volume escolhido */
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     UI HELPERS
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function updateBadge() {
    var total = Object.values ? Object.values(channelUnread).reduce(function (a, b) { return a + b; }, 0) :
      Object.keys(channelUnread).reduce(function (a, k) { return a + channelUnread[k]; }, 0);
    if (!$badge) return;
    if (total > 0) { $badge.textContent = total > 99 ? '99+' : String(total); $badge.style.display = 'flex'; }
    else $badge.style.display = 'none';
  }

  function scrollBottom() { if ($msgs) { $msgs.scrollTop = $msgs.scrollHeight; scrolledToEnd = true; } }

  function showLoading() { if ($msgs) $msgs.innerHTML = '<div class="chat-loading">' + ldots() + '</div>'; }
  function showError()   { if ($msgs) $msgs.innerHTML = '<div class="chat-empty">Erro ao carregar.<br>Tente novamente.</div>'; }

  function showNewMsgToast() {
    var old = document.getElementById('exp-chat-toast');
    if (old) old.remove();
    var t = document.createElement('div');
    t.id = 'exp-chat-toast'; t.className = 'chat-new-msg-toast'; t.textContent = 'â†“ Nova mensagem';
    t.onclick = function () { scrollBottom(); t.remove(); };
    $panel.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 4000);
  }

  function setComposerStatus(message, tone, sticky) {
    var el = document.getElementById('exp-chat-composer-status');
    if (!el) return;
    if (composerStatusTimer) {
      clearTimeout(composerStatusTimer);
      composerStatusTimer = null;
    }
    if (!message) {
      el.style.display = 'none';
      el.textContent = '';
      el.className = 'chat-composer-status';
      return;
    }
    el.textContent = message;
    el.className = 'chat-composer-status' + (tone ? ' ' + tone : '');
    el.style.display = 'block';
    if (!sticky) {
      composerStatusTimer = setTimeout(function () {
        if (!el) return;
        el.style.display = 'none';
        el.textContent = '';
        el.className = 'chat-composer-status';
        composerStatusTimer = null;
      }, 4200);
    }
  }

  function describeChatMediaError(error) {
    var raw = String(error && (error.message || error.details || error.code) || 'Falha ao anexar print.');
    var lower = raw.toLowerCase();
    if (lower.indexOf('send_chat_message_with_temp_media') !== -1 || lower.indexOf('send_chat_thread_message_with_temp_media') !== -1) {
      return 'A estrutura de prints do chat ainda nÃƒÂ£o estÃƒÂ¡ aplicada no banco.';
    }
    if (lower.indexOf('row-level security') !== -1 || lower.indexOf('access denied') !== -1) {
      return 'Seu usuÃƒÂ¡rio nÃƒÂ£o conseguiu gravar este print no storage/chat.';
    }
    if (lower.indexOf('bucket') !== -1 || lower.indexOf('storage') !== -1) {
      return 'NÃƒÂ£o foi possÃƒÂ­vel subir o print para o storage.';
    }
    return raw;
  }

  function previewFirstLine(text) {
    var line = normalizePreviewText(String(text || '').split(/\r?\n/)[0]).trim();
    if (isImageOnlySentinel(line)) return 'Print anexado';
    if (line.length > 70) return line.substring(0, 70) + '...';
    return line || 'Nova mensagem';
  }

  function buildAlertMetaForMessage(msg) {
    if (isProjectChannel(msg.channel)) {
      var pmeta = projectThreadMeta[msg.channel] || buildProjectThreadMeta(projectThreadIdFromChannel(msg.channel), null, msg.content, msg.created_at, msg.sender_id);
      return { channel: msg.channel, label: pmeta.label, iniciais: pmeta.iniciais, cor: pmeta.cor, preview: previewFirstLine(msg.content) };
    }
    if (msg.channel === 'general') return { channel: 'general', label: '# geral', iniciais: '#', cor: '#1D6A4A', preview: previewFirstLine(msg.content) };
    if (msg.channel === 'socios') return { channel: 'socios', label: '# s\u00F3cios', iniciais: '#', cor: '#C4831A', preview: previewFirstLine(msg.content) };
    var meta = getConversationMeta(msg, user.auth_id);
    return { channel: msg.channel, label: meta.label, iniciais: meta.iniciais, cor: meta.cor, preview: previewFirstLine(msg.content) };
  }

  function addConversationAlert(msg) {
    var meta = buildAlertMetaForMessage(msg);
    recentConversationAlerts = recentConversationAlerts.filter(function (item) { return item.channel !== meta.channel; });
    recentConversationAlerts.unshift({
      channel: meta.channel,
      label: meta.label,
      iniciais: meta.iniciais,
      cor: meta.cor,
      preview: meta.preview,
      ts: msg.created_at || new Date().toISOString()
    });
    recentConversationAlerts.sort(function (a, b) { return new Date(b.ts) - new Date(a.ts); });
    recentConversationAlerts = recentConversationAlerts.slice(0, 3);
    renderConversationAlerts();
  }

  function removeConversationAlert(channel) {
    recentConversationAlerts = recentConversationAlerts.filter(function (item) { return item.channel !== channel; });
    renderConversationAlerts();
  }

  function renderConversationAlerts() {
    var wrap = document.getElementById('exp-chat-alerts');
    if (!wrap) return;
    var shouldShow = isOpen && currentView === 'channel' && recentConversationAlerts.length > 0;
    wrap.style.display = shouldShow ? 'flex' : 'none';
    if (!shouldShow) {
      wrap.innerHTML = '';
      return;
    }
    wrap.innerHTML = recentConversationAlerts.map(function (item) {
      var chanArg = attrJsStr(item.channel);
      var labelEsc = escHtml(item.label);
      var labelArg = attrJsStr(item.label);
      return '<div class="chat-alert-card" onclick="expChat.openChannel(\'' + chanArg + '\',\'' + labelArg + '\')">' +
        '<div class="chat-alert-top">' +
          softAvHtml(item.iniciais, item.cor, null, 'width:24px;height:24px;font-size:9px;flex-shrink:0') +
          '<div class="chat-conv-info"><div class="chat-alert-title">' + labelEsc + '</div></div>' +
          '<span class="chat-alert-chip">Nova</span>' +
        '</div>' +
        '<div class="chat-alert-preview">' + escHtml(item.preview) + '</div>' +
      '</div>';
    }).join('');
  }

  function fmtDateSep(d) {
    var today = new Date(), yest = new Date(today);
    yest.setDate(yest.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Hoje';
    if (d.toDateString() === yest.toDateString())  return 'Ontem';
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  }

  function fmtTime(d) { return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function firstName(name) { return name ? name.split(' ')[0] : ''; }
  function isSocioLikeRole(role) {
    if (typeof window.isSocioRole === 'function') return window.isSocioRole(role);
    var normalized = (role || '').toLowerCase().trim();
    if (normalized === 'socio_adm') normalized = 'socio_admin';
    return ['socio', 'socio_admin'].includes(normalized);
  }
  function isDynamicChannel(channel) { return !!channel && (channel.indexOf('dm:') === 0 || channel.indexOf('group:') === 0); }
  function isProjectChannel(channel) { return !!channel && channel.indexOf('project:') === 0; }
  function projectChannel(threadId) { return 'project:' + threadId; }
  function projectThreadIdFromChannel(channel) { return String(channel || '').replace('project:', ''); }

  function channelHasUser(channel, uid) {
    if (!isDynamicChannel(channel) || !uid) return false;
    return channel.replace(/^dm:|^group:/, '').split(':').indexOf(uid) !== -1;
  }

  function getChannelLabel(channel) {
    if (channel === 'general') return '# geral';
    if (channel === 'socios') return '# s\u00F3cios';
    if (isProjectChannel(channel) && projectThreadMeta[channel]) return projectThreadMeta[channel].label;
    return currentLabel || '# geral';
  }

  function brandColorForKey(key) {
    var str = String(key || 'exp');
    var hash = 0;
    for (var i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
    return BRAND_AVATAR_COLORS[Math.abs(hash) % BRAND_AVATAR_COLORS.length];
  }

  function initialsFromLabel(label, fallback) {
    var base = String(label || '').trim();
    if (!base) return fallback || 'GP';
    if (base.indexOf('-') !== -1) {
      var head = base.split('-')[0].replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (head) return head.slice(0, 3);
    }
    var tokens = base.split(/\s+/).filter(Boolean);
    var initials = tokens.slice(0, 2).map(function (t) { return t.charAt(0).toUpperCase(); }).join('');
    if (initials.length >= 2) return initials.slice(0, 3);
    return base.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 3) || (fallback || 'GP');
  }

  function buildProjectThreadMeta(threadId, title, preview, createdAt, senderAuthId) {
    var channel = projectChannel(threadId);
    var label = title || (projectThreadMeta[channel] && projectThreadMeta[channel].label) || 'Projeto';
    return {
      threadId: threadId,
      channel: channel,
      label: label,
      iniciais: initialsFromLabel(label, 'PRJ'),
      cor: brandColorForKey(channel + ':' + label),
      preview: preview || 'Chat do projeto',
      lastCreatedAt: createdAt || null,
      lastSenderId: senderAuthId || null,
      unread: projectThreadMeta[channel] ? (projectThreadMeta[channel].unread || 0) : 0
    };
  }

  function updateProjectThreadSnapshot(threadId, preview, createdAt, senderAuthId) {
    var channel = projectChannel(threadId);
    var meta = projectThreadMeta[channel] || buildProjectThreadMeta(threadId, null, preview, createdAt, senderAuthId);
    meta.preview = preview || meta.preview;
    meta.lastCreatedAt = createdAt || meta.lastCreatedAt;
    meta.lastSenderId = senderAuthId || meta.lastSenderId;
    projectThreadMeta[channel] = meta;
  }

  function normalizeReactionList(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(function (item) { return String(item); });
    if (typeof value === 'string' && value) return [value];
    return [];
  }

  function normalizeReactions(reactions) {
    var base = reactions && typeof reactions === 'object' && !Array.isArray(reactions) ? reactions : {};
    return {
      like: normalizeReactionList(base.like),
      love: normalizeReactionList(base.love)
    };
  }

  function normalizeProjectMessage(msg) {
    return {
      id: msg.id,
      channel: projectChannel(msg.thread_id),
      thread_id: msg.thread_id,
      sender_id: msg.sender_auth_id,
      sender_name: msg.sender_nome,
      sender_iniciais: msg.sender_iniciais,
      sender_cor: msg.sender_cor,
      content: msg.content,
      created_at: msg.created_at,
      editado_em: msg.editado_em || null,
      reactions: normalizeReactions(msg.reactions)
    };
  }

  function buildPendingMessage(content, extra) {
    pendingMessageSeq += 1;
    return Object.assign({
      id: 'pending:' + pendingMessageSeq,
      channel: currentChannel,
      thread_id: isProjectChannel(currentChannel) ? projectThreadIdFromChannel(currentChannel) : null,
      sender_id: user.auth_id,
      sender_name: user.nome,
      sender_iniciais: user.iniciais || user.nome.substring(0, 2).toUpperCase(),
      sender_cor: user.cor || '#1D6A4A',
      content: content,
      created_at: new Date().toISOString(),
      reactions: normalizeReactions(null),
      pending: true
    }, extra || {});
  }

  function isMatchingPendingMessage(existing, nextMsg) {
    if (!existing || !existing.pending || !nextMsg) return false;
    return existing.channel === nextMsg.channel &&
      existing.sender_id === nextMsg.sender_id &&
      existing.content === nextMsg.content;
  }

  function compareMessages(a, b) {
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  }

  function upsertMessage(nextMsg) {
    if (!nextMsg || !nextMsg.id) return;
    var normalizedMsg = Object.assign({}, nextMsg, {
      reactions: normalizeReactions(nextMsg.reactions)
    });
    var idx = messages.findIndex(function (m) { return m.id === nextMsg.id; });
    if (idx === -1) idx = messages.findIndex(function (m) { return isMatchingPendingMessage(m, normalizedMsg); });
    if (idx !== -1) messages[idx] = Object.assign({}, messages[idx], normalizedMsg, { pending: false });
    else messages.push(normalizedMsg);
    messages.sort(compareMessages);
  }

  function removeMessageById(messageId) {
    messages = messages.filter(function (m) { return m.id !== messageId; });
  }

  function newUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      var v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function addDaysIso(days) {
    var dt = new Date();
    dt.setDate(dt.getDate() + days);
    return dt.toISOString();
  }

  function loadChatMediaConfig() {
    if (chatMediaConfig) return Promise.resolve(chatMediaConfig);
    var fallback = {
      largura_max_px: CHAT_MEDIA_LIMITS.largura_max_px,
      tamanho_max_kb: CHAT_MEDIA_LIMITS.tamanho_max_kb,
      qualidade_upload: CHAT_MEDIA_LIMITS.qualidade_upload
    };
    return sb.from('plataforma_midia_temporaria_config')
      .select('largura_max_px,tamanho_max_kb,qualidade_upload')
      .eq('id', true)
      .maybeSingle()
      .then(function (r) {
        chatMediaConfig = Object.assign({}, fallback, r.data || {});
        chatMediaConfig.largura_max_px = Math.max(640, Math.min(Number(chatMediaConfig.largura_max_px || fallback.largura_max_px), CHAT_MEDIA_LIMITS.largura_max_px));
        chatMediaConfig.tamanho_max_kb = Math.max(120, Math.min(Number(chatMediaConfig.tamanho_max_kb || fallback.tamanho_max_kb), CHAT_MEDIA_LIMITS.tamanho_max_kb));
        chatMediaConfig.qualidade_upload = Math.max(0.55, Math.min(Number(chatMediaConfig.qualidade_upload || fallback.qualidade_upload), CHAT_MEDIA_LIMITS.qualidade_upload));
        return chatMediaConfig;
      }).catch(function () {
        chatMediaConfig = fallback;
        return chatMediaConfig;
      });
  }

  function optimizeChatMediaImage(file, cfg) {
    return loadImageForChatMedia(file).then(function (img) {
      var quality = Number(cfg && cfg.qualidade_upload || CHAT_MEDIA_LIMITS.qualidade_upload);
      var widthMax = Number(cfg && cfg.largura_max_px || CHAT_MEDIA_LIMITS.largura_max_px);
      var maxBytes = Number(cfg && cfg.tamanho_max_kb || CHAT_MEDIA_LIMITS.tamanho_max_kb) * 1024;
      return rasterizeChatMedia(img, widthMax, quality, 'image/webp')
        .then(function (result) {
          if (!result.blob) return rasterizeChatMedia(img, widthMax, quality, 'image/jpeg');
          return result;
        })
        .then(function (result) {
          if (!result.blob) throw new Error('NÃƒÂ£o foi possÃƒÂ­vel preparar o print.');
          if (result.blob.size > maxBytes) {
            return rasterizeChatMedia(
              img,
              Math.min(widthMax, 1120),
              Math.min(quality, CHAT_MEDIA_LIMITS.qualidade_fallback),
              'image/jpeg'
            );
          }
          return result;
        })
        .then(function (result) {
          if (!result.blob) throw new Error('NÃƒÂ£o foi possÃƒÂ­vel comprimir o print.');
          if (result.blob.size > maxBytes) {
            throw new Error('O print ficou pesado demais mesmo apÃƒÂ³s compressÃƒÂ£o.');
          }
          return {
            blob: result.blob,
            width: result.width,
            height: result.height,
            mimeType: result.mimeType,
            ext: result.mimeType === 'image/webp' ? 'webp' : 'jpg'
          };
        });
    });
  }

  function loadImageForChatMedia(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Arquivo de imagem invÃƒÂ¡lido.'));
      };
      img.src = url;
    });
  }

  function rasterizeChatMedia(img, larguraMax, qualidade, mimeType) {
    return new Promise(function (resolve) {
      var ratio = img.width > larguraMax ? (larguraMax / img.width) : 1;
      var width = Math.max(1, Math.round(img.width * ratio));
      var height = Math.max(1, Math.round(img.height * ratio));
      var canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(function (blob) {
        resolve({
          blob: blob,
          width: width,
          height: height,
          mimeType: blob ? mimeType : null
        });
      }, mimeType, qualidade);
    });
  }

  function buildChatMediaPath(contextType, ext) {
    var dt = new Date();
    var yyyy = String(dt.getFullYear());
    var mm = String(dt.getMonth() + 1).padStart(2, '0');
    return contextType + '/' + user.auth_id + '/' + yyyy + '/' + mm + '/' + newUuid() + '.' + ext;
  }

  function mediaContextTypeForMessage(msg) {
    return isProjectChannel(msg && msg.channel) ? 'chat_thread_message' : 'chat_message';
  }

  function mediaKeyFor(type, id) {
    return String(type || '') + ':' + String(id || '');
  }

  function mediaKeyForMessage(msg) {
    return mediaKeyFor(mediaContextTypeForMessage(msg), msg && msg.id);
  }

  function assignMessageMedia(contextType, messageId, media, previousMessageId) {
    if (!messageId || !media) return;
    if (previousMessageId && previousMessageId !== messageId) {
      delete messageMediaMap[mediaKeyFor(contextType, previousMessageId)];
    }
    var key = mediaKeyFor(contextType, messageId);
    var prev = messageMediaMap[key];
    if (prev && prev.objectUrl && prev.objectUrl !== media.objectUrl && String(prev.objectUrl).indexOf('blob:') === 0) {
      URL.revokeObjectURL(prev.objectUrl);
    }
    messageMediaMap[key] = Object.assign({}, media);
    var msg = messages.find(function (item) { return item.id === messageId || item.id === previousMessageId; });
    if (msg) msg.temp_media = Object.assign({}, media);
  }

  function clearMessageMediaEntry(contextType, messageId) {
    var key = mediaKeyFor(contextType, messageId);
    var media = messageMediaMap[key];
    if (media && media.objectUrl && String(media.objectUrl).indexOf('blob:') === 0) {
      URL.revokeObjectURL(media.objectUrl);
    }
    delete messageMediaMap[key];
  }

  function clearMessageMediaCache() {
    Object.keys(messageMediaMap).forEach(function (key) {
      var media = messageMediaMap[key];
      if (media && media.objectUrl && String(media.objectUrl).indexOf('blob:') === 0) {
        URL.revokeObjectURL(media.objectUrl);
      }
    });
    messageMediaMap = {};
    messages.forEach(function (msg) {
      if (msg && msg.temp_media && msg.temp_media.objectUrl && String(msg.temp_media.objectUrl).indexOf('blob:') === 0) {
        URL.revokeObjectURL(msg.temp_media.objectUrl);
      }
      if (msg) delete msg.temp_media;
    });
  }

  function getMessageMedia(msg) {
    if (!msg) return null;
    return messageMediaMap[mediaKeyForMessage(msg)] || msg.temp_media || null;
  }

  function isImageOnlySentinel(content) {
    return String(content || '').trim() === CHAT_IMAGE_SENTINEL;
  }

  function isAnnotSentinel(content) {
    return /^\[anotacoes:.+\]$/.test(String(content || '').trim());
  }

  function isChatMediaExpired(msg) {
    if (!msg || !msg.created_at) return false;
    var dt = new Date(msg.created_at);
    return Date.now() - dt.getTime() > (7 * 24 * 60 * 60 * 1000);
  }

  function loadCurrentMessageMedia() {
    if (!messages.length) return Promise.resolve();
    var contextType = isProjectChannel(currentChannel) ? 'chat_thread_message' : 'chat_message';
    var ids = messages.map(function (msg) { return msg.id; }).filter(function (id) {
      return !!id && String(id).indexOf('pending:') !== 0;
    });
    if (!ids.length) return Promise.resolve();
    var requestSeq = ++mediaRequestSeq;
    return sb.from('gestao_anexos_temporarios')
      .select('contexto_id,storage_path,mime_type,arquivo_ext,size_bytes,width_px,height_px,expires_at,created_at,marcadores')
      .eq('contexto_tipo', contextType)
      .in('contexto_id', ids)
      .is('removido_em', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .then(function (r) {
        if (requestSeq !== mediaRequestSeq || r.error) return;
        var rows = r.data || [];
        /* Linhas sem caminho ou já marcadas como falhas → marca falha direto */
        rows.filter(function (row) { return !row.storage_path || failedStoragePaths[row.storage_path]; })
            .forEach(function (row) { assignMessageMedia(contextType, row.contexto_id, Object.assign({}, row, { objectUrl: null, pending: false, failed_load: true })); });
        var ok = rows.filter(function (row) { return row.storage_path && !failedStoragePaths[row.storage_path]; });
        /* Reaproveita prints já assinados nesta sessão (mesma URL = cache do navegador); atualiza só os marcadores */
        var toSign = [];
        ok.forEach(function (row) {
          var existing = messageMediaMap[mediaKeyFor(contextType, row.contexto_id)];
          if (existing && existing.objectUrl) assignMessageMedia(contextType, row.contexto_id, Object.assign({}, row, { objectUrl: existing.objectUrl, pending: false, failed_load: false }));
          else toSign.push(row);
        });
        if (!toSign.length) { if (isOpen && currentView === 'channel') renderMessages(); return; }
        /* Uma única chamada gera as signed URLs que faltam; o <img loading="lazy"> baixa do CDN */
        var paths = toSign.map(function (row) { return row.storage_path; });
        return sb.storage.from(TEMP_MEDIA_BUCKET).createSignedUrls(paths, SIGNED_URL_EXPIRES).then(function (sres) {
          if (requestSeq !== mediaRequestSeq) return;
          var urlByPath = {};
          (sres && sres.data || []).forEach(function (s) { if (s && s.path && s.signedUrl) urlByPath[s.path] = s.signedUrl; });
          toSign.forEach(function (row) {
            var url = urlByPath[row.storage_path];
            if (url) assignMessageMedia(contextType, row.contexto_id, Object.assign({}, row, { objectUrl: url, pending: false, failed_load: false }));
            else { failedStoragePaths[row.storage_path] = true; assignMessageMedia(contextType, row.contexto_id, Object.assign({}, row, { objectUrl: null, pending: false, failed_load: true })); }
          });
          if (isOpen && currentView === 'channel') renderMessages();
        });
      });
  }

  function handleChatTempMediaRealtime(row) {
    if (!row || row.removido_em) return;
    if (!isOpen || currentView !== 'channel') return;
    var expectedType = isProjectChannel(currentChannel) ? 'chat_thread_message' : 'chat_message';
    if (String(row.contexto_tipo || '').toLowerCase() !== expectedType) return;
    if (!messages.some(function (msg) { return msg.id === row.contexto_id; })) return;
    var _exKey = mediaKeyFor(expectedType, row.contexto_id);
    var _ex = messageMediaMap[_exKey];
    if (_ex) {
      /* mídia já carregada: sincroniza apenas os marcadores */
      if (JSON.stringify(_ex.marcadores || []) !== JSON.stringify(row.marcadores || [])) {
        _ex.marcadores = row.marcadores || [];
        if (mediaViewerState && mediaViewerState.mediaKey === _exKey) renderViewerMarkers();
      }
      return;
    }
    if (!row.storage_path || failedStoragePaths[row.storage_path]) {
      assignMessageMedia(expectedType, row.contexto_id, Object.assign({}, row, {
        objectUrl: null,
        pending: false,
        failed_load: true
      }));
      if (isOpen && currentView === 'channel') renderMessages();
      return;
    }
    sb.storage.from(TEMP_MEDIA_BUCKET).createSignedUrl(row.storage_path, SIGNED_URL_EXPIRES).then(function (sres) {
      if (sres.error || !sres.data || !sres.data.signedUrl) {
        failedStoragePaths[row.storage_path] = true;
        assignMessageMedia(expectedType, row.contexto_id, Object.assign({}, row, {
          objectUrl: null,
          pending: false,
          failed_load: true
        }));
      } else {
        assignMessageMedia(expectedType, row.contexto_id, Object.assign({}, row, {
          objectUrl: sres.data.signedUrl,
          pending: false,
          failed_load: false
        }));
      }
      if (isOpen && currentView === 'channel') renderMessages();
    });
  }

  function getMediaViewerGalleryKeys() {
    return messages.map(function (msg) {
      var media = getMessageMedia(msg);
      return media && media.objectUrl ? mediaKeyForMessage(msg) : null;
    }).filter(Boolean);
  }

  function getMessageByMediaKey(mediaKey) {
    return messages.find(function (msg) { return mediaKeyForMessage(msg) === mediaKey; }) || null;
  }

  function formatMediaViewerMeta(msg) {
    if (!msg) return 'Print do chat';
    var dt = msg.created_at ? new Date(msg.created_at) : null;
    var when = dt && !isNaN(dt.getTime())
      ? dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' · ' + fmtTime(dt)
      : '';
    var author = firstName(msg.sender_name || 'Equipe');
    return when ? (author + ' · ' + when) : author;
  }

  /* ══════════════════════════════════════════════════════════════════
     MARCADORES SOBRE O PRINT
     Salvos na coluna `marcadores` (jsonb) de gestao_anexos_temporarios:
     vivem e morrem com a imagem. Posições em % — acompanham o zoom.
  ══════════════════════════════════════════════════════════════════ */
  var mvTool = null;
  var MV_MARK_SVGS = {
    seta:          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D4FA0" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>',
    seta_verde:    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1D6A4A" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="5" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/></svg>',
    alerta:        '<svg width="26" height="26" viewBox="0 0 24 24" fill="#FBF3E8" stroke="#C4831A" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    x:             '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#B84C3A" stroke-width="3" stroke-linecap="round"><line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/></svg>',
    circulo:       '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1D4FA0" stroke-width="2.4"><circle cx="12" cy="12" r="9"/></svg>',
    circulo_verde: '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1D6A4A" stroke-width="2.4"><circle cx="12" cy="12" r="9"/></svg>'
  };

  function mvSelectTool(tool) {
    mvTool = (mvTool === tool) ? null : tool;
    ['seta','seta_verde','alerta','x','circulo','circulo_verde'].forEach(function (t) {
      var btn = document.getElementById('exp-chat-mv-tool-' + t);
      if (btn) btn.classList.toggle('active', mvTool === t);
    });
    var canvas = document.getElementById('exp-chat-mv-canvas');
    if (canvas) canvas.classList.toggle('tool-active', !!mvTool);
  }

  function _mvCurrentMedia() {
    if (!mediaViewerState || !mediaViewerState.mediaKey) return null;
    var msg = getMessageByMediaKey(mediaViewerState.mediaKey);
    var media = messageMediaMap[mediaViewerState.mediaKey] || null;
    return (msg && media) ? { msg: msg, media: media } : null;
  }

  function renderViewerMarkers() {
    var marks = document.getElementById('exp-chat-mv-marks');
    if (!marks) return;
    var cur = _mvCurrentMedia();
    var list = (cur && cur.media && cur.media.marcadores) || [];
    marks.innerHTML = list.map(function (mk) {
      var svg = MV_MARK_SVGS[mk.t] || '';
      var own = mk.uid === user.auth_id;
      return '<div class="chat-mv-mark" style="left:' + Number(mk.x) + '%;top:' + Number(mk.y) + '%"' +
        (own ? ' ondblclick="expChat.mvRemoveMark(\'' + escHtml(String(mk.id)) + '\')" title="Clique duplo para remover"' : '') + '>' +
        svg +
        '<span class="chat-mv-mark-ini">' + escHtml(mk.ini || '?') + '</span>' +
        '</div>';
    }).join('');
  }

  function mvCanvasClick(e) {
    if (!mvTool || !mediaViewerState) return;
    var img = document.getElementById('exp-chat-media-viewer-img');
    if (!img || !img.src) return;
    var cur = _mvCurrentMedia();
    if (!cur) return;
    var r = img.getBoundingClientRect();
    var x = ((e.clientX - r.left) / r.width)  * 100;
    var y = ((e.clientY - r.top)  / r.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    var mk = {
      id:  newUuid(),
      t:   mvTool,
      x:   Math.round(x * 100) / 100,
      y:   Math.round(y * 100) / 100,
      ini: user.iniciais || (user.nome || '').substring(0, 2).toUpperCase(),
      uid: user.auth_id,
      ts:  new Date().toISOString()
    };
    cur.media.marcadores = (cur.media.marcadores || []).concat([mk]);
    renderViewerMarkers();
    _saveMvMarkers(cur.msg, cur.media.marcadores);
  }

  function mvRemoveMark(markId) {
    var cur = _mvCurrentMedia();
    if (!cur) return;
    cur.media.marcadores = (cur.media.marcadores || []).filter(function (mk) {
      return !(String(mk.id) === String(markId) && mk.uid === user.auth_id);
    });
    renderViewerMarkers();
    _saveMvMarkers(cur.msg, cur.media.marcadores);
  }

  function _saveMvMarkers(msg, marcadores) {
    var ct = mediaContextTypeForMessage(msg);
    sb.from('gestao_anexos_temporarios')
      .update({ marcadores: marcadores })
      .eq('contexto_tipo', ct)
      .eq('contexto_id', msg.id)
      .is('removido_em', null)
      .then(function (r) {
        if (r.error) console.warn('[EXP Chat] falha ao salvar marcadores:', r.error.message);
      });
  }

  function syncMediaViewerFrame() {
    var viewer = document.getElementById('exp-chat-media-viewer');
    var img = document.getElementById('exp-chat-media-viewer-img');
    var empty = document.getElementById('exp-chat-media-viewer-empty');
    var title = document.getElementById('exp-chat-media-viewer-title');
    var meta = document.getElementById('exp-chat-media-viewer-meta');
    var count = document.getElementById('exp-chat-media-viewer-count');
    var prevBtn = document.getElementById('exp-chat-media-viewer-prev');
    var nextBtn = document.getElementById('exp-chat-media-viewer-next');
    if (!viewer || !img || !empty || !mediaViewerState) return;
    var gallery = mediaViewerState.gallery || [];
    var index = Math.max(0, Math.min(Number(mediaViewerState.index || 0), Math.max(gallery.length - 1, 0)));
    mediaViewerState.index = index;
    var mediaKey = gallery[index] || mediaViewerState.mediaKey;
    var media = mediaKey ? (messageMediaMap[mediaKey] || null) : null;
    var msg = mediaKey ? getMessageByMediaKey(mediaKey) : null;
    mediaViewerState.mediaKey = mediaKey;
    mediaViewerState.baseWidth = Number(media && media.width_px || 0) || null;
    if (title) title.textContent = getChannelLabel(currentChannel) || 'Print do chat';
    if (meta) meta.textContent = formatMediaViewerMeta(msg);
    if (count) count.textContent = (gallery.length ? (index + 1) : 1) + '/' + Math.max(gallery.length, 1);
    if (prevBtn) {
      prevBtn.style.display = gallery.length > 1 ? 'flex' : 'none';
      prevBtn.disabled = index <= 0;
    }
    if (nextBtn) {
      nextBtn.style.display = gallery.length > 1 ? 'flex' : 'none';
      nextBtn.disabled = index >= gallery.length - 1;
    }
    var canvas = document.getElementById('exp-chat-mv-canvas');
    var hasImg = !!(media && media.objectUrl);
    if (canvas) canvas.style.display = hasImg ? 'block' : 'none';
    img.style.display = hasImg ? 'block' : 'none';
    if (hasImg) img.src = media.objectUrl;
    else img.removeAttribute('src');
    empty.style.display = hasImg ? 'none' : 'block';
    empty.textContent = hasImg ? '' : 'Não foi possível carregar este print.';
    viewer.style.display = 'flex';
    updateMediaViewerZoom();
    renderViewerMarkers();
  }

  function openMediaViewer(mediaKey) {
    var media = messageMediaMap[mediaKey] || null;
    if (!media) return;
    var gallery = getMediaViewerGalleryKeys();
    var index = gallery.indexOf(mediaKey);
    if (index === -1) {
      gallery = [mediaKey];
      index = 0;
    }
    mediaViewerState = {
      mediaKey: mediaKey,
      gallery: gallery,
      index: index,
      zoom: 1,
      baseWidth: Number(media.width_px || 0) || null
    };
    syncMediaViewerFrame();
  }

  function closeMediaViewer() {
    mediaViewerState = null;
    mvSelectTool(null);
    var canvas = document.getElementById('exp-chat-mv-canvas');
    if (canvas) canvas.style.display = 'none';
    var viewer = document.getElementById('exp-chat-media-viewer');
    var img = document.getElementById('exp-chat-media-viewer-img');
    var empty = document.getElementById('exp-chat-media-viewer-empty');
    var meta = document.getElementById('exp-chat-media-viewer-meta');
    var zoomLabel = document.getElementById('exp-chat-media-viewer-zoom-label');
    if (img) {
      img.removeAttribute('src');
      img.style.display = 'none';
      img.style.width = '';
      img.style.maxWidth = '100%';
      img.style.maxHeight = 'calc(100vh - 180px)';
    }
    if (empty) empty.textContent = 'Carregando imagem...';
    if (meta) meta.textContent = 'Autor · data · hora';
    if (zoomLabel) zoomLabel.textContent = '100%';
    if (viewer) viewer.style.display = 'none';
  }

  function prevMediaViewer() {
    if (!mediaViewerState || !mediaViewerState.gallery || mediaViewerState.index <= 0) return;
    mediaViewerState.index -= 1;
    mediaViewerState.zoom = 1;
    syncMediaViewerFrame();
  }

  function nextMediaViewer() {
    if (!mediaViewerState || !mediaViewerState.gallery || mediaViewerState.index >= mediaViewerState.gallery.length - 1) return;
    mediaViewerState.index += 1;
    mediaViewerState.zoom = 1;
    syncMediaViewerFrame();
  }

  function updateMediaViewerZoom() {
    var img = document.getElementById('exp-chat-media-viewer-img');
    var zoomLabel = document.getElementById('exp-chat-media-viewer-zoom-label');
    if (!img || !mediaViewerState) return;
    var zoom = Math.max(1, Math.min(Number(mediaViewerState.zoom || 1), 4));
    mediaViewerState.zoom = zoom;
    if (zoomLabel) zoomLabel.textContent = Math.round(zoom * 100) + '%';
    if (zoom <= 1.001) {
      img.style.width = '';
      img.style.maxWidth = '100%';
      img.style.maxHeight = 'calc(100vh - 180px)';
      return;
    }
    var baseWidth = Number(mediaViewerState.baseWidth || img.naturalWidth || img.clientWidth || 720);
    img.style.maxWidth = 'none';
    img.style.maxHeight = 'none';
    img.style.width = Math.round(baseWidth * zoom) + 'px';
  }

  function zoomInMediaViewer() {
    if (!mediaViewerState) return;
    mediaViewerState.zoom = Math.min(4, Number(mediaViewerState.zoom || 1) + 0.25);
    updateMediaViewerZoom();
  }

  function zoomOutMediaViewer() {
    if (!mediaViewerState) return;
    mediaViewerState.zoom = Math.max(1, Number(mediaViewerState.zoom || 1) - 0.25);
    updateMediaViewerZoom();
  }

  function resetMediaViewerZoom() {
    if (!mediaViewerState) return;
    mediaViewerState.zoom = 1;
    updateMediaViewerZoom();
  }

  function fetchProjectHomeItems(uid) {
    return sb.from('chat_threads')
      .select('id,title,produto_id,last_message_at')
      .eq('type', 'project')
      .is('archived_at', null)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .then(function (r) {
        if (r.error) return [];
        projectThreads = r.data || [];
        if (!projectThreads.length) {
          projectThreadMeta = {};
          return [];
        }

        var ids = projectThreads.map(function (t) { return t.id; });
        return sb.from('chat_thread_reads')
          .select('thread_id,last_read_at')
          .eq('user_auth_id', uid)
          .in('thread_id', ids)
          .then(function (readsRes) {
            var readMap = {};
            (readsRes.data || []).forEach(function (row) { readMap[row.thread_id] = row.last_read_at; });
            return Promise.all(projectThreads.map(function (thread) {
              var lastRead = readMap[thread.id] || null;
              return Promise.all([
                sb.from('chat_thread_messages')
                  .select('thread_id,content,created_at,sender_auth_id')
                  .eq('thread_id', thread.id)
                  .order('created_at', { ascending: false })
                  .limit(1),
                lastRead
                  ? sb.from('chat_thread_messages')
                      .select('id', { count: 'exact', head: true })
                      .eq('thread_id', thread.id)
                      .gt('created_at', lastRead)
                      .neq('sender_auth_id', uid)
                  : sb.from('chat_thread_messages')
                      .select('id', { count: 'exact', head: true })
                      .eq('thread_id', thread.id)
                      .neq('sender_auth_id', uid)
              ]).then(function (parts) {
                var last = (parts[0].data || [])[0] || null;
                var unreadCount = parts[1] && typeof parts[1].count === 'number' ? parts[1].count : 0;
                var meta = buildProjectThreadMeta(
                  thread.id,
                  thread.title,
                  last ? last.content : 'Chat do projeto',
                  last ? last.created_at : thread.last_message_at,
                  last ? last.sender_auth_id : null
                );
                meta.unread = unreadCount;
                projectThreadMeta[meta.channel] = meta;
                return meta;
              });
            }));
          });
      });
  }

  function fetchProjectUnreadMap(uid) {
    return fetchProjectHomeItems(uid).then(function (items) {
      var unread = {};
      (items || []).forEach(function (item) {
        if (item.unread) unread[item.channel] = item.unread;
      });
      return unread;
    }).catch(function () {
      return {};
    });
  }

  function fetchLegacyConversationItems(uid, since) {
    return sb.from('chat_messages')
      .select('channel,sender_name,sender_iniciais,sender_cor,content,created_at,sender_id')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .then(function (r) {
        var msgs = r.data || [];
        var seen = {};
        var items = [
          { channel: 'general', label: '# geral', iniciais: '#', cor: '#1D6A4A', avatarUrl: null, kind: 'Canal' }
        ];
        if (isSocioLikeRole(user.role)) {
          items.push({ channel: 'socios', label: '# s\u00F3cios', iniciais: '#', cor: '#C4831A', avatarUrl: null, kind: 'Canal privado' });
        }
        msgs.forEach(function (m) {
          if (!isDynamicChannel(m.channel) || !channelHasUser(m.channel, uid) || seen[m.channel]) return;
          seen[m.channel] = true;
          var meta = getConversationMeta(m, uid);
          items.push({
            channel: m.channel,
            label: meta.label,
            iniciais: meta.iniciais,
            cor: meta.cor,
            avatarUrl: meta.avatarUrl || null,
            kind: m.channel.indexOf('group:') === 0 ? 'Grupo' : 'Mensagem direta'
          });
        });
        return items;
      });
  }

  function searchInConversations(items, termLower) {
    return (items || []).filter(function (item) {
      return String(item.label || '').toLowerCase().indexOf(termLower) !== -1;
    }).slice(0, 12);
  }

  function searchLegacyMessages(term, uid) {
    return sb.from('chat_messages')
      .select('id,channel,content,created_at,sender_name,sender_iniciais,sender_cor,sender_id')
      .ilike('content', '%' + term + '%')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(function (r) {
        return (r.data || []).filter(function (msg) {
          if (msg.channel === 'general') return true;
          if (msg.channel === 'socios') return isSocioLikeRole(user.role);
          return isDynamicChannel(msg.channel) && channelHasUser(msg.channel, uid);
        }).map(function (msg) {
          var meta = msg.channel === 'general'
            ? { label: '# geral', iniciais: '#', cor: '#1D6A4A', avatarUrl: null }
            : msg.channel === 'socios'
              ? { label: '# s\u00F3cios', iniciais: '#', cor: '#C4831A', avatarUrl: null }
              : getConversationMeta(msg, uid);
          return {
            channel: msg.channel,
            label: meta.label,
            iniciais: meta.iniciais,
            cor: meta.cor,
            avatarUrl: meta.avatarUrl || null,
            author: firstName(msg.sender_name || 'Equipe'),
            when: fmtTime(new Date(msg.created_at)),
            snippet: previewFirstLine(msg.content)
          };
        });
      });
  }

  function searchProjectMessages(term) {
    return sb.from('chat_thread_messages')
      .select('id,thread_id,content,created_at,sender_nome,sender_iniciais,sender_cor,sender_auth_id')
      .ilike('content', '%' + term + '%')
      .order('created_at', { ascending: false })
      .limit(40)
      .then(function (r) {
        return (r.data || []).map(function (msg) {
          var channel = projectChannel(msg.thread_id);
          var meta = projectThreadMeta[channel] || buildProjectThreadMeta(msg.thread_id, null, msg.content, msg.created_at, msg.sender_auth_id);
          return {
            channel: channel,
            label: meta.label,
            iniciais: meta.iniciais,
            cor: meta.cor,
            avatarUrl: null,
            author: firstName(msg.sender_nome || 'Equipe'),
            when: fmtTime(new Date(msg.created_at)),
            snippet: previewFirstLine(msg.content)
          };
        });
      });
  }

  function performSearch(term) {
    var uid = user.auth_id;
    var since = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
    var termLower = String(term || '').toLowerCase();
    return Promise.all([
      fetchLegacyConversationItems(uid, since),
      fetchProjectHomeItems(uid),
      searchLegacyMessages(term, uid),
      searchProjectMessages(term)
    ]).then(function (parts) {
      var legacyConvs = parts[0] || [];
      var projectConvs = (parts[1] || []).map(function (item) {
        return {
          channel: item.channel,
          label: item.label,
          iniciais: item.iniciais,
          cor: item.cor,
          avatarUrl: null,
          kind: 'Projeto'
        };
      });
      var conversations = searchInConversations(legacyConvs.concat(projectConvs), termLower);
      var messages = (parts[2] || []).concat(parts[3] || []).slice(0, 30);
      return { conversations: conversations, messages: messages };
    });
  }

  function applyProjectThreadTitle(threadId, title) {
    var channel = projectChannel(threadId);
    var meta = projectThreadMeta[channel] || buildProjectThreadMeta(threadId, title, null, null, null);
    meta.label = title || meta.label;
    meta.iniciais = initialsFromLabel(meta.label, 'PRJ');
    meta.cor = brandColorForKey(channel + ':' + meta.label);
    projectThreadMeta[channel] = meta;
    projectThreads = (projectThreads || []).map(function (thread) {
      return thread.id === threadId ? Object.assign({}, thread, { title: meta.label }) : thread;
    });
    if (currentChannel === channel) {
      currentLabel = meta.label;
      if ($chanTitle) $chanTitle.textContent = meta.label;
    }
  }

  function getConversationMeta(conv, uid) {
    var senderMember = allMembers.find(function (m) { return m.auth_id === conv.sender_id; });

    if (conv.channel.indexOf('group:') === 0) {
      var others = conv.channel.replace('group:', '').split(':')
        .filter(function (part) { return part !== uid; })
        .map(function (part) { return allMembers.find(function (m) { return m.auth_id === part; }); })
        .filter(Boolean);
      var label = others.length ? others.map(function (m) { return firstName(m.nome); }).join(', ') : 'Grupo';
      var initials = others.length
        ? others.slice(0, 2).map(function (m) { return firstName(m.nome).charAt(0).toUpperCase(); }).join('')
        : 'GP';
      return {
        label: label,
        iniciais: initials,
        cor: brandColorForKey(conv.channel + ':' + label),
        avatarUrl: null,
        preview: conv.content
      };
    }

    var isOwn = conv.sender_id === uid;
    var parts = conv.channel.replace('dm:', '').split(':');
    var otherUid = parts.find(function (p) { return p !== uid; }) || '';
    var member = allMembers.find(function (m) { return m.auth_id === otherUid; });

    if (!isOwn) {
      return {
        label: firstName(conv.sender_name),
        iniciais: conv.sender_iniciais || (conv.sender_name || '').substring(0, 2).toUpperCase(),
        cor: conv.sender_cor || '#1D6A4A',
        avatarUrl: senderMember ? senderMember.avatar_url : null,
        preview: conv.content
      };
    }

    if (member) {
      return {
        label: firstName(member.nome),
        iniciais: member.iniciais || member.nome.substring(0, 2).toUpperCase(),
        cor: member.cor || '#1D6A4A',
        avatarUrl: member.avatar_url || null,
        preview: conv.content
      };
    }

    return {
      label: 'Colega',
      iniciais: '??',
      cor: '#1D6A4A',
      avatarUrl: null,
      preview: conv.content
    };
  }

  function avHtml(iniciais, cor, avatarUrl, extraStyle) {
    var s = extraStyle || '';
    if (avatarUrl) {
      return '<img class="chat-av" src="' + escHtml(avatarUrl) + '" style="object-fit:cover;' + s + '" alt="">';
    }
    return '<div class="chat-av" style="background:' + cor + ';' + s + '">' + escHtml(iniciais) + '</div>';
  }

  function softBgColor(hex) {
    var color = /^#[0-9A-Fa-f]{6}$/.test(hex || '') ? hex : '#1D6A4A';
    return 'rgba(' + hexRgb(color) + ',0.16)';
  }

  function softAvHtml(iniciais, cor, avatarUrl, extraStyle) {
    var s = extraStyle || '';
    if (avatarUrl) return avHtml(iniciais, cor, avatarUrl, s);
    var color = /^#[0-9A-Fa-f]{6}$/.test(cor || '') ? cor : '#1D6A4A';
    return '<div class="chat-av" style="background:' + softBgColor(color) + ';color:' + color + ';' + s + '">' + escHtml(iniciais) + '</div>';
  }

  function escHtml(s) {
    if (s == null || s === '') return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  /* Escapa um valor para uso como argumento string (entre aspas simples) dentro de
     um atributo onclick="..." em HTML. Faz o escape JS (\\ e ') e depois o escape de
     atributo HTML, nessa ordem — o navegador decodifica as entidades antes do JS,
     então labels com apóstrofo (ex.: "D'Angelo") deixam de quebrar o handler. */
  function attrJsStr(s) {
    return escHtml(String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'"));
  }

  function previewNoiseScore(text) {
    var found = String(text || '').match(/[ÃÂâï¿½]/g);
    return found ? found.length : 0;
  }

  function normalizePreviewText(text) {
    var raw = String(text == null ? '' : text);
    if (!raw || !/[ÃÂâï¿½]/.test(raw)) return raw;
    try {
      if (typeof TextDecoder === 'function') {
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 255;
        var decoded = new TextDecoder('utf-8').decode(bytes);
        if (decoded && previewNoiseScore(decoded) < previewNoiseScore(raw)) return decoded;
      }
    } catch (e) {}
    return raw
      .replace(/â€¦/g, '...')
      .replace(/â€“/g, '-')
      .replace(/â€”/g, '-')
      .replace(/â€˜|â€™/g, "'")
      .replace(/â€œ|â€/g, '"')
      .replace(/Â/g, '');
  }

  function compactPreviewText(text, maxLen, fallback) {
    var clean = normalizePreviewText(text).trim();
    var limit = Number(maxLen) > 0 ? Number(maxLen) : 34;
    if (!clean) return fallback || '';
    return clean.length > limit ? clean.substring(0, limit) + '...' : clean;
  }

  function hexRgb(hex) {
    var r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return r + ',' + g + ',' + b;
  }

  function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 80) + 'px'; }
  function handleKey(e)   { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     PERSONALIZAÃ‡ÃƒO VISUAL â€” tema de cor (acento)
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function applyChatColor(color, persist) {
    if (!CHAT_COLOR_THEMES[color]) color = 'verde';
    chatColor = color;
    if (persist !== false) { try { localStorage.setItem(COLOR_KEY, color); } catch (e) {} }
    var wrap = document.getElementById('exp-chat-widget');
    if (wrap) {
      var t = CHAT_COLOR_THEMES[color];
      wrap.style.setProperty('--verde',    t.v);
      wrap.style.setProperty('--verde-l',  t.l);
      wrap.style.setProperty('--verde-bg', t.bg);
      /* Superfícies da janela recebem a cor escolhida:
         header pintado com a cor cheia (texto/botões em branco) e
         fundo das mensagens com um tom suave da mesma cor. */
      wrap.style.setProperty('--chat-head-bg',        t.v);
      wrap.style.setProperty('--chat-head-fg',        '#fff');
      wrap.style.setProperty('--chat-head-btn',       'rgba(255,255,255,.18)');
      wrap.style.setProperty('--chat-head-btn-h',     'rgba(255,255,255,.30)');
      wrap.style.setProperty('--chat-head-active-bg', '#fff');
      wrap.style.setProperty('--chat-head-active-fg', t.v);
      wrap.style.setProperty('--chat-msgs-bg',        t.bg);
    }
    document.querySelectorAll('.chat-color-dot').forEach(function (d) {
      d.classList.toggle('active', d.getAttribute('data-color') === color);
    });
  }
  function setChatColor(color) { applyChatColor(color, true); }
  function toggleColorPop(event) {
    if (event) event.stopPropagation();
    var pop = document.getElementById('exp-chat-color-pop');
    if (!pop) return;
    colorPopOpen = !colorPopOpen;
    pop.style.display = colorPopOpen ? 'flex' : 'none';
  }
  function closeColorPop() {
    colorPopOpen = false;
    var pop = document.getElementById('exp-chat-color-pop');
    if (pop) pop.style.display = 'none';
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     MENSAGENS SINALIZADAS (salvas) â€” mesma chave localStorage do chat full
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function saveFlags() { try { localStorage.setItem(FLAGS_KEY, JSON.stringify(flaggedMessages)); } catch (e) {} }
  function isMessageFlagged(id) { return flaggedMessages.indexOf(String(id)) !== -1; }
  function flagMessage(msgId) {
    var id = String(msgId);
    var i = flaggedMessages.indexOf(id);
    if (i === -1) flaggedMessages.push(id); else flaggedMessages.splice(i, 1);
    saveFlags();
    renderMessages();
  }
  function toggleFlaggedFilter() {
    showOnlyFlagged = !showOnlyFlagged;
    var btn = document.getElementById('exp-chat-flagfilter-btn');
    if (btn) btn.classList.toggle('active', showOnlyFlagged);
    renderMessages();
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     BUSCA DENTRO DA CONVERSA
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function openInSearch() {
    var bar = document.getElementById('exp-chat-insearch');
    if (!bar) return;
    inSearchOpen = true;
    bar.classList.add('open');
    var inp = document.getElementById('exp-chat-insearch-input');
    if (inp) { inp.value = inSearchQuery; setTimeout(function () { inp.focus(); }, 50); }
    runInSearch();
  }
  function closeInSearch() {
    inSearchOpen = false;
    inSearchQuery = '';
    inSearchResults = [];
    inSearchCurrent = 0;
    var bar = document.getElementById('exp-chat-insearch');
    if (bar) bar.classList.remove('open');
    var inp = document.getElementById('exp-chat-insearch-input');
    if (inp) inp.value = '';
    clearInSearchHighlight();
    updateInSearchCount();
  }
  function inSearchInput(value) {
    inSearchQuery = String(value || '');
    inSearchCurrent = 0;
    runInSearch();
  }
  function inSearchKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? inSearchPrev() : inSearchNext(); }
    else if (e.key === 'Escape') { e.preventDefault(); closeInSearch(); }
  }
  function inSearchNext() {
    if (!inSearchResults.length) return;
    inSearchCurrent = (inSearchCurrent + 1) % inSearchResults.length;
    highlightInSearch();
    updateInSearchCount();
  }
  function inSearchPrev() {
    if (!inSearchResults.length) return;
    inSearchCurrent = (inSearchCurrent - 1 + inSearchResults.length) % inSearchResults.length;
    highlightInSearch();
    updateInSearchCount();
  }
  function runInSearch() {
    inSearchResults = [];
    var q = (inSearchQuery || '').trim().toLowerCase();
    if (q) {
      messages.forEach(function (m) {
        var c = String(m.content || '');
        if (isImageOnlySentinel(c)) return;
        if (c.toLowerCase().indexOf(q) !== -1) inSearchResults.push(String(m.id));
      });
    }
    if (inSearchCurrent >= inSearchResults.length) inSearchCurrent = 0;
    highlightInSearch();
    updateInSearchCount();
  }
  function clearInSearchHighlight() {
    if (!$msgs) return;
    $msgs.querySelectorAll('.chat-msg.in-hit, .chat-msg.in-current').forEach(function (el) {
      el.classList.remove('in-hit', 'in-current');
    });
  }
  function _cssEsc(v) { return (window.CSS && CSS.escape) ? CSS.escape(v) : String(v).replace(/"/g, '\\"'); }
  function highlightInSearch() {
    if (!$msgs || !inSearchOpen) return;
    clearInSearchHighlight();
    inSearchResults.forEach(function (id, i) {
      var el = $msgs.querySelector('[data-id="' + _cssEsc(id) + '"]');
      if (!el) return;
      el.classList.add('in-hit');
      if (i === inSearchCurrent) {
        el.classList.add('in-current');
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }
  function updateInSearchCount() {
    var $c = document.getElementById('exp-chat-insearch-count');
    if ($c) $c.textContent = (inSearchResults.length ? (inSearchCurrent + 1) : 0) + '/' + inSearchResults.length;
    var $p = document.getElementById('exp-chat-insearch-prev');
    var $n = document.getElementById('exp-chat-insearch-next');
    var none = inSearchResults.length === 0;
    if ($p) $p.disabled = none;
    if ($n) $n.disabled = none;
  }

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     API PÃšBLICA
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  window.expChat = {
    toggle:          toggle,
    open:            open,
    close:           close,
    send:            send,
    handleKey:       handleKey,
    autoResize:      autoResize,
    setStatus:       function (s) { applyStatus(s, true); closeStatusPop(); },
    toggleStatusPop: toggleStatusPop,
    react:           toggleReaction,
    startEditMessage: startEditMessage,
    editMessageInput: editMessageInput,
    editMessageKey:  editMessageKey,
    saveEditMessage: saveEditMessage,
    cancelEditMessage: cancelEditMessage,
    openChannel:     openChannel,
    openProjectThread: openProjectThread,
    goHome:          goHome,
    openSearch:      openSearch,
    searchInput:     searchInput,
    pickMedia:       pickMedia,
    handleMediaInput: handleMediaInput,
    retryMediaIssue: retryMediaIssue,
    openMediaViewer: openMediaViewer,
    closeMediaViewer: closeMediaViewer,
    prevMediaViewer: prevMediaViewer,
    nextMediaViewer: nextMediaViewer,
    zoomInMediaViewer: zoomInMediaViewer,
    zoomOutMediaViewer: zoomOutMediaViewer,
    resetMediaViewerZoom: resetMediaViewerZoom,
    mvSelectTool:    mvSelectTool,
    mvRemoveMark:    mvRemoveMark,
    toggleProjectSection: toggleProjectSection,
    startDM:         startDM,
    toggleMember:    toggleMember,
    confirmGroup:    confirmGroup,
    toggleSoundPop:  toggleSoundPop,
    setSoundLevel:   setSoundLevel,
    togglePin:       togglePin,
    setChatColor:    setChatColor,
    toggleColorPop:  toggleColorPop,
    flagMessage:     flagMessage,
    toggleFlaggedFilter: toggleFlaggedFilter,
    openInSearch:    openInSearch,
    closeInSearch:   closeInSearch,
    inSearchInput:   inSearchInput,
    inSearchKey:     inSearchKey,
    inSearchNext:    inSearchNext,
    inSearchPrev:    inSearchPrev,
    refreshHome:     function () { renderHome(); },
    refreshProjectThreadTitle: function (threadId, title) {
      applyProjectThreadTitle(threadId, title);
      if (isOpen && currentView === 'home') renderHome();
    }
  };

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     BOOT
  â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  function boot() {
    if (typeof supabase === 'undefined') { setTimeout(boot, 200); return; }
    init();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 50);

})();
