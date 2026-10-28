import considerationsService from './considerations.service.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';
import teacherPasscodeService from '../auth/teacherPasscode.service.js';

export const createConsideration = asyncHandler(async (req, res) => {
  const request = await considerationsService.createConsideration(req.user, req.body);
  return sendCreated(res, request);
});

export const getMine = asyncHandler(async (req, res) => {
  const result = await considerationsService.getStudentConsiderations(req.user.id, req.query);
  return sendSuccess(res, result.requests, result.meta);
});

export const getTGQueue = asyncHandler(async (req, res) => {
  const result = await considerationsService.getTGQueue(req.user, req.query);
  return sendSuccess(res, result.requests, result.meta);
});

export const getHODQueue = asyncHandler(async (req, res) => {
  const result = await considerationsService.getHODQueue(req.query, req.user);
  return sendSuccess(res, result.requests, result.meta);
});

export const getTGHistory = asyncHandler(async (req, res) => {
  const result = await considerationsService.getTGRecommendationsHistory(req.query, req.user);
  return sendSuccess(res, result.requests, result.meta);
});

export const getById = asyncHandler(async (req, res) => {
  const request = await considerationsService.getConsiderationById(req.params.id, req.user);
  return sendSuccess(res, request);
});

export const getTeacherApproved = asyncHandler(async (req, res) => {
  const result = await teacherPasscodeService.getApprovedConsiderations(req.query);
  return sendSuccess(res, result.requests, result.meta);
});

export const cancel = asyncHandler(async (req, res) => {
  const request = await considerationsService.cancelConsideration(req.params.id, req.user);
  return sendSuccess(res, request);
});

export const tgReview = asyncHandler(async (req, res) => {
  const request = await considerationsService.tgReview(req.params.id, req.user, req.body);
  return sendSuccess(res, request);
});

export const hodReview = asyncHandler(async (req, res) => {
  const request = await considerationsService.hodReview(req.params.id, req.user, req.body);
  return sendSuccess(res, request);
});

export const auditGroupStudent = asyncHandler(async (req, res) => {
  const request = await considerationsService.auditGroupStudent(req.params.id, req.user, req.body);
  return sendSuccess(res, request);
});

export const auditAllGroupStudents = asyncHandler(async (req, res) => {
  const request = await considerationsService.auditAllGroupStudents(req.params.id, req.user, req.body);
  return sendSuccess(res, request);
});

export default {
  createConsideration,
  getMine,
  getTGQueue,
  getHODQueue,
  getTGHistory,
  getById,
  getTeacherApproved,
  cancel,
  tgReview,
  hodReview,
  auditGroupStudent,
  auditAllGroupStudents,
};
