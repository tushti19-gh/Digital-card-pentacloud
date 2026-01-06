// ============================================
// FILE: backend/server.js
// VERCEL SERVERLESS - Single deployment
// ============================================

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// CONFIGURATION VALIDATION & CREDENTIALS LOADING
// ============================================
console.log('🔍 Checking configuration...');

const ISSUER_ID = process.env.ISSUER_ID;

if (!ISSUER_ID) {
  console.error('❌ ISSUER_ID not found in environment variables');
  process.exit(1);
}

// Load credentials from environment variable or file
let credentials;
try {
  if (process.env.GOOGLE_WALLET_CREDENTIALS) {
    // Production: Use environment variable (Vercel)
    console.log('📦 Loading credentials from environment variable...');
    credentials = JSON.parse(process.env.GOOGLE_WALLET_CREDENTIALS);
    console.log('✅ Credentials loaded from environment');
  } else {
    // Development: Use local file
    console.log('📁 Loading credentials from local file...');
    const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './google-wallet-key.json';
    
    if (!fs.existsSync(CREDENTIALS_PATH)) {
      console.error(`❌ Credentials file not found: ${CREDENTIALS_PATH}`);
      console.log('Please place your google-wallet-key.json file in the backend folder');
      process.exit(1);
    }
    
    credentials = JSON.parse(fs.readFileSync(path.resolve(CREDENTIALS_PATH), 'utf8'));
    console.log('✅ Credentials loaded from file');
  }
} catch (error) {
  console.error('❌ Error loading credentials:', error.message);
  process.exit(1);
}

console.log('✅ ISSUER_ID:', ISSUER_ID);

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['POST', 'GET', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================
// GOOGLE AUTH CLIENT
// ============================================
const auth = new GoogleAuth({
  credentials: credentials,
  scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
});

const baseUrl = 'https://walletobjects.googleapis.com/walletobjects/v1';
let authClient = null;

async function getAuthClient() {
  if (!authClient) {
    authClient = await auth.getClient();
  }
  return authClient;
}

// Make authenticated API request
async function makeApiRequest(endpoint, method = 'GET', body = null) {
  const client = await getAuthClient();
  const url = `${baseUrl}${endpoint}`;
  
  const options = {
    method: method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await client.request({ url, ...options });
  return response.data;
}

// ============================================
// HELPER: Format hex color for Google Wallet
// ============================================
function formatHexColor(color) {
  if (!color) return '#1e293b';
  let hex = color.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    console.warn(`⚠️  Invalid color format: ${color}, using default`);
    return '#1e293b';
  }
  return `#${hex}`;
}

// ============================================
// HELPER: Validate and get image URL
// ============================================
function getValidImageUrl(url, type = 'logo') {
  if (!url || url.includes('placeholder')) {
    console.log(`ℹ️  No valid ${type} URL provided, skipping ${type}`);
    return null;
  }
  
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') {
      console.warn(`⚠️  ${type} URL must use HTTPS: ${url}`);
      return null;
    }
    return url;
  } catch (error) {
    console.warn(`⚠️  Invalid ${type} URL: ${url}`);
    return null;
  }
}

// ============================================
// CREATE/UPDATE GENERIC CLASS
// ============================================
async function ensureGenericClass() {
  const classId = `${ISSUER_ID}.business_card_class`;
  
  const genericClass = {
    id: classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{
                    fieldPath: "object.textModulesData['name']"
                  }]
                }
              },
              endItem: {
                firstValue: {
                  fields: [{
                    fieldPath: "object.textModulesData['title']"
                  }]
                }
              }
            }
          },
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{
                    fieldPath: "object.textModulesData['email']"
                  }]
                }
              },
              endItem: {
                firstValue: {
                  fields: [{
                    fieldPath: "object.textModulesData['phone']"
                  }]
                }
              }
            }
          }
        ]
      }
    }
  };

  try {
    await makeApiRequest(`/genericClass/${classId}`, 'GET');
    console.log('✅ Generic class exists');
    return classId;
  } catch (error) {
    if (error.code === 404 || error.response?.status === 404) {
      try {
        await makeApiRequest('/genericClass', 'POST', genericClass);
        console.log('✅ Generic class created');
        return classId;
      } catch (insertError) {
        console.error('❌ Error creating class:', insertError.message);
        throw insertError;
      }
    } else {
      console.error('❌ Error checking class:', error.message);
      throw error;
    }
  }
}

