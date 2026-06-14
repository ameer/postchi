export function parseCurl(curlString) {
  if (!curlString || !curlString.startsWith('curl')) return null;

  const result = {
    url: '',
    method: 'GET',
    headers: [],
    body: ''
  };

  // 1. Extract URL (usually the first thing wrapped in quotes or just a string starting with http)
  const urlMatch = curlString.match(/curl\s+(?:--location\s+)?['"]?(https?:\/\/[^\s'"]+)['"]?/i) || 
                   curlString.match(/['"](https?:\/\/[^\s'"]+)['"]/i);
  if (urlMatch) result.url = urlMatch[1];

  // 2. Extract Method
  const methodMatch = curlString.match(/(?:-X|--request)\s+['"]?([A-Z]+)['"]?/i);
  if (methodMatch) {
    result.method = methodMatch[1];
  } else if (curlString.includes('--data') || curlString.includes('-d')) {
    result.method = 'POST'; // implicitly POST if data is sent
  }

  // 3. Extract Headers (-H or --header)
  const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/gi;
  let match;
  while ((match = headerRegex.exec(curlString)) !== null) {
    const headerStr = match[1];
    const splitIndex = headerStr.indexOf(':');
    if (splitIndex > 0) {
      result.headers.push({
        key: headerStr.substring(0, splitIndex).trim(),
        value: headerStr.substring(splitIndex + 1).trim()
      });
    }
  }

  // 4. Extract Body (--data, --data-raw, -d)
  const bodyMatch = curlString.match(/(?:--data|--data-raw|-d)\s+['"]([\s\S]*?)['"](?!:)/i);
  if (bodyMatch) result.body = bodyMatch[1];

  // Ensure at least one empty header row exists for the UI
  if (result.headers.length === 0) result.headers.push({ key: '', value: '' });

  return result;
}