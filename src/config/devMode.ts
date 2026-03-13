// ============================================
// Development & Configuration Settings
// ============================================

// Development Mode - enables /dev-login page
export const DEV_MODE_ENABLED = true;

// Dev credentials for quick login (only works when DEV_MODE_ENABLED is true)
export const DEV_CREDENTIALS = {
  email: 'dev@medlibre.com',
  password: 'dev123456',
};

// ============================================
// Ad Configuration
// ============================================
export const AD_CONFIG = {
  // Master toggle - if false, no ads are shown
  enabled: true,

  // Interstitial ads (between questions)
  interstitial: {
    enabledForGuest: true,
    enabledForFree: false, // Per user request: no ads between questions for free users
    frequency: 1, // Show ad after every N questions
  },

  // Lateral/Sidebar ads
  lateral: {
    enabledForGuest: true,
    enabledForFree: true,
    enabledForPaid: false,
  }
};

// ============================================
// Question & PDF Limit Configuration
// ============================================
export const LIMIT_CONFIG = {
  // Guest users (not logged in)
  guest: {
    enabled: true,
    limit: 5,
    pdf_enabled: true,
    pdf_limit: 0, // Guest can't export
  },

  // Free registered users
  free: {
    enabled: true,
    limit: 20,
    pdf_enabled: true,
    pdf_limit: 0, // Free can't export? User only asked for Premium limit, assuming Free is 0 or restricted
  },

  // Paid users
  paid: {
    enabled: false, // Unlimited questions
    limit: 1000,
    pdf_enabled: true,
    pdf_limit: 20, // Limit of 20 PDFs per day as requested
  },
};
