// ============================================
// FILE: src/utils/walletIntegration/samsungWallet.js
// CORRECTED VERSION
// ============================================

// ============================================
// SAMSUNG WALLET CONFIGURATION
// ============================================
const SAMSUNG_CONFIG = {
  PARTNER_CODE: '4137610299143138240',
  CARD_ID: '3ir7iadicu000',
  BACKEND_URL: process.env.REACT_APP_SAMSUNG_BACKEND_URL || 'https://digital-card-pentacloud-rdmhkz80o-tushti19-ghs-projects.vercel.app',
  SAMSUNG_SCRIPT_URL: 'https://us-cdn-gpp.mcsvc.samsung.com/lib/wallet-card.js',
  RD_CLICK_URL: 'https://us-rd.mcsvc.samsung.com/statistics/click/addtowlt?ep=C50C3754FEB24833B30C10B275BB6AB8;cc=GC;ii=4063269063441135936;co=4137610299143138240;cp=1288017491089625089;si=24;pg=4058691328745130560;pi=Aqz68EBXSx6Mv9jsaZxzaA;tp=4137948898276138496;li=0',
  RD_IMPRESSION_URL: 'https://us-rd.mcsvc.samsung.com/statistics/impression/addtowlt?ep=C50C3754FEB24833B30C10B275BB6AB8;cc=GC;ii=4063269063441135936;co=4137610299143138240;cp=1288017491089625089;si=24;pg=4058691328745130560;pi=Aqz68EBXSx6Mv9jsaZxzaA;tp=4137948898276138496;li=0'
};

// Load Samsung Wallet script
let scriptLoaded = false;
let scriptLoading = false;

const loadSamsungScript = () => {
  return new Promise((resolve, reject) => {
    if (window.samsungWallet) {
      scriptLoaded = true;
      resolve();
      return;
    }

    if (scriptLoading) {
      // Wait for existing load to complete
      const checkInterval = setInterval(() => {
        if (scriptLoaded) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      return;
    }

    scriptLoading = true;

    const script = document.createElement('script');
    script.src = SAMSUNG_CONFIG.SAMSUNG_SCRIPT_URL;
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      console.log('✅ Samsung Wallet script loaded');
      scriptLoaded = true;
      scriptLoading = false;
      resolve();
    };
    script.onerror = () => {
      console.error('❌ Failed to load Samsung Wallet script');
      scriptLoading = false;
      reject(new Error('Failed to load Samsung Wallet script'));
    };
    document.body.appendChild(script);
  });
};

// ============================================
// SAMSUNG WALLET - ADD TO WALLET
// ============================================
export const addToSamsungWallet = async (formData, publicCardUrl) => {
  return new Promise(async (resolve, reject) => {
    try {
      if (!publicCardUrl) {
        reject(new Error('Card must be published first'));
        return;
      }

      console.log('📱 Adding to Samsung Wallet...');

      // Step 1: Load Samsung's script
      await loadSamsungScript();

      // Step 2: Get JWT token from backend
      console.log('🔐 Requesting token from backend...');
      const response = await fetch(`${SAMSUNG_CONFIG.BACKEND_URL}/api/samsung-wallet/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          publicCardUrl: publicCardUrl,
          title: formData.fullName || 'Digital Business Card',
          subtitle: `${formData.jobTitle || 'Professional'}${formData.companyName ? ` @ ${formData.companyName}` : ''}`,
          description: 'Employee digital identity card'
        })
      });
      console.log('🌐 Backend response received');
      if (!response.ok) {
        throw new Error(`Backend error: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Token received');

      if (!result.token) {
        throw new Error('No token received from backend');
      }

      // Step 3: Create temporary container for Samsung button
      const containerId = `samsung-wallet-temp-${Date.now()}`;
      const container = document.createElement('div');
      container.id = containerId;
      container.style.position = 'fixed';
      container.style.top = '-9999px';
      container.style.left = '-9999px';
      document.body.appendChild(container);

      // Step 4: Initialize Samsung Wallet button
      window.samsungWallet.addButton({
        partnerCode: SAMSUNG_CONFIG.PARTNER_CODE,
        cardId: SAMSUNG_CONFIG.CARD_ID,
        cdata: result.token,
        RDClickUrl: result.rdClickUrl || SAMSUNG_CONFIG.RD_CLICK_URL,
        RDImpressionUrl: result.rdImpressionUrl || SAMSUNG_CONFIG.RD_IMPRESSION_URL,
        targetId: containerId,
        buttonId: `${containerId}-btn`
      });

      console.log('✅ Samsung Wallet button initialized');

      // Step 5: Auto-click the generated button
      setTimeout(() => {
        const generatedButton = document.querySelector(`#${containerId} a, #${containerId} button`);
        if (generatedButton) {
          console.log('🔗 Triggering Samsung Wallet...');
          generatedButton.click();
          
          // Cleanup after delay
          setTimeout(() => {
            if (container.parentNode) {
              container.parentNode.removeChild(container);
            }
          }, 1000);
          
          resolve({
            success: true,
            message: `✅ SAMSUNG WALLET

🎉 Opening Samsung Wallet...

WHAT HAPPENS NEXT:
• Samsung Wallet page opens in new tab/window
• Click "Add to Wallet" button
• Card will be saved to your Samsung Wallet

FEATURES:
✓ Works on Samsung devices
✓ Accessible offline after adding
✓ QR code for quick sharing
✓ Auto-syncs across devices

CARD INFO:
• Partner Code: ${SAMSUNG_CONFIG.PARTNER_CODE}
• Card ID: ${SAMSUNG_CONFIG.CARD_ID}
• Status: Active

💡 TIP: Works best on Samsung devices with
   Samsung Wallet app installed.`
          });
        } else {
          throw new Error('Samsung Wallet button not generated');
        }
      }, 500);

    } catch (error) {
      console.error('❌ Samsung Wallet Error:', error);
      
      let errorMessage = error.message;
      
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        errorMessage = `Cannot connect to backend server.

⚠️ BACKEND CONNECTION ERROR

Backend URL: ${SAMSUNG_CONFIG.BACKEND_URL}

Please check:
1. Backend is deployed and running
2. REACT_APP_SAMSUNG_BACKEND_URL is set correctly
3. CORS is enabled for your domain
4. API route is accessible

Error: ${error.message}`;
      } else if (error.message.includes('script')) {
        errorMessage = `Failed to load Samsung Wallet library.

⚠️ SCRIPT LOADING ERROR

This could be due to:
• Ad blockers
• Network issues
• Samsung CDN unavailable

Try:
• Disable ad blocker
• Check internet connection
• Try again in a few moments`;
      }
      
      reject(new Error(errorMessage));
    }
  });
};