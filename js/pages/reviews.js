import { init, route, status } from "./ui.js?v=engagement-2";
import { reviewApi, reviewCard } from "./review-form.js?v=engagement-2";
init();
async function load() {
  status("reviews-status", "후기를 불러오고 있어요.");
  try {
    const rows = await (await reviewApi()).getRecentReviews({ limit: 30 });
    document.getElementById("reviews-list").replaceChildren(
      ...rows.map((r) => {
        const card = reviewCard(r);
        const a = document.createElement("a");
        a.className = "review-target";
        a.href = route("expert-booking.html", { id: r.expert_id });
        a.textContent = `${r.expert?.profiles?.name || "베테랑"} · ${r.expert?.industry || r.expert?.headline || "분야 미등록"}`;
        card.prepend(a);
        return card;
      }),
    );
    status("reviews-status", rows.length ? "" : "아직 후기가 없어요.");
  } catch (e) {
    status("reviews-status", e.message || "후기를 불러오지 못했어요.", load);
  }
}
load();
