// Design preview only: no backend imports, real messages, bookings, or points.
const KEY = "ear-ju-da:consultation-preview";
let memory = {};
function state() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null") || memory;
  } catch {
    return memory;
  }
}
function save(value) {
  memory = value;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    /* Preview also works without storage. */
  }
}
const now = Date.now();
const base = {
  youth_id: "demo-youth",
  expert_id: "demo-veteran",
  price_points: 3000,
  youth: { name: "김대표" },
  expert: {
    headline: "자동차 부품사 구매팀 30년",
    profiles: { name: "이승호 위원" },
  },
  topic: "거래처의 납품 단가 인하 요구에 어떻게 대응할까요?",
};
function samples() {
  return [
    {
      ...base,
      id: "demo-active",
      status: "confirmed",
      slot: {
        start_at: new Date(now - 600000).toISOString(),
        end_at: new Date(now + 3000000).toISOString(),
      },
    },
    {
      ...base,
      id: "demo-completed",
      status: "completed",
      slot: {
        start_at: new Date(now - 172800000).toISOString(),
        end_at: new Date(now - 169200000).toISOString(),
      },
    },
    {
      ...base,
      id: "demo-upcoming",
      status: "confirmed",
      topic: "새로운 납품 계약서를 검토하고 싶어요.",
      slot: {
        start_at: new Date(now + 86400000).toISOString(),
        end_at: new Date(now + 90000000).toISOString(),
      },
    },
    {
      ...base,
      id: "demo-cancelled",
      status: "cancelled",
      slot: {
        start_at: new Date(now - 86400000).toISOString(),
        end_at: new Date(now - 82800000).toISOString(),
      },
    },
  ];
}
export async function getCurrentUser() {
  return {
    id:
      new URLSearchParams(location.search).get("role") === "veteran"
        ? "demo-veteran"
        : "demo-youth",
  };
}
export async function getMyBookings() {
  return samples().map((b) => ({
    ...b,
    status: state()[`completed:${b.id}`] ? "completed" : b.status,
  }));
}
export async function getBooking(id) {
  return (await getMyBookings()).find((b) => b.id === id) || null;
}
export function getChatWindow(booking) {
  const opensAt = new Date(booking.slot.start_at),
    closesAt = new Date(booking.slot.end_at);
  const ready =
    booking.status === "confirmed" &&
    Date.now() >= opensAt &&
    Date.now() <= closesAt;
  return {
    state: ready
      ? "open"
      : Date.now() < opensAt && booking.status === "confirmed"
        ? "before"
        : "closed",
    opensAt,
    closesAt,
    message: ready
      ? "예시 상담 시간이에요. 메시지 전송을 미리 볼 수 있어요."
      : booking.status === "completed"
        ? "완료된 예시 상담이에요. 대화를 다시 볼 수 있어요."
        : booking.status === "cancelled"
          ? "취소된 예시 상담이에요."
          : "예시 상담이 시작되면 메시지를 보낼 수 있어요.",
  };
}
export async function getMessages(id) {
  return (
    state()[`messages:${id}`] || [
      {
        id: "preview-1",
        sender_id: "demo-youth",
        content: "거래처가 납품 단가를 낮추자고 해요. 무엇부터 확인할까요?",
        created_at: new Date(now - 300000).toISOString(),
      },
      {
        id: "preview-2",
        sender_id: "demo-veteran",
        content:
          "기존 계약의 단가 조정 조건부터 확인해보세요. 원가 자료와 함께 협의 기준을 정리해두면 좋아요.",
        created_at: new Date(now - 240000).toISOString(),
      },
    ]
  );
}
let listener = () => {};
export function subscribeMessages(id, callback) {
  listener = callback;
  return () => {
    listener = () => {};
  };
}
export async function sendMessage(id, content) {
  const me = await getCurrentUser();
  const booking = await getBooking(id);
  if (getChatWindow(booking).state !== "open")
    throw new Error("예시 상담 시간이 아니에요.");
  const row = {
    id: crypto.randomUUID(),
    sender_id: me.id,
    content,
    created_at: new Date().toISOString(),
  };
  const rows = await getMessages(id);
  const value = state();
  value[`messages:${id}`] = [...rows, row];
  save(value);
  listener(row);
  return row;
}
export async function completeBooking(id) {
  const me = await getCurrentUser();
  if (me.id !== "demo-youth")
    throw new Error("청년 당사자만 완료할 수 있어요.");
  const value = state();
  value[`completed:${id}`] = true;
  save(value);
}
const previewReport = {
  summary:
    "단가 인하 요청에 바로 답하기 전에 기존 계약의 조정 조건과 원가 자료를 확인해요. 합의할 수 있는 기준을 문서로 정리한 뒤 거래처와 협의해요.",
  checklist: [
    "기존 계약서의 단가 조정 조항 확인하기",
    "원자재·인건비 등 원가 변동 자료 정리하기",
    "거래처와 협의할 기준과 대안 기록하기",
  ],
  risks: [
    "조건을 확인하지 않고 동의하면 수익이 줄어들 수 있어요.",
    "구두 합의만 남기면 합의 내용을 확인하기 어려울 수 있어요.",
  ],
};
export async function getReport(id) {
  return (
    state()[`report:${id}`] ||
    (id === "demo-completed"
      ? {
          ...previewReport,
          booking_id: id,
          created_at: new Date(now - 86400000).toISOString(),
        }
      : null)
  );
}
export async function generateReport(id) {
  if ((await getBooking(id))?.status !== "completed")
    throw new Error("예시 상담을 먼저 완료해주세요.");
  const report = {
    ...previewReport,
    booking_id: id,
    created_at: new Date().toISOString(),
  };
  const value = state();
  value[`report:${id}`] = report;
  save(value);
  return report;
}
