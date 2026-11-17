import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { User } from '../models/user.entity';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { PreferenceService } from '../../personal-food/services/preference.service';

describe('DashboardService (Unit Tests)', () => {
  let service: DashboardService;
  let userRepo: any;
  let catalogService: any;
  let documentService: any;
  let preferenceService: any;

  beforeEach(async () => {
    userRepo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, name: 'Consumer A', role: 'consumer' },
        { id: 2, name: 'Brand B', role: 'manufacturer' },
        { id: 3, name: 'Inspector C', role: 'inspector' },
        { id: 4, name: 'Admin D', role: 'admin' },
      ]),
    };

    catalogService = {
      searchAndFilter: jest.fn().mockResolvedValue({
        items: [{ id: 10, name: 'Oat Drink', brand: 'Oatly' }],
        total: 15,
      }),
      findByManufacturer: jest.fn().mockResolvedValue([
        { id: 10, name: 'Oat Drink', qualityScore: 88, manufacturerId: 2 },
      ]),
    };

    documentService = {
      getDocuments: jest.fn().mockResolvedValue([
        { id: 1, status: 'approved', companyName: 'Brand B', documentType: 'iso22000' },
        { id: 2, status: 'pending', companyName: 'Brand B', documentType: 'halal' },
      ]),
      getStatistics: jest.fn().mockResolvedValue({
        total: 10,
        approved: 7,
        pending: 2,
        rejected: 1,
        expiringSoon: 1,
      }),
      getSampleLicences: jest.fn().mockResolvedValue([
        { id: 1, licenceNumber: 'BSTI-100', companyName: 'Brand B', status: 'valid' },
      ]),
    };

    preferenceService = {
      findOrCreate: jest.fn().mockResolvedValue({
        userId: 1,
        allergies: ['Peanut'],
        dietaryPreferences: ['Vegan'],
      }),
      evaluateProductConflict: jest.fn().mockReturnValue({
        hasConflicts: false,
        isSafeForUser: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: CatalogService, useValue: catalogService },
        { provide: DocumentService, useValue: documentService },
        { provide: PreferenceService, useValue: preferenceService },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  describe('getConsumerDashboardData', () => {
    it('should aggregate profile and evaluated catalog products', async () => {
      const data = await service.getConsumerDashboardData(1);

      expect(data.profile).toBeDefined();
      expect(data.profile.allergies).toContain('Peanut');
      expect(data.recentProducts).toHaveLength(1);
      expect(data.recentProducts[0].conflict.isSafeForUser).toBe(true);
      expect(preferenceService.findOrCreate).toHaveBeenCalledWith(1);
      expect(catalogService.searchAndFilter).toHaveBeenCalled();
    });
  });

  describe('getManufacturerDashboardData', () => {
    it('should aggregate products, accreditation counts and licence for manufacturer', async () => {
      const data = await service.getManufacturerDashboardData({
        id: 2,
        name: 'Brand B',
        email: 'brand@test.com',
      });

      expect(data.products).toHaveLength(1);
      expect(data.totalProducts).toBe(1);
      expect(data.documentStats.total).toBe(2);
      expect(data.documentStats.approved).toBe(1);
      expect(data.documentStats.pending).toBe(1);
      expect(data.hasApprovedDocument).toBe(true);
      expect(data.licence).toBeDefined();
      expect(data.licence.companyName).toBe('Brand B');
      expect(catalogService.findByManufacturer).toHaveBeenCalledWith(2);
    });
  });

  describe('getInspectorDashboardData', () => {
    it('should aggregate pending queue and recent inspection decisions', async () => {
      const data = await service.getInspectorDashboardData();

      expect(data.stats.total).toBe(10);
      expect(data.pendingDocuments).toBeDefined();
      expect(data.sampleLicences).toHaveLength(1);
      expect(documentService.getStatistics).toHaveBeenCalled();
    });
  });

  describe('getAdminDashboardData', () => {
    it('should aggregate platform user directory and system vitals', async () => {
      const data = await service.getAdminDashboardData();

      expect(data.totalUsers).toBe(4);
      expect(data.roleBreakdown.consumer).toBe(1);
      expect(data.roleBreakdown.manufacturer).toBe(1);
      expect(data.roleBreakdown.inspector).toBe(1);
      expect(data.roleBreakdown.admin).toBe(1);
      expect(data.totalProducts).toBe(15);
      expect(data.docStats.total).toBe(10);
    });
  });
});
