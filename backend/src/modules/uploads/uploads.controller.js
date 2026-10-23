import uploadsService from './uploads.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';

export const getAuth = asyncHandler(async (req, res) => {
  const authParams = uploadsService.getAuthParameters();
  return sendSuccess(res, authParams);
});

export const verify = asyncHandler(async (req, res) => {
  const attachment = await uploadsService.verifyUpload(req.body.fileId, req.user.id);
  return sendSuccess(res, attachment);
});

export const getSignedUrl = asyncHandler(async (req, res) => {
  const result = await uploadsService.generateSignedUrl(req.query.fileId, req.user);
  return sendSuccess(res, result);
});

export const uploadDirect = asyncHandler(async (req, res) => {
  const result = await uploadsService.uploadDirect(req.file, req.user?.id);
  return sendSuccess(res, result);
});

export const deleteUpload = asyncHandler(async (req, res) => {
  const result = await uploadsService.deleteFile(req.params.fileId, req.user.id, req.user);
  return sendSuccess(res, result);
});

export default {
  getAuth,
  verify,
  uploadDirect,
  getSignedUrl,
  deleteUpload,
};

