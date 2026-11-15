import { describe, expect, it } from 'vitest';
import { TourEngine, type Fix, type Place } from './engine';
import { offset } from './geo';

// Tọa độ tham khảo (PRD Phụ lục A)
const chuaCau: Place = { id: 1, code: 'chua-cau', title: 'Chùa Cầu', lat: 15.87709, lng: 108.32602, radiusM: 25, priority: 10 };
const phungHung: Place = { id: 2, code: 'nha-co-phung-hung', title: 'Phùng Hưng', lat: 15.87717, lng: 108.32555, radiusM: 20, priority: 0 };
const quanThang: Place = { id: 6, code: 'nha-co-quan-thang', title: 'Quân Thắng', lat: 15.87725, lng: 108.3286, radiusM: 20, priority: 0 };
const gomSu: Place = { id: 7, code: 'bao-tang-gom-su', title: 'Gốm sứ', lat: 15.87735, lng: 108.3288, radiusM: 20, priority: 1 };

const at = (p: { lat: number; lng: number }, t: number, accuracy = 8): Fix => ({ lat: p.lat, lng: p.lng, accuracy, timestamp: t });

function engine(places: Place[]) {
  const e = new TourEngine();
  e.setPlaces(places);
  return e;
}

describe('TourEngine – thuyết minh rảnh tay (FR-05)', () => {
  it('chỉ kích hoạt sau khi ở trong vùng ≥ 3 giây (TC12)', () => {
    const e = engine([chuaCau]);
    expect(e.onFix(at(chuaCau, 0))).toEqual([]);
    expect(e.onFix(at(chuaCau, 2000))).toEqual([]);
    const ev = e.onFix(at(chuaCau, 3100));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ type: 'trigger', action: 'play', place: { code: 'chua-cau' } });
  });

  it('không kích hoạt lặp khi vẫn đứng trong vùng (TC13)', () => {
    const e = engine([chuaCau]);
    e.onFix(at(chuaCau, 0));
    e.onFix(at(chuaCau, 3500));
    e.next(); // bài kết thúc
    for (let t = 4000; t < 10 * 60_000; t += 5000) expect(e.onFix(at(chuaCau, t))).toEqual([]);
  });

  it('cho phép kích hoạt lại sau 30 phút', () => {
    const e = engine([chuaCau]);
    e.onFix(at(chuaCau, 0));
    e.onFix(at(chuaCau, 3500));
    e.next();
    const far = offset(chuaCau, 0, -500);
    e.onFix(at(far, 60_000));
    e.onFix(at(chuaCau, 31 * 60_000));
    expect(e.onFix(at(chuaCau, 31 * 60_000 + 3500))[0]).toMatchObject({ type: 'trigger', action: 'play' });
  });

  it('bỏ qua tín hiệu GPS yếu > 30 m (TC30)', () => {
    const e = engine([chuaCau]);
    expect(e.onFix(at(chuaCau, 0, 65))).toEqual([{ type: 'weak-gps', accuracy: 65 }]);
    expect(e.onFix(at(chuaCau, 5000, 65))).toEqual([]);
    expect(e.onFix(at(chuaCau, 6000, 10))).toEqual([{ type: 'gps-ok' }]);
  });

  it('vùng chồng lấn: chỉ kích hoạt một điểm theo priority (TC31)', () => {
    const e = engine([quanThang, gomSu]);
    const middle = { lat: (quanThang.lat + gomSu.lat) / 2, lng: (quanThang.lng + gomSu.lng) / 2 };
    e.onFix(at(middle, 0));
    const ev = e.onFix(at(middle, 3500));
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ place: { code: 'bao-tang-gom-su' }, action: 'play' });
  });

  it('đang nghe thì xếp hàng, hết bài tự phát bài kế (TC44)', () => {
    const e = engine([chuaCau, phungHung]);
    e.onFix(at(chuaCau, 0));
    e.onFix(at(chuaCau, 3500)); // phát Chùa Cầu
    e.onFix(at(phungHung, 10_000));
    const ev = e.onFix(at(phungHung, 13_500));
    expect(ev[0]).toMatchObject({ action: 'queue', place: { code: 'nha-co-phung-hung' } });
    expect(e.current).toBe('chua-cau');
    expect(e.next()?.code).toBe('nha-co-phung-hung');
  });

  it('bỏ bài trong hàng đợi nếu người dùng đã đi quá xa', () => {
    const e = engine([chuaCau, phungHung]);
    e.onFix(at(chuaCau, 0));
    e.onFix(at(chuaCau, 3500));
    e.onFix(at(phungHung, 10_000));
    e.onFix(at(phungHung, 13_500));
    e.onFix(at(offset(phungHung, 0, -300), 60_000));
    expect(e.next()).toBeNull();
  });

  it('hysteresis: dao động quanh mép vùng không reset thời gian dwell', () => {
    const e = engine([chuaCau]);
    const edgeIn = offset(chuaCau, 24, 0);
    const edgeOut = offset(chuaCau, 30, 0); // > 25 nhưng < 25 + 10
    e.onFix(at(edgeIn, 0));
    e.onFix(at(edgeOut, 1500));
    expect(e.onFix(at(edgeOut, 3200))[0]).toMatchObject({ type: 'trigger' });
  });

  it('khôi phục cooldown sau khi tải lại trang', () => {
    const e = new TourEngine(undefined, { 'chua-cau': 0 });
    e.setPlaces([chuaCau]);
    e.onFix(at(chuaCau, 1000));
    expect(e.onFix(at(chuaCau, 5000))).toEqual([]);
  });

  describe('chế độ điểm ở gần (tự thuyết minh không cần bấm)', () => {
    it('đứng cách 80 m: tắt chế độ thì im lặng, bật 100 m thì tự phát sau 3 giây', () => {
      const far = offset(chuaCau, 80, 0);
      const off = engine([chuaCau]);
      off.onFix(at(far, 0));
      expect(off.onFix(at(far, 4000))).toEqual([]);

      const on = engine([chuaCau]);
      on.setNearby(100);
      expect(on.onFix(at(far, 0))).toEqual([]);
      const ev = on.onFix(at(far, 3500));
      expect(ev[0]).toMatchObject({ type: 'trigger', action: 'play', place: { code: 'chua-cau' } });
    });

    it('cách 150 m vẫn không kích hoạt khi bán kính chọn là 100 m', () => {
      const e = engine([chuaCau]);
      e.setNearby(100);
      const far = offset(chuaCau, 150, 0);
      e.onFix(at(far, 0));
      expect(e.onFix(at(far, 5000))).toEqual([]);
    });

    it('nới ngưỡng sai số GPS theo bán kính (sai số 92 m dùng được với 100 m, nhưng không với chế độ tắt)', () => {
      const p = offset(chuaCau, 40, 0);
      const off = engine([chuaCau]);
      expect(off.onFix(at(p, 0, 92))).toEqual([{ type: 'weak-gps', accuracy: 92 }]);
      const on = engine([chuaCau]);
      on.setNearby(100);
      on.onFix(at(p, 0, 92));
      expect(on.onFix(at(p, 3500, 92))[0]).toMatchObject({ type: 'trigger' });
    });

    it('vẫn loại mẫu có sai số lớn hơn bán kính đã chọn', () => {
      const e = engine([chuaCau]);
      e.setNearby(50);
      expect(e.onFix(at(chuaCau, 0, 92))).toEqual([{ type: 'weak-gps', accuracy: 92 }]);
    });

    it('nhiều điểm trong phạm vi: phát điểm GẦN NHẤT trước, các điểm còn lại xếp hàng khi đang phát', () => {
      const e = engine([chuaCau, phungHung]);
      e.setNearby(100);
      const p = offset(chuaCau, 30, 0);
      e.onFix(at(p, 0));
      const first = e.onFix(at(p, 3500));
      expect(first[0]).toMatchObject({ action: 'play', place: { code: 'chua-cau' } });
      const second = e.onFix(at(p, 4000));
      expect(second[0]).toMatchObject({ action: 'queue', place: { code: 'nha-co-phung-hung' } });
    });
  });
});
