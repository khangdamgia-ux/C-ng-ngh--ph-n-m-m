import { createLogger, query } from '@hoian/shared';

const logger = createLogger('analytics');

/** Các loại sự kiện hợp lệ – phải khớp db/migrations/V001__init.sql và EVENT_TYPES trong app.ts. */
const TYPES = ['QR_SCAN', 'TOUR_START', 'LOCATION_VIEW', 'AUDIO_PLAY', 'AUDIO_COMPLETE', 'GEOFENCE_TRIGGER', 'LANGUAGE_CHANGE'];

/**
 * Tự sửa ràng buộc CK_VisitEvents_Type của CSDL cũ.
 * CSDL khôi phục từ backup (hoặc tạo bởi phiên bản cũ) có thể chỉ cho phép vài loại sự kiện (vd. chỉ LANGUAGE_CHANGE),
 * khiến mọi lượt quét QR / bật GPS / nghe bị từ chối với lỗi CHECK constraint và KHÔNG được thống kê.
 * Chạy lúc khởi động, an toàn khi chạy lại nhiều lần (chỉ sửa khi thiếu loại nào đó).
 */
export async function ensureEventTypeConstraint(): Promise<void> {
  const list = TYPES.map((t) => `'${t}'`).join(',');
  const missing = TYPES.map((t) => `definition NOT LIKE '%${t}%'`).join(' OR ');
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      await query(
        `IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_VisitEvents_Type' AND parent_object_id = OBJECT_ID('dbo.VisitEvents') AND (${missing}))
         BEGIN
           ALTER TABLE dbo.VisitEvents DROP CONSTRAINT CK_VisitEvents_Type;
           ALTER TABLE dbo.VisitEvents WITH CHECK ADD CONSTRAINT CK_VisitEvents_Type CHECK (event_type IN (${list}));
         END
         ELSE IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_VisitEvents_Type' AND parent_object_id = OBJECT_ID('dbo.VisitEvents'))
           ALTER TABLE dbo.VisitEvents WITH CHECK ADD CONSTRAINT CK_VisitEvents_Type CHECK (event_type IN (${list}));`,
      );
      logger.info('Ràng buộc CK_VisitEvents_Type đã đủ các loại sự kiện');
      return;
    } catch (err) {
      logger.warn(`Chưa kiểm tra được ràng buộc sự kiện (lần ${attempt}/15)`, { err: String(err) });
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
