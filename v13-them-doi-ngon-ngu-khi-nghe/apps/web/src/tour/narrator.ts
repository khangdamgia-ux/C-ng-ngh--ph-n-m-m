/** Ngôn ngữ ứng dụng → mã giọng đọc của Web Speech API */
const VOICE_LANG: Record<string, string> = { vi: 'vi-VN', en: 'en-US', fr: 'fr-FR', ko: 'ko-KR', zh: 'zh-CN', ja: 'ja-JP' };

// WAV im lặng 0,1 s – dùng để “mở khóa” phần tử <audio> trong lần chạm Bắt đầu tham quan
const SILENT_WAV =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';

export interface NarrationItem {
  key: string;
  title: string;
  content: string;
  language: string;
  audioUrl: string | null;
}

export type NarratorState = 'idle' | 'playing' | 'paused' | 'blocked' | 'error';

export interface NarratorEvents {
  onState?: (s: NarratorState) => void;
  onProgress?: (fraction: number, currentS: number, durationS: number) => void;
  /** completed = nghe ≥ 90% (AUDIO_COMPLETE) */
  onEnded?: (item: NarrationItem, completed: boolean) => void;
}

/** Tách văn bản thành các câu ngắn (Chrome cắt utterance quá dài). */
export function splitSentences(text: string, max = 220): string[] {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?。！？]+[.!?。！？]*\s*/g) ?? [text];
  const out: string[] = [];
  for (const raw of parts) {
    let p = raw.trim();
    while (p.length > max) {
      const comma = p.lastIndexOf(',', max - 1);
      const cut = comma > max / 2 ? comma + 1 : max;
      out.push(p.slice(0, cut).trim());
      p = p.slice(cut).trim();
    }
    if (p) out.push(p);
  }
  return out;
}

/**
 * Trình phát thuyết minh dùng MỘT phần tử <audio> cho mọi bài (đã mở khóa ở lần chạm đầu) → các bài sau tự phát được.
 * Nếu bài chưa có file âm thanh, dùng giọng đọc tổng hợp của trình duyệt (Web Speech API) làm phương án dự phòng.
 */
export class Narrator {
  readonly audio: HTMLAudioElement;
  private item: NarrationItem | null = null;
  private chunks: string[] = [];
  private chunkIndex = 0;
  private mode: 'audio' | 'tts' | null = null;
  private state: NarratorState = 'idle';
  rate = 1;

  constructor(private readonly events: NarratorEvents = {}) {
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    this.audio.addEventListener('timeupdate', () => {
      if (this.mode !== 'audio' || !this.audio.duration) return;
      this.events.onProgress?.(this.audio.currentTime / this.audio.duration, this.audio.currentTime, this.audio.duration);
    });
    this.audio.addEventListener('ended', () => this.mode === 'audio' && this.finish(true));
    this.audio.addEventListener('error', () => {
      if (this.mode !== 'audio' || !this.item) return;
      // File âm thanh lỗi → chuyển sang giọng đọc tổng hợp, văn bản vẫn hiển thị (FR-04)
      this.startTts(this.item);
    });
  }

  get current() {
    return this.item;
  }

  get status() {
    return this.state;
  }

  static ttsAvailable() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Gọi trong sự kiện chạm của người dùng (autoplay policy). */
  async unlock() {
    try {
      this.audio.src = SILENT_WAV;
      await this.audio.play();
      this.audio.pause();
    } catch {
      /* bỏ qua – sẽ hiện nút phát nếu bị chặn */
    }
    if (Narrator.ttsAvailable()) {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
    }
  }

  async play(item: NarrationItem) {
    this.stop(false);
    this.item = item;
    this.setMediaSession(item);
    if (item.audioUrl) {
      this.mode = 'audio';
      this.audio.src = item.audioUrl;
      this.audio.playbackRate = this.rate;
      try {
        await this.audio.play();
        this.setState('playing');
      } catch (err) {
        if ((err as DOMException).name === 'NotAllowedError') this.setState('blocked');
        else this.startTts(item);
      }
    } else {
      this.startTts(item);
    }
  }

  private startTts(item: NarrationItem) {
    if (!Narrator.ttsAvailable()) return this.fail();
    this.mode = 'tts';
    speechSynthesis.cancel();
    // Chrome giữ trạng thái "pause" của hàng đợi giọng đọc sau cancel() → phải resume() thì câu mới mới phát được
    speechSynthesis.resume();
    this.chunks = splitSentences(`${item.title}. ${item.content}`);
    this.chunkIndex = 0;
    this.setState('playing');
    this.speakNext();
  }

  private pickVoice(lang: string) {
    const target = VOICE_LANG[lang] ?? lang;
    const voices = speechSynthesis.getVoices();
    return voices.find((v) => v.lang === target) ?? voices.find((v) => v.lang.toLowerCase().startsWith(lang));
  }

