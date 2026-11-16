/**
 * Tài liệu OpenAPI 3.0 cho Hội An Audio Guide – hiển thị bằng Swagger UI tại /api/docs.
 * Mô tả các API mà API Gateway mở ra bên ngoài (bảng định tuyến PRD 8.3.2).
 * Khi thêm/sửa route ở services/*, nhớ cập nhật file này.
 */
type Obj = Record<string, unknown>;

const ref = (name: string): Obj => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Obj): Obj => ({ 'application/json': { schema } });
const res = (description: string, schema?: Obj): Obj => (schema ? { description, content: json(schema) } : { description });
const errs = (...codes: number[]): Obj =>
  Object.fromEntries(
    codes.map((c) => [
      String(c),
      { description: { 400: 'Dữ liệu không hợp lệ', 401: 'Chưa đăng nhập / token sai', 403: 'Không đủ quyền', 404: 'Không tìm thấy', 409: 'Trùng dữ liệu', 429: 'Quá nhiều yêu cầu', 503: 'Dịch vụ phía sau không khả dụng' }[c], content: json(ref('Error')) },
    ]),
  );

const secured: Obj[] = [{ bearerAuth: [] }];
const pathParam = (name: string, description: string, type = 'integer', example?: unknown): Obj => ({ name, in: 'path', required: true, description, schema: { type }, ...(example !== undefined && { example }) });
const queryParam = (name: string, description: string, schema: Obj = { type: 'string' }): Obj => ({ name, in: 'query', description, schema });
const lang = queryParam('lang', 'Mã ngôn ngữ (vi, en, ko, zh, ja, fr…). Không có bản dịch → tự dùng ngôn ngữ dự phòng', { type: 'string', example: 'vi' });
const body = (schema: Obj, example?: Obj): Obj => ({ required: true, content: { 'application/json': { schema, ...(example && { example }) } } });

