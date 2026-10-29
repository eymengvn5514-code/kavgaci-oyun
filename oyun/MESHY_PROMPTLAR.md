# Meshy AI — Karakter Prompt'ları (kopyala-yapıştır hazır)

> Meshy **İngilizce** prompt ile en iyi çalışır. Aşağıdaki blokları olduğu gibi Meshy'nin **Text to 3D** kutusuna yapıştır.
> Her prompt'un sonunda ortak **kalıp** var: `T-pose, full body, front view, game-ready game asset, clean topology, PBR textures, plain neutral background, stylized semi-realistic game character`.

---

## Ortak Kalıp (SUFFIX)

```
... , T-pose, A-pose, full body, front view, game-ready game character asset, clean topology, low-mid poly, PBR textures, plain neutral gray background, stylized semi-realistic
```

**Style seçimi (Meshy panel):** `Realistic` veya `Cartoon` — dövüş oyunu için **Cartoon / Stylized** önerilir (silüet daha okunur, dönüş daha hafif).
**Pose:** mutlaka **T-pose** (rigging için şart).
**Texture:** `2K` yeter (mobilde 1K).

---

## 1. FROZman — Buz
```
humanoid ice warrior, blue and white crystalline armor, spiked ice shoulder plates, glowing ice-blue eyes, frost mist rising from body, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 2. Volt — Yıldırım
```
humanoid thunder warrior, glowing blue eyes, oval conical straw hat, electric lightning arcs running across body and clothes, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 3. Blaze — Ateş
```
humanoid fire warrior, crimson and black cracked skin with glowing lava veins, orange glowing eyes, flame tips on hair, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 4. Ghost — Hayalet
```
translucent ghost warrior, pale blue-white semi-transparent body, flowing tattered short cloak, blank glowing blue face, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 5. Zombie Combie — Zombi
```
zombie street fighter, torn gray hoodie, green-gray rotting skin, one drooping eye, slingshot in pocket, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```
> **Not:** "baby zombie"yı ayrı küçük bir model olarak yap — tek prompt'a iki karakter koymak Meshy'yi karıştırır.

## 6. Wraith — Gölge
```
shadow wraith, black smoke cloak, faceless head, two glowing purple-red eyes, dark aura, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```
> Uzun pelerin riglemede takılabilir; **kısa/orta** tut.

## 7. Titan — Toprak
```
earth golem titan, massive rocky body, orange magma cracks, huge stone hands, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 8. Zephyr — Rüzgar
```
wind spirit warrior, white and green light outfit, flowing hair, translucent wind trails around body, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 9. Riptide — Su
```
water warrior, blue-turquoise fluid body, wave-shaped flowing hair, water droplets, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 10. Kuroi — Çelik (Kılıç Ustası)
```
samurai swordsman, plain black robes, face mask, T-pose empty hands, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```
> **Katana'yı ayrı model** yap (prop). Karakter eli boş/riglenebilir olsun.

## 11. Fang — Kurtadam
```
werewolf brawler, muscular furry body, torn clothes, long claws, glowing yellow eyes, wolf fangs, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 12. CX-9 — Siber
```
cyborg fighter, chrome metal body, single red laser eye, small drone backpack, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 13. Venom — Zehir
```
poison warrior, purple-green dripping body, toxic mist, glowing yellow-green eyes, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 14. Banshee — Ses
```
ghost banshee woman, pale white skin, long black hair, open mouth screaming, faint sonic wave distortion around head, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 15. Seraph — Işık (Kutsal)
```
holy angel warrior, gold and white armor, two glowing light wings, halo above head, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 16. Crimson — Kan (Vampir)
```
vampire noble, black and red short cape, pale skin, red eyes, sharp fangs, floating blood droplets, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 17. Ossuary — Kemik (Nekromant)
```
necromancer, tall thin robed figure, bone-white owl mask, bone staff in hand, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 18. Singularity — Yerçekimi
```
gravity warrior, dark purple energy armor, rotating glowing rings behind back, bent light around body, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 19. Chronos — Zaman
```
time warrior, two-tone blue and yellow split armor, clock gears on back, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

## 20. Gaia — Doğa
```
nature warrior, leaf and bark armor, flowers and vines in hair, green-brown skin, T-pose, full body, front view, game-ready game character asset, clean topology, PBR textures, plain neutral gray background, stylized semi-realistic
```

---

## Genel Kurallar (Meshy'de başarı için)

- **T-pose şart.** "A-pose" da olur. Pose yazmazsan rigleme bozulur.
- **Tek karakter per prompt.** Yardımcı (baby zombie, drone, iskelet) ayrı model.
- **Silüet net olsun.** Dövüş oyununda karakter uzaktan ayırt edilebilmeli (renk + şekil farkı).
- **Uzun pelerin/bol kıyafetten kaçın** → riglemede takılır (Wraith, Crimson, Ossuary'de kısa tut).
- **Silahı ayrı yap** (katana, asa, mızrak). Elle tutulan eşyalar rigi kirletir.
- **Yüz detayı düşük** olsun; dövüş oyununda kamera uzak, detay gereksiz.
- Meshy'de **Auto-Rig → Animate** adımından sonra **GLB** export et (animasyonlar gömülü gelir).
- **Scale:** Meshy çıktısı bazen metre değil; Three.js'te `0.01` düzeltmesi gerekebilir.
