import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import HttpStatus from 'http-status-codes';
import mongoose from 'mongoose';
import { Cart } from '../models/index.js';
import { responseHandler } from '../utils/index.js';
import CartController from '../controllers/_cartController.js';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('CartController', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  const mockResponse = () => {
    const res = {
      locals: {
        pagination: { page: 1, limit: 10, hasMorePages: false, links: {} },
        setPagination: sandbox.stub()
      }
    };
    res.status = sandbox.stub().returns(res);
    res.json = sandbox.stub().returns(res);
    return res;
  };

  describe('get_carts', () => {
    it('should retrieve carts with pagination', async () => {
      const req = { query: {} };
      const res = mockResponse();
      sandbox.stub(Cart, 'countDocuments').resolves(25);
      sandbox.stub(Cart, 'find').returns({
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().resolves([{ _id: 'cart1' }])
      });

      await CartController.get_carts(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Carts retrieved successfully',
        carts: [{ _id: 'cart1' }],
        pagination: {
          page: 1,
          limit: 10,
          totalItems: 25,
          totalPages: 3,
          hasMorePages: false,
          links: {}
        }
      })).to.be.true;
    });
  });

  describe('get_cart', () => {
    it('should retrieve user’s cart', async () => {
      const req = { user: { id: 'user1' } };
      const res = mockResponse();
      sandbox.stub(Cart, 'findOne').resolves({ _id: 'cart1' });

      await CartController.get_cart(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart created successfully',
        cart: { _id: 'cart1' }
      })).to.be.true;
    });

    it('should return not found if cart doesn’t exist', async () => {
      const req = { user: { id: 'user1' } };
      const res = mockResponse();
      sandbox.stub(Cart, 'findOne').resolves(null);

      await CartController.get_cart(req, res);

      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found'
      })).to.be.true;
    });
  });

  describe('get_cart_by_id', () => {
    it('should retrieve cart by ID', async () => {
      const req = { params: { id: '507f1f77bcf86cd799439011' } };
      const res = mockResponse();
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Cart, 'findById').resolves({ _id: '507f1f77bcf86cd799439011' });

      await CartController.get_cart_by_id(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart retrieved successfully',
        cart: { _id: '507f1f77bcf86cd799439011' }
      })).to.be.true;
    });

    it('should return error for invalid ID', async () => {
      const req = { params: { id: 'invalidId' } };
      const res = mockResponse();
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(false);

      await CartController.get_cart_by_id(req, res);

      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Invalid cart ID'
      })).to.be.true;
    });
  });

  describe('create_cart', () => {
    it('should create a new cart', async () => {
      const req = {
        user: { id: 'user1' },
        body: { products: [{ productId: '507f1f77bcf86cd799439011', quantity: 2 }] }
      };
      const res = mockResponse();
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Cart, 'findOne').resolves(null);
      sandbox.stub(Cart.prototype, 'save').resolves({ _id: 'cart1', products: [{ productId: '507f1f77bcf86cd799439011', quantity: 2 }] });

      await CartController.create_cart(req, res);

      expect(res.status.calledWith(HttpStatus.CREATED)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart created successfully',
        cart: { _id: 'cart1', products: [{ productId: '507f1f77bcf86cd799439011', quantity: 2 }] }
      })).to.be.true;
    });

    it('should return error if products array is invalid', async () => {
      const req = { user: { id: 'user1' }, body: { products: 'not-an-array' } };
      const res = mockResponse();

      await CartController.create_cart(req, res);

      expect(res.status.calledWith(HttpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Valid products array is required'
      })).to.be.true;
    });
  });

  describe('update_cart', () => {
    it('should update an existing cart', async () => {
      const req = {
        params: { id: 'cart1' },
        body: { products: [{ productId: '507f1f77bcf86cd799439011', quantity: 3 }] }
      };
      const res = mockResponse();
      sandbox.stub(Cart, 'findById').resolves({ _id: 'cart1' });
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Cart, 'findByIdAndUpdate').resolves({
        _id: 'cart1',
        products: [{ productId: '507f1f77bcf86cd799439011', quantity: 3 }]
      });

      await CartController.update_cart(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart updated successfully',
        cart: { _id: 'cart1', products: [{ productId: '507f1f77bcf86cd799439011', quantity: 3 }] }
      })).to.be.true;
    });

    it('should return not found if cart doesn’t exist', async () => {
      const req = { params: { id: 'cart1' }, body: {} };
      const res = mockResponse();
      sandbox.stub(Cart, 'findById').resolves(null);

      await CartController.update_cart(req, res);

      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found'
      })).to.be.true;
    });
  });

  describe('add_to_cart', () => {
    it('should add item to existing cart', async () => {
      const req = {
        user: { id: 'user1' },
        body: { productId: '507f1f77bcf86cd799439011', quantity: 2 }
      };
      const res = mockResponse();
      const cartStub = {
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 1 }],
        markModified: sandbox.stub(),
        save: sandbox.stub().resolves({
          _id: 'cart1',
          products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 3 }]
        })
      };
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Cart, 'findOne').resolves(cartStub);
      sandbox.stub(cartStub.products, 'findIndex').returns(0);

      await CartController.add_to_cart(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Item added to cart',
        cart: { _id: 'cart1', products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 3 }] }
      })).to.be.true;
    });

    it('should create new cart if none exists', async () => {
      const req = { user: { id: 'user1' }, body: { productId: '507f1f77bcf86cd799439011', quantity: 2 } };
      const res = mockResponse();
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Cart, 'findOne').resolves(null);
      sandbox.stub(Cart.prototype, 'save').resolves({
        _id: 'cart1',
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }]
      });

      await CartController.add_to_cart(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Item added to cart',
        cart: { _id: 'cart1', products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 2 }] }
      })).to.be.true;
    });
  });

  describe('remove_from_cart', () => {
    it('should remove item from cart', async () => {
      const req = { user: { id: 'user1' }, body: { productId: '507f1f77bcf86cd799439011' } };
      const res = mockResponse();
      const cartStub = {
        products: [{ productId: new mongoose.Types.ObjectId('507f1f77bcf86cd799439011'), quantity: 1 }],
        splice: sandbox.stub(),
        save: sandbox.stub().resolves({ _id: 'cart1', products: [] })
      };
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Cart, 'findOne').resolves(cartStub);
      sandbox.stub(cartStub.products, 'findIndex').returns(0);

      await CartController.remove_from_cart(req, res);

      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Item removed from cart',
        cart: { _id: 'cart1', products: [] }
      })).to.be.true;
    });

    it('should return error if product not in cart', async () => {
      const req = { user: { id: 'user1' }, body: { productId: '507f1f77bcf86cd799439011' } };
      const res = mockResponse();
      const cartStub = { products: [], findIndex: sandbox.stub().returns(-1) };
      sandbox.stub(mongoose.Types.ObjectId, 'isValid').returns(true);
      sandbox.stub(Cart, 'findOne').resolves(cartStub);

      await CartController.remove_from_cart(req, res);

      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Product not found in cart'
      })).to.be.true;
    });
  });

  describe('clear_cart', () => {
    it('should clear the cart', async () => {
      const req = { user: { id: 'user1' } };
      const res = mockResponse();
      const cartStub = {
        products: [{ productId: '507f1f77bcf86cd799439011', quantity: 1 }],
        save: sandbox.stub().resolves({ _id: 'cart1', products: [] })
      };
      sandbox.stub(Cart, 'findOne').resolves(cartStub);

      await CartController.clear_cart(req, res);

      expect(cartStub.products).to.be.empty;
      expect(res.status.calledWith(HttpStatus.OK)).to.be.true;
      expect(res.json.calledWith({
        type: 'success',
        message: 'Cart cleared successfully',
        cart: { _id: 'cart1', products: [] }
      })).to.be.true;
    });

    it('should return not found if cart doesn’t exist', async () => {
      const req = { user: { id: 'user1' } };
      const res = mockResponse();
      sandbox.stub(Cart, 'findOne').resolves(null);

      await CartController.clear_cart(req, res);

      expect(res.status.calledWith(HttpStatus.NOT_FOUND)).to.be.true;
      expect(res.json.calledWith({
        type: 'error',
        message: 'Cart not found'
      })).to.be.true;
    });
  });
});
