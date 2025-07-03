import Papa from 'papaparse';
import { normalizeDomain } from './domainUtils';

export const exportToCSV = (results, originalCsvData = [], originalHeaders = [], domainColumn = '') => {
  if (results.length === 0) return;

  // Enhanced contact types - keeping your original structure + new ones
  const contactTypes = ['emails', 'phones', 'socialMedia', 'addresses', 'contactForms', 'businessHours'];
  const newContactTypes = ['generalEmails', 'generalPhones', 'people'];

  // Calculate max counts for your existing contact types
  const maxCounts = {};
  contactTypes.forEach(type => {
      maxCounts[type] = Math.max(...results.map(r => r[type]?.length || 0));
  });

  // Calculate max counts for new contact types
  maxCounts['generalEmails'] = Math.max(...results.map(r => r.generalEmails?.length || 0));
  maxCounts['generalPhones'] = Math.max(...results.map(r => r.generalPhones?.length || 0));
  maxCounts['people'] = Math.max(...results.map(r => r.people?.length || 0));

  // Build headers - preserving your original logic
  let headers = [];
  if (originalHeaders.length > 0 && domainColumn) {
      headers = [...originalHeaders];
  } else {
      headers = ['Domain'];
  }

  // Add your existing contact type columns
  contactTypes.forEach(type => {
      for (let i = 1; i <= maxCounts[type]; i++) {
          const typeName = type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, '_$1');
          headers.push(`${typeName}_${i}`);
      }
      if (maxCounts[type] > 0) {
        const totalTypeName = type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
        headers.push(`Total_${totalTypeName.replace(/ /g, '_')}`);
      }
  });

  // Add new contact type columns
  // General Emails
  for (let i = 1; i <= maxCounts['generalEmails']; i++) {
      headers.push(`General_Email_${i}`);
  }
  if (maxCounts['generalEmails'] > 0) {
      headers.push(`Total_General_Emails`);
  }

  // General Phones
  for (let i = 1; i <= maxCounts['generalPhones']; i++) {
      headers.push(`General_Phone_${i}`);
  }
  if (maxCounts['generalPhones'] > 0) {
      headers.push(`Total_General_Phones`);
  }

  // People columns
  for (let i = 1; i <= maxCounts['people']; i++) {
      headers.push(`Person_${i}_Name`);
      headers.push(`Person_${i}_Emails`);
      headers.push(`Person_${i}_Phones`);
  }
  if (maxCounts['people'] > 0) {
      headers.push(`Total_People`);
  }

  // Add metadata columns
  headers.push('Pages_Scraped');
  headers.push('Pages_Failed');
  headers.push('Scraping_Mode');

  const rows = results.map(result => {
    const row = {};

    // Preserve your original CSV data logic
    if (originalHeaders.length > 0 && domainColumn) {
      const originalRow = originalCsvData.find(d => normalizeDomain(d[domainColumn]) === result.domain);
      if (originalRow) {
          originalHeaders.forEach(h => row[h] = originalRow[h]);
      } else {
          row[domainColumn] = result.originalDomain;
      }
    } else {
        row['Domain'] = result.originalDomain;
    }

    // Your existing contact types logic - PRESERVED
    contactTypes.forEach(type => {
        for (let i = 0; i < maxCounts[type]; i++) {
            const typeName = type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, '_$1');
            row[`${typeName}_${i + 1}`] = result[type]?.[i] || '';
        }
        if (maxCounts[type] > 0) {
            const totalTypeName = type.charAt(0).toUpperCase() + type.slice(1).replace(/([A-Z])/g, ' $1');
            row[`Total_${totalTypeName.replace(/ /g, '_')}`] = result[type]?.length || 0;
        }
    });

    // New contact types - General Emails
    for (let i = 0; i < maxCounts['generalEmails']; i++) {
        row[`General_Email_${i + 1}`] = result.generalEmails?.[i] || '';
    }

    // New contact types - General Phones
    for (let i = 0; i < maxCounts['generalPhones']; i++) {
        row[`General_Phone_${i + 1}`] = result.generalPhones?.[i] || '';
    }

    // New contact types - People
    for (let i = 0; i < maxCounts['people']; i++) {
        const person = result.people?.[i];
        row[`Person_${i + 1}_Name`] = person?.name || '';
        row[`Person_${i + 1}_Emails`] = person?.emails?.join('; ') || '';
        row[`Person_${i + 1}_Phones`] = person?.phones?.join('; ') || '';
    }
    if (maxCounts['people'] > 0) {
        row['Total_People'] = result.people?.length || 0;
    }
    if (maxCounts['generalEmails'] > 0) {
        row['Total_General_Emails'] = result.generalEmails?.length || 0;
    }
    if (maxCounts['generalPhones'] > 0) {
        row['Total_General_Phones'] = result.generalPhones?.length || 0;
    }

    // Add metadata
    row['Pages_Scraped'] = result.pagesScraped || 1;
    row['Pages_Failed'] = result.pagesFailed || 0;
    row['Scraping_Mode'] = result.pagesScraped > 1 ? 'Comprehensive' : 'Quick';

    return row;
  });

  // Your existing Papa.unparse logic - PRESERVED
  const csv = Papa.unparse({ fields: headers, data: rows });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `contact_scrape_results_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