export const openapi: Obj = {
  openapi: '3.0.3',
  info: {
    title: 'Hội An Audio Guide – API',
    version: '1.0.0',
    description:
      'API thuyết minh đa ngôn ngữ cho Phố cổ Hội An. Mọi lời gọi đi qua **API Gateway**.\n\n' +
      '**Dùng API quản trị (có ổ khóa):** gọi `POST /api/v1/auth/login` → trang này tự điền token; hoặc bấm **Authorize** và dán token (không cần chữ `Bearer`).\n\n' +
      'Giới hạn: 120 yêu cầu/phút/IP. Lỗi trả về dạng `{ "error": { "code", "message", "requestId" } }`.',
  },
  servers: [{ url: '/', description: 'Máy chủ hiện tại' }],
  tags: [
    { name: 'Hệ thống', description: 'Kiểm tra tình trạng Gateway và các service' },
    { name: 'Xác thực', description: 'Đăng nhập / đăng xuất Admin (JWT)' },
    { name: 'Địa điểm', description: 'Danh sách, tìm kiếm, chi tiết di tích (công khai)' },
    { name: 'Thuyết minh', description: 'Nội dung thuyết minh, ngôn ngữ, bản dịch giao diện, file âm thanh (công khai)' },
    { name: 'Phân tích', description: 'Ghi phiên truy cập ẩn danh, heartbeat, sự kiện (không lưu IP/tọa độ)' },
    { name: 'Quản trị – Địa điểm', description: 'CRUD địa điểm, tọa độ, mã QR' },
    { name: 'Quản trị – Thuyết minh', description: 'Soạn thuyết minh theo ngôn ngữ, tải âm thanh MP3/M4A' },
    { name: 'Quản trị – Ngôn ngữ', description: 'Ngôn ngữ và bản dịch giao diện (UiTranslations)' },
    { name: 'Quản trị – Thống kê', description: 'Số liệu truy cập (đã loại phiên mô phỏng)' },
    { name: 'Quản trị – Tài khoản', description: 'Quản lý tài khoản Admin (chỉ SUPER_ADMIN)' },
  ],
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Token nhận được từ /api/v1/auth/login' } },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'object', properties: { code: { type: 'string', example: 'NOT_FOUND' }, message: { type: 'string' }, requestId: { type: 'string' } } } } },
      Admin: { type: 'object', properties: { id: { type: 'integer' }, username: { type: 'string', example: 'admin' }, role: { type: 'string', enum: ['SUPER_ADMIN', 'EDITOR'] }, status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] }, lastLoginAt: { type: 'string', format: 'date-time', nullable: true }, createdAt: { type: 'string', format: 'date-time' } } },
      Category: { type: 'object', properties: { id: { type: 'integer' }, code: { type: 'string', example: 'di-tich' }, name: { type: 'string', example: 'Di tích' } } },
      Location: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, code: { type: 'string', example: 'chua-cau' }, name: { type: 'string', example: 'Chùa Cầu' },
          title: { type: 'string', description: 'Tiêu đề theo ngôn ngữ yêu cầu' }, summary: { type: 'string', nullable: true },
          language: { type: 'string', nullable: true }, isFallback: { type: 'boolean' }, category: ref('Category'),
          address: { type: 'string', nullable: true }, latitude: { type: 'number', nullable: true, example: 15.8773 }, longitude: { type: 'number', nullable: true, example: 108.3262 },
          triggerRadiusM: { type: 'integer', example: 25 }, priority: { type: 'integer' }, openingHours: { type: 'string', nullable: true },
          ticketPrice: { type: 'number', nullable: true }, imageUrl: { type: 'string', nullable: true },
        },
      },
      LocationList: { type: 'object', properties: { items: { type: 'array', items: ref('Location') }, page: { type: 'integer' }, pageSize: { type: 'integer' }, total: { type: 'integer' }, contentDegraded: { type: 'boolean', description: 'true nếu Content Service lỗi (vẫn trả danh sách, thiếu tiêu đề dịch)' } } },
      AdminLocation: { allOf: [ref('Location'), { type: 'object', properties: { description: { type: 'string', nullable: true }, isPublished: { type: 'boolean' }, updatedAt: { type: 'string', format: 'date-time' } } }] },
      LocationInput: {
        type: 'object', required: ['name', 'categoryId'],
        properties: {
          code: { type: 'string', description: 'Chỉ khi tạo mới (chữ thường, số, gạch ngang). Không đổi được vì đã in trên mã QR', example: 'nha-co-tan-ky' },
          name: { type: 'string', example: 'Nhà cổ Tấn Ký' }, categoryId: { type: 'integer', example: 1 }, description: { type: 'string', nullable: true },
          address: { type: 'string', nullable: true }, latitude: { type: 'number', nullable: true }, longitude: { type: 'number', nullable: true },
          triggerRadiusM: { type: 'integer', minimum: 5, maximum: 200, default: 25 }, priority: { type: 'integer', minimum: 0, maximum: 100, default: 0 },
          openingHours: { type: 'string', nullable: true }, ticketPrice: { type: 'number', nullable: true }, imageUrl: { type: 'string', format: 'uri', nullable: true }, isPublished: { type: 'boolean', default: false },
        },
      },
      Narration: {
        type: 'object',
        properties: {
          id: { type: 'integer' }, language: { type: 'string', example: 'vi' }, requestedLanguage: { type: 'string', example: 'ko' }, isFallback: { type: 'boolean' },
          title: { type: 'string' }, summary: { type: 'string', nullable: true }, content: { type: 'string' },
          audio: { type: 'object', nullable: true, properties: { url: { type: 'string', example: '/media/audio/narration-1-1700000000000.mp3' }, durationSeconds: { type: 'integer', nullable: true } } },
          status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'] }, updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      NarrationInput: {
        type: 'object', required: ['title', 'content'],
        properties: { title: { type: 'string' }, summary: { type: 'string', nullable: true, maxLength: 500 }, content: { type: 'string', maxLength: 20000 }, audioUrl: { type: 'string', nullable: true, description: 'Bắt đầu bằng /media/ hoặc http(s)://' }, audioDurationS: { type: 'integer', nullable: true }, status: { type: 'string', enum: ['DRAFT', 'PUBLISHED'], default: 'DRAFT' } },
      },
      Language: { type: 'object', properties: { id: { type: 'integer' }, code: { type: 'string', example: 'vi' }, name: { type: 'string', example: 'Tiếng Việt' }, is_default: { type: 'boolean' }, is_enabled: { type: 'boolean' }, fallback_order: { type: 'integer', nullable: true } } },
      EventType: { type: 'string', enum: ['QR_SCAN', 'TOUR_START', 'LOCATION_VIEW', 'AUDIO_PLAY', 'AUDIO_COMPLETE', 'GEOFENCE_TRIGGER', 'LANGUAGE_CHANGE'] },
    },
  },
  paths: {
    '/api/health': { get: { tags: ['Hệ thống'], summary: 'API Gateway còn sống', responses: { 200: res('OK', { type: 'object', properties: { status: { type: 'string', example: 'ok' }, service: { type: 'string', example: 'gateway' } } }) } } },
    '/api/ready': { get: { tags: ['Hệ thống'], summary: 'Cả 4 service (auth, location, content, analytics) đang chạy', responses: { 200: res('Tất cả "up"'), 503: res('Có service "down"') } } },

    '/api/v1/auth/login': {
      post: {
        tags: ['Xác thực'], summary: 'Đăng nhập Admin', description: 'Sai 5 lần sẽ bị khóa 15 phút. Đăng nhập xong, trang này tự điền token vào nút Authorize.',
        requestBody: body({ type: 'object', required: ['username', 'password'], properties: { username: { type: 'string' }, password: { type: 'string', format: 'password' } } }, { username: 'admin', password: '' }),
        responses: { 200: res('Thành công', { type: 'object', properties: { token: { type: 'string' }, admin: ref('Admin') } }), ...errs(400, 401, 429) },
      },
    },
    '/api/v1/auth/logout': { post: { tags: ['Xác thực'], summary: 'Đăng xuất (client xóa token)', responses: { 204: res('Đã đăng xuất') } } },
    '/api/v1/auth/me': { get: { tags: ['Xác thực'], summary: 'Hồ sơ Admin đang đăng nhập', security: secured, responses: { 200: res('OK', ref('Admin')), ...errs(401) } } },

    '/api/v1/locations': {
      get: {
        tags: ['Địa điểm'], summary: 'Danh sách + tìm kiếm + lọc địa điểm',
        parameters: [queryParam('q', 'Từ khóa (tên gốc, tiêu đề, tóm tắt)'), queryParam('category', 'Mã loại (vd. di-tich)'), lang, queryParam('page', 'Trang', { type: 'integer', default: 1, minimum: 1 }), queryParam('pageSize', 'Số dòng/trang (tối đa 100)', { type: 'integer', default: 20, maximum: 100 })],
        responses: { 200: res('OK', ref('LocationList')), ...errs(400) },
      },
    },
    '/api/v1/locations/nearby': {
      get: {
        tags: ['Địa điểm'], summary: 'Địa điểm gần một tọa độ',
        parameters: [{ ...queryParam('lat', 'Vĩ độ', { type: 'number', example: 15.8773 }), required: true }, { ...queryParam('lng', 'Kinh độ', { type: 'number', example: 108.3262 }), required: true }, queryParam('radius', 'Bán kính (m), 1–5000', { type: 'integer', default: 500 }), lang],
        responses: { 200: res('Sắp theo khoảng cách', { type: 'object', properties: { items: { type: 'array', items: { allOf: [ref('Location'), { type: 'object', properties: { distanceM: { type: 'integer' } } }] } } } }), ...errs(400) },
      },
    },
    '/api/v1/locations/{code}': {
      get: { tags: ['Địa điểm'], summary: 'Chi tiết địa điểm', parameters: [pathParam('code', 'Mã địa điểm', 'string', 'chua-cau'), lang], responses: { 200: res('OK', ref('Location')), ...errs(404) } },
    },
    '/api/v1/categories': { get: { tags: ['Địa điểm'], summary: 'Danh sách loại địa điểm', responses: { 200: res('OK', { type: 'object', properties: { items: { type: 'array', items: { allOf: [ref('Category'), { type: 'object', properties: { sortOrder: { type: 'integer' } } }] } } } }) } } },

    '/api/v1/locations/{code}/narration': {
      get: { tags: ['Thuyết minh'], summary: 'Bài thuyết minh của địa điểm (có ngôn ngữ dự phòng)', parameters: [pathParam('code', 'Mã địa điểm', 'string', 'chua-cau'), lang], responses: { 200: res('OK', ref('Narration')), ...errs(400, 404, 503) } },
    },
    '/api/v1/languages': { get: { tags: ['Thuyết minh'], summary: 'Ngôn ngữ đang bật', responses: { 200: res('OK', { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { code: { type: 'string' }, name: { type: 'string' }, isDefault: { type: 'boolean' } } } } } }) } } },
    '/api/v1/ui-translations': {
      get: { tags: ['Thuyết minh'], summary: 'Bản dịch giao diện theo ngôn ngữ', parameters: [{ ...queryParam('lang', 'Mã ngôn ngữ', { type: 'string', example: 'vi' }), required: true }], responses: { 200: res('OK', { type: 'object', properties: { lang: { type: 'string' }, items: { type: 'object', additionalProperties: { type: 'string' } } } }), ...errs(400) } },
    },
    '/media/audio/{file}': {
      get: { tags: ['Thuyết minh'], summary: 'Tải file âm thanh (hỗ trợ HTTP Range để tua)', parameters: [pathParam('file', 'Tên file', 'string')], responses: { 200: { description: 'Audio MP3/M4A', content: { 'audio/mpeg': { schema: { type: 'string', format: 'binary' } } } }, 404: res('Không có file') } },
    },

    '/api/v1/analytics/sessions': {
      post: { tags: ['Phân tích'], summary: 'Tạo/cập nhật phiên truy cập ẩn danh', requestBody: body({ type: 'object', required: ['sessionId'], properties: { sessionId: { type: 'string', pattern: '^[A-Za-z0-9-]{8,64}$' }, languageCode: { type: 'string', nullable: true }, source: { type: 'string', enum: ['QR', 'DIRECT'], nullable: true }, isSimulated: { type: 'boolean', default: false } } }, { sessionId: 'swagger-test-0001', languageCode: 'vi', source: 'DIRECT', isSimulated: true }), responses: { 201: res('Đã tạo', { type: 'object', properties: { sessionId: { type: 'string' }, timeoutSeconds: { type: 'integer', example: 120 } } }), ...errs(400) } },
    },
    '/api/v1/analytics/sessions/{id}/heartbeat': {
      post: { tags: ['Phân tích'], summary: 'Nhịp tim giữ phiên (hết hạn sau 120 giây không có)', parameters: [pathParam('id', 'sessionId', 'string', 'swagger-test-0001')], responses: { 204: res('OK'), ...errs(400) } },
    },
    '/api/v1/analytics/events': {
      post: { tags: ['Phân tích'], summary: 'Ghi sự kiện (quét QR, phát âm thanh, geofence…)', requestBody: body({ type: 'object', required: ['sessionId', 'eventType'], properties: { sessionId: { type: 'string' }, eventType: ref('EventType'), locationId: { type: 'integer', nullable: true }, isSimulated: { type: 'boolean', default: false } } }, { sessionId: 'swagger-test-0001', eventType: 'LOCATION_VIEW', locationId: 1, isSimulated: true }), responses: { 202: res('Đã nhận', { type: 'object', properties: { accepted: { type: 'boolean' } } }), ...errs(400) } },
    },

    '/api/v1/admin/locations': {
      get: { tags: ['Quản trị – Địa điểm'], summary: 'Danh sách địa điểm (kể cả chưa xuất bản)', security: secured, parameters: [queryParam('q', 'Tìm theo tên hoặc code')], responses: { 200: res('OK', { type: 'object', properties: { items: { type: 'array', items: ref('AdminLocation') } } }), ...errs(401, 403) } },
      post: { tags: ['Quản trị – Địa điểm'], summary: 'Tạo địa điểm', security: secured, requestBody: body(ref('LocationInput')), responses: { 201: res('Đã tạo', ref('AdminLocation')), ...errs(400, 401, 403, 409) } },
    },
    '/api/v1/admin/locations/{id}': {
      get: { tags: ['Quản trị – Địa điểm'], summary: 'Chi tiết địa điểm', security: secured, parameters: [pathParam('id', 'ID địa điểm')], responses: { 200: res('OK', ref('AdminLocation')), ...errs(401, 404) } },
      put: { tags: ['Quản trị – Địa điểm'], summary: 'Sửa địa điểm (không đổi được code)', security: secured, parameters: [pathParam('id', 'ID địa điểm')], requestBody: body(ref('LocationInput')), responses: { 200: res('OK', ref('AdminLocation')), ...errs(400, 401, 404) } },
      delete: { tags: ['Quản trị – Địa điểm'], summary: 'Xóa mềm địa điểm', security: secured, parameters: [pathParam('id', 'ID địa điểm')], responses: { 204: res('Đã xóa'), ...errs(401, 404) } },
    },
    '/api/v1/admin/locations/{id}/publish': {
      patch: { tags: ['Quản trị – Địa điểm'], summary: 'Xuất bản / ẩn địa điểm', security: secured, parameters: [pathParam('id', 'ID địa điểm')], requestBody: body({ type: 'object', required: ['isPublished'], properties: { isPublished: { type: 'boolean' } } }, { isPublished: true }), responses: { 200: res('OK', ref('AdminLocation')), ...errs(400, 401, 404) } },
    },
    '/api/v1/admin/locations/{id}/geo': {
      put: { tags: ['Quản trị – Địa điểm'], summary: 'Cập nhật tọa độ + bán kính kích hoạt', security: secured, parameters: [pathParam('id', 'ID địa điểm')], requestBody: body({ type: 'object', required: ['latitude', 'longitude', 'triggerRadiusM'], properties: { latitude: { type: 'number' }, longitude: { type: 'number' }, triggerRadiusM: { type: 'integer', minimum: 5, maximum: 200 }, priority: { type: 'integer', minimum: 0, maximum: 100 } } }, { latitude: 15.8773, longitude: 108.3262, triggerRadiusM: 25 }), responses: { 200: res('OK', ref('AdminLocation')), ...errs(400, 401, 404) } },
    },
    '/api/v1/admin/locations/{id}/qr': {
      get: { tags: ['Quản trị – Địa điểm'], summary: 'Tải mã QR của địa điểm', security: secured, parameters: [pathParam('id', 'ID địa điểm'), queryParam('format', 'png hoặc svg', { type: 'string', enum: ['png', 'svg'], default: 'png' })], responses: { 200: { description: 'Ảnh QR', content: { 'image/png': { schema: { type: 'string', format: 'binary' } }, 'image/svg+xml': { schema: { type: 'string' } } } }, ...errs(401, 404) } },
    },
    '/api/v1/admin/categories': {
      post: { tags: ['Quản trị – Địa điểm'], summary: 'Tạo loại địa điểm (trùng tên thì trả loại cũ)', security: secured, requestBody: body({ type: 'object', required: ['name'], properties: { name: { type: 'string', maxLength: 150 } } }, { name: 'Bảo tàng' }), responses: { 200: res('Đã có sẵn', ref('Category')), 201: res('Đã tạo', ref('Category')), ...errs(400, 401) } },
    },

    '/api/v1/admin/narrations/coverage': {
      get: { tags: ['Quản trị – Thuyết minh'], summary: 'Độ phủ thuyết minh: địa điểm × ngôn ngữ', security: secured, responses: { 200: res('OK', { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { locationId: { type: 'integer' }, lang: { type: 'string' }, status: { type: 'string' }, hasAudio: { type: 'boolean' } } } } } }), ...errs(401) } },
    },
    '/api/v1/admin/locations/{id}/narrations': {
      get: { tags: ['Quản trị – Thuyết minh'], summary: 'Mọi bản thuyết minh của một địa điểm', security: secured, parameters: [pathParam('id', 'ID địa điểm')], responses: { 200: res('OK', { type: 'object', properties: { items: { type: 'array', items: ref('Narration') } } }), ...errs(401, 404) } },
    },
    '/api/v1/admin/locations/{id}/narrations/{lang}': {
      get: { tags: ['Quản trị – Thuyết minh'], summary: 'Bản thuyết minh theo ngôn ngữ', security: secured, parameters: [pathParam('id', 'ID địa điểm'), pathParam('lang', 'Mã ngôn ngữ', 'string', 'vi')], responses: { 200: res('OK', ref('Narration')), ...errs(401, 404) } },
      put: { tags: ['Quản trị – Thuyết minh'], summary: 'Tạo/ghi đè bản thuyết minh', security: secured, parameters: [pathParam('id', 'ID địa điểm'), pathParam('lang', 'Mã ngôn ngữ', 'string', 'vi')], requestBody: body(ref('NarrationInput')), responses: { 200: res('OK', ref('Narration')), ...errs(400, 401, 404) } },
    },
    '/api/v1/admin/narrations/{id}/audio': {
      post: {
        tags: ['Quản trị – Thuyết minh'], summary: 'Tải âm thanh lên (MP3/M4A, tối đa 5 MB)', security: secured, parameters: [pathParam('id', 'ID bài thuyết minh (Narration.id)')],
        requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['audio'], properties: { audio: { type: 'string', format: 'binary' }, durationSeconds: { type: 'integer' } } } } } },
        responses: { 200: res('OK', { type: 'object', properties: { audioUrl: { type: 'string' }, durationSeconds: { type: 'integer', nullable: true } } }), ...errs(400, 401, 404) },
      },
    },

    '/api/v1/admin/languages': {
      get: { tags: ['Quản trị – Ngôn ngữ'], summary: 'Tất cả ngôn ngữ (cả đang tắt)', security: secured, responses: { 200: res('OK', { type: 'object', properties: { items: { type: 'array', items: ref('Language') } } }), ...errs(401) } },
      post: { tags: ['Quản trị – Ngôn ngữ'], summary: 'Thêm ngôn ngữ (SUPER_ADMIN)', security: secured, requestBody: body({ type: 'object', required: ['code', 'name'], properties: { code: { type: 'string', example: 'de' }, name: { type: 'string', example: 'Deutsch' }, isEnabled: { type: 'boolean', default: true }, fallbackOrder: { type: 'integer', nullable: true } } }), responses: { 201: res('Đã tạo', ref('Language')), ...errs(400, 401, 403, 409) } },
    },
    '/api/v1/admin/languages/{id}': {
      put: { tags: ['Quản trị – Ngôn ngữ'], summary: 'Sửa / bật-tắt / đặt mặc định (SUPER_ADMIN)', security: secured, parameters: [pathParam('id', 'ID ngôn ngữ')], requestBody: body({ type: 'object', properties: { name: { type: 'string' }, isEnabled: { type: 'boolean' }, isDefault: { type: 'boolean', enum: [true] }, fallbackOrder: { type: 'integer', nullable: true } } }), responses: { 200: res('OK', ref('Language')), ...errs(400, 401, 403, 404) } },
    },
    '/api/v1/admin/ui-translations/{lang}': {
      get: { tags: ['Quản trị – Ngôn ngữ'], summary: 'Bản dịch giao diện của một ngôn ngữ', security: secured, parameters: [pathParam('lang', 'Mã ngôn ngữ', 'string', 'vi')], responses: { 200: res('OK', { type: 'object', properties: { lang: { type: 'string' }, items: { type: 'object', additionalProperties: { type: 'string' } } } }), ...errs(401) } },
      put: { tags: ['Quản trị – Ngôn ngữ'], summary: 'Cập nhật bản dịch giao diện (gộp theo key)', security: secured, parameters: [pathParam('lang', 'Mã ngôn ngữ', 'string', 'vi')], requestBody: body({ type: 'object', required: ['items'], properties: { items: { type: 'object', additionalProperties: { type: 'string' } } } }, { items: { 'home.title': 'Hội An' } }), responses: { 200: res('OK', { type: 'object', properties: { lang: { type: 'string' }, updated: { type: 'integer' } } }), ...errs(400, 401, 404) } },
    },

    '/api/v1/admin/stats/active-sessions': { get: { tags: ['Quản trị – Thống kê'], summary: 'Số phiên đang hoạt động', security: secured, responses: { 200: res('OK', { type: 'object', properties: { activeSessions: { type: 'integer' }, timeoutSeconds: { type: 'integer' }, note: { type: 'string' } } }), ...errs(401) } } },
    '/api/v1/admin/stats/visits': {
      get: { tags: ['Quản trị – Thống kê'], summary: 'Lượt truy cập theo ngày/tuần/tháng', security: secured, parameters: [queryParam('from', 'Từ ngày (ISO), mặc định 7 ngày trước', { type: 'string', format: 'date-time' }), queryParam('to', 'Đến ngày (ISO)', { type: 'string', format: 'date-time' }), queryParam('groupBy', 'Gom nhóm', { type: 'string', enum: ['day', 'week', 'month'], default: 'day' })], responses: { 200: res('OK'), ...errs(400, 401) } },
    },
    '/api/v1/admin/stats/top-locations': {
      get: { tags: ['Quản trị – Thống kê'], summary: 'Top 10 địa điểm được nghe nhiều nhất', security: secured, parameters: [queryParam('from', 'Từ ngày (ISO)', { type: 'string', format: 'date-time' }), queryParam('to', 'Đến ngày (ISO)', { type: 'string', format: 'date-time' })], responses: { 200: res('OK', { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { locationId: { type: 'integer' }, name: { type: 'string' }, plays: { type: 'integer' }, views: { type: 'integer' } } } } } }), ...errs(400, 401) } },
    },

    '/api/v1/admin/accounts': {
      get: { tags: ['Quản trị – Tài khoản'], summary: 'Danh sách Admin (SUPER_ADMIN)', security: secured, responses: { 200: res('OK', { type: 'object', properties: { items: { type: 'array', items: ref('Admin') } } }), ...errs(401, 403) } },
      post: { tags: ['Quản trị – Tài khoản'], summary: 'Tạo tài khoản Admin (SUPER_ADMIN)', security: secured, requestBody: body({ type: 'object', required: ['username', 'password'], properties: { username: { type: 'string', minLength: 3 }, password: { type: 'string', minLength: 8, format: 'password' }, role: { type: 'string', enum: ['SUPER_ADMIN', 'EDITOR'], default: 'EDITOR' } } }), responses: { 201: res('Đã tạo', ref('Admin')), ...errs(400, 401, 403, 409) } },
    },
    '/api/v1/admin/accounts/{id}': {
      put: { tags: ['Quản trị – Tài khoản'], summary: 'Đổi quyền / khóa / đặt lại mật khẩu (SUPER_ADMIN)', security: secured, parameters: [pathParam('id', 'ID tài khoản')], requestBody: body({ type: 'object', properties: { role: { type: 'string', enum: ['SUPER_ADMIN', 'EDITOR'] }, status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] }, password: { type: 'string', minLength: 8, format: 'password' } } }), responses: { 200: res('OK', ref('Admin')), ...errs(400, 401, 403, 404) } },
    },
  },
};
