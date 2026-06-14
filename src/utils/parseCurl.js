import { toJsonObject } from 'curlconverter';

export const parseCurl = (curlString) => {
  try {
    const result = toJsonObject(curlString);
    
    // Extract everything into the format your app expects
    return {
      url: result.url,
      method: result.method || 'GET',
      headers: Object.entries(result.headers || {}).map(([key, value]) => ({ key, value })),
      // result.data contains the body string
      body: result.data || '', 
      // We also handle cookies if they exist in the headers or parsing logic
      cookies: result.cookies || [] 
    };
  } catch (error) {
    console.error("Failed to parse cURL:", error);
    return null;
  }
};