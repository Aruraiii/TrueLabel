import { Controller, Get, Req, Render } from '@nestjs/common';
import { Request } from 'express';
import { CatalogService } from '../../food-catalog/services/catalog.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { PreferenceService } from '../../personal-food/services/preference.service';

@Controller()
export class HomeController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly documentService: DocumentService,
    private readonly preferenceService: PreferenceService,
  ) {}

  /**
   * Home Landing Page: Central platform hub presenting core pillars,
   * live transparency metrics, interactive quick-verifier, and featured catalog foods.
   */
  @Get()
  @Render('areas/home/views/index')
  async getHomePage(@Req() req: Request) {
    // 1. Fetch featured food products from catalog (top 4 items)
    const { items: featuredProducts, total: totalProducts } =
      await this.catalogService.searchAndFilter({ limit: 4 });

    // 2. Fetch safety documents & compliance statistics
    const docStats = await this.documentService.getStatistics();

    // 3. User session & personalized health profile evaluation
    const user = req.session?.user || null;
    let userProfile = null;
    if (user) {
      userProfile = await this.preferenceService.findByUserId(user.id);
    }

    // Annotate featured items with user's allergen/dietary conflict status
    const annotatedFeatured = featuredProducts.map((prod) => {
      const conflict = userProfile
        ? this.preferenceService.evaluateProductConflict(userProfile, prod)
        : null;
      return {
        ...prod,
        userConflict: conflict,
      };
    });

    return {
      title: 'TrueLabel — Food Quality, Safety & Diet Intelligence Platform',
      activeNav: 'home',
      featuredProducts: annotatedFeatured,
      stats: {
        products: totalProducts,
        documents: docStats.total,
        approvedDocs: docStats.approved,
        pendingDocs: docStats.pending,
      },
      user,
      userProfile,
    };
  }
}
