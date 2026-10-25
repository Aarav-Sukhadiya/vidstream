const { z } = require('zod');

const ALLOWED_CONTENT_TYPES = [
  'video/mp4',
  'video/quicktime', // .mov
  'video/webm',
];

function getMaxUploadBytes() {
  const maxMb = parseInt(process.env.MAX_UPLOAD_MB, 10) || 100;
  return maxMb * 1024 * 1024;
}

const createVideoSchema = z
  .object({
    title: z
      .string({ required_error: 'Title is required' })
      .trim()
      .min(1, 'Title cannot be empty')
      .max(100, 'Title cannot exceed 100 characters'),
    description: z
      .string()
      .trim()
      .max(5000, 'Description cannot exceed 5000 characters')
      .default(''),
    tags: z
      .array(
        z
          .string()
          .trim()
          .toLowerCase()
          .max(30, 'Tag cannot exceed 30 characters')
      )
      .max(10, 'At most 10 tags allowed')
      .default([]),
    visibility: z
      .enum(['public', 'unlisted', 'private'], {
        errorMap: () => ({ message: 'Visibility must be public, unlisted, or private' }),
      })
      .default('public'),
    fileName: z
      .string({ required_error: 'File name is required' })
      .trim()
      .min(1, 'File name is required')
      .refine(
        (val) => !val.toLowerCase().endsWith('.exe') && !val.toLowerCase().endsWith('.sh'),
        { message: 'Executable files are strictly disallowed' }
      ),
    contentType: z
      .string({ required_error: 'Content type is required' })
      .refine((val) => ALLOWED_CONTENT_TYPES.includes(val), {
        message: 'Invalid video content type. Supported formats: mp4, mov, webm',
      }),
    sizeBytes: z
      .number({ required_error: 'File size is required' })
      .int('File size must be an integer')
      .positive('File size must be greater than 0')
      .refine((val) => val <= getMaxUploadBytes(), {
        message: `File size exceeds the allowed limit of ${process.env.MAX_UPLOAD_MB || 100} MB`,
      }),
  })
  .strict();

module.exports = {
  createVideoSchema,
  ALLOWED_CONTENT_TYPES,
  getMaxUploadBytes,
};
