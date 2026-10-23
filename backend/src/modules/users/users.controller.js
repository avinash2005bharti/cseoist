import usersService from './users.service.js';
import { sendSuccess, sendCreated } from '../../utils/response.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const listUsers = asyncHandler(async (req, res) => {
  const result = await usersService.listUsers(req.query);
  return sendSuccess(res, result.users, result.meta);
});

export const createUser = asyncHandler(async (req, res) => {
  const result = await usersService.createUser(req.body);
  return sendCreated(res, result);
});

export const getUserById = asyncHandler(async (req, res) => {
  const result = await usersService.getUserById(req.params.id);
  return sendSuccess(res, result);
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(req.params.id, req.body);
  return sendSuccess(res, user);
});

export const resetPassword = asyncHandler(async (req, res) => {
  const customPassword = req.body.password || req.body.customPassword;
  const result = await usersService.resetPassword(req.params.id, customPassword, req.user);
  return sendSuccess(res, result);
});

export const updateStatus = asyncHandler(async (req, res) => {
  const user = await usersService.updateStatus(req.params.id, req.body.isActive);
  return sendSuccess(res, user);
});

export const deleteUser = asyncHandler(async (req, res) => {
  const result = await usersService.deleteUser(req.params.id, req.user);
  return sendSuccess(res, result);
});

export const appointHOD = asyncHandler(async (req, res) => {
  const result = await usersService.appointHOD(req.params.id, req.user);
  return sendSuccess(res, result);
});

export const removeHOD = asyncHandler(async (req, res) => {
  const result = await usersService.removeHOD(req.params.id, req.user);
  return sendSuccess(res, result);
});

export const appointTG = asyncHandler(async (req, res) => {
  const result = await usersService.appointTG(req.params.id, req.body, req.user);
  return sendSuccess(res, result);
});

export const removeTG = asyncHandler(async (req, res) => {
  const result = await usersService.removeTG(req.params.id, req.user);
  return sendSuccess(res, result);
});

export default {
  listUsers,
  createUser,
  getUserById,
  updateUser,
  deleteUser,
  appointHOD,
  removeHOD,
  appointTG,
  removeTG,
  resetPassword,
  updateStatus,
};

