const R5C_STATES = new Set([
  "manual-booking-global",
  "manual-booking-free-slot",
  "manual-booking-client-context",
  "manual-booking-request-context",
  "manual-booking-validation",
  "manual-booking-submitting",
  "manual-booking-success",
  "manual-booking-conflict",
  "manual-booking-terminal-error",
  "manual-booking-readonly-denied",
  "mobile-booking-step-client",
  "mobile-booking-step-schedule",
  "mobile-booking-step-review",
  "mobile-booking-conflict",
  "mobile-booking-success",
  "keyboard-booking-open",
  "keyboard-booking-return-focus",
  "reduced-motion-booking",
  "calendar-card-wide",
  "calendar-card-compact",
  "calendar-card-mobile",
  "calendar-free-slot",
  "calendar-overdue",
]);
const R5C_CONTEXTS = {
  global: {
    source: "global",
    sourceLabel: "Новая запись",
    lockedContext: { location: "VetHelp Садовая", date: "Сегодня" },
    prefilled: {
      owner: "",
      pet: "",
      service: "",
      comment: "",
      staff: "",
      time: "",
    },
    firstIncompleteField: "owner",
  },
  "free-slot": {
    source: "free-slot",
    sourceLabel: "Новая запись",
    description: "Создаём из свободного окна: 14:30, Анна Смирнова",
    lockedContext: {
      location: "VetHelp Садовая",
      date: "Сегодня",
      startTime: "14:30",
      veterinarian: "Анна Смирнова",
    },
    prefilled: {
      owner: "",
      pet: "",
      service: "",
      comment: "",
      staff: "Анна Смирнова",
      time: "14:30",
    },
    firstIncompleteField: "owner",
  },
  client: {
    source: "client",
    sourceLabel: "Новая запись для Ивана Петрова",
    lockedContext: { location: "VetHelp Садовая", date: "Сегодня" },
    prefilled: {
      owner: "Иван Петров",
      pet: "Барсик",
      service: "",
      comment: "",
      staff: "",
      time: "",
    },
    firstIncompleteField: "service",
  },
  request: {
    source: "request",
    sourceLabel: "Создаём запись по заявке владельца",
    lockedContext: {
      location: "VetHelp Садовая",
      date: "Сегодня",
      preferredTime: "12:00",
    },
    prefilled: {
      owner: "Анна Ковалева",
      pet: "Барсик",
      service: "Первичный приём терапевта",
      comment: "Первичный осмотр",
      staff: "",
      time: "12:00",
    },
    firstIncompleteField: "staff",
  },
};
const r5c = {
  draft: null,
  step: 1,
  phase: "idle",
  origin: null,
  commandLocked: false,
};
const r5cEsc = (value) =>
  String(value ?? "").replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
        char
      ],
  );
