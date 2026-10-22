import reportsService from './reports.service.js';
import { sendSuccess } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const summary = await reportsService.getDashboardSummary(req.user);
  return sendSuccess(res, summary);
});

export const getConsiderationsReport = asyncHandler(async (req, res) => {
  const result = await reportsService.getConsiderationsReport(req.query, req.user);
  return sendSuccess(res, result.requests, result.meta);
});

export const getLeavesReport = asyncHandler(async (req, res) => {
  const result = await reportsService.getLeavesReport(req.query, req.user);
  return sendSuccess(res, result.leaves, result.meta);
});

export const exportConsiderations = asyncHandler(async (req, res) => {
  return reportsService.exportConsiderationsToExcel(req.query, res, req.user);
});

export const exportLeaves = asyncHandler(async (req, res) => {
  return reportsService.exportLeavesToExcel(req.query, res, req.user);
});

export const exportFaculty = asyncHandler(async (req, res) => {
  return reportsService.exportFacultyToExcel(res);
});

export default {
  getDashboardSummary,
  getConsiderationsReport,
  getLeavesReport,
  exportConsiderations,
  exportLeaves,
  exportFaculty,
};
