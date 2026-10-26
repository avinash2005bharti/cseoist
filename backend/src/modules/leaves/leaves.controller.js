import leavesService from './leaves.service.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const createLeave = asyncHandler(async (req, res) => {
  const leave = await leavesService.createLeave(req.user, req.body);
  return sendCreated(res, leave);
});

export const getMine = asyncHandler(async (req, res) => {
  const result = await leavesService.getMyLeaves(req.user.id, req.query);
  return sendSuccess(res, result.leaves, result.meta);
});

export const getTGQueue = asyncHandler(async (req, res) => {
  const result = await leavesService.getTGLeaveQueue(req.user, req.query);
  return sendSuccess(res, result.leaves, result.meta);
});

export const getHODQueue = asyncHandler(async (req, res) => {
  const result = await leavesService.getHODLeaveQueue(req.query, req.user);
  return sendSuccess(res, result.leaves, result.meta);
});

export const getTGHistory = asyncHandler(async (req, res) => {
  const result = await leavesService.getTGRecommendationsHistory(req.query, req.user);
  return sendSuccess(res, result.leaves, result.meta);
});

export const getAdminQueue = asyncHandler(async (req, res) => {
  const result = await leavesService.getAdminLeaveQueue(req.query);
  return sendSuccess(res, result.leaves, result.meta);
});

export const getById = asyncHandler(async (req, res) => {
  const leave = await leavesService.getLeaveById(req.params.id, req.user);
  return sendSuccess(res, leave);
});

export const cancel = asyncHandler(async (req, res) => {
  const leave = await leavesService.cancelLeave(req.params.id, req.user);
  return sendSuccess(res, leave);
});

export const tgReview = asyncHandler(async (req, res) => {
  const leave = await leavesService.tgReviewLeave(req.params.id, req.user, req.body);
  return sendSuccess(res, leave);
});

export const finalReview = asyncHandler(async (req, res) => {
  const leave = await leavesService.finalReviewLeave(req.params.id, req.user, req.body);
  return sendSuccess(res, leave);
});

export default {
  createLeave,
  getMine,
  getTGQueue,
  getHODQueue,
  getTGHistory,
  getAdminQueue,
  getById,
  cancel,
  tgReview,
  finalReview,
};
