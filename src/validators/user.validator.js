import { body } from 'express-validator';

const localUserRegistrationValidator = () => {
    return [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Email format is invalid')
            .normalizeEmail(),

        body('username')
            .trim()
            .notEmpty().withMessage('Username is required')
            .isLength({ min: 3 }).withMessage('Username must be at least 3 characters long')
            .escape(),

        body('password')
            .notEmpty().withMessage('Password is required')
            .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),

        body('displayName')
            .optional()
            .trim()
            .escape(),

        body('avatarUrl')
            .optional()
            .trim()
            .escape(),

        body('provider').not().exists(),
        body('providerId').not().exists(),
    ];
};

const oAuthUserValidator = () => {
     return [
        body('email')
            .optional({ checkFalsy: true })
            .isEmail().withMessage('Email format is invalid')
            .normalizeEmail(),

        body('provider')
            .isIn(['google', 'facebook', 'github']).withMessage('Invalid OAuth provider'),
        body('providerId')
            .notEmpty().withMessage('Provider ID is missing'),
        body('displayName').optional().trim().escape(),
        body('avatarUrl').optional().trim().isURL().withMessage('Avatar URL must be valid'),

        body('password').not().exists(),
        body('username').not().exists(),
    ];
}


export {
    localUserRegistrationValidator,
    oAuthUserValidator
};