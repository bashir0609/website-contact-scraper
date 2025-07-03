const fetch = require('node-fetch');
const cheerio = require('cheerio');

const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})(?:\s?(?:ext|x|extension)[\s.]?(\d+))?/g;
const phoneRegex2 = /(?:\+\d{1,3}[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;

const SOCIAL_PLATFORMS = [
  'linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'pinterest'
];

function getEmptySocialMedia() {
  const obj = {};
  SOCIAL_PLATFORMS.forEach(p => obj[p] = []);
  return obj;
}

function getAbsoluteUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

function cleanEmail(email) {
  const cleaned = email.toLowerCase().trim();
  const blacklist = ['example.com', 'test.com', 'domain.com', 'yoursite.com', 'company.com', 'sentry.io', 'placeholder.com'];
  return blacklist.some(blocked => cleaned.includes(blocked)) ? null : cleaned;
}

function cleanPhone(phone) {
  const cleaned = phone.replace(/[^\d+()-.\s]/g, '').trim();
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 10 || digitsOnly.length > 15) return null;
  if (digitsOnly.match(/^0+$|^1+$|^2+$/)) return null;
  if (digitsOnly.includes('000') || digitsOnly.includes('111')) return null;
  return cleaned;
}

// Enhanced function to detect if an email likely belongs to a person
function isPersonalEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  const localPart = email.split('@')[0].toLowerCase();
  
  // Patterns that suggest personal emails
  const personalPatterns = [
    /^[a-z]+\.[a-z]+$/,           // firstname.lastname
    /^[a-z]+[a-z]$/,              // firstnamelastname  
    /^[a-z]\.[a-z]+$/,            // f.lastname
    /^[a-z]+\.[a-z]$/,            // firstname.l
    /^[a-z]+_[a-z]+$/,            // firstname_lastname
    /^[a-z]+-[a-z]+$/,            // firstname-lastname
  ];
  
  // Generic patterns that suggest non-personal emails
  const genericPatterns = [
    /^(info|contact|support|help|admin|sales|marketing|media|press)$/,
    /^(service|customer|general|main|office|reception|team)$/,
    /^(investor|corporate|legal|hr|careers|jobs)$/,
    /relations$/,
    /^no-?reply/,
    /^do-?not-?reply/
  ];
  
  // Check if it matches personal patterns
  const isPersonal = personalPatterns.some(pattern => pattern.test(localPart));
  
  // Check if it matches generic patterns
  const isGeneric = genericPatterns.some(pattern => pattern.test(localPart));
  
  return isPersonal && !isGeneric;
}

