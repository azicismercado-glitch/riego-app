// Subida de archivos (fotos y documentos) a Cloudinary en vez del disco local
// de Render, que se borra en cada redeploy del plan gratuito.
//
// Se configura solo con la variable de entorno CLOUDINARY_URL
// (cloudinary://API_KEY:API_SECRET@CLOUD_NAME) — el SDK la lee sola, no hace
// falta pasarle cloud_name/api_key/api_secret a mano.
const cloudinary = require('cloudinary').v2;

function configured() {
  return !!process.env.CLOUDINARY_URL;
}

// Sube un buffer (archivo ya en memoria, no en disco) a una carpeta del
// diagnóstico. Las imágenes van como resource_type "image" (permite verlas
// directo); todo lo demás (PDF) va como "raw", que guarda el archivo tal
// cual sin intentar interpretarlo — un PDF con algún problema menor igual
// se sube, en vez de que Cloudinary lo rechace por no poder "leerlo".
function subirBuffer(buffer, { folder, publicId, mimetype }) {
  const resource_type = mimetype && mimetype.startsWith('image/') ? 'image' : 'raw';
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type, overwrite: true },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

// Borra un archivo subido antes. resource_type hay que acertarlo (no se
// adivina solo al borrar) — se intenta primero como imagen y si no existe
// se prueba como "raw" (PDF), sin cortar el flujo si de última no estaba.
async function borrar(publicId, resourceTypeHint) {
  if (!publicId) return;
  const tipos = resourceTypeHint ? [resourceTypeHint] : ['image', 'raw'];
  for (const resource_type of tipos) {
    try {
      const r = await cloudinary.uploader.destroy(publicId, { resource_type });
      if (r.result === 'ok') return;
    } catch (e) {
      // sigue probando con el otro resource_type
    }
  }
}

module.exports = { cloudinary, configured, subirBuffer, borrar };
