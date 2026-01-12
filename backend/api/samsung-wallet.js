// ============================================
// FILE: api/samsung-wallet.js
// Vercel Serverless Compatible (FIXED)
// ============================================

const SAMSUNG_CONFIG = {
  PARTNER_CODE: '4137610299143138240',
  CARD_ID: '3ir7iadicu000',
  PRIVATE_KEY: process.env.SAMSUNG_PRIVATE_KEY
};

// ============================================
// CORS HEADERS (serverless-safe)
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Origin':
    'https://digital-card-pentacloud-mpxy60e03-tushti19-ghs-projects.vercel.app',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ============================================
// In-memory card store
// ============================================
const cardStore = new Map();

cardStore.set(SAMSUNG_CONFIG.CARD_ID, {
  cardId: SAMSUNG_CONFIG.CARD_ID,
  status: 'ACTIVE',
  title: 'Digital Business Card',
  subtitle: 'Employee Identity',
  description: 'Employee digital identity card',
  qrValue: 'https://example.com/card/sample'
});

// ============================================
// JWT TOKEN GENERATION
// ============================================
function generateJWTToken(cardData) {
  const header = {
    alg: 'RS256',
    cty: 'CARD',
    ver: 2,
    partnerId: SAMSUNG_CONFIG.PARTNER_CODE,
    utc: Date.now()
  };

  const payload = {
    card: {
      type: 'generic',
      subType: 'others',
      data: [{
        refId: `ref-${Date.now()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        language: 'en',
        attributes: {
          title: cardData.title || 'Digital Business Card',
          subtitle: cardData.subtitle || 'Employee',
          providerName: 'Digital Card',
          appLinkLogo: 'https://via.placeholder.com/256',
          appLinkName: 'Digital Card',
          appLinkData: cardData.qrValue,
          bgColor: '#0A1A4F',
          fontColor: 'light'
        }
      }]
    }
  };

  const base64Header = Buffer
    .from(JSON.stringify(header))
    .toString('base64url');

  const base64Payload = Buffer
    .from(JSON.stringify(payload))
    .toString('base64url');

  return `${base64Header}.${base64Payload}.test-signature`;
}

// ============================================
// MAIN HANDLER (Vercel-compatible)
// ============================================
export default async function handler(req, res) {

  // ---- Apply CORS headers ----
  Object.entries(corsHeaders).forEach(([k, v]) =>
    res.setHeader(k, v)
  );

  // ---- Handle preflight ----
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const urlObj = new URL(req.url, `https://${req.headers.host}`);
  const path = urlObj.pathname.replace('/api/samsung-wallet', '');

  console.log('🔔 Samsung Wallet Request:', req.method, path);

  try {

    // =============================
    // ROUTE 1: Health Check
    // =============================
    if (
      req.method === 'GET' &&
      (path === '' || path === '/' || path === '/health')
    ) {
      return res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        partnerId: SAMSUNG_CONFIG.PARTNER_CODE,
        cardId: SAMSUNG_CONFIG.CARD_ID
      });
    }

    // =============================
    // ROUTE 2: Generate JWT Token
    // =============================
    if (req.method === 'POST' && path === '/generate-token') {

      // 🔥 FIX: Manually parse body (req.body is undefined on Vercel)
      let rawBody = '';
      for await (const chunk of req) {
        rawBody += chunk;
      }

      const parsedBody = JSON.parse(rawBody || '{}');
      const { cardData } = parsedBody;

      if (!cardData || !cardData.qrValue) {
        return res.status(400).json({
          error: 'cardData with qrValue is required'
        });
      }

      const token = generateJWTToken(cardData);

      return res.status(200).json({
        success: true,
        token,
        cardId: SAMSUNG_CONFIG.CARD_ID,
        partnerCode: SAMSUNG_CONFIG.PARTNER_CODE
      });
    }

    // =============================
    // ROUTE 3: Get Card Data
    // =============================
    if (req.method === 'GET' && path.startsWith('/cards/')) {
      const [, cardId, refId] = path.split('/').filter(Boolean);

      const card = cardStore.get(cardId);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }

      return res.status(200).json({
        refId,
        cardStatus: card.status,
        cardData: {
          title: card.title,
          subtitle: card.subtitle,
          description: card.description,
          qrValue: card.qrValue
        }
      });
    }

    // =============================
    // ROUTE 4: Samsung Callback
    // =============================
    if (req.method === 'POST' && path.startsWith('/cards/')) {
      const [, cardId, refId] = path.split('/').filter(Boolean);

      console.log('📨 Samsung callback:', cardId, refId);

      return res.status(200).json({
        result: 'SUCCESS',
        refId
      });
    }

    // =============================
    // NOT FOUND
    // =============================
    return res.status(404).json({
      error: 'Route not found',
      path,
      method: req.method
    });

  } catch (err) {
    console.error('💥 Server error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
}