// ============================================
// CREATE/UPDATE WALLET PASS
// ============================================
async function createWalletPass(cardData) {
  const objectId = `${ISSUER_ID}.${cardData.userId || Date.now()}`;
  const classId = `${ISSUER_ID}.business_card_class`;

  const logoUrl = getValidImageUrl(cardData.avatarUrl, 'logo');
  const bannerUrl = getValidImageUrl(cardData.bannerUrl, 'banner');

  const genericObject = {
    id: objectId,
    classId: classId,
    state: 'ACTIVE',
    
    cardTitle: {
      defaultValue: {
        language: 'en-US',
        value: cardData.fullName || 'Business Card'
      }
    },
    
    header: {
      defaultValue: {
        language: 'en-US',
        value: cardData.jobTitle || 'Professional'
      }
    },
    
    subheader: {
      defaultValue: {
        language: 'en-US',
        value: cardData.companyName || ''
      }
    },
    
    textModulesData: [
      { id: 'name', header: 'Name', body: cardData.fullName || '' },
      { id: 'title', header: 'Title', body: cardData.jobTitle || '' },
      { id: 'email', header: 'Email', body: cardData.workEmail || '' },
      { id: 'phone', header: 'Phone', body: cardData.workPhone || '' },
      { id: 'company', header: 'Company', body: cardData.companyName || '' },
      { id: 'website', header: 'Website', body: cardData.website || '' },
      { 
        id: 'address', 
        header: 'Location', 
        body: [cardData.address, cardData.city, cardData.country]
          .filter(Boolean).join(', ')
      }
    ].filter(module => module.body),
    
    barcode: {
      type: 'QR_CODE',
      value: cardData.publicCardUrl || 'https://example.com',
      alternateText: 'Scan to view full card'
    },
    
    linksModuleData: {
      uris: [{
        uri: cardData.publicCardUrl || 'https://example.com',
        description: 'View Full Digital Card',
        id: 'official_site'
      }]
    },
    
    hexBackgroundColor: formatHexColor(cardData.themeColor)
  };

  if (logoUrl) {
    genericObject.logo = {
      sourceUri: {
        uri: logoUrl
      },
      contentDescription: {
        defaultValue: {
          language: 'en-US',
          value: 'Profile Picture'
        }
      }
    };
  }

  if (bannerUrl) {
    genericObject.heroImage = {
      sourceUri: {
        uri: bannerUrl
      },
      contentDescription: {
        defaultValue: {
          language: 'en-US',
          value: 'Banner'
        }
      }
    };
  }

  try {
    await makeApiRequest('/genericObject', 'POST', genericObject);
    console.log('✅ Wallet object created:', objectId);
    return objectId;
  } catch (error) {
    if (error.code === 409 || error.response?.status === 409) {
      try {
        await makeApiRequest(`/genericObject/${objectId}`, 'PUT', genericObject);
        console.log('✅ Wallet object updated:', objectId);
        return objectId;
      } catch (updateError) {
        console.error('❌ Error updating object:', updateError.message);
        throw updateError;
      }
    } else {
      console.error('❌ Error creating object:', error.message);
      throw error;
    }
  }
}

