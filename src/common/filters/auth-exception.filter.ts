import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(UnauthorizedException, ForbiddenException)
export class AuthExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    const acceptsHtml = request.accepts ? request.accepts(['html', 'json']) === 'html' : false;

    if (acceptsHtml) {
      if (status === 401) {
        return response.redirect('/auth/login?unauthorized=true');
      }

      if (status === 403) {
        return response.status(403).render('shared/views/forbidden', {
          title: 'Access Forbidden — TrueLabel',
          message: exception.message || 'You do not have permission to access this resource.',
          user: request.session?.user || null,
        });
      }
    }

    return response.status(status).json({
      statusCode: status,
      message: exception.message,
      error: status === 401 ? 'Unauthorized' : 'Forbidden',
    });
  }
}
