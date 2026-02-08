# Sample Test Structure for Loaner-dash

This document provides a recommended test directory structure and example tests for common scenarios.

## Directory Structure

```
src/
├── auth/
│   ├── __tests__/
│   │   ├── authentication.service.test.ts
│   │   ├── authorization.middleware.test.ts
│   │   └── jwt.util.test.ts
│   ├── authentication.service.ts
│   ├── authorization.middleware.ts
│   └── jwt.util.ts
├── models/
│   ├── __tests__/
│   │   ├── user.model.test.ts
│   │   └── loan.model.test.ts
│   ├── user.model.ts
│   └── loan.model.ts
├── services/
│   ├── __tests__/
│   │   ├── user.service.test.ts
│   │   ├── loan.service.test.ts
│   │   └── email.service.test.ts
│   ├── user.service.ts
│   ├── loan.service.ts
│   └── email.service.ts
├── routes/
│   ├── __tests__/
│   │   ├── user.routes.test.ts
│   │   └── loan.routes.test.ts
│   ├── user.routes.ts
│   └── loan.routes.ts
├── utils/
│   ├── __tests__/
│   │   ├── validators.test.ts
│   │   ├── formatters.test.ts
│   │   └── helpers.test.ts
│   ├── validators.ts
│   ├── formatters.ts
│   └── helpers.ts
├── middleware/
│   ├── __tests__/
│   │   ├── error-handler.test.ts
│   │   └── request-logger.test.ts
│   ├── error-handler.ts
│   └── request-logger.ts
└── __tests__/
    ├── setup.ts
    ├── fixtures/
    │   ├── user.fixtures.ts
    │   ├── loan.fixtures.ts
    │   └── db.fixtures.ts
    └── mocks/
        ├── database.mock.ts
        ├── email.mock.ts
        └── external-api.mock.ts
```

## Example Test Files

### 1. Unit Test - Validators (src/utils/__tests__/validators.test.ts)

```typescript
import { validateEmail, validatePhoneNumber, validateLoanAmount } from '../validators';

describe('Validators', () => {
  describe('validateEmail', () => {
    it('should return true for valid emails', () => {
      const validEmails = [
        'user@example.com',
        'john.doe+tag@company.co.uk',
        'name123@test-domain.com',
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should return false for invalid emails', () => {
      const invalidEmails = [
        'plaintext',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });

    it('should handle edge cases', () => {
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null as any)).toBe(false);
      expect(validateEmail(undefined as any)).toBe(false);
    });
  });

  describe('validatePhoneNumber', () => {
    it('should validate US phone numbers', () => {
      expect(validatePhoneNumber('(555) 123-4567')).toBe(true);
      expect(validatePhoneNumber('555-123-4567')).toBe(true);
      expect(validatePhoneNumber('5551234567')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validatePhoneNumber('123')).toBe(false);
      expect(validatePhoneNumber('abcdefghij')).toBe(false);
    });
  });

  describe('validateLoanAmount', () => {
    it('should accept valid loan amounts', () => {
      expect(validateLoanAmount(1000)).toBe(true);
      expect(validateLoanAmount(50000.99)).toBe(true);
      expect(validateLoanAmount(100000)).toBe(true);
    });

    it('should reject amounts below minimum', () => {
      expect(validateLoanAmount(100)).toBe(false);
      expect(validateLoanAmount(0)).toBe(false);
      expect(validateLoanAmount(-5000)).toBe(false);
    });

    it('should reject amounts above maximum', () => {
      expect(validateLoanAmount(1000001)).toBe(false);
    });
  });
});
```

### 2. Service Test - User Service (src/services/__tests__/user.service.test.ts)

```typescript
import { UserService } from '../user.service';
import { UserRepository } from '../../repositories/user.repository';
import { EmailService } from '../email.service';

jest.mock('../../repositories/user.repository');
jest.mock('../email.service');

describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<typeof UserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockUserRepository = UserRepository as jest.Mocked<typeof UserRepository>;
    mockEmailService = new EmailService() as jest.Mocked<EmailService>;
    userService = new UserService(mockUserRepository, mockEmailService);
    jest.clearAllMocks();
  });

  describe('createUser', () => {
    it('should create a new user with valid data', async () => {
      const userData = {
        email: 'newuser@example.com',
        name: 'John Doe',
        password: 'SecurePassword123!',
      };

      mockUserRepository.create.mockResolvedValue({
        id: '1',
        ...userData,
        passwordHash: 'hashed',
        createdAt: new Date(),
      });

      const result = await userService.createUser(userData);

      expect(result).toHaveProperty('id');
      expect(result.email).toBe(userData.email);
      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: userData.email })
      );
    });

    it('should throw error for duplicate email', async () => {
      const userData = {
        email: 'existing@example.com',
        name: 'User',
        password: 'pass123',
      };

      mockUserRepository.create.mockRejectedValue(
        new Error('Duplicate email')
      );

      await expect(userService.createUser(userData)).rejects.toThrow(
        'Duplicate email'
      );
    });

    it('should send welcome email after user creation', async () => {
      const userData = {
        email: 'newuser@example.com',
        name: 'John Doe',
        password: 'pass123',
      };

      mockUserRepository.create.mockResolvedValue({
        id: '1',
        ...userData,
        passwordHash: 'hashed',
        createdAt: new Date(),
      });

      await userService.createUser(userData);

      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        userData.email
      );
    });
  });

  describe('getUserById', () => {
    it('should return user when found', async () => {
      const user = {
        id: '1',
        email: 'user@example.com',
        name: 'John',
        createdAt: new Date(),
      };

      mockUserRepository.findById.mockResolvedValue(user as any);

      const result = await userService.getUserById('1');

      expect(result).toEqual(user);
      expect(mockUserRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(userService.getUserById('999')).rejects.toThrow(
        'User not found'
      );
    });
  });

  describe('updateUser', () => {
    it('should update user with valid data', async () => {
      const updates = { name: 'Jane Doe' };
      const updatedUser = {
        id: '1',
        email: 'user@example.com',
        name: 'Jane Doe',
        createdAt: new Date(),
      };

      mockUserRepository.update.mockResolvedValue(updatedUser as any);

      const result = await userService.updateUser('1', updates);

      expect(result.name).toBe('Jane Doe');
      expect(mockUserRepository.update).toHaveBeenCalledWith('1', updates);
    });
  });

  describe('deleteUser', () => {
    it('should soft delete user', async () => {
      mockUserRepository.softDelete.mockResolvedValue(true);

      const result = await userService.deleteUser('1');

      expect(result).toBe(true);
      expect(mockUserRepository.softDelete).toHaveBeenCalledWith('1');
    });
  });
});
```

