import Papa from 'papaparse';

const SOCIAL_PLATFORMS = [
  'linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'pinterest'
];

export const exportToCSV = (results, originalCsvData = [], originalHeaders = [], domainColumn = '') => {
  if (!results || !results.length) {
    console.warn('No results to export');
    return;
  }

  console.log('Exporting to CSV:', { 
    resultsCount: results.length, 
    hasOriginalData: originalCsvData.length > 0,
    domainColumn 
  });

  // Calculate max people count for dynamic columns
  const maxPeople = Math.max(...results.map(r => (r.people && Array.isArray(r.people)) ? r.people.length : 0));
  const maxSocialPerPlatform = 2; // Export up to 2 social links per platform
  const maxContactForms = 3;
  const maxGeneralContacts = 5;

  // Build headers dynamically
  let headers = [];

  // Original CSV columns (if merging with uploaded CSV)
  if (originalHeaders && originalHeaders.length > 0) {
    headers.push(...originalHeaders);
  } else {
    headers.push('Domain');
  }

  // Scraped data columns
  headers.push(
    // General contacts
    ...Array.from({length: maxGeneralContacts}, (_, i) => `General_Email_${i + 1}`),
    ...Array.from({length: maxGeneralContacts}, (_, i) => `General_Phone_${i + 1}`),
    
    // Social media (multiple links per platform)
    ...SOCIAL_PLATFORMS.flatMap(platform => 
      Array.from({length: maxSocialPerPlatform}, (_, i) => 
        `${platform.charAt(0).toUpperCase() + platform.slice(1)}${maxSocialPerPlatform > 1 ? `_${i + 1}` : ''}`
      )
    ),
    
    // Contact forms
    ...Array.from({length: maxContactForms}, (_, i) => `Contact_Form_${i + 1}`),
    
    // Scraping metadata
    'Pages_Scraped',
    'Pages_Failed',
    'Scraping_Error'
  );

  // People columns (dynamic based on max people found)
  for (let i = 1; i <= maxPeople; i++) {
    headers.push(`Person_${i}_Name`, `Person_${i}_Emails`, `Person_${i}_Phones`);
  }

  // Build rows
  const rows = results.map(result => {
    const row = {};
    
    // Handle original CSV data merging
    if (originalCsvData && originalCsvData.length > 0 && originalHeaders.length > 0) {
      // Find matching row in original data by domain
      const originalRow = originalCsvData.find(origRow => {
        if (!domainColumn || !origRow[domainColumn]) return false;
        const origDomain = normalizeDomain(origRow[domainColumn]);
        const resultDomain = normalizeDomain(result.originalDomain || result.domain);
        return origDomain === resultDomain;
      });
      
      // Copy original data
      originalHeaders.forEach(header => {
        row[header] = originalRow ? (originalRow[header] || '') : '';
      });
    } else {
      // Just use domain
      row['Domain'] = result.originalDomain || result.domain || '';
    }

    // General Emails (handle both array and potential undefined)
    const generalEmails = (result.generalEmails && Array.isArray(result.generalEmails)) ? result.generalEmails : [];
    for (let i = 0; i < maxGeneralContacts; i++) {
      row[`General_Email_${i + 1}`] = generalEmails[i] || '';
    }

    // General Phones (handle both array and potential undefined)
    const generalPhones = (result.generalPhones && Array.isArray(result.generalPhones)) ? result.generalPhones : [];
    for (let i = 0; i < maxGeneralContacts; i++) {
      row[`General_Phone_${i + 1}`] = generalPhones[i] || '';
    }

    // Social Media (with proper error handling)
    SOCIAL_PLATFORMS.forEach(platform => {
      for (let i = 0; i < maxSocialPerPlatform; i++) {
        const columnName = `${platform.charAt(0).toUpperCase() + platform.slice(1)}${maxSocialPerPlatform > 1 ? `_${i + 1}` : ''}`;
        
        let socialLink = '';
        if (result.socialMedia && 
            typeof result.socialMedia === 'object' && 
            result.socialMedia[platform] && 
            Array.isArray(result.socialMedia[platform])) {
          socialLink = result.socialMedia[platform][i] || '';
        }
        
        row[columnName] = socialLink;
      }
    });

    // Contact Forms (handle both array and potential undefined)
    const contactForms = (result.contactForms && Array.isArray(result.contactForms)) ? result.contactForms : [];
    for (let i = 0; i < maxContactForms; i++) {
      row[`Contact_Form_${i + 1}`] = contactForms[i] || '';
    }

    // Scraping metadata
    row['Pages_Scraped'] = result.pagesScraped || (result.error ? 0 : 1);
    row['Pages_Failed'] = result.pagesFailed || 0;
    row['Scraping_Error'] = result.error || '';

    // People data (handle both array and potential undefined)
    const people = (result.people && Array.isArray(result.people)) ? result.people : [];
    for (let i = 0; i < maxPeople; i++) {
      const person = people[i];
      row[`Person_${i + 1}_Name`] = person?.name || '';
      row[`Person_${i + 1}_Emails`] = (person?.emails && Array.isArray(person.emails)) ? person.emails.join('; ') : '';
      row[`Person_${i + 1}_Phones`] = (person?.phones && Array.isArray(person.phones)) ? person.phones.join('; ') : '';
    }

    return row;
  });

  // Convert to CSV with proper error handling
  try {
    const csv = Papa.unparse({
      fields: headers,
      data: rows.map(row => headers.map(h => {
        const value = row[h];
        return (value !== undefined && value !== null) ? String(value) : '';
      }))
    });

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `contact_scrape_results_${timestamp}.csv`;

    // Download file
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    console.log(`✅ CSV exported successfully: ${filename}`);
    
  } catch (error) {
    console.error('❌ CSV export failed:', error);
    alert('Failed to export CSV. Please try again.');
  }
};

// Helper function to normalize domains for matching
function normalizeDomain(url) {
  if (!url || typeof url !== 'string') return '';
  
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
    return String(url); // Return as string on error
  }
}
