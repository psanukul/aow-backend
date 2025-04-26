import User from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";


/**
 * @description Register a new user via local strategy (email/password)
 * @route POST /api/v1/users/register
 * @access Public
 * @middleware localUserRegistrationValidator, validate (applied in routes)
 */
const createUser = asyncHandler(async (req, res) => {
    const { username, email, password, fullName } = req.body;


    const existingUser = await User.findOne({
        $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
    });

    if (existingUser) {
        throw new ApiError(409, "User with this email or username already exists");
    }

    const newUser = await User.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password: password,
        fullName: fullName || "",
        provider: 'local'
    });

    if (!newUser) {
        throw new ApiError(500, "Something went wrong while registering the user");
    }

    const createdUserResponse = newUser.toObject();
    delete createdUserResponse.password;

    return res.status(201).json( 
        new ApiResponse(
            201,
            createdUserResponse,
            "User registered successfully"
        )
    );
});

export {
    createUser
};