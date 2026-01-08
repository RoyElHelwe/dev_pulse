import { PrismaService } from './prisma.service';
import { PrismaModule } from './prisma.module';
import { PrismaClient } from '@prisma/client';

// Mock NestJS decorators for testing
jest.mock('@nestjs/common', () => ({
  Injectable: () => jest.fn(),
  OnModuleInit: jest.fn(),
  OnModuleDestroy: jest.fn(),
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
  Global: () => jest.fn(),
  Module: () => jest.fn(),
}));

describe('PrismaService', () => {
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = new PrismaService();
  });

  afterEach(async () => {
    await prismaService.$disconnect();
  });

  describe('constructor', () => {
    it('should create an instance of PrismaService', () => {
      // Check that it's defined and has expected properties
      expect(prismaService).toBeDefined();
      expect(prismaService.constructor.name).toBe('PrismaService');
      // Verify it extends PrismaClient by checking for PrismaClient methods
      expect(typeof prismaService.$connect).toBe('function');
      expect(typeof prismaService.$disconnect).toBe('function');
    });
  });

  describe('healthCheck', () => {
    it('should return true when database is connected', async () => {
      // Mock the query
      prismaService.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
      
      const result = await prismaService.healthCheck();
      expect(result).toBe(true);
    });

    it('should return false when database query fails', async () => {
      prismaService.$queryRaw = jest.fn().mockRejectedValue(new Error('Connection failed'));
      
      const result = await prismaService.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('cleanDatabase', () => {
    it('should throw error in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      await expect(prismaService.cleanDatabase()).rejects.toThrow(
        'Cannot clean database in production!'
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe('PrismaModule', () => {
  it('should be defined', () => {
    expect(PrismaModule).toBeDefined();
  });
});

describe('Exports', () => {
  it('should export PrismaClient', async () => {
    const { PrismaClient: ExportedPrismaClient } = await import('./index');
    expect(ExportedPrismaClient).toBeDefined();
  });

  it('should export PrismaService', async () => {
    const { PrismaService: ExportedPrismaService } = await import('./index');
    expect(ExportedPrismaService).toBeDefined();
  });

  it('should export PrismaModule', async () => {
    const { PrismaModule: ExportedPrismaModule } = await import('./index');
    expect(ExportedPrismaModule).toBeDefined();
  });
});
