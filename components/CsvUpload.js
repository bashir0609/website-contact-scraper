import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { UploadCloud } from 'lucide-react';

const CsvUpload = ({ setFile, setData, setHeaders, setColumn }) => {
  const [filename, setFilename] = useState('');
  const [localHeaders, setLocalHeaders] = useState([]);
  const [previewData, setPreviewData] = useState([]);

  const onDrop = useCallback(acceptedFiles => {
    const file = acceptedFiles[0];
    if (file && file.type === 'text/csv') {
      setFilename(file.name);
      setFile(file);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setData(results.data);
          setHeaders(results.meta.fields);
          setLocalHeaders(results.meta.fields);
          setPreviewData(results.data.slice(0, 5));
          if (results.meta.fields.length > 0) {
            setColumn(results.meta.fields[0]);
          }
        },
      });
    } else {
      alert("Please upload a valid .csv file.");
    }
  }, [setFile, setData, setHeaders, setColumn]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: {'text/csv': ['.csv']} });

  return (
    <div>
      <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-lg cursor-pointer text-center ${isDragActive ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300'}`}>
        <input {...getInputProps()} />
        <UploadCloud className="mx-auto text-gray-400" size={48} />
        {isDragActive ?
          <p>Drop the file here ...</p> :
          <p>Drag 'n' drop a CSV file here, or click to select</p>
        }
        {filename && <p className="text-sm font-semibold mt-2">{filename}</p>}
      </div>

      {localHeaders.length > 0 && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select Domain Column:</label>
          <select onChange={e => setColumn(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md">
            {localHeaders.map(h => <option key={h} value={h}>{h}</option>)}
          </select>
          <div className="mt-2 text-xs overflow-x-auto">
            <p className="font-semibold mb-1">CSV Preview:</p>
            <table className="w-full text-left">
                <thead>
                    <tr className="bg-gray-100">
                        {localHeaders.map(h => <th key={h} className="p-1 border">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {previewData.map((row, i) => (
                        <tr key={i} className="border-b">
                            {localHeaders.map(h => <td key={h} className="p-1 border">{row[h]}</td>)}
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CsvUpload;
