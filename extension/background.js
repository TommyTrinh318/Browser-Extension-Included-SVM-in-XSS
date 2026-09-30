"use strict";
const DEFAULTS = { enabled: true, blocking: true };

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(DEFAULTS);
  await chrome.storage.local.set(current);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "BLOCK_NAVIGATION" && sender.tab?.id !== undefined) {
    const query = new URLSearchParams({
      source: message.source || "url",
      risk: String(message.risk || 0),
      url: message.url || sender.tab.url || ""
    });
    chrome.tabs.update(sender.tab.id, { url: chrome.runtime.getURL(`blocked.html?${query}`) });
    sendResponse({ ok: true });
  } else if (message?.type === "SCAN_UPDATE" && sender.tab?.id !== undefined) {
    chrome.storage.session.set({ [`tab_${sender.tab.id}`]: message.payload });
    chrome.action.setBadgeText({ tabId: sender.tab.id, text: message.payload.blockedCount ? String(message.payload.blockedCount) : "" });
    chrome.action.setBadgeBackgroundColor({ tabId: sender.tab.id, color: "#b42318" });
    sendResponse({ ok: true });
  }
  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove(`tab_${tabId}`));
