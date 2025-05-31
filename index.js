const sendToGame = async (player, message, summary) => {
  const response = await fetch("https://iahcarus.app.n8n.cloud/webhook-test/text-game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      player: player,
      message: message,
      summary: summary
    })
  });

  const data = await response.json();
  console.log("🧠 เนื้อเรื่องที่ได้:", data.message);
  document.getElementById("storyBox").innerText = data.message;
};
