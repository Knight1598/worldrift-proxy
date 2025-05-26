const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const webhook_url = process.env.WEBHOOK_URL || "https://worldrift-proxy.onrender.com/api";

app.post('/api', async (req, res) => {
  try {
    const messages = req.body.messages;

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: messages
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const content = response.data.choices[0].message.content;

    // ส่งผลลัพธ์ไปยัง webhook ถ้ามีการกำหนด webhook_url
    if (webhook_url) {
      await axios.post(webhook_url, {
        response: content,
        timestamp: new Date().toISOString()
      });
    }

    res.send(content);
  } catch (err) {
    res.status(500).send('ERROR: ' + err.message);
  }
});

app.get('/', (req, res) => {
  res.send('Worldrift GPT Proxy (Render) is working.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
