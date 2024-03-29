import {
  Controller,
  Get,
  UseGuards,
  Req,
  Res,
  Post,
  InternalServerErrorException,
  Body,
  UseFilters,
} from '@nestjs/common';
import {
  CallbackDoc,
  GoogleCallbackDoc,
  GoogleLoginDoc,
  LoginDoc,
  ProfileDoc,
  SignInDoc,
  SignUpDoc,
  TurnOffDoc,
  TurnOnDoc,
  VerifyDoc,
} from './auth.decorator';
import { AuthService } from './auth.service';
import { FourtyTwoGuard, Jwt2faAuthGuard } from './guards';
import { Public } from 'src/public.decorator';
import { Response } from 'express';
import * as qrcode from 'qrcode';

import { GoogleGuard } from './guards/google.guard';
import { SignInDto } from './dto/signin.dto';
import { SignUpDto } from './dto/signup.dto';
import { ApiBearerAuth } from '@nestjs/swagger';
import { FourtyTwoFilter } from './exeception.filter';
import { UsersService } from 'src/users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Public()
  @Get('google/login')
  @UseGuards(GoogleGuard)
  @GoogleLoginDoc()
  async googleAuth(@Req() req) {}

  @Public()
  @Get('google/callback')
  @GoogleCallbackDoc()
  @UseGuards(GoogleGuard)
  async googleAuthRedirect(@Req() req, @Res() res) {
    await this.authService.callback(req, res);
  }

  @Public()
  @Post('signin')
  @SignInDoc()
  async signIn(@Body() body: SignInDto) {
    return await this.authService.signIn(body);
  }

  @Public()
  @Post('signup')
  @SignUpDoc()
  async signUp(@Body() body: SignUpDto) {
    return await this.authService.signUp(body);
  }

  @ProfileDoc()
  @Get('42')
  async fortyTwoLogin(@Req() req) {
    try {
      return this.usersService.findUserById(req.user.sub ? req.user.sub : 0);
    } catch (e) {
      throw e;
    }
  }

  @UseFilters(FourtyTwoFilter)
  @UseGuards(FourtyTwoGuard)
  @Public()
  @CallbackDoc()
  @Get('42/callback')
  async fortyTwoLoginCallback(@Req() req, @Res() res: Response) {
    try {
      await this.authService.callback(req, res);
    } catch (e) {
      throw e;
    }
  }

  @Get('2fa/qrcode')
  async generateQrCodeDataUrl(@Req() req) {
    try {
      const otpauthUrl = await this.authService.generateQrCodeDataUrl(
        req.user.login ? req.user.login : '',
      );
      const qrCode = await qrcode.toDataURL(otpauthUrl);
      return qrCode;
    } catch {
      throw new InternalServerErrorException(
        'An internal server error occurred.',
      );
    }
  }

  @TurnOnDoc()
  @Post('2fa/turn-on')
  async turnOnTwoFactorAuthentication(@Req() req) {
    try {
      return this.authService.turnOnTwoFactorAuthentication(req);
    } catch (e) {
      throw e;
    }
  }
  @TurnOffDoc()
  @Post('2fa/turn-off')
  async turnOffTwoFactorAuthentication(@Req() req) {
    try {
      return this.authService.turnOffTwoFactorAuthentication(req);
    } catch (e) {
      throw e;
    }
  }

  @Public()
  @UseGuards(Jwt2faAuthGuard)
  @VerifyDoc()
  @Post('2fa/verify')
  async verifyTwoFactorAuthentication(@Req() req, @Res() res) {
    try {
      const _res = await this.authService.verify(req, res);
      res.end(_res.message);
    } catch (e) {
      throw e;
    }
  }
}
