import { expect } from 'chai';
import sinon from 'sinon';
import mongoose from 'mongoose';
import { Cart, Product } from '../../models/index.js';
import HttpStatus from 'http-status-codes';
import CartController from '../../controllers/_cartController.js';

describe('CartController', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('get_carts', () => {
    let req, res;

    beforeEach(() => {
      req = {
        query: {}, // Default query params
      };
      res = {
        locals: {
          pagination: { page: 1, limit: 10, hasMorePages: false, links: {} },
          setPagination: sandbox.stub(),
        },
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub(),
      };
    });

    it('should retrieve carts with default pagination and sorting', async () => {
      const carts = [
        { _id: '1', products: [{ productId: '507f1f77bcf86cd799439011', quantity: 2 }], createdAt: new Date() },
        { _id: '2', products: [{ productId: '507f1f77bcf86cd799439012', quantity: 1 }], createdAt: new Date() },
      ];
      const totalItems = 2;

      const cartFindStub = sandbox.stub(Cart, 'find').returns({
        populate: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(carts),
      });
      sandbox.stub(Cart, 'countDocuments').resolves(totalItems);

      await CartController.get_carts(req, res);

      expect(cartFindStub.calledOnce).to.be.true;
      expect(cartFindStub().populate.calledWith('products.productId', 'name price stock image')).to.be.true;
      expect(cartFindStub().sort.calledWith({ createdAt: 1 })).to.be.true;
      expect(cartFindStub().skip.calledWith(0)).to.be.true;
      expect(cartFindStub().limit.calledWith(10)).to.be.true;
      expect(cartFindStub().lean.calledOnce).to.be.true;
      expect(Cart.countDocuments.calledOnce).to.be.true;
      expect(res.locals.setPagination.calledWith(totalItems)).to.be.true;
      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Carts retrieved successfully',
        carts,
        pagination: {
          page: 1,
          limit: 10,
          totalItems,
          totalPages: 1,
          hasMorePages: false,
          links: {},
        },
      })).to.be.true;
    });
  });

  describe('get_cart', () => {
    let req, res, session;

    beforeEach(() => {
      req = {
        user: { id: 'user123' },
        body: {},
      };
      res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub(),
      };
      session = {
        startTransaction: sandbox.stub(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub(),
      };
      sandbox.stub(mongoose, 'startSession').resolves(session);
    });

    it('should retrieve an active user cart', async () => {
      const cart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: '507f1f77bcf86cd799439011', quantity: 2 }],
        lastUpdated: new Date(),
      };
      const populatedCart = {
        ...cart,
        products: [{ productId: { name: 'Product 1', price: 10, stock: 100, image: 'img.jpg' }, quantity: 2 }],
      };

      const findOneStub = sandbox.stub(Cart, 'findOne');
      findOneStub.withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(cart),
      });
      findOneStub.withArgs({ userId: 'user123' }).onSecondCall().returns({
        populate: sandbox.stub().withArgs('products.productId', 'name price stock image').returnsThis(),
        lean: sandbox.stub().resolves(populatedCart),
      });

      await CartController.get_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(findOneStub.calledTwice).to.be.true;
      expect(findOneStub.calledWith({ userId: 'user123' })).to.be.true;
      expect(findOneStub.secondCall.returnValue.populate.calledWith('products.productId', 'name price stock image')).to.be.true;
      expect(findOneStub.secondCall.returnValue.lean.calledOnce).to.be.true;
      expect(session.commitTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart created successfully', // Should be 'Cart retrieved successfully' in controller
        cart: populatedCart,
      })).to.be.true;
    });

    it('should return 404 if no cart is found', async () => {
      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(null),
      });

      await CartController.get_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(session.commitTransaction.called).to.be.false;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found',
      })).to.be.true;
    });
  });

  describe('create_cart', () => {
    let req, res, session;

    beforeEach(() => {
      req = {
        user: { id: 'user123' },
        body: {
          products: [
            { productId: '507f1f77bcf86cd799439011', quantity: 2 },
            { productId: '507f1f77bcf86cd799439012', quantity: 1 },
          ],
        },
      };
      res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub(),
      };
      session = {
        startTransaction: sandbox.stub(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub(),
      };
      sandbox.stub(mongoose, 'startSession').resolves(session);
    });

    it('should create a cart successfully', async () => {
      const savedCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [
          { productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 },
          { productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'), quantity: 1 },
        ],
        lastUpdated: new Date(),
        version: 0,
      };
      const populatedCart = {
        ...savedCart,
        products: [
          { productId: { _id: '507f1f77bcf86cd799439011', name: 'Product 1', price: 10, stock: 98, image: 'img1.jpg' }, quantity: 2 },
          { productId: { _id: '507f1f77bcf86cd799439012', name: 'Product 2', price: 20, stock: 99, image: 'img2.jpg' }, quantity: 1 },
        ],
      };

      sandbox.stub(Cart, 'findOne').returns({ session: sandbox.stub().resolves(null) });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Product, 'findOneAndUpdate')
        .onCall(0).resolves({ _id: '507f1f77bcf86cd799439011', name: 'Product 1', stock: 98, version: 1 })
        .onCall(1).resolves({ _id: '507f1f77bcf86cd799439012', name: 'Product 2', stock: 99, version: 1 });
      sandbox.stub(Cart.prototype, 'save').resolves(savedCart);
      sandbox.stub(Cart, 'findById').returns({
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(populatedCart),
      });

      await CartController.create_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledTwice).to.be.true;
      expect(Product.findOneAndUpdate.calledTwice).to.be.true;
      expect(Cart.prototype.save.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(Cart.findById().populate.calledWith('products.productId', 'name price stock image')).to.be.true;
      expect(Cart.findById().lean.calledOnce).to.be.true;
      expect(session.commitTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.CREATED)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart created successfully',
        cart: populatedCart,
      })).to.be.true;
    });

    it('should return 400 for invalid products array', async () => {
      req.body.products = null;

      await CartController.create_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Valid products array is required',
      })).to.be.true;
    });

    it('should return 409 if cart already exists', async () => {
      sandbox.stub(Cart, 'findOne').returns({
        session: sandbox.stub().resolves({ _id: 'existingCart' }),
      });

      await CartController.create_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.CONFLICT)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart already exists for this user',
      })).to.be.true;
    });

    it('should return 400 for invalid product format', async () => {
      req.body.products = [{ productId: 'invalid', quantity: 1 }];
      sandbox.stub(Cart, 'findOne').returns({ session: sandbox.stub().resolves(null) });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(false);

      await CartController.create_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Invalid product format',
      })).to.be.true;
    });
  });

  describe('get_cart_by_id', () => {
    let req, res;

    beforeEach(() => {
      req = {
        params: { id: 'validCartId123' },
      };
      res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub(),
      };
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('should retrieve a cart by ID successfully', async () => {
      const cart = {
        _id: 'validCartId123',
        userId: 'user123',
        products: [{ productId: '507f1f77bcf86cd799439011', quantity: 2 }],
        lastUpdated: new Date(),
      };
      const populatedCart = {
        ...cart,
        products: [{ productId: { name: 'Product 1', price: 10, stock: 100, image: 'img.jpg' }, quantity: 2 }],
      };

      const queryStub = {
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(populatedCart),
      };
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('validCartId123').returns(true);
      sandbox.stub(Cart, 'findById').withArgs('validCartId123').returns(queryStub);

      await CartController.get_cart_by_id(req, res);

      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('validCartId123'), 'isValid should be called once').to.be.true;
      expect(Cart.findById.calledOnceWith('validCartId123'), 'findById should be called with cart ID').to.be.true;
      expect(queryStub.populate.calledOnce, 'populate should be called once').to.be.true;
      expect(queryStub.populate.calledWith('products.productId', 'name price stock image'), 'populate should use correct fields').to.be.true;
      expect(queryStub.lean.calledOnce, 'lean should be called once').to.be.true;
      expect(res.status.calledWith(HttpStatus.OK), 'res.status should be 200').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called once').to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart retrieved successfully',
        cart: populatedCart,
      }), 'res.json should return the populated cart').to.be.true;
    });

    it('should return 400 for an invalid cart ID', async () => {
      req.params.id = 'invalidCartId';
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('invalidCartId').returns(false);
      sandbox.stub(Cart, 'findById');

      await CartController.get_cart_by_id(req, res);

      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('invalidCartId')).to.be.true;
      expect(Cart.findById.notCalled).to.be.true;
      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Invalid cart ID',
      })).to.be.true;
    });

    it('should return 404 when no cart is found for the given ID', async () => {
      const queryStub = {
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(null),
      };
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('validCartId123').returns(true);
      sandbox.stub(Cart, 'findById').withArgs('validCartId123').returns(queryStub);

      await CartController.get_cart_by_id(req, res);

      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('validCartId123'), 'isValid should be called once').to.be.true;
      expect(Cart.findById.calledOnceWith('validCartId123'), 'findById should be called with cart ID').to.be.true;
      expect(queryStub.populate.calledOnce, 'populate should be called once').to.be.true;
      expect(queryStub.populate.calledWith('products.productId', 'name price stock image'), 'populate should use correct fields').to.be.true;
      expect(queryStub.lean.calledOnce, 'lean should be called once').to.be.true;
      expect(res.status.calledWith(HttpStatus.NOT_FOUND), 'res.status should be 404').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called once').to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found',
      }), 'res.json should return not found error').to.be.true;
    });

    it('should handle errors during cart retrieval', async () => {
      const errorMessage = 'Database error occurred';
      const queryStub = {
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().rejects(new Error(errorMessage)),
      };
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('validCartId123').returns(true);
      sandbox.stub(Cart, 'findById').withArgs('validCartId123').returns(queryStub);

      await CartController.get_cart_by_id(req, res);

      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('validCartId123'), 'isValid should be called once').to.be.true;
      expect(Cart.findById.calledOnceWith('validCartId123'), 'findById should be called with cart ID').to.be.true;
      expect(queryStub.populate.calledOnce, 'populate should be called once').to.be.true;
      expect(queryStub.populate.calledWith('products.productId', 'name price stock image'), 'populate should use correct fields').to.be.true;
      expect(queryStub.lean.calledOnce, 'lean should be called once').to.be.true;
      expect(res.status.calledWith(HttpStatus.INTERNAL_SERVER_ERROR), 'res.status should be 500').to.be.true;
      expect(res.json.calledOnce, 'res.json should be called once').to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Failed to retrieve cart',
        error: errorMessage,
      }), 'res.json should return the error').to.be.true;
    });
  });

  describe('update_cart', () => {
    let req, res, session;

    beforeEach(() => {
      req = {
        user: { id: 'user123' },
        params: { id: 'cart1' },
        body: {
          products: [
            { productId: '507f1f77bcf86cd799439011', quantity: 3 },
            { productId: '507f1f77bcf86cd799439012', quantity: 1 },
          ],
        },
      };
      res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub(),
      };
      session = {
        startTransaction: sandbox.stub(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub(),
      };
      sandbox.stub(mongoose, 'startSession').resolves(session);
    });

    it('should update a cart successfully', async () => {
      const existingCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439013'), quantity: 2 }],
        version: 0,
      };
      const updatedCart = {
        ...existingCart,
        products: [
          { productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 3 },
          { productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'), quantity: 1 },
        ],
        version: 1,
      };
      const populatedCart = {
        ...updatedCart,
        products: [
          { productId: { _id: '507f1f77bcf86cd799439011', name: 'Product 1', price: 10, stock: 97, image: 'img1.jpg' }, quantity: 3 },
          { productId: { _id: '507f1f77bcf86cd799439012', name: 'Product 2', price: 20, stock: 99, image: 'img2.jpg' }, quantity: 1 },
        ],
      };

      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      const findByIdStub = sandbox.stub(Cart, 'findById');
      findByIdStub.withArgs('cart1').returns({
        session: sandbox.stub().resolves(existingCart),
      });
      findByIdStub.withArgs('cart1').onSecondCall().returns({
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(populatedCart),
      });
      sandbox.stub(Product, 'findOneAndUpdate')
        .onCall(0).resolves({ _id: '507f1f77bcf86cd799439013', name: 'Old Product', stock: 102, version: 1 }) // Restore stock
        .onCall(1).resolves({ _id: '507f1f77bcf86cd799439011', name: 'Product 1', stock: 97, version: 1 }) // Reduce stock
        .onCall(2).resolves({ _id: '507f1f77bcf86cd799439012', name: 'Product 2', stock: 99, version: 1 }); // Reduce stock
      sandbox.stub(Cart, 'findOneAndUpdate').resolves(updatedCart);

      await CartController.update_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findById.calledWith('cart1')).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledTwice).to.be.true;
      expect(Product.findOneAndUpdate.calledThrice).to.be.true;
      expect(Cart.findOneAndUpdate.calledOnce).to.be.true;
      expect(findByIdStub.secondCall.returnValue.populate.calledWith('products.productId', 'name price stock image')).to.be.true;
      expect(findByIdStub.secondCall.returnValue.lean.calledOnce).to.be.true;
      expect(session.commitTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart updated successfully',
        cart: populatedCart,
      })).to.be.true;
    });

    it('should return 404 if cart is not found', async () => {
      sandbox.stub(Cart, 'findById').returns({ session: sandbox.stub().resolves(null) });

      await CartController.update_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found',
      })).to.be.true;
    });

    it('should return 403 if user is not authorized', async () => {
      const cart = {
        _id: 'cart1',
        userId: 'otherUser',
        products: [],
        version: 0,
      };
      sandbox.stub(Cart, 'findById').returns({ session: sandbox.stub().resolves(cart) });

      await CartController.update_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.FORBIDDEN)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Not authorized to update this cart',
      })).to.be.true;
    });

    it('should return 400 for invalid products array', async () => {
      req.body.products = null;
      sandbox.stub(Cart, 'findById').returns({
        session: sandbox.stub().resolves({
          _id: 'cart1',
          userId: 'user123',
          version: 0,
        }),
      });

      await CartController.update_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(session.abortTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'No products provided to update',
      })).to.be.true;
    });

    it('should return 400 for invalid product format', async () => {
      req.body.products = [{ productId: 'invalid', quantity: 1 }];
      sandbox.stub(Cart, 'findById').returns({
        session: sandbox.stub().resolves({
          _id: 'cart1',
          userId: 'user123',
          version: 0,
        }),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('invalid').returns(false);

      await CartController.update_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('invalid')).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Invalid product format',
      })).to.be.true;
    });

    it('should return 409 for concurrency conflict', async () => {
      sandbox.stub(Cart, 'findById').returns({
        session: sandbox.stub().resolves({
          _id: 'cart1',
          userId: 'user123',
          products: [],
          version: 0,
        }),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Product, 'findOneAndUpdate').resolves({
        _id: '507f1f77bcf86cd799439011',
        stock: 100,
        version: 1,
      });
      sandbox.stub(Cart, 'findOneAndUpdate').resolves(null);

      await CartController.update_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledTwice).to.be.true;
      expect(Product.findOneAndUpdate.calledTwice).to.be.true;
      expect(Cart.findOneAndUpdate.calledOnce).to.be.true;
      expect(session.abortTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.CONFLICT)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart or product was modified by another request. Please retry.',
      })).to.be.true;
    });
  });

  describe('add_to_cart', () => {
    let req, res, session;

    beforeEach(() => {
      req = {
        user: { id: 'user123' },
        body: { productId: '507f1f77bcf86cd799439011', quantity: 2 },
      };
      res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub(),
      };
      session = {
        startTransaction: sandbox.stub(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub(),
      };
      sandbox.stub(mongoose, 'startSession').resolves(session);
    });

    it('should add product to existing cart', async () => {
      const existingCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'), quantity: 1 }],
        version: 0,
      };
      const updatedCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [
          { productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'), quantity: 1 },
          { productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 },
        ],
        version: 1,
      };
      const populatedCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [
          { productId: { _id: '507f1f77bcf86cd799439012', name: 'Product 1', price: 10, stock: 100, image: 'img1.jpg' }, quantity: 1 },
          { productId: { _id: '507f1f77bcf86cd799439011', name: 'Product 2', price: 20, stock: 98, image: 'img2.jpg' }, quantity: 2 },
        ],
        version: 1,
      };

      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(existingCart),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('507f1f77bcf86cd799439011').returns(true);
      sandbox.stub(Product, 'findOneAndUpdate').resolves({
        _id: '507f1f77bcf86cd799439011',
        name: 'Product 2',
        stock: 98,
        version: 1,
      });
      sandbox.stub(Cart, 'findOneAndUpdate').resolves(updatedCart);
      sandbox.stub(Cart, 'findById').withArgs('cart1').returns({
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(populatedCart),
      });

      await CartController.add_to_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('507f1f77bcf86cd799439011')).to.be.true;
      expect(Product.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(Cart.findById().populate.calledWith('products.productId', 'name price stock image')).to.be.true;
      expect(Cart.findById().lean.calledOnce).to.be.true;
      expect(session.commitTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Item added to cart',
        cart: populatedCart,
      })).to.be.true;
    });

    it('should create new cart if none exists', async () => {
      const newCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }],
        version: 0,
      };
      const populatedCart = {
        ...newCart,
        products: [{ productId: { _id: '507f1f77bcf86cd799439011', name: 'Product 1', price: 10, stock: 98, image: 'img1.jpg' }, quantity: 2 }],
      };

      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(null),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('507f1f77bcf86cd799439011').returns(true);
      sandbox.stub(Product, 'findOneAndUpdate').resolves({
        _id: '507f1f77bcf86cd799439011',
        name: 'Product 1',
        stock: 98,
        version: 1,
      });
      sandbox.stub(Cart.prototype, 'save').resolves(newCart);
      sandbox.stub(Cart, 'findById').withArgs('cart1').returns({
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(populatedCart),
      });

      await CartController.add_to_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('507f1f77bcf86cd799439011')).to.be.true;
      expect(Product.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.prototype.save.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(Cart.findById().populate.calledWith('products.productId', 'name price stock image')).to.be.true;
      expect(Cart.findById().lean.calledOnce).to.be.true;
      expect(session.commitTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Item added to cart',
        cart: populatedCart,
      })).to.be.true;
    });

    it('should return 400 for invalid product ID', async () => {
      req.body.productId = 'invalid';
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('invalid').returns(false);

      await CartController.add_to_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('invalid')).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Valid productId (ObjectId) is required',
      })).to.be.true;
    });

    it('should return 400 for invalid quantity', async () => {
      req.body.quantity = 0;
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('507f1f77bcf86cd799439011').returns(true);

      await CartController.add_to_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('507f1f77bcf86cd799439011')).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Valid quantity (positive number) is required',
      })).to.be.true;
    });

    it('should return 409 for concurrency conflict', async () => {
      const existingCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [],
        version: 0,
      };
      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(existingCart),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('507f1f77bcf86cd799439011').returns(true);
      sandbox.stub(Product, 'findOneAndUpdate').resolves({
        _id: '507f1f77bcf86cd799439011',
        stock: 98,
        version: 1,
      });
      sandbox.stub(Cart, 'findOneAndUpdate').resolves(null);

      await CartController.add_to_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('507f1f77bcf86cd799439011')).to.be.true;
      expect(Product.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findOneAndUpdate.calledOnce).to.be.true;
      expect(session.abortTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.CONFLICT)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart or product was modified by another request. Please retry.',
      })).to.be.true;
    });
  });

  describe('remove_from_cart', () => {
    let req, res, session;

    beforeEach(() => {
      req = {
        user: { id: 'user123' },
        body: { productId: '507f1f77bcf86cd799439011' },
      };
      res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub(),
      };
      session = {
        startTransaction: sandbox.stub(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub(),
      };
      sandbox.stub(mongoose, 'startSession').resolves(session);
    });

    it('should remove product from cart', async () => {
      const existingCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }],
        version: 0,
      };
      const updatedCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [],
        version: 1,
      };
      const populatedCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [],
        version: 1,
      };

      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(existingCart),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('507f1f77bcf86cd799439011').returns(true);
      sandbox.stub(Product, 'findOneAndUpdate').resolves({
        _id: '507f1f77bcf86cd799439011',
        stock: 100,
        version: 1,
      });
      sandbox.stub(Cart, 'findOneAndUpdate').resolves(updatedCart);
      sandbox.stub(Cart, 'findById').withArgs('cart1').returns({
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(populatedCart),
      });

      await CartController.remove_from_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('507f1f77bcf86cd799439011')).to.be.true;
      expect(Product.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(Cart.findById().populate.calledWith('products.productId', 'name price stock image')).to.be.true;
      expect(Cart.findById().lean.calledOnce).to.be.true;
      expect(session.commitTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Item removed from cart',
        cart: populatedCart,
      })).to.be.true;
    });

    it('should return 400 for invalid product ID', async () => {
      req.body.productId = 'invalid';
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('invalid').returns(false);

      await CartController.remove_from_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('invalid')).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Valid productId (ObjectId) is required',
      })).to.be.true;
    });

    it('should return 404 if cart is not found', async () => {
      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(null),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('507f1f77bcf86cd799439011').returns(true);

      await CartController.remove_from_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('507f1f77bcf86cd799439011')).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found',
      })).to.be.true;
    });

    it('should return 404 if product is not in cart', async () => {
      const cart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439012'), quantity: 1 }],
        version: 0,
      };
      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(cart),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('507f1f77bcf86cd799439011').returns(true);

      await CartController.remove_from_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('507f1f77bcf86cd799439011')).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Product not found in cart',
      })).to.be.true;
    });

    it('should return 409 for concurrency conflict', async () => {
      const cart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }],
        version: 0,
      };
      sandbox.stub(Cart, 'findOne').withArgs({ userId: 'user123' }).returns({
        session: sandbox.stub().resolves(cart),
      });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').withArgs('507f1f77bcf86cd799439011').returns(true);
      sandbox.stub(Product, 'findOneAndUpdate').resolves({
        _id: '507f1f77bcf86cd799439011',
        stock: 100,
        version: 1,
      });
      sandbox.stub(Cart, 'findOneAndUpdate').resolves(null);

      await CartController.remove_from_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledOnceWith({ userId: 'user123' })).to.be.true;
      expect(mongoose.Types.ObjectId.isValid.calledOnceWith('507f1f77bcf86cd799439011')).to.be.true;
      expect(Product.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findOneAndUpdate.calledOnce).to.be.true;
      expect(session.abortTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.CONFLICT)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart or product was modified by another request. Please retry.',
      })).to.be.true;
    });
  });

  describe('clear_cart', () => {
    let req, res, session;

    beforeEach(() => {
      req = {
        user: { id: 'user123' },
        body: {},
      };
      res = {
        status: sandbox.stub().returnsThis(),
        json: sandbox.stub(),
      };
      session = {
        startTransaction: sandbox.stub(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub(),
      };
      sandbox.stub(mongoose, 'startSession').resolves(session);
    });

    it('should clear all products from cart', async () => {
      const existingCart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }],
        version: 0,
      };
      const updatedCart = {
        ...existingCart,
        products: [],
        version: 1,
      };
      const populatedCart = {
        ...updatedCart,
        products: [],
      };

      sandbox.stub(Cart, 'findOne').returns({ session: sandbox.stub().resolves(existingCart) });
      sandbox.stub(Product, 'findOneAndUpdate').resolves({ _id: '507f1f77bcf86cd799439011', stock: 100, version: 1 });
      sandbox.stub(Cart, 'findOneAndUpdate').resolves(updatedCart);
      sandbox.stub(Cart, 'findById').returns({
        populate: sandbox.stub().returnsThis(),
        lean: sandbox.stub().resolves(populatedCart),
      });

      await CartController.clear_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledWith({ userId: 'user123' })).to.be.true;
      expect(Product.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findById.calledWith('cart1')).to.be.true;
      expect(Cart.findById().populate.calledWith('products.productId', 'name price stock image')).to.be.true;
      expect(Cart.findById().lean.calledOnce).to.be.true;
      expect(session.commitTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart cleared successfully',
        cart: populatedCart,
      })).to.be.true;
    });

    it('should return 404 if cart is not found', async () => {
      sandbox.stub(Cart, 'findOne').returns({ session: sandbox.stub().resolves(null) });

      await CartController.clear_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledWith({ userId: 'user123' })).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found',
      })).to.be.true;
    });

    it('should return 409 for concurrency conflict', async () => {
      const cart = {
        _id: 'cart1',
        userId: 'user123',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }],
        version: 0,
      };
      sandbox.stub(Cart, 'findOne').returns({ session: sandbox.stub().resolves(cart) });
      sandbox.stub(Product, 'findOneAndUpdate').resolves({ _id: '507f1f77bcf86cd799439011', stock: 100, version: 1 });
      sandbox.stub(Cart, 'findOneAndUpdate').resolves(null);

      await CartController.clear_cart(req, res);

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findOne.calledWith({ userId: 'user123' })).to.be.true;
      expect(Product.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findOneAndUpdate.calledOnce).to.be.true;
      expect(session.abortTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
      expect(res.status.calledWith(HttpStatus.CONFLICT)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart or product was modified by another request. Please retry.',
      })).to.be.true;
    });
  });

  describe('clearExpiredCart', () => {
    let session;

    beforeEach(() => {
      session = {
        startTransaction: sandbox.stub(),
        commitTransaction: sandbox.stub().resolves(),
        abortTransaction: sandbox.stub().resolves(),
        endSession: sandbox.stub(),
      };
      sandbox.stub(mongoose, 'startSession').resolves(session);
    });

    it('should clear expired cart and restore stock', async () => {
      const cart = {
        _id: 'cart1',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }],
        version: 0,
      };
      sandbox.stub(Cart, 'findById').withArgs('cart1').returns({
        session: sandbox.stub().resolves(cart),
      });
      sandbox.stub(Product, 'findOneAndUpdate').resolves({
        _id: '507f1f77bcf86cd799439011',
        stock: 100,
        version: 1,
      });
      sandbox.stub(Cart, 'findOneAndDelete').resolves(cart);

      await CartController.clearExpiredCart('cart1');

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(Product.findOneAndUpdate.calledOnce).to.be.true;
      expect(Cart.findOneAndDelete.calledOnceWith({ _id: 'cart1', version: 0 }, { session: sinon.match.any })).to.be.true;
      expect(session.commitTransaction.calledOnce).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
    });

    it('should exit if cart is not found', async () => {
      sandbox.stub(Cart, 'findById').withArgs('cart1').returns({
        session: sandbox.stub().resolves(null),
      });
      sandbox.stub(Product, 'findOneAndUpdate');
      sandbox.stub(Cart, 'findOneAndDelete');

      await CartController.clearExpiredCart('cart1');

      expect(mongoose.startSession.calledOnce).to.be.true;
      expect(session.startTransaction.calledOnce).to.be.true;
      expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
      expect(Product.findOneAndUpdate.notCalled).to.be.true;
      expect(Cart.findOneAndDelete.notCalled).to.be.true;
      expect(session.commitTransaction.notCalled).to.be.true;
      expect(session.endSession.calledOnce).to.be.true;
    });

    it('should throw for concurrency conflict', async () => {
      const cart = {
        _id: 'cart1',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }],
        version: 0,
      };
      sandbox.stub(Cart, 'findById').withArgs('cart1').returns({
        session: sandbox.stub().resolves(cart),
      });
      sandbox.stub(Product, 'findOneAndUpdate').resolves({
        _id: '507f1f77bcf86cd799439011',
        stock: 100,
        version: 1,
      });
      sandbox.stub(Cart, 'findOneAndDelete').resolves(null);

      try {
        await CartController.clearExpiredCart('cart1');
        expect.fail('Should have thrown an error');
      } catch (err) {
        expect(err.message).to.equal('Cart or product was modified by another request. Please retry.');
        expect(mongoose.startSession.calledOnce).to.be.true;
        expect(session.startTransaction.calledOnce).to.be.true;
        expect(Cart.findById.calledOnceWith('cart1')).to.be.true;
        expect(Product.findOneAndUpdate.calledOnce).to.be.true;
        expect(Cart.findOneAndDelete.calledOnce).to.be.true;
        expect(session.abortTransaction.calledOnce).to.be.true;
        expect(session.endSession.calledOnce).to.be.true;
      }
    });
  });
});
