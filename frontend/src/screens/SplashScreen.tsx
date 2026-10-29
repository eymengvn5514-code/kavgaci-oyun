import { useEffect, useRef, useState } from 'react';
import { audio, SFX } from '../audio/audio';

/** Site açılış perdesi: 5 sn görsel + yükleme çubuğu + açılış sesi. */
export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const done = useRef(false);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    audio.playSfx(SFX.intro, 1);
    const start = performance.now();
    const DURATION = 5000;
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (performance.now() - start) / DURATION);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else finish();
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = Math.round(progress * 100);

  return (
    <div className="splash" onClick={finish}>
      <div className="splash-img" />
      <div className="splash-title">KAVGACI</div>
      <div className="splash-bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="splash-pct">{pct}%</div>
      <div className="splash-skip">geçmek için dokun</div>
    </div>
  );
}
