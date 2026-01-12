// ============================================
// FILE: api/samsung-wallet.js
// FIXED - Vercel Serverless Function
// ============================================

// ============================================
// CONFIGURATION
// ============================================
const SAMSUNG_CONFIG = {
  PARTNER_CODE: '4137610299143138240',
  ISSUER_ID: '4137948898276138496',

  CARD_ID: '3ir7iadicu000'
};

// ============================================
// CORS HEADERS
// ============================================
const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'ngrok-skip-browser-warning': 'true'
};

// ============================================
// IN-MEMORY CARD STORE
// ============================================
const cardStore = new Map();

// Initialize default card
cardStore.set(SAMSUNG_CONFIG.CARD_ID, {
  cardId: SAMSUNG_CONFIG.CARD_ID,
  status: 'ACTIVE',
  title: 'Digital Business Card',
  subtitle: 'Employee Identity',
  description: 'Employee digital identity card',
  qrValue: 'https://example.com/card/sample'
});

// ============================================
// JWT TOKEN GENERATION (Simple version)
// ============================================
function generateSimpleToken(cardData) {
  // For testing without JWT library
  const payload = {
    iss: SAMSUNG_CONFIG.PARTNER_CODE,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24),
    cardId: SAMSUNG_CONFIG.CARD_ID,
    cardData: {
      cardInfo: {
        cardDesignType: 'GENERIC_01',
        title: cardData.title || 'Digital Business Card',
        subtitle: cardData.subtitle || 'Employee Identity',
        description: cardData.description || 'Employee digital identity card'
      },
      barcode: {
        format: 'QR_CODE',
        value: cardData.qrValue
      }
    }
  };
  
  // Convert to base64 (temporary solution)
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `test.${base64Payload}.test`;
}

// ============================================
// MAIN HANDLER
// ============================================
module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const { method, url } = req;
  console.log('🔔 Request:', method, url);

  try {
    // Parse URL path
    const urlObj = new URL(url, `https://${req.headers.host}`);
    const path = urlObj.pathname.replace('/api/samsung-wallet', '');
    
    // ============================================
    // ROUTE 1: Health Check
    // ============================================
    if (method === 'GET' && (path === '/health' || path === '/' || path === '')) {
      return res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        config: {
          partnerId: SAMSUNG_CONFIG.PARTNER_CODE,
          cardId: SAMSUNG_CONFIG.CARD_ID,
          issuerId: SAMSUNG_CONFIG.ISSUER_ID,
        }
      });
    }

    // ============================================
    // ROUTE 2: Generate Token
    // ============================================
    if (method === 'POST' && path === '/generate-token') {
      const { cardData } = req.body;
      
      if (!cardData || !cardData.qrValue) {
        return res.status(400).json({ 
          error: 'cardData with qrValue is required' 
        });
      }

      const token = generateSimpleToken(cardData);
      
      return res.status(200).json({
        success: true,
        token: token,
        cardId: SAMSUNG_CONFIG.CARD_ID,
        partnerCode: SAMSUNG_CONFIG.PARTNER_CODE
      });
    }

    // ============================================
    // ROUTE 3: Create Card
    // ============================================
    if (method === 'POST' && path === '/create') {
      const { publicCardUrl, title, subtitle, description } = req.body;
      
      if (!publicCardUrl) {
        return res.status(400).json({ error: 'publicCardUrl required' });
      }

      // Update card in store
      if (cardStore.has(SAMSUNG_CONFIG.CARD_ID)) {
        const card = cardStore.get(SAMSUNG_CONFIG.CARD_ID);
        card.qrValue = publicCardUrl;
        card.title = title || card.title;
        card.subtitle = subtitle || card.subtitle;
        card.description = description || card.description;
      }

      // Generate token
      const token = generateSimpleToken({
        qrValue: publicCardUrl,
        title,
        subtitle,
        description
      });

      return res.status(200).json({
        success: true,
        cardId: SAMSUNG_CONFIG.CARD_ID,
        token: token,
        partnerCode: SAMSUNG_CONFIG.PARTNER_CODE,
        rdClickUrl: `https://us-rd.mcsvc.samsung.com/statistics/click/addtowlt?ep=C50C3754FEB24833B30C10B275BB6AB8;cc=GC;ii=4063269063441135936;co=4137610299143138240;cp=1288017491089625089;si=24;pg=4058691328745130560;pi=Aqz68EBXSx6Mv9jsaZxzaA;tp=4137948898276138496;li=0`,
        rdImpressionUrl: `https://us-rd.mcsvc.samsung.com/statistics/impression/addtowlt?ep=C50C3754FEB24833B30C10B275BB6AB8;cc=GC;ii=4063269063441135936;co=4137610299143138240;cp=1288017491089625089;si=24;pg=4058691328745130560;pi=Aqz68EBXSx6Mv9jsaZxzaA;tp=4137948898276138496;li=0`
      });
    }

    // ============================================
    // ROUTE 4: Get Card Data (Samsung Verification)
    // ============================================
    if (method === 'GET' && path.startsWith('/cards/')) {
      const pathParts = path.split('/').filter(Boolean);
      const cardId = pathParts[1];
      const refId = pathParts[2];
      
      console.log('🔍 Get Card Data - CardID:', cardId, 'RefID:', refId);

      const card = cardStore.get(cardId);

      if (!card) {
        return res.status(404).json({ 
          error: 'Card not found',
          requestedCardId: cardId
        });
      }

      return res.status(200).json({
        refId: refId,
        cardStatus: card.status,
        cardData: {
          cardInfo: {
            cardDesignType: 'GENERIC_01',
            title: card.title,
            subtitle: card.subtitle,
            description: card.description
          },
          barcode: {
            format: 'QR_CODE',
            value: card.qrValue
          }
        }
      });
    }

    // ============================================
    // ROUTE 5: Send Card State (Samsung Event)
    // ============================================
    if (method === 'POST' && path.startsWith('/cards/')) {
      const pathParts = path.split('/').filter(Boolean);
      const cardId = pathParts[1];
      const refId = pathParts[2];
      
      console.log('📨 Card State Event - CardID:', cardId, 'RefID:', refId);

      if (cardStore.has(cardId)) {
        const card = cardStore.get(cardId);
        card.status = 'ACTIVE';
        card.lastEventTime = new Date().toISOString();
      }

      return res.status(200).json({
        result: 'SUCCESS',
        refId: refId
      });
    }

    // Route not found
    return res.status(404).json({ 
      error: 'Route not found',
      path: path,
      method: method
    });

  } catch (error) {
    console.error('💥 Error:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};