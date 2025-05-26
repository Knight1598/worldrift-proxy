<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Worldrift AI - Webhook Proxy</title>
  <style>
    body { font-family: sans-serif; background: #111; color: #0f0; padding: 10px; }
    #output { white-space: pre-wrap; margin-bottom: 1em; min-height: 200px; border: 1px solid #333; padding: 10px; background: #000; }
    #status { color: #ccc; font-size: 0.9em; margin-top: 10px; }
    input, button { font-size: 1.1em; padding: 5px; width: 100%; margin-top: 5px; }
    button { background-color: #0a0; color: white; border: none; cursor: pointer; }
    button:hover { background-color: #0f0; color: black; }
  </style>
</head>
<body>
  <h2>Worldrift AI - Webhook Proxy</h2>
  <div id="output">[เชื่อมกับ Webhook Proxy แล้ว]</div>
  <input id="input" placeholder="พิมพ์คำสั่งของคุณ เช่น เดินเข้าป่า..." />
  <button onclick="sendMessage()">ส่งคำสั่ง</button>
  <div id="status"></div>

  <script>
    const player = {
      id: "WR-" + Math.random().toString(36).substring(2, 😎.toUpperCase(),
      energy: 100,
      emotion: "อยากรู้อยากเห็น",
      location: "หมู่บ้านต้นน้ำ"
    };

    // เปลี่ยน URL นี้เป็น URL จาก Render ของคุณ (เช่น https://your-render-url.onrender.com/api)
    const WEBHOOK_URL = 'https://worldrift-proxy.onrender.com';

    function sendMessage() {
      const input = document.getElementById("input").value;
      const outputBox = document.getElementById("output");
      if (!input.trim()) return;

      outputBox.innerHTML += \n> ${input};
      outputBox.innerHTML += \n[กำลังเชื่อมต่อ GPT Proxy...];

      fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: "คุณคือผู้ช่วยในเกม Worldrift Text RPG" },
            { role: "user", content: input }
          ]
        })
      })
      .then(res => res.text())
      .then(reply => {
        outputBox.innerHTML += \n${reply};
        document.getElementById("input").value = "";
        updateStatus();
      })
      .catch(err => {
        outputBox.innerHTML += \n[FETCH ERROR]\nTypeError: ${err};
      });
    }

    function updateStatus() {
      document.getElementById("status").innerText =
        ID: ${player.id} | สถานที่: ${player.location} | พลังงาน: ${player.energy} | อารมณ์: ${player.emotion};
    }

    updateStatus();
  </script>
</body>
</html>
