import { demo, money, notice, status, init, goLogin, route } from "./ui.js";
init();
const $ = (id) => document.getElementById(id);

const INDUSTRIES = ["제조", "유통", "세무", "인사·노무", "무역", "외식", "건설", "금융", "마케팅", "IT", "법무", "기타"];
const PRICES = [1000, 1500, 2000, 2500, 3000, 3500, 4000, 5000];
const BANNER = {
  pending: "관리자가 경력 증명서를 확인하고 있어요. 승인되면 베테랑 목록에 노출되고 알림을 보내 드려요.",
  approved: "경력 인증이 완료됐어요. 수정한 내용은 바로 프로필에 반영돼요.",
  rejected: "증명서로 경력을 확인하지 못했어요. 새 증명서를 올리면 다시 검토해요.",
};

let api = null;
let mine = null;
let busy = false;

const DEMO_EXPERT = {
  headline: "자동차 부품사 구매팀 30년",
  industry: "제조",
  career_years: 30,
  career_summary: "1994~2024 국내 자동차 부품사 구매팀 (팀장 12년)\n협력사 200여 곳과 납품 계약·단가 협상 담당",
  keywords: ["제조공정", "납품계약", "단가협상"],
  price_points: 3000,
  verification: "pending",
  certificate_path: "demo.pdf",
};

$("setup-industry").replaceChildren(new Option("분야를 골라 주세요", ""), ...INDUSTRIES.map((x) => new Option(x, x)));
$("setup-price").replaceChildren(...PRICES.map((p) => new Option(`${money(p)}P`, p, false, p === 3000)));

