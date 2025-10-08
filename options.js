document.addEventListener("DOMContentLoaded", async () => {
  const input = document.getElementById("keyword");
  const status = document.getElementById("status");
  const { keyword = "zscaler" } = await browser.storage.local.get("keyword");
  input.value = keyword;
  document.getElementById("save").addEventListener("click", async () => {
    const newKeyword = input.value.trim();
    await browser.storage.local.set({ keyword: newKeyword || "zscaler" });
    status.textContent = "Saved!";
    setTimeout(() => (status.textContent = ""), 1500);
  });
});