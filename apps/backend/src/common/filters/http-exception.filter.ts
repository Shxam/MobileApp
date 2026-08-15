import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : null;

    let message: any = 'Internal server error';
    let error = 'InternalServerError';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      const respObj = exceptionResponse as any;
      message = respObj.message || message;
      error = respObj.error || (exception as any).name || error;
    } else if (exception instanceof Error) {
      const isProd = process.env.NODE_ENV === 'production';
      message = isProd && status === 500 ? 'Internal server error' : exception.message;
      error = isProd && status === 500 ? 'InternalServerError' : exception.name;
    }

    const requestId = (request.headers['x-request-id'] as string) || 'unknown_req';

    // Dispatches Slack/Discord Alert Webhook on 5xx Errors
    if (status >= 500) {
      this.sendErrorAlertWebhook({
        requestId,
        path: request.url,
        method: request.method,
        status,
        error,
        message,
        timestamp: new Date().toISOString(),
      });
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      path: request.url,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private async sendErrorAlertWebhook(alertData: any) {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.includes('STUB')) return;

    try {
      const payload = {
        text: `🚨 *[IPL DHABA ERROR ALERT]* 5xx Failure on \`${alertData.method} ${alertData.path}\``,
        attachments: [
          {
            color: '#DC2626',
            fields: [
              { title: 'Status Code', value: `${alertData.status}`, short: true },
              { title: 'Request ID', value: `\`${alertData.requestId}\``, short: true },
              { title: 'Error Type', value: alertData.error, short: true },
              { title: 'Message', value: JSON.stringify(alertData.message), short: false },
            ],
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      this.logger.log(`🚨 Error Alert Webhook sent for Request ID ${alertData.requestId}`);
    } catch (err: any) {
      this.logger.warn(`Failed to dispatch error alert webhook: ${err.message}`);
    }
  }
}
