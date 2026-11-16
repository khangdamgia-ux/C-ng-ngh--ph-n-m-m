import { Router } from 'express';
import { openapi } from './openapi.js';

const SWAGGER_UI = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';

/** Trang Swagger UI – không cần cài thêm gói npm (tải giao diện từ CDN, cần Internet). */
const page = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>API – Hội An Audio Guide</title>
  <link rel="stylesheet" href="${SWAGGER_UI}/swagger-ui.css" />
  <style>
    body { margin: 0; }
    @media (prefers-color-scheme: dark) {
      body { background: #0f1115; }
      .swagger-ui, .swagger-ui .info .title, .swagger-ui .info li, .swagger-ui .info p, .swagger-ui .info a,
      .swagger-ui .opblock-tag, .swagger-ui .opblock .opblock-summary-description, .swagger-ui .opblock-description-wrapper p,
      .swagger-ui .parameter__name, .swagger-ui .parameter__type, .swagger-ui table thead tr th, .swagger-ui .response-col_status,
      .swagger-ui .response-col_description, .swagger-ui label, .swagger-ui .tab li, .swagger-ui .model, .swagger-ui .model-title,
      .swagger-ui section.models h4, .swagger-ui .servers > label, .swagger-ui .scheme-container .schemes > label { color: #e6e6e6; }
      .swagger-ui .scheme-container, .swagger-ui .opblock .opblock-section-header { background: #171a21; box-shadow: none; }
      .swagger-ui .opblock-tag { border-bottom-color: #2b303b; }
      .swagger-ui input, .swagger-ui select, .swagger-ui textarea { background: #1d212a; color: #e6e6e6; border-color: #3a404d; }
      .swagger-ui .opblock .opblock-summary-operation-id, .swagger-ui .opblock .opblock-summary-path { color: #e6e6e6; }
      .swagger-ui .topbar { display: none; }
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="${SWAGGER_UI}/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/api/docs/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true,
      docExpansion: 'list',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      tryItOutEnabled: true,
      // Đăng nhập xong thì tự điền token vào nút Authorize
      responseInterceptor: function (response) {
        try {
          if (response.url.indexOf('/api/v1/auth/login') !== -1 && response.status === 200) {
            var token = JSON.parse(response.text).token;
            if (token) window.ui.preauthorizeApiKey('bearerAuth', token);
          }
        } catch (e) { /* bỏ qua */ }
        return response;
      }
    });
  </script>
</body>
</html>`;

export function docsRouter() {
  const router = Router();
  router.get('/api/docs/openapi.json', (_req, res) => res.json(openapi));
  router.get('/api/docs', (_req, res) => res.type('html').send(page));
  return router;
}
