// ============================================
// FILE: api/samsung-wallet.js  
// CRITICAL: This file MUST be in api/ folder, NOT backend/
// ============================================

const SAMSUNG_CONFIG = {
  PARTNER_CODE: '4137610299143138240',
  CARD_ID: '3ir7iadicu000',
  PRIVATE_KEY: import.meta.env.SAMSUNG_PRIVATE_KEY
};

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': 'https://digital-card-pentacloud-mpxy60e03-tushti19-ghs-projects.vercel.app', // Change to your domain in production
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// In-memory card store (use database in production)
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
// JWT TOKEN GENERATION
// ============================================
function generateJWTToken(cardData) {
  // Simple JWT-like token for testing
  // In production, use proper JWT with RS256 signing
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
          startDate: Date.now(),
          endDate: Date.now() + (365 * 24 * 60 * 60 * 1000), // 1 year
          mainImg: 'https://via.placeholder.com/512',
          noticeDesc: JSON.stringify({
            count: 1,
            info: [{
              title: 'Notice',
              content: [cardData.description || 'Digital Business Card']
            }]
          }),
          appLinkLogo: 'https://via.placeholder.com/256',
          appLinkName: 'Digital Card',
          appLinkData: cardData.qrValue,
          bgColor: '#0A1A4F',
          fontColor: 'light',
          serial1: {
            value: cardData.qrValue,
            serialType: 'QRCODE',
            ptFormat: 'QRCODE',
            ptSubFormat: 'QR_CODE'
          }
        }
      }]
    }
  };

  // Base64 encode (simplified - use proper JWT library in production)
  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  
  // For testing, return a simple token
  // In production, sign with your SAMSUNG_PRIVATE_KEY
  return `${base64Header}.${base64Payload}.test-signature`;
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

  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  const { method, url } = req;
  console.log('🔔 Samsung Wallet Request:', method, url);

  try {
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
          cardId: SAMSUNG_CONFIG.CARD_ID
        }
      });
    }

    // ============================================
    // ROUTE 2: Generate JWT Token (Main endpoint)
    // ============================================
    if (method === 'POST' && path === '/generate-token') {
      console.log('🔐 Generating JWT token...');
      
      const { cardData } = req.body;
      
      if (!cardData || !cardData.qrValue) {
        return res.status(400).json({ 
          error: 'cardData with qrValue is required' 
        });
      }

      const token = generateJWTToken(cardData);
      
      console.log('✅ Token generated successfully');
      
      return res.status(200).json({
        success: true,
        token: token,
        cardId: SAMSUNG_CONFIG.CARD_ID,
        partnerCode: SAMSUNG_CONFIG.PARTNER_CODE
      });
    }

    // ============================================
    // ROUTE 3: Get Card Data (Samsung Verification)
    // ============================================
    if (method === 'GET' && path.startsWith('/cards/')) {
      const pathParts = path.split('/').filter(Boolean);
      const cardId = pathParts[1];
      const refId = pathParts[2];
      
      console.log('🔍 Samsung verification - CardID:', cardId, 'RefID:', refId);

      const card = cardStore.get(cardId);

      if (!card) {
        return res.status(404).json({ 
          error: 'Card not found'
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
    // ROUTE 4: Send Card State (Samsung Callback)
    // ============================================
    if (method === 'POST' && path.startsWith('/cards/')) {
      const pathParts = path.split('/').filter(Boolean);
      const cardId = pathParts[1];
      const refId = pathParts[2];
      
      console.log('📨 Samsung callback - CardID:', cardId, 'RefID:', refId);

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
      error: error.message
    });
  }
};