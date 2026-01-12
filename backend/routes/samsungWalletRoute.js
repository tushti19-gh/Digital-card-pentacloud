import express from 'express';

const router = express.Router();

const SAMSUNG_CONFIG = {
  PARTNER_CODE: '4137610299143138240',
  CARD_ID: '3ir7iadicu000'
};

// In-memory card store (replace with DB later)
const cardStore = new Map();

cardStore.set(SAMSUNG_CONFIG.CARD_ID, {
  cardId: SAMSUNG_CONFIG.CARD_ID,
  status: 'ACTIVE',
  title: 'Digital Business Card',
  subtitle: 'Employee Identity',
  description: 'Employee digital identity card',
  qrValue: 'https://example.com/card/sample'
});

// ==============================
// HEALTH CHECK
// ==============================
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    wallet: 'Samsung',
    timestamp: new Date().toISOString()
  });
});

// ==============================
// GENERATE TOKEN
// ==============================
router.post('/generate-token', (req, res) => {
  const { cardData } = req.body;

  if (!cardData || !cardData.qrValue) {
    return res.status(400).json({
      error: 'cardData.qrValue is required'
    });
  }

  const header = Buffer.from(JSON.stringify({
    alg: 'RS256',
    cty: 'CARD',
    ver: 2
  })).toString('base64url');

  const payload = Buffer.from(JSON.stringify({
    card: {
      type: 'generic',
      subType: 'others',
      data: [{
        refId: `ref-${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        language: 'en',
        attributes: {
          title: cardData.title,
          subtitle: cardData.subtitle,
          appLinkData: cardData.qrValue,
          bgColor: '#0A1A4F',
          fontColor: 'light'
        }
      }]
    }
  })).toString('base64url');

  const token = `${header}.${payload}.test-signature`;

  res.json({
    success: true,
    token,
    cardId: SAMSUNG_CONFIG.CARD_ID,
    partnerCode: SAMSUNG_CONFIG.PARTNER_CODE
  });
});

export default router;
