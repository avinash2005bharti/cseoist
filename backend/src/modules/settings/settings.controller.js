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

export default {
  getConsiderationWindow,
  setConsiderationWindow,
};