const keywordsOf = (text) =>
  [...new Set(text.split(/[,，#\n]/).map((k) => k.trim().replace(/\s+/g, "")).filter(Boolean))].slice(0, 6);

function fill(x) {
  $("setup-headline").value = x.headline ?? "";
  if (x.industry && !INDUSTRIES.includes(x.industry)) $("setup-industry").append(new Option(x.industry, x.industry));
  $("setup-industry").value = x.industry ?? "";
  $("setup-years").value = x.career_years ?? "";
  $("setup-summary").value = x.career_summary ?? "";
  $("setup-keywords").value = (x.keywords ?? []).join(", ");
  if (x.price_points && !PRICES.includes(x.price_points)) $("setup-price").append(new Option(`${money(x.price_points)}P`, x.price_points));
  $("setup-price").value = x.price_points ?? 3000;
}

function renderState() {
  const registered = !!mine;
  $("setup-title").textContent = registered ? "베테랑 프로필 수정" : "베테랑 프로필 등록";
  document.title = `${$("setup-title").textContent} | 이어주다`;
  $("setup-steps").hidden = registered && mine.verification === "approved";
  $("setup-cert-required").hidden = registered && !!mine.certificate_path;
  $("setup-cert-view").hidden = !(registered && mine.certificate_path);
  $("setup-submit").textContent = !registered
    ? "등록하고 승인 요청하기"
    : mine.verification === "rejected"
      ? "새 증명서로 다시 요청하기"
      : "저장하기";
  const banner = $("setup-banner");
  banner.hidden = !registered;
  if (registered) {
    banner.className = `setup-banner is-${mine.verification}`;
    banner.textContent =
      BANNER[mine.verification] + (mine.verification === "rejected" && mine.rejection_reason ? `\n반려 사유: ${mine.rejection_reason}` : "");
  }
}

$("setup-file").onchange = () => {
  const f = $("setup-file").files[0];
  $("setup-file-name").textContent = f ? `선택한 파일: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)}MB)` : "";
};

$("setup-cert-view").onclick = async () => {
  if (demo) return notice("예시 화면", "실제 서비스에서는 올린 증명서가 새 창에서 열려요.");
  const win = window.open("", "_blank");
  try {
    const url = await api.getMyCertificateUrl();
    if (!url) throw new Error("올린 증명서가 없어요.");
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else location.href = url;
  } catch (e) {
    win?.close();
    notice("증명서", e.message);
  }
};

function invalid(id, message) {
  $(id).setAttribute("aria-invalid", "true");
  $(id).focus();
  status("setup-form-status", message);
  return false;
}

function validate() {
  document.querySelectorAll("[aria-invalid]").forEach((x) => x.removeAttribute("aria-invalid"));
  if (!$("setup-headline").value.trim()) return invalid("setup-headline", "한 줄 소개를 적어 주세요.");
  if (!$("setup-industry").value) return invalid("setup-industry", "분야를 골라 주세요.");
  const years = Number($("setup-years").value);
  if (!Number.isInteger(years) || years < 1 || years > 60) return invalid("setup-years", "경력 연수를 1~60 사이 숫자로 적어 주세요.");
  if (!mine?.certificate_path && !$("setup-file").files[0]) return invalid("setup-file", "경력 증명서를 올려 주세요. 관리자가 확인한 뒤 승인돼요.");
  return true;
}

$("setup-form").onsubmit = async (e) => {
  e.preventDefault();
  if (busy || !validate()) return;
  const info = {
    headline: $("setup-headline").value.trim(),
    industry: $("setup-industry").value,
    career_years: Number($("setup-years").value),
    career_summary: $("setup-summary").value.trim() || null,
    keywords: keywordsOf($("setup-keywords").value),
    price_points: Number($("setup-price").value),
  };
  const file = $("setup-file").files[0];
  if (demo) return notice("예시 화면", "실제 서비스에서는 저장되고 관리자에게 승인 요청이 가요.");
  busy = true;
  $("setup-submit").disabled = true;
  try {
    if (!mine) {
      status("setup-form-status", "증명서를 올리고 있어요…");
      const path = await api.uploadCertificate(file);
      status("setup-form-status", "프로필을 저장하고 있어요…");
      mine = await api.registerExpert({ ...info, certificate_path: path });
      notice("등록했어요", "관리자가 증명서를 확인하면 알림을 보내 드려요. 그동안 상담 가능 시간을 미리 열어 둘 수 있어요.");
    } else {
      status("setup-form-status", "저장하고 있어요…");
      await api.updateMyExpert(info);
      if (file) {
        status("setup-form-status", "새 증명서를 올리고 있어요…");
        await api.uploadCertificate(file);
      }
      mine = await api.getMyExpert();
      notice("저장했어요", mine.verification === "pending" && file ? "새 증명서로 다시 승인을 요청했어요." : "프로필에 반영했어요.");
    }
    $("setup-file").value = "";
    $("setup-file-name").textContent = "";
    status("setup-form-status", "");
    renderState();
    showNext();
  } catch (err) {
    status("setup-form-status", err.message || "저장하지 못했어요. 다시 시도해 주세요.");
  } finally {
    busy = false;
    $("setup-submit").disabled = false;
  }
};

function showNext() {
  if (document.getElementById("setup-next")) return;
  const a = document.createElement("a");
  a.id = "setup-next";
  a.className = "outline full setup-next";
  a.href = route("expert-dashboard.html");
  a.textContent = "대시보드로 가기";
  $("setup-form").append(a);
}

async function start() {
  status("setup-status", "불러오고 있어요.");
  if (demo) {
    mine = DEMO_EXPERT;
    fill(mine);
    renderState();
    $("setup-content").hidden = false;
    status("setup-status", "");
    return;
  }
  try {
    const { getMyProfile } = await import("../api/auth.js");
    const me = await getMyProfile();
    if (!me) return goLogin();
    if (me.role !== "veteran") return status("setup-status", "베테랑 회원만 프로필을 등록할 수 있어요.");
    api = await import("../api/experts.js");
    mine = await api.getMyExpert();
    if (mine) {
      fill(mine);
      showNext();
    }
    renderState();
    $("setup-content").hidden = false;
    status("setup-status", "");
  } catch (e) {
    status("setup-status", e.message || "불러오지 못했어요.", start);
  }
}
start();
