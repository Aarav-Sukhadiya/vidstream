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

const titleField = z
  .string({ required_error: 'Title is required' })
  .trim()
  .min(1, 'Title cannot be empty')
  .max(100, 'Title cannot exceed 100 characters');

const descriptionField = z
  .string()
  .trim()
  .max(5000, 'Description cannot exceed 5000 characters');

const tagsField = z
  .array(z.string().trim().toLowerCase().max(30, 'Tag cannot exceed 30 characters'))
  .max(10, 'At most 10 tags allowed')
  // drop empty tags and duplicates
  .transform((tags) => [...new Set(tags.filter(Boolean))]);

const visibilityField = z.enum(['public', 'unlisted', 'private'], {
  errorMap: () => ({ message: 'Visibility must be public, unlisted, or private' }),
});

const createVideoSchema = z
  .object({
    title: titleField,
    description: descriptionField.default(''),
    tags: tagsField.default([]),
    visibility: visibilityField.default('public'),
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

const updateVideoSchema = z
  .object({
    title: titleField.optional(),
    description: descriptionField.optional(),
    tags: tagsField.optional(),
    visibility: visibilityField.optional(),
  })
  .strict();

const confirmUploadSchema = z.object({
  public_id: z.string().trim().min(1).max(255).optional(),
  secure_url: z.string().url().max(2048).optional(),
});

const progressSchema = z.object({
  positionSec: z.coerce
    .number({ invalid_type_error: 'Valid positionSec is required' })
    .finite()
    .min(0),
  durationSec: z.coerce.number().finite().min(0).optional(),
});

const reactionSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)], {
    errorMap: () => ({ message: 'Reaction value must be 1, -1, or 0' }),
  }),
});

const createCommentSchema = z.object({
  body: z
    .string({ required_error: 'Comment body is required' })
    .trim()
    .min(1, 'Comment body is required')
    .max(1000, 'Comment body cannot exceed 1000 characters'),
  parentId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i, 'Invalid parentId')
    .nullish(),
});

module.exports = {
  createVideoSchema,
  updateVideoSchema,
  confirmUploadSchema,
  progressSchema,
  reactionSchema,
  createCommentSchema,
  ALLOWED_CONTENT_TYPES,
  getMaxUploadBytes,
};
