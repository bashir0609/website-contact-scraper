import Papa from 'papaparse';

const SOCIAL_PLATFORMS = [
  'linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'pinterest'
];

export const exportToCSV = (results) => {
  if (!results.length) return;

  // Calculate max people count for columns
  const maxPeople = Math.max(...results.map(r => r.people?.length || 0));

  // Build headers
  let headers = [
    'Domain',
    'General_Email_1', 'General_Email_2', 'General_Email_3',
    'General_Phone_1', 'General_Phone_2', 'General_Phone_3',
    ...SOCIAL_PLATFORMS.map(p => p.charAt(0).toUpperCase() + p.slice(1)),
    'Contact_Form_1', 'Contact_Form_2'
  ];
  for (let i = 1; i <= maxPeople; i++) {
    headers.push(`Person_${i}_Name`, `Person_${i}_Emails`, `Person_${i}_Phones`);
  }

  // Build rows
  const rows = results.map(result => {
    const row = {};
    row['Domain'] = result.domain || '';

    // General Emails
    for (let i = 0; i < 3; i++) {
      row[`General_Email_${i + 1}`] = result.generalEmails?.[i] || '';
    }

    // General Phones
    for (let i = 0; i < 3; i++) {
      row[`General_Phone_${i + 1}`] = result.generalPhones?.[i] || '';
    }

    // Socials
    SOCIAL_PLATFORMS.forEach(platform => {
      row[platform.charAt(0).toUpperCase() + platform.slice(1)] =
        Array.isArray(result.socialMedia?.[platform]) && result.socialMedia[platform].length > 0
          ? result.socialMedia[platform][0]
          : '';
    });

    // Contact Forms
    for (let i = 0; i < 2; i++) {
      row[`Contact_Form_${i + 1}`] = result.contactForms?.[i] || '';
    }

    // People
    for (let i = 0; i < maxPeople; i++) {
      const person = result.people?.[i];
      row[`Person_${i + 1}_Name`] = person?.name || '';
      row[`Person_${i + 1}_Emails`] = person?.emails?.join('; ') || '';
      row[`Person_${i + 1}_Phones`] = person?.phones?.join('; ') || '';
    }

    return row;
  });

  // Convert to CSV
  const csv = Papa.unparse({
    fields: headers,
    data: rows.map(row => headers.map(h => row[h] !== undefined ? row[h] : ''))
  });

  // Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `contact_scrape_results_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
