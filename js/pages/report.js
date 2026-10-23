import { mountReview } from "./review-form.js?v=engagement-2";
import { demo, init, route, status } from "./ui.js?v=engagement-2";
import {
  $,
  services,
  dateTime,
  showBookingContext,
  isParticipant,
  loginRequired,
} from "./consultation-ui.js?v=engagement-2";
init();
const id = new URLSearchParams(location.search).get("id");
let api,
  booking,
  me,
  loading = false,
  generating = false;
function render(report) {
  if (!report || typeof report.summary !== "string")
    throw new Error("보고서 내용을 확인하지 못했어요. 다시 불러와주세요.");
  $("report-summary").textContent = report.summary;
  for (const [field, node] of [
    ["checklist", "report-checklist"],
    ["risks", "report-risks"],
  ]) {
    const rows = Array.isArray(report[field])
      ? report[field].filter((s) => typeof s === "string" && s.trim())
      : [];
    $(node).replaceChildren(
      ...(rows.length ? rows : ["등록된 항목이 없어요."]).map((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        return li;
      }),
    );
  }
  $("report-created-at").textContent =
    `${demo ? "예시 보고서 · 실제 AI 생성이 아니에요 · " : ""}${report.created_at ? dateTime(report.created_at) : "생성 시각 정보가 없어요"}`;
  $("report-content").hidden = false;
  $("report-create").hidden = true;
  status("report-status", "");
}
async function readReport() {
  status("report-status", "저장된 보고서를 확인하고 있어요.");
  try {
    const report = await api.getReport(id);
    if (report) {
      render(report);
    } else {
      $("report-content").hidden = true;
      $("report-create").hidden = false;
      status(
        "report-status",
        "아직 보고서가 없어요. 상담 대화로 보고서를 만들어보세요.",
      );
    }
  } catch (e) {
    $("report-create").hidden = true;
    status(
      "report-status",
      e.message || "보고서를 불러오지 못했어요.",
      readReport,
    );
  }
}
async function load() {
  if (loading) return;
  loading = true;
  $("report-context").hidden = true;
  $("report-create").hidden = true;
  $("report-content").hidden = true;
  status("report-load", "상담 정보를 불러오고 있어요.");
  try {
    if (!id) {
      status(
        "report-load",
        "선택한 상담이 없어요. 내 상담에서 완료된 상담을 선택해주세요.",
      );
      return;
    }
    api = await services();
    me = await api.getCurrentUser();
    if (!me) {
      loginRequired("report-load");
      return;
    }
    booking = await api.getBooking(id);
    if (!isParticipant(booking, me)) {
      status("report-load", "존재하지 않거나 접근할 수 없는 상담이에요.");
      return;
    }
    showBookingContext(booking, me, "report");
    $("report-context").hidden = false;
    $("report-chat").href = route("chat.html", { id });
    status("report-load", "");
    if (booking.status !== "completed") {
      status(
        "report-status",
        booking.status === "cancelled"
          ? "취소된 상담은 보고서를 만들 수 없어요."
          : "상담을 완료한 뒤 보고서를 볼 수 있어요. 상담 대화 보기로 돌아가주세요.",
      );
      return;
    }
    await mountReview($("report-review"), booking, me);
    await readReport();
  } catch (e) {
    status("report-load", e.message || "상담 정보를 불러오지 못했어요.", load);
  } finally {
    loading = false;
  }
}
$("report-generate").onclick = async () => {
  if (generating || booking?.status !== "completed") return;
  generating = true;
  $("report-generate").disabled = true;
  $("report-generate").textContent = "보고서를 만들고 있어요…";
  status(
    "report-status",
    demo
      ? "예시 보고서를 준비하고 있어요."
      : "AI가 상담 대화를 정리하고 있어요. 잠시 기다려주세요.",
  );
  $("report-status").setAttribute("aria-busy", "true");
  try {
    render(await api.generateReport(id));
  } catch (e) {
    status(
      "report-status",
      `${e.message || "보고서를 만들지 못했어요."} 상담 완료 상태는 유지돼요. 저장된 보고서를 다시 확인하거나 만들기를 재시도해주세요.`,
      readReport,
    );
  } finally {
    generating = false;
    $("report-generate").disabled = false;
    $("report-generate").textContent = "AI 보고서 만들기";
    $("report-status").setAttribute("aria-busy", "false");
  }
};
load();
