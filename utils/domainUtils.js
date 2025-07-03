export const normalizeDomain = (url) => {
  if (!url) return '';
  try {
    let domain = url.trim();
    // Remove protocol
    domain = domain.replace(/^(?:https?:\/\/)?/i, '');
    // Remove www prefix
    if (domain.toLowerCase().startsWith('www.')) {
      domain = domain.substring(4);
    }
    // Remove path, query params, and fragment
    domain = domain.split('/')[0];
    domain = domain.split('?')[0];
    domain = domain.split('#')[0];
    // Convert to lowercase
    domain = domain.toLowerCase();
    // Remove trailing dot
    if (domain.endsWith('.')) {
      domain = domain.slice(0, -1);
    }
    return domain;
  } catch (error) {
    console.error("Error normalizing domain:", url, error);
    return url; // Return original on error
  }
};
