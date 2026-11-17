import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  Res,
  Render,
  UseGuards,
  UsePipes,
  ValidationPipe,
  ParseIntPipe,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CatalogService } from '../services/catalog.service';
import { PreferenceService } from '../../personal-food/services/preference.service';
import { DocumentService } from '../../food-safety/services/document.service';
import { CreateFoodProductDto } from '../models/dto/create-food-product.dto';
import { SearchFoodProductDto } from '../models/dto/search-food-product.dto';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('catalog')
export class FoodCatalogController {
  constructor(
    private readonly catalogService: CatalogService,
    private readonly preferenceService: PreferenceService,
    private readonly documentService: DocumentService,
  ) {}

  /**
   * Catalog Discovery: Search, filter by category/tag, score breakdown
   */
  @Get()
  @Render('areas/food-catalog/views/index')
  async getCatalog(@Query() searchDto: SearchFoodProductDto, @Req() req: Request) {
    const { items, total, page, totalPages } =
      await this.catalogService.searchAndFilter(searchDto);
    const filterOptions = await this.catalogService.getFilterOptions();

    let userProfile = null;
    if (req.session?.user) {
      userProfile = await this.preferenceService.findByUserId(req.session.user.id);
    }

    const annotatedItems = items.map((prod) => {
      const conflict = userProfile
        ? this.preferenceService.evaluateProductConflict(userProfile, prod)
        : null;
      return {
        ...prod,
        userConflict: conflict,
      };
    });

    return {
      title: 'Food Catalog & Transparency Score — TrueLabel',
      activeNav: 'catalog',
      products: annotatedItems,
      total,
      page,
      totalPages,
      query: searchDto.q || '',
      selectedCategory: searchDto.category || '',
      selectedTag: searchDto.tag || '',
      minScore: searchDto.minScore || '',
      categories: filterOptions.categories,
      dietaryTags: filterOptions.dietaryTags,
      user: req.session?.user || null,
      userProfile,
    };
  }

  /**
   * Manufacturer View: Product Creation Form
   * F06 Gate: Manufacturer must have at least one approved safety document.
   */
  @Get('manage/create')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @Render('areas/food-catalog/views/create')
  async getCreateForm(
    @Req() req: Request,
    @Query('barcode') barcode?: string,
  ) {
    const user = req.session?.user;

    // Admins bypass the licence gate
    if (user?.role === 'manufacturer') {
      const isApproved = await this.documentService.hasApprovedDocument(user.id);
      if (!isApproved) {
        return {
          title: 'Submit Food to Catalog — TrueLabel',
          activeNav: 'catalog',
          user,
          licenceBlocked: true,
          error:
            'Your account is not yet approved. Please submit a safety document and wait for an Inspector to approve it before listing food products.',
          categories: [],
          dietaryTags: [],
          barcode: '',
        };
      }
    }

    const filterOptions = await this.catalogService.getFilterOptions();
    return {
      title: 'Submit Food to Catalog — TrueLabel',
      activeNav: 'catalog',
      categories: filterOptions.categories,
      dietaryTags: filterOptions.dietaryTags,
      barcode: barcode ? barcode.trim() : '',
      user,
    };
  }

