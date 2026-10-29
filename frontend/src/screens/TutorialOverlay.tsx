import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';
import type { Group } from 'three';
import { useTranslation } from 'react-i18next';
import { useGameStore } from '../store/useGameStore';

/** Tanıtımcı modelini hedef boyuta oturtup hafifçe döndürür. */
function Bust({ url }: { url: string }) {
  const { scene } = useGLTF(url, false, true);
  const group = useRef<Group>(null);
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = new Vector3();
    box.getSize(size);
    const center = new Vector3();
    box.getCenter(center);
    const s = 1.75 / Math.max(0.001, size.y);
    // modelin dikey ortası orijine gelsin (kamera -Z'ye bakar)
    return {
      s,
      offset: new Vector3(-center.x, -(box.min.y + size.y / 2), -center.z),
    };
  }, [scene]);
  useFrame((state) => {
    if (group.current) group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.5;
  });
  return (
    <group ref={group}>
      <group scale={fit.s}>
        <group position={fit.offset}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

type Diagram = 'none' | 'controls' | 'skills' | 'account';

interface Step {
  who: 'efe' | 'recep';
  tr: string;
  en: string;
  diagram: Diagram;
}

const STEPS: Step[] = [
  {
    who: 'efe',
    tr: 'Merhaba! Ben Efe. Bu oyunu sana adım adım tanıtacağım. Hazırsan başlayalım.',
    en: "Hi! I'm Efe. I'll walk you through the game step by step. Let's go.",
    diagram: 'none',
  },
  {
    who: 'efe',
    tr: 'Menüde SINGLE düğmesine bas — seni karakter seçme ekranına götürür. Orada dövüşçünü seç.',
    en: 'Press SINGLE in the menu — it takes you to character select. Pick your fighter there.',
    diagram: 'none',
  },
  {
    who: 'efe',
    tr: 'Her karakterin CAN, GÜÇ, HIZ ve MENZİL değerleri farklıdır. A / D ile yürü, BOŞLUK ile zıpla; havadayken sağ tıkla uçan tekme at.',
    en: 'Every fighter has different HP, POWER, SPEED and RANGE. Move with A / D, hold SHIFT to run, jump with SPACE, and right-click in the air for a flying kick.',
    diagram: 'controls',
  },
  {
    who: 'efe',
    tr: 'Savaşta: sol tık = YUMRUK, sağ tık = TEKME. Eğilip (S) vurursan alçak vuruş olur.',
    en: 'In a fight: LEFT CLICK = PUNCH, RIGHT CLICK = KICK. Crouch (S) for a low hit.',
    diagram: 'controls',
  },
  {
    who: 'efe',
    tr: 'E / C / Q yeteneklerini kullanır. R ise ULTIMATE — sadece canın %50ye düşünce açılır.',
    en: 'Cast skills with E / C / Q. R is your ULTIMATE — it unlocks at 50% HP.',
    diagram: 'skills',
  },
  {
    who: 'efe',
    tr: 'Rakibini R ile öldürürsen FATALITY — yakın çekime girip kafasını koparırsın. E ile öldürürsen LABALITY olur.',
    en: 'Kill with R → FATALITY close-up (you rip the head off). Kill with E → LABALITY.',
    diagram: 'skills',
  },
  {
    who: 'recep',
    tr: 'Ben Recep! Maç bitince cinsiyetini ve ismini seçip hesabını oluşturursun.',
    en: "I'm Recep! When the match ends, pick your gender and name to create your account.",
    diagram: 'account',
  },
  {
    who: 'recep',
    tr: 'Online maçlarda rakip bu ismi görür — "raiden" gibi hazır isim yok. İsmini haftada 1 kez değiştirebilirsin.',
    en: 'Online opponents see this name — no default names. You can change it once a week.',
    diagram: 'account',
  },
];

export default function TutorialOverlay() {
  const { t, i18n } = useTranslation();
  const language = useGameStore((s) => s.language);
  const setTutorialSeen = useGameStore((s) => s.setTutorialSeen);
  const [step, setStep] = useState(0);
  const [shown, setShown] = useState(false);

  // site açıldıktan ~3 sn sonra ekrana gel (perde 5 sn sürer → toplam ~8 sn).
  useEffect(() => {
    const id = setTimeout(() => setShown(true), 3000);
    return () => clearTimeout(id);
  }, []);

  if (!shown) return null;

  const s = STEPS[step];
  const lang = language === 'en' ? 'en' : 'tr';
  const text = s[lang === 'en' ? 'en' : 'tr'];
  const last = step === STEPS.length - 1;

  const close = () => {
    setTutorialSeen(true);
    setShown(false);
  };

  const bust = s.who === 'efe' ? '/tutorial/efe.glb' : '/tutorial/recep.glb';

  return (
    <div className="tutorial-overlay">
      <div className="tut-stage">
        <Canvas camera={{ position: [0, 0.05, 3.4], fov: 38 }} dpr={[1, 1.6]} className="tut-canvas">
          <ambientLight intensity={1.1} />
          <directionalLight position={[3, 6, 4]} intensity={2} />
          <pointLight position={[-2, 2, 2]} intensity={12} color="#ffd9a0" />
          <Suspense fallback={null}>
            <Bust url={bust} />
          </Suspense>
        </Canvas>
        <div className="tut-speaker">{s.who === 'efe' ? 'EFE' : 'RECEP'}</div>
      </div>

      <div className="tut-bubble">
        <p>{text}</p>

        {s.diagram === 'controls' && (
          <div className="tut-diagram">
            <span className="tut-arrow left">←</span>
            <span className="tut-key">A</span>
            <span className="tut-key">D</span>
            <span className="tut-arrow right">→</span>
            <span className="tut-key wide punch">YUMRUK <i>sol tık</i></span>
            <span className="tut-key wide kick">TEKME <i>sağ tık</i></span>
          </div>
        )}
        {s.diagram === 'skills' && (
          <div className="tut-diagram">
            <span className="tut-key">E</span>
            <span className="tut-key">C</span>
            <span className="tut-key">Q</span>
            <span className="tut-key ult">R · ULTIMATE</span>
          </div>
        )}
        {s.diagram === 'account' && (
          <div className="tut-diagram">
            <span className="tut-key wide">♂ / ♀</span>
            <span className="tut-key wide">İSİM</span>
            <span className="tut-key wide">HAFTADA 1 DEĞİŞİM</span>
          </div>
        )}

        <div className="tut-actions">
          <button className="btn btn-ghost" onClick={close}>
            {t('tutorial.skip')}
          </button>
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep((n) => n - 1)}>
              {t('tutorial.prev')}
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => (last ? close() : setStep((n) => n + 1))}
          >
            {last ? t('tutorial.start') : t('tutorial.next')}
          </button>
        </div>
        <div className="tut-dots">
          {STEPS.map((_, i) => (
            <i key={i} className={i === step ? 'on' : ''} onClick={() => setStep(i)} />
          ))}
        </div>
      </div>
      {i18n.language !== language && null}
    </div>
  );
}
