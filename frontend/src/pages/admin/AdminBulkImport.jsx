import React, { useState } from 'react';
import { useERP } from '../../context/ERPContext.jsx';
import { masterDataApi } from '../../api/modulesApi.js';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../../components/common';
import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Users,
  UserCheck,
  FileText,
  RefreshCw,
} from 'lucide-react';

export default function AdminBulkImport() {
  const { addToast } = useERP();

  const [importType, setImportType] = useState('students'); // 'students' | 'teachers'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      await masterDataApi.downloadTemplate(importType);
      addToast({
        type: 'success',
        title: 'Template Downloaded',
        message: `Official ${importType} Excel template downloaded.`,
      });
    } catch (err) {
      addToast({
        type: 'danger',
        title: 'Download Failed',
        message: err.message,
      });
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setImportResult(null);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setImportResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res =
        importType === 'students'
          ? await masterDataApi.importStudents(formData)
          : await masterDataApi.importTeachers(formData);

      setImportResult(res?.data || {});
      addToast({
        type: 'success',
        title: 'Import Complete',
        message: 'Spreadsheet records imported successfully.',
      });
    } catch (err) {
      const errData = err.response?.data;
      setImportResult({
        error: errData?.message || err.message,
        errors: errData?.errors || [],
      });
      addToast({
        type: 'danger',
        title: 'Import Failed',
        message: errData?.message || 'Error occurred during spreadsheet parsing.',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Student & Faculty Bulk Import"
        description="Import student batches and faculty members into the database using validated Excel spreadsheets."
      />

      {/* Target Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div
          onClick={() => {
            setImportType('students');
            setFile(null);
            setImportResult(null);
          }}
          className={`card p-4 cursor-pointer transition-all flex items-center justify-between border-2 ${
            importType === 'students'
              ? 'border-blue-600 bg-blue-50/40 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              importType === 'students' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <Users size={20} />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm text-slate-900">Students Bulk Import</h3>
              <p className="text-[11px] text-slate-500">
                Enrollment numbers, roll numbers, sections & semesters
              </p>
            </div>
          </div>
          {importType === 'students' && (
            <Badge variant="primary">Selected</Badge>
          )}
        </div>

        <div
          onClick={() => {
            setImportType('teachers');
            setFile(null);
            setImportResult(null);
          }}
          className={`card p-4 cursor-pointer transition-all flex items-center justify-between border-2 ${
            importType === 'teachers'
              ? 'border-indigo-600 bg-indigo-50/40 shadow-xs'
              : 'border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              importType === 'teachers' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="font-heading font-black text-sm text-slate-900">Faculty Bulk Import</h3>
              <p className="text-[11px] text-slate-500">
                Employee IDs, designations & department mappings
              </p>
            </div>
          </div>
          {importType === 'teachers' && (
            <Badge variant="primary">Selected</Badge>
          )}
        </div>
      </div>

      {/* Action Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload & Instructions */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Upload size={18} className="text-blue-600" />
                <h3 className="font-heading font-black text-sm text-slate-900">
                  Upload {importType === 'students' ? 'Students' : 'Faculty'} Spreadsheet
                </h3>
              </div>

              <Button
                variant="secondary"
                onClick={handleDownloadTemplate}
                disabled={downloadingTemplate}
                className="btn-sm text-xs font-bold"
              >
                <Download size={14} />
                {downloadingTemplate ? 'Downloading...' : 'Download Template (.xlsx)'}
              </Button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-2xl p-8 text-center transition-colors bg-slate-50/50">
                <FileSpreadsheet size={40} className="text-slate-400 mx-auto mb-2" />
                <h4 className="font-heading font-bold text-sm text-slate-800">
                  {file ? file.name : 'Choose an Excel (.xlsx) file to upload'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 mb-4">
                  Max file size: 10MB. Ensure columns strictly adhere to template schema.
                </p>

                <label className="btn btn-sm bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 cursor-pointer font-bold inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs">
                  <Upload size={14} />
                  Browse File
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                {file && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setFile(null)}
                    className="text-xs"
                  >
                    Clear
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!file || uploading}
                  className="text-xs font-black shadow-sm"
                >
                  <RefreshCw size={14} className={uploading ? 'animate-spin' : ''} />
                  {uploading ? 'Parsing & Processing...' : 'Run Bulk Import'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Results Summary Box */}
          {importResult && (
            <Card className="p-6 border-slate-200">
              <h3 className="font-heading font-black text-sm text-slate-900 mb-3 flex items-center gap-2">
                {importResult.error ? (
                  <>
                    <AlertCircle size={18} className="text-rose-600" />
                    <span>Import Completed with Issues</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} className="text-emerald-600" />
                    <span>Import Results Report</span>
                  </>
                )}
              </h3>

              {importResult.error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium mb-3">
                  {importResult.error}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-4">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Processed</span>
                  <span className="text-base font-black text-slate-900">
                    {importResult.processed ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                  <span className="text-[10px] text-emerald-600 uppercase font-bold block">Created</span>
                  <span className="text-base font-black text-emerald-800">
                    {importResult.created ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <span className="text-[10px] text-blue-600 uppercase font-bold block">Updated</span>
                  <span className="text-base font-black text-blue-800">
                    {importResult.updated ?? 0}
                  </span>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <span className="text-[10px] text-rose-600 uppercase font-bold block">Failed / Errors</span>
                  <span className="text-base font-black text-rose-800">
                    {(importResult.errors || []).length}
                  </span>
                </div>
              </div>

              {/* Errors List */}
              {importResult.errors && importResult.errors.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Detailed Conflict Logs
                  </span>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50 text-[11px]">
                    {importResult.errors.map((err, idx) => (
                      <div key={idx} className="p-2 bg-white rounded-lg border border-rose-100 text-rose-800">
                        {typeof err === 'string' ? err : `Row ${err.row || idx + 1}: ${err.message || JSON.stringify(err)}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right Help / Format Guidelines */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="p-5 bg-gradient-to-b from-blue-50/50 to-white border-blue-100 text-xs space-y-3">
            <h4 className="font-heading font-black text-sm text-slate-900 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" />
              Template Formatting Guidelines
            </h4>

            {importType === 'students' ? (
              <div className="space-y-2 text-slate-600">
                <p>Ensure the following columns are present in row 1:</p>
                <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-slate-700">
                  <li><strong>name</strong>: Student Full Name</li>
                  <li><strong>email</strong>: Valid student email</li>
                  <li><strong>rollNumber</strong>: e.g. 0111CS211001</li>
                  <li><strong>enrollmentNumber</strong>: University enrollment</li>
                  <li><strong>semester</strong>: 1 to 8</li>
                  <li><strong>section</strong>: Section code (A, B, etc.)</li>
                  <li><strong>phone</strong>: 10-digit mobile number</li>
                </ul>
                <p className="text-[11px] text-slate-500 pt-1">
                  Default temporary passwords will be auto-generated and flagged for mandatory change.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-slate-600">
                <p>Ensure the following columns are present in row 1:</p>
                <ul className="list-disc pl-4 space-y-1 font-mono text-[11px] text-slate-700">
                  <li><strong>name</strong>: Faculty Full Name</li>
                  <li><strong>email</strong>: Institutional email address</li>
                  <li><strong>employeeId</strong>: Unique Faculty ID</li>
                  <li><strong>designation</strong>: e.g. Assistant Professor</li>
                  <li><strong>phone</strong>: 10-digit contact number</li>
                </ul>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
