import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../models/user.entity';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { PreferenceService } from '../../personal-food/services/preference.service';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly catalogService: CatalogService,
    private readonly documentService: DocumentService,
    private readonly preferenceService: PreferenceService,
  ) {}

  /**
   * Aggregate Consumer Dashboard Data (Feature F16 & Health Shield)
   */
  async getConsumerDashboardData(userId: number) {
    const profile = await this.preferenceService.findOrCreate(userId);
    const { items: recentProducts } = await this.catalogService.searchAndFilter({
      limit: 6,
    });

    const evaluatedProducts = recentProducts.map((p) => ({
      ...p,
      conflict: this.preferenceService.evaluateProductConflict(profile, p),
    }));

    return {
      profile,
      recentProducts: evaluatedProducts,
    };
  }

  /**
   * Aggregate Manufacturer Console Data (Feature F01 & F06 Accreditation Health)
   */
  async getManufacturerDashboardData(user: { id: number; name?: string; email?: string }) {
    const products = await this.catalogService.findByManufacturer(user.id);
    const documents = await this.documentService.getDocuments({
      manufacturerId: user.id,
    });

    const approvedDocs = documents.filter((d) => d.status === 'approved');
    const pendingDocs = documents.filter((d) => d.status === 'pending');
    const rejectedDocs = documents.filter((d) => d.status === 'rejected');

    // Attempt to lookup sample corporate licence based on company or default
    const sampleLicences = await this.documentService.getSampleLicences(10);
    const matchedLicence = sampleLicences.find(
      (l) =>
        (user.name && l.companyName.toLowerCase().includes(user.name.toLowerCase())) ||
        (user.name && user.name.toLowerCase().includes(l.companyName.toLowerCase())),
    ) || sampleLicences[0] || null;

    return {
      products,
      totalProducts: products.length,
      documents,
      documentStats: {
        total: documents.length,
        approved: approvedDocs.length,
        pending: pendingDocs.length,
        rejected: rejectedDocs.length,
      },
      hasApprovedDocument: approvedDocs.length > 0,
      licence: matchedLicence,
    };
  }

  /**
   * Aggregate Inspector Review Queue Data (Feature F06 Audit & Recall Oversight)
   */
  async getInspectorDashboardData() {
    const stats = await this.documentService.getStatistics();
    const pendingDocuments = await this.documentService.getDocuments({
      status: 'pending',
    });
    const allDocuments = await this.documentService.getDocuments();
    const recentDecisions = allDocuments
      .filter((d) => d.status === 'approved' || d.status === 'rejected')
      .slice(0, 8);
    const sampleLicences = await this.documentService.getSampleLicences(6);

    return {
      stats,
      pendingDocuments,
      recentDecisions,
      sampleLicences,
    };
  }

  /**
   * Aggregate Admin Command Center Data (Platform Users, Catalog & Accreditation Health)
   */
  async getAdminDashboardData() {
    const users = await this.userRepo.find({
      order: { createdAt: 'DESC' },
    });
    const docStats = await this.documentService.getStatistics();
    const { total: totalProducts } = await this.catalogService.searchAndFilter({ limit: 1 });

    const roleBreakdown = {
      consumer: users.filter((u) => u.role === 'consumer').length,
      manufacturer: users.filter((u) => u.role === 'manufacturer').length,
      inspector: users.filter((u) => u.role === 'inspector').length,
      admin: users.filter((u) => u.role === 'admin').length,
    };

    return {
      users,
      totalUsers: users.length,
      roleBreakdown,
      totalProducts,
      docStats,
    };
  }
}
