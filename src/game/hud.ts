import { FUEL } from '../config';

type OverlayName = 'loading' | 'title' | 'gameover' | 'paused' | 'hud';

function el(id: string): HTMLElement {
  const e = document.getElementById(id);
  if (!e) throw new Error('missing element #' + id);
  return e;
}

function pad6(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(6, '0');
}

export class Hud {
  private score = el('score');
  private hiscore = el('hiscore');
  private level = el('level');
  private lives = el('lives-panel');
  private altFill = el('alt-fill');
  private fuelFill = el('fuel-fill');
  private flashMsg = el('flash-msg');
  private loadingFill = el('loading-fill');
  private titleHi = el('title-hiscore');
  private goScore = el('go-score');
  private goHi = el('go-hiscore');
  private goHiLine = el('go-hi-line');

  private overlays: Record<OverlayName, HTMLElement> = {
    loading: el('overlay-loading'),
    title: el('overlay-title'),
    gameover: el('overlay-gameover'),
    paused: el('overlay-paused'),
    hud: el('hud'),
  };

  private flashTimer: number | null = null;

  setScore(n: number): void { this.score.textContent = pad6(n); }
  setHiScore(n: number): void { this.hiscore.textContent = pad6(n); }
  setLevel(n: number): void { this.level.textContent = String(n); }
  setLives(n: number): void { this.lives.textContent = '▲'.repeat(Math.max(0, n)); }

  setFuel(frac: number): void {
    const pct = Math.max(0, Math.min(1, frac)) * 100;
    this.fuelFill.style.width = pct + '%';
    if (frac < FUEL.LOW / FUEL.MAX) this.fuelFill.classList.add('low');
    else this.fuelFill.classList.remove('low');
  }

  setAltitude(frac: number): void {
    this.altFill.style.height = Math.max(0, Math.min(1, frac)) * 100 + '%';
  }

  setLoading(frac: number): void {
    this.loadingFill.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
  }

  show(name: OverlayName): void { this.overlays[name].classList.remove('hidden'); }
  hide(name: OverlayName): void { this.overlays[name].classList.add('hidden'); }

  flash(msg: string): void {
    this.flashMsg.textContent = msg;
    this.flashMsg.style.opacity = '1';
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    this.flashTimer = window.setTimeout(() => {
      this.flashMsg.style.opacity = '0';
      this.flashTimer = null;
    }, 1200);
  }

  setTitleHiScore(n: number): void { this.titleHi.textContent = pad6(n); }

  setGameOver(score: number, hi: number, isNewHi: boolean): void {
    this.goScore.textContent = pad6(score);
    this.goHi.textContent = pad6(hi);
    this.goHiLine.textContent = isNewHi ? 'NEW HIGH SCORE! ' + pad6(hi) : 'HIGH SCORE ' + pad6(hi);
  }
}
