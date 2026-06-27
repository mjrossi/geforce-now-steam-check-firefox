import { hasFeedPermission, requestFeedPermission } from "../shared/permission";
import { log } from "../shared/log";

const dot = document.getElementById("dot")!;
const statusText = document.getElementById("status-text")!;
const enableBtn = document.getElementById("enable") as HTMLButtonElement;

function render(granted: boolean): void {
  dot.className = `dot ${granted ? "dot--on" : "dot--off"}`;
  statusText.textContent = granted
    ? "All set — open a Steam game page to see GeForce NOW badges."
    : "Permission not yet granted";
  enableBtn.disabled = granted;
  enableBtn.textContent = granted ? "Enabled ✓" : "Enable GeForce NOW checks";
}

enableBtn.addEventListener("click", async () => {
  const granted = await requestFeedPermission();
  log.info("onboarding: permission request returned", granted);
  render(granted);
});

void (async () => {
  const granted = await hasFeedPermission();
  log.info("onboarding: opened, permission granted =", granted);
  render(granted);
})();
