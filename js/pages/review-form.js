import { demo, status } from "./ui.js?v=engagement-2";
export async function reviewApi() {
  return demo ? import("./engagement-demo.js") : import("../api/bookings.js");
}
export function reviewCard(review) {
  const article = document.createElement("article");
  article.className = "review-entry";
  for (const [tag, text] of [
    [
      "p",
      `${"★".repeat(Math.max(0, Math.min(5, Number(review.rating) || 0)))} · ${review.rating}/5`,
    ],
    ["p", review.content || "내용 없이 별점만 남긴 후기예요."],
    [
      "small",
      `${review.youth?.name || "사용자"} · ${new Date(review.created_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}`,
    ],
  ]) {
    const el = document.createElement(tag);
    el.textContent = text;
    article.append(el);
  }
  return article;
}
let sequence = 0;
export async function mountReview(host, booking, me) {
  if (booking.status !== "completed" || booking.youth_id !== me.id) return;
  const message = document.createElement("p");
  message.className = "status";
  message.setAttribute("role", "status");
  host.append(message);
  let api,
    busy = false;
  async function load() {
    host.replaceChildren(message);
    message.textContent = "내 후기를 확인하고 있어요.";
    try {
      api = await reviewApi();
      const own = await api.getMyReview(booking.id);
      if (!host.isConnected) return;
      host.replaceChildren();
      if (own) {
        const title = document.createElement("h3");
        title.textContent = "내가 쓴 후기";
        host.append(title, reviewCard(own));
        return;
      }
      const button = document.createElement("button");
      button.type = "button";
      button.className = "outline";
      button.textContent = "후기 쓰기";
      button.onclick = () => open(button);
      host.append(button);
    } catch (e) {
      message.textContent = e.message || "후기를 확인하지 못했어요.";
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = "다시 시도";
      retry.onclick = load;
      message.append(retry);
    }
  }
  function open(trigger) {
    const dialog = document.createElement("dialog");
    dialog.className = "review-dialog";
    const title = document.createElement("h2");
    title.id = "review-title-" + ++sequence;
    title.textContent = "상담 후기를 남겨주세요";
    dialog.setAttribute("aria-labelledby", title.id);
    const hint = document.createElement("p");
    hint.textContent = demo
      ? "예시 후기예요. 실제 서비스에는 저장하지 않아요."
      : "별점을 선택해주세요. 후기는 저장 후 이 화면에서 수정할 수 없어요.";
    const group = document.createElement("div");
    group.className = "review-stars";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "상담 별점");
    let rating = 0,
      feedback;
    const stars = [];
    function select(value, focus = false) {
      rating = value;
      if (feedback) feedback.textContent = "";
      stars.forEach((b, i) => {
        b.setAttribute("aria-checked", String(i + 1 === rating));
        b.tabIndex = i + 1 === (rating || 1) ? 0 : -1;
        b.textContent = `${i < rating ? "★" : "☆"} ${i + 1}`;
      });
      if (focus) stars[value - 1].focus();
    }
    for (let i = 1; i <= 5; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", `${i}점`);
      button.onclick = () => select(i);
      button.onkeydown = (e) => {
        let next = rating || i;
        if (["ArrowRight", "ArrowUp"].includes(e.key)) next = (next % 5) + 1;
        else if (["ArrowLeft", "ArrowDown"].includes(e.key))
          next = ((next + 3) % 5) + 1;
        else if (e.key === "Home") next = 1;
        else if (e.key === "End") next = 5;
        else return;
        e.preventDefault();
        select(next, true);
      };
      stars.push(button);
      group.append(button);
    }
    select(0);
    const label = document.createElement("label");
    const text = document.createElement("textarea");
    text.id = "review-text-" + sequence;
    text.maxLength = 500;
    text.rows = 4;
    text.placeholder = "도움이 된 점을 남겨주세요. (선택, 500자 이내)";
    label.htmlFor = text.id;
    label.textContent = "후기 내용 (선택)";
    feedback = document.createElement("p");
    feedback.className = "status";
    feedback.setAttribute("role", "status");
    const actions = document.createElement("div");
    actions.className = "review-actions";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "취소";
    cancel.className = "outline";
    const submit = document.createElement("button");
    submit.type = "button";
    submit.textContent = "후기 등록";
    submit.className = "primary";
    actions.append(cancel, submit);
    dialog.append(title, hint, group, label, text, feedback, actions);
    document.body.append(dialog);
    cancel.onclick = () => dialog.close();
    dialog.addEventListener("cancel", (e) => {
      if (busy) e.preventDefault();
    });
    dialog.addEventListener(
      "close",
      () => {
        dialog.remove();
        trigger.focus();
      },
      { once: true },
    );
    submit.onclick = async () => {
      if (busy) return;
      if (!rating) {
        feedback.textContent = "별점을 1~5점 중에서 선택해주세요.";
        stars[0].focus();
        return;
      }
      busy = true;
      submit.disabled = cancel.disabled = true;
      text.disabled = true;
      stars.forEach((b) => (b.disabled = true));
      try {
        const existing = await api.getMyReview(booking.id);
        if (!existing)
          await api.addReview(booking.id, rating, text.value.trim());
        dialog.close();
        await load();
      } catch (e) {
        feedback.textContent =
          (e.message || "후기를 저장하지 못했어요.") +
          " 입력 내용은 유지했어요. 다시 등록하면 먼저 작성 여부를 확인해요.";
      } finally {
        busy = false;
        submit.disabled = cancel.disabled = false;
        text.disabled = false;
        stars.forEach((b) => (b.disabled = false));
      }
    };
    dialog.showModal();
  }
  await load();
}
