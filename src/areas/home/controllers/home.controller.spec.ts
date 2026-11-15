import { Test, TestingModule } from '@nestjs/testing';
import { HomeController } from './home.controller';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { PreferenceService } from '../../personal-food/services/preference.service';

describe('HomeController', () => {
  let controller: HomeController;
  let catalogService: jest.Mocked<Partial<CatalogService>>;
  let documentService: jest.Mocked<Partial<DocumentService>>;
  let preferenceService: jest.Mocked<Partial<PreferenceService>>;

  const mockProduct = {
    id: 1,
    name: 'Organic Oat Milk',
    brand: 'OatField',
    barcode: '8901234567890',
    category: 'Beverages',
    qualityScore: 92,
    ingredients: [],
    nutritionFacts: [],
    status: 'active' as const,
  };

  beforeEach(async () => {
    catalogService = {
      searchAndFilter: jest.fn().mockResolvedValue({
        items: [mockProduct],
        total: 1,
        page: 1,
        totalPages: 1,
      }),
    };

    documentService = {
      getStatistics: jest.fn().mockResolvedValue({
        total: 5,
        pending: 1,
        approved: 4,
        rejected: 0,
        expiringSoon: 0,
      }),
      getDocuments: jest.fn().mockResolvedValue([]),
    };

    preferenceService = {
      findByUserId: jest.fn().mockResolvedValue(null),
      evaluateProductConflict: jest.fn().mockReturnValue(null),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
        { provide: CatalogService, useValue: catalogService },
        { provide: DocumentService, useValue: documentService },
        { provide: PreferenceService, useValue: preferenceService },
      ],
    }).compile();

    controller = module.get<HomeController>(HomeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHomePage', () => {
    it('should return featured products and stats for guest visitor', async () => {
      const mockReq: any = { session: {} };

      const result = await controller.getHomePage(mockReq);

      expect(result).toBeDefined();
      expect(result.title).toContain('TrueLabel');
      expect(result.activeNav).toBe('home');
      expect(result.featuredProducts).toHaveLength(1);
      expect(result.stats.products).toBe(1);
      expect(result.stats.documents).toBe(5);
      expect(catalogService.searchAndFilter).toHaveBeenCalledWith({ limit: 4 });
      expect(documentService.getStatistics).toHaveBeenCalled();
      expect(preferenceService.findByUserId).not.toHaveBeenCalled();
    });

    it('should annotate featured products with conflict evaluation when user is logged in', async () => {
      const mockUser = { id: 10, email: 'consumer@test.demo', role: 'consumer', name: 'Test Consumer' };
      const mockProfile = { id: 5, userId: 10, allergies: ['Peanut'], dietaryTags: ['Vegan'] };
      const mockConflict = { hasAllergenConflict: false, isSafeForUser: true, profileConfigured: true };

      preferenceService.findByUserId = jest.fn().mockResolvedValue(mockProfile);
      preferenceService.evaluateProductConflict = jest.fn().mockReturnValue(mockConflict);

      const mockReq: any = { session: { user: mockUser } };

      const result = await controller.getHomePage(mockReq);

      expect(preferenceService.findByUserId).toHaveBeenCalledWith(10);
      expect(preferenceService.evaluateProductConflict).toHaveBeenCalledWith(mockProfile, mockProduct);
      expect(result.featuredProducts[0].userConflict).toEqual(mockConflict);
      expect(result.user).toEqual(mockUser);
    });

    it('should query manufacturer documents when manufacturer user is logged in', async () => {
      const mockMfgUser = { id: 2, email: 'manufacturer@test.demo', role: 'manufacturer', name: 'Test Mfg' };
      documentService.getDocuments = jest.fn().mockResolvedValue([{ id: 101 }] as any);

      const mockReq: any = { session: { user: mockMfgUser } };

      const result = await controller.getHomePage(mockReq);

      expect(documentService.getDocuments).toHaveBeenCalledWith({ manufacturerId: 2 });
      expect(result.roleInsights.manufacturerDocsCount).toBe(1);
      expect(result.user).toEqual(mockMfgUser);
    });
  });
});