function r5cRole() {
  return (
    globalThis.VH_ROLE_PRESENTATION?.[appState.role] ||
    globalThis.VH_ROLE_PRESENTATION?.reception
  );
}
function r5cCanCreate() {
  return !!r5cRole()?.capabilities?.has("booking.create");
}
function r5cNewDraft(source) {
  const model = structuredClone(R5C_CONTEXTS[source] || R5C_CONTEXTS.global);
  return {
    ...model,
    id: `draft-${source}`,
    duration: "30 минут",
    price: "1 500 ₽",
    valid: false,
    errors: [],
  };
}
function r5cStateSource(state) {
  if (state.includes("free-slot") || state === "reduced-motion-booking")
    return "free-slot";
  if (state.includes("client-context")) return "client";
  if (state.includes("request-context") || state.includes("conflict"))
    return "request";
  return "global";
}
function r5cPhase(state) {
  if (state.includes("validation")) return "validation-error";
  if (state.includes("submitting")) return "submitting";
  if (state.includes("success")) return "readback-success";
  if (state.includes("conflict")) return "retryable-conflict";
  if (state.includes("terminal-error")) return "terminal-error";
  if (state.includes("readonly-denied")) return "forbidden";
  return state.includes("context") || state.includes("free-slot")
    ? "prefilled"
    : "idle";
}
function r5cContextSummary(draft) {
  const value =
    draft.source === "free-slot"
      ? `<strong>Свободное окно</strong><span>${draft.lockedContext.date} · ${draft.prefilled.time}</span><span>${draft.prefilled.staff}</span>`
      : draft.source === "client"
        ? `<strong>${draft.prefilled.owner}</strong><span>${draft.prefilled.pet}</span>`
        : draft.source === "request"
          ? `<strong>По заявке владельца</strong><span>${draft.prefilled.owner} · ${draft.prefilled.pet}</span><span>Желаемое время: сегодня, ${draft.prefilled.time}</span>`
          : `<strong>Текущий контекст</strong><span>${draft.lockedContext.location} · ${draft.lockedContext.date}</span>`;
  return `<aside class="r5c-context" aria-label="Контекст создания записи">${value}</aside>`;
}
function r5cProgress(step) {
  return `<div class="r5c-progress" aria-label="Шаг ${step} из 3"><strong>Шаг ${step} из 3</strong><span>${["Клиент", "Расписание", "Проверка"][step - 1]}</span></div>`;
}
function r5cClient(draft) {
  if (draft.prefilled.owner && draft.prefilled.pet)
    return `<section class="r5c-section is-filled" aria-label="Клиент и питомец, заполнено"><header><div><h2>Клиент и питомец</h2><p>${r5cEsc(draft.prefilled.owner)} · ${r5cEsc(draft.prefilled.pet)}</p></div><button data-r5c-action="edit-client">Изменить</button></header></section>`;
  return `<section class="r5c-section" aria-label="Клиент и питомец, требуется заполнить"><h2>Клиент и питомец</h2><label>Найти клиента<input data-r5c-field="owner" required value="${r5cEsc(draft.prefilled.owner)}" autocomplete="off" aria-describedby="owner-help owner-error"></label><small id="owner-help">Введите имя или телефон</small><p id="owner-error" class="r5c-error" ${draft.errors.includes("owner") ? "" : "hidden"}>Выберите клиента</p><div class="r5c-inline-results"><button data-r5c-action="select-client">Иван Петров · Барсик</button><button data-r5c-action="select-client-multi">Анна Ковалева · выбрать питомца</button></div>${draft.prefilled.owner ? `<label>Питомец<select data-r5c-field="pet" required><option value="">Выберите питомца</option><option ${draft.prefilled.pet === "Барсик" ? "selected" : ""}>Барсик</option><option>Луна</option></select></label><p class="r5c-error" ${draft.errors.includes("pet") ? "" : "hidden"}>Выберите питомца</p>` : ""}</section>`;
}
function r5cSchedule(draft) {
  const locked = draft.source === "free-slot";
  return `<section class="r5c-section" aria-label="Услуга и специалист, ${draft.prefilled.service && draft.prefilled.staff ? "заполнено" : "требуется заполнить"}"><h2>Услуга и специалист</h2><label>Услуга<select data-r5c-field="service" required><option value="">Выберите услугу</option><option ${draft.prefilled.service ? "selected" : ""}>${r5cEsc(draft.prefilled.service || "Первичный приём терапевта")}</option><option>Вакцинация</option></select></label><p class="r5c-error" ${draft.errors.includes("service") ? "" : "hidden"}>Выберите услугу</p><div class="r5c-suggestions"><span>Продолжительность <strong>${draft.duration}</strong></span><span>Стоимость <strong>${draft.price}</strong><small>По настройкам услуги</small></span></div><label>Врач<select data-r5c-field="staff" required><option value="">Выберите врача</option><option ${draft.prefilled.staff ? "selected" : ""}>${r5cEsc(draft.prefilled.staff || "Анна Смирнова")}</option><option>Илья Петров</option></select></label>${locked ? "<small>Предзаполнено из свободного окна; можно изменить явно</small>" : ""}</section><section class="r5c-section" aria-label="Дата и время, ${draft.prefilled.time ? "заполнено" : "требуется заполнить"}"><h2>Дата и время</h2><label>Дата и время<input data-r5c-field="time" required value="${r5cEsc(draft.prefilled.time)}" aria-label="Дата и время"></label><p class="r5c-error" ${draft.errors.includes("time") ? "" : "hidden"}>Выберите доступное время</p></section>`;
}
function r5cReview(draft) {
  return `<section class="r5c-review"><h2>Комментарий и итог</h2><label>Комментарий<textarea data-r5c-field="comment">${r5cEsc(draft.prefilled.comment)}</textarea></label><h3>Проверьте запись</h3><dl>${[
    ["Клиент", draft.prefilled.owner],
    ["Питомец", draft.prefilled.pet],
    ["Услуга", draft.prefilled.service],
    ["Врач", draft.prefilled.staff],
    ["Дата и время", `Сегодня · ${draft.prefilled.time || "Не выбрано"}`],
    ["Продолжительность", draft.duration],
    ["Стоимость", draft.price],
    ["Комментарий", draft.prefilled.comment || "Нет"],
  ]
    .map(
      ([key, value]) =>
        `<div><dt>${key}</dt><dd>${r5cEsc(value || "Не выбрано")}</dd></div>`,
    )
    .join("")}</dl></section>`;
}
function r5cSurface() {
  let node = document.getElementById("r5c-surface");
  if (!node) {
    node = document.createElement("div");
    node.id = "r5c-surface";
    document.body.append(node);
  }
  return node;
}
function r5cStepComplete(draft, step = r5c.step) {
  if (step === 1) return Boolean(draft.prefilled.owner && draft.prefilled.pet);
  if (step === 2)
    return Boolean(
      draft.prefilled.service && draft.prefilled.staff && draft.prefilled.time,
    );
  return r5cValidate(false);
}
function r5cBookingMarkup({ draft, mobile, conflict, submitting, successAck }) {
  const disabled =
    submitting || successAck || (mobile && !r5cStepComplete(draft));
  const body = mobile
    ? r5c.step === 1
      ? r5cClient(draft)
      : r5c.step === 2
        ? r5cSchedule(draft)
        : r5cReview(draft)
    : `${r5cClient(draft)}${r5cSchedule(draft)}${r5cReview(draft)}`;
  const progress = successAck
    ? '<section class="r5c-alert" role="status" data-booking-state="success-ack"><h2>Действие принято</h2><p>Обновляем статус…</p></section>'
    : "";
  const validation =
    r5c.phase === "validation-error" && draft.errors.length > 1
      ? `<div class="r5c-error-summary" role="alert" tabindex="-1"><strong>Заполните обязательные поля</strong><span>${draft.errors.length} поля требуют внимания</span></div>`
      : "";
  const help =
    mobile && disabled && !submitting && !successAck
      ? '<small id="r5c-continue-help">Заполните обязательные данные этого шага</small>'
      : "";
  return `<div class="r5c-backdrop"></div><section class="r5c-booking" role="dialog" aria-modal="true" aria-labelledby="r5c-title" data-booking-state="${r5c.phase}" data-source="${draft.source}" data-step="${r5c.step}"><header><button data-r5c-action="${mobile && r5c.step > 1 ? "back" : "close"}" aria-label="${mobile && r5c.step > 1 ? "Назад" : "Закрыть создание записи"}">${mobile && r5c.step > 1 ? "← Назад" : "×"}</button><div>${mobile ? r5cProgress(r5c.step) : ""}<h1 id="r5c-title" tabindex="-1">${draft.sourceLabel}</h1>${draft.description ? `<p>${draft.description}</p>` : ""}</div></header>${r5cContextSummary(draft)}${conflict ? '<section class="r5c-alert" role="alert"><h2>Выбранное время только что заняли</h2><p>Данные клиента и услуги сохранены. Выберите другое свободное время.</p><button data-r5c-action="resolve-conflict">Выбрать время</button></section>' : ""}${progress}${body}${validation}<footer>${mobile && r5c.step > 1 ? '<button data-r5c-action="back">Назад</button>' : '<button data-r5c-action="close">Отмена</button>'}<div>${help}<button class="r5c-primary" data-r5c-action="${mobile && r5c.step < 3 ? "continue" : "submit"}" ${disabled ? `disabled${submitting || successAck ? ' aria-busy="true"' : ' aria-describedby="r5c-continue-help"'}` : ""}>${submitting ? "Создаём…" : successAck ? "Обновляем статус…" : mobile && r5c.step < 3 ? "Продолжить" : "Создать запись"}</button></div></footer></section>`;
}
function r5cRender({ focus = true, focusTarget = null } = {}) {
  const node = r5cSurface(),
    draft = r5c.draft;
  if (!draft) {
    node.replaceChildren();
    document.body.classList.remove("r5c-active");
    return;
  }
  document.body.classList.add("r5c-active");
  const mobile = innerWidth < 600,
    success = r5c.phase === "readback-success",
    successAck = r5c.phase === "success-ack",
    submitting = r5c.phase === "submitting",
    conflict = r5c.phase === "retryable-conflict",
    forbidden = r5c.phase === "forbidden" || !r5cCanCreate();
  if (success || forbidden) {
    node.innerHTML = `<div class="r5c-backdrop"></div><section class="r5c-result" data-booking-state="${success ? "readback-success" : "forbidden"}" tabindex="-1"><span aria-hidden="true">${success ? "✓" : "!"}</span><h1>${success ? "Запись создана" : "Создание записи недоступно"}</h1><p>${success ? "Действие принято. Статус обновлён после authoritative readback presentation." : "Врач может просматривать только назначенные визиты."}</p>${success ? `<strong>Сегодня · ${r5cEsc(draft.prefilled.time || "14:30")} · ${r5cEsc(draft.prefilled.pet || "Барсик")}</strong>` : ""}<button data-r5c-action="close">Вернуться в журнал</button><p class="sr-only" aria-live="polite">${success ? "Запись создана" : ""}</p></section>`;
  } else
    node.innerHTML = r5cBookingMarkup({
      draft,
      mobile,
      conflict,
      submitting,
      successAck,
    });
  if (focus)
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        node
          .querySelector(
            focusTarget ||
              (success || forbidden
                ? '[tabindex="-1"]'
                : draft.firstIncompleteField
                  ? `[data-r5c-field="${draft.firstIncompleteField}"]`
                  : "#r5c-title"),
          )
          ?.focus(),
      ),
    );
}
function r5cOpen(source, trigger, state = "") {
  if (!r5cCanCreate() && source !== "forbidden") return;
  r5c.origin = trigger || document.activeElement;
  r5c.draft = r5cNewDraft(source);
  if (source === "client" && trigger?.dataset.r5cOwner) {
    r5c.draft.prefilled.owner = trigger.dataset.r5cOwner;
    r5c.draft.prefilled.pet = trigger.dataset.r5cPet || "";
    r5c.draft.sourceLabel =
      trigger.dataset.r5cOwner === "Анна Ковалева"
        ? "Новая запись для Анны Ковалевой"
        : `Новая запись для ${trigger.dataset.r5cOwner}`;
    r5c.draft.firstIncompleteField = r5c.draft.prefilled.pet
      ? "service"
      : "pet";
  }
  r5c.step = 1;
  r5c.phase = state
    ? r5cPhase(state)
    : source === "global"
      ? "idle"
      : "prefilled";
  if (state.includes("validation")) {
    r5c.draft.errors = ["owner", "service"];
  }
  if (
    state.includes("submitting") ||
    state.includes("success") ||
    state.includes("terminal-error") ||
    state.includes("step-review")
  ) {
    Object.assign(r5c.draft.prefilled, {
      owner: "Иван Петров",
      pet: "Барсик",
      service: "Вакцинация",
      staff: "Анна Смирнова",
      time: "14:30",
    });
    r5c.step = 3;
  } else if (state.includes("step-schedule")) {
    Object.assign(r5c.draft.prefilled, { owner: "Иван Петров", pet: "Барсик" });
    r5c.step = 2;
  }
  if (
    innerWidth < 600 &&
    !state.includes("step-") &&
    ["service", "staff", "time"].includes(r5c.draft.firstIncompleteField)
  )
    r5c.step = 2;
  r5cRender();
}
function r5cValidate(update = true) {
  const errors = ["owner", "pet", "service", "staff", "time"].filter(
    (key) => !r5c.draft.prefilled[key],
  );
  if (update) {
    r5c.draft.errors = errors;
    r5c.draft.firstIncompleteField = errors[0] || null;
  }
  return !errors.length;
}
function r5cSyncPrimary() {
  if (!r5c.draft || innerWidth >= 600) return;
  const button = r5cSurface().querySelector(".r5c-primary");
  if (!button || ["submitting", "success-ack"].includes(r5c.phase)) return;
  const disabled = !r5cStepComplete(r5c.draft);
  button.disabled = disabled;
  if (disabled) button.setAttribute("aria-describedby", "r5c-continue-help");
  else button.removeAttribute("aria-describedby");
}
function r5cClose() {
  const origin = r5c.origin;
  r5c.draft = null;
  r5c.phase = "idle";
  r5c.commandLocked = false;
  r5cRender({ focus: false });
  requestAnimationFrame(() => origin?.isConnected && origin.focus());
}
function r5cDecorate() {
  document
    .querySelectorAll(
      ".entry[data-kind],.agenda-card[data-kind],.m-agenda-row[data-kind],.vh-record",
    )
    .forEach((card) => {
      if (card.dataset.r5cCard) return;
      card.dataset.r5cCard = "true";
      card.setAttribute(
        "aria-label",
        `${card.textContent.replace(/\s+/g, " ").trim()}, открыть запись`,
      );
    });
  document.querySelectorAll(".free-slot,.week-free").forEach((slot) => {
    if (slot.dataset.r5cSlot) return;
    slot.dataset.r5cSlot = "true";
    slot.setAttribute(
      "aria-label",
      `${slot.dataset.time || "14:30"}, свободное окно у ${slot.dataset.staff || "Анна Смирнова"}, создать запись`,
    );
  });
}
document.addEventListener(
  "click",
  (event) => {
    const action = event.target.closest("[data-r5c-action]");
    if (action) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const name = action.dataset.r5cAction;
      if (name === "close") r5cClose();
      else if (name === "back") {
        r5c.step = Math.max(1, r5c.step - 1);
        r5cRender({ focusTarget: "#r5c-title" });
      } else if (name === "continue") {
        if (
          r5c.step === 1 &&
          (!r5c.draft.prefilled.owner || !r5c.draft.prefilled.pet)
        ) {
          r5cValidate();
          r5c.phase = "validation-error";
        } else r5c.step = Math.min(3, r5c.step + 1);
        r5cRender();
      } else if (name === "select-client") {
        Object.assign(r5c.draft.prefilled, {
          owner: "Иван Петров",
          pet: "Барсик",
        });
        r5c.draft.firstIncompleteField = "service";
        r5cRender();
      } else if (name === "select-client-multi") {
        Object.assign(r5c.draft.prefilled, { owner: "Анна Ковалева", pet: "" });
        r5c.draft.firstIncompleteField = "pet";
        r5cRender();
      } else if (name === "edit-client") {
        Object.assign(r5c.draft.prefilled, { owner: "", pet: "" });
        r5c.draft.firstIncompleteField = "owner";
        r5cRender();
      } else if (name === "resolve-conflict") {
        r5c.phase = "partially-complete";
        r5c.step = 2;
        r5c.draft.prefilled.time = "14:30";
        r5cRender();
      } else if (name === "retry") {
        r5c.phase = "partially-complete";
        r5cRender();
      } else if (name === "submit") {
        if (r5c.commandLocked) return;
        if (!r5cValidate()) {
          r5c.phase = "validation-error";
          r5cRender();
          return;
        }
        r5c.commandLocked = true;
        r5c.phase = "submitting";
        r5cRender({ focus: false });
        requestAnimationFrame(() => {
          r5c.phase = "success-ack";
          r5cRender({ focus: false });
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              r5c.phase = "readback-success";
              r5c.commandLocked = false;
              r5cRender();
            }),
          );
        });
      }
      return;
    }
    const slot = event.target.closest(".free-slot,.week-free,[data-r5c-slot]");
    if (slot && r5cCanCreate()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      r5cOpen("free-slot", slot);
      return;
    }
    const request = event.target.closest("[data-r5c-book-request]");
    if (request) {
      r5cOpen("request", request);
      return;
    }
    const client = event.target.closest("[data-r5c-book-client]");
    if (client) {
      r5cOpen("client", client);
      return;
    }
    const globalCreate = event.target.closest(
      '[data-action="manual-booking"],[data-mobile-go="mobile-booking-step-client"],[aria-label="Новая запись"]',
    );
    if (globalCreate && r5cCanCreate()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      r5cOpen("global", globalCreate);
    }
  },
  true,
);
document.addEventListener("input", (event) => {
  const field = event.target.closest("[data-r5c-field]");
  if (field && r5c.draft) {
    r5c.draft.prefilled[field.dataset.r5cField] = field.value;
    r5cSyncPrimary();
  }
});
document.addEventListener("change", (event) => {
  const field = event.target.closest("[data-r5c-field]");
  if (!field || !r5c.draft) return;
  r5c.draft.prefilled[field.dataset.r5cField] = field.value;
  if (field.dataset.r5cField === "service" && !r5c.draft.prefilled.staff)
    r5c.draft.prefilled.staff = "Анна Смирнова";
  r5cSyncPrimary();
});
window.addEventListener(
  "keydown",
  (event) => {
    const typing = event.target.matches?.(
      'input,textarea,select,[contenteditable="true"]',
    );
    if (r5c.draft) {
      const focusables = [
        ...r5cSurface().querySelectorAll(
          'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
        ),
      ].filter((node) => node.offsetParent !== null);
      if (event.key === "Tab" && focusables.length) {
        const first = focusables[0],
          last = focusables.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        r5cClose();
      } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        if ((innerWidth >= 600 || r5c.step === 3) && !r5c.commandLocked)
          r5cSurface().querySelector('[data-r5c-action="submit"]')?.click();
      }
      return;
    }
    if (typing) return;
    if (event.key === "/") {
      event.preventDefault();
      const input = document.querySelector(
        '#vh-search-input,#search-input,[type="search"]',
      );
      if (input && input.offsetParent !== null) input.focus();
      else
        document
          .querySelector(
            '[data-r4-go="mobile-calendar-search"],[data-action="open-search"]',
          )
          ?.click();
    } else if (event.key.toLowerCase() === "n" && r5cCanCreate()) {
      event.preventDefault();
      const trigger = [
        ...document.querySelectorAll(
          '[data-action="manual-booking"],[aria-label="Новая запись"]',
        ),
      ].find((node) => node.offsetParent !== null);
      r5cOpen("global", trigger || document.activeElement);
    }
  },
  true,
);
new MutationObserver(() => queueMicrotask(r5cDecorate)).observe(document.body, {
  childList: true,
  subtree: true,
});
r5cDecorate();
const r5cRequested = new URLSearchParams(location.search).get("state");
if (R5C_STATES.has(r5cRequested) && !r5cRequested.startsWith("calendar-"))
  r5cOpen(r5cStateSource(r5cRequested), null, r5cRequested);
