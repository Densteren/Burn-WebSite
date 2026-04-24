import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const defaultBarrelItems = [
  { id: "", name: "Пусто", likes: 0 },
  { id: "apple", name: "Яблоко", likes: 0 },
  { id: "diamond", name: "Алмаз", likes: 0 },
  { id: "map", name: "Map Art", likes: 0 }
];

function readAuth() {
  return {
    token: localStorage.getItem("token") || "",
    username: localStorage.getItem("username") || "",
    rights: localStorage.getItem("rights") || "",
    isSO: localStorage.getItem("isSO") === "true"
  };
}

function Modal({ open, title, children, onClose, wide = false }) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal show" onClick={onClose}>
      <div
        className={`modal-content${wide ? " modal-content-wide" : ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="close-modal" type="button" onClick={onClose}>
          x
        </button>
        {title ? <h3>{title}</h3> : null}
        {children}
      </div>
    </div>
  );
}

function App() {
  const [auth, setAuth] = useState(readAuth);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [stallSection, setStallSection] = useState("barrels");
  const [modal, setModal] = useState(null);
  const [messageModal, setMessageModal] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [barrels, setBarrels] = useState([]);
  const [selectedBarrel, setSelectedBarrel] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [items, setItems] = useState(defaultBarrelItems);
  const [toasts, setToasts] = useState([]);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    rights: ""
  });
  const [loginHint, setLoginHint] = useState({ type: "", text: "" });
  const [registerHint, setRegisterHint] = useState({ type: "", text: "" });
  const [registerChecking, setRegisterChecking] = useState(false);
  const toastIdRef = useRef(0);
  const registerCheckTimeoutRef = useRef(null);

  const isLoggedIn = Boolean(auth.token);
  const isStallOwner = auth.rights === "STALL_OWNER";
  const isMarketManager = auth.rights === "MARKET_MANAGER";
  const isTester = auth.rights === "TESTER";
  const isMarketOwner = auth.rights === "MARKET_OWNER";
  const isDeveloper = auth.rights === "DEVELOPER";

  function showToast(text, duration = 3000) {
    const id = toastIdRef.current++;
    setToasts((current) => [...current, { id, text, duration }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, duration);
  }

  function openMessage(message) {
    setMessageModal(message);
    setModal("message");
  }

  async function fetchJson(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, options);
    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = new Error(data?.message || `Request failed: ${response.status}`);
      error.response = response;
      error.data = data;
      throw error;
    }

    return data;
  }

  const loadRecommended = useCallback(async () => {
    setSearchLoading(true);
    try {
      const data = await fetchJson("/search/recommended");
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      openMessage(error.message || "Не удалось загрузить рекомендации.");
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const loadBarrels = useCallback(async () => {
    if (!auth.token) {
      return;
    }

    try {
      const data = await fetchJson("/barrels", {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      });
      setBarrels(Array.isArray(data) ? data : []);
      setActiveTab("stall");
    } catch (error) {
      openMessage(error.message || "Не удалось загрузить бочки.");
    }
  }, [auth.token]);

  const loadItems = useCallback(async () => {
    try {
      const data = await fetchJson("/search/recommended");
      if (Array.isArray(data) && data.length > 0) {
        setItems([{ id: "", name: "Пусто", likes: 0 }, ...data]);
      } else {
        setItems(defaultBarrelItems);
      }
    } catch {
      setItems(defaultBarrelItems);
    }
  }, []);

  useEffect(() => {
    loadRecommended();
  }, [loadRecommended]);

  useEffect(() => {
    localStorage.setItem("token", auth.token || "");
    localStorage.setItem("username", auth.username || "");
    localStorage.setItem("rights", auth.rights || "");
    localStorage.setItem("isSO", String(Boolean(auth.isSO)));

    if (!auth.token) {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("rights");
      localStorage.removeItem("isSO");
      setBarrels([]);
      if (activeTab === "stall") {
        setActiveTab("search");
      }
      return;
    }

    if (auth.isSO) {
      loadBarrels();
    }
  }, [activeTab, auth, loadBarrels]);

  useEffect(() => {
    if (modal === "barrel") {
      loadItems();
    }
  }, [loadItems, modal]);

  useEffect(() => {
    if (registerCheckTimeoutRef.current) {
      window.clearTimeout(registerCheckTimeoutRef.current);
    }

    const { username, password, rights } = registerForm;

    if (!username && !password && !rights) {
      setRegisterHint({ type: "", text: "" });
      return undefined;
    }

    if (!username) {
      setRegisterHint({ type: "error", text: "Введите логин." });
      return undefined;
    }

    if (!password) {
      setRegisterHint({ type: "error", text: "Введите пароль." });
      return undefined;
    }

    if (password.length < 8) {
      setRegisterHint({ type: "error", text: "Пароль слишком короткий. Минимум 8 символов." });
      return undefined;
    }

    if (password.length > 16) {
      setRegisterHint({ type: "error", text: "Пароль слишком длинный. Максимум 16 символов." });
      return undefined;
    }

    if (!rights) {
      setRegisterHint({ type: "error", text: "Выберите роль." });
      return undefined;
    }

    setRegisterHint({ type: "success", text: "Проверяем логин..." });
    setRegisterChecking(true);

    registerCheckTimeoutRef.current = window.setTimeout(async () => {
      try {
        const data = await fetchJson(`/user/check?username=${encodeURIComponent(username)}`);
        if (data.exists) {
          setRegisterHint({ type: "error", text: "Этот логин уже занят." });
        } else {
          setRegisterHint({ type: "success", text: "Можно создавать пользователя." });
        }
      } catch {
        setRegisterHint({ type: "error", text: "Не удалось проверить логин." });
      } finally {
        setRegisterChecking(false);
      }
    }, 400);

    return () => {
      if (registerCheckTimeoutRef.current) {
        window.clearTimeout(registerCheckTimeoutRef.current);
      }
    };
  }, [registerForm]);

  useEffect(() => {
    const { username, password } = loginForm;
    if (!username && !password) {
      setLoginHint({ type: "", text: "" });
      return;
    }

    if (!username) {
      setLoginHint({ type: "error", text: "Введите логин." });
      return;
    }

    if (!password) {
      setLoginHint({ type: "error", text: "Введите пароль." });
      return;
    }

    setLoginHint({ type: "success", text: "Можно входить." });
  }, [loginForm]);

  function closeSidebar() {
    setSidebarOpen(false);
  }

  function showTab(tab) {
    setActiveTab(tab);
    setSidebarOpen(false);
  }

  function openBarrel(barrel) {
    setSelectedBarrel(barrel);
    setSelectedItemId(barrel?.item?.id || "");
    setModal("barrel");
  }

  async function handleSearch() {
    setSearchLoading(true);
    try {
      const path = searchQuery.trim()
        ? `/search?search=${encodeURIComponent(searchQuery.trim())}`
        : "/search/recommended";
      const data = await fetchJson(path);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (error) {
      openMessage(error.message || "Ошибка поиска.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleLogin() {
    try {
      const data = await fetchJson("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm)
      });

      setAuth({
        token: data.token || "",
        username: data.username || "",
        rights: data.rights || "",
        isSO: Boolean(data.isSO)
      });
      setModal(null);
      showToast(`Успешный вход: ${data.username}`);
    } catch (error) {
      openMessage(error.message || "Ошибка входа.");
    }
  }

  async function handleRegister() {
    if (registerChecking || registerHint.type === "error") {
      return;
    }

    try {
      const data = await fetchJson("/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: registerForm.username,
          password: registerForm.password,
          rights: registerForm.rights
        })
      });
      showToast(`Пользователь ${data.username} добавлен.`);
      setRegisterForm({ username: "", password: "", rights: "" });
      setModal(null);
    } catch (error) {
      openMessage(error.message || "Ошибка регистрации.");
    }
  }

  function handleLogout() {
    const username = auth.username;
    setAuth({ token: "", username: "", rights: "", isSO: false });
    showToast(`Вы вышли из аккаунта ${username}`);
  }

  async function handleSaveBarrel() {
    if (!selectedBarrel) {
      return;
    }

    try {
      await fetchJson(`/barrels/${selectedBarrel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: selectedItemId || null })
      });
      showToast("Бочка обновлена.");
      setModal(null);
      await loadBarrels();
    } catch (error) {
      openMessage(error.message || "Не удалось обновить бочку.");
    }
  }

  const registerAllowed =
    registerForm.rights &&
    registerHint.type === "success" &&
    !registerChecking;

  const loginAllowed =
    loginForm.username.trim().length > 0 &&
    loginForm.password.length > 0;

  const canSeeLevel1 = isStallOwner || isMarketManager || isTester || isMarketOwner || isDeveloper;
  const canSeeLevel2 = isMarketManager || isTester || isMarketOwner || isDeveloper;
  const canSeeLevel4 = isDeveloper;

  return (
    <div className="app-shell">
      <div className={`overlay${sidebarOpen ? " show" : ""}`} onClick={closeSidebar} />

      <header className="header">
        <button className="burger" type="button" onClick={() => setSidebarOpen((open) => !open)}>
          ≡
        </button>

        <div className="header-right">
          <span className="username-display">{isLoggedIn ? auth.username : ""}</span>
          {isLoggedIn ? (
            <button className="icon-button" type="button" onClick={handleLogout} title="Выйти">
              Выйти
            </button>
          ) : null}
        </div>

        {!isLoggedIn ? (
          <button type="button" onClick={() => setModal("login")}>
            Войти
          </button>
        ) : null}
      </header>

      <aside className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <button className="close-sidebar" type="button" onClick={closeSidebar}>
          x
        </button>
        <button type="button" onClick={() => showTab("search")}>
          Поиск
        </button>
        <button type="button" onClick={() => showTab("map")}>
          Карта
        </button>
        {canSeeLevel1 ? (
          <button type="button" onClick={() => showTab("stall")}>
            Моя палатка
          </button>
        ) : null}
        {canSeeLevel2 ? (
          <button type="button" onClick={() => setModal("register")}>
            Добавить владельца
          </button>
        ) : null}
        {canSeeLevel4 ? (
          <button type="button" onClick={() => showTab("logs")}>
            Логи
          </button>
        ) : null}
        {canSeeLevel1 ? (
          <button id="logout-sb" type="button" onClick={handleLogout}>
            Выйти
          </button>
        ) : null}
      </aside>

      <main id="main">
        {activeTab === "search" ? (
          <section className="search-container card">
            <h2>Поиск</h2>
            <div className="search-row">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Введите название предмета"
              />
              <button type="button" onClick={handleSearch}>
                Искать
              </button>
            </div>
            {searchLoading ? <p className="muted-text">Загрузка...</p> : null}
            <ul className="search-results">
              {searchResults.map((item) => (
                <li key={item.id || item.name}>
                  <div className="result-name">{item.name}</div>
                  <div className="result-meta">
                    <span>Лайки: {item.likes ?? 0}</span>
                    <span>Дизлайки: {item.dislikes ?? 0}</span>
                    <span>Количество: {item.amount ?? item.quantity ?? 0}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {activeTab === "stall" ? (
          <section className="stall-container">
            <div className="left-menu">
              <button type="button" onClick={() => setStallSection("barrels")}>
                Бочки
              </button>
              <button type="button" onClick={() => setStallSection("stats")}>
                Статистика
              </button>
              <button type="button" onClick={() => setStallSection("settings")}>
                Настройки
              </button>
            </div>

            <div className="stall-main">
              <div className="stall-header">
                <div>#12</div>
                <div className="stall-title">Моя палатка</div>
                <div className="stall-user">{auth.username || "Гость"}</div>
              </div>

              <div className="stall-content">
                {stallSection === "barrels" ? (
                  <div className="section active">
                    <div className="barrel-top">
                      <button type="button" disabled>
                        Создать
                      </button>
                      <button type="button" disabled>
                        Редактировать
                      </button>
                      <button type="button" disabled>
                        Удалить
                      </button>
                    </div>

                    <div className="barrel-grid">
                      {barrels.map((barrel) => (
                        <button
                          key={barrel.id}
                          type="button"
                          className="barrel"
                          onClick={() => openBarrel(barrel)}
                        >
                          {barrel.item?.name || "Пусто"}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {stallSection === "stats" ? (
                  <div className="section panel-note">Раздел статистики пока не подключен.</div>
                ) : null}

                {stallSection === "settings" ? (
                  <div className="section panel-note">Раздел настроек пока не подключен.</div>
                ) : null}
              </div>
            </div>

            <div className="right-info">
              <p>Баланс: 200 AR</p>
              <p>Платеж: 20.03</p>
              <p>До: 05.04</p>
              <button type="button" onClick={() => openMessage("Пополнение пока не реализовано.")}>
                Пополнить
              </button>
            </div>
          </section>
        ) : null}

        {activeTab === "map" ? <section className="card panel-note">Карта будет подключена отдельно.</section> : null}
        {activeTab === "logs" ? <section className="card panel-note">Логи пока не реализованы.</section> : null}
      </main>

      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast">
            <span>{toast.text}</span>
            <button
              className="toast-close"
              type="button"
              onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
            >
              x
            </button>
            <div
              className="toast-progress"
              style={{ animationDuration: `${toast.duration}ms` }}
            />
          </div>
        ))}
      </div>

      <Modal open={modal === "login"} title="Вы владелец палатки?" onClose={() => setModal(null)}>
        <p>Войдите в свой аккаунт, чтобы управлять товарами.</p>
        <form className="stacked-form" onSubmit={(event) => event.preventDefault()}>
          <input
            autoComplete="username"
            placeholder="логин"
            value={loginForm.username}
            onChange={(event) =>
              setLoginForm((current) => ({ ...current, username: event.target.value }))
            }
          />
          <input
            autoComplete="current-password"
            type="password"
            placeholder="пароль"
            value={loginForm.password}
            onChange={(event) =>
              setLoginForm((current) => ({ ...current, password: event.target.value }))
            }
          />
          {loginHint.text ? <div className={`hint ${loginHint.type}`}>{loginHint.text}</div> : null}
          <div className="modal-actions">
            <button type="button" disabled={!loginAllowed} onClick={handleLogin}>
              Войти
            </button>
            <button className="link-button" type="button" onClick={() => setModal("help")}>
              Нужна помощь?
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "help"} title="" onClose={() => setModal(null)}>
        <p>
          Обратитесь к разработчику сайта за помощью:{" "}
          <a href="https://discord.com/users/640069373108813824" target="_blank" rel="noreferrer">
            написать в Discord
          </a>
        </p>
        <button type="button" className="secondary-button" onClick={() => setModal("login")}>
          Назад
        </button>
      </Modal>

      <Modal open={modal === "register"} title="Добавить владельца палатки" onClose={() => setModal(null)}>
        <form className="stacked-form" onSubmit={(event) => event.preventDefault()}>
          <input
            placeholder="логин"
            value={registerForm.username}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, username: event.target.value }))
            }
          />
          <input
            type="password"
            placeholder="пароль"
            value={registerForm.password}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, password: event.target.value }))
            }
          />
          <select
            value={registerForm.rights}
            onChange={(event) =>
              setRegisterForm((current) => ({ ...current, rights: event.target.value }))
            }
          >
            <option value="">Выберите права</option>
            {canSeeLevel4 ? <option value="MARKET_OWNER">Владелец рынка</option> : null}
            {isDeveloper ? <option value="MARKET_MANAGER">Менеджер рынка</option> : null}
            <option value="STALL_OWNER">Владелец палатки</option>
            {canSeeLevel4 ? <option value="TESTER">Тестер</option> : null}
          </select>
          {registerHint.text ? (
            <div className={`hint ${registerHint.type}`}>{registerHint.text}</div>
          ) : null}
          <div className="modal-actions">
            <button type="button" disabled={!registerAllowed} onClick={handleRegister}>
              Добавить
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={modal === "barrel"} title="Бочка" onClose={() => setModal(null)}>
        {selectedBarrel ? (
          <div className="barrel-modal">
            <div className="barrel-info">
              <p>
                Координаты: <span>{selectedBarrel.xyz || "-"}</span>
              </p>
              <p>
                Предмет: <span>{selectedBarrel.item?.name || "Пусто"}</span>
              </p>
              <p>
                Изменено:{" "}
                <span>
                  {selectedBarrel.updatedAt
                    ? new Date(selectedBarrel.updatedAt).toLocaleString("ru-RU")
                    : "-"}
                </span>
              </p>
            </div>

            <div className="barrel-controls">
              <select value={selectedItemId} onChange={(event) => setSelectedItemId(event.target.value)}>
                {items.map((item) => (
                  <option key={item.id || "empty"} value={item.id}>
                    {item.name}
                    {item.likes ? ` (${item.likes})` : ""}
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleSaveBarrel}>
                Сохранить
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal open={modal === "message"} title="" onClose={() => setModal(null)}>
        <p>{messageModal}</p>
      </Modal>
    </div>
  );
}

export default App;
