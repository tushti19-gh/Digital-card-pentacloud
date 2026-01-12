// ============================================
// FILE: backend/server.js
// SAMSUNG WALLET ONLY (CLEAN & SAFE)
// ============================================

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// BASIC SETUP
// ============================================

console.log('🔥 Samsung Wallet server starting...');

app.use(cors({
  origin: [
    'https://digital-card-pentacloud.vercel.app',
    'http://localhost:5173'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// ============================================
// SAMSUNG CONFIG
// ============================================

const SAMSUNG_CONFIG = {
  PARTNER_CODE: '4137610299143138240',
  CARD_ID: '3ir7iadicu000'
};

const SAMSUNG_PRIVATE_KEY = process.env.SAMSUNG_PRIVATE_KEY;

if (!SAMSUNG_PRIVATE_KEY) {
  console.warn('⚠️ SAMSUNG_PRIVATE_KEY not set – Samsung Wallet will fail in prod');
}

// ============================================
// SAMSUNG JWT GENERATION
// ============================================

function generateSamsungJWT(cardData) {
  const payload = {
    iss: SAMSUNG_CONFIG.PARTNER_CODE,
    aud: 'samsung',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 300,
    card: {
      type: 'generic',
      subType: 'others',
      data: [{
        refId: `ref-${Date.now()}`,
        language: 'en',
        attributes: {
          title: cardData.title || 'Digital Business Card',
          subtitle: cardData.subtitle || 'Professional',
          appLinkData: cardData.qrValue,
          bgColor: '#0A1A4F',
          fontColor: 'light'
        }
      }]
    }
  };

  return jwt.sign(payload, SAMSUNG_PRIVATE_KEY, {
    algorithm: 'RS256',
    header: {
      cty: 'CARD',
      ver: 2
    }
  });
}

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/api/samsung-wallet/health', (req, res) => {
  res.json({
    status: 'OK',
    wallet: 'Samsung',
    partnerCode: SAMSUNG_CONFIG.PARTNER_CODE,
    cardId: SAMSUNG_CONFIG.CARD_ID,
    timestamp: new Date().toISOString()
  });
});

// Generate token
app.post('/api/samsung-wallet/generate-token', (req, res) => {
  try {
    const { cardData } = req.body;

    if (!cardData || !cardData.qrValue) {
      return res.status(400).json({
        success: false,
        error: 'cardData.qrValue is required'
      });
    }

    const token = generateSamsungJWT(cardData);

    res.json({
      success: true,
      token,
      partnerCode: SAMSUNG_CONFIG.PARTNER_CODE,
      cardId: SAMSUNG_CONFIG.CARD_ID
    });

  } catch (error) {
    console.error('❌ Samsung Wallet error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// 404 HANDLER
// ============================================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

// ============================================
// EXPORT / START
// ============================================

if (process.env.VERCEL) {
  module.exports = app;
} else {
  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║   📱 Samsung Wallet Backend         ║
║   🚀 Running on port ${PORT}              ║
║   📍 http://localhost:${PORT}            ║
╚══════════════════════════════════════╝
    `);
  });
}
