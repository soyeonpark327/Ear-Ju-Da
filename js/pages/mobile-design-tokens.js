// Read-only values copied from the user-selected Figma section “최종”.
// Keep the source spelling, sizes and line heights; do not apply editorial corrections.
export async function applyFinalMetrics() {
  const page = location.pathname.split("/").pop().replace(".html", "");
  const params = new URLSearchParams(location.search);
  const frames = {
    home: "1:73",
    "expert-booking": params.get("calendar") === "1" ? "34:541" : "1:388",
    booking: "1:687",
    matching: document.querySelector(".has-result") ? "1:785" : "1:761",
    notes: "1:318",
    "note-detail": "1:514",
    chat: "34:450",
    mypage: "2:83",
  };
  const res = await fetch("../assets/reference-final/text-specs.json");
  if (!res.ok) return;
  const specs = (await res.json())[frames[page]] || [];
  const normalize = (s) =>
    s.replace(/[\s\u00a0]+/g, "").replace(/[“”‘’]/g, '"');
  const candidates = [
    ...document.querySelectorAll(
      ".r-app h1,.r-app h2,.r-app h3,.r-app p,.r-app small,.r-app b,.r-app strong,.r-app a,.r-app button,.r-app span",
    ),
  ];
  for (const element of candidates) {
    const value = normalize(element.textContent || "");
    if (!value) continue;
    const spec = specs.find((x) => normalize(x.text) === value);
    if (!spec?.fontSize) continue;
    // Match the smallest text container, keeping links, bold ranges and icons intact.
    if (
      [...element.children].some(
        (c) => normalize(c.textContent || "") === value,
      )
    )
      continue;
    element.dataset.figmaText = spec.id;
    element.style.fontSize = spec.fontSize + "px";
    element.style.fontWeight = spec.weight;
    const lh = spec.lineHeight;
    element.style.lineHeight =
      lh.units === "PIXELS"
        ? lh.value + "px"
        : lh.units === "RAW"
          ? String(lh.value)
          : "1.2";
    if (spec.color)
      element.style.color = `rgb(${Math.round(spec.color.r * 255)} ${Math.round(spec.color.g * 255)} ${Math.round(spec.color.b * 255)})`;
  }
}
