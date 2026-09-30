"use strict";
const elements = {
  card: document.querySelector("#statusCard"), title: document.querySelector("#statusTitle"), text: document.querySelector("#statusText"),
  scanned: document.querySelector("#scannedCount"), blocked: document.querySelector("#blockedCount"), risk: document.querySelector("#riskValue"),
  enabled: document.querySelector("#enabled"), blocking: document.querySelector("#blocking"), scan: document.querySelector("#scanButton")
};
let activeTab;
function render(state) {
  if (!state) {
    elements.card.className = "status idle";
    elements.title.textContent = "Không thể quét trang này";
    elements.text.textContent = "Extension chỉ hoạt động trên trang HTTP và HTTPS.";
    return;
  }
  const blocked = state.blockedCount > 0;
  elements.card.className = `status ${blocked ? "danger" : "safe"}`;
  elements.title.textContent = blocked ? "Đã phát hiện nội dung XSS" : "Trang chưa có dấu hiệu XSS";
  elements.text.textContent = blocked ? `Nguồn gần nhất: ${state.lastSource || "không xác định"}` : "Chế độ giám sát thời gian thực đang hoạt động.";
  elements.scanned.textContent = state.scannedCount || 0;
  elements.blocked.textContent = state.blockedCount || 0;
  elements.risk.textContent = `${Math.round((state.lastRisk || 0) * 100)}%`;
}
async function load() {
  const settings = await chrome.storage.local.get({ enabled: true, blocking: true });
  elements.enabled.checked = settings.enabled;
  elements.blocking.checked = settings.blocking;
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id) return render(null);
  try { render(await chrome.tabs.sendMessage(activeTab.id, { type: "GET_STATUS" })); }
  catch {
    const cached = await chrome.storage.session.get(`tab_${activeTab.id}`);
    render(cached[`tab_${activeTab.id}`] || null);
  }
}
elements.enabled.addEventListener("change", async () => {
  await chrome.storage.local.set({ enabled: elements.enabled.checked });
  elements.blocking.disabled = !elements.enabled.checked;
});
elements.blocking.addEventListener("change", () => chrome.storage.local.set({ blocking: elements.blocking.checked }));
elements.scan.addEventListener("click", async () => {
  if (!activeTab?.id) return;
  try { render(await chrome.tabs.sendMessage(activeTab.id, { type: "SCAN_NOW" })); } catch { render(null); }
});
load();
