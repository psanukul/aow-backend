import { Router } from 'express';
import { localUserRegistrationValidator } from '../validators/user.validator.js';
import { validate } from '../validators/validate.js';
import { createUser } from '../controllers/user.controller.js';

const router = Router();

router.route('/register').post(
    localUserRegistrationValidator(),
    validate,
    createUser
);

// router.route('/auth/google/callback').post(oAuthUserValidator(), validate, handleGoogleCallback);

export default router;