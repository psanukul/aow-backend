import { validationResult } from "express-validator";
import { ApiError } from "../utils/ApiError.js";

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (errors.isEmpty()) {
        return next();
    }
    const extractedErrors = [];
    errors.array().map(err => extractedErrors.push({ [err.path]: err.msg }));

    throw new ApiError(422, "Validation failed", extractedErrors);
};

export { validate };