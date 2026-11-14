export const DOCKER_DEV = process.env.REACT_APP_DOCKER_DEV === 'true';
const docker = DOCKER_DEV;
const external = !docker || process.env.REACT_APP_DEV_INTEGRATIONS === 'true';
const legacyGoogle = '620840983651-ue12o2dcdbr9o7iv0dkmhj4ed6vstno4.apps.googleusercontent.com';
const legacyCloud = 'dw1sepw7z';
const google = process.env.REACT_APP_GOOGLE_CLIENT_ID || (!docker ? legacyGoogle : '');
const cloud = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME || (!docker ? legacyCloud : '');
const preset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET || (!docker ? 'quill_preset' : '');

export const GOOGLE_CLIENT_ID = external ? google : '';
export const GOOGLE_LOGIN_ENABLED = Boolean(GOOGLE_CLIENT_ID);
export const CLOUDINARY = external
  ? { cloudName: cloud, uploadPreset: preset }
  : { cloudName: '', uploadPreset: '' };
export const IMAGE_UPLOAD_ENABLED = Boolean(CLOUDINARY.cloudName && CLOUDINARY.uploadPreset);
