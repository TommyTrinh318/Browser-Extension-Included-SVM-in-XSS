(async function () {
  "use strict";

  // Đăng ký bộ chặn đồng bộ ngay khi content script được nạp. MutationObserver
  // chỉ chạy sau khi DOM đã thay đổi, vì vậy không đủ để ngăn một inline event
  // được kích hoạt trong khoảng thời gian rất ngắn trước callback của observer.
  const guardedEvents = ["mouseover", "mouseenter", "click", "error", "load"];
  const dangerousUrlPattern = /^\s*javascript\s*:/i;

  function elementFromEventTarget(target) {
    if (target instanceof Element) return target;
    return target?.parentElement instanceof Element ? target.parentElement : null;
  }

  function hasSuspiciousInlineHandler(element) {
    return [...element.attributes].some((attribute) => {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.toLowerCase();
      return name.startsWith("on") && /alert\s*\(|confirm\s*\(|prompt\s*\(|eval\s*\(|document\s*\.|window\.|javascript\s*:/i.test(value);
    });
  }

  function neutralizeInlineHandlers(element) {
    if (!(element instanceof Element)) return false;
    let changed = false;
    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();
      const value = attribute.value.trim();
      if (name.startsWith("on") || ((name === "href" || name === "src") && dangerousUrlPattern.test(value))) {
        element.removeAttribute(attribute.name);
        changed = true;
      }
    }
    // Xóa cả DOM event-property trong trường hợp trang gán bằng JavaScript
    // thay vì tạo thuộc tính HTML inline.
    for (const property of ["onload", "onerror", "onclick", "onmouseover", "onmouseenter"]) {
      if (property in element && element[property]) {
        try { element[property] = null; } catch { /* thuộc tính chỉ đọc */ }
        changed = true;
      }
    }
    if (changed) {
      element.setAttribute("data-xss-guard-neutralized", "true");
      // Không cho phần tử tiếp tục nhận tương tác chuột trong lúc xử lý.
      if (element.style) element.style.pointerEvents = "none";
    }
    return changed;
  }

  function guardInteraction(event) {
    let element = elementFromEventTarget(event.target);
    while (element) {
      const hasEventAttribute = [...element.attributes].some((attribute) => attribute.name.toLowerCase().startsWith("on"));
      const hasJavaScriptUrl = [element.getAttribute("href"), element.getAttribute("src")].some((value) => value && dangerousUrlPattern.test(value));
      if (hasEventAttribute && (hasSuspiciousInlineHandler(element) || ["IMG", "SVG", "A", "BUTTON", "IFRAME", "OBJECT", "EMBED"].includes(element.tagName))) {
        neutralizeInlineHandlers(element);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (hasJavaScriptUrl) {
        neutralizeInlineHandlers(element);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      element = element.parentElement;
    }
  }

  // document vẫn nhận được listener ở document_start, kể cả khi <html> chưa có.
  for (const eventName of guardedEvents) document.addEventListener(eventName, guardInteraction, true);

  const settings = await chrome.storage.local.get({ enabled: true, blocking: true });
  if (!settings.enabled) return;
  const classifier = self.XSSClassifier.createClassifier(self.XSS_MODEL);
  const state = { url: location.href, status: "safe", scannedCount: 0, blockedCount: 0, lastRisk: 0, lastSource: "", updatedAt: Date.now() };

  function sendRuntimeMessage(message) {
    try {
      if (!chrome.runtime?.id) return;
      const pending = chrome.runtime.sendMessage(message);
      if (pending && typeof pending.catch === "function") pending.catch(() => {});
    } catch {
      // Tab có thể vẫn đang giữ content script cũ trong lúc Extension được reload.
    }
  }

  function report() {
    state.updatedAt = Date.now();
    sendRuntimeMessage({ type: "SCAN_UPDATE", payload: state });
  }
  function decodeRepeatedly(value) {
    let result = String(value || "");
    for (let count = 0; count < 3; count += 1) {
      try {
        const decoded = decodeURIComponent(result.replace(/\+/g, " "));
        if (decoded === result) break;
        result = decoded;
      } catch { break; }
    }
    return result;
  }
  function hasXssStructure(value) {
    return /<\s*script\b|javascript\s*:|on(?:error|load|click|mouseover)\s*=|<\s*(?:img|svg|iframe|object|embed)\b|document\s*\.\s*cookie|alert\s*\(/i.test(value);
  }
  const url = new URL(location.href);
  const candidates = [url.search, url.hash];
  for (const [key, value] of url.searchParams) candidates.push(key, value);
  for (const candidate of candidates.map(decodeRepeatedly).filter(Boolean)) {
    const result = classifier.classify(candidate);
    state.scannedCount += 1;
    state.lastRisk = Math.max(state.lastRisk, result.risk);
    if (result.label === 1 && hasXssStructure(candidate)) {
      state.status = "blocked";
      state.blockedCount += 1;
      state.lastSource = "URL";
      report();
      if (settings.blocking) {
        sendRuntimeMessage({ type: "BLOCK_NAVIGATION", source: "Reflected XSS trong URL", risk: result.risk, url: location.href });
        return;
      }
    }
  }

  const dangerousSelector = ["script", "iframe[srcdoc]", "object[data]", "embed[src]", "[onload]", "[onerror]", "[onclick]", "[onmouseover]", "[href^='javascript:' i]", "[src^='javascript:' i]"].join(",");
  function inspectElement(element) {
    if (!(element instanceof Element) || !element.matches(dangerousSelector)) return;
    const attributes = [...element.attributes].map((attribute) => `${attribute.name}=${attribute.value}`).join(" ");
    const sample = `${element.outerHTML || ""} ${attributes}`.slice(0, 20000);
    const result = classifier.classify(sample);
    state.scannedCount += 1;
    state.lastRisk = Math.max(state.lastRisk, result.risk);
    if (result.label !== 1 || !hasXssStructure(sample) || !settings.blocking) return;
    state.status = "blocked";
    state.blockedCount += 1;
    state.lastSource = "DOM";
    neutralizeInlineHandlers(element);
    if (["SCRIPT", "IFRAME", "OBJECT", "EMBED"].includes(element.tagName)) element.remove();
    else if (!element.hasAttribute("data-xss-guard-neutralized")) element.setAttribute("data-xss-guard-neutralized", "true");
  }
  function inspectTree(root) {
    if (!(root instanceof Element)) return;
    inspectElement(root);
    root.querySelectorAll(dangerousSelector).forEach(inspectElement);
    report();
  }
  function startObserver() {
    if (!document.documentElement) return setTimeout(startObserver, 0);
    inspectTree(document.documentElement);
    new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(inspectTree);
        if (mutation.type === "attributes") inspectElement(mutation.target);
      }
      report();
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["src", "href", "srcdoc", "onload", "onerror", "onclick", "onmouseover"] });
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "GET_STATUS") sendResponse(state);
    if (message?.type === "SCAN_NOW") { inspectTree(document.documentElement); sendResponse(state); }
    return false;
  });
  startObserver();
})();
