import { createApp } from './app.js';
import { createLogger, envInt } from '@hoian/shared';

const port = envInt('PORT', 4001);
createApp().listen(port, () => createLogger('auth').info(`Auth Service chạy tại cổng ${port}`));
