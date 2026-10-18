import { translate, type Locale } from "./locale.js";

export function createContentStatus(state: "loading" | "error" | "empty", locale: Locale): HTMLElement {
  const status = document.createElement("div");
  status.className = `content-status content-status--${state}`;
  status.dataset.contentStatus = state;
  status.setAttribute("role", "status");
  const message = document.createElement("p");
  message.textContent = translate(locale, state === "loading" ? "contentLoading" : state === "error" ? "contentUnavailable" : "contentEmpty");
  status.append(message);
  if (state === "error") {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.dataset.contentRetry = "";
    retry.textContent = translate(locale, "contentRetry");
    retry.addEventListener("click", () => window.location.reload());
    status.append(retry);
  }
  return status;
}
