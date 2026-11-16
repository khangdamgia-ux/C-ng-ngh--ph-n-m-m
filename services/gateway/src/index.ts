import { createApp } from './app.js';
import { createLogger, envInt } from '@hoian/shared';

const port = envInt('GATEWAY_PORT', envInt('PORT', 8081));

createApp().listen(port, () => createLogger('gateway').info(`API Gateway chạy tại cổng ${port}`));