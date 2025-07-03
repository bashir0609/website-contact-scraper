import React, { useState, useCallback, useRef } from 'react';
import Head from 'next/head';
import { normalizeDomain } from '../utils/domainUtils';
import { exportToCSV } from '../utils/csvExportUtils';
import CsvUpload from '../components/CsvUpload';
import ScraperUI from '../components/ScraperUI';

const SOCIAL_PLATFORMS = [
  'linkedin', 'facebook', 'twitter', 'instagram', 'youtube', 'tiktok', 'pinterest'
];

function getEmptySocialMedia() {
  const obj = {};
  SOCIAL_PLATFORMS.forEach(p => obj[p] = []);
  return obj;
}

export default function Home() {
  // --- State Management ---
  const [mode, setMode] = useState('single');
  const [singleDomain, setSingleDomain] = useState('');
  const [bulkDomains, setBulkDomains] = useState(['']);
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [selectedDomainColumn, setSelectedDomainColumn] = useState('');
  const [results, setResults] = useState([]);
  const [scrapingProgress, setScrapingProgress] = useState({ current: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [currentScrapingUrl, setCurrentScrapingUrl] = useState('');
  const [scrapingMode, setScrapingMode] = useState('quick');
  const originalCsvDataRef = useRef([]);

  // --- UI Handlers for Bulk Input ---
  const handleBulkDomainChange = (index, value) => {
    const newDomains = [...bulkDomains];
    newDomains[index] = value;
    setBulkDomains(newDomains);
  };
  const addDomainInput = () => setBulkDomains([...bulkDomains, '']);
  const removeDomainInput = (index) => setBulkDomains(bulkDomains.filter((_, i) => i !== index));

  // --- Core Scraping Logic: Quick Mode ---
  const scrapeDomainQuick = useCallback(async (domainInfo, reportProgress) => {
    try {
      const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: `http://${domainInfo.domain}` })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Scraping failed");
      }
      
      const scrapedData = await response.json();
      
      return {
        ...domainInfo,
        ...scrapedData,
        error: null
      };

    } catch (err) {
      console.error("Scraping failed for", domainInfo.domain, err);
      return { ...domainInfo, error: err.message };
    }
  }, []);

  // --- Core Scraping Logic: Comprehensive Mode ---
  const scrapeDomainComprehensive = useCallback(async (domainInfo, reportProgress) => {
    const { domain } = domainInfo;

    try {
      // Step 1: Analyze homepage first
      const rootUrl = `http://${domain}`;
      if (reportProgress) reportProgress(`Analyzing homepage: ${rootUrl}`);
      
      const homepageResponse = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rootUrl })
      });

      let aggregatedResults = {
        generalEmails: new Set(),
        generalPhones: new Set(),
        socialMedia: getEmptySocialMedia(), // Fixed: Initialize as object with arrays
        contactForms: new Set(),
        people: []
      };

      let totalScrapedPages = 0;
      let totalFailedPages = 0;

      // Process homepage results
      if (homepageResponse.ok) {
        const homepageData = await homepageResponse.json();
        
        if (homepageData.error && homepageData.error.includes('2MB')) {
          console.log('⚠️  Homepage too large, trying targeted subpages...');
          if (reportProgress) reportProgress('Homepage too large, trying contact pages...');
        } else {
          totalScrapedPages++;
          
          // Process emails
          if (homepageData.generalEmails && Array.isArray(homepageData.generalEmails)) {
            homepageData.generalEmails.forEach(e => aggregatedResults.generalEmails.add(e));
          }
          
          // Process phones
          if (homepageData.generalPhones && Array.isArray(homepageData.generalPhones)) {
            homepageData.generalPhones.forEach(p => aggregatedResults.generalPhones.add(p));
          }
          
          // Process social media - Fixed logic
          if (homepageData.socialMedia && typeof homepageData.socialMedia === 'object') {
            SOCIAL_PLATFORMS.forEach(platform => {
              if (homepageData.socialMedia[platform] && Array.isArray(homepageData.socialMedia[platform])) {
                homepageData.socialMedia[platform].forEach(link => {
                  if (!aggregatedResults.socialMedia[platform].includes(link)) {
                    aggregatedResults.socialMedia[platform].push(link);
                  }
                });
              }
            });
          }
          
          // Process contact forms
          if (homepageData.contactForms && Array.isArray(homepageData.contactForms)) {
            homepageData.contactForms.forEach(f => aggregatedResults.contactForms.add(f));
          }
          
          // Process people
          if (homepageData.people && Array.isArray(homepageData.people)) {
            aggregatedResults.people.push(...homepageData.people);
          }
          
          console.log(`📊 Homepage results: ${homepageData.generalEmails?.length || 0} emails, ${homepageData.generalPhones?.length || 0} phones, ${homepageData.people?.length || 0} people`);
        }
      } else {
        totalFailedPages++;
      }

      // Step 2: Discover navigation links
      if (reportProgress) reportProgress('Discovering navigation links...');
      
      const linkDiscoveryResponse = await fetch('/api/discover-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rootUrl })
      });

      let potentialPages = [];
      
      if (linkDiscoveryResponse.ok) {
        const linkData = await linkDiscoveryResponse.json();
        potentialPages = linkData.links || [];
      }

      // Add fallback pages if discovery failed
      if (potentialPages.length < 3) {
        console.log("🔄 Adding fallback contact-rich pages...");
        const fallbackPages = [
          `/contact`, `/contact-us`, `/about`, `/about-us`, `/team`, `/staff`, 
          `/people`, `/our-team`, `/meet`, `/company`, `/support`
        ];
        
        fallbackPages.forEach(path => {
          potentialPages.push(`http://${domain}${path}`);
        });
      }

      // Step 3: Prioritize pages
      const prioritizedPages = potentialPages
        .filter(url => url !== rootUrl)
        .sort((a, b) => {
          const getScore = (url) => {
            const lower = url.toLowerCase();
            if (lower.includes('contact')) return 100;
            if (lower.includes('about')) return 90;
            if (lower.includes('team') || lower.includes('staff') || lower.includes('people')) return 85;
            if (lower.includes('support') || lower.includes('help')) return 80;
            return 50;
          };
          return getScore(b) - getScore(a);
        })
        .slice(0, 8);

      console.log(`🎯 Prioritized pages to scrape:`, prioritizedPages.map(url => url.replace(`http://${domain}`, '')));

      // Step 4: Smart adaptive scraping
      for (const pageUrl of prioritizedPages) {
        const currentContactCount = aggregatedResults.generalEmails.size + aggregatedResults.generalPhones.size + aggregatedResults.people.length;
        
        if (currentContactCount >= 5 && aggregatedResults.people.length >= 2) {
          console.log(`✅ Sufficient contact data found. Stopping early.`);
          break;
        }

        if (reportProgress) reportProgress(`Scraping: ${pageUrl}`);
        
        try {
          const response = await fetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pageUrl })
          });
          
          if (!response.ok) {
            totalFailedPages++;
            continue;
          }

          const data = await response.json();
          
          if (data.error && data.error.includes('2MB')) {
            totalFailedPages++;
            continue;
          }

          totalScrapedPages++;
          
          let newContactsFound = 0;
          
          // Process emails
          if (data.generalEmails && Array.isArray(data.generalEmails)) {
            const beforeSize = aggregatedResults.generalEmails.size;
            data.generalEmails.forEach(email => aggregatedResults.generalEmails.add(email));
            newContactsFound += aggregatedResults.generalEmails.size - beforeSize;
          }
          
          // Process phones
          if (data.generalPhones && Array.isArray(data.generalPhones)) {
            const beforeSize = aggregatedResults.generalPhones.size;
            data.generalPhones.forEach(phone => aggregatedResults.generalPhones.add(phone));
            newContactsFound += aggregatedResults.generalPhones.size - beforeSize;
          }
          
          // Process social media - Fixed logic
          if (data.socialMedia && typeof data.socialMedia === 'object') {
            SOCIAL_PLATFORMS.forEach(platform => {
              if (data.socialMedia[platform] && Array.isArray(data.socialMedia[platform])) {
                data.socialMedia[platform].forEach(link => {
                  if (!aggregatedResults.socialMedia[platform].includes(link)) {
                    aggregatedResults.socialMedia[platform].push(link);
                  }
                });
              }
            });
          }
          
          // Process contact forms
          if (data.contactForms && Array.isArray(data.contactForms)) {
            data.contactForms.forEach(form => aggregatedResults.contactForms.add(form));
          }
          
          // Process people
          if (data.people && Array.isArray(data.people)) {
            data.people.forEach(person => {
              const existingPerson = aggregatedResults.people.find(existing => 
                existing.emails.some(existingEmail => 
                  person.emails.some(newEmail => newEmail === existingEmail)
                )
              );
              
              if (!existingPerson) {
                aggregatedResults.people.push(person);
                newContactsFound++;
              }
            });
          }
          
          console.log(`📊 ${pageUrl.replace(`http://${domain}`, '')} → +${newContactsFound} new contacts`);
          
        } catch (pageError) {
          totalFailedPages++;
          console.warn(`❌ Error scraping ${pageUrl}:`, pageError.message);
          continue;
        }
      }

      // Step 5: Return comprehensive results
      const finalResults = {
        ...domainInfo,
        generalEmails: [...aggregatedResults.generalEmails],
        generalPhones: [...aggregatedResults.generalPhones],
        socialMedia: aggregatedResults.socialMedia, // Now properly structured as object with arrays
        contactForms: [...aggregatedResults.contactForms],
        people: aggregatedResults.people,
        pagesScraped: totalScrapedPages,
        pagesFailed: totalFailedPages,
        error: null
      };

      console.log(`🎉 Comprehensive scraping complete for ${domain}`);
      return finalResults;

    } catch (error) {
      console.error("Comprehensive scraping failed for", domain, error);
      return { 
        ...domainInfo, 
        error: `Comprehensive scraping failed: ${error.message}`,
        generalEmails: [],
        generalPhones: [],
        socialMedia: getEmptySocialMedia(),
        contactForms: [],
        people: []
      };
    }
  }, []);

  // --- Main Scraping Function ---
  const scrapeDomain = useCallback(async (domainInfo, reportProgress) => {
    if (scrapingMode === 'comprehensive') {
      return await scrapeDomainComprehensive(domainInfo, reportProgress);
    } else {
      return await scrapeDomainQuick(domainInfo, reportProgress);
    }
  }, [scrapingMode, scrapeDomainQuick, scrapeDomainComprehensive]);

  const processInBatches = useCallback(async (domainsToProcess, reportProgress) => {
    setIsLoading(true);
    setResults([]);
    setScrapingProgress({ current: 0, total: domainsToProcess.length });
    const batchSize = 3;
    const delay = 2000;

    for (let i = 0; i < domainsToProcess.length; i += batchSize) {
      const batch = domainsToProcess.slice(i, i + batchSize);
      const promises = batch.map(domainInfo => scrapeDomain(domainInfo, reportProgress));
      const batchResults = await Promise.allSettled(promises);

      const newResults = batchResults.map((res, index) =>
        res.status === 'fulfilled' ? res.value : { ...batch[index], error: res.reason.message }
      );

      setResults(prev => [...prev, ...newResults]);
      setScrapingProgress(prev => ({ ...prev, current: prev.current + batch.length }));

      if (i + batchSize < domainsToProcess.length) await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    if (reportProgress) reportProgress('');
    setIsLoading(false);
  }, [scrapeDomain]);

  const handleScrape = () => {
    let domainsToProcess = [];
    if (mode === 'single') {
      domainsToProcess = [{ domain: normalizeDomain(singleDomain), originalDomain: singleDomain }];
    } else if (mode === 'bulk') {
      domainsToProcess = bulkDomains.filter(d => d.trim() !== '').map(d => ({ domain: normalizeDomain(d), originalDomain: d }));
    } else if (mode === 'csv' && selectedDomainColumn) {
      originalCsvDataRef.current = csvData;
      domainsToProcess = csvData.map(row => ({ ...row, domain: normalizeDomain(row[selectedDomainColumn]), originalDomain: row[selectedDomainColumn] }));
    }
    processInBatches(domainsToProcess, setCurrentScrapingUrl);
  };
  
  const handleClearResults = () => {
    setResults([]);
    originalCsvDataRef.current = [];
  };

  // Pass all props to the UI component
  const uiProps = {
    mode,
    setMode,
    singleDomain,
    setSingleDomain,
    bulkDomains,
    handleBulkDomainChange,
    addDomainInput,
    removeDomainInput,
    csvFile,
    setCsvFile,
    csvData,
    setCsvData,
    csvHeaders,
    setCsvHeaders,
    selectedDomainColumn,
    setSelectedDomainColumn,
    results,
    scrapingProgress,
    isLoading,
    currentScrapingUrl,
    scrapingMode,
    setScrapingMode,
    handleScrape,
    handleClearResults,
    exportToCSV,
    originalCsvDataRef
  };

  return (
    <>
      <Head>
        <title>Website Contact Scraper</title>
        <meta name="description" content="Enterprise-Grade Contact Extraction Tool" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <ScraperUI {...uiProps} />
    </>
  );
}
