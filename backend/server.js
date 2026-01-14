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

app.use(cors({
  origin: '*',
  allowedHeaders: ['Authorization', 'Content-Type', 'x-request-id']
}));

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
  try {
    console.log('🔥 Samsung Get Card Data API hit');

    const { cardId, refId } = req.params;
    const now = Date.now();

    res
      .status(200) // ✅ MUST be 200
      .set('Content-Type', 'application/json')
      .json({
        card: {
          type: 'generic',
          subType: 'others',
          data: [
            {
              refId,
              createdAt: now,
              updatedAt: now,
              state: 'ACTIVE',
              language: 'en',
              attributes: {
                title: 'Digital Business Card',
                subtitle: 'Employee Identity',
                providerName: 'Pentacloud Consulting',
                appLinkData: 'https://example.com',

                // ✅ startDate ONLY here
                startDate: now
              }
            }
          ]
        }
      });

  } catch (err) {
    console.error('❌ Error in Get Card Data:', err);

    // ⚠️ Even on error, DO NOT return 404
    res.status(500).json({ error: 'Internal Server Error' });
  }
});








// =========================
// START SERVER
// =========================
app.use((req, res, next) => {
  console.warn('⚠️ Unhandled route:', req.method, req.url);
  res.status(200).json({}); // prevent 404s for Samsung retries
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║   📱 Samsung Wallet Backend (Flow B) ║
║   🚀 Running on port ${PORT}         ║
║   📍 http://localhost:${PORT}        ║
╚══════════════════════════════════════╝
`);
});