  /**
   * Process Product Creation Form
   * F06 Gate: Manufacturer must have at least one approved safety document.
   */
  @Post('manage/create')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .filter(Boolean);
        return new BadRequestException(
          messages.length > 0 ? messages.join('. ') : 'Validation failed for food product submission',
        );
      },
    }),
  )
  async handleCreate(
    @Body() dto: CreateFoodProductDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const user = req.session.user;

      // Admins bypass the licence gate
      if (user?.role === 'manufacturer') {
        const isApproved = await this.documentService.hasApprovedDocument(user.id);
        if (!isApproved) {
          const filterOptions = await this.catalogService.getFilterOptions();
          return res.status(403).render('areas/food-catalog/views/create', {
            title: 'Submit Food to Catalog — TrueLabel',
            activeNav: 'catalog',
            user,
            licenceBlocked: true,
            error:
              'Your account is not yet approved. Please submit a safety document and wait for an Inspector to approve it before listing food products.',
            categories: filterOptions.categories,
            dietaryTags: filterOptions.dietaryTags,
            barcode: dto.barcode || '',
            productData: dto,
          });
        }
      }

      const product = await this.catalogService.create(dto, user.id);
      return res.redirect(`/catalog/product/${product.id}`);
    } catch (err) {
      const filterOptions = await this.catalogService.getFilterOptions();
      return res.status(400).render('areas/food-catalog/views/create', {
        title: 'Submit Food to Catalog — TrueLabel',
        activeNav: 'catalog',
        error: err.message || 'Failed to register product',
        productData: dto,
        categories: filterOptions.categories,
        dietaryTags: filterOptions.dietaryTags,
        user: req.session?.user,
      });
    }
  }

  /**
   * Alias: POST /catalog/manage -> maps to handleCreate
   */
  @Post('manage')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      exceptionFactory: (errors) => {
        const messages = errors
          .map((e) => Object.values(e.constraints || {}).join(', '))
          .filter(Boolean);
        return new BadRequestException(
          messages.length > 0 ? messages.join('. ') : 'Validation failed for food product submission',
        );
      },
    }),
  )
  async handleCreateAlias(
    @Body() dto: CreateFoodProductDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.handleCreate(dto, req, res);
  }

  /**
   * Barcode Search: Direct lookup or Request-to-Add page
   */
  @Get('barcode/:barcode')
  async searchBarcode(
    @Param('barcode') barcode: string,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const product = await this.catalogService.findByBarcode(barcode);
    if (product) {
      return res.redirect(`/catalog/product/${product.id}`);
    }
    return res.render('areas/food-catalog/views/not-found', {
      title: 'Barcode Not Found — TrueLabel',
      activeNav: 'catalog',
      barcode,
      user: req.session?.user || null,
    });
  }

  /**
   * Product Details: Ingredients, Nutrition Facts, Transparency breakdown
   */
  @Get('product/:id')
  @Render('areas/food-catalog/views/detail')
  async getProductDetail(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const product = await this.catalogService.findById(id);

    // Group ingredients by hazard level for clear presentation
    const allergens = product.ingredients?.filter((i) => i.isAllergen) || [];
    const additives = product.ingredients?.filter((i) => i.additiveCode) || [];

    // Personal Allergen & Dietary Conflict Evaluation (Feature F16)
    let conflictEvaluation = null;
    let userProfile = null;
    if (req.session?.user) {
      userProfile = await this.preferenceService.findByUserId(req.session.user.id);
      conflictEvaluation = this.preferenceService.evaluateProductConflict(
        userProfile,
        product,
      );
    }

    return {
      title: `${product.name} (${product.brand}) — TrueLabel`,
      activeNav: 'catalog',
      product,
      allergens,
      additives,
      conflictEvaluation,
      userProfile,
      isOwner:
        req.session?.user?.role === 'admin' ||
        (req.session?.user?.role === 'manufacturer' &&
          req.session?.user?.id === product.manufacturerId),
      user: req.session?.user || null,
    };
  }

  /**
   * Manufacturer View: Product Edit Form
   */
  @Get('manage/:id/edit')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  @Render('areas/food-catalog/views/edit')
  async getEditForm(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    const product = await this.catalogService.findById(id);
    const user = req.session?.user;

    // Strict Object-Level Authorization: Manufacturers may only access their own product edit form
    if (user?.role === 'manufacturer' && product.manufacturerId !== user.id) {
      throw new ForbiddenException(
        'Manufacturers are only permitted to edit their own food products',
      );
    }

    const filterOptions = await this.catalogService.getFilterOptions();

    return {
      title: `Edit ${product.name} — TrueLabel`,
      activeNav: 'catalog',
      product,
      categories: filterOptions.categories,
      dietaryTags: filterOptions.dietaryTags,
      user,
    };
  }

  /**
   * Process Product Edit Form
   */
  @Post('manage/:id/edit')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  async handleEdit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateFoodProductDto>,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      await this.catalogService.update(id, dto, req.session.user);
      return res.redirect(`/catalog/product/${id}`);
    } catch (err) {
      const product = await this.catalogService.findById(id);
      const filterOptions = await this.catalogService.getFilterOptions();
      return res.render('areas/food-catalog/views/edit', {
        title: `Edit ${product.name} — TrueLabel`,
        error: err.message || 'Failed to update product',
        product,
        categories: filterOptions.categories,
        dietaryTags: filterOptions.dietaryTags,
        user: req.session?.user,
      });
    }
  }

  /**
   * Process Product Archive
   */
  @Post('manage/:id/archive')
  @UseGuards(AuthenticatedGuard, RolesGuard)
  @Roles('manufacturer', 'admin')
  async handleArchive(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    await this.catalogService.archive(id, req.session.user);
    return res.redirect('/catalog');
  }
}

