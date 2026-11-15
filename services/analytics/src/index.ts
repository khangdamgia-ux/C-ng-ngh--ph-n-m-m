import { createApp } from './app.js';
import { createLogger, envInt } from '@hoian/shared';
import { ensureEventTypeConstraint } from './schema.js';

const port = envInt('PORT', 4004);
createApp().listen(port, () => createLogger('analytics').info(`Analytics Service chạy tại cổng ${port}`));
void ensureEventTypeConstraint();
