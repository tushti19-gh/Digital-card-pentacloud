// ============================================
// Samsung Wallet – FLOW B (Data Fetch Link)
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// =========================
// CONFIG
// =========================

const SAMSUNG_CONFIG = {
  CARD_ID: '3ir7iadicu000',
  PARTNER_ID: '4137610299143138240',
};

app.use(cors());
app.use(express.json());

// =========================
// HEALTH CHECK
// =========================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    flow: 'Samsung Wallet – Data Fetch Link',
    time: new Date().toISOString(),
  });
});

// =========================
// GET CARD DATA API (MAIN)
// Samsung calls this
// =========================

app.get('/cards/:cardId/:refId', (req, res) => {
  const { cardId, refId } = req.params;

  console.log('📥 Samsung Get Card Data called:', cardId, refId);

  res.setHeader('Content-Type', 'application/json');

  res.json({
    card: {
      type: 'generic',
      data: [
        {
          refId,
          language: 'en',
          attributes: {
            title: 'Digital Business Card',
            subtitle: 'Employee Identity',
            providerName: 'Pentacloud Consulting',
            appLinkData: 'https://example.com',
          },
        },
      ],
    },
  });
});

// =========================
// START SERVER
// =========================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   📱 Samsung Wallet Backend (Flow B) ║
║   🚀 Running on port ${PORT}         ║
║   📍 http://localhost:${PORT}        ║
╚══════════════════════════════════════╝
`);
});
