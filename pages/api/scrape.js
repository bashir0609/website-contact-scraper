const fetch = require('node-fetch');
const cheerio = require('cheerio');

// Enhanced regex patterns
const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const phoneRegex = /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})(?:\s?(?:ext|x|extension)[\s.]?(\d+))?/g;
const phoneRegex2 = /(?:\+\d{1,3}[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g;
const socialRegex = /(?:https?:\/\/)?(?:www\.)?(?:facebook|twitter|linkedin|instagram|youtube|tiktok|pinterest)\.com\/[^\s"<>)]+/g;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.body;
  
  // Enhanced validation
  if (!url) return res.status(400).json({ message: 'Missing URL parameter' });
  
  const apiKey = process.env.REACT_APP_API_NINJAS_KEY;
  if (!apiKey) return res.status(500).json({ message: 'API key not configured on server. Please check your .env file.' });

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
      console.error(`❌ API Error: ${data.error || 'Unknown error'}`);
      
      // Handle large sites gracefully
      if (data.error && (data.error.includes('2MB') || data.error.includes('size') || data.error.includes('large'))) {
        return res.status(200).json({ 
          message: 'Website too large for processing (over 2MB limit). Try Quick Mode or specific subpages.',
          generalEmails: [],
          generalPhones: [],
          socialMedia: [],
          contactForms: [],
          people: [],
          error: 'Website too large (2MB+ limit)'
        });
      }
      
      return res.status(response.status).json({ 
        message: data.error || 'API Error',
        generalEmails: [],
        generalPhones: [],
        socialMedia: [],
        contactForms: [],
        people: []
      });
    }

    const htmlContent = data.data;
    if (!htmlContent) {
      console.log('⚠️  No HTML content returned');
      return res.status(200).json({ 
        generalEmails: [],
        generalPhones: [],
        socialMedia: [],
        contactForms: [],
        people: []
      });
    }

    console.log(`📄 Processing HTML content (${htmlContent.length} characters)`);

    // --- Enhanced Cheerio Parsing Logic ---
    const $ = cheerio.load(htmlContent);
    const people = [];
    const generalEmails = new Set();
    const generalPhones = new Set();
    const socialLinks = new Set();
    const contactForms = new Set();
    const processedElements = new Set();

    // Helper function to clean and validate email
    const cleanEmail = (email) => {
      const cleaned = email.toLowerCase().trim();
      const blacklist = ['example.com', 'test.com', 'domain.com', 'yoursite.com', 'company.com', 'sentry.io', 'placeholder.com'];
      return blacklist.some(blocked => cleaned.includes(blocked)) ? null : cleaned;
    };

    // Helper function to clean and validate phone
    const cleanPhone = (phone) => {
      const cleaned = phone.replace(/[^\d+()-.\s]/g, '').trim();
      const digitsOnly = cleaned.replace(/\D/g, '');
      
      if (digitsOnly.length < 10 || digitsOnly.length > 15) return null;
      if (digitsOnly.match(/^0+$|^1+$|^2+$/)) return null;
      if (digitsOnly.includes('000') || digitsOnly.includes('111')) return null;
      
      return cleaned;
    };

    // Helper function to get absolute URL
    const getAbsoluteUrl = (href, baseUrl) => {
      try {
        return new URL(href, baseUrl).href;
      } catch (e) {
        return null;
      }
    };

    // Step 1: Find contact forms and their URLs
    const currentUrl = req.body.url;
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
          const absoluteUrl = getAbsoluteUrl(action, currentUrl);
          if (absoluteUrl) {
            contactForms.add(`${method.toUpperCase()}: ${absoluteUrl}`);
          }
        } else {
          contactForms.add(`${method.toUpperCase()}: ${currentUrl} (same page)`);
        }
      }
    });

    // Step 2: Find person cards
    $('body').find('*').each((i, el) => {
      const element = $(el);
      const elementHtml = element.html();
      const elementText = element.text();
      
      if (processedElements.has(el) || elementText.length > 500) return;
      
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
          if (cleaned && !personEmails.includes(cleaned)) {
            personEmails.push(cleaned);
          }
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
          
          processedElements.add(el);
          console.log(`👤 Found person: ${name || 'Unknown'} (${personEmails.length} emails, ${personPhones.length} phones)`);
        }
      }
    });

    // Step 3: Find general contacts
    $('body').find('*').each((i, el) => {
      if (processedElements.has(el)) return;
      
      const element = $(el);
      
      element.find('a[href^="mailto:"]').each((j, emailEl) => {
        const email = cleanEmail($(emailEl).attr('href').replace('mailto:', ''));
        if (email) generalEmails.add(email);
      });
      
      element.find('a[href^="tel:"]').each((j, phoneEl) => {
        const phone = cleanPhone($(phoneEl).attr('href').replace('tel:', ''));
        if (phone) generalPhones.add(phone);
      });
      
      element.find('a[href*="facebook"], a[href*="twitter"], a[href*="linkedin"], a[href*="instagram"], a[href*="youtube"], a[href*="tiktok"]').each((j, socialEl) => {
        const href = $(socialEl).attr('href');
        if (href) {
          const absoluteUrl = getAbsoluteUrl(href, currentUrl);
          if (absoluteUrl) socialLinks.add(absoluteUrl);
        }
      });
    });

    // Step 4: Search remaining text
    const processedElementTexts = Array.from(processedElements).map(el => $(el).text()).join(' ');
    const remainingText = $('body').text().replace(processedElementTexts, '');
    
    const emailMatches = remainingText.match(emailRegex) || [];
    emailMatches.forEach(email => {
      const cleaned = cleanEmail(email);
      if (cleaned) generalEmails.add(cleaned);
    });
    
    const phoneMatches = [
      ...(remainingText.match(phoneRegex) || []),
      ...(remainingText.match(phoneRegex2) || [])
    ];
    
    phoneMatches.forEach(phone => {
      const cleaned = cleanPhone(phone);
      if (cleaned) {
        const digitsOnly = cleaned.replace(/\D/g, '');
        if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
          if (!phone.includes('.') || phone.includes('(') || phone.includes('+')) {
            generalPhones.add(cleaned);
          }
        }
      }
    });
    
    const socialMatches = remainingText.match(socialRegex) || [];
    socialMatches.forEach(social => {
      const absoluteUrl = getAbsoluteUrl(social, currentUrl);
      if (absoluteUrl) socialLinks.add(absoluteUrl);
    });

    // Step 5: Remove duplicates
    const peopleEmails = new Set(people.flatMap(p => p.emails));
    const peoplePhones = new Set(people.flatMap(p => p.phones));
    
    const finalGeneralEmails = [...generalEmails].filter(email => !peopleEmails.has(email));
    const finalGeneralPhones = [...generalPhones].filter(phone => !peoplePhones.has(phone));

    const result = {
      generalEmails: finalGeneralEmails,
      generalPhones: finalGeneralPhones,
      socialMedia: [...socialLinks],
      contactForms: [...contactForms],
      people: people
    };

    console.log(`✅ Scraping complete: ${finalGeneralEmails.length} general emails, ${finalGeneralPhones.length} general phones, ${people.length} people, ${socialLinks.size} social links, ${contactForms.size} contact forms`);
    
    res.json(result);

  } catch (error) {
    console.error('❌ Server error:', error);
    res.status(500).json({ 
      message: 'Server error', 
      error: error.message,
      generalEmails: [],
      generalPhones: [],
      socialMedia: [],
      contactForms: [],
      people: []
    });
  }
}
