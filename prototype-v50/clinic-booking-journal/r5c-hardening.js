function r5cHardenSurface() {
  const surface = document.getElementById("r5c-surface"),
    booking = surface?.querySelector(".r5c-booking,.r5c-result");
  if (!booking) return;
  const role = r5cRole();
  let marker = booking.querySelector(".vh-role-context");
  if (["admin", "multi-role"].includes(role.role)) {
    if (!marker) {
      marker = document.createElement("span");
      marker.className = "vh-role-context";
      booking
        .querySelector("header>div,h1")
        ?.insertAdjacentElement("beforebegin", marker);
    }
    const label =
      role.role === "admin" ? "Режим: Управление" : "Режим: Ресепшен";
    if (marker.textContent !== label) marker.textContent = label;
  } else marker?.remove();
  if (
    r5c.phase === "terminal-error" &&
    !booking.querySelector("[data-r5c-terminal]")
  ) {
    const alert = document.createElement("section");
    alert.className = "r5c-alert";
    alert.dataset.r5cTerminal = "true";
    alert.setAttribute("role", "alert");
    alert.innerHTML =
      '<h2>Не удалось создать запись</h2><p>Черновик сохранён. Проверьте соединение и повторите отправку.</p><button data-r5c-action="retry">Повторить</button>';
    booking
      .querySelector(".r5c-context")
      ?.insertAdjacentElement("afterend", alert);
  }
  if (innerWidth >= 600 && !booking.querySelector(".r5c-shortcuts")) {
    const hint = document.createElement("p");
    hint.className = "r5c-shortcuts";
    hint.textContent =
      "Подсказки: N — новая запись · / — поиск · Esc — закрыть · Ctrl/⌘+Enter — создать";
    booking.append(hint);
  }
}
function r5cContextEntries() {
  const canCreate = r5cCanCreate();
  document.querySelectorAll("[data-r5c-context-entry]").forEach((node) => {
    if (!canCreate) node.remove();
  });
  if (!canCreate) return;
  if (appState.state === "mobile-client-detail") {
    const existing = [...document.querySelectorAll("#mobile-crm button")].find(
      (button) => button.textContent.trim() === "Новая запись",
    );
    if (existing && !existing.hasAttribute("data-r5c-book-client")) {
      existing.setAttribute("data-r5c-book-client", "true");
      existing.dataset.r5cContextEntry = "true";
      existing.dataset.r5cOwner = "Анна Ковалева";
      existing.dataset.r5cPet = "";
    }
  }
  const add = (root, kind, label) => {
    if (!root || root.querySelector(`[data-r5c-book-${kind}]`)) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button";
    button.setAttribute(`data-r5c-book-${kind}`, "true");
    button.dataset.r5cContextEntry = "true";
    button.textContent = label;
    root.append(button);
  };
  add(
    document.querySelector(
      ".vh-request-detail,.mobile-request-detail,[data-visual-id=request-detail]",
    ),
    "request",
    "Создать запись по заявке",
  );
  add(
    document.querySelector(
      ".mobile-client-detail,.vh-client-detail,[data-visual-id=client-detail]",
    ),
    "client",
    "Создать запись клиенту",
  );
}
const r5cHardeningSurface = r5cSurface();
new MutationObserver(() => queueMicrotask(r5cHardenSurface)).observe(
  r5cHardeningSurface,
  { childList: true, subtree: true },
);
new MutationObserver(() => queueMicrotask(r5cContextEntries)).observe(
  document.body,
  { childList: true, subtree: true },
);
if (
  new URLSearchParams(location.search).get("state") ===
  "manual-booking-readonly-denied"
) {
  r5c.draft = r5cNewDraft("global");
  r5c.phase = "forbidden";
  r5cRender();
}
r5cHardenSurface();
r5cContextEntries();
