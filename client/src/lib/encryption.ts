// Client-side encryption utilities for secure data handling
// Note: This is for client-side validation only. Actual encryption happens server-side.

export function validateApiKey(key: string, service: string): boolean {
  if (!key || key.trim().length === 0) {
    return false;
  }

  switch (service.toLowerCase()) {
    case 'kindroid':
      // Kindroid API keys typically start with 'sk-' and are 32+ characters
      return key.startsWith('sk-') && key.length >= 32;
    
    case 'elevenlabs':
      // ElevenLabs API keys are typically 32 characters long
      return key.length >= 32 && /^[a-zA-Z0-9]+$/.test(key);
    
    case 'twilio':
      // Twilio Account SIDs start with 'AC' and are 34 characters
      return key.startsWith('AC') && key.length === 34;
    
    case 'spotify':
      // Spotify Client IDs are 32 characters
      return key.length === 32 && /^[a-zA-Z0-9]+$/.test(key);
    
    default:
      return key.length >= 16; // Generic minimum length
  }
}

export function validateAuthToken(token: string, service: string): boolean {
  if (!token || token.trim().length === 0) {
    return false;
  }

  switch (service.toLowerCase()) {
    case 'twilio':
      // Twilio Auth Tokens are 32 characters
      return token.length === 32 && /^[a-zA-Z0-9]+$/.test(token);
    
    case 'spotify':
      // Spotify Client Secrets are 32 characters
      return token.length === 32 && /^[a-zA-Z0-9]+$/.test(token);
    
    default:
      return token.length >= 16;
  }
}

export function maskApiKey(key: string): string {
  if (!key || key.length < 8) {
    return '***';
  }
  
  const visibleChars = Math.min(4, Math.floor(key.length / 4));
  const masked = '*'.repeat(key.length - visibleChars);
  return masked + key.slice(-visibleChars);
}

export function generateSecureId(): string {
  // Generate a cryptographically secure random ID
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sanitizeInput(input: string): string {
  // Basic input sanitization for XSS prevention
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .trim();
}

export function validatephonenumber(phone: string): boolean {
  // Validate US phone numbers
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || (cleaned.length === 11 && cleaned.startsWith('1'));
}

export function formatphonenumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    const areaCode = cleaned.slice(0, 3);
    const firstThree = cleaned.slice(3, 6);
    const lastFour = cleaned.slice(6);
    return `(${areaCode}) ${firstThree}-${lastFour}`;
  }
  
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.slice(1, 4);
    const firstThree = cleaned.slice(4, 7);
    const lastFour = cleaned.slice(7);
    return `+1 (${areaCode}) ${firstThree}-${lastFour}`;
  }
  
  return phone;
}

export function validateSecurityCode(code: string): boolean {
  // Security codes should be 4-6 digits
  return /^\d{4,6}$/.test(code);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function generateWebhookEndpoint(baseUrl: string, type: 'call' | 'sms'): string {
  const cleanUrl = baseUrl.replace(/\/$/, '');
  return `${cleanUrl}/webhooks/twilio/${type === 'call' ? 'call-status' : 'sms'}`;
}
