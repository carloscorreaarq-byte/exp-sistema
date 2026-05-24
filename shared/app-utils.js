(() => {
  function fmtDate(value, curto = false) {
    if (!value) return '—';
    const date = typeof value === 'string'
      ? new Date(value + (value.length === 10 ? 'T12:00:00' : ''))
      : value;
    if (Number.isNaN(date.getTime())) return '—';
    if (curto) {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  function fmtNum(value) {
    const number = Number(value || 0);
    return number.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function fmtH(hours) {
    if (hours !== 0 && !hours) return '—';
    const hh = Math.floor(hours);
    const mm = Math.round((hours - hh) * 60);
    return mm > 0 ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`;
  }

  function fmtHLong(hours) {
    if (hours !== 0 && !hours) return '0h 00min';
    const totalMin = Math.round(hours * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return `${hh}h ${String(mm).padStart(2, '0')}min`;
  }

  function fmtHMin(hours) {
    if (hours !== 0 && !hours) return '—';
    const totalMin = Math.round(hours * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return `${hh}h${String(mm).padStart(2, '0')}min`;
  }

  function fmtHClock(hours) {
    if (hours !== 0 && !hours) return '00:00';
    const totalMin = Math.round(hours * 60);
    const hh = Math.floor(totalMin / 60);
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }

  function diffHoras(ini, fim) {
    if (!ini || !fim) return 0;
    const [hi, mi] = String(ini).split(':').map(Number);
    const [hf, mf] = String(fim).split(':').map(Number);
    return Math.max(0, (hf * 60 + mf - hi * 60 - mi) / 60);
  }

  function _escN(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _sqN(value) {
    return "'" + String(value || '')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '')
      .replace(/\n/g, ' ') + "'";
  }

  function ensureToastHost() {
    let host = document.getElementById('toast-host');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'toast-host';
    host.className = 'toast-host';
    document.body.appendChild(host);
    return host;
  }

  function toast(message, duration = 2200) {
    const host = ensureToastHost();
    const el = document.createElement('div');
    el.className = 'toast-item';
    el.textContent = message;
    host.appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    window.setTimeout(() => {
      el.classList.remove('show');
      window.setTimeout(() => el.remove(), 180);
    }, duration);
  }

  window.fmtDate = window.fmtDate || fmtDate;
  window.fmtNum = window.fmtNum || fmtNum;
  window.fmtH = window.fmtH || fmtH;
  window.fmtHLong = window.fmtHLong || fmtHLong;
  window.fmtHMin = window.fmtHMin || fmtHMin;
  window.fmtHClock = window.fmtHClock || fmtHClock;
  window.diffHoras = window.diffHoras || diffHoras;
  window._escN = window._escN || _escN;
  window._sqN = window._sqN || _sqN;
  window.toast = window.toast || toast;
})();
