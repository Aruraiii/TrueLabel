import {
  Controller,
  Get,
  Req,
  Res,
  Render,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { AuthenticatedGuard } from '../../../common/guards/authenticated.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';

@Controller('dashboard')
@UseGuards(AuthenticatedGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * Central Dashboard Dispatcher: Automatically routes each authenticated user to their role's workspace
   */
  @Get()
  async getDashboard(@Req() req: Request, @Res() res: Response) {
    const role = req.session.user.role;
    switch (role) {
      case 'manufacturer':
        return res.redirect('/dashboard/manufacturer');
      case 'inspector':
        return res.redirect('/dashboard/inspector');
      case 'admin':
        return res.redirect('/dashboard/admin');
      case 'consumer':
      default:
        return res.redirect('/dashboard/consumer');
    }
  }

  /**
   * Consumer Health & Dietary Shield Dashboard
   */
  @Get('consumer')
  @Roles('consumer', 'admin')
  @Render('areas/identity/views/dashboard/consumer')
  async getConsumerDashboard(@Req() req: Request) {
    const data = await this.dashboardService.getConsumerDashboardData(req.session.user.id);
    return {
      title: 'Consumer Health & Nutrition Dashboard — TrueLabel',
      activeNav: 'dashboard',
      user: req.session.user,
      ...data,
    };
  }

  /**
   * Manufacturer Compliance & Product Console
   */
  @Get('manufacturer')
  @Roles('manufacturer', 'admin')
  @Render('areas/identity/views/dashboard/manufacturer')
  async getManufacturerDashboard(@Req() req: Request) {
    const data = await this.dashboardService.getManufacturerDashboardData(req.session.user);
    return {
      title: 'Manufacturer Compliance & Catalog Console — TrueLabel',
      activeNav: 'dashboard',
      user: req.session.user,
      ...data,
    };
  }

  /**
   * Inspector Verification Queue & Audit Dashboard
   */
  @Get('inspector')
  @Roles('inspector', 'admin')
  @Render('areas/identity/views/dashboard/inspector')
  async getInspectorDashboard(@Req() req: Request) {
    const data = await this.dashboardService.getInspectorDashboardData();
    return {
      title: 'Food Safety Inspector Audit Queue — TrueLabel',
      activeNav: 'dashboard',
      user: req.session.user,
      ...data,
    };
  }

  /**
   * System Administrator Command Center
   */
  @Get('admin')
  @Roles('admin')
  @Render('areas/identity/views/dashboard/admin')
  async getAdminDashboard(@Req() req: Request) {
    const data = await this.dashboardService.getAdminDashboardData();
    return {
      title: 'System Administrator Command Center — TrueLabel',
      activeNav: 'dashboard',
      user: req.session.user,
      ...data,
    };
  }
}
