import React from 'react';
import CsvUpload from './CsvUpload';
import { PlusCircle, Trash2, Loader, Settings } from 'lucide-react';

const ScraperUI = ({
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
}) => {
  return (
    <div className="min-h-screen w-full p-4 sm:p-8 font-sans bg-gradient-to-br from-blue-500 to-indigo-700 text-slate-800">
      <div className="max-w-4xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-white shadow-sm">Website Contact Scraper</h1>
          <p className="text-indigo-200 mt-2">Enterprise-Grade Contact Extraction</p>
        </header>

        <main className="bg-white/90 backdrop-blur-sm rounded-xl shadow-2xl p-6 sm:p-8">
          {/* Mode Selection */}
          <div className="flex justify-center rounded-lg shadow-sm mb-6" role="group">
            <button 
              onClick={() => setMode('single')} 
              className={`px-4 py-2 text-sm font-medium ${
                mode === 'single' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-900'
              } border border-gray-200 rounded-l-lg hover:bg-gray-100 focus:z-10 focus:ring-2 focus:ring-indigo-500`}
            >
              Single Domain
            </button>
            <button 
              onClick={() => setMode('bulk')} 
              className={`px-4 py-2 text-sm font-medium ${
                mode === 'bulk' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-900'
              } border-t border-b border-gray-200 hover:bg-gray-100 focus:z-10 focus:ring-2 focus:ring-indigo-500`}
            >
              Bulk Domains
            </button>
            <button 
              onClick={() => setMode('csv')} 
              className={`px-4 py-2 text-sm font-medium ${
                mode === 'csv' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-900'
              } border border-gray-200 rounded-r-lg hover:bg-gray-100 focus:z-10 focus:ring-2 focus:ring-indigo-500`}
            >
              CSV Upload
            </button>
          </div>

          {/* Scraping Mode Selection */}
          <div className="flex justify-center mb-6">
            <div className="flex items-center space-x-4 bg-gray-100 rounded-lg p-2">
              <Settings size={20} className="text-gray-600" />
              <span className="text-sm font-medium text-gray-700">Scraping Mode:</span>
              <select 
                value={scrapingMode} 
                onChange={(e) => setScrapingMode(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="quick">Quick Mode (Server-side)</option>
                <option value="comprehensive">Comprehensive Mode (Multi-page)</option>
              </select>
            </div>
          </div>

          {/* Input Fields */}
          <div className="mb-6">
            {mode === 'single' && (
              <input 
                type="text" 
                placeholder="example.com" 
                value={singleDomain} 
                onChange={e => setSingleDomain(e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
            )}
            
            {mode === 'bulk' && (
              <div className="space-y-2">
                {bulkDomains.map((domain, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input 
                      type="text" 
                      placeholder="example.com" 
                      value={domain} 
                      onChange={e => handleBulkDomainChange(index, e.target.value)} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
                    />
                    <button 
                      onClick={() => removeDomainInput(index)} 
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={addDomainInput} 
                  className="flex items-center space-x-2 text-indigo-600 hover:text-indigo-800"
                >
                  <PlusCircle size={20} /> 
                  <span>Add Domain</span>
                </button>
              </div>
            )}
            
            {mode === 'csv' && (
              <CsvUpload 
                setFile={setCsvFile} 
                setData={setCsvData} 
                setHeaders={setCsvHeaders} 
                setColumn={setSelectedDomainColumn} 
              />
            )}
          </div>

          {/* Scraping Mode Description */}
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              {scrapingMode === 'quick' ? (
                <span><strong>Quick Mode:</strong> Fast single-page scraping with intelligent person card detection. Best for quick results.</span>
              ) : (
                <span><strong>Comprehensive Mode:</strong> Multi-page scraping including About, Contact, Team pages. More thorough but slower.</span>
              )}
            </p>
          </div>

          {/* Start Scraping Button */}
          <div className="text-center mb-4">
            <button 
              onClick={handleScrape} 
              disabled={isLoading} 
              className="w-full md:w-1/2 px-6 py-3 text-white font-semibold bg-indigo-600 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center mx-auto"
            >
              {isLoading && <Loader className="animate-spin mr-2" />}
              {isLoading ? `Scraping... (${scrapingProgress.current}/${scrapingProgress.total})` : 'Start Scraping'}
            </button>
            {isLoading && currentScrapingUrl && (
              <p className="text-center text-sm text-gray-600 mt-2">{currentScrapingUrl}</p>
            )}
          </div>

          {/* Progress Bar */}
          {isLoading && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-4">
              <div 
                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" 
                style={{ width: `${(scrapingProgress.current / scrapingProgress.total) * 100}%` }}
              ></div>
            </div>
          )}
          
          {/* Results Section */}
          {results.length > 0 && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Results</h2>
                <div className="flex space-x-2">
                  <button 
                    onClick={handleClearResults} 
                    className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg shadow-md hover:bg-red-700"
                  >
                    Clear Results
                  </button>
                  <button 
                    onClick={() => exportToCSV(results, originalCsvDataRef.current, csvFile ? csvHeaders : [], selectedDomainColumn)} 
                    className="px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700"
                  >
                    Export to CSV
                  </button>
                </div>
              </div>
              <div className="space-y-4 max-h-96 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                {results.map((result, index) => (
                  <div key={index} className={`p-4 rounded-lg shadow ${result.error ? 'bg-red-100 border border-red-300' : 'bg-white'}`}>
                    <p className="font-bold">
                      {result.originalDomain} 
                      {result.error ? (
                        <span className="text-red-600 font-normal"> - Error</span>
                      ) : (
                        <span className="text-green-600 font-normal"> - Success</span>
                      )}
                    </p>
                    {result.error ? (
                      <p className="text-red-700">{result.error}</p>
                    ) : (
                      <div className="text-sm mt-2">
                        {/* Quick Mode Results */}
                        {result.generalEmails && (
                          <p><strong>General Emails:</strong> {result.generalEmails.join(', ') || 'None found'}</p>
                        )}
                        {result.generalPhones && (
                          <p><strong>General Phones:</strong> {result.generalPhones.join(', ') || 'None found'}</p>
                        )}
                        {result.people && result.people.length > 0 && (
                          <div className="mt-2">
                            <strong>People Found:</strong>
                            {result.people.map((person, pIndex) => (
                              <div key={pIndex} className="ml-4 mt-1 p-2 bg-gray-100 rounded">
                                <p><strong>Name:</strong> {person.name}</p>
                                <p><strong>Emails:</strong> {person.emails?.join(', ') || 'None'}</p>
                                <p><strong>Phones:</strong> {person.phones?.join(', ') || 'None'}</p>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Comprehensive Mode Results */}
                        {result.emails && (
                          <p><strong>Emails:</strong> {result.emails.join(', ') || 'None found'}</p>
                        )}
                        {result.phones && (
                          <p><strong>Phones:</strong> {result.phones.join(', ') || 'None found'}</p>
                        )}
                        {result.socialMedia && result.socialMedia.length > 0 && (
                          <p><strong>Social Media:</strong> {result.socialMedia.join(', ')}</p>
                        )}
                        {result.contactForms && result.contactForms.length > 0 && (
                          <div className="mt-2">
                            <strong>Contact Forms:</strong>
                            <ul className="ml-4 mt-1">
                              {result.contactForms.map((form, fIndex) => (
                                <li key={fIndex} className="text-xs bg-green-50 p-1 rounded mt-1">
                                  {form}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ScraperUI;
