async function send() {
  const player = document.getElementById("playerInput").value;
  const message = document.getElementById("commandInput").value;

  const response = await fetch("https://iahcarus.app.n8n.cloud/webhook-test/text-game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      player: player,
      message: message,
      summary: "ไม่มีเหตุการณ์ก่อนหน้า"
    })
  });

  const data = await response.json();
  document.getElementById("storyBox").innerText = data.message || "⚠️ ไม่พบคำตอบจาก GPT";
}
