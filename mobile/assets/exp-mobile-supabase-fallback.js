// Offline-safe fallback for the CDN-loaded Supabase client.
// When the real library is unavailable, cached pages still open and can
// explain that live data and sync are temporarily offline.
(function () {
  if (window.supabase && typeof window.supabase.createClient === 'function') return;

  const OFFLINE_ERROR = Object.freeze({
    code: 'exp_offline_unavailable',
    name: 'ExpOfflineError',
    message: 'Backend indisponivel no momento. Reconecte-se para carregar dados em tempo real.',
  });

  function offlineResult(data, extra) {
    return Object.assign({ data, error: OFFLINE_ERROR, count: 0 }, extra || {});
  }

  function makeChain(resultFactory) {
    let proxy = null;
    const base = function () {
      return proxy;
    };

    base.then = function (resolve, reject) {
      return Promise.resolve(resultFactory()).then(resolve, reject);
    };
    base.catch = function (reject) {
      return Promise.resolve(resultFactory()).catch(reject);
    };
    base.finally = function (callback) {
      return Promise.resolve(resultFactory()).finally(callback);
    };

    proxy = new Proxy(base, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'unsubscribe' || prop === 'release' || prop === 'track' || prop === 'untrack') {
          return function () { return undefined; };
        }
        if (prop === 'subscribe') {
          return function (callback) {
            if (typeof callback === 'function') {
              setTimeout(function () { callback('CHANNEL_ERROR'); }, 0);
            }
            return proxy;
          };
        }
        return function () {
          return proxy;
        };
      },
      apply() {
        return proxy;
      },
    });

    return proxy;
  }

  function makeChannel() {
    return {
      on() { return this; },
      subscribe(callback) {
        if (typeof callback === 'function') {
          setTimeout(function () { callback('CHANNEL_ERROR'); }, 0);
        }
        return this;
      },
      unsubscribe() { return undefined; },
      track() { return Promise.resolve({ error: OFFLINE_ERROR }); },
      untrack() { return Promise.resolve({ error: null }); },
      presenceState() { return {}; },
    };
  }

  function createFallbackClient() {
    return {
      auth: {
        getSession: async function () {
          return { data: { session: null }, error: OFFLINE_ERROR };
        },
        signInWithPassword: async function () {
          return { data: { user: null, session: null }, error: OFFLINE_ERROR };
        },
        signOut: async function () {
          return { error: null };
        },
        resetPasswordForEmail: async function () {
          return { data: null, error: OFFLINE_ERROR };
        },
      },
      from: function () {
        return makeChain(function () {
          return offlineResult(null);
        });
      },
      rpc: async function () {
        return offlineResult(null);
      },
      channel: function () {
        return makeChannel();
      },
      removeChannel: async function () {
        return { error: null };
      },
      storage: {
        from: function () {
          return {
            upload: async function () { return offlineResult(null); },
            download: async function () { return offlineResult(null); },
            remove: async function () { return offlineResult(null); },
            getPublicUrl: function (path) {
              return { data: { publicUrl: path || '' }, error: OFFLINE_ERROR };
            },
          };
        },
      },
    };
  }

  window.supabase = {
    createClient: createFallbackClient,
  };
  window.__EXP_SUPABASE_STUB__ = true;
})();
