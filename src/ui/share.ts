import qrcode from 'qrcode-generator';
import { GAME, tierById } from '../config';
import type { CastSummary } from '../core/game';
import { captain, creature } from './art';
import { fmtNum } from './dom';

/** Plain-text result for messages. No personal details. */
export function shareText(sum: CastSummary): string {
  const icons = sum.catches.map((c) => tierById(c.tier).emoji).join('');
  const wager = sum.wager === 'won' ? ' · Wager ✓' : sum.wager === 'lost' ? ' · Wager ✗' : '';
  return `Oddfish #${sum.day} 🎣\n${icons}\n${fmtNum(sum.totalKg)} kg · ${sum.correct}/7${wager}\n${GAME.shareUrl}`;
}

const W = 1080, H = 1920;
const C = { navy: '#10243A', deep: '#18344B', muted: '#42677D', cream: '#F7F0E3', sand: '#E8D5B5', gold: '#E7AD58' };

function svgImage(svg: string): Promise<HTMLImageElement> {
  const withNs = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withNs)}`;
  });
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** A 9:16 card that reads well in Stories, TikTok and chats. */
export async function renderShareCard(sum: CastSummary): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load('italic 600 120px Fraunces'), document.fonts.load('600 160px Fraunces'), document.fonts.load('500 40px Inter')]);
  } catch {
    /* fall back to system fonts */
  }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = C.navy;
  g.fillRect(0, 0, W, H);

  // Moon glow
  const glow = g.createRadialGradient(840, 250, 20, 840, 250, 320);
  glow.addColorStop(0, 'rgba(231,173,88,.22)');
  glow.addColorStop(1, 'rgba(231,173,88,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, 700);
  g.fillStyle = '#F3DDB0';
  g.beginPath();
  g.arc(840, 250, 70, 0, Math.PI * 2);
  g.fill();

  const cat = await svgImage(captain(sum.legendaries > 0 ? 'shocked' : sum.totalKg >= 800 ? 'happy' : 'grumpy'));
  g.drawImage(cat, 120, 150, 150, 140);

  g.textAlign = 'center';
  g.fillStyle = C.cream;
  g.font = 'italic 600 140px Fraunces, Georgia, serif';
  g.fillText('Oddfish', W / 2, 420);
  g.strokeStyle = C.cream;
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(370, 462);
  g.bezierCurveTo(470, 430, 560, 440, 620, 456);
  g.bezierCurveTo(680, 472, 740, 470, 790, 444);
  g.stroke();

  g.fillStyle = C.sand;
  g.font = '500 44px Inter, system-ui, sans-serif';
  g.fillText(`Daily Cast #${sum.day}`, W / 2, 560);

  // Haul plaque
  g.fillStyle = 'rgba(0,0,0,.25)';
  roundRect(g, 170, 638, 740, 250, 36);
  g.fill();
  g.fillStyle = C.sand;
  roundRect(g, 170, 626, 740, 250, 36);
  g.fill();
  g.fillStyle = C.navy;
  g.font = '600 150px Fraunces, Georgia, serif';
  g.fillText(`${fmtNum(sum.totalKg)} kg`, W / 2, 805);

  // Seven catches
  const imgs = await Promise.all(sum.catches.map((c) => svgImage(creature(c.species))));
  const size = 128, gap = 14, total = imgs.length * size + (imgs.length - 1) * gap;
  imgs.forEach((img, i) => {
    const x = (W - total) / 2 + i * (size + gap);
    g.fillStyle = C.deep;
    roundRect(g, x, 960, size, size, 26);
    g.fill();
    g.drawImage(img, x + 10, 960 + 22, size - 20, (size - 20) * (80 / 120));
  });

  // Details
  const rows: [string, string][] = [
    ['Correct answers', `${sum.correct} / 7`],
    ['Rarest catch', sum.rarest ? `${tierById(sum.rarest.tier).name} · ${fmtNum(sum.rarest.kg)} kg` : '—'],
    ['Captain’s Wager', sum.wager === 'won' ? 'Won ×2' : sum.wager === 'lost' ? 'Lost' : 'Not used'],
  ];
  rows.forEach(([k, v], i) => {
    const y = 1210 + i * 96;
    g.textAlign = 'left';
    g.fillStyle = 'rgba(247,240,227,.7)';
    g.font = '500 40px Inter, system-ui, sans-serif';
    g.fillText(k, 170, y);
    g.textAlign = 'right';
    g.fillStyle = k === 'Rarest catch' && sum.rarest?.tier === 'leviathan' ? C.gold : C.cream;
    g.font = '600 40px Inter, system-ui, sans-serif';
    g.fillText(v, 910, y);
    g.fillStyle = 'rgba(247,240,227,.12)';
    g.fillRect(170, y + 34, 740, 2);
  });

  // QR + link
  const qr = qrcode(0, 'M');
  qr.addData(GAME.shareUrl);
  qr.make();
  const n = qr.getModuleCount(), qs = 200, cell = qs / n, qx = 170, qy = 1580;
  g.fillStyle = C.cream;
  roundRect(g, qx - 16, qy - 16, qs + 32, qs + 32, 20);
  g.fill();
  g.fillStyle = C.navy;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect(qx + c * cell, qy + r * cell, Math.ceil(cell), Math.ceil(cell));
  g.textAlign = 'left';
  g.fillStyle = C.cream;
  g.font = '600 46px Fraunces, Georgia, serif';
  g.fillText('Cast your line', 440, 1650);
  g.fillStyle = 'rgba(247,240,227,.7)';
  g.font = '500 32px Inter, system-ui, sans-serif';
  g.fillText(GAME.shareUrl.replace(/^https:\/\//, '').replace(/\/$/, ''), 440, 1708);


  return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Could not draw the card'))), 'image/png'));
}

/** Share the card through the system share sheet, or download it. */
export async function shareCard(sum: CastSummary): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await renderShareCard(sum);
  const file = new File([blob], `oddfish-${sum.day}.png`, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: shareText(sum) });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
