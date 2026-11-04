import settingsService from './settings.service.js';
import { sendSuccess } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const getConsiderationWindow = asyncHandler(async (req, res) => {
  const result = await settingsService.getConsiderationWindowSetting();
  return sendSuccess(res, result);
});

export const setConsiderationWindow = asyncHandler(async (req, res) => {
  const { enabled } = req.body;
  const result = await settingsService.setConsiderationWindowSetting(req.user, enabled);
  return sendSuccess(res, result);
});

export const getAcademicYear = asyncHandler(async (req, res) => {
  const result = await settingsService.getAcademicYearSetting();
  return sendSuccess(res, result);
});

export const setAcademicYear = asyncHandler(async (req, res) => {
  const result = await settingsService.setAcademicYearSetting(req.user, req.body.academicYear);
  return sendSuccess(res, result);
});

export default {
  getAcademicYear,
  setAcademicYear,
  getConsiderationWindow,
  setConsiderationWindow,
};