// Extract potential name from email
function extractNameFromEmail(email) {
  if (!email) return null;
  
  const localPart = email.split('@')[0];
  
  // Handle firstname.lastname pattern
  if (localPart.includes('.')) {
    const parts = localPart.split('.');
    if (parts.length === 2) {
      const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      return `${firstName} ${lastName}`;
    }
  }
  
  // Handle firstname_lastname pattern
  if (localPart.includes('_')) {
    const parts = localPart.split('_');
    if (parts.length === 2) {
      const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      return `${firstName} ${lastName}`;
    }
  }
  
  // Handle firstname-lastname pattern
  if (localPart.includes('-')) {
    const parts = localPart.split('-');
    if (parts.length === 2) {
      const firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const lastName = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
      return `${firstName} ${lastName}`;
    }
  }
  
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'Missing URL parameter' });

  const apiKey = process.env.REACT_APP_API_NINJAS_KEY;
  if (!apiKey) return res.status(500).json({ message: 'API key not configured on server.' });

  console.log(`🔍 Scraping: ${url}`);
  const apiEndpoint = `https://api.api-ninjas.com/v1/webscraper?url=${encodeURIComponent(url)}`;

  try {
    const response = await fetch(apiEndpoint, {
      method: 'GET',
      headers: {
        'X-Api-Key': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'Contact-Scraper/1.0'
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`❌ API Error for ${url}:`, data.error);
      return res.status(response.status).json({
        message: data.error || 'API Error',
        generalEmails: [],
        generalPhones: [],
        socialMedia: getEmptySocialMedia(),
        contactForms: [],
        people: []
      });
    }

    const htmlContent = data.data;
    if (!htmlContent) {
      console.log(`⚠️  No HTML content for ${url}`);
      return res.status(200).json({
        generalEmails: [],
        generalPhones: [],
        socialMedia: getEmptySocialMedia(),
        contactForms: [],
        people: []
      });
    }

    const $ = cheerio.load(htmlContent);
    const people = [];
    const allEmails = new Set();
    const allPhones = new Set();
    const contactForms = new Set();

    // Initialize social media object properly
    const socialMedia = getEmptySocialMedia();

    // Find contact forms
    $('form').each((i, form) => {
      const formElement = $(form);
      const action = formElement.attr('action');
      const method = formElement.attr('method') || 'GET';
      const formHtml = formElement.html().toLowerCase();
      const hasContactFields = formHtml.includes('name') &&
        (formHtml.includes('email') || formHtml.includes('message') ||
          formHtml.includes('subject') || formHtml.includes('phone'));
      if (hasContactFields) {
        if (action) {
          const absoluteUrl = getAbsoluteUrl(action, url);
          if (absoluteUrl) {
            contactForms.add(`${method.toUpperCase()}: ${absoluteUrl}`);
          }
        } else {
          contactForms.add(`${method.toUpperCase()}: ${url} (same page)`);
        }
      }
    });

    // ENHANCED PERSON DETECTION - Look for person cards/sections first
    $('body').find('*').each((i, el) => {
      const element = $(el);
      const elementText = element.text();
      if (elementText.length > 500) return; // Skip very large elements

      const hasEmailLink = element.find('a[href^="mailto:"]').length > 0;
      const hasPhoneLink = element.find('a[href^="tel:"]').length > 0;
      const hasEmailText = emailRegex.test(elementText);
      const hasPhoneText = phoneRegex.test(elementText) || phoneRegex2.test(elementText);

      // Look for person cards that have both email and phone info
      if ((hasEmailLink || hasEmailText) && (hasPhoneLink || hasPhoneText)) {
        // Try multiple strategies to find the person's name
        let name = '';
        
        // Strategy 1: Look for heading tags
        const headingText = element.find('h1, h2, h3, h4, h5, h6').first().text().trim();
        if (headingText && headingText.length < 50 && !headingText.includes('@')) {
          name = headingText;
        }
        
        // Strategy 2: Look for common name classes
        if (!name) {
          const nameElements = element.find('.name, .person-name, .staff-name, .team-member-name, .employee-name, strong, b').first();
          if (nameElements.length) {
            const nameText = nameElements.text().trim();
            if (nameText && nameText.length < 50 && !nameText.includes('@')) {
              name = nameText;
            }
          }
        }
        
        // Strategy 3: Look in first paragraph, split by common delimiters
        if (!name) {
          const firstParagraph = element.find('p').first().text().trim();
          if (firstParagraph) {
            const possibleName = firstParagraph.split(/[,\n|•·]/)[0].trim();
            if (possibleName && possibleName.length < 50 && !possibleName.includes('@')) {
              name = possibleName;
            }
          }
        }

        // Extract emails from this element
        const personEmails = [];
        if (hasEmailLink) {
          element.find('a[href^="mailto:"]').each((j, emailEl) => {
            const email = cleanEmail($(emailEl).attr('href').replace('mailto:', ''));
            if (email) personEmails.push(email);
          });
        }
        const emailMatches = elementText.match(emailRegex) || [];
        emailMatches.forEach(email => {
          const cleaned = cleanEmail(email);
          if (cleaned && !personEmails.includes(cleaned)) personEmails.push(cleaned);
        });

        // Extract phones from this element
        const personPhones = [];
        if (hasPhoneLink) {
          element.find('a[href^="tel:"]').each((j, phoneEl) => {
            const phone = cleanPhone($(phoneEl).attr('href').replace('tel:', ''));
            if (phone) personPhones.push(phone);
          });
        }
        const phoneMatches = [
          ...(elementText.match(phoneRegex) || []),
          ...(elementText.match(phoneRegex2) || [])
        ];
        phoneMatches.forEach(phone => {
          const cleaned = cleanPhone(phone);
          if (cleaned && !personPhones.includes(cleaned)) {
            const digitsOnly = cleaned.replace(/\D/g, '');
            if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
              personPhones.push(cleaned);
            }
          }
        });

        // Only add if we found both emails and phones
        if (personEmails.length > 0 && personPhones.length > 0) {
          people.push({
            name: name || 'Name not found',
            emails: [...new Set(personEmails)],
            phones: [...new Set(personPhones)]
          });
        }
      }
    });

    // COLLECT ALL EMAILS AND PHONES from the page
    $('body').find('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Social media detection
      SOCIAL_PLATFORMS.forEach(platform => {
        if (href.includes(`${platform}.com`) || href.includes(`${platform}.co`)) {
          const absoluteUrl = getAbsoluteUrl(href, url);
          if (absoluteUrl && !socialMedia[platform].includes(absoluteUrl)) {
            socialMedia[platform].push(absoluteUrl);
          }
        }
      });

      // Email links
      if (href.startsWith('mailto:')) {
        const email = cleanEmail(href.replace('mailto:', ''));
        if (email) allEmails.add(email);
      }

      // Phone links
      if (href.startsWith('tel:')) {
        const phone = cleanPhone(href.replace('tel:', ''));
        if (phone) allPhones.add(phone);
      }
    });

    // Also search for emails and phones in plain text
    const bodyText = $('body').text();
    
    // Find emails in text
    const textEmails = bodyText.match(emailRegex) || [];
    textEmails.forEach(email => {
      const cleaned = cleanEmail(email);
      if (cleaned) allEmails.add(cleaned);
    });

    // Find phones in text
    const textPhones = [
      ...(bodyText.match(phoneRegex) || []),
      ...(bodyText.match(phoneRegex2) || [])
    ];
    textPhones.forEach(phone => {
      const cleaned = cleanPhone(phone);
      if (cleaned) allPhones.add(cleaned);
    });

    // SMART EMAIL CATEGORIZATION
    const peopleEmails = new Set();
    const peoplePhones = new Set();
    const inferredPeople = [];
    
    // Collect emails/phones already assigned to detected people
    people.forEach(person => {
      person.emails.forEach(email => peopleEmails.add(email));
      person.phones.forEach(phone => peoplePhones.add(phone));
    });

    // ANALYZE REMAINING EMAILS for potential people
    const remainingEmails = [...allEmails].filter(email => !peopleEmails.has(email));
    
    remainingEmails.forEach(email => {
      if (isPersonalEmail(email)) {
        const nameFromEmail = extractNameFromEmail(email);
        if (nameFromEmail) {
          // This looks like a personal email, create a person entry
          inferredPeople.push({
            name: nameFromEmail,
            emails: [email],
            phones: [], // No phone associated
            source: 'email_inference'
          });
          peopleEmails.add(email);
        }
      }
    });

    // Combine detected people with inferred people
    const allPeople = [...people, ...inferredPeople];

    // Deduplicate people by email
    const uniquePeople = [];
    const seenEmails = new Set();
    
    allPeople.forEach(person => {
      const hasNewEmail = person.emails.some(email => !seenEmails.has(email));
      if (hasNewEmail) {
        uniquePeople.push(person);
        person.emails.forEach(email => seenEmails.add(email));
      }
    });

    // FINAL CATEGORIZATION
    const finalPeopleEmails = new Set();
    const finalPeoplePhones = new Set();
    
    uniquePeople.forEach(person => {
      person.emails.forEach(email => finalPeopleEmails.add(email));
      person.phones.forEach(phone => finalPeoplePhones.add(phone));
    });

    // General emails/phones are those NOT assigned to people
    const generalEmails = [...allEmails].filter(email => !finalPeopleEmails.has(email));
    const generalPhones = [...allPhones].filter(phone => !finalPeoplePhones.has(phone));

    console.log(`✅ Scraping complete for ${url}: ${generalEmails.length} general emails, ${generalPhones.length} general phones, ${uniquePeople.length} people (${people.length} detected + ${inferredPeople.length} inferred)`);

    // Return consistent structure
    const result = {
      generalEmails: generalEmails,
      generalPhones: generalPhones,
      socialMedia: socialMedia,
      contactForms: [...contactForms],
      people: uniquePeople
    };

    res.json(result);

  } catch (error) {
    console.error(`❌ Server error for ${url}:`, error);
    res.status(500).json({
      message: 'Server error',
      error: error.message,
      generalEmails: [],
      generalPhones: [],
      socialMedia: getEmptySocialMedia(),
      contactForms: [],
      people: []
    });
  }
}
