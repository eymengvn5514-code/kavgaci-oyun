import { useGLTF } from '@react-three/drei';
import { MODEL_URLS } from './models';

// Begin fetching the playable character meshes while the splash/menu is visible.
for (const url of Object.values(MODEL_URLS)) useGLTF.preload(url, false, true);

export {};
