import Notice from '../../models/Notice.js';
import Notification from '../../models/Notification.js';
import User from '../../models/User.js';
import Student from '../../models/Student.js';
import AuditLog from '../../models/AuditLog.js';
import ApiError from '../../utils/ApiError.js';

export const createNotice = async (data, user) => {
  const {
    title,
    content,
    category = 'CIRCULAR',
    priority = 'NORMAL',
    targetAudience = 'ALL',
    targetSemester = null,
    targetSection = null,
    attachmentUrl = '',
    attachmentName = '',
  } = data;

  if (!title || !title.trim()) {
    throw ApiError.badRequest('Notice title is required');
  }
  if (!content || !content.trim()) {
    throw ApiError.badRequest('Notice content is required');
  }

  const notice = await Notice.create({
    title: title.trim(),
    content: content.trim(),
    author: user.id,
    authorRole: user.role,
    category,
    priority,
    targetAudience,
    targetSemester: targetSemester ? Number(targetSemester) : null,
    targetSection: targetSection || null,
    attachmentUrl,
    attachmentName,
    isActive: true,
  });

  // Resolve target recipients for in-app notification dispatch
  let targetUserIds = [];
  try {
    if (targetAudience === 'ALL') {
      const users = await User.find({ isActive: true }).select('_id');
      targetUserIds = users.map((u) => u._id);
    } else if (targetAudience === 'STUDENTS') {
      const users = await User.find({ role: 'STUDENT', isActive: true }).select('_id');
      targetUserIds = users.map((u) => u._id);
    } else if (targetAudience === 'FACULTY') {
      const users = await User.find({
        role: { $in: ['TEACHER', 'HOD', 'ADMIN'] },
        isActive: true,
      }).select('_id');
      targetUserIds = users.map((u) => u._id);
    } else if (targetAudience === 'SEMESTER' && targetSemester) {
      const students = await Student.find({ semester: Number(targetSemester) }).select('user');
      targetUserIds = students.map((s) => s.user).filter(Boolean);
    } else if (targetAudience === 'SECTION' && targetSection) {
      const students = await Student.find({ section: targetSection }).select('user');
      targetUserIds = students.map((s) => s.user).filter(Boolean);
    }

    if (targetUserIds.length > 0) {
      const noteTitle = `[Notice] ${notice.title}`;
      const noteMessage =
        notice.content.length > 120 ? notice.content.substring(0, 117) + '...' : notice.content;
      const noteType = notice.priority === 'URGENT' ? 'URGENT_NOTICE' : 'NOTICE';

      const notificationDocs = targetUserIds.map((uId) => ({
        user: uId,
        title: noteTitle,
        message: noteMessage,
        type: noteType,
        link: '/dashboard',
      }));

      for (let index = 0; index < notificationDocs.length; index += 500) {
        await Notification.insertMany(notificationDocs.slice(index, index + 500), { ordered: false });
      }
    }

    // Record audit log
    await AuditLog.create({
      action: 'NOTICE_PUBLISHED',
      performedBy: user.id,
      targetModel: 'Notice',
      targetId: notice._id,
      details: {
        title: notice.title,
        targetAudience: notice.targetAudience,
        priority: notice.priority,
        recipientCount: targetUserIds.length,
      },
    });
  } catch (err) {
    console.warn('Notice notification dispatch warning:', err.message);
  }

  return Notice.findById(notice._id)
    .populate('author', 'name email role')
    .populate('targetSection', 'name code semester');
};

export const getNotices = async (query = {}, user) => {
  const filter = { isActive: true };

  if (query.category) {
    filter.category = query.category;
  }
  if (query.priority) {
    filter.priority = query.priority;
  }

  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 50));

  const notices = await Notice.find(filter)
    .populate('author', 'name email role')
    .populate('targetSection', 'name code semester')
    .sort({ createdAt: -1 })
    .limit(limit);

  return notices;
};

export const deleteNotice = async (id, user) => {
  const notice = await Notice.findById(id);
  if (!notice) {
    throw ApiError.notFound('Notice not found');
  }

  // Only author, HOD, or ADMIN can delete notice
  if (
    user.role !== 'HOD' &&
    user.role !== 'ADMIN' &&
    String(notice.author) !== String(user.id)
  ) {
    throw ApiError.forbidden('You do not have permission to delete this notice');
  }

  notice.isActive = false;
  await notice.save();

  await AuditLog.create({
    action: 'NOTICE_DELETED',
    performedBy: user.id,
    targetModel: 'Notice',
    targetId: notice._id,
    details: { title: notice.title },
  }).catch(() => {});

  return { message: 'Notice deleted successfully' };
};

export default {
  createNotice,
  getNotices,
  deleteNotice,
};
