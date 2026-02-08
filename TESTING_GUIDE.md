# Testing Guide for Loaner-dash

## Quick Start

### Installation
```bash
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @testing-library/react @testing-library/jest-dom
npm install --save-dev supertest # for API testing
```

### Jest Configuration
Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
  coverageThresholds: {
    global: {
      branches: 75,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
```

## Testing Patterns

### 1. Unit Test Pattern
```typescript
describe('UserService', () => {
  describe('validateEmail', () => {
    it('should return true for valid email', () => {
      const result = UserService.validateEmail('user@example.com');
      expect(result).toBe(true);
    });

    it('should return false for invalid email', () => {
      const result = UserService.validateEmail('invalid-email');
      expect(result).toBe(false);
    });

    it('should return false for empty string', () => {
      const result = UserService.validateEmail('');
      expect(result).toBe(false);
    });
  });
});
```

### 2. API Endpoint Testing Pattern
```typescript
import request from 'supertest';
import app from '../app';

describe('POST /api/users', () => {
  it('should create a new user', async () => {
    const userData = {
      email: 'newuser@example.com',
      password: 'SecurePassword123!',
      name: 'John Doe',
    };

    const response = await request(app)
      .post('/api/users')
      .send(userData)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.email).toBe(userData.email);
  });

  it('should return 400 for missing required fields', async () => {
    const userData = {
      email: 'newuser@example.com',
      // missing password
    };

    await request(app)
      .post('/api/users')
      .send(userData)
      .expect(400);
  });

  it('should return 409 if user already exists', async () => {
    const userData = {
      email: 'existing@example.com',
      password: 'SecurePassword123!',
      name: 'Existing User',
    };

    // First creation
    await request(app)
      .post('/api/users')
      .send(userData);

    // Second creation should conflict
    await request(app)
      .post('/api/users')
      .send(userData)
      .expect(409);
  });
});
```

### 3. Database Testing Pattern
```typescript
describe('UserRepository', () => {
  beforeAll(async () => {
    // Set up test database
    await setupTestDatabase();
  });

  afterEach(async () => {
    // Clean up after each test
    await clearTestDatabase();
  });

  afterAll(async () => {
    // Tear down test database
    await teardownTestDatabase();
  });

  it('should save and retrieve a user', async () => {
    const userData = {
      email: 'test@example.com',
      name: 'Test User',
      passwordHash: 'hashed_password',
    };

    const savedUser = await UserRepository.create(userData);
    const retrievedUser = await UserRepository.findById(savedUser.id);

    expect(retrievedUser).toEqual(savedUser);
  });

  it('should throw error if email is duplicate', async () => {
    const userData = {
      email: 'duplicate@example.com',
      name: 'User 1',
      passwordHash: 'hash1',
    };

    await UserRepository.create(userData);

    await expect(
      UserRepository.create({
        ...userData,
        name: 'User 2',
      })
    ).rejects.toThrow('Duplicate email');
  });
});
```

### 4. Mock & Stub Pattern
```typescript
describe('NotificationService', () => {
  it('should send email notification', async () => {
    const mockEmailClient = jest.fn().mockResolvedValue({ success: true });
    const service = new NotificationService(mockEmailClient);

    await service.sendWelcomeEmail('user@example.com');

    expect(mockEmailClient).toHaveBeenCalledWith({
      to: 'user@example.com',
      template: 'welcome',
    });
  });

  it('should retry on failure', async () => {
    const mockEmailClient = jest
      .fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({ success: true });

    const service = new NotificationService(mockEmailClient);

    await service.sendWelcomeEmail('user@example.com');

    expect(mockEmailClient).toHaveBeenCalledTimes(2);
  });
});
```

### 5. Async/Await Testing Pattern
```typescript
describe('DataFetcher', () => {
  it('should fetch data successfully', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      json: async () => ({ id: 1, name: 'Test' }),
    });

    const fetcher = new DataFetcher(mockFetch);
    const data = await fetcher.fetch('/api/data');

    expect(data).toEqual({ id: 1, name: 'Test' });
  });

  it('should handle fetch errors', async () => {
    const mockFetch = jest.fn().mockRejectedValue(
      new Error('Network failed')
    );

    const fetcher = new DataFetcher(mockFetch);

    await expect(fetcher.fetch('/api/data')).rejects.toThrow('Network failed');
  });
});
```

## Coverage Reports

### Generate Coverage Report
```bash
npm test -- --coverage
```

### Understand Coverage Metrics
- **Lines**: Percentage of lines executed
- **Statements**: Percentage of statements executed
- **Functions**: Percentage of functions called
- **Branches**: Percentage of conditional branches taken

### HTML Coverage Report
```bash
npm test -- --coverage --coverageReporters=html
open coverage/index.html
```

## Common Testing Mistakes to Avoid

### 1. ❌ Testing Implementation Details
```typescript
// BAD - tests internal implementation
it('should call calculateTotal', () => {
  expect(calculateTotal).toHaveBeenCalled();
});

// GOOD - tests behavior
it('should return correct order total', () => {
  const total = Order.getTotal([...items]);
  expect(total).toBe(100);
});
```

### 2. ❌ Dependent Tests
```typescript
// BAD - test B depends on test A
it('A should create user', () => { /* ... */ });
it('B should find user', () => { /* depends on A */ });

// GOOD - tests are independent
it('A should create user', () => { /* ... */ });
it('B should find user', () => {
  // Create fresh user in this test
});
```

### 3. ❌ Not Mocking External Dependencies
```typescript
// BAD - hitting real API
it('should get user', async () => {
  const user = await getUserFromAPI();
  expect(user).toBeDefined();
});

// GOOD - mock the API
it('should get user', async () => {
  jest.mock('./api', () => ({
    getUserFromAPI: jest.fn().mockResolvedValue({ id: 1 }),
  }));
  const user = await getUserFromAPI();
  expect(user.id).toBe(1);
});
```

### 4. ❌ Unclear Test Names
```typescript
// BAD
it('works', () => { /* ... */ });
it('test 1', () => { /* ... */ });

// GOOD
it('should return empty array when no items exist', () => { /* ... */ });
it('should throw error for duplicate email addresses', () => { /* ... */ });
```

### 5. ❌ Ignoring Async Properly
```typescript
// BAD - promise not awaited
it('should fetch data', () => {
  fetchData(); // returns a promise
  expect(data).toBeDefined(); // might not have data yet
});

// GOOD - properly await promise
it('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

## Pre-commit Hook Setup

Add to `package.json`:
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:coverage",
      "pre-push": "npm run lint && npm run test"
    }
  }
}
```

Run tests with coverage threshold:
```bash
npm test -- --coverage --passWithNoTests
```

## Useful Jest Matchers

```typescript
// Common matchers
expect(value).toBe(5);
expect(value).toEqual({ name: 'John' });
expect(value).toBeTruthy();
expect(value).toBeFalsy();
expect(value).toBeNull();
expect(value).toBeUndefined();
expect(array).toContain(item);
expect(array).toHaveLength(3);
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith(arg);
expect(promise).rejects.toThrow();
```

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library Docs](https://testing-library.com/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Node.js Testing Guide](https://nodejs.org/en/docs/guides/testing/)
