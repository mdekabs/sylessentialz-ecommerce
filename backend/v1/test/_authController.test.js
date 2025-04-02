import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import HttpStatus from 'http-status-codes';
import { User } from '../models/index.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { responseHandler, emailQueue, generatePasswordResetEmail } from '../utils/index.js';
import { updateBlacklist } from '../middlewares/index.js';
import AuthController from '../controllers/_authController.js';
import dotenv from 'dotenv';

dotenv.config();

chai.use(chaiAsPromised);
const { expect } = chai;

describe('AuthController', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  // Mock Express response object
  const mockResponse = () => {
    const res = {};
    res.status = sandbox.stub().returns(res);
    res.json = sandbox.stub().returns(res);
    return res;
  };

  describe('create_admin_user', () => {
    it('should create admin user if it doesn\'t exist', async () => {
      sandbox.stub(User, 'findOne').resolves(null);
      sandbox.stub(User.prototype, 'save').resolves();
      const consoleStub = sandbox.stub(console, 'log');

      await AuthController.create_admin_user();

      expect(User.findOne.calledOnce).to.be.true;
      expect(consoleStub.calledWith('✅ Admin user created successfully!')).to.be.true;
    });

    it('should not create admin if it exists', async () => {
      sandbox.stub(User, 'findOne').resolves({ email: 'admin@example.com' });
      const consoleStub = sandbox.stub(console, 'log');

      await AuthController.create_admin_user();

      expect(consoleStub.calledWith('ℹ️ Admin user already exists.')).to.be.true;
    });
  });

  describe('create_user', () => {
    it('should create a new user successfully', async () => {
      const req = { body: { username: 'test', email: 'test@example.com', password: 'password123' } };
      const res = mockResponse();
      const userMock = { _id: '123' };
      sandbox.stub(User, 'findOne').resolves(null);
      sandbox.stub(User.prototype, 'save').resolves(userMock);

      await AuthController.create_user(req, res);

      expect(res.status.calledWith(HttpStatus.CREATED)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'User has been created successfully',
        user: userMock
      })).to.be.true;
    });

    it('should return error if required fields are missing', async () => {
      const req = { body: { email: 'test@example.com' } }; // Missing username and password
      const res = mockResponse();

      await AuthController.create_user(req, res);

      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      const jsonCall = res.json.getCall(0).args[0];
      expect(jsonCall).to.deep.include({
        type: 'error',
        message: 'Username, email, and password are required.'
      });
    });
  });

  describe('login_user', () => {
    it('should login user successfully', async () => {
      const req = { body: { username: 'test', password: 'password123' } };
      const res = mockResponse();
      const userStub = {
        _id: '123',
        isAdmin: false,
        canLogin: sandbox.stub().returns(true),
        comparePassword: sandbox.stub().resolves(true),
        resetLoginAttempts: sandbox.stub().resolves(),
        _doc: { username: 'test', password: 'hashed' }
      };
      sandbox.stub(User, 'findOne').resolves(userStub);
      sandbox.stub(jwt, 'sign').returns('token');

      await AuthController.login_user(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Successfully logged in',
        username: 'test',
        accessToken: 'token'
      })).to.be.true;
    });
  });

  describe('logout_user', () => {
    it('should logout user successfully', async () => {
      const req = { header: sandbox.stub().returns('Bearer token') };
      const res = mockResponse();
      sandbox.stub(updateBlacklist, 'call').resolves();

      await AuthController.logout_user(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Successfully logged out.'
      })).to.be.true;
    });
  });

  describe('forgot_password', () => {
    it('should send reset password email', async () => {
      const req = { body: { email: 'test@example.com' } };
      const res = mockResponse();
      const userStub = {
        save: sandbox.stub().resolves(),
        email: 'test@example.com'
      };
      sandbox.stub(User, 'findOne').resolves(userStub);
      sandbox.stub(crypto, 'randomBytes').returns({ toString: () => 'token' });
      sandbox.stub(emailQueue, 'add').resolves();

      await AuthController.forgot_password(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Password reset email sent.'
      })).to.be.true;
    });
  });

  describe('reset_password', () => {
    it('should reset password successfully', async () => {
      const req = { body: { token: 'token', newPassword: 'newpass123' } };
      const res = mockResponse();
      const userStub = {
        save: sandbox.stub().resolves()
      };
      sandbox.stub(User, 'findOne').resolves(userStub);

      await AuthController.reset_password(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Password reset successful.'
      })).to.be.true;
    });
  });
});