  private speakNext() {
    if (this.mode !== 'tts' || !this.item) return;
    if (this.chunkIndex >= this.chunks.length) return this.finish(true);
    const u = new SpeechSynthesisUtterance(this.chunks[this.chunkIndex]);
    u.lang = VOICE_LANG[this.item.language] ?? this.item.language;
    const voice = this.pickVoice(this.item.language);
    if (voice) u.voice = voice;
    u.rate = this.rate;
    const item = this.item;
    u.onend = () => {
      if (this.item !== item || this.mode !== 'tts' || this.state !== 'playing') return;
      this.chunkIndex++;
      this.events.onProgress?.(this.chunkIndex / this.chunks.length, this.chunkIndex, this.chunks.length);
      this.speakNext();
    };
    u.onerror = (e) => {
      if (this.item !== item) return;
      if (e.error === 'not-allowed') this.setState('blocked');
      else if (e.error !== 'interrupted' && e.error !== 'canceled') this.fail();
    };
    speechSynthesis.speak(u);
  }

  pause() {
    if (this.state !== 'playing') return;
    if (this.mode === 'audio') this.audio.pause();
    else speechSynthesis.pause();
    this.setState('paused');
  }

  /**
   * Đổi sang bản thuyết minh khác của CÙNG bài (vd. người dùng đổi ngôn ngữ giữa chừng).
   * Đang phát → phát ngay bản mới; đang tạm dừng → nạp sẵn bản mới, giữ tạm dừng, bấm Phát sẽ nghe bản mới.
   */
  async swap(item: NarrationItem) {
    if (this.state !== 'paused') return this.play(item);
    this.mode = null;
    this.audio.pause();
    if (Narrator.ttsAvailable()) {
      speechSynthesis.cancel();
      speechSynthesis.resume();
    }
    this.item = item;
    this.chunks = [];
    this.chunkIndex = 0;
    this.setMediaSession(item);
    this.events.onProgress?.(0, 0, 0);
    this.setState('paused');
  }

  resume() {
    if (this.state === 'blocked' && this.item) return void this.play(this.item);
    if (this.state !== 'paused') return;
    // Bản đã nạp sẵn bằng swap() nhưng chưa phát
    if (this.mode === null && this.item) return void this.play(this.item);
    if (this.mode === 'audio') void this.audio.play();
    else speechSynthesis.resume();
    this.setState('playing');
  }

  /** Tua ±giây (audio) hoặc ±câu (giọng đọc). */
  seek(deltaS: number) {
    if (this.mode === 'audio') {
      this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + deltaS));
    } else if (this.mode === 'tts') {
      this.chunkIndex = Math.max(0, Math.min(this.chunks.length - 1, this.chunkIndex + (deltaS > 0 ? 1 : -1)));
      speechSynthesis.cancel();
      speechSynthesis.resume();
      this.setState('playing');
      this.speakNext();
    }
  }

  setRate(rate: number) {
    this.rate = rate;
    this.audio.playbackRate = rate;
  }

  restart() {
    if (this.item) void this.play(this.item);
  }

  stop(notify = true) {
    const item = this.item;
    const progressed = this.mode === 'audio' ? (this.audio.duration ? this.audio.currentTime / this.audio.duration : 0) : this.chunks.length ? this.chunkIndex / this.chunks.length : 0;
    this.mode = null;
    this.audio.pause();
    if (Narrator.ttsAvailable()) {
      speechSynthesis.cancel();
      speechSynthesis.resume();
    }
    this.item = null;
    this.setState('idle');
    if (notify && item) this.events.onEnded?.(item, progressed >= 0.9);
  }

  /**
   * Không phát được (không có giọng đọc / file lỗi): giữ trạng thái 'error' để giao diện báo cho người dùng
   * (văn bản vẫn đọc được) nhưng vẫn báo kết thúc để chế độ rảnh tay chuyển sang bài kế tiếp, không bị kẹt.
   */
  private fail() {
    const item = this.item;
    this.mode = null;
    this.item = null;
    this.setState('error');
    if (item) this.events.onEnded?.(item, false);
  }

  private finish(completed: boolean) {
    const item = this.item;
    this.mode = null;
    this.item = null;
    this.setState('idle');
    if (item) this.events.onEnded?.(item, completed);
  }

  private setState(s: NarratorState) {
    this.state = s;
    this.events.onState?.(s);
  }

  private setMediaSession(item: NarrationItem) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: item.title, artist: 'Hội An Audio Guide', album: 'Phố cổ Hội An' });
    navigator.mediaSession.setActionHandler('play', () => this.resume());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => this.seek(-10));
    navigator.mediaSession.setActionHandler('seekforward', () => this.seek(10));
  }
}
