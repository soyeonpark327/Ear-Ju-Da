const screens = [...document.querySelectorAll("[data-screen]")];
const bottomItems = [...document.querySelectorAll(".v-bottom-nav [data-go]")];
const toast = document.querySelector(".v-toast");
let toastTimer;

function showNotice(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2200);
}

function showScreen(name) {
  const target = screens.find((screen) => screen.dataset.screen === name);
  if (!target) return;
  screens.forEach((screen) => {
    const active = screen === target;
    screen.classList.toggle("is-active", active);
    screen.setAttribute("aria-hidden", String(!active));
  });
  document.querySelector(".v-app").classList.toggle("v-no-bottom", ["editor", "chat"].includes(name));
  bottomItems.forEach((button) => {
    const active = button.dataset.go === name;
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.querySelector(".v-app").scrollTo({ top: 0, behavior: "auto" });
  window.scrollTo({ top: 0, behavior: "auto" });
}

document.querySelector('.v-date-strip button')?.classList.add("is-selected");

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.go));
});

document.querySelectorAll("[data-notice]").forEach((button) => {
  button.addEventListener("click", () => showNotice(button.dataset.notice));
});

document.querySelectorAll("[data-screen] [role='button'][data-go]").forEach((button) => {
  button.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      showScreen(button.dataset.go);
    }
  });
});

document.querySelectorAll(".v-date-strip button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".v-date-strip button").forEach((day) => day.classList.remove("is-selected"));
    button.classList.add("is-selected");
    showNotice(`${button.querySelector("small").textContent}요일 상담 일정을 보고 있어요.`);
  });
});

document.querySelectorAll(".v-time-options button").forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("selected")));
  button.addEventListener("click", () => {
    button.classList.toggle("selected");
    button.setAttribute("aria-pressed", String(button.classList.contains("selected")));
  });
});

document.querySelectorAll(".v-categories button").forEach((button) => {
  button.setAttribute("aria-pressed", String(button.classList.contains("selected")));
  button.addEventListener("click", () => {
    document.querySelectorAll(".v-categories button").forEach((category) => {
      const selected = category === button;
      category.classList.toggle("selected", selected);
      category.setAttribute("aria-pressed", String(selected));
    });
  });
});

const editorNext = document.querySelector(".v-editor-actions .v-primary");
editorNext?.addEventListener("click", () => {
  const heading = document.querySelector(".v-error-head h2");
  const count = document.querySelector(".v-error-head span");
  const current = Number(count.textContent.split("/")[0].trim());
  if (current >= 5) {
    showNotice("오답 5개까지 작성했어요. 공개 전 내용을 확인해주세요.");
    return;
  }
  heading.textContent = `오답 ${current + 1}`;
  count.textContent = `${current + 1} / 5`;
  document.querySelectorAll(".v-error-form textarea").forEach((field) => (field.value = ""));
  document.querySelector(".v-error-form textarea").focus();
});

const chatForm = document.querySelector(".v-chat-compose");
chatForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = chatForm.querySelector("input");
  const value = input.value.trim();
  if (!value) return;
  const bubble = document.createElement("p");
  bubble.className = "v-bubble v-out";
  bubble.textContent = value;
  const time = document.createElement("time");
  time.textContent = "방금";
  bubble.append(time);
  document.querySelector(".v-chat-content").insertBefore(bubble, document.querySelector(".v-key-advice"));
  input.value = "";
  bubble.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

document.querySelectorAll("a[href='#home']").forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    event.preventDefault();
    showScreen("home");
  });
});
