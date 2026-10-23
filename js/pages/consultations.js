import { init, status } from "./ui.js";
import {
  $,
  services,
  card,
  loginRequired,
  isParticipant,
} from "./consultation-ui.js";
init();
let rows = [],
  me,
  filter = "all",
  loading = false;
function render() {
  const shown = rows.filter((b) => filter === "all" || b.status === filter);
  $("consultations-list").replaceChildren(...shown.map((b) => card(b, me)));
  status(
    "consultations-status",
    shown.length
      ? ""
      : "해당하는 상담이 없어요. 상담 예약하기에서 베테랑을 만나보세요.",
  );
}
async function load() {
  if (loading) return;
  $("consultations-list").replaceChildren();
  loading = true;
  $("consultations-refresh").disabled = true;
  status("consultations-status", "상담 목록을 불러오고 있어요.");
  try {
    const api = await services();
    me = await api.getCurrentUser();
    if (!me) {
      loginRequired("consultations-status");
      return;
    }
    rows = (await api.getMyBookings()).filter((b) => isParticipant(b, me));
    render();
  } catch (e) {
    status(
      "consultations-status",
      e.message || "상담 목록을 불러오지 못했어요.",
      load,
    );
  } finally {
    loading = false;
    $("consultations-refresh").disabled = false;
  }
}
document.querySelectorAll("[data-filter]").forEach(
  (button) =>
    (button.onclick = () => {
      filter = button.dataset.filter;
      document
        .querySelectorAll("[data-filter]")
        .forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      if (me) render();
    }),
);
$("consultations-refresh").onclick = load;
load();
