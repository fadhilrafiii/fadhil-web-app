import { NextFunction, Request, RequestHandler, Response } from 'express';

import bcrypt from 'bcrypt';
import Joi from 'joi';
import jwt from 'jsonwebtoken';

import User, { IUser } from 'models/User';

import { ErrorResponse, SuccessResponse } from 'helpers/response';
import { validateRequest } from 'helpers/validator/request';

import { JWT_EXPIRY_SECONDS } from 'constants/auth';

const loginSchema = Joi.object().keys({
  username: Joi.string().required(),
  password: Joi.string().min(6).required(),
});

export const loginController: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { username, password }: IUser = await validateRequest<IUser>(loginSchema, req.body);

    const user = await User.findOne({
      $or: [{ email: username }, { username }],
    });
    if (!user) throw new ErrorResponse('User not found, wrong username!', 400);

    const isPasswordTrue = await bcrypt.compare(password, user.password);
    if (!isPasswordTrue) throw new ErrorResponse('Wrong password!', 400);

    const secretKey = process.env.JWT_SECRET_KEY;
    if (!secretKey) throw new ErrorResponse("Secret key not found, can't check password!", 500);

    const token = jwt.sign(user.toObject(), secretKey, {
      algorithm: 'HS256',
      expiresIn: JWT_EXPIRY_SECONDS,
    });

    const userObject = user.toObject();
    delete userObject.password;
    delete userObject._id;
    delete userObject.createdAt;
    delete userObject.updatedAt;
    const response = new SuccessResponse(userObject, 'Login success!');

    res
      .cookie('token', token, { maxAge: JWT_EXPIRY_SECONDS * 1000 })
      .status(response.status)
      .json(response);
  } catch (error) {
    next(error);
  }
};
