"use strict";
const params = new URLSearchParams(location.search);
document.querySelector("#source").textContent = params.get("source") || "URL";
document.querySelector("#risk").textContent = `${Math.round(Number(params.get("risk") || 0) * 100)}%`;
document.querySelector("#url").textContent = params.get("url") || "Không có dữ liệu";
document.querySelector("#back").addEventListener("click", () => history.back());
