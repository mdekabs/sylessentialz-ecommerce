import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { Cart } from '../models/index.js'; // Adjust path as needed
import HttpStatus from 'http-status-codes';
import CartController from '../controllers/_cartController.js'; // Adjust path to your controller file

describe('CartController', () => {
  describe('get_cart', () => {
    let req, res, sandbox, session;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      req = {
        user: { id: 'user123' },
        body: {}
      };
      res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub()
      };
      session = {
        startTransaction: sandbox.stub(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub()
      };
      sandbox.stub(mongoose, 'startSession').resolves(session);
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should retrieve an active user cart successfully', async () => {
      const cart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: 'p1', quantity: 2 }],
        lastUpdated: new Date()
      };
      const populatedCart = {
        ...cart,
        products: [{ productId: { name: 'Product 1', price: 10, stock: 100, image: 'img.jpg' }, quantity: 2 }]
      };

      const findOneStub = sandbox.stub(Cart, 'findOne');
      findOneStub.withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(cart)
      });
      findOneStub.withArgs({ userId: 'user123' }).onSecondCall().returns({
        populate: sandbox.stub().withArgs('products.productId', 'name price stock image').returnsThis(),
        lean: sandbox.stub().resolves(populatedCart)
      });

      await CartController.get_cart(req, res);

      expect(mongoose.startSession.calledOnce, 'startSession should be called once').to.be.true;
      expect(session.startTransaction.calledOnce, 'startTransaction should be called once').to.be.true;
      expect(findOneStub.calledTwice, 'findOne should be called twice').to.be.true;
      expect(findOneStub.calledWith({ userId: 'user123' }), 'findOne should query by userId').to.be.true;
      expect(findOneStub.secondCall.returnValue.populate.calledOnce, 'populate should be called once').to.be.true;
      expect(findOneStub.secondCall.returnValue.populate.calledWith('products.productId', 'name price stock image'), 'populate should use correct fields').to.be.true;
      expect(findOneStub.secondCall.returnValue.lean.calledOnce, 'lean should be called once').to.be.true;
      expect(session.commitTransaction.calledOnce, 'commitTransaction should be called once').to.be.true;
      expect(session.endSession.calledOnce, 'endSession should be called once').to.be.true;
      expect(res.status.calledWith(HttpStatus.OK), 'res.status should be 200').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called once').to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart created successfully',
        cart: populatedCart
      }), 'res.json should return the populated cart').to.be.true;
    });

    it('should return 404 when no cart is found for the user', async () => {
      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(null)
      });

      await CartController.get_cart(req, res);

      expect(mongoose.startSession.calledOnce, 'startSession should be called once').to.be.true;
      expect(session.startTransaction.calledOnce, 'startTransaction should be called once').to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' }), 'findOne should query by userId').to.be.true;
      expect(session.commitTransaction.called, 'commitTransaction should not be called').to.be.false;
      expect(session.abortTransaction.called, 'abortTransaction should not be called').to.be.false;
      expect(session.endSession.calledOnce, 'endSession should be called once').to.be.true;
      expect(res.status.calledWith(HttpStatus.NOT_FOUND), 'res.status should be 404').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called once').to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found'
      }), 'res.json should return not found error').to.be.true;
    });

    it('should clear and return 404 for an expired cart', async () => {
      const expiredCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: 'p1', quantity: 2 }],
        lastUpdated: new Date(Date.now() - 31 * 60 * 1000)
      };
      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(expiredCart)
      });
      sandbox.stub(CartController, 'clearExpiredCart').resolves();

      await CartController.get_cart(req, res);

      expect(mongoose.startSession.calledOnce, 'startSession should be called once').to.be.true;
      expect(session.startTransaction.calledOnce, 'startTransaction should be called once').to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' }), 'findOne should query by userId').to.be.true;
      expect(CartController.clearExpiredCart.calledOnceWith('cart1'), 'clearExpiredCart should be called with cart ID').to.be.true;
      expect(session.commitTransaction.calledOnce, 'commitTransaction should be called once').to.be.true;
      expect(session.endSession.calledOnce, 'endSession should be called once').to.be.true;
      expect(res.status.calledWith(HttpStatus.NOT_FOUND), 'res.status should be 404').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called once').to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart has expired and been cleared'
      }), 'res.json should return expired error').to.be.true;
    });

    it('should handle errors during cart retrieval', async () => {
      const errorMessage = 'Database error occurred';
      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().rejects(new Error(errorMessage))
      });

      await CartController.get_cart(req, res);

      expect(mongoose.startSession.calledOnce, 'startSession should be called once').to.be.true;
      expect(session.startTransaction.calledOnce, 'startTransaction should be called once').to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' }), 'findOne should be called once').to.be.true;
      expect(session.abortTransaction.calledOnce, 'abortTransaction should be called once').to.be.true;
      expect(session.endSession.calledOnce, 'endSession should be called once').to.be.true;
      expect(res.status.calledWith(HttpStatus.INTERNAL_SERVER_ERROR), 'res.status should be 500').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called once').to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Failed to retrieve cart',
        error: errorMessage
      }), 'res.json should return the error').to.be.true;
    });
  });

  describe('get_carts', () => {
    let req, res, sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      req = {
        query: {} // Mock query params
      };
      res = {
        locals: {
          pagination: { page: 1, limit: 10, hasMorePages: false, links: {} }, // Mock pagination middleware data
          setPagination: sandbox.stub() // Mock setPagination method
        },
        status: sandbox.stub().returnsThis(), // Chainable status
        json: sandbox.stub() // json method
      };
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should retrieve carts successfully with default pagination and sorting', async () => {
      // Mock data
      const carts = [
        { _id: '1', products: [{ productId: 'p1', quantity: 2 }], createdAt: new Date() },
        { _id: '2', products: [{ productId: 'p2', quantity: 1 }], createdAt: new Date() }
      ];
      const totalItems = 15;

      // Stub Cart methods
      const cartFindStub = sandbox.stub(Cart, 'find').returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(carts)
      });
      sandbox.stub(Cart, 'countDocuments').resolves(totalItems);

      // Execute
      await CartController.get_carts(req, res);

      // Assertions
      expect(cartFindStub.calledOnce, 'Cart.find should be called once').to.be.true;
      expect(cartFindStub().populate.calledWith('products.productId', 'name price stock image'), 'populate should be called with correct fields').to.be.true;
      expect(cartFindStub().sort.calledWith({ createdAt: 1 }), 'sort should use default createdAt ascending').to.be.true;
      expect(cartFindStub().skip.calledWith(0), 'skip should be 0 for page 1').to.be.true;
      expect(cartFindStub().limit.calledWith(10), 'limit should be 10').to.be.true;
      expect(cartFindStub().lean.calledOnce, 'lean should be called once').to.be.true;

      expect(res.locals.setPagination.calledOnceWith(totalItems), 'setPagination should be called with totalItems').to.be.true;

      const expectedResponseData = {
        carts,
        pagination: {
          page: 1,
          limit: 10,
          totalItems,
          totalPages: Math.ceil(totalItems / 10),
          hasMorePages: false,
          links: {}
        }
      };
      expect(res.status.calledWith(HttpStatus.OK), 'res.status should be called with 200').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called once').to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Carts retrieved successfully',
        ...expectedResponseData
      }), 'res.json should be called with correct response').to.be.true;
    });

    it('should retrieve carts with custom sort and order from query parameters', async () => {
      req.query = { sort: 'lastUpdated', order: 'desc' };
      const cartFindStub = sandbox.stub(Cart, 'find').returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves([])
      });
      sandbox.stub(Cart, 'countDocuments').resolves(0);

      await CartController.get_carts(req, res);

      expect(cartFindStub().sort.calledWith({ lastUpdated: -1 }), 'sort should use query params').to.be.true;
      expect(res.status.calledWith(HttpStatus.OK), 'res.status should be 200').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called').to.be.true;
    });

    it('should handle errors during cart retrieval', async () => {
      const errorMessage = 'Database error occurred';
      sandbox.stub(Cart, 'find').returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        lean: sandbox.stub().rejects(new Error(errorMessage))
      });
      sandbox.stub(Cart, 'countDocuments').resolves(0);

      await CartController.get_carts(req, res);

      expect(res.status.calledWith(HttpStatus.INTERNAL_SERVER_ERROR), 'res.status should be 500').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called').to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Failed to retrieve carts',
        error: errorMessage
      }), 'res.json should return the error').to.be.true;
    });
  });
});
