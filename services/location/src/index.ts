import { createApp } from './app.js';
import { createLogger, envInt } from '@hoian/shared';

const port = envInt('PORT', 4002);
createApp().listen(port, () => createLogger('location').info(`Location Service chạy tại cổng ${port}`));
