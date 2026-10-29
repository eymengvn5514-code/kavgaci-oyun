import { useEffect, useRef, useState } from 'react';

/** Harita tanıtım görselleri — maça girerken 1 sn'lik slayt gösterisi. */
export const MAP_INTRO: Partial<Record<string, string[]>> = {
  colosseum: ['/maps/colosseum-1.jpg', '/maps/colosseum-2.jpg'],
};

export function MapIntro({
  stageId,
  label,
  onDone,
}: {
  stageId: string;
  /** Haritanın görünen adı (opsiyonel). */
  label?: string;
  onDone: () => void;
}) {
  const images = MAP_INTRO[stageId];
  const [index, setIndex] = useState(0);
  // onDone her çizimde yeniden oluşturulabilir (inline ok) — ref ile sabit tut,
  // yoksa zamanlayıcı her karede sıfırlanır ve slayt ilerlemez.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!images || images.length === 0 || index >= images.length) {
      doneRef.current();
      return;
    }
    const id = setTimeout(() => setIndex((n) => n + 1), 1000);
    return () => clearTimeout(id);
  }, [index, images]);

  if (!images || images.length === 0 || index >= images.length) return null;

  return (
    <div className="map-intro" onClick={onDone}>
      <img key={index} src={images[index]} alt="" className="map-intro-img" />
      {label && <div className="map-intro-label">{label}</div>}
      <div className="map-intro-dots">
        {images.map((_, i) => (
          <i key={i} className={i === index ? 'on' : ''} />
        ))}
      </div>
    </div>
  );
}