// ============================================
// GENERATE SAVE URL
// ============================================
function generateSaveUrl(objectId) {
  const classId = `${ISSUER_ID}.business_card_class`;
  
  const claims = {
    iss: credentials.client_email,
    aud: 'google',
    origins: [process.env.FRONTEND_URL || 'http://localhost:5173'],
    typ: 'savetowallet',
    payload: {
      genericObjects: [{
        id: objectId,
        classId: classId
      }]
    }
  };

  const token = jwt.sign(claims, credentials.private_key, {
    algorithm: 'RS256'
  });

  return `https://pay.google.com/gp/v/save/${token}`;
}

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'Google Wallet Backend API',
    version: '1.0.1',
    timestamp: new Date().toISOString(),
    ready: true,
    environment: process.env.GOOGLE_WALLET_CREDENTIALS ? 'production' : 'development',
    endpoints: {
      health: 'GET /',
      createPass: 'POST /api/create-wallet-pass',
      updatePass: 'POST /api/update-wallet-pass',
      initClass: 'POST /api/init-class'
    }
  });
});

app.get('/api', (req, res) => {
  res.json({ 
    status: 'online',
    message: 'Backend API is running'
  });
});

// Initialize class
app.post('/api/init-class', async (req, res) => {
  try {
    console.log('📋 Initializing Google Wallet class...');
    const classId = await ensureGenericClass();
    res.json({ 
      success: true,
      classId: classId,
      message: 'Generic class initialized successfully'
    });
  } catch (error) {
    console.error('❌ Error initializing class:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      details: error.errors || []
    });
  }
});

// Create wallet pass
app.post('/api/create-wallet-pass', async (req, res) => {
  try {
    console.log('📱 Creating wallet pass...');
    const cardData = req.body;
    
    if (!cardData.fullName) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: fullName'
      });
    }

    if (!cardData.publicCardUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: publicCardUrl'
      });
    }

    await ensureGenericClass();
    const objectId = await createWalletPass(cardData);
    const saveUrl = generateSaveUrl(objectId);

    console.log('✅ Wallet pass created successfully');

    res.json({
      success: true,
      saveUrl: saveUrl,
      objectId: objectId,
      message: 'Wallet pass created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating wallet pass:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.errors || []
    });
  }
});

// Update existing pass
app.post('/api/update-wallet-pass', async (req, res) => {
  try {
    console.log('🔄 Updating wallet pass...');
    const cardData = req.body;
    
    if (!cardData.userId) {
      return res.status(400).json({
        success: false,
        error: 'Missing userId'
      });
    }

    const objectId = `${ISSUER_ID}.${cardData.userId}`;
    await createWalletPass(cardData);
    
    console.log('✅ Wallet pass updated successfully');
    
    res.json({
      success: true,
      message: 'Wallet pass updated successfully',
      objectId: objectId
    });

  } catch (error) {
    console.error('❌ Error updating wallet pass:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: err.message
  });
});

// ============================================
// EXPORT FOR VERCEL SERVERLESS
// ============================================
if (process.env.VERCEL) {
  // Vercel serverless function
  module.exports = app;
} else {
  // Local development server
  app.listen(PORT, async () => {
    const env = process.env.GOOGLE_WALLET_CREDENTIALS ? '☁️  Production (Vercel)' : '💻 Development (Local)';
    
    console.log(`
╔════════════════════════════════════════════╗
║   🎫 Google Wallet Backend API            ║
║   🚀 Running on port ${PORT}                  ║
║   📍 http://localhost:${PORT}                ║
║   ${env}                    ║
╚════════════════════════════════════════════╝

✅ Configuration:
   • Issuer ID: ${ISSUER_ID}
   • Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}
   • Credentials: ${process.env.GOOGLE_WALLET_CREDENTIALS ? 'Environment Variable' : 'Local File'}

🔗 Endpoints:
   GET  / - Health check
   POST /api/init-class - Initialize wallet class
   POST /api/create-wallet-pass - Create new pass
   POST /api/update-wallet-pass - Update existing pass
    `);

    try {
      console.log('⏳ Initializing Google Wallet class...');
      await ensureGenericClass();
      console.log('✅ Generic class ready');
      console.log('\n🎉 Server is ready to accept requests!\n');
    } catch (error) {
      console.error('⚠️  Could not auto-initialize class:', error.message);
      console.log('You can manually initialize with: npm run backend:init\n');
    }
  });
}