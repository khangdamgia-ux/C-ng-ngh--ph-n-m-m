import { createApp } from './app.js';
import { createLogger, envInt } from '@hoian/shared';

const port = envInt('PORT', 4003);
createApp().listen(port, () => createLogger('content').info(`Content Service chạy tại cổng ${port}`));
