const fetch = require('node-fetch');
const cheerio = require('cheerio');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.body;
  
  if (!url) return res.status(400).json({ message: 'Missing URL parameter' });
  
  const apiKey = process.env.REACT_APP_API_NINJAS_KEY;
  if (!apiKey) return res.status(500).json({ message: 'API key not configured on server.' });

  console.log(`🔍 Discovering navigation links for: ${url}`);
  
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
      console.error(`❌ Link discovery failed: ${data.error || 'Unknown error'}`);
      return res.status(response.status).json({ 
        message: data.error || 'Link discovery failed',
        links: []
      });
    }

    const htmlContent = data.data;
    if (!htmlContent) {
      return res.status(200).json({ links: [] });
    }

    // Parse HTML to find navigation links
    const $ = cheerio.load(htmlContent);
    const discoveredLinks = new Set();
    const baseUrl = new URL(url);
    
    // Enhanced navigation keywords
    const navKeywords = [
      'about', 'contact', 'team', 'staff', 'people', 'services', 'products',
      'about-us', 'contact-us', 'our-team', 'our-staff', 'our-people',
      'service', 'product', 'pricing', 'plans', 'support', 'help',
      'company', 'organization', 'who-we-are', 'what-we-do', 'meet',
      'portfolio', 'work', 'projects', 'case-studies', 'testimonials'
    ];

    // Step 1: Find links in navigation areas
    $('nav a, header a, .nav a, .navigation a, .menu a, .navbar a, .main-menu a').each((i, el) => {
      const href = $(el).attr('href');
      const linkText = $(el).text().toLowerCase().trim();
      
      if (href) {
        try {
          const absoluteUrl = new URL(href, baseUrl.href);
          
          if (absoluteUrl.hostname === baseUrl.hostname) {
            const isNavLink = navKeywords.some(keyword => 
              href.toLowerCase().includes(keyword) || 
              linkText.includes(keyword)
            );
            
            if (isNavLink) {
              discoveredLinks.add(absoluteUrl.href);
            }
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    });

    // Step 2: Enhanced keyword search - look for team/people links ANYWHERE
    $('a[href]').each((i, el) => {
      const href = $(el).attr('href');
      const linkText = $(el).text().toLowerCase().trim();
      
      if (href && discoveredLinks.size < 20) {
        try {
          const absoluteUrl = new URL(href, baseUrl.href);
          
          if (absoluteUrl.hostname === baseUrl.hostname) {
            const path = absoluteUrl.pathname.toLowerCase();
            
            const isImportantPage = navKeywords.some(keyword => {
              return path.includes(keyword) || 
                     linkText.includes(keyword) ||
                     href.toLowerCase().includes(keyword);
            });
            
            const isTeamPage = ['team', 'staff', 'people', 'meet', 'our-team', 'about-team', 'members'].some(keyword => {
              return path.includes(keyword) || 
                     linkText.includes(keyword) ||
                     href.toLowerCase().includes(keyword);
            });
            
            const isContactAboutPage = ['contact', 'about', 'about-us', 'company'].some(keyword => {
              return path.includes(keyword) || 
                     linkText.includes(keyword);
            });
            
            if (isImportantPage || isTeamPage || isContactAboutPage) {
              discoveredLinks.add(absoluteUrl.href);
              
              if (isTeamPage) {
                console.log(`👥 Found potential team page: ${absoluteUrl.href} (text: "${linkText}")`);
              }
            }
          }
        } catch (e) {
          // Ignore invalid URLs
        }
      }
    });

    // Step 3: Add common page patterns as fallback
    if (discoveredLinks.size < 3) {
      console.log(`🔄 Limited links found (${discoveredLinks.size}), adding common patterns...`);
      
      const commonPaths = [
        '/about', '/contact', '/team', '/services', '/products', 
        '/about-us', '/contact-us', '/our-team', '/staff', '/people',
        '/about.html', '/contact.html', '/team.html', '/services.html',
        '/meet', '/meet-team', '/about/team', '/company/team'
      ];
      
      commonPaths.forEach(path => {
        const fullUrl = `${baseUrl.protocol}//${baseUrl.hostname}${path}`;
        discoveredLinks.add(fullUrl);
      });
    }

    const links = [...discoveredLinks].slice(0, 15);
    console.log(`🔗 Found ${links.length} navigation links:`, links.map(link => link.replace(baseUrl.origin, '')));
    
    res.json({ links });

  } catch (error) {
    console.error('❌ Link discovery error:', error);
    res.status(500).json({ 
      message: 'Link discovery error', 
      error: error.message,
      links: []
    });
  }
}
