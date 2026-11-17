import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from '../services/dashboard.service';

describe('DashboardController (Unit Tests)', () => {
  let controller: DashboardController;
  let service: jest.Mocked<Partial<DashboardService>>;

  beforeEach(async () => {
    service = {
      getConsumerDashboardData: jest.fn().mockResolvedValue({
        profile: { allergies: ['Peanut'] },
        recentProducts: [],
      } as any),
      getManufacturerDashboardData: jest.fn().mockResolvedValue({
        products: [],
        totalProducts: 0,
        documentStats: { total: 0, approved: 0, pending: 0, rejected: 0 },
        hasApprovedDocument: false,
        licence: null,
      } as any),
      getInspectorDashboardData: jest.fn().mockResolvedValue({
        stats: { total: 5, approved: 3, pending: 2, rejected: 0, expiringSoon: 0 },
        pendingDocuments: [],
        recentDecisions: [],
        sampleLicences: [],
      } as any),
      getAdminDashboardData: jest.fn().mockResolvedValue({
        users: [],
        totalUsers: 4,
        roleBreakdown: { consumer: 1, manufacturer: 1, inspector: 1, admin: 1 },
        totalProducts: 10,
        docStats: { total: 5 },
      } as any),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  describe('getDashboard (Dispatcher)', () => {
    it('should redirect consumer to /dashboard/consumer', async () => {
      const mockReq = { session: { user: { role: 'consumer' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;

      await controller.getDashboard(mockReq, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith('/dashboard/consumer');
    });

    it('should redirect manufacturer to /dashboard/manufacturer', async () => {
      const mockReq = { session: { user: { role: 'manufacturer' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;

      await controller.getDashboard(mockReq, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith('/dashboard/manufacturer');
    });

    it('should redirect inspector to /dashboard/inspector', async () => {
      const mockReq = { session: { user: { role: 'inspector' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;

      await controller.getDashboard(mockReq, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith('/dashboard/inspector');
    });

    it('should redirect admin to /dashboard/admin', async () => {
      const mockReq = { session: { user: { role: 'admin' } } } as any;
      const mockRes = { redirect: jest.fn() } as any;

      await controller.getDashboard(mockReq, mockRes);
      expect(mockRes.redirect).toHaveBeenCalledWith('/dashboard/admin');
    });
  });

  describe('getConsumerDashboard', () => {
    it('should render consumer dashboard with health profile', async () => {
      const mockReq = { session: { user: { id: 1, name: 'Alice', role: 'consumer' } } } as any;
      const result = await controller.getConsumerDashboard(mockReq);

      expect(result.title).toContain('Consumer');
      expect(result.profile).toBeDefined();
      expect(service.getConsumerDashboardData).toHaveBeenCalledWith(1);
    });
  });

  describe('getManufacturerDashboard', () => {
    it('should render manufacturer dashboard with compliance and products', async () => {
      const mockReq = {
        session: { user: { id: 2, name: 'Oatly', role: 'manufacturer' } },
      } as any;
      const result = await controller.getManufacturerDashboard(mockReq);

      expect(result.title).toContain('Manufacturer');
      expect(service.getManufacturerDashboardData).toHaveBeenCalled();
    });
  });

  describe('getInspectorDashboard', () => {
    it('should render inspector dashboard with audit queue and metrics', async () => {
      const mockReq = {
        session: { user: { id: 3, name: 'Inspector Vance', role: 'inspector' } },
      } as any;
      const result = await controller.getInspectorDashboard(mockReq);

      expect(result.title).toContain('Inspector');
      expect(service.getInspectorDashboardData).toHaveBeenCalled();
    });
  });

  describe('getAdminDashboard', () => {
    it('should render admin dashboard with user breakdown and platform vitals', async () => {
      const mockReq = {
        session: { user: { id: 4, name: 'Root Admin', role: 'admin' } },
      } as any;
      const result = await controller.getAdminDashboard(mockReq);

      expect(result.title).toContain('Admin');
      expect(result.totalUsers).toBe(4);
      expect(service.getAdminDashboardData).toHaveBeenCalled();
    });
  });
});
