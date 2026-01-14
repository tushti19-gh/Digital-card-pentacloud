// ============================================
// FILE: src/utils/walletIntegration/samsungWallet.js
// Samsung Wallet – FLOW B (Data Fetch Link)
// ============================================

export const addToSamsungWallet = async (formData, publicCardUrl) => {
  if (!publicCardUrl) {
    throw new Error('Please publish your card first');
  }

  // ⚠️ MUST come from Samsung Portal
  const CERTIFICATE_ID = 'zAtI'; // <-- replace with your real Certificate ID
  const CARD_ID = '3ir7iadicu000';

  // Unique per user/card
  const refId = `ref-${Date.now()}`;

  const samsungUrl =
    `https://a.swallet.link/atw/v3/${CERTIFICATE_ID}/${CARD_ID}` +
    `#Clip?pdata=${encodeURIComponent(refId)}`;

  // Redirect user to Samsung Wallet
  window.location.href = samsungUrl;

  return {
    success: true,
    message: `✅ SAMSUNG WALLET (Flow B)

Samsung Wallet will open on supported Samsung devices.
Your card will be fetched securely from our server.

Ref ID: ${refId}
`
  };
};
