(function () {
  const TABLE_NAME = "investment_course_progress";
  const SAVE_DELAY_MS = 700;

  const syncState = {
    configured: false,
    client: null,
    user: null,
    loading: false,
    saving: false,
    lastSavedAt: null,
    error: "",
    message: "",
    syncCalculators: localStorage.getItem("investmentCourse.syncCalculators") === "true",
    saveTimer: null
  };

  function getConfig() {
    const config = window.INVESTMENT_COURSE_SUPABASE || {};
    const url = String(config.url || "").trim();
    const anonKey = String(config.anonKey || "").trim();
    return { url, anonKey };
  }

  function isConfigured(config) {
    return Boolean(config.url && config.anonKey && window.supabase?.createClient);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatTime(value) {
    if (!value) return "尚未同步";
    return new Date(value).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function getLocalSnapshot() {
    if (!window.InvestmentCourse?.getSyncSnapshot) return null;
    return window.InvestmentCourse.getSyncSnapshot({
      includeCalculators: syncState.syncCalculators
    });
  }

  function applySnapshot(snapshot) {
    if (!window.InvestmentCourse?.applySyncSnapshot) return;
    window.InvestmentCourse.applySyncSnapshot(snapshot || {});
  }

  function buildProgressRow() {
    const snapshot = getLocalSnapshot();
    if (!snapshot || !syncState.user) return null;
    return {
      user_id: syncState.user.id,
      current_lesson_id: snapshot.currentLessonId,
      active_lesson_id: snapshot.activeLessonId,
      completed: snapshot.completed || {},
      quiz_scores: snapshot.quizScores || {},
      ui: {
        lessonListOpen: Boolean(snapshot.lessonListOpen)
      },
      calculators: syncState.syncCalculators ? snapshot.calculators || {} : {},
      sync_calculators: syncState.syncCalculators,
      updated_at: snapshot.updatedAt || new Date().toISOString()
    };
  }

  function rowToSnapshot(row) {
    return {
      currentLessonId: row.current_lesson_id,
      activeLessonId: row.active_lesson_id,
      completed: row.completed || {},
      quizScores: row.quiz_scores || {},
      lessonListOpen: Boolean(row.ui?.lessonListOpen),
      calculators: row.sync_calculators ? row.calculators || {} : undefined,
      syncCalculators: Boolean(row.sync_calculators),
      updatedAt: row.updated_at
    };
  }

  function render() {
    const panel = document.querySelector("#syncPanel");
    if (!panel) return;

    if (!syncState.configured) {
      panel.innerHTML = `
        <div class="sync-status sync-muted">本地模式</div>
        <p>未配置 Supabase。当前进度只保存在这个浏览器。</p>
      `;
      return;
    }

    if (!syncState.user) {
      panel.innerHTML = `
        <div class="sync-status sync-muted">云同步未登录</div>
        <form class="sync-form" id="syncLoginForm">
          <label for="syncEmail">邮箱</label>
          <input id="syncEmail" type="email" autocomplete="email" placeholder="you@example.com" required>
          <button class="primary-button" type="submit">发送登录链接</button>
        </form>
        <p>使用邮箱 magic link 登录后，多设备会同步课程进度。</p>
        ${syncState.message ? `<div class="sync-message">${escapeHtml(syncState.message)}</div>` : ""}
        ${syncState.error ? `<div class="sync-error">${escapeHtml(syncState.error)}</div>` : ""}
      `;
      bindLoginForm();
      return;
    }

    panel.innerHTML = `
      <div class="sync-status sync-ok">已登录同步</div>
      <p class="sync-user">${escapeHtml(syncState.user.email || syncState.user.id)}</p>
      <label class="sync-checkbox">
        <input type="checkbox" id="syncCalculators" ${syncState.syncCalculators ? "checked" : ""}>
        <span>同步计算器输入</span>
      </label>
      <p class="sync-note">默认只同步课程进度和测验得分。计算器可能包含个人金额，建议确认后再开启。</p>
      <div class="sync-actions">
        <button class="secondary-button" type="button" id="syncPullButton">拉取云端</button>
        <button class="secondary-button" type="button" id="syncPushButton">立即保存</button>
        <button class="secondary-button" type="button" id="syncLogoutButton">退出</button>
      </div>
      <div class="sync-meta">
        ${syncState.saving ? "正在保存..." : `上次保存：${formatTime(syncState.lastSavedAt)}`}
      </div>
      ${syncState.message ? `<div class="sync-message">${escapeHtml(syncState.message)}</div>` : ""}
      ${syncState.error ? `<div class="sync-error">${escapeHtml(syncState.error)}</div>` : ""}
    `;
    bindSignedInControls();
  }

  function bindLoginForm() {
    const form = document.querySelector("#syncLoginForm");
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.querySelector("#syncEmail")?.value.trim();
      if (!email) return;
      await sendMagicLink(email);
    });
  }

  function bindSignedInControls() {
    document.querySelector("#syncCalculators")?.addEventListener("change", (event) => {
      syncState.syncCalculators = event.target.checked;
      localStorage.setItem("investmentCourse.syncCalculators", String(syncState.syncCalculators));
      scheduleSave();
      render();
    });

    document.querySelector("#syncPullButton")?.addEventListener("click", pullProgress);
    document.querySelector("#syncPushButton")?.addEventListener("click", () => saveProgress({ immediate: true }));
    document.querySelector("#syncLogoutButton")?.addEventListener("click", signOut);
  }

  async function sendMagicLink(email) {
    syncState.error = "";
    syncState.message = "";
    render();
    const { error } = await syncState.client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.href.split("#")[0]
      }
    });
    syncState.error = error ? error.message : "";
    syncState.message = error ? "" : "登录链接已发送，请检查邮箱。";
    render();
  }

  async function signOut() {
    await syncState.client.auth.signOut();
    syncState.user = null;
    syncState.message = "";
    render();
  }

  async function pullProgress() {
    if (!syncState.client || !syncState.user) return;
    syncState.loading = true;
    syncState.error = "";
    syncState.message = "";
    render();

    const { data, error } = await syncState.client
      .from(TABLE_NAME)
      .select("*")
      .eq("user_id", syncState.user.id)
      .maybeSingle();

    syncState.loading = false;
    if (error) {
      syncState.error = error.message;
      render();
      return;
    }

    if (data) {
      syncState.syncCalculators = Boolean(data.sync_calculators);
      localStorage.setItem("investmentCourse.syncCalculators", String(syncState.syncCalculators));
      applySnapshot(rowToSnapshot(data));
      syncState.lastSavedAt = data.updated_at;
      syncState.message = "已拉取云端进度。";
    } else {
      await saveProgress({ immediate: true });
    }
    render();
  }

  function scheduleSave() {
    if (!syncState.client || !syncState.user) return;
    clearTimeout(syncState.saveTimer);
    syncState.saveTimer = setTimeout(() => {
      saveProgress({ immediate: true });
    }, SAVE_DELAY_MS);
  }

  async function saveProgress({ immediate = false } = {}) {
    if (!syncState.client || !syncState.user) return;
    if (!immediate) {
      scheduleSave();
      return;
    }

    const row = buildProgressRow();
    if (!row) return;
    syncState.saving = true;
    syncState.error = "";
    syncState.message = "";
    render();

    const { error } = await syncState.client
      .from(TABLE_NAME)
      .upsert(row, { onConflict: "user_id" });

    syncState.saving = false;
    if (error) {
      syncState.error = error.message;
    } else {
      syncState.lastSavedAt = row.updated_at;
      syncState.message = "已保存到云端。";
    }
    render();
  }

  async function init() {
    const config = getConfig();
    syncState.configured = isConfigured(config);

    if (!syncState.configured) {
      render();
      return;
    }

    syncState.client = window.supabase.createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });

    const { data } = await syncState.client.auth.getSession();
    syncState.user = data.session?.user || null;

    syncState.client.auth.onAuthStateChange(async (_event, session) => {
      syncState.user = session?.user || null;
      if (syncState.user) await pullProgress();
      render();
    });

    if (syncState.user) {
      await pullProgress();
    } else {
      render();
    }
  }

  window.InvestmentCourseSync = {
    init,
    scheduleSave,
    saveProgress,
    render
  };
})();
