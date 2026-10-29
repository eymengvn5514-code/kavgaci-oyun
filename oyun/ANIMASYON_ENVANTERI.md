# Animasyon varlıkları ve bağlama durumu

Bu not, mevcut GLB dosyalarının içerik taramasına dayanır. Ortak animasyon kaynağı `frontend/src/assets/anims/library.glb` dosyasıdır ve şu klipleri içerir: Running, Walking, yumruk, tekme, Agree_Gesture, Arise, Attack, BeHit_FlyUp, Boxing_Practice, Dead ve Skill_03.

## Mevcut karakter dosyaları

| Karakter | Model | Rig | Animasyon |
|---|---|---|---|
| FROZman | Var | Yok | Yok |
| Kuroi | Var | Var | Koşma/yürüme |
| Gaia | Yok | — | — |
| Volt | Var | Yok | Yok |
| Blaze | Yok | — | — |
| Riptide | Yok | — | — |
| Zephyr | Yok | — | — |
| Titan | Var | Yok | Yok |
| Crimson | Var | Var | 11 klip |
| Ghost | Var | Var | 11 klip |
| Fang | Yok | — | — |
| Venom | Yok | — | — |
| Banshee | Yok | — | — |
| Zombie Combie | Var | Var | 8 klip |
| CX-9 | Var | Yok | Yok |
| Wraith | Yok | — | — |
| Ossuary | Yok | — | — |
| Singularity | Yok | — | — |
| Chronos | Yok | — | — |
| Seraph | Yok | — | — |

## Hazır animasyonlu model dosyaları

`animasyonlar/tekme ve yumruk/Meshy_AI_Horned_Skull_Shaman_All_Animations.glb` içinde 11 klip bulunur; diğer numaralı kopyalar aynı içeriktedir. `zombi karakteri için/.../Meshy_AI_Tattered_Ghoul_Mascot_All_Animations.glb` zombi modelinin kaynak dosyasıdır. Bunlar ortak iskelet animasyon klipleri için kaynak olarak değerlendirilir; modellerin görünüşü bu dosyalardan değiştirilmez.

## İstenen ek hareketler

- Idle, yürüme, koşma, zıplama, yumruk, tekme, çömelme yumruğu ve çömelme tekmesi
- Havada uçan tekme, havada yumruk, blok, hasar alma, yere düşme ve ayağa kalkma
- Her karaktere özel yetenek animasyonu, finisher ve zafer pozu

Projede şu an havadan/yerden vuruşlar oyun durumları olarak ayrılmıştır. Kaynak kütüphanede ayrı bir uçan tekme, havada yumruk ve blok klibi bulunmuyor; bu hareketler için Mixamo’dan uygun kliplerin indirilip `library.glb` ortak kütüphanesine eklenmesi gerekir.

## Mixamo indirme ayarı

Riglenmemiş mevcut Meshy modellerini görünüş olarak koruyarak animasyon oynatmak için Mixamo’ya her karakterin kopyası yüklenmeli, otomatik iskelet oluşturulmalı ve model FBX/GLB olarak dışa aktarılmalıdır. Mixamo dışa aktarımında `Without Skin` animasyonları karakter iskeletine uyumlu olmalıdır. Kullanıcı varlıklarını değiştirmemek için dışa aktarılan yeni sürümler yeni dosya adıyla saklanmalıdır.
