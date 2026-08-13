import path from 'node:path';

export const DOCUMENT_UPLOAD_LIMIT = 100 * 1024 * 1024;
export const CLIENT_UPLOAD_LIMIT = 50 * 1024 * 1024;
export const VIDEO_UPLOAD_LIMIT = 30 * 1024 * 1024;

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const documentTypes = new Set([
  ...imageTypes,
  'application/pdf', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'video/mp4', 'video/quicktime', 'video/webm',
]);
const documentExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.pdf', '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.mp4', '.mov', '.webm']);

function reject(callback, message) {
  const error = new Error(message);
  error.statusCode = 415;
  callback(error);
}

export function documentFileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!documentTypes.has(file.mimetype) || !documentExtensions.has(extension)) return reject(callback, 'סוג הקובץ אינו נתמך');
  callback(null, true);
}

export function imageFileFilter(_request, file, callback) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  if (!imageTypes.has(file.mimetype) || !['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(extension)) return reject(callback, 'יש לבחור קובץ תמונה תקין');
  callback(null, true);
}

export function pdfFileFilter(_request, file, callback) {
  if (file.mimetype !== 'application/pdf' || path.extname(file.originalname || '').toLowerCase() !== '.pdf') return reject(callback, 'יש לבחור קובץ PDF תקין');
  callback(null, true);
}

export function assertVideoSize(file, isAdmin) {
  if (file?.mimetype?.startsWith('video/') && file.size > VIDEO_UPLOAD_LIMIT && !isAdmin) {
    const error = new Error('סרטון מוגבל ל־30MB. העלאה גדולה יותר זמינה למנהל מערכת בלבד');
    error.statusCode = 413;
    throw error;
  }
}
