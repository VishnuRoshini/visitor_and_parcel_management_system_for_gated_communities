import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain, body, param, query } from 'express-validator';
import { ValidationError } from '../utils/errors';

// Run validation and handle errors
export function validate(validations: ValidationChain[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    
    if (errors.isEmpty()) {
      next();
      return;
    }

    const formattedErrors = errors.array().map(err => ({
      field: (err as { path?: string }).path || 'unknown',
      message: err.msg,
    }));

    throw new ValidationError(formattedErrors);
  };
}

// =====================================================
// Validation Rules
// =====================================================

// Auth validations
export const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .withMessage('Valid email is required')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Visitor validations
export const createVisitorValidation = [
  body('resident_id')
    .isInt({ min: 1 })
    .withMessage('Valid resident ID is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Visitor name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('purpose_or_description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Purpose must not exceed 500 characters'),
  body('media_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Media URL must be a valid URL'),
  body('vehicle_details')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Vehicle details must not exceed 100 characters'),
];

export const updateVisitorStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid record ID is required'),
  body('status')
    .isIn(['NEW', 'WAITING', 'APPROVED', 'REJECTED', 'ENTERED', 'EXITED'])
    .withMessage('Invalid visitor status'),
];

// Parcel validations
export const createParcelValidation = [
  body('resident_id')
    .isInt({ min: 1 })
    .withMessage('Valid resident ID is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Sender/Parcel name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('purpose_or_description')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description must not exceed 500 characters'),
  body('media_url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Media URL must be a valid URL'),
];

export const updateParcelStatusValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid record ID is required'),
  body('status')
    .isIn(['RECEIVED', 'ACKNOWLEDGED', 'COLLECTED'])
    .withMessage('Invalid parcel status'),
];

// Common validations
export const idParamValidation = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Valid ID is required'),
];

export const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];

export const recordFilterValidation = [
  ...paginationValidation,
  query('type')
    .optional()
    .isIn(['VISITOR', 'PARCEL'])
    .withMessage('Type must be VISITOR or PARCEL'),
  query('status')
    .optional()
    .notEmpty()
    .withMessage('Status filter cannot be empty'),
];
