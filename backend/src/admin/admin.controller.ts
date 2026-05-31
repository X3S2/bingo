import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { UserRole } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsBoolean } from 'class-validator';

class BanUserDto {
  @IsString() @IsOptional() reason?: string;
}

class ChangeRoleDto {
  @IsEnum(UserRole) role: UserRole;
}

class SetSettingDto {
  @IsString() value: string;
}

class MaintenanceDto {
  @IsBoolean() enabled: boolean;
  @IsString() @IsOptional() message?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  listUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
  ) {
    return this.adminService.listUsers(+page, +limit, search);
  }

  @Patch('users/:id/ban')
  banUser(@Param('id') id: string, @Body() dto: BanUserDto, @Req() req: any) {
    return this.adminService.banUser(id, req.user.id, dto.reason);
  }

  @Patch('users/:id/unban')
  unbanUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.unbanUser(id, req.user.id);
  }

  @Patch('users/:id/role')
  changeRole(@Param('id') id: string, @Body() dto: ChangeRoleDto, @Req() req: any) {
    return this.adminService.changeUserRole(id, req.user.id, dto.role);
  }

  @Get('games')
  listGames(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.adminService.listGames(+page, +limit);
  }

  @Post('games/:id/stop')
  forceStopGame(@Param('id') id: string, @Req() req: any) {
    return this.adminService.forceStopGame(id, req.user.id);
  }

  @Get('settings')
  getAllSettings() {
    return this.adminService.getAllSettings();
  }

  @Get('settings/:key')
  getSetting(@Param('key') key: string) {
    return this.adminService.getSetting(key);
  }

  @Patch('settings/:key')
  setSetting(@Param('key') key: string, @Body() dto: SetSettingDto, @Req() req: any) {
    return this.adminService.setSetting(key, dto.value, req.user.id);
  }

  @Post('maintenance')
  setMaintenance(@Body() dto: MaintenanceDto, @Req() req: any) {
    return this.adminService.setMaintenanceMode(
      dto.enabled,
      dto.message || 'Maintenance in progress',
      req.user.id,
    );
  }

  @Get('bot-status')
  getBotStatus() {
    return this.adminService.getBotStatus();
  }

  @Post('bot-refresh')
  @HttpCode(200)
  refreshBotToken(@Req() req: any) {
    return this.adminService.refreshBotToken(req.user.id);
  }

  @Post('bot-reconnect')
  @HttpCode(200)
  reconnectBot() {
    return this.adminService.reconnectBot();
  }

  @Get('audit-log')
  getAuditLog(@Query('page') page = '1', @Query('limit') limit = '50') {
    return this.adminService.getAuditLog(+page, +limit);
  }
}
