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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) return res.status(400).json({ message: 'Missing URL parameter' });

  const apiKey = process.env.REACT_APP_API_NINJAS_KEY;
  if (!apiKey) return res.status(500).json({ message: 'API key not configured on server.' });

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
      return res.status(response.status).json({ message: data.error || 'API Error' });
    }

    const htmlContent = data.data;
    if (!htmlContent) {
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
    const generalEmails = new Set();
    const generalPhones = new Set();
    const contactForms = new Set();

    // Social media links object (each is an array, supports multiple links)
    const socialLinks = {};
    SOCIAL_PLATFORMS.forEach(p => socialLinks[p] = []);

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

    // Find people cards
    $('body').find('*').each((i, el) => {
      const element = $(el);
      const elementText = element.text();
      if (elementText.length > 500) return;

      const hasEmailLink = element.find('a[href^="mailto:"]').length > 0;
      const hasPhoneLink = element.find('a[href^="tel:"]').length > 0;
      const hasEmailText = emailRegex.test(elementText);
      const hasPhoneText = phoneRegex.test(elementText) || phoneRegex2.test(elementText);

      if ((hasEmailLink || hasEmailText) && (hasPhoneLink || hasPhoneText)) {
        let name = element.find('h1, h2, h3, h4, h5, h6').first().text().trim();
        if (!name) name = element.find('strong, b, .name, .title, .person-name').first().text().trim();
        if (!name) name = element.find('p').first().text().split(/[,\n]/)[0].trim();

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

        if (personEmails.length > 0 && personPhones.length > 0) {
          people.push({
            name: name || 'Name not found',
            emails: [...new Set(personEmails)],
            phones: [...new Set(personPhones)]
          });
        }
      }
    });

    // Deduplicate people by name+email+phone
    const uniquePeople = [];
    const seenPeople = new Set();
    for (const person of people) {
      const key = `${person.name}|${person.emails.join(',')}|${person.phones.join(',')}`;
      if (!seenPeople.has(key)) {
        uniquePeople.push(person);
        seenPeople.add(key);
      }
    }

    // Find general contacts and social links
    $('body').find('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Social media
      SOCIAL_PLATFORMS.forEach(platform => {
        if (href.includes(`${platform}.com`)) {
          const abs = getAbsoluteUrl(href, url);
          if (abs && !socialLinks[platform].includes(abs)) {
            socialLinks[platform].push(abs);
          }
        }
      });

      // Emails
      if (href.startsWith('mailto:')) {
        const email = cleanEmail(href.replace('mailto:', ''));
        if (email) generalEmails.add(email);
      }

      // Phones
      if (href.startsWith('tel:')) {
        const phone = cleanPhone(href.replace('tel:', ''));
        if (phone) generalPhones.add(phone);
      }
    });

    // Remove duplicates: exclude people emails/phones from general
    const peopleEmails = new Set(uniquePeople.flatMap(p => p.emails));
    const peoplePhones = new Set(uniquePeople.flatMap(p => p.phones));
    const finalGeneralEmails = [...generalEmails].filter(email => !peopleEmails.has(email));
    const finalGeneralPhones = [...generalPhones].filter(phone => !peoplePhones.has(phone));

    res.json({
      generalEmails: finalGeneralEmails,
      generalPhones: finalGeneralPhones,
      socialMedia: socialLinks, // Each platform is an array of URLs
      contactForms: [...contactForms],
      people: uniquePeople
    });

  } catch (error) {
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
