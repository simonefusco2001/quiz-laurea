// Funzioni condivise tra pagina giocatore e pannello conduttore.
(function () {
  const cfg = window.QUIZ_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseKey);
  const sb = configured ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey) : null;

  const SHAPES = [
    '<svg viewBox="0 0 24 24"><path d="M12 3 22 21H2z"/></svg>',
    '<svg viewBox="0 0 24 24"><path d="M12 1 23 12 12 23 1 12z"/></svg>',
    '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg>',
    '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18"/></svg>',
  ];

  const Quiz = {
    sb,
    configured,
    offset: 0, // differenza tra orologio del server e del telefono (ms)

    async syncClock() {
      try {
        const t0 = Date.now();
        const { data, error } = await sb.rpc("server_now");
        const t1 = Date.now();
        if (!error && data) this.offset = new Date(data).getTime() - (t0 + t1) / 2;
      } catch (_) { /* si usa l'orologio del telefono */ }
    },

    now() { return Date.now() + this.offset; },

    remaining(s) {
      if (!s || !s.q_started_at) return 0;
      const end = new Date(s.q_started_at).getTime() + s.q_seconds * 1000;
      return Math.max(0, (end - this.now()) / 1000);
    },

    // Avvisa a ogni cambio di stato: tempo reale + controllo ogni 2,5 s se la connessione salta.
    watchState(cb) {
      let last = "";
      const push = (s) => {
        if (!s) return;
        const key = s.updated_at + "|" + s.phase + "|" + s.q_index;
        if (key === last) return;
        last = key;
        cb(s);
      };
      const poll = async () => {
        try {
          const { data } = await sb.from("game_state").select("*").eq("id", 1).single();
          push(data);
        } catch (_) { /* riprova al prossimo giro */ }
      };
      sb.channel("game")
        .on("postgres_changes", { event: "*", schema: "public", table: "game_state" }, (p) => push(p.new))
        .subscribe();
      poll();
      setInterval(poll, 2500);
      document.addEventListener("visibilitychange", () => { if (!document.hidden) poll(); });
    },

    async rpc(name, args, tries = 3) {
      let lastErr;
      for (let i = 0; i < tries; i++) {
        try {
          const { data, error } = await sb.rpc(name, args);
          if (!error) return data;
          lastErr = error;
          // errori "voluti" dal database: inutile riprovare
          if (/nome_|pin_|fase_/.test(error.message || "")) break;
        } catch (e) { lastErr = e; }
        await new Promise((r) => setTimeout(r, 400 * (i + 1)));
      }
      throw lastErr;
    },

    async top(n) {
      const { data } = await sb.from("players").select("name,score").order("score", { ascending: false }).order("created_at").limit(n);
      return data || [];
    },

    esc(s) {
      return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    },

    answerButton(i, text, extraClass = "") {
      return `<button class="ans ${extraClass}" data-i="${i}"><span class="shape">${SHAPES[i]}</span><span>${this.esc(text)}</span></button>`;
    },

    boardHtml(rows, meName) {
      return `<ol class="board">${rows.map((r, i) => `
        <li class="${r.name === meName ? "me" : ""}"><span class="pos">${i + 1}</span><span class="name">${this.esc(r.name)}</span><span>${r.score}</span></li>`).join("")}</ol>`;
    },

    podiumHtml(rows) {
      const slot = (r, cls, label) => r ? `
        <div class="step ${cls}"><div class="who">${this.esc(r.name)}</div><div class="pts">${r.score} punti</div><div class="block">${label}</div></div>` : `<div class="step ${cls}"></div>`;
      return `<div class="podium">${slot(rows[1], "p2", "2")}${slot(rows[0], "p1", "1")}${slot(rows[2], "p3", "3")}</div>`;
    },

    playPodium(root) {
      const order = [".p3", ".p2", ".p1"];
      order.forEach((sel, i) => setTimeout(() => {
        const el = root.querySelector(sel);
        if (el) el.classList.add("show");
        if (sel === ".p1" && window.confetti) {
          const end = Date.now() + 2500;
          (function frame() {
            confetti({ particleCount: 6, angle: 60, spread: 60, origin: { x: 0 } });
            confetti({ particleCount: 6, angle: 120, spread: 60, origin: { x: 1 } });
            if (Date.now() < end) requestAnimationFrame(frame);
          })();
        }
      }, 800 + i * 1600));
    },
  };

  window.Quiz = Quiz;
})();
