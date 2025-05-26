<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Worldrift AI</title>
  <style>
    body { background: #111; color: #0f0; font-family: monospace; padding: 20px; }
    #output { background: #000; padding: 10px; min-height: 200px; white-space: pre-wrap; border: 1px solid #333; margin-bottom: 10px; }
    input, button { font-size: 16px; padding: 5px; margin-top: 5px; width: 100%; }
    button { background: #0a0; color: white; cursor: pointer; border: none; }
  </style>
</head>
<body>
  <h2>Worldrift AI - Webhook Proxy</h2>
  <div id="output">[เชื่อมผ่าน Webhook Proxy... พร้อมแล้ว]</div>
  <input id="input" placeholder="พิมพ์คำสั่ง เช่น เดินเข้าป่า" />
  <button onclick="processInput()">ส่งคำสั่ง</button>
  <div id="status"></div>

  <script>
    const WEBHOOK_URL = "https://worldrift-proxy.onrender.com";

    const player = {
      id: "WR-" + Math.random().toString(36).substring(2, 😎.toUpperCase(),
      energy: 100,
      emotion: "อยากรู้อยากเห็น",
      location: "หมู่บ้านต้นน้ำ"
    };

    function processInput() {
      const input = document.getElementById("input").value;
      const outputBox = document.getElementById("output");

      if (!input.trim()) return;
      outputBox.innerHTML += \n> ${input};

      fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: input }]
        })
      })
      .then(res => res.text())
      .then(reply => {
        outputBox.innerHTML += \n${reply};
        document.getElementById("input").value = "";
        updateStatus();
      })
      .catch(err => {
        outputBox.innerHTML += \n[ข้อผิดพลาด: ${err.message}];
      });
    }

    function updateStatus() {
      document.getElementById("status").innerText =
        ID: ${player.id} | พลังงาน: ${player.energy} | อารมณ์: ${player.emotion};
    }

    updateStatus();
  </script>
</body>
</html>
