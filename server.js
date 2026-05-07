require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 3001;

app.get('/', (req, res) => {
  res.type('text/plain').send('Comando Pulso · em construção');
});

app.listen(PORT, () => {
  console.log(`[comando-pulso] servidor ouvindo em http://localhost:${PORT}`);
});