### 3. API Route Test (src/routes/__tests__/user.routes.test.ts)

```typescript
import request from 'supertest';
import app from '../../app';
import { UserService } from '../../services/user.service';

jest.mock('../../services/user.service');

describe('User Routes', () => {
  let mockUserService: jest.Mocked<UserService>;

  beforeEach(() => {
    mockUserService = UserService as jest.Mocked<UserService>;
    jest.clearAllMocks();
  });

  describe('POST /api/users', () => {
    it('should create user with valid data', async () => {
      const userData = {
        email: 'newuser@example.com',
        name: 'John Doe',
        password: 'SecurePassword123!',
      };

      mockUserService.createUser.mockResolvedValue({
        id: '1',
        email: userData.email,
        name: userData.name,
        createdAt: new Date(),
      } as any);

      const response = await request(app)
        .post('/api/users')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(userData.email);
    });

    it('should return 400 for missing required fields', async () => {
      const userData = {
        email: 'user@example.com',
        // missing name and password
      };

      await request(app)
        .post('/api/users')
        .send(userData)
        .expect(400);
    });

    it('should return 400 for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        name: 'John Doe',
        password: 'pass123',
      };

      await request(app)
        .post('/api/users')
        .send(userData)
        .expect(400);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return user when found', async () => {
      const user = {
        id: '1',
        email: 'user@example.com',
        name: 'John Doe',
      };

      mockUserService.getUserById.mockResolvedValue(user as any);

      const response = await request(app)
        .get('/api/users/1')
        .expect(200);

      expect(response.body).toEqual(user);
    });

    it('should return 404 when user not found', async () => {
      mockUserService.getUserById.mockRejectedValue(
        new Error('User not found')
      );

      await request(app)
        .get('/api/users/999')
        .expect(404);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user', async () => {
      const updates = { name: 'Jane Doe' };
      const updatedUser = {
        id: '1',
        email: 'user@example.com',
        name: 'Jane Doe',
      };

      mockUserService.updateUser.mockResolvedValue(updatedUser as any);

      const response = await request(app)
        .put('/api/users/1')
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe('Jane Doe');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user', async () => {
      mockUserService.deleteUser.mockResolvedValue(true);

      await request(app)
        .delete('/api/users/1')
        .expect(204);
    });
  });
});
```

### 4. Test Fixtures (src/__tests__/fixtures/user.fixtures.ts)

```typescript
export const userFixtures = {
  validUser: {
    email: 'user@example.com',
    name: 'John Doe',
    password: 'SecurePassword123!',
  },

  adminUser: {
    email: 'admin@example.com',
    name: 'Admin User',
    password: 'AdminPassword123!',
    role: 'admin',
  },

  invalidEmails: [
    'plaintext',
    '@example.com',
    'user@',
    '',
  ],

  validEmails: [
    'user@example.com',
    'john.doe+tag@company.co.uk',
    'name123@test-domain.com',
  ],

  loanAmounts: {
    valid: [1000, 25000, 100000],
    invalid: [100, -5000, 1000001],
  },
};
```

### 5. Test Setup (src/__tests__/setup.ts)

```typescript
// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost/test_db';
process.env.JWT_SECRET = 'test_secret_key';

// Global test configuration
jest.setTimeout(10000);

// Mock common modules
jest.mock('../../config/database', () => ({
  getConnection: jest.fn(),
  disconnect: jest.fn(),
}));

// Setup and teardown
beforeAll(async () => {
  // Initialize test database
});

afterAll(async () => {
  // Clean up test database
});
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- user.service.test.ts

# Run in watch mode
npm test -- --watch

# Generate HTML coverage report
npm test -- --coverage --coverageReporters=html
open coverage/index.html
```

## Coverage Target Breakdown

| Area | Target | Reason |
|------|--------|--------|
| Authentication | 100% | Critical security component |
| Authorization | 100% | Critical for access control |
| Validation | 100% | Prevents invalid data |
| Business Logic | 90%+ | Core functionality |
| API Endpoints | 85%+ | Main user interface |
| Database Layer | 85%+ | Data integrity |
| Utils/Helpers | 85%+ | Used across codebase |
| Error Handling | 80%+ | Important for stability |
| UI Components | 80%+ | User-facing features |
| Configuration | 75%+ | Initialization |
